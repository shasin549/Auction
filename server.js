import express from "express";
import http from "http";
import { Server } from "socket.io";

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

let rooms = {};

io.on("connection", (socket) => {
  socket.on("createRoom", ({ roomName, participants, bidIncrement }, callback) => {
    const roomCode = Math.random().toString(36).substr(2, 6).toUpperCase();
    rooms[roomCode] = {
      name: roomName,
      participants: [],
      bidIncrement: parseInt(bidIncrement),
      highestBid: 0,
      highestBidder: null,
      currentPlayer: null
    };
    socket.join(roomCode);
    callback(roomCode);
  });

  socket.on("joinRoom", ({ name, roomCode }, callback) => {
    if (rooms[roomCode]) {
      rooms[roomCode].participants.push({ id: socket.id, name, won: [] });
      socket.join(roomCode);
      io.to(roomCode).emit("participantsUpdate", rooms[roomCode].participants);
      callback(true);
    } else {
      callback(false);
    }
  });

  socket.on("startBidding", ({ roomCode, player }) => {
    if (rooms[roomCode]) {
      rooms[roomCode].currentPlayer = player;
      rooms[roomCode].highestBid = player.value;
      rooms[roomCode].highestBidder = null;
      io.to(roomCode).emit("newPlayer", player);
    }
  });

  socket.on("placeBid", ({ roomCode, name }) => {
    const room = rooms[roomCode];
    if (room) {
      room.highestBid += room.bidIncrement;
      room.highestBidder = name;
      io.to(roomCode).emit("updateBid", room.highestBid);
    }
  });

  socket.on("finalizeSale", (roomCode) => {
    const room = rooms[roomCode];
    if (room && room.highestBidder) {
      const winner = room.participants.find(p => p.name === room.highestBidder);
      if (winner) {
        winner.won.push(room.currentPlayer);
        io.to(roomCode).emit("playerWon", room.currentPlayer);
      }
    }
  });
});

server.listen(3000, () => console.log("Server running on http://localhost:3000"));