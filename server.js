// server.js
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// Enhanced Socket.IO configuration
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000,
  cookie: false,
  allowEIO3: true // For older clients compatibility
});

// Middleware
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// In-memory store for rooms
const rooms = new Map();

// Connection logging middleware
io.use((socket, next) => {
  console.log(`⚡ New connection attempt from ${socket.handshake.address}`);
  next();
});

// Socket.IO connection handler
io.on('connection', (socket) => {
  console.log(`✅ Client connected: ${socket.id}`);

  // Heartbeat monitoring
  socket.on('ping', (startTime, callback) => {
    callback(startTime);
  });

  // Create room handler
  socket.on('create-room', ({ roomId, roomName, bidIncrement, maxParticipants }, callback) => {
    try {
      if (!roomId || !roomName) {
        throw new Error('Missing required fields');
      }

      if (rooms.has(roomId)) {
        throw new Error('Room already exists');
      }

      rooms.set(roomId, {
        roomName,
        participants: [],
        currentAuction: null,
        bidHistory: [],
        bidIncrement: bidIncrement || 10,
        maxParticipants: maxParticipants || 100,
        wins: {}
      });

      console.log(`🎯 Room created: ${roomId} (${roomName})`);
      callback({ success: true, roomId });
    } catch (err) {
      console.error('Room creation error:', err);
      callback({ success: false, message: err.message });
    }
  });

  // Join room handler
  socket.on('join-room', ({ roomId, userName, role }, callback) => {
    try {
      const room = rooms.get(roomId);
      if (!room) {
        throw new Error('Room not found');
      }

      if (room.participants.length >= room.maxParticipants) {
        throw new Error('Room is full');
      }

      socket.join(roomId);
      socket.roomId = roomId;
      socket.userName = userName;
      socket.role = role;

      room.participants.push({ id: socket.id, name: userName, role });

      // Notify room about new participant
      io.to(roomId).emit('participant-joined', {
        name: userName,
        participants: room.participants
      });

      // Send current room state to the new participant
      callback({
        success: true,
        participants: room.participants,
        currentAuction: room.currentAuction,
        bidHistory: room.bidHistory,
        roomName: room.roomName,
        bidIncrement: room.bidIncrement
      });

      console.log(`🚪 ${userName} joined room ${roomId}`);
    } catch (err) {
      console.error('Join room error:', err);
      callback({ success: false, message: err.message });
    }
  });

  // Auction handlers
  socket.on('start-auction', (data, callback) => {
    try {
      const room = rooms.get(socket.roomId);
      if (!room || socket.role !== 'auctioneer') {
        throw new Error('Not authorized');
      }

      const auction = {
        ...data,
        currentBid: data.startingPrice,
        leadingBidder: null,
        isActive: true
      };

      room.currentAuction = auction;
      room.bidHistory = [];

      io.to(socket.roomId).emit('auction-started', auction);
      console.log(`📢 Auction started for ${data.playerName} in ${socket.roomId}`);
      callback({ success: true });
    } catch (err) {
      console.error('Start auction error:', err);
      callback({ success: false, message: err.message });
    }
  });

  socket.on('place-bid', (callback) => {
    try {
      const room = rooms.get(socket.roomId);
      if (!room || !room.currentAuction?.isActive) {
        throw new Error('No active auction');
      }

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

      callback({ success: true });
    } catch (err) {
      console.error('Bid placement error:', err);
      callback({ success: false, message: err.message });
    }
  });

  socket.on('end-auction', (callback) => {
    try {
      const room = rooms.get(socket.roomId);
      if (!room?.currentAuction) {
        throw new Error('No active auction');
      }

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

      console.log(`🏁 Auction ended in ${socket.roomId}. Winner: ${winnerName}`);
      callback({ success: true });
    } catch (err) {
      console.error('End auction error:', err);
      callback({ success: false, message: err.message });
    }
  });

  // Winner list handler
  socket.on('get-winner-list', (callback) => {
    try {
      const room = rooms.get(socket.roomId);
      if (!room) {
        throw new Error('Room not found');
      }
      callback({ success: true, wins: room.wins[socket.userName] || [] });
    } catch (err) {
      console.error('Winner list error:', err);
      callback({ success: false, message: err.message });
    }
  });

  // Disconnection handler
  socket.on('disconnect', () => {
    const room = rooms.get(socket.roomId);
    if (room) {
      room.participants = room.participants.filter(p => p.id !== socket.id);
      io.to(socket.roomId).emit('participant-left', {
        name: socket.userName,
        participants: room.participants
      });
      console.log(`❌ ${socket.userName || 'User'} disconnected from ${socket.roomId}`);
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`⚡ Socket.IO listening at ws://localhost:${PORT}`);
});

// Cleanup empty rooms periodically
setInterval(() => {
  const before = rooms.size;
  for (const [id, room] of rooms) {
    if (room.participants.length === 0) {
      rooms.delete(id);
    }
  }
  const after = rooms.size;
  if (before !== after) {
    console.log(`🧹 Cleaned up ${before - after} empty rooms`);
  }
}, 3600000); // Every hour