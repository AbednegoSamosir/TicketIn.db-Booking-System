// Ramps 10 -> 200 VUs in 30-second stages to chart how latency degrades
// as concurrency rises. Looking for the knee where Redis pipelining saturates.

import http from 'k6/http';
import { Trend, Counter } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

const seatLatency = new Trend('seat_endpoint_latency_ms', true);
const lockLatency = new Trend('lock_endpoint_latency_ms', true);
const errors      = new Counter('errors');

export const options = {
    scenarios: {
        ramp: {
            executor: 'ramping-vus',
            startVUs: 0,
            stages: [
                { duration: '30s', target: 10  },
                { duration: '30s', target: 50  },
                { duration: '30s', target: 100 },
                { duration: '30s', target: 150 },
                { duration: '30s', target: 200 },
                { duration: '15s', target: 0   },
            ],
            gracefulRampDown: '5s',
        },
    },
    thresholds: {
        'lock_endpoint_latency_ms': ['p(95)<1000'],
        'http_req_failed':          ['rate<0.05'],
    },
};

const ROWS = 'ABCDEFGHIJKLMNOPQRST'.split('');
function seatFor(vu, iter) {
    const idx = ((vu - 1) * 13 + iter) % 200;
    return `${ROWS[Math.floor(idx / 10)]}${(idx % 10) + 1}`;
}

export function setup() {
    const moviesRes = http.get(`${BASE_URL}/api/movies`);
    const movies = JSON.parse(moviesRes.body);
    let showtimeId = null;
    for (const movie of movies) {
        const stRes = http.get(`${BASE_URL}/api/showtimes/${movie._id}`);
        if (stRes.status === 200) {
            const sts = JSON.parse(stRes.body);
            for (const st of sts) if (st.totalSeats >= 200) { showtimeId = st._id; break; }
        }
        if (showtimeId) break;
    }
    if (!showtimeId) throw new Error('No 200-seat showtime');

    const tokens = [];
    const stamp = Date.now();
    for (let i = 0; i < 200; i++) {
        const regRes = http.post(
            `${BASE_URL}/api/auth/register`,
            JSON.stringify({ accountName: `k6_ramp_${stamp}_${i}`, password: 'benchmark123' }),
            { headers: { 'Content-Type': 'application/json' } }
        );
        tokens.push(regRes.status === 201 ? JSON.parse(regRes.body).token : null);
    }
    console.log(`\nSetup done. Showtime ${showtimeId}, ${tokens.filter(Boolean).length} tokens.\n`);
    return { showtimeId, tokens };
}

export default function (data) {
    const token = data.tokens[(__VU - 1) % data.tokens.length];
    if (!token) { errors.add(1); return; }
    const seat = seatFor(__VU, __ITER);
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
    };

    // read path: Mongo bookings + Redis KEYS scan
    const t0 = Date.now();
    const seatRes = http.get(`${BASE_URL}/api/showtimes/${data.showtimeId}/seats`);
    seatLatency.add(Date.now() - t0);
    if (seatRes.status !== 200) errors.add(1);

    // write path: Redis SET NX + DEL
    const t1 = Date.now();
    const lockRes = http.post(
        `${BASE_URL}/api/bookings/lock-seats`,
        JSON.stringify({ showtimeId: data.showtimeId, seatNumbers: [seat] }),
        { headers }
    );
    lockLatency.add(Date.now() - t1);

    if (lockRes.status === 200) {
        http.post(
            `${BASE_URL}/api/bookings/cancel-lock`,
            JSON.stringify({ showtimeId: data.showtimeId, seatNumbers: [seat] }),
            { headers }
        );
    }
}
