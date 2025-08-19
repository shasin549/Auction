import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const io = new Server(server);

app.use(cors());
app.use(express.static(path.join(__dirname, "public")));

let rooms = {}; // { roomCode: { name, increment, players: [], participants: {} } }

function generateRoomCode() {
  return Math.random().toString(36).substr(2, 6).toUpperCase();
}

// Create Room
io.on("connection", (socket) => {
  console.log("New client connected:", socket.id);

  socket.on("createRoom", ({ roomName, increment }, callback) => {
    const roomCode = generateRoomCode();
    rooms[roomCode] = {
      name: roomName,
      increment,
      participants: {},
      currentPlayer: null,
      calls: 0,
    };
    socket.join(roomCode);
    callback({ roomCode });
  });

  // Join Room
  socket.on("joinRoom", ({ roomCode, participantName }, callback) => {
    if (!rooms[roomCode]) {
      return callback({ success: false, message: "Room not found" });
    }
    rooms[roomCode].participants[socket.id] = {
      name: participantName,
      wonPlayers: [],
    };
    socket.join(roomCode);
    io.to(roomCode).emit("participantsUpdate", rooms[roomCode].participants);
    callback({ success: true });
  });

  // Start Player Auction
  socket.on("startPlayer", ({ roomCode, player }, callback) => {
    if (!rooms[roomCode]) return;
    rooms[roomCode].currentPlayer = { ...player, highestBid: player.value, highestBidder: null };
    rooms[roomCode].calls = 0;
    io.to(roomCode).emit("newPlayer", rooms[roomCode].currentPlayer);
    callback({ success: true });
  });

  // Place Bid
  socket.on("placeBid", ({ roomCode, bidAmount }, callback) => {
    const room = rooms[roomCode];
    if (!room || !room.currentPlayer) return;
    if (bidAmount >= room.currentPlayer.highestBid + room.increment) {
      room.currentPlayer.highestBid = bidAmount;
      room.currentPlayer.highestBidder = socket.id;
      room.calls = 0; // reset calls
      io.to(roomCode).emit("bidUpdate", room.currentPlayer);
      callback({ success: true });
    } else {
      callback({ success: false, message: "Bid too low" });
    }
  });

  // Handle Final Call
  socket.on("finalCall", ({ roomCode }) => {
    const room = rooms[roomCode];
    if (!room || !room.currentPlayer) return;
    room.calls++;
    if (room.calls < 3) {
      io.to(roomCode).emit("callUpdate", `${["First", "Second"][room.calls - 1]} Call`);
    } else {
      // Sell player
      const winnerId = room.currentPlayer.highestBidder;
      if (winnerId) {
        room.participants[winnerId].wonPlayers.push(room.currentPlayer);
      }
      io.to(roomCode).emit("playerSold", room.currentPlayer);
      room.currentPlayer = null;
    }
  });

  // Disconnect
  socket.on("disconnect", () => {
    for (let roomCode in rooms) {
      if (rooms[roomCode].participants[socket.id]) {
        delete rooms[roomCode].participants[socket.id];
        io.to(roomCode).emit("participantsUpdate", rooms[roomCode].participants);
      }
    }
    console.log("Client disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));