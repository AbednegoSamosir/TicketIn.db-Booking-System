const express = require('express');
const router = express.Router();
const Showtime = require('../models/Showtime');
const Booking = require('../models/Booking');

router.get('/:movieId', async (req, res) => {
    try {
        const showtimes = await Showtime.find({ movieId: req.params.movieId })
            .populate('movieId', 'title duration')
            .populate('cinemaId', 'name area');

        if (showtimes.length === 0) {
            return res.status(404).json({ message: "No showtimes found for this movie." });
        }
        res.status(200).json(showtimes);
    } catch (error) {
        console.error("Error fetching showtimes:", error);
        res.status(500).json({ error: "Internal server error." });
    }
});

router.get('/:showtimeId/seats', async (req, res) => {
    const { showtimeId } = req.params;
    const redis = req.app.get('redis');
    
    try {
        const bookings = await Booking.find({ showtimeId, status: 'PAID' });
        const bookedSeats = bookings.map(b => b.seatNumber);
        
        let lockedSeats = [];
        if (redis) {
            const keys = await redis.keys(`seat_lock:${showtimeId}:*`);
            lockedSeats = keys.map(k => k.split(':').pop());
        }
        
        res.status(200).json({ booked: bookedSeats, locked: lockedSeats });
    } catch (error) {
        console.error("Error fetching seats state:", error);
        res.status(500).json({ error: "Internal server error." });
    }
});

module.exports = router;