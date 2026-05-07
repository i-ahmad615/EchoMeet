const { test } = require('node:test');
const assert = require('node:assert');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

async function createMemoryDb() {
    const db = await open({ filename: ':memory:', driver: sqlite3.Database });
    await db.exec(`
        CREATE TABLE users (id TEXT PRIMARY KEY, username TEXT, email TEXT);
        CREATE TABLE friends (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            userId TEXT,
            friendId TEXT,
            status TEXT DEFAULT 'pending',
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE UNIQUE INDEX idx_friends_user_friend ON friends(userId, friendId);
    `);
    await db.run(`INSERT INTO users (id, username, email) VALUES ('1', 'waqas', 'w@test'), ('2', 'abdullah', 'a@test')`);
    await db.run(`INSERT INTO friends (userId, friendId, status) VALUES ('1', '2', 'pending')`);
    return db;
}

test('outgoing pending lists recipients for sender', async () => {
    const db = await createMemoryDb();
    const outgoingFor1 = await db.all(
        `SELECT u.id, u.username FROM friends f
         JOIN users u ON u.id = f.friendId
         WHERE f.userId = ? AND f.status = 'pending'`,
        ['1']
    );
    assert.strictEqual(outgoingFor1.length, 1);
    assert.strictEqual(outgoingFor1[0].id, '2');
    await db.close();
});

test('GET friends shape: abdullah sees incoming from waqas; waqas sees outgoing', async () => {
    const db = await createMemoryDb();

    const incomingFor2 = await db.all(
        `SELECT u.id FROM friends f JOIN users u ON u.id = f.userId
         WHERE f.friendId = ? AND f.status = 'pending'`,
        ['2']
    );
    assert.strictEqual(incomingFor2.length, 1);
    assert.strictEqual(incomingFor2[0].id, '1');

    const outgoingFrom1 = await db.all(
        `SELECT friendId FROM friends WHERE userId = ? AND status = 'pending'`,
        ['1']
    );
    assert.strictEqual(outgoingFrom1.length, 1);
    assert.strictEqual(outgoingFrom1[0].friendId, '2');

    await db.close();
});

test('accept-request updates pending and inserts reverse accepted row', async () => {
    const db = await createMemoryDb();

    await db.run(
        `UPDATE friends SET status = ? WHERE userId = ? AND friendId = ? AND status = 'pending'`,
        ['accepted', '1', '2']
    );
    await db.run(`INSERT OR IGNORE INTO friends (userId, friendId, status) VALUES ('2', '1', 'accepted')`);

    const accepted = await db.all(`SELECT userId, friendId FROM friends WHERE status = 'accepted' ORDER BY userId, friendId`);
    assert.strictEqual(accepted.length, 2);
    assert.deepStrictEqual(
        accepted.map((r) => `${r.userId}->${r.friendId}`),
        ['1->2', '2->1']
    );

    await db.close();
});

test('reject-request removes pending row', async () => {
    const db = await createMemoryDb();
    await db.run(`DELETE FROM friends WHERE userId = ? AND friendId = ? AND status = 'pending'`, ['1', '2']);
    const n = await db.get(`SELECT COUNT(*) as c FROM friends`);
    assert.strictEqual(n.c, 0);
    await db.close();
});

test('accepted friends visible from either direction (single edge)', async () => {
    const db = await createMemoryDb();
    await db.run(`DELETE FROM friends WHERE userId = '1' AND friendId = '2'`);
    await db.run(`INSERT INTO friends (userId, friendId, status) VALUES ('1', '2', 'accepted')`);

    const uid = '2';
    const friends = await db.all(
        `SELECT DISTINCT u.id, u.username
         FROM friends f
         JOIN users u ON u.id = CASE
             WHEN f.userId = ? THEN f.friendId
             WHEN f.friendId = ? THEN f.userId
         END
         WHERE f.status = 'accepted' AND (f.userId = ? OR f.friendId = ?)
         ORDER BY u.username COLLATE NOCASE`,
        [uid, uid, uid, uid]
    );
    assert.strictEqual(friends.length, 1);
    assert.strictEqual(friends[0].id, '1');

    await db.close();
});
