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
        const { roomCode, player } =