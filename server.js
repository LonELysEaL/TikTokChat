const originalError = console.error;

console.error = (...args) => {
    originalError('🔥 FULL ERROR LOG =>', ...args);
};

function safeEmit(socket, event, data) {
    try {
        if (socket && socket.emit) {
            socket.emit(event, data ?? {});
        }
    } catch (err) {
        console.error('socket emit failed:', err);
    }
}

require('dotenv').config();

const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');

const { TikTokConnectionWrapper, getGlobalConnectionCount } = require('./connectionWrapper');
const { clientBlocked } = require('./limiter');

const app = express();

/* ========================
   STATIC FRONTEND
======================== */
app.use(express.static('public'));

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

const httpServer = createServer(app);

/* ========================
   SOCKET.IO
======================== */
const io = new Server(httpServer, {
    cors: {
        origin: '*'
    }
});

io.on('connection', (socket) => {

    let tiktokConnectionWrapper;

    console.info(
        'New connection from origin',
        socket.handshake.headers['origin'] || socket.handshake.headers['referer']
    );

    // log all events
    socket.onAny((event, ...args) => {
        console.log('📡 SOCKET EVENT:', event, args);
    });

    /* ========================
       MAIN CONNECT EVENT (FIXED)
    ======================== */
    socket.on('setUniqueId', async (uniqueId, options) => {

        console.log('🔥 CLIENT SEND CONNECT:', uniqueId);

        try {

            // sanitize options
            if (typeof options !== 'object' || !options) {
                options = {};
            } else {
                delete options.requestOptions;
                delete options.websocketOptions;
            }

            if (process.env.SESSIONID) {
                options.sessionId = process.env.SESSIONID;
            }

            // rate limit
            if (process.env.ENABLE_RATE_LIMIT && clientBlocked(io, socket)) {
                safeEmit(socket, 'tiktokDisconnected', 'Rate limit exceeded');
                return;
            }

            // create wrapper
            tiktokConnectionWrapper = new TikTokConnectionWrapper(uniqueId, options, true);

            if (!tiktokConnectionWrapper?.connection) {
                safeEmit(socket, 'tiktokDisconnected', 'Connection init failed');
                return;
            }

            // connect TikTok
            await tiktokConnectionWrapper.connect();

            const conn = tiktokConnectionWrapper.connection;

            // ========================
            // EVENTS FROM TIKTOK
            // ========================

            conn.on('connected', state =>
                safeEmit(socket, 'tiktokConnected', state)
            );

            conn.on('disconnected', reason =>
                safeEmit(socket, 'tiktokDisconnected', reason)
            );

            conn.on('streamEnd', () =>
                safeEmit(socket, 'streamEnd')
            );

            conn.on('roomUser', msg => safeEmit(socket, 'roomUser', msg));
            conn.on('member', msg => safeEmit(socket, 'member', msg));
            conn.on('chat', msg => safeEmit(socket, 'chat', msg));
            conn.on('gift', msg => safeEmit(socket, 'gift', msg));
            conn.on('social', msg => safeEmit(socket, 'social', msg));
            conn.on('like', msg => safeEmit(socket, 'like', msg));
            conn.on('questionNew', msg => safeEmit(socket, 'questionNew', msg));
            conn.on('linkMicBattle', msg => safeEmit(socket, 'linkMicBattle', msg));
            conn.on('linkMicArmies', msg => safeEmit(socket, 'linkMicArmies', msg));
            conn.on('liveIntro', msg => safeEmit(socket, 'liveIntro', msg));
            conn.on('emote', msg => safeEmit(socket, 'emote', msg));
            conn.on('envelope', msg => safeEmit(socket, 'envelope', msg));
            conn.on('subscribe', msg => safeEmit(socket, 'subscribe', msg));

        } catch (err) {
            console.error('CONNECT ERROR:', err);
            safeEmit(socket, 'tiktokDisconnected', err.toString());
        }
    });

    /* ========================
       DISCONNECT
    ======================== */
    socket.on('disconnect', () => {
        if (tiktokConnectionWrapper) {
            tiktokConnectionWrapper.disconnect();
        }
    });
});

/* ========================
   GLOBAL STATS
======================== */
setInterval(() => {
    io.emit('statistic', {
        globalConnectionCount: getGlobalConnectionCount()
    });
}, 5000);

/* ========================
   ERROR HANDLING
======================== */
process.on('uncaughtException', (err) => {
    console.log('🔥 UNCATCHED EXCEPTION RAW');
    console.log('MESSAGE:', err?.message);
    console.log('STACK:', err?.stack);
});

process.on('unhandledRejection', (err) => {
    console.log('🔥 UNHANDLED REJECTION RAW');
    console.log('MESSAGE:', err?.message);
    console.log('STACK:', err?.stack);
});

process.on('uncaughtExceptionMonitor', (err) => {
    console.log('🔥 MONITOR:', err);
});

/* ========================
   START SERVER (RAILWAY FIXED)
======================== */
const port = process.env.PORT || 8081;

httpServer.listen(port, '0.0.0.0', () => {
    console.log("🚀 Server running on port", port);
});
