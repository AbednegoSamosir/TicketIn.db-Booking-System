const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    accountName: { type: String, required: true, unique: true },
    email: { type: String },
    password: { type: String, required: true }
});

module.exports = mongoose.model('User', userSchema);
