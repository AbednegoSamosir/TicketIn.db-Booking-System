// k6 load test — 500 VUs fight for the same seat
// run: k6 run benchmarks/k6-test.js --out csv=benchmarks/results.csv
// make sure the server is running with DISABLE_RATE_LIMIT=true and the db is seeded

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';
import { SharedArray } from 'k6/data';

// custom counters so we can track exactly how many 200s, 409s, etc.
const lockGranted  = new Counter('lock_granted_200');
const lockDenied   = new Counter('lock_denied_409');
const holdExpired  = new Counter('hold_expired_410');
const serverErrors = new Counter('server_errors_5xx');
const otherErrors  = new Counter('other_errors');
const BASE_URL   = __ENV.BASE_URL || 'http://localhost:3000';
const TARGET_SEAT = __ENV.TARGET_SEAT || 'G12';
const VU_COUNT   = 500;

export const options = {
    scenarios: {
        stampede: {
            executor: 'shared-iterations',
            vus: VU_COUNT,
            iterations: VU_COUNT,
            maxDuration: '60s',
        },
    },
    thresholds: {
        'lock_granted_200': ['count==1'],   // only 1 VU should get the lock
        'server_errors_5xx': ['count==0'],  // no crashes
    },
};

export function setup() {
    // grab a real showtime id from the db
    const moviesRes = http.get(`${BASE_URL}/api/movies`);
    const movies = JSON.parse(moviesRes.body);
    if (!movies || movies.length === 0) {
        throw new Error('No movies found. Run: npm run seed');
    }

    let showtimeId = null;
    for (const movie of movies) {
        const stRes = http.get(`${BASE_URL}/api/showtimes/${movie._id}`);
        if (stRes.status === 200) {
            const showtimes = JSON.parse(stRes.body);
            if (showtimes.length > 0) {
                showtimeId = showtimes[0]._id;
                break;
            }
        }
    }
    if (!showtimeId) {
        throw new Error('No showtimes found. Run: npm run seed');
    }

    // register a test account per VU so each one has its own JWT
    const tokens = [];
    for (let i = 0; i < VU_COUNT; i++) {
        const accountName = `k6_vu_${Date.now()}_${i}`;
        const regRes = http.post(
            `${BASE_URL}/api/auth/register`,
            JSON.stringify({ accountName, password: 'benchmark123' }),
            { headers: { 'Content-Type': 'application/json' } }
        );

        if (regRes.status === 201) {
            const data = JSON.parse(regRes.body);
            tokens.push(data.token);
        } else {
            console.warn(`Registration failed for VU ${i}: ${regRes.status}`);
            tokens.push(null);
        }
    }

    console.log(`\nSetup done: ${tokens.filter(Boolean).length} VUs registered, target seat ${TARGET_SEAT}, showtime ${showtimeId}\n`);

    return { showtimeId, tokens, targetSeat: TARGET_SEAT };
}

// each VU sends exactly one lock request for the same seat
export default function (data) {
    const token = data.tokens[__VU - 1];
    if (!token) {
        otherErrors.add(1);
        return;
    }

    const payload = JSON.stringify({
        showtimeId: data.showtimeId,
        seatNumbers: [data.targetSeat],
    });

    const res = http.post(`${BASE_URL}/api/bookings/lock-seats`, payload, {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
    });

    if (res.status === 200) {
        lockGranted.add(1);
        check(res, { 'lock acquired (200)': (r) => r.status === 200 });
    } else if (res.status === 409) {
        lockDenied.add(1);
        check(res, { 'lock denied (409)': (r) => r.status === 409 });
    } else if (res.status === 410) {
        holdExpired.add(1);
    } else if (res.status >= 500) {
        serverErrors.add(1);
        console.error(`5xx from VU ${__VU}: ${res.body}`);
    } else {
        otherErrors.add(1);
        console.warn(`Unexpected ${res.status} from VU ${__VU}: ${res.body}`);
    }
}

export function teardown(data) {
    console.log(`\nDone. Seat ${data.targetSeat}, showtime ${data.showtimeId}`);
    console.log(`Expected: 1x 200, ${VU_COUNT - 1}x 409, 0x 5xx\n`);
}
