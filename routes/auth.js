const express = require('express');
const router = express.Router();

router.post('/signup', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        const db = req.app.get('db');
        
        const existing = await db.get('SELECT * FROM users WHERE username = ? OR email = ?', [username, email]);
        if (existing) {
            return res.status(400).json({ error: 'Username or email already exists' });
        }
        
        const id = `user_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        const peerId = `peer_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        
        await db.run(
            'INSERT INTO users (id, username, email, password, peerId) VALUES (?, ?, ?, ?, ?)',
            [id, username, email, password, peerId]
        );
        
        res.json({ success: true, user: { id, username, email, peerId } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const db = req.app.get('db');
        
        const user = await db.get(
            'SELECT * FROM users WHERE email = ? AND password = ?',
            [email, password]
        );
        
        if (!user) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }

        const { password: _pw, ...safeUser } = user;
        res.json({ success: true, user: safeUser });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;