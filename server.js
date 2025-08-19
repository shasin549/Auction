const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

let rooms = {}; // { roomCode: { auctioneer: socketId, bidders: [], currentBid: 0, currentWinner: '' } }

function generateRoomCode(length = 6) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('create-room', () => {
    const roomCode = generateRoomCode();
    rooms[roomCode] = { auctioneer: socket.id, bidders: [], currentBid: 0, currentWinner: '' };
    socket.join(roomCode);
    socket.emit('room-created', roomCode);
  });

  socket.on('join-room', (roomCode, bidderName) => {
    if (!rooms[roomCode]) return socket.emit('room-error', 'Room not found');
    rooms[roomCode].bidders.push({ id: socket.id, name: bidderName });
    socket.join(roomCode);
    io.to(roomCode).emit('update-bidders', rooms[roomCode].bidders);
    io.to(socket.id).emit('current-bid', rooms[roomCode].currentBid, rooms[roomCode].currentWinner);
  });

  socket.on('place-bid', (roomCode, bidValue, bidderName) => {
    if (!rooms[roomCode]) return;
    if (bidValue > rooms[roomCode].currentBid) {
      rooms[roomCode].currentBid = bidValue;
      rooms[roomCode].currentWinner = bidderName;
      io.to(roomCode).emit('current-bid', bidValue, bidderName);
    }
  });

  socket.on('disconnect', () => {
    for (const roomCode in rooms) {
      rooms[roomCode].bidders = rooms[roomCode].bidders.filter(b => b.id !== socket.id);
      if (rooms[roomCode].auctioneer === socket.id) {
        io.to(roomCode).emit('room-closed');
        delete rooms[roomCode];
      } else {
        io.to(roomCode).emit('update-bidders', rooms[roomCode]?.bidders || []);
      }
    }
    console.log('User disconnected:', socket.id);
  });
});

server.listen(3000, () => console.log('Server running at http://localhost:3000'));