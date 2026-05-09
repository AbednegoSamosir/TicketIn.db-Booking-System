/* ==============================================================
   TICKETIN.DB — Frontend logic
   ============================================================== */

const API = {
    movies:    '/api/movies',
    showtimes: (id) => `/api/showtimes/${id}`,
    book:      '/api/bookings/request-seat',
};

const state = {
    movies: [],
    activeGenre: '',
    selectedMovie: null,
    showtimes: [],
    selectedShowtime: null,
    selectedSeat: null,
    user: null,
};

/* ==============================================================
   UTILITIES
   ============================================================== */

const $  = (sel) => document.querySelector(sel);
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
    const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
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

/* ==============================================================
   USER (stored in localStorage)
   ============================================================== */

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
    const labelEl = $('.user-pill-label');
    if (state.user) {
        labelEl.textContent = 'GUEST';
        idEl.textContent = state.user.toUpperCase();
    } else {
        labelEl.textContent = 'GUEST';
        idEl.textContent = '— —';
    }
}

/* ==============================================================
   ROUTING (view switcher)
   ============================================================== */

function showView(viewId) {
    $$('.view').forEach(v => v.classList.remove('is-active'));
    $(`#${viewId}`).classList.add('is-active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ==============================================================
   DATA: MOVIES
   ============================================================== */

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

/* ==============================================================
   DATA: SHOWTIMES
   ============================================================== */

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

    // sort by startTime ascending
    const sorted = [...state.showtimes].sort(
        (a, b) => new Date(a.startTime) - new Date(b.startTime)
    );

    // group by day
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

/* ==============================================================
   SEAT MAP
   ============================================================== */

const SEATS_PER_ROW = 10;
const ROW_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUV'.split('');

function openSeatMap(showtime) {
    state.selectedShowtime = showtime;
    state.selectedSeat = null;
    renderShowtimeInfo(showtime);
    renderSeats(showtime);
    updateBookSummary();
    showView('view-seats');
}

function renderShowtimeInfo(showtime) {
    const date = new Date(showtime.startTime);
    const movie = state.selectedMovie;
    const taken = showtime.totalSeats - showtime.availableSeats;
    $('#showtime-info').innerHTML = `
        <h1 class="showtime-info-title">${escapeHtml(movie.title)}</h1>
        <div class="showtime-info-meta">
            <span>${fmtDateLong(date)}</span>
            <span>${fmtTime(date)}</span>
            <span>${escapeHtml(showtime.theaterRoom)}</span>
            <span>${showtime.availableSeats}/${showtime.totalSeats} free</span>
        </div>
    `;
}

function renderSeats(showtime) {
    const container = $('#seats-container');
    container.innerHTML = '';

    const total = showtime.totalSeats;
    const numRows = Math.ceil(total / SEATS_PER_ROW);
    let placed = 0;

    // Pseudo-randomly mark some seats as "taken" based on availableSeats.
    // The backend doesn't expose which specific seats are booked, so this
    // is a deterministic visual approximation seeded by the showtime id.
    const takenCount = total - showtime.availableSeats;
    const takenSet = pickTakenSeats(showtime._id, total, takenCount);

    for (let r = 0; r < numRows; r++) {
        const rowLetter = ROW_LETTERS[r] || `R${r + 1}`;
        const row = el('div', 'seat-row');
        row.appendChild(el('span', 'seat-row-label', rowLetter));

        const seatsThisRow = Math.min(SEATS_PER_ROW, total - placed);
        for (let s = 0; s < seatsThisRow; s++) {
            // central aisle between seat 5 and 6
            if (s === Math.floor(SEATS_PER_ROW / 2) && seatsThisRow > 6) {
                row.appendChild(el('span', 'seat-aisle'));
            }
            const seatNum = s + 1;
            const seatId = `${rowLetter}${seatNum}`;
            const seat = el('button', 'seat', String(seatNum));
            seat.dataset.seatId = seatId;
            if (takenSet.has(placed + s)) {
                seat.classList.add('is-taken');
                seat.disabled = true;
                seat.setAttribute('aria-label', `Seat ${seatId} (taken)`);
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

// Deterministic "pick N taken seat indices" from an id string.
function pickTakenSeats(id, total, count) {
    const taken = new Set();
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
    let cursor = h;
    while (taken.size < count && taken.size < total) {
        cursor = (cursor * 1103515245 + 12345) >>> 0;
        taken.add(cursor % total);
    }
    return taken;
}

function selectSeat(seatId, seatEl) {
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
            · ${escapeHtml(state.selectedShowtime.theaterRoom)}
        `;
        cta.disabled = false;
    } else {
        summary.innerHTML = `<span class="book-summary-empty">SELECT A SEAT TO CONTINUE</span>`;
        cta.disabled = true;
    }
}

/* ==============================================================
   MODAL & BOOKING
   ============================================================== */

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
            }),
        });

        const data = await res.json().catch(() => ({}));

        if (res.status === 409) {
            closeModal();
            showToast('That seat was just taken. Please pick another.');
            // Mark selected seat as taken visually
            const taken = $(`.seat[data-seat-id="${state.selectedSeat}"]`);
            if (taken) {
                taken.classList.remove('is-selected');
                taken.classList.add('is-taken');
                taken.disabled = true;
            }
            state.selectedSeat = null;
            updateBookSummary();
            return;
        }

        if (!res.ok) {
            throw new Error(data.error || 'Booking failed');
        }

        // Success
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
    const date = new Date(state.selectedShowtime.startTime);
    const movie = state.selectedMovie;
    const showtime = state.selectedShowtime;

    $('#ticket-stub').innerHTML = `
        <div class="ticket-stub-top">
            <div class="stub-kicker">// TICKETIN.DB · ADMIT ONE</div>
            <h2 class="stub-title">${escapeHtml(movie.title)}</h2>
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
                    <span class="stub-value">${escapeHtml(showtime.theaterRoom)}</span>
                </div>
                <div class="stub-cell">
                    <span class="stub-label">RUNTIME</span>
                    <span class="stub-value is-mono">${fmtDuration(movie.duration)}</span>
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

/* ==============================================================
   HTML ESCAPING
   ============================================================== */

function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/* ==============================================================
   EVENT WIRING
   ============================================================== */

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

/* ==============================================================
   INIT
   ============================================================== */

loadUser();
loadMovies();
