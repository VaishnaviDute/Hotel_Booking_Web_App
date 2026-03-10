const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, 'hotel.db');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) return console.error(err);
    db.serialize(() => {
        db.run(`DROP TABLE IF EXISTS rooms`);
        db.run(`DROP TABLE IF EXISTS bookings`);
        db.run(`DROP TABLE IF EXISTS users`);
        console.log('Tables dropped successfully.');
    });
    db.close();
});
