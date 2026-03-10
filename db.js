const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'hotel.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to SQLite database.');
        init();
    }
});

function init() {
    db.serialize(() => {
        // Create Users Table
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            phone TEXT,
            avatar TEXT,
            role TEXT DEFAULT 'user',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Create Rooms Table
        db.run(`CREATE TABLE IF NOT EXISTS rooms (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            price INTEGER NOT NULL,
            capacity INTEGER NOT NULL,
            available INTEGER NOT NULL,
            amenities TEXT,
            emoji TEXT,
            badge TEXT,
            description TEXT,
            image TEXT
        )`);

        // Create Bookings Table
        db.run(`CREATE TABLE IF NOT EXISTS bookings (
            id TEXT PRIMARY KEY,
            guest_fname TEXT NOT NULL,
            guest_lname TEXT NOT NULL,
            guest_email TEXT NOT NULL,
            guest_phone TEXT,
            room_id TEXT,
            room_name TEXT,
            checkin TEXT,
            checkout TEXT,
            nights INTEGER,
            total REAL,
            requests TEXT,
            status TEXT DEFAULT 'pending',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(room_id) REFERENCES rooms(id)
        )`);

        // Initial Data for Rooms
        const initialRooms = [
            ['deluxe', 'Deluxe King Room', 8500, 2, 5, 'King Bed,City View,WiFi,Minibar', '🛏️', null, 'Spacious elegance with panoramic city views and artisan furnishings. Our Deluxe King rooms are meticulously designed for the modern traveler, offering a blend of localized art and global comfort.', 'https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=1200&q=80'],
            ['premier', 'Premier Suite', 14000, 3, 3, 'Living Room,Bathtub,Butler,Terrace', '🌇', 'Popular', 'A sanctuary of refined luxury with a private terrace and bespoke service. Enjoy the separate living area and our dedicated 24/7 butler service to cater to your every need.', 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80'],
            ['royal', 'Royal Penthouse', 32000, 4, 1, 'Private Pool,Chef,Panorama,Butler', '✨', 'Exclusive', 'The pinnacle of opulence — a private penthouse with sweeping skyline views. Featuring two bedrooms, a private rooftop pool, and a fully equipped kitchen with a private chef option.', 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80'],
            ['garden', 'Garden Villa', 11000, 2, 4, 'Garden Access,Fireplace,Jacuzzi,Balcony', '🌿', null, 'Serene garden views with a private balcony and soothing natural ambiance. Each villa opens directly into our private gardens, featuring an outdoor fireplace and a private heated jacuzzi.', 'https://images.unsplash.com/photo-1540541338287-41700207dee6?auto=format&fit=crop&w=1200&q=80']
        ];

        const stmt = db.prepare(`INSERT OR IGNORE INTO rooms (id, name, price, capacity, available, amenities, emoji, badge, description, image) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
        initialRooms.forEach(room => stmt.run(room));
        stmt.finalize();

        // Initial User
        db.run(`INSERT OR IGNORE INTO users (email, name, password, phone, role) VALUES ('admin@hotel.com', 'Admin User', 'admin123', '1234567890', 'admin')`);

        // Initial Mock Bookings
        const mockBookings = [
            ['GV-2026-8801', 'John', 'Doe', 'john@example.com', '9876543210', 'premier', 'Premier Suite', '2026-03-12', '2026-03-15', 3, 42000, 'Allergic to feathers', 'confirmed'],
            ['GV-2026-4422', 'Jane', 'Smith', 'jane@test.org', '8887776660', 'royal', 'Royal Penthouse', '2026-04-01', '2026-04-03', 2, 64000, 'Honeymoon stay', 'confirmed'],
            ['GV-2026-1290', 'Mike', 'Wilson', 'mike@domain.com', '7776665554', 'deluxe', 'Deluxe King Room', '2026-03-20', '2026-03-21', 1, 8500, 'Late check-in', 'confirmed']
        ];

        const bookStmt = db.prepare(`INSERT OR IGNORE INTO bookings (id, guest_fname, guest_lname, guest_email, guest_phone, room_id, room_name, checkin, checkout, nights, total, requests, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
        mockBookings.forEach(b => bookStmt.run(b));
        bookStmt.finalize();
    });
}

const dbAsync = {
    all: (query, params = []) => {
        return new Promise((resolve, reject) => {
            db.all(query, params, (err, rows) => {
                if (err) reject(err);
                resolve(rows);
            });
        });
    },
    get: (query, params = []) => {
        return new Promise((resolve, reject) => {
            db.get(query, params, (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });
    },
    run: (query, params = []) => {
        return new Promise((resolve, reject) => {
            db.run(query, params, function (err) {
                if (err) reject(err);
                resolve(this);
            });
        });
    }
};

module.exports = dbAsync;
