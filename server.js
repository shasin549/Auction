import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

const PORT = process.env.PORT || 3000;

app.use(express.static("public"));

const rooms = new Map(); 
/*
rooms = {
  roomCode: {
    roomName,
    maxParticipants,
    bidIncrement,
    participants: Set(),
    players: [],
    callStage: 0,
    highestBidder: null,
  }
}
*/

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("create-room", ({ roomName, maxParticipants, bidIncrement, roomCode }) => {
    if (rooms.has(roomCode)) {
      socket.emit("room-create-error", "Room code already exists.");
      return;
    }
    rooms.set(roomCode, {
      roomName,
      maxParticipants,
      bidIncrement,
      participants: new Set(),
      players: [],
      callStage: 0,
      highestBidder: null,
    });
    socket.join(roomCode);
    socket.emit("room-created", { roomCode });
    console.log(`Room created: ${roomCode} by ${socket.id}`);
  });

  socket.on("join-room", ({ participantName, roomCode }) => {
    const room = rooms.get(roomCode);
    if (!room) {
      socket.emit("room-join-error", "Room not found.");
      return;
    }
    if (room.participants.size >= room.maxParticipants) {
      socket.emit("room-join-error", "Room is full.");
      return;
    }
    room.participants.add(participantName);
    socket.join(roomCode);

    io.to(roomCode).emit("new-participant", { roomCode, participantName });

    // Send room details and current players to new participant
    socket.emit("room-joined", {
      roomName: room.roomName,
      bidIncrement: room.bidIncrement,
      players: room.players,
    });

    console.log(`${participantName} joined room ${roomCode}`);
  });

  socket.on("update-players", ({ roomCode, players }) => {
    const room = rooms.get(roomCode);
    if (!room) return;
    room.players = players;
    io.to(roomCode).emit("update-players", { players });
  });

  socket.on("start-bidding", ({ roomCode }) => {
    const room = rooms.get(roomCode);
    if (!room) return;
    room.callStage = 0;
    room.highestBidder = null;
    io.to(roomCode).emit("bidding-started");
    console.log(`Bidding started in room ${roomCode}`);
  });

  socket.on("final-call", ({ roomCode, stage }) => {
    const room = rooms.get(roomCode);
    if (!room) return;
    room.callStage = stage === "first" ? 1 : stage === "second" ? 2 : 0;
    io.to(roomCode).emit("final-call-update", { stage });
  });

  socket.on("place-bid", ({ roomCode, bidderName, amount }) => {
    const room = rooms.get(roomCode);
    if (!room) return;

    const player = room.players.find((p) => !p.sold);
    if (!player) return;

    if (amount >= player.currentBid + room.bidIncrement) {
      player.currentBid = amount;
      player.highestBidder = bidderName;
      room.highestBidder = bidderName;
      io.to(roomCode).emit("new-bid", { roomCode, bidderName, amount, players: room.players });
      io.to(roomCode).emit("update-players", { players: room.players });
    }
  });

  socket.on("player-sold", ({ roomCode, player, highestBidder }) => {
    const room = rooms.get(roomCode);
    if (!room) return;

    const idx = room.players.findIndex((p) => p.id === player.id);
    if (idx !== -1) {
      room.players[idx] = player;
      io.to(roomCode).emit("player-sold", { player, highestBidder });
      io.to(roomCode).emit("update-players", { players: room.players });
    }
  });

  socket.on("leave-room", ({ participantName, roomCode }) => {
    const room = rooms.get(roomCode);
    if (!room) return;
    room.participants.delete(participantName);
    io.to(roomCode).emit("participant-left", { participantName });
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});