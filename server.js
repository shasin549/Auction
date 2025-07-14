
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
app.use(express.static(path.join(__dirname)));

// Serve Socket.io client library
app.get('/socket.io/socket.io.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'node_modules/socket.io/client-dist/socket.io.js'));
});

// Store active rooms and their data
const rooms = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Join a room
  socket.on('join-room', (data) => {
    const { roomId, userName, role } = data;
    socket.join(roomId);
    socket.userName = userName;
    socket.role = role;
    socket.roomId = roomId;

    // Initialize room if it doesn't exist
    if (!rooms.has(roomId)) {
      rooms.set(roomId, {
        participants: [],
        currentAuction: null,
        bidHistory: [],
        roomName: '',
        bidIncrement: 10
      });
    }

    const room = rooms.get(roomId);
    
    // Add participant if not already in room
    const existingParticipant = room.participants.find(p => p.name === userName && p.role === role);
    if (!existingParticipant) {
      room.participants.push({
        id: socket.id,
        name: userName,
        role: role
      });
      
      // Only notify about new participant if they weren't already in the room
      io.to(roomId).emit('participant-joined', {
        name: userName,
        participants: room.participants
      });
    }

    // Send current room state to new user
    socket.emit('room-state', {
      participants: room.participants,
      currentAuction: room.currentAuction,
      bidHistory: room.bidHistory,
      roomName: room.roomName,
      bidIncrement: room.bidIncrement
    });

    console.log(`${userName} joined room ${roomId} as ${role}`);
  });

  // Create room (auctioneer only)
  socket.on('create-room', (data) => {
    const { roomId, roomName, bidIncrement, maxParticipants } = data;
    
    rooms.set(roomId, {
      participants: [],
      currentAuction: null,
      bidHistory: [],
      roomName: roomName,
      bidIncrement: bidIncrement,
      maxParticipants: maxParticipants
    });

    console.log(`Room ${roomId} created: ${roomName}`);
  });

  // Start auction (auctioneer only)
  socket.on('start-auction', (data) => {
    if (socket.role !== 'auctioneer') return;

    const room = rooms.get(socket.roomId);
    if (!room) return;

    const auctionData = {
      playerName: data.playerName,
      playerClub: data.playerClub,
      playerPosition: data.playerPosition,
      startingPrice: data.startingPrice,
      currentBid: data.startingPrice,
      leadingBidder: null,
      isActive: true
    };

    room.currentAuction = auctionData;
    room.bidHistory = [];

    // Broadcast to all users in room
    io.to(socket.roomId).emit('auction-started', auctionData);
    console.log(`Auction started in room ${socket.roomId} for ${data.playerName}`);
  });

  // Place bid (bidders only)
  socket.on('place-bid', (data) => {
    if (socket.role !== 'bidder') return;

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

    // Broadcast bid update to all users in room
    io.to(socket.roomId).emit('bid-placed', {
      currentBid: newBid,
      leadingBidder: socket.userName,
      bidHistory: room.bidHistory
    });

    console.log(`${socket.userName} bid ₹${newBid} in room ${socket.roomId}`);
  });

  // End auction (auctioneer only)
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

    // Broadcast auction end to all users in room
    io.to(socket.roomId).emit('auction-ended', winnerData);
    console.log(`Auction ended in room ${socket.roomId}`);
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    if (socket.roomId) {
      const room = rooms.get(socket.roomId);
      if (room) {
        room.participants = room.participants.filter(p => p.id !== socket.id);
        
        // Notify others of participant leaving
        socket.to(socket.roomId).emit('participant-left', {
          name: socket.userName,
          participants: room.participants
        });
      }
    }
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
