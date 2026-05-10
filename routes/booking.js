const express = require('express');
const router = express.Router();
const Redis = require('ioredis');
const Booking = require('../models/Booking');
const Showtime = require('../models/Showtime');
const rateLimit = require('express-rate-limit');

const redis = new Redis({ host: 'localhost', port: 6379 });

const bookingLimiter = rateLimit({
    windowMs: 60 * 1000, 
    max: 5,
    message: { error: "Too many booking requests from this IP, please try again after a minute." }
});

const simulatePayment = () => new Promise((resolve, reject) => {
    setTimeout(() => {
        Math.random() > 0.1 ? resolve() : reject(new Error("Payment Gateway Declined"));
    }, 2000); 
});

router.post('/request-seat', bookingLimiter, async (req, res) => {
    const { userId, showtimeId, seatNumber, socketId } = req.body;
    const lockKey = `seat_lock:${showtimeId}:${seatNumber}`;
    const io = req.app.get('io');
    const room = `showtime_${showtimeId}`;

    const emitEvent = (event, payload) => {
        if (!io) return;
        if (socketId) io.to(room).except(socketId).emit(event, payload);
        else io.to(room).emit(event, payload);
    };

    try {
        const lockAcquired = await redis.set(lockKey, userId, "EX", 300, "NX");

        if (!lockAcquired) {
            return res.status(409).json({
                error: "Seat is currently locked by another user completing checkout."
            });
        }

        emitEvent('seat_locked', { showtimeId, seatNumber });

        const existingBooking = await Booking.findOne({ 
            showtimeId, 
            seatNumber, 
            status: 'PAID' 
        });

        if (existingBooking) {
            await redis.del(lockKey); 
            emitEvent('seat_booked', { showtimeId, seatNumber });
            return res.status(409).json({ error: "Seat has already been permanently booked." });
        }

        try {
            await simulatePayment();
        } catch (paymentError) {
            await redis.del(lockKey);
            emitEvent('seat_freed', { showtimeId, seatNumber });
            return res.status(402).json({ error: "Payment failed. Seat lock released." });
        }

        const newBooking = new Booking({
            userId,
            showtimeId,
            seatNumber,
            status: 'PAID'
        });
        
        await newBooking.save();

        await Showtime.updateOne(
            { _id: showtimeId, availableSeats: { $gt: 0 } },
            { $inc: { availableSeats: -1 } }
        );

        await redis.del(lockKey);
        emitEvent('seat_booked', { showtimeId, seatNumber });

        return res.status(200).json({
            message: "Payment successful and ticket issued.",
            bookingDetails: newBooking
        });

    } catch (error) {
        console.error("Booking error:", error);
        redis.del(lockKey).catch(console.error);
        emitEvent('seat_freed', { showtimeId, seatNumber });
        return res.status(500).json({ error: "Internal server error." });
    }
});

router.get('/user/:userId', async (req, res) => {
    try {
        const bookings = await Booking.find({ userId: req.params.userId })
            .sort({ bookingTime: -1 });
        
        const detailedBookings = [];
        for (const b of bookings) {
            const st = await Showtime.findById(b.showtimeId).populate('movieId', 'title duration');
            if (st) {
                detailedBookings.push({
                    booking: b,
                    showtime: st,
                    movie: st.movieId
                });
            }
        }
        res.status(200).json(detailedBookings);
    } catch (error) {
        console.error("Error fetching user bookings:", error);
        res.status(500).json({ error: "Internal server error." });
    }
});

module.exports = router;