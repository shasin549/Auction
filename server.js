import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import path from 'path';

// ===== INITIALIZATION ===== //
dotenv.config();
const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3000;
const publicPath = path.join(process.cwd(), 'public');

// ===== SUPABASE SETUP ===== //
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY,
  {
    auth: { persistSession: false },
    db: { schema: 'public' }
  }
);

// ===== MIDDLEWARE ===== //
app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? 'https://auction-zfku.onrender.com' 
    : 'http://localhost:3000',
  credentials: true
}));
app.use(morgan('dev'));
app.use(express.json());

// ===== STATIC FILE SERVING ===== //
app.use(express.static(publicPath));
app.use('/audio', express.static(path.join(publicPath, 'audio')));

// HTML ROUTES
app.get('/', (req, res) => res.sendFile(path.join(publicPath, 'index.html')));
app.get('/auctioneer', (req, res) => res.sendFile(path.join(publicPath, 'auctioneer.html')));
app.get('/bidder', (req, res) => res.sendFile(path.join(publicPath, 'bidder.html')));

// ===== SOCKET.IO SETUP ===== //
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production'
      ? 'https://auction-zfku.onrender.com'
      : 'http://localhost:3000',
    methods: ['GET', 'POST']
  },
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000,
    skipMiddlewares: true
  }
});

// ===== AUCTION EVENT HANDLERS ===== //
io.on('connection', (socket) => {
  console.log(`New connection: ${socket.id}`);

  // Join Room
  socket.on('join-room', async ({ roomId, userName, role }) => {
    try {
      socket.join(roomId);
      const { error } = await supabase
        .from('participants')
        .upsert({
          room_id: roomId,
          socket_id: socket.id,
          name: userName,
          role,
          is_online: true,
          last_active: new Date()
        });
      
      if (error) throw error;
      
      io.to(roomId).emit('participant-update', { 
        user: { name: userName, role }, 
        action: 'joined' 
      });
    } catch (err) {
      socket.emit('error', 'Failed to join room');
    }
  });

  // Place Bid
  socket.on('place-bid', async ({ roomId, playerId, amount, bidderName }) => {
    try {
      const { data: player, error: playerError } = await supabase
        .from('players')
        .select('current_bid')
        .eq('id', playerId)
        .single();

      if (playerError || !player) throw new Error('Player not found');
      if (amount <= player.current_bid) throw new Error('Bid too low');

      const { error: bidError } = await supabase
        .from('bids')
        .insert([{
          player_id: playerId,
          bidder_name: bidderName,
          amount,
          room_id: roomId
        }]);

      if (bidError) throw bidError;

      await supabase
        .from('players')
        .update({ 
          current_bid: amount, 
          leading_bidder: bidderName 
        })
        .eq('id', playerId);

      io.to(roomId).emit('bid-update', { 
        playerId, 
        amount, 
        bidderName 
      });
    } catch (err) {
      socket.emit('bid-error', err.message);
    }
  });

  // Disconnect
  socket.on('disconnect', async () => {
    try {
      await supabase
        .from('participants')
        .update({ is_online: false })
        .eq('socket_id', socket.id);
    } catch (err) {
      console.error('Disconnect error:', err);
    }
  });
});

// ===== HEALTH CHECK ===== //
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy',
    uptime: process.uptime() 
  });
});

// ===== ERROR HANDLER ===== //
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Server error' });
});

// ===== START SERVER ===== //
server.listen(PORT, '0.0.0.0', () => {
  console.log(`
  🚀 Server ready at http://localhost:${PORT}
  • Mode: ${process.env.NODE_ENV || 'development'}
  • Static files: ${publicPath}
  • Supabase: ${process.env.SUPABASE_URL ? 'Connected' : 'Disabled'}
  `);
});