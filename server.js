const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Serve index.html on root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Serve Socket.IO client script
app.get('/socket.io/socket.io.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'node_modules', 'socket.io', 'client-dist', 'socket.io.js'));
});

// Store rooms and auction data
const rooms = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-room', (data) => {
    const { roomId, userName, role } = data;
    socket.join(roomId);
    socket.userName = userName;
    socket.role = role;
    socket.roomId = roomId;

    if (!rooms.has(roomId)) {
      rooms.set(roomId, {
        participants: [],
        currentAuction: null,
        bidHistory: [],
        roomName: '',
        bidIncrement: 10,
        participantBids: {}
      });
    }

    const room = rooms.get(roomId);
    const exists = room.participants.find(p => p.name === userName && p.role === role);
    if (!exists) {
      room.participants.push({
        id: socket.id,
        name: userName,
        role: role
      });
      io.to(roomId).emit('participant-joined', {
        name: userName,
        participants: room.participants
      });
    }

    socket.emit('room-state', {
      participants: room.participants,
      currentAuction: room.currentAuction,
      bidHistory: room.bidHistory,
      roomName: room.roomName,
      bidIncrement: room.bidIncrement
    });

    console.log(`${userName} joined room ${roomId} as ${role}`);
  });

  socket.on('create-room', (data) => {
    const { roomId, roomName, bidIncrement, maxParticipants } = data;
    rooms.set(roomId, {
      participants: [],
      currentAuction: null,
      bidHistory: [],
      roomName,
      bidIncrement,
      maxParticipants,
      participantBids: {}
    });
    console.log(`Room ${roomId} created: ${roomName}`);
  });

  socket.on('start-auction', (data) => {
    if (socket.role !== 'auctioneer') return;
    const room = rooms.get(socket.roomId);
    if (!room) return;

    const auction = {
      playerName: data.playerName,
      playerClub: data.playerClub,
      playerPosition: data.playerPosition,
      startingPrice: data.startingPrice,
      currentBid: data.startingPrice,
      leadingBidder: null,
      isActive: true,
      playerId: Date.now().toString()
    };

    room.currentAuction = auction;
    room.bidHistory = [];

    io.to(socket.roomId).emit('auction-started', auction);
    console.log(`Auction started in room ${socket.roomId} for ${data.playerName}`);
  });

  socket.on('place-bid', () => {
    if (socket.role !== 'bidder') return;
    const room = rooms.get(socket.roomId);
    if (!room || !room.currentAuction || !room.currentAuction.isActive) return;

    // Prevent bidder from bidding if they're already leading
    if (room.currentAuction.leadingBidder === socket.userName) {
      socket.emit('bid-error', 'You are already the leading bidder!');
      return;
    }

    const newBid = room.currentAuction.currentBid + room.bidIncrement;
    room.currentAuction.currentBid = newBid;
    room.currentAuction.leadingBidder = socket.userName;

    const bidData = {
      bidder: socket.userName,
      amount: newBid,
      timestamp: new Date(),
      playerName: room.currentAuction.playerName,
      playerId: room.currentAuction.playerId
    };

    // Track bids per participant
    if (!room.participantBids[socket.userName]) {
      room.participantBids[socket.userName] = [];
    }
    room.participantBids[socket.userName].push(bidData);

    room.bidHistory.unshift(bidData);

    io.to(socket.roomId).emit('bid-placed', {
      currentBid: newBid,
      leadingBidder: socket.userName,
      bidHistory: room.bidHistory
    });

    console.log(`${socket.userName} bid ₹${newBid} in room ${socket.roomId}`);
  });

  socket.on('end-auction', () => {
    if (socket.role !== 'auctioneer') return;
    const room = rooms.get(socket.roomId);
    if (!room || !room.currentAuction) return;

    room.currentAuction.isActive = false;

    const winnerData = {
      playerName: room.currentAuction.playerName,
      winnerName: room.currentAuction.leadingBidder || 'No bids',
      winningBid: room.currentAuction.currentBid
    };

    io.to(socket.roomId).emit('auction-ended', winnerData);
    console.log(`Auction ended in room ${socket.roomId}`);
  });

  socket.on('reset-auction', () => {
    if (socket.role !== 'auctioneer') return;
    const room = rooms.get(socket.roomId);
    if (!room) return;

    // Reset auction state
    room.currentAuction = null;
    room.bidHistory = [];

    // Broadcast reset to all clients
    io.to(socket.roomId).emit('auction-reset');
    console.log(`Auction reset in room ${socket.roomId}`);
  });

  socket.on('get-participant-bids', (participantName) => {
    const room = rooms.get(socket.roomId);
    if (!room || !room.participantBids) {
      socket.emit('participant-bids', {
        participantName,
        bids: []
      });
      return;
    }

    const bids = room.participantBids[participantName] || [];
    
    // Emit to the requesting client
    socket.emit('participant-bids', {
      participantName,
      bids
    });
  });

  socket.on('disconnect', () => {
    if (socket.roomId) {
      const room = rooms.get(socket.roomId);
      if (room) {
        room.participants = room.participants.filter(p => p.id !== socket.id);
        socket.to(socket.roomId).emit('participant-left', {
          name: socket.userName,
          participants: room.participants
        });
      }
    }
    console.log('User disconnected:', socket.id);
  });
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});