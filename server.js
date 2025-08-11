import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

app.use(express.static(path.join(__dirname, "public")));

function makeCode(len = 3) {
  return crypto.randomBytes(4).toString("hex").slice(0, len).toUpperCase();
}

const rooms = {}; // { code: { name, auctioneer, participants:[], increment, player, highestBid, highestBidder, callStage } }

io.on("connection", (socket) => {
  console.log("connected", socket.id);

  socket.on("createRoom", ({ roomName, participants, increment }) => {
    const roomCode = makeCode(3);
    rooms[roomCode] = {
      name: roomName || roomCode,
      auctioneer: socket.id,
      participants: [],
      increment: Number(increment) || 1,
      player: null,
      highestBid: 0,
      highestBidder: null,
      callStage: 0
    };
    socket.join(roomCode);
    socket.emit("roomCreated", { roomName: rooms[roomCode].name, roomCode });
    console.log("room created", roomCode);
  });

  socket.on("joinRoom", ({ roomCode, participantName }) => {
    const room = rooms[roomCode];
    if (!room) {
      socket.emit("joinError", "Room not found");
      return;
    }
    const p = { id: socket.id, name: participantName, wins: [] };
    room.participants.push(p);
    socket.join(roomCode);
    io.to(roomCode).emit("participantsUpdate", room.participants.map(x => ({ name: x.name, wins: x.wins })));
    console.log(`${participantName} joined ${roomCode}`);
  });

  socket.on("uploadPlayer", ({ roomCode, player }) => {
    const room = rooms[roomCode];
    if (!room) return;
    room.player = player;
    room.highestBid = Number(player.value) || 0;
    room.highestBidder = null;
    room.callStage = 0;
    io.to(roomCode).emit("playerUpdate", { ...player, highestBid: room.highestBid });
  });

  socket.on("startBidding", ({ roomCode }) => {
    const room = rooms[roomCode];
    if (!room || !room.player) return;
    room.callStage = 0;
    io.to(roomCode).emit("biddingStarted", { highestBid: room.highestBid, highestBidder: room.highestBidder });
  });

  socket.on("placeBid", ({ roomCode, bidderName }) => {
    const room = rooms[roomCode];
    if (!room) return;
    room.highestBid = Number(room.highestBid) + Number(room.increment);
    room.highestBidder = bidderName;
    room.callStage = 0; // reset call if bidding occurs
    io.to(roomCode).emit("bidUpdate", { highestBid: room.highestBid, highestBidder: bidderName });
  });

  socket.on("finalCall", ({ roomCode }) => {
    const room = rooms[roomCode];
    if (!room) return;
    room.callStage++;
    const messages = ["First Call", "Second Call", "Final Call"];
    if (room.callStage < 3) {
      io.to(roomCode).emit("callUpdate", { msg: messages[room.callStage - 1], stage: room.callStage });
    } else {
      // Finalize sale if we have a bidder
      if (room.highestBidder) {
        const sold = {
          player: room.player,
          winner: room.highestBidder,
          price: room.highestBid
        };
        // add to winner's wins
        const winner = room.participants.find(p => p.name === room.highestBidder);
        if (winner) winner.wins.push({ ...room.player, soldPrice: room.highestBid });
        io.to(roomCode).emit("playerSold", sold);
      } else {
        io.to(roomCode).emit("callUpdate", { msg: "No bids placed, unsold", stage: 3 });
      }
      room.callStage = 0;
      room.player = null;
      room.highestBid = 0;
      room.highestBidder = null;
      // participantsUpdate will reflect each participant's wins if needed
      io.to(roomCode).emit("participantsUpdate", room.participants.map(x => ({ name: x.name, wins: x.wins })));
    }
  });

  socket.on("requestParticipants", ({ roomCode }) => {
    const room = rooms[roomCode];
    if (!room) return;
    socket.emit("participantsUpdate", room.participants.map(x => ({ name: x.name, wins: x.wins })));
  });

  socket.on("disconnecting", () => {
    // optionally cleanup participants from rooms
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("Server started on port", PORT));