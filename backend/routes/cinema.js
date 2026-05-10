const express = require('express');
const router = express.Router();
const Cinema = require('../models/Cinema');

router.get('/', async (req, res) => {
    try {
        const cinemas = await Cinema.find().sort({ area: 1, name: 1 });
        res.status(200).json(cinemas);
    } catch (error) {
        console.error("Error fetching cinemas:", error);
        res.status(500).json({ error: "Internal server error." });
    }
});

module.exports = router;
