// ══════════════════════════════════════════════════
// STATE & CONFIG
// ══════════════════════════════════════════════════
let ROOMS = [];
let selectedRoom = null;
let currentStep = 1;
let bookingData = {};
let currentUser = null;
let selectedPaymentMethod = 'phonepe';

const API_BASE = '/api';

// ══════════════════════════════════════════════════
// AUTH HANDLERS
// ══════════════════════════════════════════════════
function switchAuth(type) {
    document.getElementById('tab-login').classList.toggle('active', type === 'login');
    document.getElementById('tab-register').classList.toggle('active', type === 'register');
    document.getElementById('loginForm').classList.toggle('active', type === 'login');
    document.getElementById('registerForm').classList.toggle('active', type === 'register');
}

function openAuthModal(type = 'login') {
    switchAuth(type);
    document.getElementById('authModal').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeAuthModal() {
    document.getElementById('authModal').classList.remove('active');
    document.body.style.overflow = 'auto';
}

async function handleLogin() {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPass').value;
    if (!email || !password) return showToast('Please enter credentials', true);

    try {
        const res = await fetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (data.success) {
            onAuthSuccess(data.user);
            showToast('Welcome to The Grand Velour!');
            await fetchRooms();
        } else {
            showToast(data.error, true);
        }
    } catch (err) {
        showToast('Authentication failed', true);
    }
}

function onAuthSuccess(user) {
    currentUser = user;
    localStorage.setItem('currentUser', JSON.stringify(user));
    closeAuthModal();

    // Update Header
    document.getElementById('userName').textContent = `Welcome, ${currentUser.name.split(' ')[0]}`;
    document.getElementById('logoutBtn').style.display = 'inline-block';

    // Pre-fill form fields
    document.getElementById('fname').value = currentUser.name.split(' ')[0];
    const lastName = currentUser.name.split(' ').slice(1).join(' ');
    if (document.getElementById('lname')) document.getElementById('lname').value = lastName;
    if (document.getElementById('email')) document.getElementById('email').value = currentUser.email;
    if (document.getElementById('phone')) document.getElementById('phone').value = currentUser.phone || '';

    // Update Room Modal UI if open
    const notice = document.getElementById('modalAuthNotice');
    const actionBtn = document.getElementById('modalActionBtn');
    if (notice) notice.style.display = 'none';
    if (actionBtn) actionBtn.style.display = 'block';

    // Update Admin UI if relevant
    const adminLogin = document.getElementById('adminLogin');
    const adminContent = document.getElementById('adminContent');
    const navAdmin = document.getElementById('nav-admin');
    const navRecent = document.getElementById('nav-recent');

    if (currentUser.role === 'admin') {
        if (adminLogin) adminLogin.style.display = 'none';
        if (adminContent) adminContent.style.display = 'block';
        if (navAdmin) navAdmin.style.display = 'inline-block';
        if (navRecent) navRecent.style.display = 'inline-block';
        renderAdmin();
    } else {
        if (navAdmin) navAdmin.style.display = 'none';
        if (navRecent) navRecent.style.display = 'inline-block';
    }
    refreshAuthNotices();
}

function handleLogout() {
    currentUser = null;
    localStorage.removeItem('currentUser');
    document.getElementById('userName').textContent = '';
    document.getElementById('logoutBtn').style.display = 'none';

    // Hide role-specific links
    const navAdmin = document.getElementById('nav-admin');
    const navRecent = document.getElementById('nav-recent');
    if (navAdmin) navAdmin.style.display = 'none';
    if (navRecent) navRecent.style.display = 'none';

    // Reset specific forms
    if (document.getElementById('adminLogin')) document.getElementById('adminLogin').style.display = 'block';
    if (document.getElementById('adminContent')) document.getElementById('adminContent').style.display = 'none';

    refreshAuthNotices();
    showToast('Logged out successfully');
}

async function handleAdminLogin() {
    const email = document.getElementById('adminEmail').value;
    const password = document.getElementById('adminPass').value;
    if (!email || !password) return showToast('Please enter credentials', true);

    try {
        const res = await fetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (data.success) {
            if (data.user.role === 'admin') {
                onAuthSuccess(data.user);
                showToast('Admin access granted');
            } else {
                showToast('Unauthorized: Admin role required', true);
            }
        } else {
            showToast('Access Denied', true);
        }
    } catch (err) {
        showToast('Authentication failed', true);
    }
}

async function handleRegister() {
    const name = document.getElementById('regName').value;
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPass').value;
    if (!name || !email || !password) return showToast('All fields required', true);

    try {
        const res = await fetch(`${API_BASE}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password })
        });
        const data = await res.json();
        if (data.success) {
            showToast('Account registered! You can now log in.');
            switchAuth('login');
        } else {
            showToast(data.error, true);
        }
    } catch (err) {
        showToast('Registration failed', true);
    }
}

// ══════════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════════
window.addEventListener('DOMContentLoaded', () => {
    initTheme();

    // Restore session
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        onAuthSuccess(JSON.parse(savedUser));
    }

    setDefaultDates();
    bindSummaryUpdates();
    fetchRooms(); // Fetch rooms on load
    refreshAuthNotices();
});

function refreshAuthNotices() {
    const modalNotice = document.getElementById('modalAuthNotice');
    const bookingNotice = document.getElementById('bookingAuthNotice');
    const actionBtn = document.getElementById('modalActionBtn');

    const htmlGuest = `
        <p style="font-size:12px; color:var(--text); margin-bottom:10px;">Please login or register to book your room</p>
        <div style="display:flex; gap:10px; justify-content:center;">
          <button class="btn btn-gold" style="padding:6px 12px; font-size:11px;" onclick="openAuthModal('login')">Login</button>
          <button class="btn btn-outline" style="padding:6px 12px; font-size:11px;" onclick="openAuthModal('register')">Register</button>
        </div>
    `;

    const htmlUser = `
        <p style="font-size:12px; color:var(--text); margin-bottom:10px;">Signed in as <b>${currentUser ? currentUser.name : ''}</b></p>
        <div style="display:flex; gap:10px; justify-content:center;">
            <button class="btn btn-outline" style="padding:4px 10px; font-size:10px; opacity:0.7;" onclick="handleLogout()">Switch Account / Logout</button>
        </div>
    `;

    if (!currentUser) {
        if (modalNotice) { modalNotice.innerHTML = htmlGuest; modalNotice.style.background = 'rgba(201,169,110,0.1)'; }
        if (bookingNotice) { bookingNotice.innerHTML = htmlGuest; bookingNotice.style.background = 'rgba(201,169,110,0.1)'; }
        if (actionBtn) {
            actionBtn.style.opacity = '1';
            actionBtn.style.pointerEvents = 'all';
            actionBtn.textContent = 'Login to Reserve';
        }
    } else {
        if (modalNotice) { modalNotice.innerHTML = htmlUser; modalNotice.style.background = 'rgba(76,175,125,0.05)'; }
        if (bookingNotice) { bookingNotice.innerHTML = htmlUser; bookingNotice.style.background = 'rgba(76,175,125,0.05)'; }
        if (actionBtn) {
            actionBtn.style.opacity = '1';
            actionBtn.style.pointerEvents = 'all';
            actionBtn.textContent = 'Proceed to Details →';
        }
    }
}

function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    if (savedTheme === 'light') {
        document.body.classList.add('light-mode');
        document.getElementById('themeIcon').textContent = '☀️';
    } else {
        document.getElementById('themeIcon').textContent = '🌙';
    }
}

function toggleTheme() {
    const isLight = document.body.classList.toggle('light-mode');
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
    document.getElementById('themeIcon').textContent = isLight ? '☀️' : '🌙';
    showToast(`${isLight ? 'Light' : 'Dark'} mode activated`);
}

async function fetchRooms() {
    try {
        const res = await fetch(`${API_BASE}/rooms`);
        ROOMS = await res.json();
        renderRooms();
        populateRoomSelect();
        renderAdmin(); // Initial admin render
    } catch (err) {
        console.error('Fetch error:', err);
    }
}

function setDefaultDates() {
    const today = new Date();
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfter = new Date(today); dayAfter.setDate(dayAfter.getDate() + 3);
    const fmt = d => d.toISOString().split('T')[0];

    document.getElementById('checkin').value = fmt(tomorrow);
    document.getElementById('checkout').value = fmt(dayAfter);
    document.getElementById('m-checkin').value = fmt(tomorrow);
    document.getElementById('m-checkout').value = fmt(dayAfter);
    updateSummary();
}

// ══════════════════════════════════════════════════
// ROOM RENDERING & MODAL
// ══════════════════════════════════════════════════
function renderRooms() {
    const grid = document.getElementById('roomsGrid');
    grid.innerHTML = ROOMS.map(r => `
    <article class="room-card" id="rcard-${r.id}" onclick="openRoomDetails('${r.id}')">
      <div class="room-badge">${r.badge ? r.badge : 'Available'}</div>
      <div class="room-img">
        <img src="${r.image}" alt="${r.name}" loading="lazy"/>
        <div class="room-img-overlay"></div>
      </div>
      <div class="room-body">
        <h3 class="room-name">${r.name}</h3>
        <p class="room-desc">${r.description.substring(0, 85)}...</p>
        <div class="room-amenities">
          ${r.amenities.slice(0, 3).map(a => `<span class="amenity">${a}</span>`).join('')}
        </div>
        <div class="room-footer">
          <div class="room-price">
            <span class="amt">₹${r.price.toLocaleString()}</span>
            <span class="per"> / night</span>
          </div>
          <button class="btn btn-outline" style="padding: 8px 16px; font-size: 11px;">View Details</button>
        </div>
      </div>
    </article>
  `).join('');
}

function openRoomDetails(id) {
    selectedRoom = ROOMS.find(r => r.id === id);
    const modal = document.getElementById('roomModal');
    const info = document.getElementById('modalInfo');

    info.innerHTML = `
        <img src="${selectedRoom.image}" class="modal-img" alt="${selectedRoom.name}"/>
        <div class="sec-label">Suite ID: ${selectedRoom.id.toUpperCase()}</div>
        <h2 class="sec-title" style="margin-bottom:12px;">${selectedRoom.name}</h2>
        <div style="display:flex; gap:16px; margin-bottom:24px; font-size:14px; color:var(--silver);">
            <span>👤 Up to ${selectedRoom.capacity} Guests</span>
            <span>📐 450 sq ft</span>
            <span>📍 Garden View</span>
        </div>
        <p style="color:var(--text); line-height:1.8; margin-bottom:32px; font-size:15px; opacity:0.9;">${selectedRoom.description}</p>
        <h4 style="font-family:'Playfair Display',serif; color:var(--gold); margin-bottom:16px;">Premium Amenities</h4>
        <div class="room-amenities" style="gap:12px; margin-bottom:8px;">
            ${selectedRoom.amenities.map(a => `<span class="amenity" style="font-size:12px; padding:6px 16px; border-color:rgba(201,169,110,0.3); color:var(--text);">${a}</span>`).join('')}
        </div>
    `;

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    refreshAuthNotices();
}

function closeRoomModal() {
    document.getElementById('roomModal').classList.remove('active');
    document.body.style.overflow = 'auto';
}

function syncModalDates(type) {
    document.getElementById(type).value = document.getElementById('m-' + type).value;
    updateSummary();
}

function syncModalGuests() {
    document.getElementById('guests').value = document.getElementById('m-guests').value;
    updateSummary();
}

function scrollToBookingFromModal() {
    if (!currentUser) {
        showToast('Please login or register to reserve a room', true);
        openAuthModal('login');
        return;
    }

    // Select the current room in the main dropdown
    document.getElementById('roomSelect').value = selectedRoom.id;

    // Update highlights
    document.querySelectorAll('.room-card').forEach(c => c.classList.remove('selected'));
    document.getElementById('rcard-' + selectedRoom.id)?.classList.add('selected');

    updateSummary();
    closeRoomModal();

    // Smooth scroll to the booking section
    document.getElementById('booking').scrollIntoView({ behavior: 'smooth' });
}

function populateRoomSelect() {
    const sel = document.getElementById('roomSelect');
    sel.innerHTML = '<option value="">— Select Your Suite —</option>';
    ROOMS.forEach(r => {
        const o = document.createElement('option');
        o.value = r.id; o.textContent = `${r.name} — ₹${r.price.toLocaleString()}/night`;
        sel.appendChild(o);
    });
    sel.addEventListener('change', () => {
        selectedRoom = ROOMS.find(r => r.id === sel.value) || null;
        document.querySelectorAll('.room-card').forEach(c => c.classList.remove('selected'));
        if (selectedRoom) document.getElementById('rcard-' + selectedRoom.id)?.classList.add('selected');
        updateSummary();
    });
}

// ══════════════════════════════════════════════════
// SUMMARY & CALCULATIONS
// ══════════════════════════════════════════════════
function bindSummaryUpdates() {
    ['checkin', 'checkout', 'guests', 'roomSelect'].forEach(id => {
        document.getElementById(id).addEventListener('change', updateSummary);
    });
}

function updateSummary() {
    const ci = document.getElementById('checkin').value;
    const co = document.getElementById('checkout').value;
    const gs = document.getElementById('guests').value;

    document.getElementById('sumCheckin').textContent = ci || '—';
    document.getElementById('sumCheckout').textContent = co || '—';
    document.getElementById('sumGuests').textContent = gs;
    document.getElementById('sumRoom').textContent = selectedRoom ? selectedRoom.name : '—';

    let nights = 0;
    if (ci && co) {
        const d1 = new Date(ci); const d2 = new Date(co);
        nights = Math.ceil((d2 - d1) / (1000 * 60 * 60 * 24));
    }
    nights = nights > 0 ? nights : 0;
    document.getElementById('sumNights').textContent = nights || '—';

    if (selectedRoom && nights > 0) {
        const base = selectedRoom.price * nights;
        const tax = base * 0.18;
        const service = 500;
        const total = base + tax + service;

        document.getElementById('sumBase').textContent = `₹${base.toLocaleString()}`;
        document.getElementById('sumTax').textContent = `₹${tax.toLocaleString()}`;
        document.getElementById('sumService').textContent = `₹${service.toLocaleString()}`;
        document.getElementById('sumTotal').textContent = `₹${total.toLocaleString()}`;

        bookingData.nights = nights;
        bookingData.total = total;
        bookingData.roomName = selectedRoom.name;
        bookingData.roomId = selectedRoom.id;
    } else {
        ['sumBase', 'sumTax', 'sumService'].forEach(id => document.getElementById(id).textContent = '—');
        document.getElementById('sumTotal').textContent = '₹0';
    }
}

// ══════════════════════════════════════════════════
// NAVIGATION & VALIDATION
// ══════════════════════════════════════════════════
function goStep(n) {
    if (n > currentStep) {
        // Enforce login for proceeding beyond Step 1
        if (!currentUser && n > 1) {
            showToast('Please login or register to continue with your booking', true);
            openAuthModal('login');
            return;
        }

        if (!validateStep(currentStep)) return;
    }
    currentStep = n;
    document.querySelectorAll('.form-panel').forEach(p => p.classList.remove('active'));
    document.getElementById(`panel${n}`).classList.add('active');

    document.querySelectorAll('.step').forEach((s, idx) => {
        s.classList.toggle('active', idx + 1 === n);
        s.classList.toggle('done', idx + 1 < n);
    });

    if (n === 3) renderReview();
}

function validateStep(n) {
    let ok = true;
    const err = (id, msg) => {
        const el = document.getElementById('err-' + id);
        if (el) el.textContent = msg;
        ok = false;
    };
    document.querySelectorAll('.field-error').forEach(e => e.textContent = '');

    if (n === 1) {
        if (!document.getElementById('checkin').value) err('checkin', 'Required');
        if (!document.getElementById('checkout').value) err('checkout', 'Required');
        if (!selectedRoom) err('room', 'Please select a room');
        const d1 = new Date(document.getElementById('checkin').value);
        const d2 = new Date(document.getElementById('checkout').value);
        if (d2 <= d1) err('checkout', 'Must be after check-in');
    }
    if (n === 2) {
        if (!document.getElementById('fname').value) err('fname', 'Required');
        if (!document.getElementById('lname').value) err('lname', 'Required');
        if (!document.getElementById('email').value.includes('@')) err('email', 'Invalid email');
    }
    return ok;
}

function renderReview() {
    const ci = document.getElementById('checkin').value;
    const co = document.getElementById('checkout').value;
    const details = `
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:24px; font-size:14px; line-height:1.6;">
      <div>
        <div style="color:var(--muted); font-size:10px; text-transform:uppercase;">Guest Name</div>
        <strong>${document.getElementById('fname').value} ${document.getElementById('lname').value}</strong>
      </div>
      <div>
        <div style="color:var(--muted); font-size:10px; text-transform:uppercase;">Selected Suite</div>
        <strong>${selectedRoom.name}</strong>
      </div>
      <div>
        <div style="color:var(--muted); font-size:10px; text-transform:uppercase;">Travel Dates</div>
        <strong>${ci} to ${co}</strong>
      </div>
      <div>
        <div style="color:var(--muted); font-size:10px; text-transform:uppercase;">Total Payment</div>
        <strong style="color:var(--gold); font-size:18px;">${document.getElementById('sumTotal').textContent}</strong>
      </div>
    </div>
    `;
    document.getElementById('reviewBox').innerHTML = details;
}

// ══════════════════════════════════════════════════
// PAYMENTS & SUBMISSION
// ══════════════════════════════════════════════════
function selectPay(method) {
    selectedPaymentMethod = method;
    document.querySelectorAll('.payment-opt').forEach(opt => {
        const inp = opt.querySelector('input');
        const isSel = inp.value === method;
        opt.classList.toggle('selected', isSel);
        if (isSel) inp.checked = true;
    });

    document.getElementById('cardDetails').style.display = method === 'card' ? 'grid' : 'none';
    document.getElementById('upiDetails').style.display = method === 'upi' ? 'grid' : 'none';
}

async function submitBooking() {
    if (!currentUser) {
        showToast('Please login to complete your booking', true);
        openAuthModal('login');
        return;
    }

    if (selectedPaymentMethod === 'card' && !document.getElementById('cardnum').value) {
        document.getElementById('err-card').textContent = 'Please enter your card number';
        return;
    }
    if (selectedPaymentMethod === 'upi' && !document.getElementById('upiId').value) {
        showToast('Please enter your UPI ID', true);
        return;
    }

    const btn = document.getElementById('confirmBtn');
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span> Processing ${selectedPaymentMethod.toUpperCase()}...`;

    // Simulate Payment Gateway Interaction
    try {
        const payInit = await fetch(`${API_BASE}/payments/initiate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount: bookingData.total, method: selectedPaymentMethod })
        });

        await new Promise(r => setTimeout(r, 1800)); // Simulate gateway delay

        const payload = {
            fname: document.getElementById('fname').value,
            lname: document.getElementById('lname').value,
            email: document.getElementById('email').value,
            phone: document.getElementById('phone').value,
            roomId: selectedRoom.id,
            roomName: selectedRoom.name,
            checkin: document.getElementById('checkin').value,
            checkout: document.getElementById('checkout').value,
            nights: bookingData.nights,
            total: bookingData.total,
            requests: document.getElementById('requests').value,
            paymentMethod: selectedPaymentMethod
        };

        const res = await fetch(`${API_BASE}/bookings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (data.success) {
            document.getElementById('confirmDetails').innerHTML = `
                <div style="font-size:11px; color:var(--muted); text-transform:uppercase; margin-bottom:4px;">Reservation ID</div>
                <div class="booking-id" style="font-size:24px; color:var(--gold); font-family:'Playfair Display';">${data.bookingId}</div>
                <div style="margin-top:16px; font-size:13px; color:var(--silver);">
                    <div style="margin-bottom:8px;">✅ Payment Successful via <b>${selectedPaymentMethod.toUpperCase()}</b></div>
                    A confirmation packet has been sent to <b>${payload.email}</b>. Please show this ID at reception during check-in.
                </div>
            `;
            goStep(4);
            showToast('Reservation Successful!');
            renderAdmin();
        } else {
            throw new Error(data.error);
        }
    } catch (err) {
        showToast('Payment processing failed. Please try again.', true);
        btn.disabled = false;
        btn.textContent = 'Confirm & Pay';
    }
}

function resetForm() {
    window.location.hash = '#rooms';
    setTimeout(() => window.location.reload(), 500);
}

// ══════════════════════════════════════════════════
// ADMIN DASHBOARD & CONCIERGE
// ══════════════════════════════════════════════════
async function renderAdmin() {
    try {
        const res = await fetch(`${API_BASE}/admin/bookings`);
        const bookings = await res.json();

        const revenue = bookings.reduce((sum, b) => sum + b.total, 0);
        const stats = [
            { label: 'Estimated Revenue', val: `₹${Math.round(revenue).toLocaleString()}`, icon: '💰' },
            { label: 'Active Reservations', val: bookings.length, icon: '🛎️' },
            { label: 'Avg Reservation', val: `₹${bookings.length ? Math.round(revenue / bookings.length).toLocaleString() : 0}`, icon: '📈' },
            { label: 'System Status', val: 'Operational', icon: '🛡️' }
        ];

        document.getElementById('statsGrid').innerHTML = stats.map(s => `
            <div class="stat-card">
                <div class="stat-num"><span style="font-size: 24px; opacity: 0.8;">${s.icon}</span> ${s.val}</div>
                <div class="stat-label">${s.label}</div>
            </div>
        `).join('');

        document.getElementById('bookingsBody').innerHTML = bookings.map(b => `
            <tr>
                <td style="color:var(--gold); font-family:'Playfair Display';">${b.id}</td>
                <td>${b.guest_fname} ${b.guest_lname}</td>
                <td>${b.room_name}</td>
                <td>${new Date(b.checkin).toDateString()}</td>
                <td>${b.nights}</td>
                <td>₹${Math.round(b.total).toLocaleString()}</td>
                <td><span class="status-badge ${b.status}">${b.status}</span></td>
            </tr>
        `).join('');
    } catch (e) {
        console.error('Admin Fetch Fail');
    }
}

async function sendChat() {
    const inp = document.getElementById('chatInput');
    const msg = inp.value.trim();
    if (!msg) return;

    appendMsg(msg, 'user');
    inp.value = '';

    const area = document.getElementById('chatArea');
    const typing = document.createElement('div');
    typing.className = 'msg ai';
    typing.innerHTML = `<div class="msg-avatar">✦</div><div class="msg-bubble typing"><span></span><span></span><span></span></div>`;
    area.appendChild(typing);
    area.scrollTop = area.scrollHeight;

    try {
        const res = await fetch(`${API_BASE}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: msg })
        });
        const data = await res.json();
        typing.remove();
        appendMsg(data.response, 'ai');
    } catch (e) {
        typing.remove();
        appendMsg("The concierge is currently attending to another guest. Details: " + e.message, 'ai');
    }
}

function appendMsg(text, side) {
    const area = document.getElementById('chatArea');
    const div = document.createElement('div');
    div.className = `msg ${side}`;
    div.innerHTML = `
        <div class="msg-avatar">${side === 'ai' ? '✦' : '👤'}</div>
        <div class="msg-bubble">${text}</div>
    `;
    area.appendChild(div);
    area.scrollTop = area.scrollHeight;
}

// ══════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════
function formatCard(el) {
    let v = el.value.replace(/\D/g, '').substring(0, 16);
    el.value = v.replace(/(\d{4})(?=\d)/g, '$1 ');
}

function showToast(msg, isError = false) {
    const t = document.getElementById('toast');
    document.getElementById('toastMsg').textContent = msg;
    document.getElementById('toastDot').className = `toast-dot ${isError ? 'error' : ''}`;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3500);
}