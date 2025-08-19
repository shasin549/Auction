import express from "express";
import http from "http";
import { Server } from "socket.io";

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

let auctionRoom = {
  roomName: "Premier League Auction",
  participants: [],
  bidIncrement: 1000,
  roomCode: "ABCD123"
};

io.on("connection", socket => {

  // Auctioneer requests info
  socket.on("requestAuctioneerInfo", () => {
    socket.emit("updateAuctioneerInfo", auctionRoom);
  });

  // Bidder joins
  socket.on("joinAsBidder", ({ name }) => {
    auctionRoom.participants.push({ id: socket.id, name });
    socket.emit("updateBidderInfo", { roomCode: auctionRoom.roomCode });
    io.emit("updateAuctioneerInfo", auctionRoom); // update auctioneer live
  });

  // Handle disconnect
  socket.on("disconnect", () => {
    auctionRoom.participants = auctionRoom.participants.filter(p => p.id !== socket.id);
    io.emit("updateAuctioneerInfo", auctionRoom);
  });
});

server.listen(3000, () => console.log("Server running at http://localhost:3000"));