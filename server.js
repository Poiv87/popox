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

// Routes
app.get('/', (res, req) => {
    res.redirect('/users')
});
app.get('/register', (req, res) => res.render('register', { error: null }));
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
app.get('/login', (req, res) => res.render('login', { error: null }));
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await User.findByUsername(username);
    if (!user) return res.render('login', { error: 'Invalid credentials' });
    if (!await bcrypt.compare(password, user.password)) return res.render('login', { error: 'Invalid credentials' });
    req.session.userId = user.id;
    req.session.username = user.username;
    res.redirect('/users');
});

app.get('/users', requireAuth, async (req, res) => {

    const q = (req.query.q || '').trim();
    let users;
    if (q) {
        // اگر q داشته باشیم: جست‌وجو در همه کاربران (به جز خود)
        users = await User.search(q, req.session.username);
    } else {
        // در غیر این صورت: فقط شریک‌های گفتگو
        users = await Message.getPartners(req.session.username);
    }
    res.render('users', { users, q });
});



// View profile
app.get('/profile/:username', requireAuth, async (req, res) => {
    const user = await User.findByUsername(req.params.username);
    if (!user) return res.redirect('/users');
    res.render('profile', { user });
});

// Private chat
app.get('/chat/:username', requireAuth, async (req, res) => {
    const other = await User.findByUsername(req.params.username);
    if (!other) return res.redirect('/users');
    const room = [req.session.username, other.username].sort().join('#');
    const history = await Message.getBetween(req.session.username, other.username);
    res.render('chat', { username: req.session.username, other: other.username, room, history, onlineUsers });
});

io.on('connection', socket => {
    const sess = socket.handshake.session;
    if (!sess.userId) return socket.disconnect(true);
    const user = sess.username;

    onlineUsers.add(user);
    socket.join(user);
    io.emit('status', { user, online: true });

    socket.on('join', room => socket.join(room));

    // Private messaging handler
    socket.on('private message', async ({ room, msg, to }) => {
        // پیام را ذخیره کن
        await Message.create({ from: user, to, msg, room });
        // زمان فعلی تهران را به‌دست بیاور
        const tehranTime = new Date().toLocaleTimeString('fa-IR', {
            hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Tehran'
        });
        // payload شامل کاربر، پیام و زمان تهران
        const payload = { user, msg, timestamp: tehranTime };
        io.to(room).emit('chat message', payload);
    });

    socket.on('disconnect', () => {
        onlineUsers.delete(user);
        io.emit('status', { user, online: false });
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
