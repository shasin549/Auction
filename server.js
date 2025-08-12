import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

const PORT = process.env.PORT || 3000;

app.use(express.static('public'));

let currentBid = 0;
let currentWinner = null;

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.emit('bidUpdate', { currentBid, currentWinner });

  socket.on('placeBid', (data) => {
    if (data.amount > currentBid) {
      currentBid = data.amount;
      currentWinner = data.user;
      io.emit('bidUpdate', { currentBid, currentWinner });
      console.log(`New bid: ${currentBid} by ${currentWinner}`);
    } else {
      socket.emit('bidRejected', { reason: 'Bid must be higher than current bid.' });
    }
  });

  socket.on('nextPlayer', () => {
    currentBid = 0;
    currentWinner = null;
    io.emit('resetAuction');
    console.log('Auction reset for next player.');
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});