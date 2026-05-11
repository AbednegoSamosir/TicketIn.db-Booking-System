require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const Redis = require('ioredis');
const path = require('path');

const http = require('http');
const { Server } = require('socket.io');

const app = express();
const PORT = process.env.PORT || 3000;

const httpServer = http.createServer(app);
const io = new Server(httpServer);

app.set('io', io); // socket.io instance shared with routes for real-time seat updates

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// mongo — persistent store (movies, showtimes, bookings, users)
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('Connected to MongoDB Atlas'))
    .catch((err) => console.error('MongoDB connection failed:', err));

// redis — seat lock store (SET NX with TTL, TLS required for Upstash)
const redis = new Redis(process.env.REDIS_URL, {
    tls: { rejectUnauthorized: false },
});
app.set('redis', redis);

redis.on('connect', () => console.log('Connected to Upstash Redis'));
redis.on('error', (err) => console.error('Redis connection failed:', err));

const bookingRoutes = require('./routes/booking');
const movieRoutes = require('./routes/movie');
const showtimeRoutes = require('./routes/showtime');
const authRoutes = require('./routes/auth');
const cinemaRoutes = require('./routes/cinema');

app.use('/api/bookings', bookingRoutes);
app.use('/api/movies', movieRoutes);
app.use('/api/showtimes', showtimeRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/cinemas', cinemaRoutes);

io.on('connection', (socket) => {
    socket.on('join_showtime', (showtimeId) => {
        socket.join(`showtime_${showtimeId}`);
    });
    socket.on('leave_showtime', (showtimeId) => {
        socket.leave(`showtime_${showtimeId}`);
    });
});

httpServer.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});