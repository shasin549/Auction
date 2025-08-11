import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

// Initialize Supabase client
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Create app and server
const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Middlewares
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// Static files
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, 'public')));

// Store auction rooms in memory
const rooms = {};

// Create a room
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('createRoom', async (roomId) => {
    rooms[roomId] = {
      auctioneer: socket.id,
      bidders: [],
      players: [],
      bidHistory: [],
      currentPlayer: null
    };
    socket.join(roomId);
    console.log(`Room ${roomId} created by ${socket.id}`);

    // Store room in Supabase
    await supabase.from('rooms').upsert({ room_id: roomId, data: rooms[roomId] });

    socket.emit('roomCreated', roomId);
  });

  // Join a room
  socket.on('joinRoom', async ({ roomId, name }) => {
    if (rooms[roomId]) {
      rooms[roomId].bidders.push({ id: socket.id, name });
      socket.join(roomId);
      console.log(`${name} joined room ${roomId}`);

      // Send current auction data to new bidder
      socket.emit('roomData', rooms[roomId]);
    } else {
      // Try to fetch from Supabase if not in memory
      const { data } = await supabase
        .from('rooms')
        .select('data')
        .eq('room_id', roomId)
        .single();

      if (data) {
        rooms[roomId] = data.data;
        rooms[roomId].bidders.push({ id: socket.id, name });
        socket.join(roomId);
        console.log(`${name} joined restored room ${roomId}`);
        socket.emit('roomData', rooms[roomId]);
      } else {
        socket.emit('errorMsg', 'Room not found');
      }
    }
  });

  // Start bidding
  socket.on('startBidding', ({ roomId, player }) => {
    if (rooms[roomId]) {
      rooms[roomId].currentPlayer = player;
      io.to(roomId).emit('biddingStarted', player);
    }
  });

  // Place bid
  socket.on('placeBid', ({ roomId, bidValue, bidderName }) => {
    if (rooms[roomId]) {
      rooms[roomId].bidHistory.push({ bidderName, bidValue, player: rooms[roomId].currentPlayer });
      io.to(roomId).emit('bidPlaced', { bidderName, bidValue });
    }
  });

  // Final call
  socket.on('finalCall', (roomId) => {
    io.to(roomId).emit('finalCallMade');
  });

  // Next player
  socket.on('nextPlayer', (roomId) => {
    if (rooms[roomId]) {
      rooms[roomId].currentPlayer = null;
      io.to(roomId).emit('nextPlayerReady');
    }
  });

  // Disconnect
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    for (const [roomId, room] of Object.entries(rooms)) {
      room.bidders = room.bidders.filter(b => b.id !== socket.id);
    }
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));