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

// Auction rooms data in-memory
let rooms = {};

// ---- SOCKET HANDLERS ----
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // Create Room
  socket.on("createRoom", ({ roomName, numParticipants, bidIncrement }) => {
    if (rooms[roomName]) {
      socket.emit("errorMsg", "Room already exists. Choose another name.");
      return;
    }

    rooms[roomName] = {
      participants: {},
      numParticipants,
      bidIncrement,
      currentBid: 0,
      currentPlayer: null
    };

    socket.join(roomName);
    console.log(`Room created: ${roomName}`);

    socket.emit("roomCreated", { roomName });
  });

  // Join Room
  socket.on("joinRoom", ({ roomCode, participantName }) => {
    if (!rooms[roomCode]) {
      socket.emit("errorMsg", "Room not found.");
      return;
    }

    rooms[roomCode].participants[socket.id] = participantName;
    socket.join(roomCode);

    console.log(`${participantName} joined ${roomCode}`);
    io.to(roomCode).emit("updateParticipants", Object.values(rooms[roomCode].participants));
  });

  // Preview Player
  socket.on("previewPlayer", (player) => {
    if (!rooms[player.room]) return;
    rooms[player.room].currentPlayer = player;

    console.log(`Previewing player in ${player.room}:`, player);
    io.to(player.room).emit("playerPreview", player);
  });

  // Start Bidding
  socket.on("startBidding", ({ room }) => {
    if (!rooms[room]) return;
    rooms[room].currentBid = 0;

    console.log(`Bidding started in ${room}`);
    io.to(room).emit("updateBid", 0);
  });

  // Place Bid
  socket.on("placeBid", ({ roomCode, participantName, bidValue }) => {
    if (!rooms[roomCode]) return;

    rooms[roomCode].currentBid = bidValue;

    console.log(`${participantName} bid ${bidValue} in ${roomCode}`);
    io.to(roomCode).emit("updateBid", bidValue);
  });

  // Final Call
  socket.on("finalCall", ({ room }) => {
    if (!rooms[room]) return;

    console.log(`Final call in ${room}`);
    io.to(room).emit("finalCall", {
      winner: rooms[room].currentBid,
      player: rooms[room].currentPlayer
    });
  });

  // Handle Disconnect
  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);

    for (let room in rooms) {
      if (rooms[room].participants[socket.id]) {
        delete rooms[room].participants[socket.id];
        io.to(room).emit("updateParticipants", Object.values(rooms[room].participants));
      }
    }
  });
});

// ---- START SERVER ----
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});