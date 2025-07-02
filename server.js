const express = require('express');
const http = require('http');
const path = require('path');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const { Server } = require('socket.io');
const sharedsession = require('express-socket.io-session');
const bcrypt = require('bcrypt');
const db = require('./db');
const User = require('./models/user');
const Message = require('./models/message');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Track online users
const onlineUsers = new Set();

// Session middleware
const sessionMiddleware = session({
    store: new SQLiteStore({ db: 'sessions.sqlite' }),
    secret: 'replace_with_your_secret',
    resave: false,
    saveUninitialized: false
});

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(sessionMiddleware);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
io.use(sharedsession(sessionMiddleware, { autoSave: true }));

function requireAuth(req, res, next) {
    if (req.session.userId) return next();
    res.redirect('/login');
}

// Redirect root to users list
app.get('/', (req, res) => {
    res.redirect('/users');
});

// Registration routes
app.get('/register', (req, res) => {
    res.render('register', { error: null });
});
app.post('/register', async (req, res) => {
    try {
        const { username, password, bio } = req.body;
        const hash = await bcrypt.hash(password, 10);
        await User.create({ username, password: hash, bio });
        res.redirect('/login');
    } catch (e) {
        res.render('register', { error: 'Username taken' });
    }
});

// Login routes
app.get('/login', (req, res) => {
    res.render('login', { error: null });
});
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await User.findByUsername(username);
    if (!user) return res.render('login', { error: 'Invalid credentials' });
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.render('login', { error: 'Invalid credentials' });
    req.session.userId = user.id;
    req.session.username = user.username;
    res.redirect('/users');
});

// Happy Birthday page
app.get('/happybirthday', requireAuth, (req, res) => {
    res.render('happy');
});

// Users list and search
app.get('/users', requireAuth, async (req, res) => {
    const q = (req.query.q || '').trim();
    let users;
    if (q) {
        users = await User.search(q, req.session.username);
    } else {
        users = await Message.getPartners(req.session.username);
    }
    res.render('users', { users, q });
});

// Profile view
app.get('/profile/:username', requireAuth, async (req, res) => {
    const user = await User.findByUsername(req.params.username);
    if (!user) return res.redirect('/users');
    res.render('profile', { user });
});

// Chat
app.get('/chat/:username', requireAuth, async (req, res) => {
    const other = await User.findByUsername(req.params.username);
    if (!other) return res.redirect('/users');
    const room = [req.session.username, other.username].sort().join('#');
    const history = await Message.getBetween(req.session.username, other.username);
    res.render('chat', {
        username: req.session.username,
        other: other.username,
        room,
        history,
        onlineUsers
    });
});

// Socket.io
io.on('connection', socket => {
    const sess = socket.handshake.session;
    if (!sess.userId) return socket.disconnect(true);
    const user = sess.username;

    onlineUsers.add(user);
    socket.join(user);
    io.emit('status', { user, online: true });

    socket.on('join', room => socket.join(room));

    socket.on('private message', async ({ room, msg, to }) => {
        await Message.create({ from: user, to, msg, room });
        const tehranTime = new Date().toLocaleTimeString('fa-IR', {
            hour: '2-digit', minute: '2-digit', hour12: false,
            timeZone: 'Asia/Tehran'
        });
        const payload = { user, msg, timestamp: tehranTime };
        io.to(room).emit('chat message', payload);
    });

    socket.on('disconnect', () => {
        onlineUsers.delete(user);
        io.emit('status', { user, online: false });
    });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));