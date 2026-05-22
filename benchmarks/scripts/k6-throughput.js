// Sustained load — each VU takes its own seat so there's no contention.
// Measures the raw RPS the Redis-gated pipeline can hold.

import http from 'k6/http';
import { Counter, Trend } from 'k6/metrics';

const lockSuccess = new Counter('throughput_lock_success');
const lockFail    = new Counter('throughput_lock_fail');
const lockLatency = new Trend('throughput_lock_latency_ms', true);
const cancelLatency = new Trend('throughput_cancel_latency_ms', true);

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const VU_COUNT = parseInt(__ENV.VU_COUNT || '100', 10);
const DURATION = __ENV.DURATION || '60s';

export const options = {
    scenarios: {
        sustained: {
            executor: 'constant-vus',
            vus: VU_COUNT,
            duration: DURATION,
        },
    },
    thresholds: {
        'http_req_failed':    ['rate<0.01'],   // <1% failures
        'http_req_duration':  ['p(95)<500'],   // p95 under 500ms
    },
};

// Maps (VU, iteration) -> unique seat ID so VUs never collide.
// 20 rows x 10 seats = 200 unique seats.
const ROWS = 'ABCDEFGHIJKLMNOPQRST'.split('');
function seatFor(vu, iter) {
    const idx = ((vu - 1) * 7 + iter) % (ROWS.length * 10);
    const row = ROWS[Math.floor(idx / 10)];
    const num = (idx % 10) + 1;
    return `${row}${num}`;
}

export function setup() {
    const moviesRes = http.get(`${BASE_URL}/api/movies`);
    const movies = JSON.parse(moviesRes.body);
    let showtimeId = null;
    for (const movie of movies) {
        const stRes = http.get(`${BASE_URL}/api/showtimes/${movie._id}`);
        if (stRes.status === 200) {
            const showtimes = JSON.parse(stRes.body);
            for (const st of showtimes) {
                if (st.totalSeats >= 200) { showtimeId = st._id; break; }
            }
        }
        if (showtimeId) break;
    }
    if (!showtimeId) throw new Error('No showtime with 200+ seats found.');

    const tokens = [];
    const stamp = Date.now();
    for (let i = 0; i < VU_COUNT; i++) {
        const accountName = `k6_throughput_${stamp}_${i}`;
        const regRes = http.post(
            `${BASE_URL}/api/auth/register`,
            JSON.stringify({ accountName, password: 'benchmark123' }),
            { headers: { 'Content-Type': 'application/json' } }
        );
        tokens.push(regRes.status === 201 ? JSON.parse(regRes.body).token : null);
    }
    console.log(`\nSetup: ${tokens.filter(Boolean).length}/${VU_COUNT} VUs, showtime ${showtimeId}\n`);
    return { showtimeId, tokens };
}

export default function (data) {
    const token = data.tokens[__VU - 1];
    if (!token) return;
    const seat = seatFor(__VU, __ITER);

    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
    };

    const t0 = Date.now();
    const lockRes = http.post(
        `${BASE_URL}/api/bookings/lock-seats`,
        JSON.stringify({ showtimeId: data.showtimeId, seatNumbers: [seat] }),
        { headers }
    );
    lockLatency.add(Date.now() - t0);

    if (lockRes.status === 200) {
        lockSuccess.add(1);

        // release the lock right away so seats recycle through the test
        const t1 = Date.now();
        http.post(
            `${BASE_URL}/api/bookings/cancel-lock`,
            JSON.stringify({ showtimeId: data.showtimeId, seatNumbers: [seat] }),
            { headers }
        );
        cancelLatency.add(Date.now() - t1);
    } else {
        lockFail.add(1);
    }
}
