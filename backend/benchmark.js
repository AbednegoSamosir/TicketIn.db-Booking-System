async function runBenchmark() {
    console.log("Starting Concurrent Booking Benchmark...");

    // Generate a valid ObjectId 24-character hex string so Mongoose doesn't throw CastError
    const showtimeId = "60d5ec9af682fbd39a1b865b";
    const seatNumber = "A1";

    console.log(`Firing 50 concurrent requests for Seat ${seatNumber}...`);

    const requests = [];
    for (let i = 1; i <= 50; i++) {
        requests.push(
            fetch('http://localhost:3000/api/bookings/request-seat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: `user_${i}`,
                    showtimeId,
                    seatNumber
                })
            }).then(async res => ({
                user: `user_${i}`,
                status: res.status,
                data: await res.json().catch(() => ({}))
            })).catch(err => ({
                user: `user_${i}`,
                status: 500,
                data: { error: err.message }
            }))
        );
    }

    const results = await Promise.all(requests);

    const successful = results.filter(r => r.status === 200);
    const locked = results.filter(r => r.status === 409);
    const failedPayment = results.filter(r => r.status === 402);

    console.log(`\n--- BENCHMARK RESULTS ---`);
    console.log(`Total Requests Sent : 50`);
    console.log(`Successful Bookings : ${successful.length}`);
    console.log(`Lock Denials (409)  : ${locked.length}`);
    console.log(`Payment Fails (402) : ${failedPayment.length}`);

    if (successful.length > 1) {
        console.error("\n CRITICAL FAILURE: Double booking occurred!");
    } else if (successful.length === 1) {
        console.log("\n SUCCESS: Only exactly ONE user successfully booked the seat.");
        console.log(`Winner: ${successful[0].user}`);
    } else if (failedPayment.length === 1) {
        console.log("\nSUCCESS: Concurrency handled, but the winner's payment failed. Lock was released safely.");
    } else {
        console.log("\n ERROR: Unexpected result distribution. Is the server running?");
    }
}

runBenchmark();
