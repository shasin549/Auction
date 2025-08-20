const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static(path.join(__dirname, "public")));

// ==========================
// Auction Room Management
// ==========================
let rooms = {};
// rooms = {
//   ROOMCODE: {
//     increment: 100,
//     participants: [],
//     currentBid: null
//   }
// };

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  // -------------------------
  // Create Auction Room
  // -------------------------
  socket.on("createRoom", ({ roomCode, numParticipants, increment }) => {
    rooms[roomCode] = {
      increment: Number(increment),
      participants: [],
      currentBid: null
    };
    socket.join(roomCode);
    console.log(`Room ${roomCode} created with increment ${increment}`);
  });

  // -------------------------
  // Bidder joins room
  // -------------------------
  socket.on("joinRoom", ({ roomCode, bidderName }) => {
    if (!rooms[roomCode]) {
      socket.emit("errorMsg", "Room not found!");
      return;
    }

    rooms[roomCode].participants.push(bidderName);
    socket.join(roomCode);
    console.log(`${bidderName} joined room ${roomCode}`);

    // Notify auctioneer of participant list
    io.to(roomCode).emit("participantsUpdate", rooms[roomCode].participants);
  });

  // -------------------------
  // Auctioneer starts bidding for a player
  // -------------------------
  socket.on("startBidding", ({ roomCode, player }) => {
    if (!rooms[roomCode]) return;
    rooms[roomCode].currentBid = {
      player,
      highestBid: player.value,
      highestBidder: null
    };

    console.log(`Auction started in room ${roomCode} for ${player.name}`);

    // Notify all bidders with consistent event name
    io.to(roomCode).emit("playerDetails", player);
  });

  // -------------------------
  // Bidder places a bid
  // -------------------------
  socket.on("placeBid", ({ roomCode, bidderName, bidAmount }) => {
    const room = rooms[roomCode];
    if (!room || !room.currentBid) return;

    if (bidAmount > room.currentBid.highestBid) {
      room.currentBid.highestBid = bidAmount;
      room.currentBid.highestBidder = bidderName;

      console.log(`${bidderName} bid ${bidAmount} in room ${roomCode}`);

      // Broadcast highest bid to everyone
      io.to(roomCode).emit("bidUpdate", room.currentBid);
    } else {
      socket.emit("errorMsg", "Bid must be higher than current highest bid!");
    }
  });

  // -------------------------
  // Finalize auction for current player
  // -------------------------
  socket.on("finalCall", ({ roomCode }) => {
    const room = rooms[roomCode];
    if (!room || !room.currentBid) return;

    console.log(
      `Final call in ${roomCode}: ${room.currentBid.player.name} sold to ${room.currentBid.highestBidder} for ${room.currentBid.highestBid}`
    );

    io.to(roomCode).emit("finalResult", room.currentBid);
    room.currentBid = null; // reset for next player
  });

  // -------------------------
  // Disconnect
  // -------------------------
  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

// ==========================
// Start server
// ==========================
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});