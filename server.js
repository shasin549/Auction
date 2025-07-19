import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';

// ===== INITIALIZATION ===== //
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config();

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3000;
const publicPath = path.join(__dirname, 'public');

// ===== SUPABASE SETUP ===== //
const supabase = createClient(
  process.env.SUPABASE_URL || 'https://flwqvepusbjmgoovqvmi.supabase.co',
  process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZsd3F2ZXB1c2JqbWdvb3Zxdm1pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI5MDY3MzMsImV4cCI6MjA2ODQ4MjczM30.or5cIl99nUDZceOKlFMnu8PCzLuCvXT5TBJvKTPSUvM',
  {
    auth: { persistSession: false },
    db: { schema: 'public' }
  }
);

// ===== MIDDLEWARE ===== //
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "cdn.socket.io", "cdn.jsdelivr.net"],
      styleSrc: ["'self'", "'unsafe-inline'", "fonts.googleapis.com", "cdnjs.cloudflare.com"],
      fontSrc: ["'self'", "fonts.gstatic.com", "cdnjs.cloudflare.com"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'", "https://auction-zfku.onrender.com", process.env.SUPABASE_URL]
    }
  }
}));

app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://auction-zfku.onrender.com']
    : ['http://localhost:3000', 'http://localhost:8080'],
  credentials: true
}));

app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ===== STATIC FILES ===== //
app.use(express.static(publicPath));
app.use('/audio', express.static(path.join(publicPath, 'audio')));

// ===== ROUTES ===== //
app.get('/', (req, res) => res.sendFile(path.join(publicPath, 'index.html')));
app.get('/auctioneer', (req, res) => res.sendFile(path.join(publicPath, 'auctioneer.html')));
app.get('/bidder', (req, res) => res.sendFile(path.join(publicPath, 'bidder.html')));

// API Endpoint for room validation
app.get('/api/rooms/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Room not found' });

    res.json(data);
  } catch (err) {
    console.error('Room fetch error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ===== SOCKET.IO SETUP ===== //
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production'
      ? ['https://auction-zfku.onrender.com']
      : ['http://localhost:3000', 'http://localhost:8080'],
    methods: ['GET', 'POST']
  },
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000,
    skipMiddlewares: true
  },
  pingInterval: 10000,
  pingTimeout: 5000
});

// Track active rooms and participants
const activeRooms = new Map();

// ===== SOCKET EVENT HANDLERS ===== //
io.on('connection', (socket) => {
  console.log(`New connection: ${socket.id}`);

  // Join Room Handler
  socket.on('join-room', async ({ roomId, userName, role }, callback) => {
    try {
      // Verify room exists
      const { data: room, error: roomError } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', roomId)
        .single();

      if (roomError || !room) {
        throw new Error('Room does not exist');
      }

      // Update participant in Supabase
      const { error: upsertError } = await supabase
        .from('participants')
        .upsert({
          room_id: roomId,
          socket_id: socket.id,
          name: userName,
          role,
          is_online: true,
          last_active: new Date()
        });

      if (upsertError) throw upsertError;

      // Track active participants
      if (!activeRooms.has(roomId)) {
        activeRooms.set(roomId, new Set());
      }
      activeRooms.get(roomId).add(socket.id);
      socket.join(roomId);

      // Get participant count
      const { count } = await supabase
        .from('participants')
        .select('*', { count: 'exact', head: true })
        .eq('room_id', roomId)
        .eq('is_online', true);

      // Notify room
      io.to(roomId).emit('participant-update', {
        user: { name: userName, role },
        action: 'joined',
        participants: count || 0
      });

      callback({ status: 'success' });
      console.log(`${userName} (${role}) joined room ${roomId}`);

    } catch (err) {
      console.error('Join room error:', err);
      callback({ status: 'error', error: err.message });
      socket.emit('error', `Failed to join room: ${err.message}`);
    }
  });

  // Start Auction Handler
  socket.on('start-auction', async ({ roomId, playerId, playerName, playerClub, playerPosition, startingPrice }) => {
    try {
      const { data: room, error: roomError } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', roomId)
        .single();

      if (roomError || !room) throw new Error('Invalid room');

      io.to(roomId).emit('auction-started', { 
        playerId,
        playerName,
        playerClub,
        playerPosition,
        startingPrice,
        timestamp: new Date().toISOString()
      });

      console.log(`Auction started in room ${roomId} for ${playerName}`);
    } catch (err) {
      console.error('Start auction error:', err);
      socket.emit('error', `Failed to start auction: ${err.message}`);
    }
  });

  // Place Bid Handler
  socket.on('place-bid', async ({ roomId, playerId, bidderName, amount }) => {
    try {
      // Get current highest bid
      const { data: bids, error: bidError } = await supabase
        .from('bids')
        .select('amount')
        .eq('player_id', playerId)
        .order('amount', { ascending: false })
        .limit(1);

      if (bidError) throw bidError;

      const currentHighest = bids.length > 0 ? bids[0].amount : 0;
      
      if (amount <= currentHighest) {
        throw new Error(`Bid must be higher than current ₹${currentHighest}`);
      }

      // Record bid
      const { error } = await supabase
        .from('bids')
        .insert([{
          player_id: playerId,
          bidder_name: bidderName,
          amount,
          room_id: roomId,
          timestamp: new Date().toISOString()
        }]);

      if (error) throw error;

      // Notify all participants
      io.to(roomId).emit('bid-update', { 
        playerId, 
        amount, 
        bidderName,
        timestamp: new Date().toISOString()
      });

      console.log(`New bid in room ${roomId}: ${bidderName} bid ₹${amount}`);
    } catch (err) {
      console.error('Bid placement error:', err);
      socket.emit('bid-error', err.message);
    }
  });

  // Final Call Handler
  socket.on('final-call', ({ roomId, callCount, message }) => {
    try {
      io.to(roomId).emit('call-update', { 
        callCount, 
        message,
        timestamp: new Date().toISOString()
      });
      console.log(`Final call (${callCount}) in room ${roomId}: ${message}`);
    } catch (err) {
      console.error('Final call error:', err);
      socket.emit('error', 'Failed to process final call');
    }
  });

  // End Auction Handler
  socket.on('auction-ended', async ({ roomId, playerId, playerName, winnerName, winningBid }) => {
    try {
      if (winnerName !== 'No Winner') {
        await supabase
          .from('winners')
          .insert([{
            player_id: playerId,
            winner_name: winnerName,
            winning_bid: winningBid,
            room_id: roomId,
            awarded_at: new Date().toISOString()
          }]);
      }

      io.to(roomId).emit('auction-ended', { 
        playerName, 
        winnerName, 
        winningBid,
        timestamp: new Date().toISOString()
      });

      console.log(`Auction ended in room ${roomId}: ${winnerName} won ${playerName} for ₹${winningBid}`);
    } catch (err) {
      console.error('Auction end error:', err);
      socket.emit('error', 'Failed to end auction');
    }
  });

  // Disconnect Handler
  socket.on('disconnect', async () => {
    try {
      for (const [roomId, sockets] of activeRooms) {
        if (sockets.has(socket.id)) {
          sockets.delete(socket.id);

          await supabase
            .from('participants')
            .update({ is_online: false })
            .eq('socket_id', socket.id);

          const { count } = await supabase
            .from('participants')
            .select('*', { count: 'exact', head: true })
            .eq('room_id', roomId)
            .eq('is_online', true);

          if (sockets.size > 0) {
            io.to(roomId).emit('participant-update', {
              action: 'left',
              participants: count || 0
            });
          } else {
            activeRooms.delete(roomId);
          }
        }
      }
      console.log(`Disconnected: ${socket.id}`);
    } catch (err) {
      console.error('Disconnect error:', err);
    }
  });

  // Error Handler
  socket.on('error', (err) => {
    console.error('Socket error:', err);
  });
});

// ===== HEALTH CHECK ===== //
app.get('/health', async (req, res) => {
  try {
    const { count: activeRoomsCount } = await supabase
      .from('rooms')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');

    res.status(200).json({ 
      status: 'healthy',
      uptime: process.uptime(),
      activeRooms: activeRoomsCount || 0,
      activeConnections: io.engine.clientsCount,
      supabase: activeRoomsCount !== null ? 'connected' : 'disconnected'
    });
  } catch (err) {
    res.status(500).json({ error: 'Health check failed' });
  }
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
  • Supabase: ${process.env.SUPABASE_URL ? 'Connected' : 'Configured with fallback'}
  `);
});

// Graceful shutdown
['SIGTERM', 'SIGINT'].forEach(signal => {
  process.on(signal, () => {
    console.log(`${signal} received. Shutting down gracefully...`);
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });
});