const express = require('express');
const router = express.Router();
const Redis = require('ioredis');
const Booking = require('../models/Booking');
const Showtime = require('../models/Showtime');
const rateLimit = require('express-rate-limit');

const redis = new Redis({ host: 'localhost', port: 6379 });
const authMiddleware = require('../middleware/auth');

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

const HOLD_SECONDS = 300;

const buildEmitter = (req, showtimeId, socketId) => {
    const io = req.app.get('io');
    const room = `showtime_${showtimeId}`;
    return (event, payload) => {
        if (!io) return;
        if (socketId) io.to(room).except(socketId).emit(event, payload);
        else io.to(room).emit(event, payload);
    };
};

// Acquire a 5-minute Redis hold on the requested seats so other users
// see them as locked while this user completes payment.
router.post('/lock-seats', authMiddleware, bookingLimiter, async (req, res) => {
    const { showtimeId, seatNumbers, socketId } = req.body;
    const userId = req.user.accountName;

    if (!Array.isArray(seatNumbers) || seatNumbers.length === 0 || seatNumbers.length > 5) {
        return res.status(400).json({ error: "Invalid seat selection. You must pick 1 to 5 seats." });
    }

    const emit = buildEmitter(req, showtimeId, socketId);
    const acquiredLocks = [];

    try {
        for (const seatNumber of seatNumbers) {
            const lockKey = `seat_lock:${showtimeId}:${seatNumber}`;
            const lockAcquired = await redis.set(lockKey, userId, "EX", HOLD_SECONDS, "NX");
            if (!lockAcquired) {
                for (const acquired of acquiredLocks) {
                    await redis.del(`seat_lock:${showtimeId}:${acquired}`);
                    emit('seat_freed', { showtimeId, seatNumber: acquired });
                }
                return res.status(409).json({ error: `Seat ${seatNumber} is locked by someone else.` });
            }
            acquiredLocks.push(seatNumber);
            emit('seat_locked', { showtimeId, seatNumber });
        }

        const existingBookings = await Booking.find({
            showtimeId,
            seatNumber: { $in: seatNumbers },
            status: 'PAID'
        });

        if (existingBookings.length > 0) {
            for (const acquired of acquiredLocks) {
                await redis.del(`seat_lock:${showtimeId}:${acquired}`);
                emit('seat_booked', { showtimeId, seatNumber: acquired });
            }
            return res.status(409).json({ error: "One or more seats have already been booked." });
        }

        return res.status(200).json({
            message: "Seats held — complete payment within 5 minutes.",
            seatNumbers: acquiredLocks,
            holdSeconds: HOLD_SECONDS,
            expiresAt: Date.now() + HOLD_SECONDS * 1000
        });
    } catch (error) {
        console.error("Lock error:", error);
        for (const acquired of acquiredLocks) {
            await redis.del(`seat_lock:${showtimeId}:${acquired}`);
            emit('seat_freed', { showtimeId, seatNumber: acquired });
        }
        return res.status(500).json({ error: "Internal server error." });
    }
});

// Verify the user still owns the holds, simulate the payment gateway,
// then either persist the bookings or release the holds back to the pool.
router.post('/confirm-payment', authMiddleware, async (req, res) => {
    const { showtimeId, seatNumbers, socketId } = req.body;
    const userId = req.user.accountName;

    if (!Array.isArray(seatNumbers) || seatNumbers.length === 0) {
        return res.status(400).json({ error: "Invalid seat selection." });
    }

    const emit = buildEmitter(req, showtimeId, socketId);

    try {
        for (const seatNumber of seatNumbers) {
            const owner = await redis.get(`seat_lock:${showtimeId}:${seatNumber}`);
            if (owner !== userId) {
                return res.status(410).json({ error: "Your hold has expired. Please pick your seats again." });
            }
        }

        try {
            await simulatePayment();
        } catch (paymentError) {
            for (const seatNumber of seatNumbers) {
                await redis.del(`seat_lock:${showtimeId}:${seatNumber}`);
                emit('seat_freed', { showtimeId, seatNumber });
            }
            return res.status(402).json({ error: "Payment declined. Seats released." });
        }

        const bookingsToSave = seatNumbers.map(s => ({
            userId, showtimeId, seatNumber: s, status: 'PAID'
        }));
        const newBookings = await Booking.insertMany(bookingsToSave);

        await Showtime.updateOne(
            { _id: showtimeId },
            { $inc: { availableSeats: -seatNumbers.length } }
        );

        for (const seatNumber of seatNumbers) {
            await redis.del(`seat_lock:${showtimeId}:${seatNumber}`);
            emit('seat_booked', { showtimeId, seatNumber });
        }

        return res.status(200).json({
            message: "Payment successful and tickets issued.",
            bookingDetails: newBookings
        });
    } catch (error) {
        console.error("Payment error:", error);
        return res.status(500).json({ error: "Internal server error." });
    }
});

// Voluntarily release any holds owned by this user (cancel / timeout / navigate away).
router.post('/cancel-lock', authMiddleware, async (req, res) => {
    const { showtimeId, seatNumbers, socketId } = req.body;
    const userId = req.user.accountName;

    if (!Array.isArray(seatNumbers) || seatNumbers.length === 0) {
        return res.status(400).json({ error: "Invalid seat selection." });
    }

    const emit = buildEmitter(req, showtimeId, socketId);

    try {
        for (const seatNumber of seatNumbers) {
            const lockKey = `seat_lock:${showtimeId}:${seatNumber}`;
            const owner = await redis.get(lockKey);
            if (owner === userId) {
                await redis.del(lockKey);
                emit('seat_freed', { showtimeId, seatNumber });
            }
        }
        return res.status(200).json({ message: "Hold released." });
    } catch (error) {
        console.error("Cancel error:", error);
        return res.status(500).json({ error: "Internal server error." });
    }
});

router.get('/my-tickets', authMiddleware, async (req, res) => {
    try {
        const bookings = await Booking.find({ userId: req.user.accountName })
            .sort({ bookingTime: -1 });
        
        const detailedBookings = [];
        for (const b of bookings) {
            const st = await Showtime.findById(b.showtimeId)
                .populate('movieId', 'title duration')
                .populate('cinemaId', 'name area');
            if (st) {
                detailedBookings.push({
                    booking: b,
                    showtime: st,
                    movie: st.movieId,
                    cinema: st.cinemaId
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