import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

// ===== ENV & PATH SETUP ===== //
dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3000;

// ===== STATIC FILES ===== //
const publicPath = path.join(__dirname, 'public');
app.use(express.static(publicPath));

// ===== SUPABASE SETUP (with anon key) ===== //
const supabase = createClient(
  'https://flwqvepusbjmgoovqvmi.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZsd3F2ZXB1c2JqbWdvb3Zxdm1pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI5MDY3MzMsImV4cCI6MjA2ODQ4MjczM30.or5cIl99nUDZceOKlFMnu8PCzLuCvXT5TBJvKTPSUvM'
);

// ===== MIDDLEWARE ===== //
app.use(cors({
  origin: ['https://auction-zfku.onrender.com', 'http://localhost:3000'],
  credentials: true
}));

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "cdn.socket.io", "cdn.jsdelivr.net"],
      styleSrc: ["'self'", "'unsafe-inline'", "fonts.googleapis.com", "cdnjs.cloudflare.com"],
      fontSrc: ["'self'", "fonts.gstatic.com"],
      connectSrc: ["'self'", "https://flwqvepusbjmgoovqvmi.supabase.co", "wss://auction-zfku.onrender.com"]
    }
  }
}));

app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ===== ROUTES ===== //
app.get('/', (_, res) => res.sendFile(path.join(publicPath, 'index.html')));
app.get('/auctioneer', (_, res) => res.sendFile(path.join(publicPath, 'auctioneer.html')));
app.get('/bidder', (_, res) => res.sendFile(path.join(publicPath, 'bidder.html')));

// ===== SOCKET.IO SETUP ===== //
const io = new Server(server, {
  cors: {
    origin: ['https://auction-zfku.onrender.com', 'http://localhost:3000'],
    methods: ['GET', 'POST']
  }
});

const activeRooms = new Map();

io.on('connection', (socket) => {
  console.log(`🔌 Connected: ${socket.id}`);

  socket.on('join-room', async ({ roomId, userName, role }) => {
    try {
      const { data: room, error } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', roomId)
        .single();

      if (error || !room) {
        socket.emit('error', 'Room not found');
        return;
      }

      await supabase.from('participants').upsert({
        room_id: roomId,
        socket_id: socket.id,
        name: userName,
        role,
        is_online: true,
        last_active: new Date()
      });

      if (!activeRooms.has(roomId)) activeRooms.set(roomId, new Set());
      activeRooms.get(roomId).add(socket.id);
      socket.join(roomId);

      const { count } = await supabase
        .from('participants')
        .select('*', { count: 'exact', head: true })
        .eq('room_id', roomId)
        .eq('is_online', true);

      io.to(roomId).emit('participant-joined', {
        user: { name: userName, role },
        action: 'joined',
        participants: count || 0
      });

    } catch (err) {
      console.error('❌ join-room error:', err.message);
      socket.emit('error', 'Failed to join');
    }
  });

  socket.on('start-auction', ({ roomId, ...player }) => {
    io.to(roomId).emit('auction-started', player);
    console.log(`🚩 Auction started for ${player.playerName}`);
  });

  socket.on('place-bid', async ({ roomId, playerId, bidderName, amount }) => {
    try {
      const { data: highest, error } = await supabase
        .from('bids')
        .select('amount')
        .eq('player_id', playerId)
        .order('amount', { ascending: false })
        .limit(1);

      const current = highest?.[0]?.amount || 0;
      if (amount <= current) throw new Error(`Bid too low (₹${current})`);

      await supabase.from('bids').insert([{
        player_id: playerId,
        bidder_name: bidderName,
        amount,
        room_id: roomId,
        timestamp: new Date().toISOString()
      }]);

      io.to(roomId).emit('bid-placed', { currentBid: amount, leadingBidder: bidderName });

    } catch (err) {
      console.error('❌ Bid error:', err.message);
      socket.emit('bid-error', err.message);
    }
  });

  socket.on('final-call', ({ roomId, callCount, message }) => {
    io.to(roomId).emit('call-update', { callCount, message });
  });

  socket.on('auction-ended', async ({ roomId, playerId, playerName, winnerName, winningBid }) => {
    try {
      if (winnerName !== 'No Winner') {
        await supabase.from('winners').insert([{
          player_id: playerId,
          room_id: roomId,
          winner_name: winnerName,
          winning_bid: winningBid,
          awarded_at: new Date().toISOString()
        }]);
      }

      io.to(roomId).emit('auction-ended', {
        playerName,
        winnerName,
        winningBid
      });

      console.log(`✅ Auction ended: ${playerName} won by ${winnerName} for ₹${winningBid}`);

    } catch (err) {
      console.error('❌ Auction end error:', err.message);
    }
  });

  socket.on('disconnect', async () => {
    console.log(`⚠️ Disconnected: ${socket.id}`);
    try {
      for (const [roomId, sockets] of activeRooms.entries()) {
        if (sockets.has(socket.id)) {
          sockets.delete(socket.id);
          await supabase.from('participants').update({ is_online: false }).eq('socket_id', socket.id);

          const { count } = await supabase
            .from('participants')
            .select('*', { count: 'exact', head: true })
            .eq('room_id', roomId)
            .eq('is_online', true);

          io.to(roomId).emit('participant-left', {
            action: 'left',
            participants: count || 0
          });

          if (sockets.size === 0) activeRooms.delete(roomId);
        }
      }
    } catch (err) {
      console.error('❌ Disconnect cleanup failed:', err.message);
    }
  });
});

// ===== START SERVER ===== //
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});