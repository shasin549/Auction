const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));

let rooms = {}; // store auction rooms

io.on("connection", (socket) => {
  console.log("New client connected:", socket.id);

  // Create Room
  socket.on("createRoom", ({ roomName, participants, increment }) => {
    rooms[roomName] = {
      participants,
      increment,
      players: [],
      currentBid: 0,
      highestBidder: null,
    };
    socket.join(roomName);
    io.to(socket.id).emit("roomCreated", { roomName });
  });

  // Join Room
  socket.on("joinRoom", ({ roomName, participantName }) => {
    if (rooms[roomName]) {
      socket.join(roomName);
      io.to(roomName).emit("participantJoined", { participantName });
    } else {
      io.to(socket.id).emit("roomNotFound");
    }
  });

  // Add Player
  socket.on("addPlayer", ({ roomName, player }) => {
    if (rooms[roomName]) {
      rooms[roomName].players.push(player);
      io.to(roomName).emit("playerAdded", player);
    }
  });

  // Start Bidding
  socket.on("startBidding", ({ roomName, player }) => {
    if (rooms[roomName]) {
      rooms[roomName].currentBid = player.value;
      rooms[roomName].highestBidder = null;
      io.to(roomName).emit("biddingStarted", { player, currentBid: player.value });
    }
  });

  // Place Bid
  socket.on("placeBid", ({ roomName, bidderName, bidAmount }) => {
    if (rooms[roomName] && bidAmount > rooms[roomName].currentBid) {
      rooms[roomName].currentBid = bidAmount;
      rooms[roomName].highestBidder = bidderName;
      io.to(roomName).emit("newBid", { bidderName, bidAmount });
    }
  });

  // Final Call
  socket.on("finalCall", ({ roomName }) => {
    if (rooms[roomName]) {
      io.to(roomName).emit("finalResult", {
        highestBidder: rooms[roomName].highestBidder,
        finalBid: rooms[roomName].currentBid,
      });
    }
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});