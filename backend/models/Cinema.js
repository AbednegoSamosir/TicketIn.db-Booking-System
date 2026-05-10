const mongoose = require('mongoose');

const cinemaSchema = new mongoose.Schema({
    name: { type: String, required: true },
    area: { type: String, required: true }
});

module.exports = mongoose.model('Cinema', cinemaSchema);
