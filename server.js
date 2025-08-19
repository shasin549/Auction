const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, "public")));

// rooms structure:
// rooms[roomCode] = {
//   roomName,
//   increment,
//   participants: { socketId: name, ... },
//   currentPlayer: { name, club, position, style, value },
//   currentBid: number,
//   bids: [ { bidderName, bidAmount, ts }, ... ]
// }
const rooms = {};

// helper: generate short room code
function makeRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  // Create room (auctioneer supplies roomName, participants(optional), increment)
  socket.on("createRoom", ({ roomName, participants, increment }) => {
    const roomCode = makeRoomCode();
    rooms[roomCode] = {
      roomName: roomName || roomCode,
      increment: parseInt(increment, 10) || 0,
      participants: {},
      currentPlayer: null,
      currentBid: 0,
      bids: [],
    };
    socket.join(roomCode);
    // send back roomCode to auctioneer
    socket.emit("roomCreated", { roomCode, roomName: rooms[roomCode].roomName, increment: rooms[roomCode].increment });
    console.log(`Room created ${roomCode} (${rooms[roomCode].roomName}), increment=${rooms[roomCode].increment}`);
  });

  // Auctioneer starts bidding (also serves as preview broadcast)
  socket.on("startBidding", ({ roomCode, player }) => {
    const room = rooms[roomCode];
    if (!room) {
      socket.emit("roomNotFound");
      return;
    }
    // set current player and starting bid
    const start = parseInt(player.value, 10) || 0;
    room.currentPlayer = {
      name: player.name || "",
      club: player.club || "",
      position: player.position || "",
      style: player.style || "",
      value: start,
    };
    room.currentBid = start;
    room.bids = []; // reset bids for new player
    io.to(roomCode).emit("biddingStarted", { player: room.currentPlayer, currentBid: room.currentBid, increment: room.increment });
    console.log(`Bidding started in ${roomCode} for ${room.currentPlayer.name} @ ${start}`);
  });

  // Bidder joins room
  socket.on("joinRoom", ({ roomCode, participantName }) => {
    const room = rooms[roomCode];
    if (!room) {
      socket.emit("roomNotFound");
      return;
    }
    socket.join(roomCode);
    room.participants[socket.id] = participantName || "Anonymous";
    // Send acknowledgement & current state to joining bidder
    socket.emit("roomJoined", { roomCode, roomName: room.roomName, increment: room.increment });
    // If a player is live, send the preview + current bid to this socket immediately
    if (room.currentPlayer) {
      socket.emit("biddingStarted", { player: room.currentPlayer, currentBid: room.currentBid, increment: room.increment });
      // Also send current bid list
      socket.emit("bidsUpdated", { bids: room.bids, currentBid: room.currentBid });
    }
    // update participants list to room (optional UI)
    io.to(roomCode).emit("participantsUpdated", Object.values(room.participants));
    console.log(`${participantName} joined ${roomCode}`);
  });

  // Place bid: either manual bidAmount provided, or bidder wants to increment
  socket.on("placeBid", ({ roomCode, bidderName, bidAmount, useIncrement }) => {
    const room = rooms[roomCode];
    if (!room) {
      socket.emit("roomNotFound");
      return;
    }

    const current = parseInt(room.currentBid || 0, 10);
    const increment = parseInt(room.increment || 0, 10);

    let amount = null;
    if (bidAmount !== undefined && bidAmount !== null && bidAmount !== "") {
      amount = parseInt(bidAmount, 10);
    } else if (useIncrement) {
      amount = current + (increment > 0 ? increment : 1);
    } else {
      // default to increment if nothing given
      amount = current + (increment > 0 ? increment : 1);
    }

    if (isNaN(amount)) {
      socket.emit("bidRejected", { message: "Invalid bid amount" });
      return;
    }

    // must be strictly greater than current
    if (amount <= current) {
      socket.emit("bidRejected", { message: `Bid must be greater than current (${current})` });
      return;
    }

    // record bid
    const bid = { bidderName: bidderName || room.participants[socket.id] || "Unknown", bidAmount: amount, ts: Date.now() };
    room.bids.push(bid);
    // sort descending by amount then by time
    room.bids.sort((a, b) => {
      if (b.bidAmount !== a.bidAmount) return b.bidAmount - a.bidAmount;
      return a.ts - b.ts;
    });
    // update current
    room.currentBid = room.bids[0].bidAmount;
    // broadcast updated bids and new current
    io.to(roomCode).emit("bidsUpdated", { bids: room.bids, currentBid: room.currentBid });
    console.log(`Bid placed in ${roomCode}: ${bid.bidderName} -> ${bid.bidAmount}`);
  });

  // Final call: declare winner for current player
  socket.on("finalCall", ({ roomCode }) => {
    const room = rooms[roomCode];
    if (!room) {
      socket.emit("roomNotFound");
      return;
    }
    const winner = room.bids.length ? room.bids[0] : null;
    io.to(roomCode).emit("finalResult", { winner, player: room.currentPlayer, finalBid: room.currentBid });
    console.log(`Final call in ${roomCode}:`, winner ? `${winner.bidderName} @ ${winner.bidAmount}` : "No bids");
    // keep currentPlayer if needed or clear it for next player
    // room.currentPlayer = null;
  });

  socket.on("disconnect", () => {
    // remove participant from any room lists
    for (const [code, room] of Object.entries(rooms)) {
      if (room.participants[socket.id]) {
        delete room.participants[socket.id];
        io.to(code).emit("participantsUpdated", Object.values(room.participants));
      }
    }
    console.log("Socket disconnected:", socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});