# Database Schemas and Diagrams

This document explains how our database is structured and shows the UML diagrams for our ticket booking system.

---

## 1. MongoDB Database Schemas

We use MongoDB as our main database to store permanent data. We build our models with Mongoose. Here is how our data collections are organized.

### 1.1 User Schema (users collection)
This collection holds user accounts and registration data.

*   `accountName` (String, Required, Unique): The username that acts as a unique ID to identify each user.
*   `email` (String, Optional): The user email address.
*   `password` (String, Required): Hashed password using bcrypt.

### 1.2 Movie Schema (movies collection)
This collection contains the list of movies currently screening in our cinemas.

*   `title` (String, Required): Movie title.
*   `duration` (Number, Required): Total running time in minutes.
*   `genres` (Array of Strings): Genres like Action, Drama, or Sci-Fi.
*   `cast` (Array of Strings): Names of the main actors in the movie.

### 1.3 Cinema Schema (cinemas collection)
This collection stores the physical location details for each cinema.

*   `name` (String, Required): The name of the cinema hall.
*   `area` (String, Required): The city region where the cinema is located, such as North or South.

### 1.4 Showtime Schema (showtimes collection)
This collection connects a movie to a specific cinema at a specific time.

*   `movieId` (ObjectId, Required): Reference pointing directly to a Movie document.
*   `cinemaId` (ObjectId, Required): Reference pointing directly to a Cinema document.
*   `startTime` (Date, Required): The exact screening date and time.
*   `theaterRoom` (String, Required): The name of the theater hall (for example, Audi 2).
*   `totalSeats` (Number, Default: 50): Total seating capacity of this room.
*   `availableSeats` (Number, Default: 50): The number of seats currently left for booking.

### 1.5 Booking Schema (bookings collection)
This collection saves every ticket that has been successfully paid for.

*   `userId` (String, Required): Reference matching the user's `accountName`.
*   `showtimeId` (String, Required): Reference matching the Showtime ID.
*   `seatNumber` (String, Required): The specific seat number (for example, F12).
*   `status` (String, Enum: `['PENDING', 'PAID', 'FAILED']`, Default: `PAID`): Payment status.
*   `bookingTime` (Date, Default: `Date.now`): The exact time the booking was placed.

---

## 2. Redis Key Structure for Seat Locks

We use Upstash Redis as a high-speed lock manager to make sure users do not buy the same seat at the same time. This keeps our main MongoDB database safe from getting overwhelmed.

### 2.1 Key Design
*   **Key format**: `seat_lock:{showtimeId}:{seatNumber}`
    *   *Type*: String
    *   *Example*: `seat_lock:60c72b2f9b1d8a001c8d4512:G12`
*   **Value**: `userId` (contains the `accountName` of the user currently holding the seat)
*   **TTL**: 300 seconds (which gives the user a 5 minute hold)

### 2.2 How the Lock Works
1.  When a user chooses a seat and clicks reserve, the server runs this Redis command:
    ```redis
    SET seat_lock:{showtimeId}:{seatNumber} {userId} EX 300 NX
    ```
2.  If the seat is already locked by someone else, Redis returns null and the server returns a 409 Conflict status.
3.  If the lock is successful, Redis saves the key. The seat status changes to "IN CHECKOUT" on other screens in real time using Socket.IO.

---

## 3. System Diagrams (Mermaid)

### 3.1 Booking Flowchart
This diagram shows the path from choosing a seat to final payment.

```mermaid
flowchart TD
    Start([User Selects Seats]) --> CheckSeatCount{Is seat count<br>1 to 5?}
    
    CheckSeatCount -->|No| ShowErrorCount["Show Error:<br>Pick 1 to 5 Seats"]
    ShowErrorCount --> Start
    CheckSeatCount -->|Yes| ClickReserve[User Clicks 'Reserve']
    
    ClickReserve --> LockSeatsRequest[POST /api/bookings/lock-seats]
    LockSeatsRequest --> AttemptLocks["Iterate selected seats:<br>Attempt Redis SET seat_lock NX with 300s TTL"]
    
    AttemptLocks --> VerifyLocks{Are ALL locks<br>acquired?}
    
    VerifyLocks -->|No| RollbackLocks["Rollback acquired locks:<br>Delete keys in Redis & Emit seat_freed"]
    RollbackLocks --> Response409["Return 409 Conflict:<br>Seat locked by someone else"]
    Response409 --> ShowToastError["Show toast & Refresh seat map"]
    ShowToastError --> Start
    
    VerifyLocks -->|Yes| Response200Lock["Return 200 OK:<br>Seats held for 5 minutes"]
    Response200Lock --> ShowPaymentModal["Show Payment Form &<br>Start 5-Minute Timer"]
    
    ShowPaymentModal --> UserChoice{User action?}
    
    UserChoice -->|Clicks Cancel / Timer Expires| CancelRequest[POST /api/bookings/cancel-lock]
    CancelRequest --> FreeRedisLocks["Delete lock keys in Redis &<br>Emit seat_freed"]
    FreeRedisLocks --> ClosePayment[Close payment modal]
    ClosePayment --> Start
    
    UserChoice -->|Submits Payment| PaymentRequest[POST /api/bookings/confirm-payment]
    
    PaymentRequest --> VerifyLockOwner{Are locks still valid<br>& owned by this user?}
    
    VerifyLockOwner -->|No| Response410["Return 410 Gone:<br>Hold expired"]
    Response410 --> ShowHoldExpired[Show Hold Expired modal]
    ShowHoldExpired --> Start
    
    VerifyLockOwner -->|Yes| SimulatePayment["Simulate Payment Gateway<br>10% chance of failure"]
    
    SimulatePayment --> CheckPayment{Payment succeeded?}
    
    CheckPayment -->|No| Response402["Return 402 Payment Declined:<br>Release locks in Redis & Emit seat_freed"]
    Response402 --> ShowPaymentDeclined[Show Payment Declined toast]
    ShowPaymentDeclined --> Start
    
    CheckPayment -->|Yes| SaveToMongoDB["MongoDB: Save Booking documents<br>with status PAID"]
    SaveToMongoDB --> UpdateShowtime["MongoDB: Decrement availableSeats<br>in Showtime model"]
    UpdateShowtime --> ReleaseRedisLocks[Delete lock keys in Redis]
    ReleaseRedisLocks --> BroadcastBooked[Emit seat_booked via Socket.IO]
    BroadcastBooked --> Response200Success["Return 200 OK:<br>Booking complete"]
    Response200Success --> ShowTicketStub[Show Ticket Stub / Confirmation]
    ShowTicketStub --> End([Flow Completed])
```

---

### 3.2 Entity Relationship Diagram (ERD)
This diagram shows how our MongoDB documents relate to each other and the temporary lock in Redis.

```mermaid
erDiagram
    USER {
        string accountName PK "Unique Username"
        string email "User Email"
        string password "BCrypt Hash"
    }

    MOVIE {
        objectId id PK
        string title "Movie Title"
        int duration "Duration in Minutes"
        array_string genres "List of Genres"
        array_string cast "List of Actors"
    }

    CINEMA {
        objectId id PK
        string name "Cinema Hall Name"
        string area "Region / City"
    }

    SHOWTIME {
        objectId id PK
        objectId movieId FK "References MOVIE"
        objectId cinemaId FK "References CINEMA"
        date startTime "Screening Date & Time"
        string theaterRoom "Room Identifier (e.g. Audi 1)"
        int totalSeats "Default 50"
        int availableSeats "Remaining Seats"
    }

    BOOKING {
        objectId id PK
        string userId FK "References USER (accountName)"
        string showtimeId FK "References SHOWTIME (id)"
        string seatNumber "Seat Identifier (e.g. G12)"
        string status "PENDING, PAID, FAILED"
        date bookingTime "Timestamp"
    }

    REDIS_SEAT_LOCK {
        string lockKey PK "Format: seat_lock:{showtimeId}:{seatNumber}"
        string userId "Holds the accountName of holding User"
        int ttl "TTL 300 seconds (5 mins)"
    }

    USER ||--o{ BOOKING : "places"
    MOVIE ||--o{ SHOWTIME : "schedules"
    CINEMA ||--o{ SHOWTIME : "hosts"
    SHOWTIME ||--o{ BOOKING : "has"
    
    USER ||..o{ REDIS_SEAT_LOCK : "temporarily holds"
    SHOWTIME ||..o{ REDIS_SEAT_LOCK : "locks seats for"
```

---

### 3.3 Use Case Diagram
This diagram shows the actions that anonymous guests and registered members can perform.

```mermaid
graph LR
    classDef actor fill:#f9f,stroke:#333,stroke-width:2px;
    classDef usecase fill:#e1f5fe,stroke:#0288d1,stroke-width:2px,rx:20,ry:20;

    subgraph Actors ["Actors"]
        Guest["Guest / Anonymous"]
        Member["Registered Member"]
    end

    subgraph System ["System Boundary: TicketIn.db Booking System"]
        UC1(("Browse Movies and<br>Filter by Genre"))
        UC2(("Search Movies by Title"))
        UC3(("View Cinema Showtimes"))
        UC4(("Create Account and Login"))
        
        UC5(("Select and Lock Seats<br>5-Min Redis Hold"))
        UC6(("Complete Payment and<br>Issue Tickets"))
        UC7(("Cancel Hold and<br>Release Seats"))
        UC8(("View My Reservations"))
        UC9(("Manage Profile and<br>Change Password"))
    end

    class Guest,Member actor;
    class UC1,UC2,UC3,UC4,UC5,UC6,UC7,UC8,UC9 usecase;

    Guest --> UC1
    Guest --> UC2
    Guest --> UC3
    Guest --> UC4

    Member --> UC1
    Member --> UC2
    Member --> UC3
    Member --> UC5
    Member --> UC6
    Member --> UC7
    Member --> UC8
    Member --> UC9

    Member -.->|inherits actions from| Guest
```

---

### 3.4 Class Diagram
This diagram shows the relationship between our models, controllers, and Socket.IO.

```mermaid
classDiagram
    Movie "1" <-- "*" Showtime : references
    Cinema "1" <-- "*" Showtime : references
    User "1" <-- "*" Booking : places
    Showtime "1" <-- "*" Booking : schedules

    BookingController ..> Booking : inserts
    BookingController ..> Showtime : updates
    BookingController ..> SeatLock : operates
    BookingController ..> SocketServer : triggers broadcasts

    class User {
        +String accountName
        +String email
        +String password
    }

    class Movie {
        +ObjectId id
        +String title
        +int duration
        +String[] genres
        +String[] cast
    }

    class Cinema {
        +ObjectId id
        +String name
        +String area
    }

    class Showtime {
        +ObjectId id
        +ObjectId movieId
        +ObjectId cinemaId
        +Date startTime
        +String theaterRoom
        +int totalSeats
        +int availableSeats
    }

    class Booking {
        +ObjectId id
        +String userId
        +String showtimeId
        +String seatNumber
        +String status
        +Date bookingTime
    }

    class SeatLock {
        <<Redis Ephemeral>>
        +String lockKey
        +String userId
        +int ttl
        +acquire(key: String, user: String, ttl: int) Boolean
        +getOwner(key: String) String
        +release(key: String) void
    }

    class BookingController {
        <<Express Router>>
        -HOLD_SECONDS : int
        +handleLockSeats(req, res) void
        +handleConfirmPayment(req, res) void
        +handleCancelLock(req, res) void
        +handleMyTickets(req, res) void
    }

    class SocketServer {
        <<Socket.IO>>
        +joinShowtime(showtimeId) void
        +leaveShowtime(showtimeId) void
        +emitSeatLocked(showtimeId, seat) void
        +emitSeatFreed(showtimeId, seat) void
        +emitSeatBooked(showtimeId, seat) void
    }
```
