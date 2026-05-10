const mongoose = require('mongoose');
const Movie = require('./models/Movie');
const Showtime = require('./models/Showtime');

const MONGO_URI = 'mongodb://127.0.0.1:27017/ticketin_db';

function pickRandom(arr, min = 1, max = 3) {
    const count = Math.floor(Math.random() * (max - min + 1)) + min;
    const shuffled = [...arr].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
}

function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

const genrePool = [
    'Action', 'Adventure', 'Animation', 'Comedy', 'Crime',
    'Documentary', 'Drama', 'Fantasy', 'Horror', 'Mystery',
    'Romance', 'Sci-Fi', 'Thriller', 'War', 'Musical',
    'Western', 'Family', 'Biography', 'History', 'Sport', 'chudai'
];

const castPool = [
    'Anya Setiawan', 'Budi Raharjo', 'Citra Dewi', 'Dimas Putra', 'Eka Pratama',
    'Fitri Handayani', 'Gilang Ramadhan', 'Hana Wijaya', 'Ivan Kurniawan', 'Jasmine Putri',
    'Kenzo Tanaka', 'Luna Maharani', 'Mikhail Volkov', 'Nadia Permata', 'Oscar Firmansyah',
    'Putri Ayu', 'Quinn Santoso', 'Rizky Nugraha', 'Sari Wulandari', 'Taufik Hidayat',
    'Uma Kusuma', 'Vino Bastian', 'Wulan Sari', 'Xavier Chandra', 'Yuki Hartono',
    'Zahra Amelia', 'Arief Budiman', 'Bella Safira', 'Cahya Utomo', 'Devi Lestari',
    'Enzo Pratama', 'Farah Nabila', 'Galih Pramono', 'Hesti Anindita', 'Irfan Maulana',
    'Julia Kartika', 'Kevin Pranoto', 'Laras Sekarputi', 'Maulana Akbar', 'Nayla Azzahra',
    'Omar Hakim', 'Pia Salsabila', 'Rafi Syahputra', 'Sinta Permatasari', 'Teguh Wicaksono',
    'Ulya Ramadhani', 'Vira Anggiani', 'Wahyu Setiabudi', 'Xena Puspita', 'Yanto Suparjo'
];

const theaterRooms = [
    'Studio 1', 'Studio 2', 'Studio 3', 'Studio 4', 'Studio 5',
    'Studio 6', 'Studio 7', 'IMAX', 'Premiere A', 'Premiere B',
    'Deluxe 1', 'Deluxe 2', 'Gold Class', '4DX', 'ScreenX'
];

const movieData = [
    { title: 'Shadow of the Iron Veil', duration: 128, genres: ['Action', 'Thriller'] },
    { title: 'Crimson Protocol', duration: 135, genres: ['Action', 'Sci-Fi'] },
    { title: 'The Last Renegade', duration: 142, genres: ['Action', 'Adventure'] },
    { title: 'Thunderstrike Academy', duration: 118, genres: ['Action', 'Comedy'] },
    { title: 'Operation Midnight Dawn', duration: 155, genres: ['Action', 'War'] },
    { title: 'Blaze Runner: Reborn', duration: 132, genres: ['Action', 'Sci-Fi'] },
    { title: 'Fury of the Forgotten', duration: 144, genres: ['Action', 'Drama'] },
    { title: 'Apex Predator', duration: 121, genres: ['Action', 'Thriller'] },
    { title: 'Code Vanguard', duration: 138, genres: ['Action', 'Crime'] },
    { title: 'Phantom Reckoning', duration: 126, genres: ['Action', 'Mystery'] },
    { title: 'Skyfall Inferno', duration: 149, genres: ['Action', 'Adventure'] },
    { title: 'The Steel Covenant', duration: 133, genres: ['Action', 'Fantasy'] },
    { title: 'Nightshade Operative', duration: 117, genres: ['Action', 'Thriller'] },
    { title: 'Ironclad Uprising', duration: 141, genres: ['Action', 'War'] },
    { title: 'Velocity Unknown', duration: 130, genres: ['Action', 'Sci-Fi'] },

    { title: 'Nebula Beyond the Rift', duration: 162, genres: ['Sci-Fi', 'Adventure'] },
    { title: 'Quantum Paradox', duration: 148, genres: ['Sci-Fi', 'Thriller'] },
    { title: 'Colony 7: First Contact', duration: 157, genres: ['Sci-Fi', 'Drama'] },
    { title: 'Synthetica', duration: 134, genres: ['Sci-Fi', 'Mystery'] },
    { title: 'The Last Terraformer', duration: 145, genres: ['Sci-Fi', 'Adventure'] },
    { title: 'Echoes from Andromeda', duration: 139, genres: ['Sci-Fi', 'Romance'] },
    { title: 'Neon Genesis Protocol', duration: 128, genres: ['Sci-Fi', 'Action'] },
    { title: 'Binary Sunset', duration: 152, genres: ['Sci-Fi', 'Drama'] },
    { title: 'Dark Matter Symphony', duration: 141, genres: ['Sci-Fi', 'Mystery'] },
    { title: 'The Void Walker', duration: 136, genres: ['Sci-Fi', 'Horror'] },

    { title: 'Whispers in the Rain', duration: 125, genres: ['Drama', 'Romance'] },
    { title: 'The Weight of Silence', duration: 138, genres: ['Drama'] },
    { title: 'Broken Horizons', duration: 131, genres: ['Drama', 'Adventure'] },
    { title: 'Letters to November', duration: 118, genres: ['Drama', 'Romance'] },
    { title: 'The Glassblower\'s Daughter', duration: 127, genres: ['Drama', 'History'] },
    { title: 'A Thousand Paper Cranes', duration: 142, genres: ['Drama', 'War'] },
    { title: 'Fractured Memories', duration: 116, genres: ['Drama', 'Mystery'] },
    { title: 'Still Life in Motion', duration: 134, genres: ['Drama'] },
    { title: 'The Olive Tree Promise', duration: 121, genres: ['Drama', 'Family'] },
    { title: 'Tides of Reckoning', duration: 149, genres: ['Drama', 'Thriller'] },
    { title: 'Between Two Worlds', duration: 137, genres: ['Drama', 'Fantasy'] },
    { title: 'The Color of Goodbye', duration: 112, genres: ['Drama', 'Romance'] },
    { title: 'Sunrise Over Jakarta', duration: 129, genres: ['Drama', 'Biography'] },
    { title: 'The Unfinished Symphony', duration: 144, genres: ['Drama', 'Musical'] },
    { title: 'Winter in Bandung', duration: 119, genres: ['Drama', 'Romance'] },

    { title: 'My Neighbor is a Spy', duration: 104, genres: ['Comedy', 'Action'] },
    { title: 'Wedding Crashers: Jakarta', duration: 112, genres: ['Comedy', 'Romance'] },
    { title: 'The Intern Diaries', duration: 98, genres: ['Comedy'] },
    { title: 'Papa\'s Wild Weekend', duration: 106, genres: ['Comedy', 'Family'] },
    { title: 'Lost in Translation (Again)', duration: 101, genres: ['Comedy', 'Adventure'] },
    { title: 'Roommate from Mars', duration: 95, genres: ['Comedy', 'Sci-Fi'] },
    { title: 'Accidental Millionaire', duration: 108, genres: ['Comedy', 'Drama'] },
    { title: 'The Wedding Singer Strikes Back', duration: 110, genres: ['Comedy', 'Musical'] },
    { title: 'Chaos at the Family Reunion', duration: 99, genres: ['Comedy', 'Family'] },
    { title: 'Level Up: The Gamer Movie', duration: 115, genres: ['Comedy', 'Adventure'] },
    { title: 'Love, Lies & Laundry', duration: 103, genres: ['Comedy', 'Romance'] },
    { title: 'The Great Escape Room', duration: 97, genres: ['Comedy', 'Mystery'] },
    { title: 'Trouble in Paradise Cove', duration: 109, genres: ['Comedy', 'Romance'] },
    { title: 'Office Mayhem', duration: 92, genres: ['Comedy'] },
    { title: 'The Unlikely Hero Club', duration: 105, genres: ['Comedy', 'Adventure'] },

    { title: 'The Whispering Walls', duration: 118, genres: ['Horror', 'Mystery'] },
    { title: 'Crimson Mirror', duration: 126, genres: ['Horror', 'Thriller'] },
    { title: 'They Come at Dusk', duration: 133, genres: ['Horror'] },
    { title: 'The Hollow Inn', duration: 109, genres: ['Horror', 'Mystery'] },
    { title: 'Beneath the Floorboards', duration: 121, genres: ['Horror', 'Thriller'] },
    { title: 'Nightmare Frequency', duration: 115, genres: ['Horror', 'Sci-Fi'] },
    { title: 'The Bone Collector\'s Game', duration: 138, genres: ['Thriller', 'Crime'] },
    { title: 'Silent Descent', duration: 112, genres: ['Horror'] },
    { title: 'The Watchman\'s Eye', duration: 129, genres: ['Thriller', 'Mystery'] },
    { title: 'Requiem of Shadows', duration: 141, genres: ['Horror', 'Fantasy'] },
    { title: 'Cold Case Revival', duration: 136, genres: ['Thriller', 'Crime'] },
    { title: 'The Eighth Floor', duration: 104, genres: ['Horror', 'Mystery'] },
    { title: 'Prey After Dark', duration: 119, genres: ['Horror', 'Thriller'] },
    { title: 'Deadlock Protocol', duration: 128, genres: ['Thriller', 'Action'] },
    { title: 'Whisper Creek Massacre', duration: 134, genres: ['Horror'] },

    { title: 'Kingdom of Ember Wings', duration: 156, genres: ['Fantasy', 'Adventure'] },
    { title: 'The Dragon\'s Last Oath', duration: 163, genres: ['Fantasy', 'Action'] },
    { title: 'Starlight Wanderer', duration: 148, genres: ['Fantasy', 'Romance'] },
    { title: 'The Enchanted Forge', duration: 137, genres: ['Fantasy', 'Adventure'] },
    { title: 'Chronicles of Moonhaven', duration: 151, genres: ['Fantasy', 'Drama'] },
    { title: 'The Serpent Crown', duration: 142, genres: ['Fantasy', 'Action'] },
    { title: 'Realm of the Forgotten King', duration: 159, genres: ['Fantasy', 'Adventure'] },
    { title: 'Warden of the Emerald Gate', duration: 144, genres: ['Fantasy', 'Mystery'] },
    { title: 'The Alchemist\'s Apprentice', duration: 131, genres: ['Fantasy', 'Family'] },
    { title: 'Legend of the Crystal Tides', duration: 167, genres: ['Fantasy', 'Adventure'] },

    { title: 'Bongo & The Cloud Kingdom', duration: 96, genres: ['Animation', 'Family'] },
    { title: 'Captain Fluffington Saves the Day', duration: 88, genres: ['Animation', 'Comedy'] },
    { title: 'The Little Star Explorer', duration: 92, genres: ['Animation', 'Adventure'] },
    { title: 'Jungle Jam Band', duration: 85, genres: ['Animation', 'Musical'] },
    { title: 'Robot Rescue Squad', duration: 99, genres: ['Animation', 'Sci-Fi'] },
    { title: 'The Brave Little Kancil', duration: 94, genres: ['Animation', 'Family'] },
    { title: 'Pixel Quest: The Movie', duration: 102, genres: ['Animation', 'Adventure'] },
    { title: 'Ocean Legends: Tide Rising', duration: 108, genres: ['Animation', 'Fantasy'] },
    { title: 'Skyward Dreams', duration: 91, genres: ['Animation', 'Drama'] },
    { title: 'The Secret Garden of Stars', duration: 97, genres: ['Animation', 'Family'] },

    { title: 'Café on the Corner of Hope Street', duration: 115, genres: ['Romance', 'Drama'] },
    { title: 'Falling for the Barista', duration: 108, genres: ['Romance', 'Comedy'] },
    { title: 'Second Chance Summer', duration: 122, genres: ['Romance', 'Drama'] },
    { title: 'The Bookshop Letters', duration: 113, genres: ['Romance'] },
    { title: 'Midnight in Yogyakarta', duration: 127, genres: ['Romance', 'Drama'] },
    { title: 'Love After Rainfall', duration: 119, genres: ['Romance'] },
    { title: 'Tangled Destinies', duration: 131, genres: ['Romance', 'Fantasy'] },
    { title: 'The Art of Letting Go', duration: 116, genres: ['Romance', 'Drama'] },
    { title: 'Parallel Hearts', duration: 124, genres: ['Romance', 'Sci-Fi'] },
    { title: 'Seasons of the Heart', duration: 118, genres: ['Romance', 'Family'] },

    { title: 'The Jakarta Conspiracy', duration: 139, genres: ['Crime', 'Thriller'] },
    { title: 'Inspector Surya\'s Last Case', duration: 132, genres: ['Crime', 'Mystery'] },
    { title: 'Undercover Syndicate', duration: 146, genres: ['Crime', 'Action'] },
    { title: 'The Counterfeit Ring', duration: 128, genres: ['Crime', 'Drama'] },
    { title: 'Shadow Network', duration: 137, genres: ['Crime', 'Thriller'] },
    { title: 'The Missing Heiress', duration: 124, genres: ['Mystery', 'Drama'] },
    { title: 'Double Cross Boulevard', duration: 141, genres: ['Crime', 'Action'] },
    { title: 'Who Killed Professor Eka?', duration: 119, genres: ['Mystery', 'Comedy'] },
    { title: 'The Evidence Locker', duration: 133, genres: ['Crime', 'Thriller'] },
    { title: 'Smoke & Mirrors', duration: 126, genres: ['Mystery', 'Drama'] },

    { title: 'The Battle of Surabaya: Untold', duration: 167, genres: ['War', 'History'] },
    { title: 'Brothers in Arms: 1945', duration: 158, genres: ['War', 'Drama'] },
    { title: 'The Silent Soldier', duration: 146, genres: ['War', 'Biography'] },
    { title: 'Fortress of Defiance', duration: 152, genres: ['War', 'Action'] },
    { title: 'The Diplomat\'s Gambit', duration: 139, genres: ['History', 'Drama'] },
    { title: 'Revolution Day', duration: 161, genres: ['War', 'History'] },
    { title: 'The Last Telegram', duration: 134, genres: ['War', 'Romance'] },
    { title: 'Empire of Dust', duration: 172, genres: ['History', 'Drama'] },
    { title: 'Voices of the Resistance', duration: 148, genres: ['War', 'Drama'] },
    { title: 'The Cartographer\'s Secret', duration: 143, genres: ['History', 'Adventure'] },

    { title: 'Rhythm of the Streets', duration: 118, genres: ['Musical', 'Drama'] },
    { title: 'Harmony in Chaos', duration: 125, genres: ['Musical', 'Romance'] },
    { title: 'The Maestro\'s Final Act', duration: 138, genres: ['Musical', 'Biography'] },
    { title: 'Beats of Jakarta', duration: 112, genres: ['Musical', 'Drama'] },
    { title: 'Stardust & Spotlight', duration: 129, genres: ['Musical', 'Comedy'] },
    { title: 'The Rise of Soekarno', duration: 175, genres: ['Biography', 'History'] },
    { title: 'Canvas & Courage', duration: 131, genres: ['Biography', 'Drama'] },
    { title: 'Voices Unheard', duration: 126, genres: ['Biography', 'Drama'] },
    { title: 'The Pioneer\'s Dream', duration: 142, genres: ['Biography', 'Adventure'] },
    { title: 'Unbreakable Spirit', duration: 136, genres: ['Biography', 'Sport'] },

    { title: 'Goal! The Persija Story', duration: 134, genres: ['Sport', 'Drama'] },
    { title: 'Ring of Champions', duration: 128, genres: ['Sport', 'Action'] },
    { title: 'The Marathon Runner', duration: 121, genres: ['Sport', 'Biography'] },
    { title: 'Badminton Dreams', duration: 117, genres: ['Sport', 'Drama'] },
    { title: 'Wave Riders: Bali', duration: 109, genres: ['Sport', 'Adventure'] },
    { title: 'Showdown at Red Canyon', duration: 126, genres: ['Western', 'Action'] },
    { title: 'The Outlaw\'s Redemption', duration: 138, genres: ['Western', 'Drama'] },
    { title: 'Frontier Justice', duration: 131, genres: ['Western', 'Thriller'] },
    { title: 'Earth Unfiltered', duration: 95, genres: ['Documentary'] },
    { title: 'Voices from the Deep', duration: 102, genres: ['Documentary', 'Adventure'] },
    { title: 'The Hidden Jungle', duration: 88, genres: ['Documentary', 'Family'] },
    { title: 'Street Food Chronicles', duration: 91, genres: ['Documentary'] },
    { title: 'Rise of the Digital Age', duration: 98, genres: ['Documentary', 'Sci-Fi'] },

    { title: 'The Final Countdown', duration: 133, genres: ['Action', 'Sci-Fi'] },
    { title: 'Echoes of Tomorrow', duration: 129, genres: ['Drama', 'Sci-Fi'] },
    { title: 'Starfall Academy', duration: 118, genres: ['Fantasy', 'Adventure'] },
    { title: 'The Perfect Illusion', duration: 122, genres: ['Thriller', 'Mystery'] },
    { title: 'Rogue Element', duration: 136, genres: ['Action', 'Crime'] },
    { title: 'Wanderlust Avenue', duration: 114, genres: ['Comedy', 'Romance'] },
    { title: 'The Ghost Protocol Files', duration: 145, genres: ['Thriller', 'Sci-Fi'] },
];

const DAYS_AHEAD = 14;
const SHOWTIMES_PER_MOVIE_MIN = 3;
const SHOWTIMES_PER_MOVIE_MAX = 8;

const screeningHours = [10, 12, 13, 15, 16, 18, 19, 20, 21, 22];

function generateShowtimesForMovie(movieId) {
    const count = randInt(SHOWTIMES_PER_MOVIE_MIN, SHOWTIMES_PER_MOVIE_MAX);
    const showtimes = [];

    for (let i = 0; i < count; i++) {
        const dayOffset = randInt(0, DAYS_AHEAD - 1);
        const hour = screeningHours[randInt(0, screeningHours.length - 1)];
        const minute = [0, 15, 30, 45][randInt(0, 3)];

        const startTime = new Date();
        startTime.setDate(startTime.getDate() + dayOffset);
        startTime.setHours(hour, minute, 0, 0);

        const totalSeats = [40, 50, 60, 80, 100, 120, 150][randInt(0, 6)];
        const bookedSeats = randInt(0, Math.floor(totalSeats * 0.6));

        showtimes.push({
            movieId,
            startTime,
            theaterRoom: theaterRooms[randInt(0, theaterRooms.length - 1)],
            totalSeats,
            availableSeats: totalSeats - bookedSeats
        });
    }

    return showtimes;
}

async function seed() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('[OK] Connected to MongoDB');

        const deletedMovies = await Movie.deleteMany({});
        const deletedShowtimes = await Showtime.deleteMany({});
        console.log(`[CLEAN] Cleared ${deletedMovies.deletedCount} movies and ${deletedShowtimes.deletedCount} showtimes`);

        const moviesToInsert = movieData.map(m => ({
            title: m.title,
            duration: m.duration,
            genres: m.genres,
            cast: pickRandom(castPool, 2, 5)
        }));

        const insertedMovies = await Movie.insertMany(moviesToInsert);
        console.log(`[INSERT] ${insertedMovies.length} movies added`);

        let allShowtimes = [];
        for (const movie of insertedMovies) {
            const showtimes = generateShowtimesForMovie(movie._id);
            allShowtimes.push(...showtimes);
        }

        const insertedShowtimes = await Showtime.insertMany(allShowtimes);
        console.log(`[INSERT] ${insertedShowtimes.length} showtimes added`);

        console.log('\n+------------------------------------------+');
        console.log('|                                          |');
        console.log('|     TicketIn.db  --  SEEDING COMPLETE     |');
        console.log('|                                          |');
        console.log('+------------------------------------------+');
        console.log(`|  Movies    : ${String(insertedMovies.length).padEnd(27)}|`);
        console.log(`|  Showtimes : ${String(insertedShowtimes.length).padEnd(27)}|`);
        console.log(`|  Database  : ticketin_db${' '.repeat(16)}|`);
        console.log('+------------------------------------------+\n');

    } catch (error) {
        console.error('Seeding failed:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
}

seed();
