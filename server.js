const express = require('express');
const mongoose = require('mongoose');
const Redis = require('ioredis');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static('public'));

// Connect to MongoDB
mongoose.connect('mongodb://127.0.0.1:27017/ticketin_db')
    .then(() => console.log('Successfully connected to MongoDB (Persistent Storage)'))
    .catch((err) => console.error('Failed to connect to MongoDB:', err));

// Connect to Redis
const redis = new Redis({
    host: 'localhost',
    port: 6379,
});
redis.on('connect', () => console.log('Successfully connected to Redis (In-Memory Lock)'));
redis.on('error', (err) => console.error('Failed to connect to Redis:', err));

// Import and Use Routes
const bookingRoutes = require('./routes/booking');
const movieRoutes = require('./routes/movie');
const showtimeRoutes = require('./routes/showtime');

app.use('/api/bookings', bookingRoutes);
app.use('/api/movies', movieRoutes);
app.use('/api/showtimes', showtimeRoutes);

// Start the Server
app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});