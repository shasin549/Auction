const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const rooms = {}; // { roomCode: { auctioneer, increment, players, bidders, currentIndex, bids } }

app.use(express.static(path.join(__dirname, "public")));

// Auctioneer creates a room
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("createRoom", ({ room, increment }) => {
    if (rooms[room]) {
      socket.emit("errorMsg", "Room already exists!");
      return;
    }

    rooms[room] = {
      auctioneer: socket.id,
      increment,
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

  socket.on("joinRoom", ({ room, name }) => {
    if (!rooms[room]) {
      socket.emit("errorMsg", "Room not found!");
      return;
    }
    socket.join(room);
    rooms[room].bidders.push({ id: socket.id, name });
    io.to(room).emit("biddersUpdate", rooms[room].bidders);
    console.log(`${name} joined room ${room}`);
  });

  socket.on("addPlayer", ({ room, player }) => {
    if (rooms[room]) {
      rooms[room].players.push(player);
      io.to(room).emit("playerAdded", player);
    }
  });

  socket.on("startAuction", ({ room }) => {
    if (rooms[room]) {
      rooms[room].currentIndex++;
      const player = rooms[room].players[rooms[room].currentIndex];
      if (player) {
        rooms[room].bids = [];
        io.to(room).emit("playerDetails", player);
      }
    }
  });

  socket.on("placeBid", ({ room, name, amount }) => {
    if (rooms[room]) {
      rooms[room].bids.push({ name, amount });
      io.to(room).emit("newBid", { name, amount });
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));