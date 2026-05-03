const mongoose = require('mongoose');

const movieSchema = new mongoose.Schema({
    title: { type: String, required: true },
    duration: { type: Number, required: true },
    genres: [{ type: String }],
    cast: [{ type: String }]
});

module.exports = mongoose.model('Movie', movieSchema);