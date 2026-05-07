module.exports = (io) => {
    const onlineUsers = new Map();
    /** Caller username → peer username for active video session (cleared on explicit call-session null or disconnect) */
    const callPartnerByUser = new Map();
    /** @type {Map<string, Array<{ type: string, from: string, offer?: any, answer?: any, candidate?: any }>>} */
    const pendingSignals = new Map();
    const PENDING_MAX = 250;

    function enqueuePending(toUser, msg) {
        let q = pendingSignals.get(toUser);
        if (!q) {
            q = [];
            pendingSignals.set(toUser, q);
        }
        q.push(msg);
        while (q.length > PENDING_MAX) q.shift();
    }

    function flushPending(toUser, socketId) {
        const q = pendingSignals.get(toUser);
        if (!q?.length) return;
        pendingSignals.delete(toUser);
        for (const msg of q) {
            if (msg.type === 'offer') {
                io.to(socketId).emit('offer', { offer: msg.offer, from: msg.from });
            } else if (msg.type === 'answer') {
                io.to(socketId).emit('answer', { answer: msg.answer, from: msg.from });
            } else if (msg.type === 'ice') {
                io.to(socketId).emit('ice-candidate', { candidate: msg.candidate, from: msg.from });
            } else if (msg.type === 'call-ended') {
                io.to(socketId).emit('call-ended', { from: msg.from });
            }
        }
    }

    function relayOrQueue(socket, toUser, emitFn, pendingPayload) {
        const targetSocket = onlineUsers.get(toUser);
        if (targetSocket) {
            emitFn(targetSocket);
        } else {
            enqueuePending(toUser, pendingPayload);
        }
    }

    io.on('connection', (socket) => {
        console.log('🔌 New client connected:', socket.id);

        socket.on('user-online', (data) => {
            const { userId } = data;
            onlineUsers.set(userId, socket.id);
            socket.username = userId;
            const cp = data && data.callPeer;
            if (typeof cp === 'string' && cp) {
                callPartnerByUser.set(userId, cp);
            } else {
                callPartnerByUser.delete(userId);
            }
            console.log(`✅ ${userId} is now online`);
            socket.broadcast.emit('user-status', { userId, online: true });
            flushPending(userId, socket.id);
        });

        /** Clear partner binding before hang-up navigation so disconnect does not double-notify */
        socket.on('call-session', (data) => {
            if (!socket.username) return;
            const peer = data && data.peerUsername;
            if (peer) {
                callPartnerByUser.set(socket.username, peer);
            } else {
                callPartnerByUser.delete(socket.username);
            }
        });

        socket.on('call-user', (data) => {
            const { to, from, fromId } = data;
            const targetSocket = onlineUsers.get(to);
            if (targetSocket) {
                console.log(`📞 Call from ${from} to ${to}`);
                io.to(targetSocket).emit('incoming-call', { from, fromId, fromSocket: socket.id });
            } else {
                console.log(`❌ ${to} is offline`);
                socket.emit('user-offline', { user: to });
            }
        });

        socket.on('call-accepted', (data) => {
            const { to, from } = data;
            const targetSocket = onlineUsers.get(to);
            if (targetSocket) {
                console.log(`✅ Call accepted: ${from} accepted by ${to}`);
                io.to(targetSocket).emit('call-accepted', { from });
            }
        });

        socket.on('call-rejected', (data) => {
            const { to, from } = data;
            const targetSocket = onlineUsers.get(to);
            if (targetSocket) {
                console.log(`❌ Call rejected: ${from} rejected by ${to}`);
                io.to(targetSocket).emit('call-rejected', { from });
            }
        });

        socket.on('call-ended', (data) => {
            const { to } = data;
            relayOrQueue(socket, to, (sid) => {
                io.to(sid).emit('call-ended', { from: socket.username });
                console.log(`📴 Call ended: ${socket.username} → notify ${to}`);
            }, { type: 'call-ended', from: socket.username });
        });

        socket.on('voice-to-text', (data) => {
            const { to, text, from } = data;
            const targetSocket = onlineUsers.get(to);
            if (targetSocket) {
                io.to(targetSocket).emit('receive-voice-text', { text, from });
            }
        });

        socket.on('text-to-voice', (data) => {
            const { to, text, from } = data;
            const targetSocket = onlineUsers.get(to);
            if (targetSocket) {
                io.to(targetSocket).emit('receive-text-voice', { text, from });
            }
        });

        socket.on('sign-detected', (data) => {
            const { to, sign, from } = data;
            const targetSocket = onlineUsers.get(to);
            if (targetSocket) {
                io.to(targetSocket).emit('receive-sign', { sign, from });
            }
        });

        socket.on('chat-message', (data) => {
            const { to, message, from } = data;
            const targetSocket = onlineUsers.get(to);
            if (targetSocket) {
                io.to(targetSocket).emit('receive-chat', { message, from });
            }
        });

        socket.on('offer', (data) => {
            const { to, offer } = data;
            relayOrQueue(socket, to, (sid) => {
                io.to(sid).emit('offer', { offer, from: socket.username });
            }, { type: 'offer', from: socket.username, offer });
        });

        socket.on('answer', (data) => {
            const { to, answer } = data;
            relayOrQueue(socket, to, (sid) => {
                io.to(sid).emit('answer', { answer, from: socket.username });
            }, { type: 'answer', from: socket.username, answer });
        });

        socket.on('ice-candidate', (data) => {
            const { to, candidate } = data;
            if (!candidate) return;
            relayOrQueue(socket, to, (sid) => {
                io.to(sid).emit('ice-candidate', { candidate, from: socket.username });
            }, { type: 'ice', from: socket.username, candidate });
        });

        socket.on('disconnect', () => {
            if (socket.username) {
                const partner = callPartnerByUser.get(socket.username);
                callPartnerByUser.delete(socket.username);
                if (partner) {
                    const partnerSid = onlineUsers.get(partner);
                    if (partnerSid) {
                        io.to(partnerSid).emit('call-ended', { from: socket.username });
                    }
                }
                console.log(`🔴 ${socket.username} went offline`);
                onlineUsers.delete(socket.username);
                socket.broadcast.emit('user-status', { userId: socket.username, online: false });
            }
        });
    });
};
