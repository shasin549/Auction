const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));

const rooms = {};

io.on("connection", (socket) => {
  console.log("New client connected");

  // Create room
  socket.on("createRoom", ({ name }) => {
    const room = Math.floor(1000 + Math.random() * 9000).toString();
    rooms[room] = { participants: [], auctioneer: name };
    socket.join(room);
    socket.emit("roomCreated", { room });
  });

  // Join room
  socket.on("joinRoom", ({ room, name }) => {
    if (!rooms[room]) {
      return;
    }
    socket.join(room);
    rooms[room].participants.push(name);
    io.to(room).emit("updateParticipants", rooms[room].participants.length);
  });

  // Send player details
  socket.on("playerDetails", ({ room, player }) => {
    io.to(room).emit("playerDetails", player);
  });

  // Place bid
  socket.on("placeBid", ({ room, name, amount }) => {
    io.to(room).emit("newBid", { name, amount });
  });

  // Final call
  socket.on("finalCall", ({ room }) => {
    io.to(room).emit("finalCall");
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));