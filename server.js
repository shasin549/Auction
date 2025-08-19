import express from "express";
import http from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));

let rooms = {}; // { roomCode: { roomName, participants, bidIncrement, players, bids } }

io.on("connection", (socket) => {
  console.log("🔗 A user connected:", socket.id);

  socket.on("createRoom", ({ roomName, participants, bidIncrement }) => {
    const roomCode = Math.random().toString(36).substring(2, 7).toUpperCase();
    rooms[roomCode] = {
      roomName,
      participants,
      bidIncrement,
      players: [],
      bids: [],
    };

    socket.join(roomCode);
    socket.emit("roomCreated", { roomCode });
    console.log(`✅ Room created: ${roomCode}`);
  });

  socket.on("joinRoom", ({ roomCode, bidderName }) => {
    if (rooms[roomCode]) {
      socket.join(roomCode);
      socket.emit("roomJoined", { success: true, roomCode });
      console.log(`👤 ${bidderName} joined room ${roomCode}`);
    } else {
      socket.emit("roomJoined", { success: false, message: "Room not found" });
    }
  });

  socket.on("addPlayer", ({ roomCode, player }) => {
    if (rooms[roomCode]) {
      rooms[roomCode].players.push(player);
      io.to(roomCode).emit("playerAdded", player);
    }
  });

  socket.on("startBidding", ({ roomCode, player }) => {
    io.to(roomCode).emit("biddingStarted", player);
  });

  socket.on("placeBid", ({ roomCode, bidderName, bidAmount }) => {
    if (rooms[roomCode]) {
      const bid = { bidderName, bidAmount };
      rooms[roomCode].bids.push(bid);

      // Sort bids, highest first
      rooms[roomCode].bids.sort((a, b) => b.bidAmount - a.bidAmount);

      io.to(roomCode).emit("bidPlaced", rooms[roomCode].bids);
      console.log(`💰 ${bidderName} placed bid of ${bidAmount} in ${roomCode}`);
    }
  });

  socket.on("disconnect", () => {
    console.log("❌ User disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Server running on ${PORT}`));