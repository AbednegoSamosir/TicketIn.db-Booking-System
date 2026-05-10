const express = require('express');
const router = express.Router();
const Movie = require('../models/Movie');

// Fetch the complete list of available movies from the database
router.get('/', async (req, res) => {
    try {
        const movies = await Movie.find();
        res.status(200).json(movies);
    } catch (error) {
        console.error("Error fetching movies:", error);
        res.status(500).json({ error: "Internal server error." });
    }
});

module.exports = router;