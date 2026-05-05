# TicketIn.db Booking System

A movie ticket booking API built with Express.js, MongoDB, and Redis. MongoDB handles persistent storage for movies, showtimes, and bookings, while Redis provides in-memory seat locking to prevent double-booking during concurrent requests.

## Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)

## Setup

### 1. Clone the repository

```bash
git clone https://github.com/fahrezaarsyam/TicketIn.db-Booking-System.git
cd TicketIn.db-Booking-System
```

### 2. Install dependencies

```bash
npm install
```

### 3. Start MongoDB and Redis

```bash
docker-compose up -d
```

This spins up two containers:

| Service | Container Name | Port |
|---------|---------------|------|
| MongoDB | ticketin_mongodb | 27017 |
| Redis | ticketin_redis | 6379 |

### 4. Seed the database

```bash
npm run seed
```

Populates the database with 150 fictional movies and ~800 showtimes for testing.

### 5. Start the server

```bash
node server.js
```

The API will be available at `http://localhost:3000`.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Health check |
| GET | `/api/movies` | Get all movies |
| GET | `/api/showtimes/:movieId` | Get showtimes for a specific movie |
| POST | `/api/bookings/request-seat` | Book a seat |

### Booking Request Body

```json
{
  "userId": "user_001",
  "showtimeId": "664abc123def456ghi789",
  "seatNumber": "A1"
}
```

## Project Structure

```
TicketIn.db-Booking-System/
├── models/
│   ├── Movie.js          # Movie schema (title, duration, genres, cast)
│   ├── Showtime.js       # Showtime schema (movieId, startTime, theaterRoom, seats)
│   └── Booking.js        # Booking schema (userId, showtimeId, seatNumber, status)
├── routes/
│   ├── movie.js          # GET /api/movies
│   ├── showtime.js       # GET /api/showtimes/:movieId
│   └── booking.js        # POST /api/bookings/request-seat
├── server.js             # Express app entry point
├── seed.js               # Database seeding script
├── docker-compose.yml    # MongoDB + Redis containers
└── package.json
```

## Stopping the Services

```bash
docker-compose down
```

Add the `-v` flag to also remove the persisted MongoDB data:

```bash
docker-compose down -v
```
