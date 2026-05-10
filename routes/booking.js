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

router.post('/request-seat', authMiddleware, bookingLimiter, async (req, res) => {
    const { showtimeId, seatNumbers, socketId } = req.body;
    const userId = req.user.accountName;
    const io = req.app.get('io');
    const room = `showtime_${showtimeId}`;

    if (!Array.isArray(seatNumbers) || seatNumbers.length === 0 || seatNumbers.length > 5) {
        return res.status(400).json({ error: "Invalid seat selection. You must pick 1 to 5 seats." });
    }

    const emitEvent = (event, payload) => {
        if (!io) return;
        if (socketId) io.to(room).except(socketId).emit(event, payload);
        else io.to(room).emit(event, payload);
    };

    let acquiredLocks = [];

    try {
        // Secure each seat in Redis to prevent double booking.
        // We do this one by one. If any seat is taken, we stop and undo the ones we successfully locked.
        for (const seatNumber of seatNumbers) {
            const lockKey = `seat_lock:${showtimeId}:${seatNumber}`;
            const lockAcquired = await redis.set(lockKey, userId, "EX", 300, "NX");
            if (!lockAcquired) {
                // Undo locks for the seats we managed to grab so far
                for (const acquired of acquiredLocks) {
                    await redis.del(`seat_lock:${showtimeId}:${acquired}`);
                    emitEvent('seat_freed', { showtimeId, seatNumber: acquired });
                }
                return res.status(409).json({ error: `Seat ${seatNumber} is locked by someone else.` });
            }
            acquiredLocks.push(seatNumber);
            emitEvent('seat_locked', { showtimeId, seatNumber });
        }

        // Double check the database just in case these seats were already bought and paid for
        const existingBookings = await Booking.find({ 
            showtimeId, 
            seatNumber: { $in: seatNumbers }, 
            status: 'PAID' 
        });

        if (existingBookings.length > 0) {
            for (const acquired of acquiredLocks) {
                await redis.del(`seat_lock:${showtimeId}:${acquired}`);
                emitEvent('seat_booked', { showtimeId, seatNumber: acquired });
            }
            return res.status(409).json({ error: "One or more seats have already been booked." });
        }

        // Send the transaction to the payment gateway
        try {
            await simulatePayment();
        } catch (paymentError) {
            for (const acquired of acquiredLocks) {
                await redis.del(`seat_lock:${showtimeId}:${acquired}`);
                emitEvent('seat_freed', { showtimeId, seatNumber: acquired });
            }
            return res.status(402).json({ error: "Payment failed. Seat locks released." });
        }

        // Payment went through, so we officially record the bookings and reduce the available seat count
        const bookingsToSave = seatNumbers.map(s => ({
            userId,
            showtimeId,
            seatNumber: s,
            status: 'PAID'
        }));
        
        console.log("SEAT NUMBERS RECEIVED:", seatNumbers);
        console.log("BOOKINGS TO SAVE:", bookingsToSave);

        const newBookings = await Booking.insertMany(bookingsToSave);

        await Showtime.updateOne(
            { _id: showtimeId },
            { $inc: { availableSeats: -seatNumbers.length } }
        );

        // Remove the temporary Redis locks since the seats are now permanently saved in the database
        for (const acquired of acquiredLocks) {
            await redis.del(`seat_lock:${showtimeId}:${acquired}`);
            emitEvent('seat_booked', { showtimeId, seatNumber: acquired });
        }

        return res.status(200).json({
            message: "Payment successful and tickets issued.",
            bookingDetails: newBookings
        });

    } catch (error) {
        console.error("Booking error:", error);
        for (const acquired of acquiredLocks) {
            await redis.del(`seat_lock:${showtimeId}:${acquired}`);
            emitEvent('seat_freed', { showtimeId, seatNumber: acquired });
        }
        return res.status(500).json({ error: "Internal server error." });
    }
});

router.get('/my-tickets', authMiddleware, async (req, res) => {
    try {
        const bookings = await Booking.find({ userId: req.user.accountName })
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