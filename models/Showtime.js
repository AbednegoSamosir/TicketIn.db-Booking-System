const mongoose = require('mongoose');

const showtimeSchema = new mongoose.Schema({
    movieId: { type: mongoose.Schema.Types.ObjectId, ref: 'Movie', required: true },
    startTime: { type: Date, required: true },
    theaterRoom: { type: String, required: true },
    totalSeats: { type: Number, default: 50 },
    availableSeats: { type: Number, default: 50 }
});

module.exports = mongoose.model('Showtime', showtimeSchema);