const PORT = 3888;

const http = require('http');
const server = http.createServer();

server.on('request', (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
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