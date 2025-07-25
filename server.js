// server.js (Fully updated and debugged) 
import express from 'express'; 
import { createServer } from 'http'; 
import { Server } from 'socket.io'; 
import path from 'path'; 
import { fileURLToPath } from 'url'; 
import helmet from 'helmet'; 
import cors from 'cors'; 
import morgan from 'morgan'; 
import dotenv from 'dotenv'; 
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url); const __dirname = path.dirname(__filename);

const app = express(); const server = createServer(app); const io = new Server(server, { cors: { origin: ['http://localhost:3000', 'http://localhost:8080', 'https://auction-zfku.onrender.com'], methods: ['GET', 'POST'] } });

const PORT = process.env.PORT || 3000;

const supabase = createClient( process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY );

app.use(express.json()); app.use(cors()); app.use(helmet()); app.use(morgan('dev')); app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (, res) => res.sendFile(path.join(__dirname, 'public/index.html'))); app.get('/auctioneer', (, res) => res.sendFile(path.join(__dirname, 'public/auctioneer.html'))); app.get('/bidder', (_, res) => res.sendFile(path.join(__dirname, 'public/bidder.html')));

const activeRooms = new Map();

io.on('connection', (socket) => { console.log(🔌 Connected: ${socket.id});

socket.on('join-room', async ({ roomId, userName, role }) => { try { const { data: room, error: roomError } = await supabase .from('rooms') .select('*') .eq('id', roomId) .single();

if (roomError || !room) {
    console.error("❌ Room not found:", roomError?.message);
    socket.emit('error', 'Room not found');
    return;
  }

  const { error: upsertError } = await supabase.from('participants').upsert({
    room_id: roomId,
    socket_id: socket.id,
    name: userName,
    role,
    is_online: true,
    last_active: new Date().toISOString()
  });

  if (upsertError) {
    console.error("❌ Participant upsert failed:", upsertError.message);
    socket.emit("error", "Failed to join room (DB issue)");
    return;
  }

  socket.join(roomId);
  if (!activeRooms.has(roomId)) activeRooms.set(roomId, new Set());
  activeRooms.get(roomId).add(socket.id);

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
  socket.emit('error', 'Could not join room');
}

});

socket.on('start-auction', ({ roomId, ...player }) => { io.to(roomId).emit('auction-started', player); console.log(🚩 Auction started for ${player.playerName} in ${roomId}); });

socket.on('place-bid', async ({ roomId, playerId, bidderName, amount }) => { try { const { data: top } = await supabase .from('bids') .select('amount') .eq('player_id', playerId) .order('amount', { ascending: false }) .limit(1);

const currentBid = top?.[0]?.amount || 0;

  if (amount <= currentBid) throw new Error(`Bid must be higher than ₹${currentBid}`);

  const { error } = await supabase.from('bids').insert([{
    room_id: roomId,
    player_id: playerId,
    bidder_name: bidderName,
    amount,
    timestamp: new Date().toISOString()
  }]);

  if (error) throw error;

  io.to(roomId).emit('bid-placed', {
    currentBid: amount,
    leadingBidder: bidderName
  });

  console.log(`💰 New bid: ₹${amount} by ${bidderName} in ${roomId}`);
} catch (err) {
  console.error('❌ Bid error:', err.message);
  socket.emit('bid-error', err.message);
}

});

socket.on('final-call', ({ roomId, callCount, message }) => { io.to(roomId).emit('call-update', { callCount, message }); console.log(🔔 Final Call ${callCount} in ${roomId}: ${message}); });

socket.on('auction-ended', async ({ roomId, playerId, playerName, winnerName, winningBid }) => { try { if (winnerName !== 'No Winner') { await supabase.from('winners').insert([{ room_id: roomId, player_id: playerId, winner_name: winnerName, winning_bid: winningBid, awarded_at: new Date().toISOString() }]); }

io.to(roomId).emit('auction-ended', {
    playerName,
    winnerName,
    winningBid
  });

  console.log(`🏁 Auction ended: ${playerName} won by ${winnerName} for ₹${winningBid}`);
} catch (err) {
  console.error('❌ Auction end error:', err.message);
}

});

socket.on('disconnect', async () => { console.log(⚠️ Disconnected: ${socket.id}); try { const { data: participant } = await supabase .from('participants') .select('room_id') .eq('socket_id', socket.id) .single();

if (participant) {
    const roomId = participant.room_id;

    const { error } = await supabase
      .from('participants')
      .update({ is_online: false })
      .eq('socket_id', socket.id);

    if (error) console.error('❌ Disconnect update error:', error.message);

    if (roomId && activeRooms.has(roomId)) {
      activeRooms.get(roomId).delete(socket.id);
      if (activeRooms.get(roomId).size === 0) {
        activeRooms.delete(roomId);
      }
    }

    const { count } = await supabase
      .from('participants')
      .select('*', { count: 'exact', head: true })
      .eq('room_id', roomId)
      .eq('is_online', true);

    io.to(roomId).emit('participant-left', {
      action: 'left',
      participants: count || 0
    });
  }
} catch (err) {
  console.error('❌ Disconnect cleanup failed:', err.message);
}

}); });

server.listen(PORT, () => { console.log(🚀 Server running on http://localhost:${PORT}); });

