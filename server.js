import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";

const app = express();
const server = createServer(app);
const io = new Server(server);

app.use(express.static("public"));

let rooms = {}; // Store room data

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // Create room
  socket.on("createRoom", (roomName) => {
    if (!rooms[roomName]) {
      rooms[roomName] = {
        players: [],
        currentPlayer: null,
        highestBid: null,
        highestBidder: null,
      };
      socket.join(roomName);
      socket.emit("roomCreated", roomName);
    } else {
      socket.emit("errorMsg", "Room already exists!");
    }
  });

  // Join room
  socket.on("joinRoom", ({ roomName, participantName }) => {
    if (rooms[roomName]) {
      socket.join(roomName);
      rooms[roomName].players.push({ id: socket.id, name: participantName });
      io.to(roomName).emit("updatePlayers", rooms[roomName].players);
      socket.emit("roomJoined", roomName);
    } else {
      socket.emit("errorMsg", "Room not found!");
    }
  });

  // Start player auction
  socket.on("startAuction", ({ roomName, player }) => {
    if (rooms[roomName]) {
      rooms[roomName].currentPlayer = player;
      rooms[roomName].highestBid = player.value;
      rooms[roomName].highestBidder = null;
      io.to(roomName).emit("auctionStarted", player);
    }
  });

  // Handle bid
  socket.on("placeBid", ({ roomName, bid, bidder }) => {
    if (rooms[roomName] && bid > rooms[roomName].highestBid) {
      rooms[roomName].highestBid = bid;
      rooms[roomName].highestBidder = bidder;
      io.to(roomName).emit("newBid", {
        bid,
        bidder,
      });
    }
  });

  // Finalize auction
  socket.on("finalCall", (roomName) => {
    if (rooms[roomName]) {
      io.to(roomName).emit("auctionFinalized", {
        winner: rooms[roomName].highestBidder,
        bid: rooms[roomName].highestBid,
        player: rooms[roomName].currentPlayer,
      });
    }
  });

  // Disconnect
  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
    for (let room in rooms) {
      rooms[room].players = rooms[room].players.filter(
        (p) => p.id !== socket.id
      );
      io.to(room).emit("updatePlayers", rooms[room].players);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));