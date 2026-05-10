const express = require('express');
const mongoose = require('mongoose');
const Redis = require('ioredis');
const path = require('path');

const http = require('http');
const { Server } = require('socket.io');

const app = express();
const PORT = 3000;

const httpServer = http.createServer(app);
const io = new Server(httpServer);

app.set('io', io);

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// Connect to MongoDB for our main data storage
mongoose.connect('mongodb://127.0.0.1:27017/ticketin_db')
    .then(() => console.log('Successfully connected to MongoDB (Persistent Storage)'))
    .catch((err) => console.error('Failed to connect to MongoDB:', err));

// Set up Redis client for temporary seat locking
const redis = new Redis({
    host: 'localhost',
    port: 6379,
});
app.set('redis', redis); // pass the redis instance to app so our routes can access it

redis.on('connect', () => console.log('Successfully connected to Redis (In-Memory Lock)'));
redis.on('error', (err) => console.error('Failed to connect to Redis:', err));

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