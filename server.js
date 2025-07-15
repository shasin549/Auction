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

// In-memory store
const rooms = new Map();

io.on('connection', (socket) => {
  console.log(`New connection: ${socket.id}`);

  // Create room
  socket.on('create-room', ({ roomId, roomName, bidIncrement }, callback) => {
    rooms.set(roomId, {
      roomName,
      participants: [],
      currentAuction: null,
      bidHistory: [],
      bidIncrement: bidIncrement || 10,
      wins: {}
    });
    callback({ success: true });
  });

  // Join room
  socket.on('join-room', ({ roomId, userName, role }, callback) => {
    const room = rooms.get(roomId);
    if (!room) return callback({ success: false, message: "Room not found" });

    socket.join(roomId);
    socket.roomId = roomId;
    socket.userName = userName;
    socket.role = role;

    room.participants.push({ id: socket.id, name: userName, role });

    io.to(roomId).emit('participant-joined', {
      name: userName,
      participants: room.participants
    });

    callback({ 
      success: true,
      currentAuction: room.currentAuction
    });
  });

  // Start auction
  socket.on('start-auction', (playerData, callback) => {
    const room = rooms.get(socket.roomId);
    if (!room || socket.role !== 'auctioneer') {
      return callback({ success: false, message: "Not authorized" });
    }

    const auction = {
      ...playerData,
      currentBid: playerData.startingPrice,
      leadingBidder: null,
      isActive: true
    };

    room.currentAuction = auction;
    room.bidHistory = [];

    // Send to bidders
    socket.to(socket.roomId).emit('auction-started', {
      playerName: playerData.playerName,
      playerClub: playerData.playerClub,
      playerPosition: playerData.playerPosition,
      startingPrice: playerData.startingPrice
    });

    // Send to auctioneer (full data)
    socket.emit('auction-started', playerData);

    callback({ success: true });
  });

  // Place bid
  socket.on('place-bid', (callback) => {
    const room = rooms.get(socket.roomId);
    if (!room || !room.currentAuction?.isActive) {
      return callback({ success: false, message: "No active auction" });
    }

    const newBid = room.currentAuction.currentBid + room.bidIncrement;
    room.currentAuction.currentBid = newBid;
    room.currentAuction.leadingBidder = socket.userName;

    room.bidHistory.push({
      bidder: socket.userName,
      amount: newBid,
      timestamp: new Date()
    });

    io.to(socket.roomId).emit('bid-placed', {
      currentBid: newBid,
      leadingBidder: socket.userName
    });

    callback({ success: true });
  });

  // End auction
  socket.on('end-auction', (callback) => {
    const room = rooms.get(socket.roomId);
    if (!room?.currentAuction) {
      return callback({ success: false, message: "No active auction" });
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

    callback({ success: true });
  });

  // Disconnect
  socket.on('disconnect', () => {
    const room = rooms.get(socket.roomId);
    if (room) {
      room.participants = room.participants.filter(p => p.id !== socket.id);
      io.to(socket.roomId).emit('participant-left', {
        name: socket.userName,
        participants: room.participants
      });
    }
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});