const express = require('express');
const router = express.Router();
const Redis = require('ioredis');
const Booking = require('../models/Booking');

const redis = new Redis({ host: 'localhost', port: 6379 });

router.post('/request-seat', async (req, res) => {
    const { userId, showtimeId, seatNumber } = req.body;
    const lockKey = `seat_lock:${showtimeId}:${seatNumber}`;

    try {
        // Attempt to acquire the lock in Redis (5-minute TTL)
        const lockAcquired = await redis.set(lockKey, userId, "EX", 300, "NX");

        if (!lockAcquired) {
            return res.status(409).json({
                error: "Seat is currently locked or already booked by another user."
            });
        }

        // Lock acquired successfully. Simulate payment processing time
        console.log(`[LOCK] Seat ${seatNumber} locked for ${userId}. Processing payment...`);

        // Save the permanent booking invoice to MongoDB
        const newBooking = new Booking({
            userId,
            showtimeId,
            seatNumber,
            status: 'PAID'
        });
        await newBooking.save();


        return res.status(200).json({
            message: "Payment successful and ticket issued.",
            bookingDetails: newBooking
        });

    } catch (error) {
        console.error("Booking error:", error);
        return res.status(500).json({ error: "Internal server error." });
    }
});

module.exports = router;