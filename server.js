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
    ? ['https://auction-zfku.onrender.com', 'https://your-production-domain.com']
    : ['http://localhost:3000', 'http://localhost:8080'],
  credentials: true
}));

app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ===== STATIC FILE SERVING ===== //
app.use(express.static(publicPath));
app.use('/audio', express.static(path.join(publicPath, 'audio')));

// HTML ROUTES
app.get('/', (req, res) => res.sendFile(path.join(publicPath, 'index.html')));
app.get('/auctioneer', (req, res) => res.sendFile(path.join(publicPath, 'auctioneer.html')));
app.get('/bidder', (req, res) => res.sendFile(path.join(publicPath, 'bidder.html')));

// API ROUTES
app.get('/api/room/:id', async (req, res) => {
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
      ? ['https://auction-zfku.onrender.com', 'https://your-production-domain.com']
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

// Track active rooms
const activeRooms = new Map();

// ===== AUCTION EVENT HANDLERS ===== //
io.on('connection', (socket) => {
  console.log(`New connection: ${socket.id}`);

  // Join Room
  socket.on('join-room', async ({ roomId, userName, role }) => {
    try {
      socket.join(roomId);
      
      // Update active rooms tracking
      if (!activeRooms.has(roomId)) {
        activeRooms.set(roomId, new Set());
      }
      activeRooms.get(roomId).add(socket.id);

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

      // Notify room participants
      io.to(roomId).emit('participant-update', { 
        user: { name: userName, role }, 
        action: 'joined',
        participants: Array.from(activeRooms.get(roomId)).length
      });

      console.log(`${userName} (${role}) joined room ${roomId}`);
    } catch (err) {
      console.error('Join room error:', err);
      socket.emit('error', 'Failed to join room');
    }
  });

  // Start Auction
  socket.on('start-auction', async ({ roomId, playerId, playerName, playerClub, playerPosition, startingPrice }) => {
    try {
      io.to(roomId).emit('auction-started', { 
        playerId,
        playerName,
        playerClub,
        playerPosition,
        startingPrice
      });

      console.log(`Auction started in room ${roomId} for player ${playerName}`);
    } catch (err) {
      console.error('Start auction error:', err);
      socket.emit('error', 'Failed to start auction');
    }
  });

  // Place Bid
  socket.on('place-bid', async ({ roomId, playerId, bidderName, amount }) => {
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
        bidderName,
        timestamp: new Date().toISOString()
      });

      console.log(`New bid in room ${roomId}: ${bidderName} bid ₹${amount}`);
    } catch (err) {
      console.error('Bid placement error:', err);
      socket.emit('bid-error', err.message);
    }
  });

  // Final Call
  socket.on('final-call', async ({ roomId, callCount, message }) => {
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

  // End Auction
  socket.on('auction-ended', async ({ roomId, playerName, winnerName, winningBid }) => {
    try {
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

  // Disconnect
  socket.on('disconnect', async () => {
    try {
      // Find and remove from active rooms
      for (const [roomId, sockets] of activeRooms) {
        if (sockets.has(socket.id)) {
          sockets.delete(socket.id);
          
          // Notify remaining participants
          if (sockets.size > 0) {
            io.to(roomId).emit('participant-update', {
              action: 'left',
              participants: sockets.size
            });
          } else {
            activeRooms.delete(roomId);
          }
        }
      }

      await supabase
        .from('participants')
        .update({ is_online: false })
        .eq('socket_id', socket.id);

      console.log(`Disconnected: ${socket.id}`);
    } catch (err) {
      console.error('Disconnect error:', err);
    }
  });

  // Error handling
  socket.on('error', (err) => {
    console.error('Socket error:', err);
  });
});

// ===== HEALTH CHECK & METRICS ===== //
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy',
    uptime: process.uptime(),
    activeRooms: activeRooms.size,
    activeConnections: io.engine.clientsCount
  });
});

app.get('/metrics', async (req, res) => {
  try {
    const { count: roomCount } = await supabase
      .from('rooms')
      .select('*', { count: 'exact', head: true });

    const { count: participantCount } = await supabase
      .from('participants')
      .select('*', { count: 'exact', head: true })
      .eq('is_online', true);

    res.json({
      activeRooms: activeRooms.size,
      activeConnections: io.engine.clientsCount,
      totalRooms: roomCount || 0,
      activeParticipants: participantCount || 0
    });
  } catch (err) {
    console.error('Metrics error:', err);
    res.status(500).json({ error: 'Failed to get metrics' });
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
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});