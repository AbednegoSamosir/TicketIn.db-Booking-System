/* 
   TICKETIN.DB — Frontend logic
   */

const API = {
    movies: '/api/movies',
    showtimes: (id) => `/api/showtimes/${id}`,
    seats: (id) => `/api/showtimes/${id}/seats`,
    book: '/api/bookings/request-seat',
    tickets: (id) => `/api/bookings/user/${id}`
};

const state = {
    movies: [],
    activeGenre: '',
    selectedMovie: null,
    showtimes: [],
    selectedShowtime: null,
    selectedSeat: null,
    user: null,
    realSeats: { booked: [], locked: [] }
};

const socket = typeof io !== 'undefined' ? io() : null;

/* 
   UTILITIES
    */

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function el(tag, className, html) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (html != null) node.innerHTML = html;
    return node;
}

function fmtDuration(mins) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
}

function fmtTime(date) {
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
}

function fmtDateLong(date) {
    const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    return `${days[date.getDay()]} · ${date.getDate()} ${months[date.getMonth()]}`;
}

function fmtDateKey(date) {
    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function getDayLabel(date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const diff = Math.round((d - today) / 86400000);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    return null;
}

function showToast(message, type = 'error') {
    const toast = $('#toast');
    toast.textContent = message;
    toast.classList.remove('is-success');
    if (type === 'success') toast.classList.add('is-success');
    toast.classList.add('is-visible');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toast.classList.remove('is-visible'), 3500);
}

/* 
   USER
    */

function loadUser() {
    state.user = localStorage.getItem('ticketin_user') || null;
    renderUserPill();
}

function setUser(name) {
    state.user = name;
    localStorage.setItem('ticketin_user', name);
    renderUserPill();
}

function renderUserPill() {
    const idEl = $('#user-id');
    if (state.user) {
        idEl.textContent = state.user.toUpperCase();
    } else {
        idEl.textContent = '— —';
    }
}

/* 
   ROUTING
    */

function showView(viewId) {
    $$('.view').forEach(v => v.classList.remove('is-active'));
    $(`#${viewId}`).classList.add('is-active');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Leave previous showtime room if leaving seats view
    if (viewId !== 'view-seats' && state.selectedShowtime && socket) {
        socket.emit('leave_showtime', state.selectedShowtime._id);
    }
}

/* 
   DATA: MOVIES
   */

async function loadMovies() {
    try {
        const res = await fetch(API.movies);
        if (!res.ok) throw new Error('Failed to load movies');
        state.movies = await res.json();
        renderMovies();
        renderHeroStats();
        renderGenreFilter();
    } catch (err) {
        console.error(err);
        $('#movies-grid').innerHTML = `
            <div class="empty-state">
                Couldn't reach the projector booth. Is the API running on port 3000?
            </div>`;
    }
}

function renderHeroStats() {
    $('#stat-films').textContent = state.movies.length;
    const allGenres = new Set();
    state.movies.forEach(m => (m.genres || []).forEach(g => allGenres.add(g)));
    $('#stat-genres').textContent = allGenres.size;
}

function renderGenreFilter() {
    const allGenres = new Set();
    state.movies.forEach(m => (m.genres || []).forEach(g => allGenres.add(g)));
    const sorted = [...allGenres].sort();

    const chips = $('#filter-chips');
    chips.innerHTML = '';

    const all = el('button', 'chip is-active', 'ALL');
    all.dataset.genre = '';
    chips.appendChild(all);

    sorted.forEach(genre => {
        const c = el('button', 'chip', genre.toUpperCase());
        c.dataset.genre = genre;
        chips.appendChild(c);
    });

    chips.addEventListener('click', (e) => {
        const chip = e.target.closest('.chip');
        if (!chip) return;
        chips.querySelectorAll('.chip').forEach(c => c.classList.remove('is-active'));
        chip.classList.add('is-active');
        state.activeGenre = chip.dataset.genre;
        renderMovies();
    });
}

function renderMovies() {
    const grid = $('#movies-grid');
    const list = state.activeGenre
        ? state.movies.filter(m => (m.genres || []).includes(state.activeGenre))
        : state.movies;

    if (list.length === 0) {
        grid.innerHTML = `<div class="empty-state">No films in this category yet.</div>`;
        return;
    }

    grid.innerHTML = '';
    list.forEach((movie, i) => {
        const card = el('article', 'movie-card');
        card.dataset.movieId = movie._id;
        const num = String(i + 1).padStart(3, '0');
        const genres = (movie.genres || []).slice(0, 3)
            .map(g => `<span class="movie-card-genre">${g}</span>`)
            .join('');
        card.innerHTML = `
            <div class="movie-card-num">N°&nbsp;${num}</div>
            <h3 class="movie-card-title">${escapeHtml(movie.title)}</h3>
            <div class="movie-card-meta">${genres}</div>
            <div class="movie-card-bottom">
                <span class="movie-card-runtime">${fmtDuration(movie.duration)}</span>
                <span class="movie-card-cta">SHOWTIMES →</span>
            </div>
        `;
        card.addEventListener('click', () => openMovie(movie));
        grid.appendChild(card);
    });
}

/* 
   DATA: SHOWTIMES
    */

async function openMovie(movie) {
    state.selectedMovie = movie;
    renderMovieDetail(movie);
    showView('view-showtimes');
    $('#showtimes-list').innerHTML = `
        <div class="loading-state">
            <span class="loading-dots">LOADING<span></span><span></span><span></span></span>
        </div>`;

    try {
        const res = await fetch(API.showtimes(movie._id));
        if (res.status === 404) {
            state.showtimes = [];
            $('#showtimes-list').innerHTML = `
                <div class="empty-state">No screenings scheduled for this film.</div>`;
            return;
        }
        if (!res.ok) throw new Error('Failed to load showtimes');
        state.showtimes = await res.json();
        renderShowtimes();
    } catch (err) {
        console.error(err);
        $('#showtimes-list').innerHTML = `
            <div class="empty-state">Couldn't load showtimes. Try again in a moment.</div>`;
    }
}

function renderMovieDetail(movie) {
    const cast = (movie.cast || []).join(', ') || '—';
    const genres = (movie.genres || []).map(g =>
        `<span class="movie-card-genre">${g}</span>`
    ).join('');

    $('#movie-detail').innerHTML = `
        <div>
            <p class="movie-detail-kicker">// FEATURE PRESENTATION</p>
            <h1 class="movie-detail-title">${escapeHtml(movie.title)}</h1>
            <div class="movie-detail-genres">${genres}</div>
        </div>
        <div class="movie-detail-side">
            <div class="detail-row">
                <span class="detail-label">RUNTIME</span>
                <span class="detail-value">${fmtDuration(movie.duration)}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">CAST</span>
                <span class="detail-value">${escapeHtml(cast)}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">FILM ID</span>
                <span class="detail-value" style="font-family: var(--mono); font-size: 0.8rem;">${movie._id}</span>
            </div>
        </div>
    `;
}

function renderShowtimes() {
    const list = $('#showtimes-list');
    list.innerHTML = '';

    if (state.showtimes.length === 0) {
        list.innerHTML = `<div class="empty-state">No screenings scheduled for this film.</div>`;
        return;
    }

    const sorted = [...state.showtimes].sort(
        (a, b) => new Date(a.startTime) - new Date(b.startTime)
    );

    const groups = {};
    sorted.forEach(st => {
        const date = new Date(st.startTime);
        const key = fmtDateKey(date);
        if (!groups[key]) groups[key] = { date, items: [] };
        groups[key].items.push(st);
    });

    Object.values(groups).forEach(group => {
        const dayGroup = el('div', 'showtime-day-group');

        const labelOverride = getDayLabel(group.date);
        const dayLabelText = labelOverride
            ? `${labelOverride} — ${fmtDateLong(group.date)}`
            : fmtDateLong(group.date);

        dayGroup.appendChild(el('h2', 'showtime-day-label', dayLabelText));

        group.items.forEach(st => {
            const time = fmtTime(new Date(st.startTime));
            const lowAvail = st.availableSeats < st.totalSeats * 0.2;
            const row = el('div', 'showtime-row');
            row.innerHTML = `
                <div class="showtime-time">${time}</div>
                <div class="showtime-meta">
                    <span class="showtime-room">${escapeHtml(st.theaterRoom)}</span>
                    <span class="showtime-availability${lowAvail ? ' is-low' : ''}">
                        ${st.availableSeats} of ${st.totalSeats} seats free
                    </span>
                </div>
                <div class="showtime-cta">PICK SEAT →</div>
            `;
            row.addEventListener('click', () => openSeatMap(st));
            dayGroup.appendChild(row);
        });

        list.appendChild(dayGroup);
    });
}

/* 
   SEAT MAP
    */

const SEATS_PER_ROW = 10;
const ROW_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUV'.split('');

async function openSeatMap(showtime) {
    state.selectedShowtime = showtime;
    state.selectedSeat = null;
    state.realSeats = { booked: [], locked: [] };

    renderShowtimeInfo(showtime);
    showView('view-seats');
    $('#seats-container').innerHTML = `
        <div class="loading-state">
            <span class="loading-dots">LOADING SEATS<span></span><span></span><span></span></span>
        </div>`;
    updateBookSummary();

    if (socket) socket.emit('join_showtime', showtime._id);

    try {
        const res = await fetch(API.seats(showtime._id));
        if (res.ok) {
            state.realSeats = await res.json();
        }
        renderSeats(showtime);
    } catch (err) {
        console.error(err);
        $('#seats-container').innerHTML = `<div class="empty-state">Failed to load real-time seat data.</div>`;
    }
}

function renderShowtimeInfo(showtime) {
    const date = new Date(showtime.startTime);
    const movie = state.selectedMovie || { title: "Unknown" };
    $('#showtime-info').innerHTML = `
        <h1 class="showtime-info-title">${escapeHtml(movie.title)}</h1>
        <div class="showtime-info-meta">
            <span>${fmtDateLong(date)}</span>
            <span>${fmtTime(date)}</span>
            <span>${escapeHtml(showtime.theaterRoom)}</span>
        </div>
    `;
}

function renderSeats(showtime) {
    const container = $('#seats-container');
    container.innerHTML = '';

    const total = showtime.totalSeats;
    const numRows = Math.ceil(total / SEATS_PER_ROW);
    let placed = 0;

    for (let r = 0; r < numRows; r++) {
        const rowLetter = ROW_LETTERS[r] || `R${r + 1}`;
        const row = el('div', 'seat-row');
        row.appendChild(el('span', 'seat-row-label', rowLetter));

        const seatsThisRow = Math.min(SEATS_PER_ROW, total - placed);
        for (let s = 0; s < seatsThisRow; s++) {
            if (s === Math.floor(SEATS_PER_ROW / 2) && seatsThisRow > 6) {
                row.appendChild(el('span', 'seat-aisle'));
            }
            const seatNum = s + 1;
            const seatId = `${rowLetter}${seatNum}`;
            const seat = el('button', 'seat', String(seatNum));
            seat.dataset.seatId = seatId;

            if (state.realSeats.booked.includes(seatId)) {
                seat.classList.add('is-taken');
                seat.disabled = true;
                seat.setAttribute('aria-label', `Seat ${seatId} (taken)`);
            } else if (state.realSeats.locked.includes(seatId)) {
                seat.classList.add('is-locked');
                seat.disabled = true;
                seat.setAttribute('aria-label', `Seat ${seatId} (in checkout)`);
            } else {
                seat.setAttribute('aria-label', `Seat ${seatId}`);
                seat.addEventListener('click', () => selectSeat(seatId, seat));
            }
            row.appendChild(seat);
        }
        placed += seatsThisRow;

        row.appendChild(el('span', 'seat-row-label', rowLetter));
        container.appendChild(row);
    }
}

function selectSeat(seatId, seatEl) {
    if (seatEl.disabled) return;
    $$('.seat.is-selected').forEach(s => s.classList.remove('is-selected'));
    seatEl.classList.add('is-selected');
    state.selectedSeat = seatId;
    updateBookSummary();
}

function updateBookSummary() {
    const summary = $('#book-summary');
    const cta = $('#cta-book');
    if (state.selectedSeat) {
        summary.innerHTML = `
            Seat <span class="book-summary-seat">${state.selectedSeat}</span>
            · ${escapeHtml(state.selectedShowtime?.theaterRoom || '')}
        `;
        cta.disabled = false;
    } else {
        summary.innerHTML = `<span class="book-summary-empty">SELECT A SEAT TO CONTINUE</span>`;
        cta.disabled = true;
    }
}

/* 
   SOCKET.IO REAL-TIME LISTENERS
    */

if (socket) {
    socket.on('seat_locked', ({ showtimeId, seatNumber }) => {
        if (state.selectedShowtime && state.selectedShowtime._id === showtimeId) {
            const btn = $(`.seat[data-seat-id="${seatNumber}"]`);
            if (btn) {
                btn.classList.remove('is-selected');
                btn.classList.add('is-locked');
                btn.disabled = true;
                if (state.selectedSeat === seatNumber) {
                    state.selectedSeat = null;
                    updateBookSummary();
                    showToast('The seat you selected is now in checkout by someone else.');
                }
            }
        }
    });

    socket.on('seat_booked', ({ showtimeId, seatNumber }) => {
        if (state.selectedShowtime && state.selectedShowtime._id === showtimeId) {
            const btn = $(`.seat[data-seat-id="${seatNumber}"]`);
            if (btn) {
                btn.classList.remove('is-locked', 'is-selected');
                btn.classList.add('is-taken');
                btn.disabled = true;
            }
        }
    });

    socket.on('seat_freed', ({ showtimeId, seatNumber }) => {
        if (state.selectedShowtime && state.selectedShowtime._id === showtimeId) {
            const btn = $(`.seat[data-seat-id="${seatNumber}"]`);
            if (btn) {
                btn.classList.remove('is-locked', 'is-taken', 'is-selected');
                btn.disabled = false;
            }
        }
    });
}

/* 
   MODAL & BOOKING
    */

function openBookingModal() {
    if (!state.selectedSeat) return;

    const date = new Date(state.selectedShowtime.startTime);
    $('#modal-title').textContent = `Hold seat ${state.selectedSeat}?`;
    $('#modal-subtitle').innerHTML = `
        ${escapeHtml(state.selectedMovie.title)} ·
        ${fmtDateLong(date)} ·
        ${fmtTime(date)} ·
        ${escapeHtml(state.selectedShowtime.theaterRoom)}
    `;

    const input = $('#modal-input');
    input.value = state.user || '';

    $('#modal').classList.add('is-open');
    $('#modal').setAttribute('aria-hidden', 'false');
    setTimeout(() => input.focus(), 50);
}

function closeModal() {
    $('#modal').classList.remove('is-open');
    $('#modal').setAttribute('aria-hidden', 'true');
}

async function confirmBooking() {
    const input = $('#modal-input');
    const userId = input.value.trim();
    if (!userId) {
        input.focus();
        showToast('Please enter your name.');
        return;
    }
    setUser(userId);

    const btn = $('#modal-confirm');
    btn.disabled = true;
    btn.innerHTML = `PROCESSING<span class="cta-arrow">…</span>`;

    try {
        const res = await fetch(API.book, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId,
                showtimeId: state.selectedShowtime._id,
                seatNumber: state.selectedSeat,
                socketId: socket ? socket.id : null
            }),
        });

        const data = await res.json().catch(() => ({}));

        if (res.status === 409 || res.status === 429 || res.status === 402) {
            closeModal();
            showToast(data.error || 'Seat taken or rate limited.');
            return;
        }

        if (!res.ok) {
            throw new Error(data.error || 'Booking failed');
        }

        closeModal();
        renderTicket(data.bookingDetails);
        showView('view-confirm');
        showToast('Reserved. Enjoy the film.', 'success');
    } catch (err) {
        console.error(err);
        showToast(err.message || 'Booking failed. Try again.');
    } finally {
        btn.disabled = false;
        btn.innerHTML = `CONFIRM &amp; PAY <span class="cta-arrow">→</span>`;
    }
}

function renderTicket(booking) {
    const movieTitle = state.selectedMovie ? state.selectedMovie.title : 'Movie';
    const duration = state.selectedMovie ? state.selectedMovie.duration : 0;
    const room = state.selectedShowtime ? state.selectedShowtime.theaterRoom : 'Cinema';
    const date = state.selectedShowtime ? new Date(state.selectedShowtime.startTime) : new Date(booking.bookingTime);

    $('#ticket-stub').innerHTML = `
        <div class="ticket-stub-top">
            <div class="stub-kicker">// TICKETIN.DB · ADMIT ONE</div>
            <h2 class="stub-title">${escapeHtml(movieTitle)}</h2>
            <div class="stub-grid">
                <div class="stub-cell">
                    <span class="stub-label">DATE</span>
                    <span class="stub-value">${fmtDateLong(date)}</span>
                </div>
                <div class="stub-cell">
                    <span class="stub-label">TIME</span>
                    <span class="stub-value is-mono">${fmtTime(date)}</span>
                </div>
                <div class="stub-cell">
                    <span class="stub-label">THEATER</span>
                    <span class="stub-value">${escapeHtml(room)}</span>
                </div>
                <div class="stub-cell">
                    <span class="stub-label">RUNTIME</span>
                    <span class="stub-value is-mono">${fmtDuration(duration)}</span>
                </div>
            </div>
        </div>
        <div class="ticket-stub-bottom">
            <div>
                <div class="stub-cell" style="margin-bottom: 0.75rem;">
                    <span class="stub-label">RESERVED FOR</span>
                    <span class="stub-value">${escapeHtml(booking.userId)}</span>
                </div>
                <div class="stub-cell">
                    <span class="stub-label">STATUS</span>
                    <span class="stub-value is-mono" style="color: var(--velvet);">● ${booking.status}</span>
                </div>
                <div class="stub-id">REF · ${booking._id}</div>
            </div>
            <div class="stub-seat-block">
                <div class="stub-seat-label">YOUR SEAT</div>
                <div class="stub-seat-value">${booking.seatNumber}</div>
            </div>
        </div>
    `;
}

/* 
   MY TICKETS
    */

async function openMyTickets() {
    showView('view-mytickets');
    const list = $('#tickets-list');

    if (!state.user) {
        list.innerHTML = `<div class="empty-state">No reservations found. (Not logged in)</div>`;
        return;
    }

    list.innerHTML = `
        <div class="loading-state">
            <span class="loading-dots">LOADING TICKETS<span></span><span></span><span></span></span>
        </div>`;

    try {
        const res = await fetch(API.tickets(state.user));
        if (!res.ok) throw new Error('Failed to load tickets');
        const tickets = await res.json();

        if (tickets.length === 0) {
            list.innerHTML = `<div class="empty-state">No reservations found for ${escapeHtml(state.user)}.</div>`;
            return;
        }

        list.innerHTML = '';
        tickets.forEach(t => {
            const b = t.booking;
            const m = t.movie;
            const s = t.showtime;
            const date = s ? new Date(s.startTime) : new Date(b.bookingTime);

            const row = el('div', 'ticket-row');
            row.innerHTML = `
                <div>
                    <h3 class="ticket-row-title">${m ? escapeHtml(m.title) : 'Unknown Movie'}</h3>
                    <div class="ticket-row-meta">
                        ${fmtDateLong(date)} at ${fmtTime(date)} · ${s ? escapeHtml(s.theaterRoom) : 'Unknown Room'} · Status: ${b.status}
                    </div>
                </div>
                <div class="ticket-row-seat">${b.seatNumber}</div>
            `;
            list.appendChild(row);
        });

    } catch (err) {
        console.error(err);
        list.innerHTML = `<div class="empty-state">Failed to load reservations.</div>`;
    }
}

/* 
   HTML ESCAPING
    */

function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/* 
   EVENT WIRING
    */

document.addEventListener('click', (e) => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (!action) return;
    if (action === 'home') {
        e.preventDefault();
        showView('view-movies');
    } else if (action === 'back-to-showtimes') {
        showView('view-showtimes');
    } else if (action === 'close-modal') {
        closeModal();
    } else if (action === 'my-tickets') {
        e.preventDefault();
        openMyTickets();
    }
});

$('#cta-book').addEventListener('click', openBookingModal);
$('#modal-confirm').addEventListener('click', confirmBooking);

$('#modal-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') confirmBooking();
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && $('#modal').classList.contains('is-open')) {
        closeModal();
    }
});

/* 
   INIT
    */

loadUser();
loadMovies();
