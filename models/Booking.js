const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    showtimeId: { type: String, required: true },
    seatNumber: { type: String, required: true },
    status: { type: String, enum: ['PENDING', 'PAID', 'FAILED'], default: 'PAID' },
    bookingTime: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Booking', bookingSchema);