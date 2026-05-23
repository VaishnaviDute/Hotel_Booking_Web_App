require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const stringSimilarity = require('string-similarity');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const db = require('./db');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 5000;

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

// Admin User list endpoint
app.get('/api/admin/users', async (req, res) => {
    try {
        const users = await db.all('SELECT id, name, email, phone, role, created_at FROM users ORDER BY created_at DESC');
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Admin Delete User endpoint
app.delete('/api/admin/users/:id', async (req, res) => {
    try {
        await db.run('DELETE FROM users WHERE id = ?', [req.params.id]);
        res.json({ success: true });
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

// AI Concierge Chat endpoint
app.post('/api/chat', async (req, res) => {
    const { message } = req.body;
    
    // Check if Gemini API key exists
    if (process.env.GEMINI_API_KEY) {
        try {
            const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
            
            const prompt = `You are the AI Concierge for a luxury hotel named 'The Grand Velour'. 
            Your name is 'Grand Concierge'. 
            Be polite, helpful, and professional. Keep your answers concise (1-3 sentences) and strictly related to the hotel, booking, rooms, amenities, pricing, check-in/out policies, and dining. If the guest asks something completely unrelated to hotels or this hotel, politely refuse to answer and redirect them to hotel topics.
            
            Hotel details:
            - Rooms: Deluxe King (₹8,500), Garden Villa (₹11,000), Premier Suite (₹14,000), Royal Penthouse (₹32,000).
            - Amenities: Free WiFi, rooftop infinity pool, state-of-the-art spa, 24/7 butler service.
            - Dining: L'Horizon (French), Sky Terrace (casual), The Gilded Age (bar).
            - Policies: Check-in 3:00 PM, Check-out 11:00 AM. Free cancellation up to 48 hours.
            - Payment: PhonePe, Razorpay, UPI, Card.
            
            Guest says: "${message}"`;

            const result = await model.generateContent(prompt);
            const response = result.response.text();
            
            return res.json({ response });
        } catch (error) {
            console.error("Gemini API Error:", error);
            // Fallthrough to the fallback hardcoded logic on error
        }
    }

    // --- FALLBACK LOGIC IF NO API KEY OR API FAILS ---
    const intents = [
        {
            match: ["hi", "hello", "hey", "greetings", "howdy", "good morning", "good evening", "good afternoon", "who are you"],
            answer: "Greetings from The Grand Velour! I'm your AI Concierge. I am trained to assist you with room bookings, prices, and questions about our luxury amenities. How can I help you today?"
        },
        {
            match: ["room", "suite", "stay", "bed", "capacity", "how many people", "types of rooms", "what rooms do you have"],
            answer: "We offer a curated selection of stunning suites: the Deluxe King Room, the Premier Suite, the Royal Penthouse, and the Garden Villa. They are perfect for 1 to 4 guests depending on your choice."
        },
        {
            match: ["price", "cost", "rate", "fee", "cheap", "expensive", "how much", "tariff", "charges"],
            answer: "Our luxurious stays start at ₹8,500/night for the Deluxe King Room, ₹11,000 for the Garden Villa, ₹14,000 for the Premier Suite, and up to ₹32,000 for the Royal Penthouse. Taxes and service fees will apply at checkout."
        },
        {
            match: ["amenity", "amenities", "pool", "wifi", "internet", "spa", "butler", "gym", "fitness", "facilities", "what do you offer"],
            answer: "The Grand Velour offers premium amenities including complimentary high-speed WiFi, a rooftop infinity pool, a state-of-the-art spa, and 24/7 dedicated butler service for our elite suites."
        },
        {
            match: ["restaurant", "food", "dining", "breakfast", "dinner", "lunch", "bar", "drinks", "menu", "eat"],
            answer: "We feature exceptional dining experiences: 'L'Horizon' for fine French cuisine, 'Sky Terrace' for casual dining, and 'The Gilded Age' for classic signature cocktails. Room service is also available 24/7."
        },
        {
            match: ["check in", "check out", "time", "policy", "cancel", "cancellation", "refund", "what time", "when can i arrive"],
            answer: "Standard check-in time is at 3:00 PM, and check-out is by 11:00 AM. We also offer free cancellation up to 48 hours before your scheduled arrival date."
        },
        {
            match: ["book", "reserve", "payment", "pay", "card", "upi", "razorpay", "phonepe", "how to book"],
            answer: "To reserve a room, please browse our 'Accommodations' section on the homepage, select your room, create an account, and proceed through our secure checkout. We accept PhonePe, Razorpay, UPI, and major Cards."
        },
        {
            match: ["location", "where", "address", "city", "near", "how to reach", "directions"],
            answer: "The Grand Velour is centrally located in the heart of the city, offering panoramic skyline views and easy access to top tourist attractions. We can also arrange airport transfers for you upon request!"
        },
        {
            match: ["admin", "dashboard", "delete", "login", "register", "account", "sign in", "sign up"],
            answer: "To manage your bookings or access the admin dashboard, please log in using the 'Log In' button located in the top navigation bar."
        },
        {
            match: ["thank you", "thanks", "appreciate it", "great", "ok", "okay"],
            answer: "You are very welcome! If you need anything else, just ask. Have a wonderful day!"
        }
    ];

    // Default response
    let response = "I am a dedicated hotel concierge. I can only assist you with inquiries related to room bookings, amenities, pricing, check-in/out policies, and our hotel services. Could you please rephrase your question regarding your stay?";

    const lowerMsg = message.toLowerCase().trim();
    if (lowerMsg) {
        let bestMatchScore = 0;
        let bestAnswer = response;

        intents.forEach(intent => {
            const matchResult = stringSimilarity.findBestMatch(lowerMsg, intent.match);
            
            // Check best match rating. Threshold of 0.35 works decently for short phrases
            // Also boost score if the message contains the exact word
            let score = matchResult.bestMatch.rating;
            
            intent.match.forEach(phrase => {
                if (lowerMsg.includes(phrase)) {
                    score += 0.4; // Boost for exact substring match
                }
            });

            if (score > bestMatchScore && score > 0.35) {
                bestMatchScore = score;
                bestAnswer = intent.answer;
            }
        });

        response = bestAnswer;
    }

    // Simulate thinking delay
    setTimeout(() => {
        res.json({ response });
    }, 600);
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
