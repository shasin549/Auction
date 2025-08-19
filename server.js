const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, "public")));

// In-memory room state
const rooms = {}; // { [roomName]: { increment, currentBid, highestBidder, currentPlayer } }

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  // Create room
  socket.on("createRoom", ({ roomName, participants, increment }) => {
    if (!roomName) return;
    if (rooms[roomName]) {
      socket.emit("errorMsg", "Room already exists. Choose another name.");
      return;
    }
    rooms[roomName] = {
      increment: parseInt(increment || 0, 10) || 0,
      currentBid: 0,
      highestBidder: null,
      currentPlayer: null,
    };
    socket.join(roomName);
    socket.emit("roomCreated", { roomName });
    console.log(`Room created: ${roomName}`);
  });

  // Join room
  socket.on("joinRoom", ({ roomName, participantName }) => {
    if (!rooms[roomName]) {
      socket.emit("roomNotFound");
      return;
    }
    socket.join(roomName);
    console.log(`${participantName} joined ${roomName}`);
    // If there is already a player active, push it to the new bidder
    if (rooms[roomName].currentPlayer) {
      io.to(socket.id).emit("biddingStarted", {
        player: rooms[roomName].currentPlayer,
        currentBid: rooms[roomName].currentBid,
      });
    }
  });

  // Start bidding also serves as "preview/broadcast player"
  socket.on("startBidding", ({ roomName, player }) => {
    if (!rooms[roomName]) return;
    const start = parseInt(player.value || 0, 10) || 0;
    rooms[roomName].currentPlayer = player;
    rooms[roomName].currentBid = start;
    rooms[roomName].highestBidder = null;

    io.to(roomName).emit("biddingStarted", {
      player,
      currentBid: start,
    });
    console.log(`Bidding started in ${roomName} for ${player.name} @ ${start}`);
  });

  // Place bid
  socket.on("placeBid", ({ roomName, bidderName, bidAmount }) => {
    if (!rooms[roomName]) return;
    const amt = parseInt(bidAmount, 10);
    const { currentBid, increment } = rooms[roomName];
    const minBid = increment > 0 ? currentBid + increment : currentBid + 1;

    if (isNaN(amt) || amt < minBid) {
      socket.emit("bidRejected", {
        message:
          increment > 0
            ? `Bid must be at least ${minBid} (increment ${increment}).`
            : `Bid must be greater than ${currentBid}.`,
      });
      return;
    }

    rooms[roomName].currentBid = amt;
    rooms[roomName].highestBidder = bidderName;

    io.to(roomName).emit("newBid", { bidderName, bidAmount: amt });
    console.log(`${bidderName} bid ${amt} in ${roomName}`);
  });

  // Final call / close lot
  socket.on("finalCall", ({ roomName }) => {
    if (!rooms[roomName]) return;
    io.to(roomName).emit("finalResult", {
      highestBidder: rooms[roomName].highestBidder,
      finalBid: rooms[roomName].currentBid,
      player: rooms[roomName].currentPlayer,
    });
    console.log(
      `Final in ${roomName} -> ${rooms[roomName].highestBidder} @ ${rooms[roomName].currentBid}`
    );
    // (Optionally) reset current lot
    // rooms[roomName].currentPlayer = null;
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});