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

dotenv.config();

// Setup __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Init Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Express & Socket.io setup
const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// In-memory store for active rooms (for quick access)
const rooms = {};

// Auctioneer creates a room
io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  socket.on('createRoom', async ({ roomId }) => {
    rooms[roomId] = { players: [] };
    socket.join(roomId);
    console.log(`Room created: ${roomId}`);
    socket.emit('roomCreated', { roomId });
  });

  // Auctioneer adds player
  socket.on('addPlayer', async ({ roomId, player }) => {
    if (!rooms[roomId]) rooms[roomId] = { players: [] };
    rooms[roomId].players.push(player);

    // Save player to Supabase "Rooms table"
    const { error } = await supabase
      .from('Rooms table')
      .insert([{ player_id: player.id, player_name: player.name, base_price: player.basePrice }]);

    if (error) console.error('Supabase insert player error:', error);

    io.to(roomId).emit('playerAdded', player);
  });

  // Bidder places bid
  socket.on('placeBid', async ({ roomId, playerId, bidderName, amount }) => {
    // Save to Supabase bids table
    const { error } = await supabase
      .from('bids')
      .insert([{ player_id: playerId, bidder_name: bidderName, amount }]);

    if (error) console.error('Supabase insert bid error:', error);

    io.to(roomId).emit('bidPlaced', { playerId, bidderName, amount });
  });

  // Auctioneer declares winner
  socket.on('declareWinner', async ({ playerId, winnerName, amount }) => {
    // Save to Supabase winner Table
    const { error } = await supabase
      .from('winner Table')
      .insert([{ player_id: playerId, winner_name: winnerName, amount }]);

    if (error) console.error('Supabase insert winner error:', error);

    io.emit('winnerDeclared', { playerId, winnerName, amount });
  });

  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

// Serve HTML pages
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
app.get('/auctioneer', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'auctioneer.html'));
});
app.get('/bidder', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'bidder.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));