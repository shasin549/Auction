const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const { MongoClient } = require('mongodb');

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
    const client = await MongoClient.connect('mongodb+srv://yodhavu253:S12KojMUx7NvBNbM@cluster0.xyfxton.mongodb.net/?retryWrites=true&w=majority');
    db = client.db('auctionDB');
    console.log('Connected to MongoDB');
}
connectDB();

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/socket.io/socket.io.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'node_modules', 'socket.io', 'client-dist', 'socket.io.js'));
});

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
        const room = {
            ...data,
            participants: [],
            currentAuction: null,
            bidHistory: [],
            participantBids: {},
            createdAt: new Date()
        };
        await saveRoom(room);
        rooms.set(data.roomId, room);
    });

    // ... (keep all other existing socket handlers)

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

