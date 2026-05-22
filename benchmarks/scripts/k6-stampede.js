// 500 VUs race for the same seat. Pass = exactly 1x 200, 499x 409, 0x 5xx.

import http from 'k6/http';
import { check } from 'k6';
import { Counter, Trend } from 'k6/metrics';

const lockGranted   = new Counter('lock_granted_200');
const lockDenied    = new Counter('lock_denied_409');
const holdExpired   = new Counter('hold_expired_410');
const serverErrors  = new Counter('server_errors_5xx');
const otherErrors   = new Counter('other_errors');
const lockLatency   = new Trend('lock_latency_ms', true);

const BASE_URL   = __ENV.BASE_URL    || 'http://localhost:3000';
const TARGET_SEAT = __ENV.TARGET_SEAT || 'G12';
const VU_COUNT   = parseInt(__ENV.VU_COUNT || '500', 10);

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
        'lock_granted_200':  ['count==1'],
        'server_errors_5xx': ['count==0'],
    },
};

export function setup() {
    const moviesRes = http.get(`${BASE_URL}/api/movies`);
    if (moviesRes.status !== 200) {
        throw new Error(`GET /api/movies failed: ${moviesRes.status}. Is the backend running?`);
    }
    const movies = JSON.parse(moviesRes.body);
    if (!movies || movies.length === 0) {
        throw new Error('No movies. Run: npm run seed');
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
    if (!showtimeId) throw new Error('No showtimes found.');

    // one JWT per VU — the lock endpoint is authenticated
    const tokens = [];
    const stamp = Date.now();
    for (let i = 0; i < VU_COUNT; i++) {
        const accountName = `k6_stampede_${stamp}_${i}`;
        const regRes = http.post(
            `${BASE_URL}/api/auth/register`,
            JSON.stringify({ accountName, password: 'benchmark123' }),
            { headers: { 'Content-Type': 'application/json' } }
        );
        tokens.push(regRes.status === 201 ? JSON.parse(regRes.body).token : null);
    }

    const ok = tokens.filter(Boolean).length;
    console.log(`\nSetup: ${ok}/${VU_COUNT} VUs registered, seat ${TARGET_SEAT}, showtime ${showtimeId}\n`);
    return { showtimeId, tokens, targetSeat: TARGET_SEAT };
}

export default function (data) {
    const token = data.tokens[__VU - 1];
    if (!token) { otherErrors.add(1); return; }

    const payload = JSON.stringify({
        showtimeId: data.showtimeId,
        seatNumbers: [data.targetSeat],
    });

    const t0 = Date.now();
    const res = http.post(`${BASE_URL}/api/bookings/lock-seats`, payload, {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
    });
    lockLatency.add(Date.now() - t0);

    if      (res.status === 200) { lockGranted.add(1); check(res, { 'won the seat (200)': r => r.status === 200 }); }
    else if (res.status === 409) { lockDenied.add(1);  check(res, { 'lost the seat (409)': r => r.status === 409 }); }
    else if (res.status === 410) { holdExpired.add(1); }
    else if (res.status >= 500)  { serverErrors.add(1); console.error(`5xx from VU ${__VU}: ${res.body}`); }
    else                         { otherErrors.add(1);  console.warn(`Unexpected ${res.status} from VU ${__VU}`); }
}

export function teardown(data) {
    console.log(`\nDone. Seat ${data.targetSeat}, showtime ${data.showtimeId}`);
    console.log(`Expected: 1x 200, ${VU_COUNT - 1}x 409, 0x 5xx\n`);
}
