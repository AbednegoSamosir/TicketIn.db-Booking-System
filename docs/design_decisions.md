# Architectural Design Decisions

This document explains our problem statement, why we chose these specific NoSQL databases, how they work together, and the trade-offs we considered for our system.

---

## 1. Problem and Motivation

In a standard cinema ticket booking system, the biggest challenge is handling what happens when a popular movie is released and thousands of users try to book the exact same seat at the exact same moment (the ticket stampede problem). 

If we use a standard database write without proper protection, we run into serious issues:
1.  **Race Conditions**: Two or more users can successfully check out and pay for the same seat, which results in double booking.
2.  **Database Bottlenecks**: Relational databases try to solve this by locking rows or tables. This slows down all requests, crashes the connection pool, and makes the system freeze when write traffic spikes.
3.  **Bad User Experience**: Users might wait a long time only to get a timeout error, or worse, their payment goes through but they do not get the seat because someone else got it first.

Our system solves this by making sure only one user can hold a seat at a time. All other users who try to click reserve on that same seat get an instant rejection message within milliseconds, which keeps the system fast and responsive.

---

## 2. Databases and Their Roles

Instead of making Redis a copy of MongoDB, we gave both databases completely different jobs.

### 2.1 MongoDB (Permanent Data Store)
*   **Role**: Stores persistent data including movies, showtimes, cinemas, users, and paid bookings.
*   **Collections**: `users`, `movies`, `cinemas`, `showtimes`, `bookings`.
*   **Why we chose it**:
    *   **Document Structure**: Cinema structures are easy to model as documents. A showtime document can easily link to movies and cinemas, making lookups fast without writing complex SQL joins.
    *   **Read Performance**: MongoDB Atlas handles heavy read traffic well, which is perfect when users are just searching for movies and browsing showtimes.
    *   **Data Integrity**: We need successful tickets (`bookings` collection with a status of `PAID`) to be stored permanently on disk, which MongoDB does reliably.

### 2.2 Redis (Temporary Lock Store)
*   **Role**: Handles fast, temporary seat locks during checkout.
*   **Structure**: Simple key-value pairs with an expiration time.
*   **Why we chose it**:
    *   **Atomic Operations**: Redis is single threaded and has an atomic `SET NX` command. This ensures that only one request can create the lock key at a time, completely eliminating race conditions.
    *   **Speed**: Since Redis runs in memory, it can handle thousands of requests per second with sub-millisecond speeds. This acts as a shield for our main MongoDB database.
    *   **Automatic Cleanup**: We set a 300 second (5 minute) TTL on our lock keys. If a user locks a seat but closes their browser without paying, the lock naturally disappears after 5 minutes and the seat goes back to the pool automatically.

---

## 3. Database Choices and Trade-Offs

We compared these databases to traditional SQL options to justify our choices:

| Metric | MongoDB (Document) | Redis (Key-Value) | Relational Databases (SQL) |
| :--- | :--- | :--- | :--- |
| **Primary Job** | Long-term catalog and booking records. | High-speed temporary seat locks. | Normalization and transactional tables. |
| **Write Speed** | Medium (limited by disk writes). | Extremely fast (runs in memory). | Slow under high concurrent seat locking. |
| **Flexibility** | High (flexible JSON schemas). | None (simple keys and values). | Low (strict table columns). |
| **Concurrency Shield** | Poor if hit directly by seat locks. | Excellent (acts as a gatekeeper). | Poor (row locking blocks connection pools). |

---

## 4. How the Databases Stay in Sync

Because we use two different databases, we have a clear strategy to keep them in sync:

1.  **Holding a Seat**: The user picks a seat, and we try to lock it in Redis. MongoDB is not touched at this stage, keeping it completely free from heavy lock requests.
2.  **Payment Phase**: The user gets a 5-minute timer to enter their credit card info.
3.  **Finalizing the Booking**:
    *   If payment succeeds: We insert a new Booking document in MongoDB and decrement the available seats count in the Showtime collection. Once MongoDB confirms this, we delete the temporary Redis lock.
    *   If payment fails: We delete the lock key in Redis immediately, which makes the seat available for other users right away.
4.  **Handling Abandoned Carts and Expired Holds**:
    *   If the user walks away from their screen, the Redis lock expires after 300 seconds. When other users fetch the seat layout, they see the seat is free again.
    *   If a user tries to submit payment after their 5 minutes is up, the server checks Redis. If the key is gone or owned by someone else, the checkout is blocked with a 410 Gone error, ensuring we never double book a seat.
