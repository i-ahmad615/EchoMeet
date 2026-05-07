const { test } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const { Server } = require('socket.io');
const { io: ioClient } = require('socket.io-client');
const socketHandler = require('../socket/socket-handler');

async function createTestServer() {
    const httpServer = http.createServer();
    const io = new Server(httpServer, { cors: { origin: '*' } });
    socketHandler(io);
    await new Promise((resolve) => httpServer.listen(0, resolve));
    const port = httpServer.address().port;
    return { httpServer, io, port };
}

async function shutdown(httpServer, io) {
    await new Promise((resolve, reject) => {
        io.close((err) => (err ? reject(err) : resolve()));
    });
    if (httpServer.listening) {
        await new Promise((resolve, reject) => {
            httpServer.close((err) => (err ? reject(err) : resolve()));
        });
    }
}

function client(port) {
    return ioClient(`http://127.0.0.1:${port}`, {
        transports: ['websocket'],
        reconnection: false,
        forceNew: true
    });
}

test('relays offer, answer, and ice between online peers with from field', async () => {
    const { httpServer, io, port } = await createTestServer();
    try {
        const alice = client(port);
        const bob = client(port);
        await Promise.all([
            new Promise((resolve) => alice.once('connect', resolve)),
            new Promise((resolve) => bob.once('connect', resolve))
        ]);

        alice.emit('user-online', { userId: 'alice' });
        bob.emit('user-online', { userId: 'bob' });
        await new Promise((r) => setTimeout(r, 40));

        const offer = { type: 'offer', sdp: 'v=0\r\n-o fake 0 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n' };
        const bobGetsOffer = new Promise((resolve) => bob.once('offer', resolve));
        alice.emit('offer', { to: 'bob', offer });
        const gotOffer = await bobGetsOffer;
        assert.strictEqual(gotOffer.from, 'alice');
        assert.strictEqual(gotOffer.offer.type, offer.type);

        const answer = { type: 'answer', sdp: 'v=0\r\n-o fake2 0 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n' };
        const aliceGetsAnswer = new Promise((resolve) => alice.once('answer', resolve));
        bob.emit('answer', { to: 'alice', answer });
        const gotAnswer = await aliceGetsAnswer;
        assert.strictEqual(gotAnswer.from, 'bob');

        const candidate = { candidate: 'candidate:1 1 udp 2130706431 127.0.0.1 9 typ host', sdpMid: '0', sdpMLineIndex: 0 };
        const bobGetsIce = new Promise((resolve) => bob.once('ice-candidate', resolve));
        alice.emit('ice-candidate', { to: 'bob', candidate });
        const gotIce = await bobGetsIce;
        assert.strictEqual(gotIce.from, 'alice');
        assert.strictEqual(gotIce.candidate.candidate, candidate.candidate);

        alice.disconnect();
        bob.disconnect();
    } finally {
        await shutdown(httpServer, io);
    }
});

test('queues offer (and ice) until recipient emits user-online', async () => {
    const { httpServer, io, port } = await createTestServer();
    try {
        const alice = client(port);
        await new Promise((resolve) => alice.once('connect', resolve));
        alice.emit('user-online', { userId: 'alice' });
        await new Promise((r) => setTimeout(r, 40));

        const offer = { type: 'offer', sdp: 'v=0\r\n-o q 0 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n' };
        const candidate = { candidate: 'candidate:2 1 udp 2130706431 10.0.0.2 5000 typ host', sdpMid: '0', sdpMLineIndex: 0 };
        alice.emit('offer', { to: 'bob', offer });
        alice.emit('ice-candidate', { to: 'bob', candidate });

        const bob = client(port);
        await new Promise((resolve) => bob.once('connect', resolve));

        const events = [];
        bob.on('offer', (p) => events.push(['offer', p]));
        bob.on('ice-candidate', (p) => events.push(['ice', p]));

        bob.emit('user-online', { userId: 'bob' });
        await new Promise((r) => setTimeout(r, 80));

        assert.strictEqual(events.length, 2);
        assert.strictEqual(events[0][0], 'offer');
        assert.strictEqual(events[0][1].from, 'alice');
        assert.strictEqual(events[1][0], 'ice');
        assert.strictEqual(events[1][1].from, 'alice');

        alice.disconnect();
        bob.disconnect();
    } finally {
        await shutdown(httpServer, io);
    }
});

test('call-ended relays by username', async () => {
    const { httpServer, io, port } = await createTestServer();
    try {
        const alice = client(port);
        const bob = client(port);
        await Promise.all([
            new Promise((resolve) => alice.once('connect', resolve)),
            new Promise((resolve) => bob.once('connect', resolve))
        ]);

        alice.emit('user-online', { userId: 'alice' });
        bob.emit('user-online', { userId: 'bob' });
        await new Promise((r) => setTimeout(r, 40));

        const bobEnds = new Promise((resolve) => bob.once('call-ended', resolve));
        alice.emit('call-ended', { to: 'bob', from: 'alice' });
        const payload = await bobEnds;
        assert.strictEqual(payload.from, 'alice');

        alice.disconnect();
        bob.disconnect();
    } finally {
        await shutdown(httpServer, io);
    }
});

test('disconnect notifies user-online callPeer', async () => {
    const { httpServer, io, port } = await createTestServer();
    try {
        const alice = client(port);
        const bob = client(port);
        await Promise.all([
            new Promise((resolve) => alice.once('connect', resolve)),
            new Promise((resolve) => bob.once('connect', resolve))
        ]);

        alice.emit('user-online', { userId: 'alice', callPeer: 'bob' });
        bob.emit('user-online', { userId: 'bob' });
        await new Promise((r) => setTimeout(r, 40));

        const bobEnds = new Promise((resolve) => bob.once('call-ended', resolve));
        alice.disconnect();
        const payload = await bobEnds;
        assert.strictEqual(payload.from, 'alice');

        bob.disconnect();
    } finally {
        await shutdown(httpServer, io);
    }
});

test('queues call-ended until recipient emits user-online', async () => {
    const { httpServer, io, port } = await createTestServer();
    try {
        const alice = client(port);
        await new Promise((resolve) => alice.once('connect', resolve));
        alice.emit('user-online', { userId: 'alice' });
        await new Promise((r) => setTimeout(r, 40));

        alice.emit('call-ended', { to: 'bob' });

        const bob = client(port);
        await new Promise((resolve) => bob.once('connect', resolve));
        const bobEnds = new Promise((resolve) => bob.once('call-ended', resolve));
        bob.emit('user-online', { userId: 'bob' });
        const payload = await bobEnds;
        assert.strictEqual(payload.from, 'alice');

        alice.disconnect();
        bob.disconnect();
    } finally {
        await shutdown(httpServer, io);
    }
});
