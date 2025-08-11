// server.js
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
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(path.join(__dirname, "public")));

function makeCode(len = 4) {
  return crypto.randomBytes(4).toString("hex").slice(0, len).toUpperCase();
}

/*
rooms structure:
rooms = {
  ROOMCODE: {
    name,
    auctioneerSocketId,
    increment,
    participants: [{id, name, wins:[]}],
    player: { name, club, position, style, value, image },
    highestBid: number,
    highestBidder: string|null,
    callStage: 0 | 1 | 2
  }
}
*/
const rooms = {};

io.on("connection", (socket) => {
  console.log("conn:", socket.id);

  socket.on("createRoom", ({ roomName, participants, increment }) => {
    const roomCode = makeCode(4);
    rooms[roomCode] = {
      name: roomName || roomCode,
      auctioneerSocketId: socket.id,
      increment: Number(increment) || 1,
      participants: [],
      player: null,
      highestBid: 0,
      highestBidder: null,
      callStage: 0
    };
    socket.join(roomCode);
    socket.emit("roomCreated", { roomName: rooms[roomCode].name, roomCode });
    console.log("created", roomCode);
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

    // Give the new bidder the current state (player + highestBid + increment + participants)
    socket.emit("joinedSuccess", {
      roomCode,
      roomName: room.name,
      increment: room.increment,
      player: room.player,
      highestBid: room.highestBid,
      highestBidder: room.highestBidder,
      participants: room.participants.map(pp => ({ name: pp.name, wins: pp.wins }))
    });

    // notify all participants
    io.to(roomCode).emit("participantsUpdate", room.participants.map(pp => ({ name: pp.name, wins: pp.wins })));
    console.log(`${participantName} joined ${roomCode}`);
  });

  socket.on("uploadPlayer", ({ roomCode, player }) => {
    const room = rooms[roomCode];
    if (!room) return;
    room.player = player;
    room.highestBid = Number(player.value) || 0;
    room.highestBidder = null;
    room.callStage = 0;
    io.to(roomCode).emit("playerUpdate", { player: room.player, highestBid: room.highestBid });
    console.log("player uploaded to", roomCode, player.name);
  });

  socket.on("startBidding", ({ roomCode }) => {
    const room = rooms[roomCode];
    if (!room || !room.player) return;
    room.callStage = 0;
    // broadcast bidding started with current highest & increment
    io.to(roomCode).emit("biddingStarted", { highestBid: room.highestBid, highestBidder: room.highestBidder, increment: room.increment });
  });

  socket.on("placeBid", ({ roomCode, bidderName, bidAmount }) => {
    const room = rooms[roomCode];
    if (!room) return;
    const bid = Number(bidAmount);
    if (!Number.isFinite(bid) || bid <= 0) {
      socket.emit("bidError", "Invalid bid amount");
      return;
    }

    // Validate: must be >= current highest + increment
    const minAccept = Number(room.highestBid) + Number(room.increment);
    if (bid < minAccept) {
      socket.emit("bidError", `Bid must be at least ${minAccept}`);
      return;
    }

    // Validate: must be multiple of increment relative to base increment (auctioneer's rule)
    const increment = Number(room.increment);
    // We'll check (bid - base) % increment === 0 where base is initial player value or 0
    // Simpler: require bid % increment === 0 (user demanded multiples of increment)
    if (bid % increment !== 0) {
      socket.emit("bidError", `Bid must be a multiple of ${increment}`);
      return;
    }

    // accept bid
    room.highestBid = bid;
    room.highestBidder = bidderName;
    room.callStage = 0; // reset any call stage when a bid arrives
    io.to(roomCode).emit("bidUpdate", { highestBid: room.highestBid, highestBidder: room.highestBidder });
    console.log(`Bid accepted ${bid} by ${bidderName} in ${roomCode}`);
  });

  socket.on("finalCall", ({ roomCode }) => {
    const room = rooms[roomCode];
    if (!room) return;
    room.callStage++;
    if (room.callStage === 1) {
      io.to(roomCode).emit("callUpdate", { msg: "First Call", stage: 1 });
    } else if (room.callStage === 2) {
      io.to(roomCode).emit("callUpdate", { msg: "Second Call", stage: 2 });
    } else {
      // Final call pressed (3rd)
      if (room.highestBidder) {
        const sold = { player: room.player, winner: room.highestBidder, price: room.highestBid };
        // add to winner wins list (if present)
        const winnerObj = room.participants.find(p => p.name === room.highestBidder);
        if (winnerObj) winnerObj.wins.push({ ...room.player, soldPrice: room.highestBid });
        io.to(roomCode).emit("playerSold", sold);
      } else {
        io.to(roomCode).emit("callUpdate", { msg: "No bids — player unsold", stage: 3 });
      }
      // reset player slot
      room.player = null;
      room.highestBid = 0;
      room.highestBidder = null;
      room.callStage = 0;
      io.to(roomCode).emit("participantsUpdate", room.participants.map(pp => ({ name: pp.name, wins: pp.wins })));
    }
  });

  socket.on("requestParticipants", ({ roomCode }) => {
    const room = rooms[roomCode];
    if (!room) return;
    socket.emit("participantsUpdate", room.participants.map(pp => ({ name: pp.name, wins: pp.wins })));
  });

  socket.on("disconnect", () => {
    // Optionally remove participant from rooms (not implemented here)
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("Server listening on", PORT));