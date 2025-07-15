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

// Serve static files (index.html, script.js, style.css, etc.)
app.use(express.static(path.join(__dirname, 'public')));
// Serve socket.io client library if needed
app.get('/socket.io/socket.io.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'node_modules/socket.io/client-dist/socket.io.js'));
});

// Store rooms in memory
const rooms = new Map();

io.on('connection', (socket) => {
  console.log(`🔌 New client connected: ${socket.id}`);

  // Join a room
  socket.on('join-room', ({ roomId, userName, role }) => {
    socket.join(roomId);
    socket.roomId = roomId;
    socket.userName = userName;
    socket.role = role;

    // If room doesn't exist, skip
    if (!rooms.has(roomId)) return;

    const room = rooms.get(roomId);

    // Add participant
    if (!room.participants.find(p => p.id === socket.id)) {
      room.participants.push({ id: socket.id, name: userName, role });
    }

    // Send room state to user
    socket.emit('room-state', {
      participants: room.participants,
      currentAuction: room.currentAuction,
      bidHistory: room.bidHistory,
      roomName: room.roomName,
      bidIncrement: room.bidIncrement
    });

    // Notify others in room
    io.to(roomId).emit('participant-joined', {
      name: userName,
      participants: room.participants
    });

    console.log(`✅ ${userName} joined ${roomId} as ${role}`);
  });

  // Create a room
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

  // Start an auction
  socket.on('start-auction', ({ playerName, playerClub, playerPosition, startingPrice }) => {
    const room = rooms.get(socket.roomId);
    if (!room || socket.role !== 'auctioneer') return;

    const auctionData = {
      playerName,
      playerClub,
      playerPosition,
      startingPrice,
      currentBid: startingPrice,
      leadingBidder: null,
      isActive: true
    };

    room.currentAuction = auctionData;
    room.bidHistory = [];

    io.to(socket.roomId).emit('auction-started', auctionData);
    console.log(`🚀 Auction started in ${socket.roomId} for ${playerName}`);
  });

  // Place a bid
  socket.on('place-bid', () => {
    const room = rooms.get(socket.roomId);
    if (!room || !room.currentAuction || !room.currentAuction.isActive || socket.role !== 'bidder') return;

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

    console.log(`💰 ${socket.userName} placed ₹${newBid} in ${socket.roomId}`);
  });

  // End the auction
  socket.on('end-auction', () => {
    const room = rooms.get(socket.roomId);
    if (!room || socket.role !== 'auctioneer' || !room.currentAuction) return;

    room.currentAuction.isActive = false;

    io.to(socket.roomId).emit('auction-ended', {
      playerName: room.currentAuction.playerName,
      winnerName: room.currentAuction.leadingBidder || 'No Winner',
      winningBid: room.currentAuction.currentBid
    });

    console.log(`🏁 Auction ended in ${socket.roomId}`);
  });

  // Handle disconnection
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

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});