// server.js 
import express from 'express'; 
import { createServer } from 'http'; 
import { Server } from 'socket.io'; 
import dotenv from 'dotenv'; 
import { createClient } from '@supabase/supabase-js'; 
import path from 'path'; 
import helmet from 'helmet'; 
import cors from 'cors'; 
import morgan from 'morgan'; 
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url); const __dirname = path.dirname(__filename);

const app = express(); const server = createServer(app); const io = new Server(server);

const PORT = process.env.PORT || 3000; const SUPABASE_URL = process.env.SUPABASE_URL; const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Middleware app.use(cors()); app.use(helmet()); app.use(morgan('dev')); app.use(express.static(path.join(__dirname, 'public')));

// Socket.IO const roomParticipants = {};

io.on('connection', (socket) => { console.log('🔌 A user connected');

socket.on('create-room', ({ roomId, roomName }) => { socket.join(roomId); roomParticipants[roomId] = roomParticipants[roomId] || new Set(); roomParticipants[roomId].add(socket.id); io.to(roomId).emit('participant-count', roomParticipants[roomId].size); });

socket.on('join-room', ({ roomId, bidderName }) => { socket.join(roomId); roomParticipants[roomId] = roomParticipants[roomId] || new Set(); roomParticipants[roomId].add(socket.id); io.to(roomId).emit('participant-count', roomParticipants[roomId].size); });

socket.on('start-auction', (data) => { io.to(data.roomId).emit('start-auction', data.player); });

socket.on('place-bid', async ({ roomId, playerId, amount, bidder }) => { io.to(roomId).emit('new-bid', { amount, bidder });

const { error } = await supabase.from('bid').insert([
  { player_id: playerId, bidder_name: bidder, amount } 
]);

if (error) console.error('❌ Error inserting bid:', error.message);

});

socket.on('auction-ended', ({ roomId, winner, amount }) => { io.to(roomId).emit('auction-ended', { winner, amount }); });

socket.on('disconnecting', () => { for (const roomId of socket.rooms) { if (roomParticipants[roomId]) { roomParticipants[roomId].delete(socket.id); io.to(roomId).emit('participant-count', roomParticipants[roomId].size); } } }); });

server.listen(PORT, () => { console.log(🚀 Server running on http://localhost:${PORT}); });

