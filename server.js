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

    socket.on('setUniqueId', (uniqueId, options) => {

        // log the requested Creator's ID
        console.log('🔥 CLIENT SEND CONNECT:', uniqueId);

        // Prohibit the client from specifying these options (for security reasons)
        if (typeof options === 'object' && options) {
            delete options.requestOptions;
            delete options.websocketOptions;
        } else {
            options = {};
        }

        // Session ID in .env file is optional
        if (process.env.SESSIONID) {
            options.sessionId = process.env.SESSIONID;
            console.info('Using SessionId');
        }

        // Check if rate limit exceeded
        if (process.env.ENABLE_RATE_LIMIT && clientBlocked(io, socket)) {
            safeEmit(socket,'tiktokDisconnected', 'You have opened too many connections or made too many connection requests. Please reduce the number of connections/requests or host your own server instance. The connections are limited to avoid that the server IP gets blocked by TokTok.');
            return;
        }

        // Connect to the given username (uniqueId)
        socket.on('setUniqueId', async (uniqueId, options) => {
            try {
        
                if (typeof options === 'object' && options) {
                    delete options.requestOptions;
                    delete options.websocketOptions;
                } else {
                    options = {};
                }
        
                if (process.env.SESSIONID) {
                    options.sessionId = process.env.SESSIONID;
                }
        
                if (process.env.ENABLE_RATE_LIMIT && clientBlocked(io, socket)) {
                    safeEmit(socket,'tiktokDisconnected', 'Rate limit exceeded');
                    return;
                }
        
                //tiktokConnectionWrapper = new TikTokConnectionWrapper(uniqueId, options, true);
                try {
                    tiktokConnectionWrapper = new TikTokConnectionWrapper(uniqueId, options, true);
                
                    // กัน crash ถ้า connection ยังไม่พร้อม
                    if (!tiktokConnectionWrapper?.connection) {
                        safeEmit(socket,'tiktokDisconnected', 'Connection init failed');
                        return;
                    }
        
                    // 🔥 สำคัญ: catch promise
                    await Promise.resolve(tiktokConnectionWrapper.connect());
                    
                } catch (err) {
                    console.error('CONNECT ERROR:', err);
                    safeEmit(socket,'tiktokDisconnected', err.toString());
                    return;
                }
        
            } catch (err) {
                console.error("TikTok connection error:", err);
                safeEmit(socket,'tiktokDisconnected', err.toString());
            }
        });
        
        // Redirect wrapper control events once
        if (!tiktokConnectionWrapper || !tiktokConnectionWrapper.connection) {
            safeEmit(socket,'tiktokDisconnected', 'Connection not ready');
            return;
        }

        const conn = tiktokConnectionWrapper.connection;
        if (conn) {
            conn.once('connected', state => safeEmit(socket,'tiktokConnected', state));
            conn.once('disconnected', reason => safeEmit(socket,'tiktokDisconnected', reason));
        }
        
        tiktokConnectionWrapper.once('disconnected', reason => safeEmit(socket,'tiktokDisconnected', reason));

        // Notify client when stream ends
        tiktokConnectionWrapper.connection.on('streamEnd', () => safeEmit(socket,'streamEnd'));

        // Redirect message events
        tiktokConnectionWrapper.connection.on('roomUser', msg => safeEmit(socket,'roomUser', msg));
        tiktokConnectionWrapper.connection.on('member', msg => safeEmit(socket,'member', msg));
        tiktokConnectionWrapper.connection.on('chat', msg => safeEmit(socket,'chat', msg));
        tiktokConnectionWrapper.connection.on('gift', msg => safeEmit(socket,'gift', msg));
        tiktokConnectionWrapper.connection.on('social', msg => safeEmit(socket,'social', msg));
        tiktokConnectionWrapper.connection.on('like', msg => safeEmit(socket,'like', msg));
        tiktokConnectionWrapper.connection.on('questionNew', msg => safeEmit(socket,'questionNew', msg));
        tiktokConnectionWrapper.connection.on('linkMicBattle', msg => safeEmit(socket,'linkMicBattle', msg));
        tiktokConnectionWrapper.connection.on('linkMicArmies', msg => safeEmit(socket,'linkMicArmies', msg));
        tiktokConnectionWrapper.connection.on('liveIntro', msg => safeEmit(socket,'liveIntro', msg));
        tiktokConnectionWrapper.connection.on('emote', msg => safeEmit(socket,'emote', msg));
        tiktokConnectionWrapper.connection.on('envelope', msg => safeEmit(socket,'envelope', msg));
        tiktokConnectionWrapper.connection.on('subscribe', msg => safeEmit(socket,'subscribe', msg));
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
