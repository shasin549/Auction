const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const rooms = {}; // store rooms in memory

app.use(express.static(path.join(__dirname, "public")));

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // Auctioneer creates a room
  socket.on("createRoom", ({ room, increment, participants }) => {
    if (rooms[room]) {
      socket.emit("errorMsg", "Room already exists!");
      return;
    }
    rooms[room] = {
      auctioneer: socket.id,
      increment,
      participants,
      players: [],
      bidders: [],
      currentIndex: -1,
      bids: []
    };
    socket.join(room);

    const inviteLink = `http://localhost:3000/bidder.html?room=${room}`;
    socket.emit("roomCreated", { room, inviteLink });
    console.log(`Room ${room} created`);
  });

  // Auctioneer adds player
  socket.on("addPlayer", ({ room, player }) => {
    if (rooms[room]) {
      rooms[room].players.push(player);
      io.to(room).emit("playerList", rooms[room].players);
    }
  });

  // Auctioneer starts next player auction
  socket.on("startAuction", ({ room }) => {
    const r = rooms[room];
    if (!r) return;
    r.currentIndex++;
    if (r.currentIndex < r.players.length) {
      const player = r.players[r.currentIndex];
      r.bids = [];
      io.to(room).emit("playerDetails", player);
    } else {
      io.to(room).emit("auctionOver");
    }
  });

  // Bidder joins
  socket.on("joinRoom", ({ room, name }) => {
    if (!rooms[room]) {
      socket.emit("errorMsg", "Room not found!");
      return;
    }
    rooms[room].bidders.push({ id: socket.id, name });
    socket.join(room);
    socket.emit("joinedRoom", { room, name, increment: rooms[room].increment });
    console.log(`${name} joined room ${room}`);
  });

  // Place bid
  socket.on("placeBid", ({ room, name, amount }) => {
    const r = rooms[room];
    if (!r) return;
    r.bids.push({ name, amount });
    io.to(room).emit("newBid", { name, amount });
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));