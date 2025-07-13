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

// MongoDB Connection
let db;
async function connectDB() {
    const client = await MongoClient.connect(process.env.MONGODB_URI, {
  ssl: true,
  tlsAllowInvalidCertificates: false,
  tlsInsecure: false,
  useNewUrlParser: true,
  useUnifiedTopology: true
});
    db = client.db('auctionDB');
    console.log('Connected to MongoDB');
}
connectDB().catch(console.error);

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/socket.io/socket.io.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'node_modules', 'socket.io', 'client-dist', 'socket.io.js'));
});

// Helper functions
function generateRoomCode() {
    return crypto.randomBytes(3).toString('hex').toUpperCase();
}

// Room persistence functions
async function getRoom(roomId) {
    return await db.collection('rooms').findOne({ roomId });
}

async function saveRoom(room) {
    await db.collection('rooms').updateOne(
        { roomId: room.roomId },
        { $set: room },
        { upsert: true }
    );
}

// Socket.io handlers
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('rejoin-room', async (data) => {
        const room = await getRoom(data.roomId);
        if (room) {
            socket.join(data.roomId);
            socket.roomId = data.roomId;
            socket.userName = data.userName;
            socket.emit('room-state', {
                participants: room.participants,
                currentAuction: room.currentAuction,
                bidHistory: room.bidHistory,
                bidIncrement: room.bidIncrement
            });
            console.log(`${data.userName} reconnected to room ${data.roomId}`);
        }
    });

    socket.on('create-room', async (data) => {
        try {
            const roomId = crypto.randomBytes(8).toString('hex');
            const roomCode = generateRoomCode();
            const inviteLink = `${process.env.BASE_URL || 'http://localhost:5000'}/join/${roomId}`;

            const room = {
                roomId,
                roomCode,
                roomName: data.roomName,
                maxParticipants: parseInt(data.maxParticipants),
                bidIncrement: parseInt(data.bidIncrement),
                participants: [],
                currentAuction: null,
                bidHistory: [],
                participantBids: {},
                createdAt: new Date()
            };

            await saveRoom(room);
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
            console.error('Error creating room:', error);
            socket.emit('error', 'Failed to create room');
        }
    });

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
            await saveRoom(room);

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
            console.error('Error joining room:', error);
            socket.emit('error', 'Failed to join room');
        }
    });

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
                startingPrice: parseInt(data.startingPrice),
                currentBid: parseInt(data.startingPrice),
                leadingBidder: null,
                isActive: true
            };

            room.currentAuction = auction;
            await saveRoom(room);

            io.to(socket.roomId).emit('auction-started', auction);
        } catch (error) {
            console.error('Error starting auction:', error);
            socket.emit('error', 'Failed to start auction');
        }
    });

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

            // Track participant bids
            if (!room.participantBids[socket.userName]) {
                room.participantBids[socket.userName] = [];
            }
            room.participantBids[socket.userName].push({
                playerName: room.currentAuction.playerName,
                amount: newBidAmount,
                timestamp: new Date()
            });

            await saveRoom(room);

            io.to(socket.roomId).emit('new-bid', {
                amount: newBidAmount,
                bidderName: socket.userName,
                bidHistory: room.bidHistory
            });
        } catch (error) {
            console.error('Error placing bid:', error);
            socket.emit('error', 'Failed to place bid');
        }
    });

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
                winningBid: room.currentAuction.currentBid
            };

            room.currentAuction.isActive = false;
            await saveRoom(room);

            io.to(socket.roomId).emit('auction-ended', winnerData);
        } catch (error) {
            console.error('Error ending auction:', error);
            socket.emit('error', 'Failed to end auction');
        }
    });

    socket.on('disconnect', async () => {
        if (socket.roomId) {
            const room = await getRoom(socket.roomId);
            if (room) {
                room.participants = room.participants.filter(p => p.id !== socket.id);
                await saveRoom(room);
                socket.to(socket.roomId).emit('participant-left', {
                    name: socket.userName,
                    participants: room.participants
                });
            }
        }
        console.log('User disconnected:', socket.id);
    });
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Server running at http://localhost:${PORT}`);
});