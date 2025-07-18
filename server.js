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

app.use(express.static(path.join(__dirname, 'public')));

const rooms = new Map();

io.on('connection', (socket) => {
  console.log(`New connection: ${socket.id}`);

  socket.on('create-room', ({ roomId, roomName, bidIncrement }, callback) => {
    rooms.set(roomId, {
      roomName,
      participants: [],
      currentAuction: null,
      bidHistory: [],
      bidIncrement: bidIncrement || 10,
      wins: {},
      callCount: 0,
      lastCallTime: null
    });
    callback({ success: true });
  });

  socket.on('join-room', ({ roomId, userName, role }, callback) => {
    const room = rooms.get(roomId);
    if (!room) return callback({ success: false, message: "Room not found" });

    socket.join(roomId);
    socket.roomId = roomId;
    socket.userName = userName;
    socket.role = role;

    room.participants.push({ 
      id: socket.id, 
      name: userName, 
      role,
      wins: room.wins[userName] || [] 
    });

    io.to(roomId).emit('participant-joined', {
      name: userName,
      participants: room.participants
    });

    callback({ 
      success: true,
      currentAuction: room.currentAuction,
      bidIncrement: room.bidIncrement
    });
  });

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
    room.callCount = 0;
    room.lastCallTime = null;

    socket.to(socket.roomId).emit('auction-started', {
      playerName: playerData.playerName,
      playerClub: playerData.playerClub,
      playerPosition: playerData.playerPosition,
      startingPrice: playerData.startingPrice
    });

    socket.emit('auction-started', playerData);
    callback({ success: true });
  });

  socket.on('place-bid', (callback) => {
    const room = rooms.get(socket.roomId);
    if (!room || !room.currentAuction?.isActive) {
      return callback({ success: false, message: "No active auction" });
    }

    const newBid = room.currentAuction.currentBid + room.bidIncrement;
    room.currentAuction.currentBid = newBid;
    room.currentAuction.leadingBidder = socket.userName;
    room.callCount = 0;

    room.bidHistory.push({
      bidder: socket.userName,
      amount: newBid,
      timestamp: new Date()
    });

    io.to(socket.roomId).emit('bid-placed', {
      currentBid: newBid,
      leadingBidder: socket.userName
    });

    io.to(socket.roomId).emit('call-update', {
      callCount: 0,
      message: "New bid placed!"
    });

    callback({ success: true });
  });

  socket.on('final-call', ({ roomId }, callback) => {
    const room = rooms.get(roomId);
    if (!room || socket.role !== 'auctioneer') {
      return callback({ success: false, message: "Not authorized" });
    }

    if (!room.currentAuction?.isActive) {
      return callback({ success: false, message: "No active auction" });
    }

    const lastBid = room.bidHistory[room.bidHistory.length - 1];
    if (lastBid && room.lastCallTime && lastBid.timestamp > room.lastCallTime) {
      room.callCount = 0;
    }

    room.callCount++;
    room.lastCallTime = new Date();

    const message = getCallMessage(room.callCount);
    io.to(roomId).emit('call-update', {
      callCount: room.callCount,
      message
    });

    if (room.callCount === 3) {
      setTimeout(() => {
        if (room.callCount === 3) {
          room.currentAuction.isActive = false;
          const winnerName = room.currentAuction.leadingBidder || 'No Winner';
          const winningBid = room.currentAuction.currentBid;

          if (winnerName !== 'No Winner') {
            if (!room.wins[winnerName]) room.wins[winnerName] = [];
            room.wins[winnerName].push({
              playerName: room.currentAuction.playerName,
              amount: winningBid
            });

            const winner = room.participants.find(p => p.name === winnerName);
            if (winner) winner.wins = room.wins[winnerName];
          }

          io.to(roomId).emit('auction-ended', {
            playerName: room.currentAuction.playerName,
            winnerName,
            winningBid
          });

          io.to(roomId).emit('participant-updated', {
            participants: room.participants
          });
        }
      }, 3000);
    }

    callback({ 
      success: true,
      callCount: room.callCount
    });
  });

  socket.on('get-participant-wins', ({ roomId, participantName }, callback) => {
    const room = rooms.get(roomId);
    if (!room) return callback({ success: false, message: "Room not found" });

    const wins = room.wins[participantName] || [];
    callback({ success: true, wins });
  });

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

function getCallMessage(count) {
  switch(count) {
    case 1: return "First Call!";
    case 2: return "Second Call!";
    case 3: return "Final Call!";
    default: return "Going once...";
  }
}

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});