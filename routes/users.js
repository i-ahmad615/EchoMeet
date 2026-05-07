const express = require('express');
const router = express.Router();

/** Normalize SQLite TEXT ids from JSON bodies */
function sid(v) {
    if (v === undefined || v === null) return '';
    return String(v).trim();
}

router.get('/search', async (req, res) => {
    try {
        const { q } = req.query;
        const db = req.app.get('db');

        const users = await db.all(
            "SELECT id, username, email FROM users WHERE username LIKE ? OR email LIKE ?",
            [`%${q}%`, `%${q}%`]
        );
        res.json({ users });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/** Aggregate friends + pending for dashboard — must be registered before GET /:id */
router.get('/friends', async (req, res) => {
    try {
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
        let userId = req.query.userId;
        const db = req.app.get('db');

        if (!userId && req.query.username) {
            const row = await db.get('SELECT id FROM users WHERE username = ?', [req.query.username]);
            userId = row?.id;
        }
        if (!userId) {
            return res.status(400).json({ error: 'userId or username query parameter required' });
        }
        userId = sid(userId);

        /**
         * DB model: one row per directed edge.
         * - pending: userId = sender, friendId = recipient (recipient sees incoming; sender sees outgoing).
         * - accepted: after accept, row (sender→recipient) is accepted AND reciprocal (recipient→sender) is inserted accepted.
         */

        const incomingRequests = await db.all(
            `SELECT u.id, u.username, u.email
             FROM friends f
             JOIN users u ON u.id = f.userId
             WHERE f.friendId = ? AND f.status = 'pending'
             ORDER BY f.createdAt DESC`,
            [userId]
        );

        const outgoingRequests = await db.all(
            `SELECT u.id, u.username, u.email
             FROM friends f
             JOIN users u ON u.id = f.friendId
             WHERE f.userId = ? AND f.status = 'pending'
             ORDER BY f.createdAt DESC`,
            [userId]
        );

        const friends = await db.all(
            `SELECT DISTINCT u.id, u.username, u.email
             FROM friends f
             JOIN users u ON u.id = CASE
                 WHEN f.userId = ? THEN f.friendId
                 WHEN f.friendId = ? THEN f.userId
             END
             WHERE f.status = 'accepted' AND (f.userId = ? OR f.friendId = ?)
             ORDER BY u.username COLLATE NOCASE`,
            [userId, userId, userId, userId]
        );

        res.json({
            incomingRequests,
            outgoingRequests,
            friends
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/friend-request', async (req, res) => {
    try {
        const userId = sid(req.body.userId);
        const friendId = sid(req.body.friendId);
        const db = req.app.get('db');

        if (!userId || !friendId || userId === friendId) {
            return res.status(400).json({ error: 'Invalid userId or friendId' });
        }

        const accepted = await db.get(
            `SELECT id FROM friends
             WHERE status = 'accepted' AND (
               (userId = ? AND friendId = ?) OR (userId = ? AND friendId = ?)
             )`,
            [userId, friendId, friendId, userId]
        );
        if (accepted) {
            return res.status(400).json({ error: 'Already friends' });
        }

        const existedOut = await db.get(
            `SELECT id FROM friends WHERE userId = ? AND friendId = ? AND status = 'pending'`,
            [userId, friendId]
        );
        if (existedOut) {
            return res.json({ success: true, duplicate: true });
        }

        const reversePending = await db.get(
            `SELECT id FROM friends WHERE userId = ? AND friendId = ? AND status = 'pending'`,
            [friendId, userId]
        );
        if (reversePending) {
            return res.status(409).json({
                error: 'This user already sent you a request — accept it in Friend Requests.'
            });
        }

        await db.run(
            'INSERT INTO friends (userId, friendId, status) VALUES (?, ?, ?)',
            [userId, friendId, 'pending']
        );
        res.json({ success: true });
    } catch (err) {
        const msg = String(err.message || '');
        if (msg.includes('SQLITE_CONSTRAINT') || msg.includes('UNIQUE')) {
            return res.json({ success: true, duplicate: true });
        }
        res.status(500).json({ error: err.message });
    }
});

router.post('/accept-request', async (req, res) => {
    try {
        const userId = sid(req.body.userId);
        const friendId = sid(req.body.friendId);
        const db = req.app.get('db');

        if (!userId || !friendId) {
            return res.status(400).json({ error: 'userId and friendId required' });
        }

        const pending = await db.get(
            `SELECT id FROM friends WHERE userId = ? AND friendId = ? AND status = 'pending'`,
            [friendId, userId]
        );
        if (!pending) {
            return res.status(404).json({ error: 'No pending request from this user' });
        }

        await db.run(
            `UPDATE friends SET status = ? WHERE userId = ? AND friendId = ? AND status = 'pending'`,
            ['accepted', friendId, userId]
        );
        await db.run(
            `INSERT OR IGNORE INTO friends (userId, friendId, status) VALUES (?, ?, ?)`,
            [userId, friendId, 'accepted']
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/reject-request', async (req, res) => {
    try {
        const userId = sid(req.body.userId);
        const friendId = sid(req.body.friendId);
        const db = req.app.get('db');

        if (!userId || !friendId) {
            return res.status(400).json({ error: 'userId and friendId required' });
        }

        await db.run(
            `DELETE FROM friends WHERE userId = ? AND friendId = ? AND status = 'pending'`,
            [friendId, userId]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/** Withdraw a pending request you sent (sender = userId, recipient = friendId) */
router.post('/cancel-friend-request', async (req, res) => {
    try {
        const userId = sid(req.body.userId);
        const friendId = sid(req.body.friendId);
        const db = req.app.get('db');

        if (!userId || !friendId) {
            return res.status(400).json({ error: 'userId and friendId required' });
        }

        await db.run(
            `DELETE FROM friends WHERE userId = ? AND friendId = ? AND status = 'pending'`,
            [userId, friendId]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const db = req.app.get('db');
        const user = await db.get(
            'SELECT id, username, email, peerId, avatar, bio, online FROM users WHERE id = ? OR username = ?',
            [req.params.id, req.params.id]
        );
        res.json({ user });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
