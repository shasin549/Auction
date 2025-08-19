import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));

let rooms = {};

io.on("connection", (socket) => {
  console.log("New client connected:", socket.id);

  socket.on("createRoom", ({ roomName, participants, increment }) => {
    rooms[roomName] = {
      participants,
      increment,
      currentBid: 0,
      currentBidder: null,
      players: [],
    };
    socket.join(roomName);
    io.to(socket.id).emit("roomCreated", { roomName });
    console.log(`Room created: ${roomName}`);
  });

  socket.on("joinRoom", ({ roomName, participantName }) => {
    if (rooms[roomName]) {
      socket.join(roomName);
      io.to(roomName).emit("message", `${participantName} joined the room`);
    } else {
      io.to(socket.id).emit("error", "Room not found");
    }
  });

  socket.on("startPlayer", ({ roomName, player }) => {
    if (rooms[roomName]) {
      rooms[roomName].currentBid = player.value;
      rooms[roomName].currentBidder = null;
      io.to(roomName).emit("newPlayer", player);
    }
  });

  socket.on("placeBid", ({ roomName, bidder, bidValue }) => {
    if (rooms[roomName] && bidValue > rooms[roomName].currentBid) {
      rooms[roomName].currentBid = bidValue;
      rooms[roomName].currentBidder = bidder;
      io.to(roomName).emit("bidUpdate", {
        bidder,
        bidValue,
      });
    }
  });

  socket.on("finalCall", ({ roomName }) => {
    if (rooms[roomName]) {
      io.to(roomName).emit("finalResult", {
        winner: rooms[roomName].currentBidder,
        amount: rooms[roomName].currentBid,
      });
    }
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));