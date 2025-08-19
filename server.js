const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

let rooms = {}; // roomCode -> { increment, participants, players: [], currentPlayerIndex, bids: [] }

// Helper to log debug info
function debugLog(msg, data) {
  console.log("[DEBUG]", msg, data || "");
}

io.on("connection", (socket) => {
  debugLog("User connected", socket.id);

  // Create Room
  socket.on("createRoom", ({ room, increment, participants }) => {
    if (!room || rooms[room]) return socket.emit("errorMsg", "Room invalid or exists");
    rooms[room] = { increment, participants, players: [], currentPlayerIndex: 0, bids: [] };
    socket.join(room);
    const inviteLink = `${socket.handshake.headers.origin}/bidder.html?room=${room}`;
    debugLog("Room created", { room, inviteLink });
    socket.emit("roomCreated", { room, inviteLink });
  });

  // Add Player
  socket.on("addPlayer", ({ room, player }) => {
    if (!rooms[room]) return socket.emit("errorMsg", "Room not found");
    rooms[room].players.push(player);
    debugLog("Player added", player);
  });

  // Start Auction
  socket.on("startAuction", ({ room }) => {
    const roomObj = rooms[room];
    if (!roomObj || !roomObj.players.length) return socket.emit("errorMsg", "No players to auction");
    roomObj.currentPlayerIndex = 0;
    const player = roomObj.players[roomObj.currentPlayerIndex];
    roomObj.bids = [];
    io.to(room).emit("playerDetails", player);
    debugLog("Auction started", player);
  });

  // Bidder joins
  socket.on("joinRoom", ({ room, name }) => {
    const roomObj = rooms[room];
    if (!roomObj) return socket.emit("errorMsg", "Room not found");
    socket.join(room);
    socket.emit("playerDetails", roomObj.players[roomObj.currentPlayerIndex]);
    debugLog("Bidder joined", { room, name });
  });

  // Place Bid
  socket.on("placeBid", ({ room, name, amount }) => {
    const roomObj = rooms[room];
    if (!roomObj) return socket.emit("errorMsg", "Room not found");
    if (amount <= 0) return socket.emit("errorMsg", "Invalid bid amount");
    roomObj.bids.push({ name, amount });
    io.to(room).emit("newBid", { name, amount });
    debugLog("Bid placed", { name, amount });
  });

  socket.on("disconnect", () => {
    debugLog("User disconnected", socket.id);
  });
});

server.listen(3000, () => console.log("Server running at http://localhost:3000"));