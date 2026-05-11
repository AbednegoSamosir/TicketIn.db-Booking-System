# TicketIn.db Booking System

A cinema ticket booking system built to handle high-concurrency seat reservations. When thousands of users hit "book" on the same seat during a blockbuster release, the system guarantees exactly one of them gets it. The rest get a clean rejection. No double-booking, no race conditions.

MongoDB Atlas stores the permanent data — movies, showtimes, cinemas, users, and paid bookings. Upstash Redis handles the temporary part: a distributed `SET NX` lock with a 5-minute TTL that acts as a gatekeeper before anything touches the database.

![Architecture](docs/architecture.png)

## How It Works

1. User selects a seat and hits reserve.
2. The server attempts `SET seat_lock:{showtimeId}:{seat} {userId} EX 300 NX` on Redis.
3. If the key already exists → **409 Conflict**. Someone else is already checking out.
4. If the key is set → the seat is held for 5 minutes. The user proceeds to payment.
5. On successful payment → booking is saved to MongoDB, Redis lock is released.
6. On failure/timeout → Redis lock is released, seat goes back to the pool.

Redis absorbs the concurrency. MongoDB only sees writes that have already won the lock.

## Tech Stack

| Layer | Technology | Role |
|-------|------------|------|
| Backend | Node.js, Express.js | REST API, static file serving |
| Persistent DB | MongoDB Atlas (Cloud) | Movies, showtimes, cinemas, users, bookings |
| In-Memory Lock | Upstash Redis (Cloud Serverless, TLS) | Distributed seat locking via `SET NX` |
| Real-Time | Socket.IO | Live seat status updates across clients |
| Auth | JWT + bcryptjs | Token-based authentication |
| Frontend | Vanilla JS, CSS | Single-page app served by Express |
| Container | Docker | Dockerfile + docker-compose for deployment |
| Benchmarking | k6 | Load testing concurrency under 500 VUs |

## Prerequisites

- [Node.js](https://nodejs.org/) v20 or higher
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)

## Environment Variables

Create `backend/.env` with your cloud credentials:

```env
# MongoDB Atlas
MONGO_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/ticketin_db?retryWrites=true&w=majority

# Upstash Redis (TLS)
REDIS_URL=rediss://default:<password>@<host>.upstash.io:6379

# JWT Secret
JWT_SECRET=your_secret_key_here

# Server
PORT=3000
```

> **Note:** The `.env` file is git-ignored. Never commit credentials.

## How to Run

### Option A: Docker (one command)

```bash
docker-compose up --build -d
```

This builds the Node.js backend into a container, reads `backend/.env`, and exposes port 3000. No local MongoDB or Redis containers — both databases are cloud-hosted.

Seed the database (first time only):

```bash
docker exec ticketin_backend node seed.js
```

The app is available at `http://localhost:3000`.

To stop:

```bash
docker-compose down
```

### Option B: Local Node.js

```bash
cd backend
npm install
npm run seed    # first time only
node server.js
```

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/movies` | No | List all movies |
| `GET` | `/api/cinemas` | No | List all cinemas |
| `GET` | `/api/showtimes/:movieId` | No | Showtimes for a movie |
| `GET` | `/api/showtimes/:showtimeId/seats` | No | Real-time booked + locked seats |
| `POST` | `/api/bookings/lock-seats` | Yes | Place a 5-min Redis hold on selected seats |
| `POST` | `/api/bookings/confirm-payment` | Yes | Process payment and save booking to MongoDB |
| `POST` | `/api/bookings/cancel-lock` | Yes | Release held seats |
| `GET` | `/api/bookings/my-tickets` | Yes | List current user's bookings |
| `POST` | `/api/auth/register` | No | Create account |
| `POST` | `/api/auth/login` | No | Login, returns JWT |
| `GET` | `/api/auth/profile` | Yes | Get profile |
| `PUT` | `/api/auth/profile` | Yes | Update email |
| `PUT` | `/api/auth/password` | Yes | Change password |

`/api/bookings/request-seat` and `/api/bookings/confirm` are aliases for `/lock-seats` and `/confirm-payment`.

Authenticated endpoints require `Authorization: Bearer <token>` header.

## Project Structure

```
TicketIn.db-Booking-System/
├── Dockerfile                # Node.js 20 Alpine image
├── docker-compose.yml        # Backend container (cloud DBs, no local containers)
├── README.md
├── backend/
│   ├── .env                  # Cloud credentials (git-ignored)
│   ├── server.js             # Entry point — Express, Mongoose, ioredis, Socket.IO
│   ├── seed.js               # Populates 4 cinemas, 150 movies, ~800 showtimes
│   ├── package.json
│   ├── middleware/
│   │   └── auth.js           # JWT verification middleware
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
│       ├── booking.js        # Lock, pay, cancel — all Redis-gated
│       └── auth.js
├── frontend/                 # Static SPA served by Express
│   ├── index.html
│   ├── styles.css
│   └── app.js
└── benchmarks/
    └── k6-test.js            # 500-VU stampede test
```

## Benchmarking

The `benchmarks/` folder contains a k6 load test that simulates 500 virtual users racing to book the same seat at the same time.

```bash
k6 run benchmarks/k6-test.js --out csv=benchmarks/results.csv
```

Expected outcome: exactly 1 request returns `200 OK`, the remaining 499 return `409 Conflict`, and zero return `5xx`. This proves the Redis `SET NX` lock holds under pressure.

## Team

| Name | Role |
|------|------|
| **Fahreza** | Engine & Benchmarking |
| **Bijar** | Database Architecture & Data Seeding |
| **Abed** | UI/UX & Documentation |
