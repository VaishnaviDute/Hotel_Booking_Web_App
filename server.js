const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const db = require('./db');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(__dirname));

// Auth endpoints
app.post('/api/register', async (req, res) => {
    const { name, email, password, phone } = req.body;
    try {
        await db.run(
            `INSERT INTO users (name, email, password, phone) VALUES (?, ?, ?, ?)`,
            [name, email, password, phone]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(400).json({ error: 'Email already exists' });
    }
});

app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await db.get(`SELECT * FROM users WHERE email = ? AND password = ?`, [email, password]);
        if (user) {
            res.json({
                success: true,
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    phone: user.phone,
                    role: user.role // Return the role to the client
                }
            });
        } else {
            res.status(401).json({ error: 'Invalid credentials' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Room endpoints
app.get('/api/rooms', async (req, res) => {
    try {
        const rooms = await db.all('SELECT * FROM rooms');
        res.json(rooms.map(room => ({
            ...room,
            amenities: room.amenities ? room.amenities.split(',') : []
        })));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Admin Booking list endpoint (all bookings)
app.get('/api/admin/bookings', async (req, res) => {
    try {
        const bookings = await db.all('SELECT * FROM bookings ORDER BY created_at DESC');
        res.json(bookings);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// User-specific bookings
app.get('/api/bookings/:email', async (req, res) => {
    try {
        const bookings = await db.all('SELECT * FROM bookings WHERE guest_email = ? ORDER BY created_at DESC', [req.params.email]);
        res.json(bookings);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Booking endpoint
app.post('/api/bookings', async (req, res) => {
    const { fname, lname, email, phone, roomId, roomName, checkin, checkout, nights, total, requests, paymentMethod } = req.body;

    if (!fname || !lname || !email || !roomId || !checkin || !checkout) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const bookingId = 'GV-' + new Date().getFullYear() + '-' + Math.floor(Math.random() * 9000 + 1000);

    try {
        await db.run(
            `INSERT INTO bookings (id, guest_fname, guest_lname, guest_email, guest_phone, room_id, room_name, checkin, checkout, nights, total, requests, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [bookingId, fname, lname, email, phone, roomId, roomName, checkin, checkout, nights, total, requests, 'confirmed']
        );

        // Update room availability
        await db.run(`UPDATE rooms SET available = available - 1 WHERE id = ? AND available > 0`, [roomId]);

        res.json({ success: true, bookingId, paymentStatus: 'Success via ' + (paymentMethod || 'Card') });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Mock Payment Initiation (e.g., generating Razorpay order)
app.post('/api/payments/initiate', async (req, res) => {
    const { amount, method } = req.body;
    // In a real app, this would call Razorpay/PhonePe API
    res.json({
        success: true,
        order_id: 'ORDER_' + Math.random().toString(36).substring(7).toUpperCase(),
        amount: amount,
        currency: 'INR',
        method: method
    });
});

// AI Concierge Chat endpoint (mock)
app.post('/api/chat', async (req, res) => {
    const { message } = req.body;
    const lowerMsg = message.toLowerCase();

    let response = "I'm sorry, I'm not sure about that. Would you like me to connect you with a human representative?";

    if (lowerMsg.includes('room') || lowerMsg.includes('suite') || lowerMsg.includes('stay')) {
        response = "We offer a variety of luxurious rooms including the Deluxe King Room, the Premier Suite, and our exclusive Royal Penthouse. Each is designed for ultimate comfort and elegance.";
    } else if (lowerMsg.includes('price') || lowerMsg.includes('cost')) {
        response = "Our rates start from ₹8,500/night for our Deluxe King Room up to ₹32,000/night for the Royal Penthouse. You can see the full pricing in our Accommodations section.";
    } else if (lowerMsg.includes('amenit') || lowerMsg.includes('wifi') || lowerMsg.includes('pool')) {
        response = "The Grand Velour offers high-speed WiFi, a rooftop infinity pool, a state-of-the-art spa, and 24/7 dedicated butler service for our premium suites.";
    } else if (lowerMsg.includes('hello') || lowerMsg.includes('hi')) {
        response = "Greetings from The Grand Velour! I'm your AI Concierge. How can I help make your stay extraordinary today?";
    } else if (lowerMsg.includes('restaurant') || lowerMsg.includes('food') || lowerMsg.includes('dining')) {
        response = "We feature three world-class dining venues: 'L'Horizon' for French fine dining, 'The Gilded Age' bar for classic cocktails, and our 'Sky Terrace' for casual alfresco meals.";
    }

    // Simulate thinking delay
    setTimeout(() => {
        res.json({ response });
    }, 800);
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
