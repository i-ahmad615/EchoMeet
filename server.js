// ============================================
// ECHO MEET - MAIN SERVER (UPDATED)
// ============================================

require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const aiRoutes = require('./routes/ai');
const socketHandler = require('./socket/socket-handler');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

let db;

async function initDatabase() {
    const dbPath = path.join(__dirname, 'echomeet.db');
    db = await open({
        filename: dbPath,
        driver: sqlite3.Database
    });
    
    await db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE,
            email TEXT UNIQUE,
            password TEXT,
            peerId TEXT,
            avatar TEXT,
            bio TEXT,
            online INTEGER DEFAULT 0,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    // friends: one row per directed edge (unique userId+friendId).
    // pending: userId sent request to friendId (recipient sees incoming; sender sees outgoing).
    // accepted: accept upgrades A→B pending to accepted and inserts reciprocal B→A accepted so both see friendship.
    await db.exec(`
        CREATE TABLE IF NOT EXISTS friends (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            userId TEXT,
            friendId TEXT,
            status TEXT DEFAULT 'pending',
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    try {
        await db.exec(`
            CREATE UNIQUE INDEX IF NOT EXISTS idx_friends_user_friend ON friends(userId, friendId)
        `);
    } catch (e) {
        console.warn('Friends unique index skipped:', e.message);
    }
    
    await db.exec(`
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            fromId TEXT,
            toId TEXT,
            content TEXT,
            type TEXT DEFAULT 'text',
            read INTEGER DEFAULT 0,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    console.log('✅ SQLite Database initialized');
    
    const userCount = await db.get('SELECT COUNT(*) as count FROM users');
    if (Number(userCount.count) === 0) {
        await db.run(`
            INSERT INTO users (id, username, email, password, peerId, online) VALUES 
            ('1', 'waqas', 'waqas@echo.com', 'waqas123', 'peer_waqas_001', 1),
            ('2', 'abdullah', 'abdullah@echo.com', 'abdullah123', 'peer_abdullah_002', 1)
        `);
        console.log('✅ Demo users created');
    }

    const friendRowCount = await db.get('SELECT COUNT(*) as count FROM friends');
    if (Number(friendRowCount.count) === 0) {
        const waqas = await db.get(`SELECT id FROM users WHERE username = 'waqas'`);
        const abdullah = await db.get(`SELECT id FROM users WHERE username = 'abdullah'`);
        if (waqas?.id && abdullah?.id) {
            await db.run(
                `INSERT OR IGNORE INTO friends (userId, friendId, status) VALUES (?, ?, 'pending')`,
                [waqas.id, abdullah.id]
            );
            console.log('✅ Demo friend request seeded (waqas → abdullah)');
        }
    }
    
    app.set('db', db);
    console.log(`📂 SQLite database: ${dbPath}`);
    return db;
}

// API routes before static files so /api/* never hits the public folder by mistake
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/ai', aiRoutes);

app.use(express.static(path.join(__dirname, 'public')));

// Page Routes
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/signup', (req, res) => res.sendFile(path.join(__dirname, 'public', 'signup.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'public', 'dashboard.html')));
app.get('/video-call', (req, res) => res.sendFile(path.join(__dirname, 'public', 'video-call.html')));
app.get('/profile', (req, res) => res.sendFile(path.join(__dirname, 'public', 'profile.html')));

// Socket Handler
socketHandler(io);

const PORT = process.env.PORT || 3000;

initDatabase().then(() => {
    server.listen(PORT, () => {
        console.log(`
╔══════════════════════════════════════════════════════════════╗
║     🚀 ECHO MEET SERVER RUNNING ON PORT ${PORT}                  ║
║     📍 http://localhost:${PORT}                                  ║
║     👤 Demo: waqas/waqas123 | abdullah/abdullah123            ║
╚══════════════════════════════════════════════════════════════╝
        `);
    });
}).catch(err => console.error('Database error:', err));