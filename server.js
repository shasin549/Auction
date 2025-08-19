const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));

let rooms = {}; // store auction data

io.on("connection", (socket) => {
  console.log("New client connected");

  // Auctioneer creates room
  socket.on("createRoom", ({ roomName, participants, increment }) => {
    rooms[roomName] = {
      participants,
      increment,
      players: [],
      bidders: []
    };
    socket.join(roomName);
    socket.emit("roomCreated", { roomName });
  });

  // Bidder joins room
  socket.on("joinRoom", ({ roomName, bidderName }) => {
    if (rooms[roomName]) {
      rooms[roomName].bidders.push(bidderName);
      socket.join(roomName);
      socket.emit("roomJoined", { roomName });
    } else {
      socket.emit("errorMsg", "Room not found");
    }
  });

  // Auctioneer adds player
  socket.on("addPlayer", (data) => {
    const { roomName, player } = data;
    if (rooms[roomName]) {
      rooms[roomName].players.push(player);
      io.to(roomName).emit("newPlayer", player);
    }
  });

  // Start bidding
  socket.on("startBidding", ({ roomName }) => {
    io.to(roomName).emit("biddingStarted");
  });

  // Bid submitted
  socket.on("placeBid", ({ roomName, bidder, bid }) => {
    io.to(roomName).emit("newBid", { bidder, bid });
  });

  // Final call
  socket.on("finalCall", ({ roomName }) => {
    io.to(roomName).emit("finalCall");
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));