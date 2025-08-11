import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

let rooms = {}; // Store auction data

io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);

    socket.on('createRoom', (data) => {
        const { roomName, participants, increment } = data;
        rooms[roomName] = {
            auctioneer: socket.id,
            participants: [],
            increment,
            player: null,
            highestBid: 0,
            highestBidder: null,
            callStage: 0
        };
        socket.join(roomName);
        socket.emit('roomCreated', { roomName });
    });

    socket.on('joinRoom', ({ roomCode, participantName }) => {
        if (rooms[roomCode]) {
            rooms[roomCode].participants.push({
                id: socket.id,
                name: participantName,
                wins: []
            });
            socket.join(roomCode);
            io.to(roomCode).emit('participantsUpdate', rooms[roomCode].participants);
        }
    });

    socket.on('uploadPlayer', ({ roomCode, player }) => {
        rooms[roomCode].player = player;
        rooms[roomCode].highestBid = player.value;
        rooms[roomCode].highestBidder = null;
        io.to(roomCode).emit('playerUpdate', player);
    });

    socket.on('placeBid', ({ roomCode, bidderName }) => {
        rooms[roomCode].highestBid += rooms[roomCode].increment;
        rooms[roomCode].highestBidder = bidderName;
        rooms[roomCode].callStage = 0;
        io.to(roomCode).emit('bidUpdate', {
            highestBid: rooms[roomCode].highestBid,
            highestBidder: bidderName
        });
    });

    socket.on('finalCall', ({ roomCode }) => {
        let room = rooms[roomCode];
        if (!room) return;

        room.callStage++;
        let callMessages = ["First Call!", "Second Call!", "Final Call!"];
        
        if (room.callStage < 3) {
            io.to(roomCode).emit('callUpdate', callMessages[room.callStage - 1]);
        } else {
            if (room.highestBidder) {
                io.to(roomCode).emit('playerSold', {
                    player: room.player,
                    winner: room.highestBidder,
                    price: room.highestBid
                });

                let winnerData = room.participants.find(p => p.name === room.highestBidder);
                if (winnerData) {
                    winnerData.wins.push({
                        ...room.player,
                        soldPrice: room.highestBid
                    });
                }
            }
            room.callStage = 0;
        }
    });
});

// ✅ Use Render's provided PORT
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});