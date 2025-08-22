const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Store active rooms and bids
const rooms = new Map();
const bids = new Map();

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    
    // Join room
    socket.on('join-room', (data) => {
        const { roomCode, userName, isAuctioneer } = data;
        
        socket.join(roomCode);
        
        if (!rooms.has(roomCode)) {
            rooms.set(roomCode, {
                participants: new Map(),
                auctioneer: isAuctioneer ? socket.id : null,
                status: 'waiting'
            });
        }
        
        const room = rooms.get(roomCode);
        room.participants.set(socket.id, userName);
        
        // Notify room about new participant
        socket.to(roomCode).emit('participant-joined', {
            userName,
            participants: Array.from(room.participants.values())
        });
        
        // Send current room status to the new participant
        socket.emit('room-status', {
            participants: Array.from(room.participants.values()),
            auctioneer: room.auctioneer ? true : false,
            status: room.status
        });
        
        console.log(`${userName} joined room ${roomCode}`);
    });
    
    // Start bidding
    socket.on('start-bidding', (data) => {
        const { roomCode, player } = data;
        const room = rooms.get(roomCode);
        
        if (room && socket.id === room.auctioneer) {
            room.status = 'bidding';
            room.currentPlayer = player;
            room.currentBid = player.value;
            
            io.to(roomCode).emit('bidding-started', {
                player,
                currentBid: player.value
            });
            
            console.log(`Bidding started in room ${roomCode} for player ${player.name}`);
        }
    });
    
    // Place bid
    socket.on('place-bid', (data) => {
        const { roomCode, amount, userName } = data;
        const room = rooms.get(roomCode);
        
        if (room && room.status === 'bidding' && amount > room.currentBid) {
            room.currentBid = amount;
            room.lastBidder = userName;
            
            // Store bid history
            if (!bids.has(roomCode)) {
                bids.set(roomCode, []);
            }
            bids.get(roomCode).push({ userName, amount, timestamp: Date.now() });
            
            io.to(roomCode).emit('new-bid', {
                userName,
                amount,
                currentBid: room.currentBid
            });
            
            console.log(`New bid in room ${roomCode}: ${userName} bid ${amount}`);
        }
    });
    
    // Final call
    socket.on('final-call', (data) => {
        const { roomCode } = data;
        const room = rooms.get(roomCode);
        
        if (room && socket.id === room.auctioneer) {
            io.to(roomCode).emit('final-call', {
                message: 'Final call! Going once, going twice...'
            });
            
            console.log(`Final call in room ${roomCode}`);
        }
    });
    
    // Sold
    socket.on('sold', (data) => {
        const { roomCode, player, amount, winner } = data;
        const room = rooms.get(roomCode);
        
        if (room && socket.id === room.auctioneer) {
            room.status = 'waiting';
            
            io.to(roomCode).emit('sold', {
                player,
                amount,
                winner
            });
            
            console.log(`Sold in room ${roomCode}: ${player.name} to ${winner} for ${amount}`);
        }
    });
    
    // Disconnect
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        
        // Remove user from rooms
        for (const [roomCode, room] of rooms.entries()) {
            if (room.participants.has(socket.id)) {
                const userName = room.participants.get(socket.id);
                room.participants.delete(socket.id);
                
                // Notify room about participant leaving
                socket.to(roomCode).emit('participant-left', {
                    userName,
                    participants: Array.from(room.participants.values())
                });
                
                // If auctioneer leaves, disband room
                if (room.auctioneer === socket.id) {
                    io.to(roomCode).emit('room-closed', {
                        message: 'Auctioneer left the room'
                    });
                    rooms.delete(roomCode);
                }
                
                console.log(`${userName} left room ${roomCode}`);
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});