// server.js

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// ✅ Serve static files from /public
app.use(express.static(path.join(__dirname, 'public')));

// ✅ Serve index.html for the root path
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ====== Auction Room Logic ======

const rooms = new Map();

io.on('connection', (socket) => {
  console.log(`🔌 Connected: ${socket.id}`);

  // Join room
  socket.on('join-room', ({ roomId, userName, role }) => {
    socket.join(roomId);
    socket.roomId = roomId;
    socket.userName = userName;
    socket.role = role;

    if (!rooms.has(roomId)) return;

    const room = rooms.get(roomId);
    const alreadyInRoom = room.participants.find(p => p.id === socket.id);
    if (!alreadyInRoom) {
      room.participants.push({ id: socket.id, name: userName, role });
    }

    // Send room state
    socket.emit('room-state', {
      participants: room.participants,
      currentAuction: room.currentAuction,
      bidHistory: room.bidHistory,
      roomName: room.roomName,
      bidIncrement: room.bidIncrement
    });

    io.to(roomId).emit('participant-joined', {
      name: userName,
      participants: room.participants
    });

    console.log(`✅ ${userName} joined ${roomId} as ${role}`);
  });

  // Create room
  socket.on('create-room', ({ roomId, roomName, bidIncrement, maxParticipants }) => {
    rooms.set(roomId, {
      roomName,
      participants: [],
      currentAuction: null,
      bidHistory: [],
      bidIncrement,
      maxParticipants
    });

    console.log(`🏠 Room created: ${roomId} (${roomName})`);
  });

  // Start auction
  socket.on('start-auction', ({ playerName, playerClub, playerPosition, startingPrice }) => {
    const room = rooms.get(socket.roomId);
    if (!room || socket.role !== 'auctioneer') return;

    const auction = {
      playerName,
      playerClub,
      playerPosition,
      startingPrice,
      currentBid: startingPrice,
      leadingBidder: null,
      isActive: true
    };

    room.currentAuction = auction;
    room.bidHistory = [];

    io.to(socket.roomId).emit('auction-started', auction);
    console.log(`🚀 Auction started in ${socket.roomId}: ${playerName}`);
  });

  // Place bid
  socket.on('place-bid', () => {
    const room = rooms.get(socket.roomId);
    if (!room || !room.currentAuction || !room.currentAuction.isActive) return;

    const newBid = room.currentAuction.currentBid + room.bidIncrement;
    room.currentAuction.currentBid = newBid;
    room.currentAuction.leadingBidder = socket.userName;

    const bidData = {
      bidder: socket.userName,
      amount: newBid,
      timestamp: new Date()
    };

    room.bidHistory.unshift(bidData);

    io.to(socket.roomId).emit('bid-placed', {
      currentBid: newBid,
      leadingBidder: socket.userName,
      bidHistory: room.bidHistory
    });

    console.log(`💰 ${socket.userName} bid ₹${newBid} in ${socket.roomId}`);
  });

  // End auction
  socket.on('end-auction', () => {
    const room = rooms.get(socket.roomId);
    if (!room || !room.currentAuction || socket.role !== 'auctioneer') return;

    room.currentAuction.isActive = false;

    io.to(socket.roomId).emit('auction-ended', {
      playerName: room.currentAuction.playerName,
      winnerName: room.currentAuction.leadingBidder || 'No Winner',
      winningBid: room.currentAuction.currentBid
    });

    console.log(`🏁 Auction ended in ${socket.roomId}`);
  });

  // Disconnect
  socket.on('disconnect', () => {
    const roomId = socket.roomId;
    const room = rooms.get(roomId);
    if (room) {
      room.participants = room.participants.filter(p => p.id !== socket.id);
      io.to(roomId).emit('participant-left', {
        name: socket.userName,
        participants: room.participants
      });
    }
    console.log(`❌ Disconnected: ${socket.id}`);
  });
});

// ✅ Start the server
const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});