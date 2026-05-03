const express = require('express');
const router = express.Router();
const Showtime = require('../models/Showtime');

// GET showtimes for a specific movie
router.get('/:movieId', async (req, res) => {
    try {
        const showtimes = await Showtime.find({ movieId: req.params.movieId })
            .populate('movieId', 'title duration');

        if (showtimes.length === 0) {
            return res.status(404).json({ message: "No showtimes found for this movie." });
        }
        res.status(200).json(showtimes);
    } catch (error) {
        console.error("Error fetching showtimes:", error);
        res.status(500).json({ error: "Internal server error." });
    }
});

module.exports = router;