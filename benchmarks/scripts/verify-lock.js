// Node-only correctness check. Fires 50 concurrent locks at one seat
// and expects exactly one winner. Useful when k6 isn't installed.

const BASE_URL    = process.env.BASE_URL    || 'http://localhost:3000';
const TARGET_SEAT = process.env.TARGET_SEAT || 'V10';
const CONCURRENCY = parseInt(process.env.CONCURRENCY || '50', 10);

async function postJson(url, body, token) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
}

async function getJson(url) {
    const res = await fetch(url);
    return res.json();
}

(async function main() {
    console.log(`Verifying lock atomicity at ${BASE_URL}`);
    console.log(`Target seat: ${TARGET_SEAT}, concurrency: ${CONCURRENCY}\n`);

    const movies = await getJson(`${BASE_URL}/api/movies`);
    if (!movies.length) throw new Error('No movies. Run npm run seed.');

    let showtimeId = null;
    for (const m of movies) {
        const sts = await getJson(`${BASE_URL}/api/showtimes/${m._id}`);
        if (Array.isArray(sts) && sts.length > 0) { showtimeId = sts[0]._id; break; }
    }
    if (!showtimeId) throw new Error('No showtimes.');
    console.log(`Showtime: ${showtimeId}`);

    console.log(`Registering ${CONCURRENCY} test accounts...`);
    const stamp = Date.now();
    const tokens = await Promise.all(
        Array.from({ length: CONCURRENCY }, async (_, i) => {
            const r = await postJson(`${BASE_URL}/api/auth/register`, {
                accountName: `verify_${stamp}_${i}`,
                password: 'verify123',
            });
            return r.status === 201 ? r.data.token : null;
        })
    );
    const ok = tokens.filter(Boolean).length;
    console.log(`Registered ${ok}/${CONCURRENCY}`);

    console.log(`\nFiring ${CONCURRENCY} simultaneous lock requests for seat ${TARGET_SEAT}...`);
    const t0 = Date.now();
    const results = await Promise.all(
        tokens.map(async (token, i) => {
            if (!token) return { status: 0, user: i };
            const r = await postJson(
                `${BASE_URL}/api/bookings/lock-seats`,
                { showtimeId, seatNumbers: [TARGET_SEAT] },
                token
            );
            return { status: r.status, user: i };
        })
    );
    const elapsed = Date.now() - t0;

    const tally = {};
    for (const r of results) tally[r.status] = (tally[r.status] || 0) + 1;

    console.log(`\nElapsed: ${elapsed}ms\n`);
    console.log('Status distribution:');
    for (const [code, count] of Object.entries(tally).sort()) {
        const label = code === '200' ? 'WON THE SEAT'
                    : code === '409' ? 'LOST (lock denied)'
                    : code === '410' ? 'HOLD EXPIRED'
                    : code === '429' ? 'RATE LIMITED'
                    : code === '500' ? 'SERVER ERROR'
                    : 'OTHER';
        console.log(`  ${code}  ${String(count).padStart(4)}  ${label}`);
    }

    const winners = tally['200'] || 0;
    const denied  = tally['409'] || 0;
    const errors  = tally['500'] || 0;

    console.log('\nResult:');
    if (winners === 1 && errors === 0) {
        console.log(`  PASS — exactly 1 winner, ${denied} clean denials, 0 server errors.`);
        console.log('         The Redis SET NX lock held under contention.');
    } else if (winners > 1) {
        console.log(`  FAIL — ${winners} double-bookings detected. The lock did not hold.`);
        process.exit(1);
    } else if (errors > 0) {
        console.log(`  FAIL — ${errors} server errors. Investigate logs.`);
        process.exit(1);
    } else {
        console.log(`  INCONCLUSIVE — 0 winners. Was the seat already booked? Try a different TARGET_SEAT.`);
    }

    // release the winner's lock so the next run starts fresh
    const winner = results.find(r => r.status === 200);
    if (winner) {
        const winnerToken = tokens[winner.user];
        await postJson(
            `${BASE_URL}/api/bookings/cancel-lock`,
            { showtimeId, seatNumbers: [TARGET_SEAT] },
            winnerToken
        );
    }
})().catch(err => {
    console.error('Verifier failed:', err.message);
    process.exit(1);
});
