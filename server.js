// server.js (ESM compatible for Node 22+)
import express from "express";
import http from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";

// Fix __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));

let rooms = {}; // Store auction data

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  // Auctioneer creates room
  socket.on("createRoom", ({ roomName, participants, increment }) => {
    rooms[roomName] = {
      participants: [],
      increment: increment,
      currentBid: 0,
      currentPlayer: null,
      auctioneer: socket.id,
    };
    socket.join(roomName);
    io.to(socket.id).emit("roomCreated", { roomName });
    console.log(`Room created: ${roomName}`);
  });

  // Bidder joins room
  socket.on("joinRoom", ({ roomName, participantName }) => {
    if (rooms[roomName]) {
      rooms[roomName].participants.push({
        id: socket.id,
        name: participantName,
      });
      socket.join(roomName);
      io.to(roomName).emit("participantJoined", {
        name: participantName,
        participants: rooms[roomName].participants,
      });
      console.log(`${participantName} joined ${roomName}`);
    } else {
      io.to(socket.id).emit("error", { message: "Room not found" });
    }
  });

  // Auctioneer sets player details
  socket.on("setPlayer", ({ roomName, player }) => {
    if (rooms[roomName]) {
      rooms[roomName].currentPlayer = player;
      rooms[roomName].currentBid = player.value;
      io.to(roomName).emit("playerUpdate", player);
    }
  });

  // Bidding
  socket.on("placeBid", ({ roomName, bidValue, bidder }) => {
    if (rooms[roomName]) {
      if (bidValue > rooms[roomName].currentBid) {
        rooms[roomName].currentBid = bidValue;
        io.to(roomName).emit("newBid", {
          bidder,
          bid: bidValue,
        });
      }
    }
  });

  // Auctioneer final call
  socket.on("finalCall", ({ roomName }) => {
    if (rooms[roomName]) {
      io.to(roomName).emit("finalCallMade", {
        winner: rooms[roomName].currentBid,
      });
    }
  });

  // Disconnect
  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
    for (let room in rooms) {
      rooms[room].participants = rooms[room].participants.filter(
        (p) => p.id !== socket.id
      );
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});