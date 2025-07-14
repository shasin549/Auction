require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const { MongoClient } = require('mongodb');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Database Connection
let db;
let mongoClient;

async function connectDB() {
    try {
        console.log('Connecting to MongoDB...');
        mongoClient = await MongoClient.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 5000,
            connectTimeoutMS: 10000,
            socketTimeoutMS: 45000
        });
        db = mongoClient.db('auctionDB');
        await db.command({ ping: 1 });
        console.log('✅ MongoDB connection established');
        return true;
    } catch (error) {
        console.error('❌ MongoDB connection failed:', error);
        return false;
    }
}

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        dbConnected: !!db,
        uptime: process.uptime()
    });
});

// Helper Functions
function generateRoomCode() {
    return crypto.randomBytes(3).toString('hex').toUpperCase();
}

async function getRoom(roomId) {
    try {
        return await db.collection('rooms').findOne({ roomId });
    } catch (error) {
        console.error('Error fetching room:', error);
        throw error;
    }
}

async function saveRoom(room) {
    try {
        room.updatedAt = new Date();
        const result = await db.collection('rooms').updateOne(
            { roomId: room.roomId },
            { $set: room },
            { upsert: true }
        );
        return result.acknowledged;
    } catch (error) {
        console.error('Error saving room:', error);
        throw error;
    }
}

// Socket.IO Implementation
io.on('connection', (socket) => {
    console.log('New connection:', socket.id);

    // Rejoin room on reconnect
    socket.on('rejoin-room', async (data) => {
        try {
            const room = await getRoom(data.roomId);
            if (!room) {
                socket.emit('error', 'Room not found');
                return;
            }

            socket.join(data.roomId);
            socket.roomId = data.roomId;
            socket.userName = data.userName;
            socket.role = data.role;

            socket.emit('room-state', {
                participants: room.participants,
                currentAuction: room.currentAuction,
                bidHistory: room.bidHistory,
                bidIncrement: room.bidIncrement
            });
        } catch (error) {
            socket.emit('error', 'Failed to rejoin room');
        }
    });

    // Create new room
    socket.on('create-room', async (data) => {
        try {
            if (!db) throw new Error('Database not connected');

            const roomId = crypto.randomBytes(8).toString('hex');
            const roomCode = generateRoomCode();
            const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
            const inviteLink = `${baseUrl}/join/${roomId}`;

            const room = {
                roomId,
                roomCode,
                roomName: data.roomName,
                maxParticipants: parseInt(data.maxParticipants) || 10,
                bidIncrement: parseInt(data.bidIncrement) || 10,
                participants: [{
                    id: socket.id,
                    name: 'Auctioneer',
                    role: 'auctioneer'
                }],
                currentAuction: null,
                bidHistory: [],
                participantBids: {},
                createdAt: new Date(),
                updatedAt: new Date()
            };

            const saved = await saveRoom(room);
            if (!saved) throw new Error('Failed to save room');

            socket.join(roomId);
            socket.roomId = roomId;
            socket.userName = 'Auctioneer';
            socket.role = 'auctioneer';

            socket.emit('room-created', {
                roomId,
                roomName: data.roomName,
                roomCode,
                inviteLink
            });
        } catch (error) {
            console.error('Create room error:', error);
            socket.emit('error', 'Failed to create room: ' + error.message);
        }
    });

    // Join existing room
    socket.on('join-room', async (data) => {
        try {
            const room = await getRoom(data.roomId);
            if (!room) {
                socket.emit('error', 'Room not found');
                return;
            }

            if (room.participants.length >= room.maxParticipants) {
                socket.emit('error', 'Room is full');
                return;
            }

            const participant = {
                id: socket.id,
                name: data.userName,
                role: 'bidder'
            };

            room.participants.push(participant);
            const saved = await saveRoom(room);
            if (!saved) throw new Error('Failed to update room');

            socket.join(data.roomId);
            socket.roomId = data.roomId;
            socket.userName = data.userName;
            socket.role = 'bidder';

            socket.emit('room-joined', {
                roomId: data.roomId,
                roomName: room.roomName,
                roomCode: room.roomCode
            });

            io.to(data.roomId).emit('participant-joined', {
                userName: data.userName,
                participants: room.participants
            });

            io.to(data.roomId).emit('room-state', {
                participants: room.participants,
                currentAuction: room.currentAuction,
                bidHistory: room.bidHistory,
                bidIncrement: room.bidIncrement
            });
        } catch (error) {
            console.error('Join room error:', error);
            socket.emit('error', 'Failed to join room');
        }
    });

    // Start auction
    socket.on('start-auction', async (data) => {
        try {
            const room = await getRoom(socket.roomId);
            if (!room || socket.role !== 'auctioneer') {
                socket.emit('error', 'Not authorized');
                return;
            }

            const auction = {
                playerName: data.playerName,
                playerClub: data.playerClub,
                playerPosition: data.playerPosition,
                startingPrice: parseInt(data.startingPrice) || 100,
                currentBid: parseInt(data.startingPrice) || 100,
                leadingBidder: null,
                isActive: true,
                startedAt: new Date()
            };

            room.currentAuction = auction;
            room.bidHistory = [];
            const saved = await saveRoom(room);
            if (!saved) throw new Error('Failed to save auction');

            io.to(socket.roomId).emit('auction-started', auction);
        } catch (error) {
            console.error('Start auction error:', error);
            socket.emit('error', 'Failed to start auction');
        }
    });

    // Place bid
    socket.on('place-bid', async () => {
        try {
            const room = await getRoom(socket.roomId);
            if (!room || !room.currentAuction?.isActive) {
                socket.emit('error', 'No active auction');
                return;
            }

            if (socket.role !== 'bidder') {
                socket.emit('error', 'Only bidders can place bids');
                return;
            }

            const newBidAmount = room.currentAuction.currentBid + room.bidIncrement;
            const bid = {
                amount: newBidAmount,
                bidderName: socket.userName,
                bidderId: socket.id,
                timestamp: new Date()
            };

            room.currentAuction.currentBid = newBidAmount;
            room.currentAuction.leadingBidder = socket.userName;
            room.bidHistory.push(bid);

            if (!room.participantBids[socket.userName]) {
                room.participantBids[socket.userName] = [];
            }
            room.participantBids[socket.userName].push({
                playerName: room.currentAuction.playerName,
                amount: newBidAmount,
                timestamp: new Date()
            });

            const saved = await saveRoom(room);
            if (!saved) throw new Error('Failed to save bid');

            io.to(socket.roomId).emit('new-bid', {
                amount: newBidAmount,
                bidderName: socket.userName,
                bidHistory: room.bidHistory
            });
        } catch (error) {
            console.error('Place bid error:', error);
            socket.emit('error', 'Failed to place bid');
        }
    });

    // End auction
    socket.on('end-auction', async () => {
        try {
            const room = await getRoom(socket.roomId);
            if (!room || !room.currentAuction || socket.role !== 'auctioneer') {
                socket.emit('error', 'Not authorized');
                return;
            }

            const winnerData = {
                playerName: room.currentAuction.playerName,
                winnerName: room.currentAuction.leadingBidder || 'No winner',
                winningBid: room.currentAuction.currentBid || room.currentAuction.startingPrice
            };

            room.currentAuction.isActive = false;
            room.currentAuction.endedAt = new Date();
            const saved = await saveRoom(room);
            if (!saved) throw new Error('Failed to end auction');

            io.to(socket.roomId).emit('auction-ended', winnerData);
        } catch (error) {
            console.error('End auction error:', error);
            socket.emit('error', 'Failed to end auction');
        }
    });

    // Disconnect handler
    socket.on('disconnect', async () => {
        if (socket.roomId) {
            try {
                const room = await getRoom(socket.roomId);
                if (room) {
                    room.participants = room.participants.filter(p => p.id !== socket.id);
                    await saveRoom(room);
                    socket.to(socket.roomId).emit('participant-left', {
                        name: socket.userName,
                        participants: room.participants
                    });
                }
            } catch (error) {
                console.error('Disconnect error:', error);
            }
        }
        console.log('User disconnected:', socket.id);
    });
});

// Server startup
const PORT = process.env.PORT || 5000;
connectDB().then(success => {
    if (success) {
        server.listen(PORT, '0.0.0.0', () => {
            console.log(`✅ Server running on port ${PORT}`);
            console.log(`🔗 Access at: http://localhost:${PORT}`);
        });

        // Graceful shutdown
        process.on('SIGINT', async () => {
            console.log('\nShutting down gracefully...');
            if (mongoClient) {
                await mongoClient.close();
                console.log('MongoDB connection closed');
            }
            server.close(() => {
                console.log('Server closed');
                process.exit(0);
            });
        });
    } else {
        console.error('❌ Server not started due to DB connection failure');
        process.exit(1);
    }
});