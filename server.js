const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Serve static files
app.use(express.static(path.join(__dirname)));

// Serve Socket.io client library
app.get('/socket.io/socket.io.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'node_modules/socket.io/client-dist/socket.io.js'));
});

// Store active rooms and their data
const rooms = new Map();

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Join a room
    socket.on('join-room', (data) => {
        try {
            const { roomId, userName, role } = data;
            
            if (!roomId || !userName || !role) {
                throw new Error('Missing required fields');
            }

            socket.join(roomId);
            socket.userName = userName;
            socket.role = role;
            socket.roomId = roomId;

            // Initialize room if it doesn't exist
            if (!rooms.has(roomId)) {
                rooms.set(roomId, {
                    participants: [],
                    currentAuction: null,
                    bidHistory: [],
                    roomName: roomId, // Default to roomId if name not set
                    bidIncrement: 10,
                    maxParticipants: 0 // Unlimited by default
                });
            }

            const room = rooms.get(roomId);
            
            // Check if room is full
            if (room.maxParticipants > 0 && room.participants.length >= room.maxParticipants) {
                throw new Error('Room is full');
            }
            
            // Add participant if not already in room
            const existingParticipant = room.participants.find(p => p.id === socket.id);
            if (!existingParticipant) {
                room.participants.push({
                    id: socket.id,
                    name: userName,
                    role: role
                });
                
                // Notify all clients in the room
                io.to(roomId).emit('participant-joined', {
                    name: userName,
                    participants: room.participants
                });
            }

            // Send current room state to new user
            socket.emit('room-state', {
                participants: room.participants,
                currentAuction: room.currentAuction,
                bidHistory: room.bidHistory,
                roomName: room.roomName,
                bidIncrement: room.bidIncrement
            });

            console.log(`${userName} joined room ${roomId} as ${role}`);
        } catch (error) {
            console.error('Error joining room:', error.message);
            socket.emit('join-error', { message: error.message });
        }
    });

    // Create room (auctioneer only)
    socket.on('create-room', (data) => {
        try {
            const { roomId, roomName, bidIncrement, maxParticipants } = data;
            
            if (!roomId || !roomName) {
                throw new Error('Missing required fields');
            }

            rooms.set(roomId, {
                participants: [],
                currentAuction: null,
                bidHistory: [],
                roomName: roomName,
                bidIncrement: bidIncrement || 10,
                maxParticipants: maxParticipants || 0
            });

            console.log(`Room ${roomId} created: ${roomName}`);
            socket.emit('room-created', { roomId, roomName });
        } catch (error) {
            console.error('Error creating room:', error.message);
            socket.emit('create-error', { message: error.message });
        }
    });

    // Start auction (auctioneer only)
    socket.on('start-auction', (data) => {
        try {
            if (socket.role !== 'auctioneer') {
                throw new Error('Only auctioneer can start auction');
            }

            const room = rooms.get(socket.roomId);
            if (!room) {
                throw new Error('Room not found');
            }

            const auctionData = {
                playerName: data.playerName,
                playerClub: data.playerClub,
                playerPosition: data.playerPosition,
                startingPrice: data.startingPrice,
                currentBid: data.startingPrice,
                leadingBidder: null,
                isActive: true
            };

            room.currentAuction = auctionData;
            room.bidHistory = [];

            // Broadcast to all users in room
            io.to(socket.roomId).emit('auction-started', auctionData);
            console.log(`Auction started in room ${socket.roomId} for ${data.playerName}`);
        } catch (error) {
            console.error('Error starting auction:', error.message);
            socket.emit('auction-error', { message: error.message });
        }
    });

    // Place bid (bidders only)
    socket.on('place-bid', (data) => {
        try {
            if (socket.role !== 'bidder') {
                throw new Error('Only bidders can place bids');
            }

            const room = rooms.get(socket.roomId);
            if (!room || !room.currentAuction || !room.currentAuction.isActive) {
                throw new Error('No active auction');
            }

            const newBid = room.currentAuction.currentBid + room.bidIncrement;
            
            room.currentAuction.currentBid = newBid;
            room.currentAuction.leadingBidder = socket.userName;

            const bidData = {
                bidder: socket.userName,
                amount: newBid,
                timestamp: new Date()
            };

            room.bidHistory.unshift(bidData);

            // Broadcast bid update to all users in room
            io.to(socket.roomId).emit('bid-placed', {
                currentBid: newBid,
                leadingBidder: socket.userName,
                bidHistory: room.bidHistory
            });

            console.log(`${socket.userName} bid ₹${newBid} in room ${socket.roomId}`);
        } catch (error) {
            console.error('Error placing bid:', error.message);
            socket.emit('bid-error', { message: error.message });
        }
    });

    // End auction (auctioneer only)
    socket.on('end-auction', () => {
        try {
            if (socket.role !== 'auctioneer') {
                throw new Error('Only auctioneer can end auction');
            }

            const room = rooms.get(socket.roomId);
            if (!room || !room.currentAuction) {
                throw new Error('No active auction');
            }

            room.currentAuction.isActive = false;

            const winnerData = {
                playerName: room.currentAuction.playerName,
                winnerName: room.currentAuction.leadingBidder || 'No bids',
                winningBid: room.currentAuction.currentBid
            };

            // Broadcast auction end to all users in room
            io.to(socket.roomId).emit('auction-ended', winnerData);
            console.log(`Auction ended in room ${socket.roomId}`);
        } catch (error) {
            console.error('Error ending auction:', error.message);
            socket.emit('auction-error', { message: error.message });
        }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
        if (socket.roomId) {
            const room = rooms.get(socket.roomId);
            if (room) {
                room.participants = room.participants.filter(p => p.id !== socket.id);
                
                // Notify others of participant leaving
                socket.to(socket.roomId).emit('participant-left', {
                    name: socket.userName,
                    participants: room.participants
                });

                // Clean up room if empty
                if (room.participants.length === 0) {
                    rooms.delete(socket.roomId);
                    console.log(`Room ${socket.roomId} deleted (no participants)`);
                }
            }
        }
        console.log('User disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});