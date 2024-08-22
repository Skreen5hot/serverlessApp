const PORT = 3888;
const CERT = '/etc/letsencrypt/live/signal.filonexus.com/fullchain.pem';
const CERT_KEY = '/etc/letsencrypt/live/signal.filonexus.com/privkey.pem';

const https = require('https');
const fs = require('fs');

const certExists = fs.existsSync(CERT) && fs.existsSync(CERT_KEY);
    
const options = certExists ? {
    cert: fs.readFileSync(CERT),
    key: fs.readFileSync(CERT_KEY)
} : {};

const server = https.createServer(options);

server.on('request', (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.write('RTC signaling server');
    res.end();
});

const io = require('socket.io')(server, {
    cors: {
        origin: '*'
    }
});

io.on('connection', (socket) => {
    socket.on('send-offer', (data) => {
        socket.broadcast.emit('receive-offer', data);
    });

    socket.on('send-answer', (data) => {
        socket.broadcast.emit('receive-answer', data);
    });

    socket.on('send-ice-candidate', (data) => {
        socket.broadcast.emit('receive-ice-candidate', data);
    });
});

server.listen(PORT, () => {
    console.log(`listening on *:${PORT}`);
});