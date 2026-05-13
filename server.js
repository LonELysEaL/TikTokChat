const originalError = console.error;

console.error = (...args) => {
    originalError('🔥 FULL ERROR LOG =>', ...args);
};

/*
process.on('uncaughtException', (err) => {
    console.error('🔥 UNCAUGHT:', err);
});

process.on('unhandledRejection', (err) => {
    console.error('🔥 UNHANDLED:', err);
});
*/

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

app.get('/', (req, res) => {
    res.status(200).send('OK - TikTok Chat Server Running');
    res.sendFile(__dirname + '/public/index.html');
});

const httpServer = createServer(app);

// Enable cross origin resource sharing
const io = new Server(httpServer, {
    cors: {
        origin: '*'
    }
});


io.on('connection', (socket) => {
    let tiktokConnectionWrapper;

    console.info('New connection from origin', socket.handshake.headers['origin'] || socket.handshake.headers['referer']);

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
    
            if (process.env.ENABLE_RATE_LIMIT && clientBlocked(io, socket)) {
                safeEmit(socket, 'tiktokDisconnected', 'Rate limit exceeded');
                return;
            }
    
            // ✅ CREATE wrapper BEFORE USING
            tiktokConnectionWrapper = new TikTokConnectionWrapper(uniqueId, options, true);
    
            if (!tiktokConnectionWrapper?.connection) {
                safeEmit(socket, 'tiktokDisconnected', 'Connection init failed');
                return;
            }
    
            // ✅ กัน crash + connect
            await tiktokConnectionWrapper.connect();
    
            // ✅ attach events AFTER connect exists
            const conn = tiktokConnectionWrapper.connection;
    
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

    socket.on('disconnect', () => {
        if (tiktokConnectionWrapper) {
            tiktokConnectionWrapper.disconnect();
        }
    });
});

// Emit global connection statistics
setInterval(() => {
    io.emit('statistic', { globalConnectionCount: getGlobalConnectionCount() });
}, 5000)

// Serve frontend files
app.use(express.static('public'));

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

process.on('uncaughtException', (err) => {
    console.log('🔥 UNCATCHED EXCEPTION RAW');
    console.log('MESSAGE:', err?.message);
    console.log('STACK:', err?.stack);
    console.log('FULL:', err);
});

process.on('unhandledRejection', (err) => {
    console.log('🔥 UNHANDLED REJECTION RAW');
    console.log('MESSAGE:', err?.message);
    console.log('STACK:', err?.stack);
    console.log('FULL:', err);
});

process.on('uncaughtExceptionMonitor', (err) => {
    console.log('🔥 MONITOR:');
    console.log(err);
    console.log(err?.stack);
});

// Start http listener
const port = process.env.PORT || 8081;

httpServer.listen(port, '0.0.0.0', () => {
    console.log("Server running on port", port);
});
//console.info(`Server running! Please visit http://localhost:${port}`);
//console.log('Server running on port', port);

io.on('connection', (socket) => {
    socket.onAny((event, ...args) => {
        console.log('📡 SOCKET EVENT:', event, args);
    });
});
