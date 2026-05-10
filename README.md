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
cd backend
npm install
```

### 3. Start MongoDB and Redis

From the project root:

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
cd backend
npm run seed
```

Populates the database with 4 cinemas, 150 fictional movies, and ~800 showtimes.

### 5. Start the server

```bash
cd backend
node server.js
```

The API and the static frontend will be available at `http://localhost:3000`.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/movies` | Get all movies |
| GET | `/api/cinemas` | Get all cinemas |
| GET | `/api/showtimes/:movieId` | Get showtimes for a specific movie |
| GET | `/api/showtimes/:showtimeId/seats` | Real-time booked + locked seats |
| POST | `/api/bookings/lock-seats` | Place a 5-minute hold on selected seats |
| POST | `/api/bookings/confirm-payment` | Charge the held seats and issue tickets |
| POST | `/api/bookings/cancel-lock` | Release a held set of seats |
| GET | `/api/bookings/my-tickets` | List the current user's bookings |
| POST | `/api/auth/register` \| `/login` | Account auth |

## Project Structure

```
TicketIn.db-Booking-System/
├── docker-compose.yml    # MongoDB + Redis containers
├── README.md
├── backend/              # Express API + business logic
│   ├── server.js         # Express app entry point
│   ├── seed.js           # Database seeding script
│   ├── benchmark.js
│   ├── package.json
│   ├── middleware/
│   │   └── auth.js
│   ├── models/
│   │   ├── Movie.js
│   │   ├── Cinema.js
│   │   ├── Showtime.js
│   │   ├── Booking.js
│   │   └── User.js
│   └── routes/
│       ├── movie.js
│       ├── cinema.js
│       ├── showtime.js
│       ├── booking.js
│       └── auth.js
└── frontend/             # Static client (served by the backend)
    ├── index.html
    ├── styles.css
    └── app.js
```

## Stopping the Services

```bash
docker-compose down
```

Add the `-v` flag to also remove the persisted MongoDB data:

```bash
docker-compose down -v
```
