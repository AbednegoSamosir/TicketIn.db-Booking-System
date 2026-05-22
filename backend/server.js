require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const Redis = require('ioredis');
const cors = require('cors');
const path = require('path');

const http = require('http');
const { Server } = require('socket.io');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS — comma-separated list of allowed origins, or "*" for any.
// Set CORS_ORIGIN on the backend host to your Vercel URL once it's deployed.
const corsOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map(s => s.trim())
    : '*';

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
    cors: { origin: corsOrigins, credentials: true }
});

app.set('io', io); // socket.io instance shared with routes for real-time seat updates

// Railway/Render/Fly all sit behind a proxy — trust it so rate-limit sees real IPs.
app.set('trust proxy', 1);

app.use(cors({ origin: corsOrigins, credentials: true }));
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