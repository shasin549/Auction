const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

let rooms = {};

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // Create Room
  socket.on("createRoom", ({ roomName, increment }) => {
    if (!rooms[roomName]) {
      rooms[roomName] = { increment, bids: [], players: [] };
      socket.join(roomName);
      io.to(socket.id).emit("roomCreated", roomName);
    } else {
      io.to(socket.id).emit("errorMsg", "Room already exists!");
    }
  });

  // Join Room
  socket.on("joinRoom", ({ roomName, participant }) => {
    if (rooms[roomName]) {
      socket.join(roomName);
      io.to(socket.id).emit("joinedRoom", roomName);
    } else {
      io.to(socket.id).emit("errorMsg", "Room not found!");
    }
  });

  // Start Bidding
  socket.on("startBidding", ({ roomName, player }) => {
    rooms[roomName].bids = []; // reset bids for player
    io.to(roomName).emit("playerData", player);
  });

  // Place Bid
  socket.on("placeBid", ({ roomName, amount, bidder }) => {
    rooms[roomName].bids.push({ bidder, amount });
    io.to(roomName).emit("newBid", { bidder, amount });
  });

  // Final Call
  socket.on("finalCall", (roomName) => {
    const lastBid = rooms[roomName].bids.slice(-1)[0];
    io.to(roomName).emit("auctionResult", lastBid || { bidder: "No one", amount: 0 });
  });
});

server.listen(3000, () => {
  console.log("🚀 Server running at http://localhost:3000");
});