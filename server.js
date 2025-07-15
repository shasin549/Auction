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

// ✅ Serve all frontend files from public/
app.use(express.static(path.join(__dirname, 'public')));

// ✅ Serve index.html at root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 🧠 In-memory store for all auction rooms
const rooms = new Map();

io.on('connection', (socket) => {
  console.log(`✅ Socket connected: ${socket.id}`);

  // 🏠 Create a new room
  socket.on('create-room', ({ roomId, roomName, bidIncrement, maxParticipants }) => {
    rooms.set(roomId, {
      roomName,
      participants: [],
      currentAuction: null,
      bidHistory: [],
      bidIncrement,
      maxParticipants,
      wins: {} // Track players each participant has won
    });
    console.log(`🎯 Room created: ${roomId} (${roomName})`);
  });

  // 🚪 Join a room
  socket.on('join-room', ({ roomId, userName, role }) => {
    socket.join(roomId);
    socket.roomId = roomId;
    socket.userName = userName;
    socket.role = role;

    const room = rooms.get(roomId);
    if (!room) return;

    room.participants.push({ id: socket.id, name: userName, role });

    io.to(roomId).emit('participant-joined', {
      name: userName,
      participants: room.participants
    });

    socket.emit('room-state', {
      participants: room.participants,
      currentAuction: room.currentAuction,
      bidHistory: room.bidHistory,
      roomName: room.roomName,
      bidIncrement: room.bidIncrement
    });
  });

  // 🚀 Start auction
  socket.on('start-auction', (data) => {
    const room = rooms.get(socket.roomId);
    if (!room || socket.role !== 'auctioneer') return;

    const auction = {
      ...data,
      currentBid: data.startingPrice,
      leadingBidder: null,
      isActive: true
    };

    room.currentAuction = auction;
    room.bidHistory = [];

    io.to(socket.roomId).emit('auction-started', auction);
    console.log(`📢 Auction started: ${data.playerName}`);
  });

  // 💸 Place a bid
  socket.on('place-bid', () => {
    const room = rooms.get(socket.roomId);
    if (!room || !room.currentAuction || !room.currentAuction.isActive) return;

    const newBid = room.currentAuction.currentBid + room.bidIncrement;
    room.currentAuction.currentBid = newBid;
    room.currentAuction.leadingBidder = socket.userName;

    const bid = {
      bidder: socket.userName,
      amount: newBid,
      timestamp: new Date()
    };
    room.bidHistory.unshift(bid);

    io.to(socket.roomId).emit('bid-placed', {
      currentBid: newBid,
      leadingBidder: socket.userName,
      bidHistory: room.bidHistory
    });
  });

  // 🔚 End auction
  socket.on('end-auction', () => {
    const room = rooms.get(socket.roomId);
    if (!room || !room.currentAuction) return;

    const auction = room.currentAuction;
    auction.isActive = false;

    const winnerName = auction.leadingBidder || 'No Winner';
    const winningBid = auction.currentBid;

    if (winnerName !== 'No Winner') {
      if (!room.wins[winnerName]) room.wins[winnerName] = [];
      room.wins[winnerName].push({
        playerName: auction.playerName,
        amount: winningBid
      });
    }

    io.to(socket.roomId).emit('auction-ended', {
      playerName: auction.playerName,
      winnerName,
      winningBid
    });
  });

  // 📜 Get winner list
  socket.on('get-winner-list', () => {
    const room = rooms.get(socket.roomId);
    if (!room) return;

    const wins = room.wins[socket.userName] || [];
    socket.emit('winner-list', wins);
  });

  // ❌ Disconnect
  socket.on('disconnect', () => {
    const room = rooms.get(socket.roomId);
    if (!room) return;

    room.participants = room.participants.filter(p => p.id !== socket.id);

    io.to(socket.roomId).emit('participant-left', {
      name: socket.userName,
      participants: room.participants
    });

    console.log(`❌ Socket disconnected: ${socket.id}`);
  });
});

// 🚀 Start server on Render
const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});