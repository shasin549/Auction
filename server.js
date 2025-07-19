require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const path = require('path');

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Security Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || '*',
  methods: ['GET', 'POST']
}));
app.use(express.json());
app.use(morgan('combined'));
app.use(express.static(path.join(__dirname, 'public')));

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Configure Socket.IO
const io = new Server(server, {
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
    skipMiddlewares: true
  },
  cors: {
    origin: process.env.CLIENT_URL || '*',
    methods: ['GET', 'POST']
  }
});

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY,
  {
    auth: {
      persistSession: false
    }
  }
);

// Database Models
const Room = {
  async create(name, bidIncrement = 10) {
    const { data, error } = await supabase
      .from('rooms')
      .insert([{ 
        name, 
        bid_increment: bidIncrement,
        status: 'waiting'
      }])
      .select()
      .single();
    return { data, error };
  },

  async get(roomId) {
    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', roomId)
      .single();
    return { data, error };
  },

  async updateStatus(roomId, status) {
    const { error } = await supabase
      .from('rooms')
      .update({ status })
      .eq('id', roomId);
    return { error };
  }
};

const Player = {
  async create(roomId, playerData) {
    const { data, error } = await supabase
      .from('players')
      .insert([{
        room_id: roomId,
        name: playerData.name,
        club: playerData.club,
        position: playerData.position,
        starting_price: playerData.price,
        current_bid: playerData.price,
        is_active: true
      }])
      .select()
      .single();
    return { data, error };
  },

  async getActive(roomId) {
    const { data, error } = await supabase
      .from('players')
      .select('*')
      .eq('room_id', roomId)
      .eq('is_active', true)
      .single();
    return { data, error };
  },

  async updateCurrentBid(playerId, amount, leadingBidder) {
    const { error } = await supabase
      .from('players')
      .update({ 
        current_bid: amount,
        leading_bidder: leadingBidder
      })
      .eq('id', playerId);
    return { error };
  },

  async endAuction(playerId) {
    const { error } = await supabase
      .from('players')
      .update({ is_active: false })
      .eq('id', playerId);
    return { error };
  }
};

const Bid = {
  async create(bidData) {
    const { data, error } = await supabase
      .from('bids')
      .insert([{
        room_id: bidData.roomId,
        player_id: bidData.playerId,
        bidder_name: bidData.bidder,
        amount: bidData.amount
      }])
      .select();
    return { data, error };
  },

  async getHistory(playerId) {
    const { data, error } = await supabase
      .from('bids')
      .select('*')
      .eq('player_id', playerId)
      .order('created_at', { ascending: false });
    return { data, error };
  }
};

const Winner = {
  async create(winnerData) {
    const { data, error } = await supabase
      .from('winners')
      .insert([{
        room_id: winnerData.roomId,
        player_id: winnerData.playerId,
        winner_name: winnerData.winner,
        winning_bid: winnerData.amount
      }])
      .select();
    return { data, error };
  },

  async getByRoom(roomId) {
    const { data, error } = await supabase
      .from('winners')
      .select('*')
      .eq('room_id', roomId);
    return { data, error };
  }
};

const Participant = {
  async join(roomId, userId, name, socketId, role = 'bidder') {
    const { data, error } = await supabase
      .from('participants')
      .upsert({
        room_id: roomId,
        user_id: userId,
        name,
        socket_id: socketId,
        role,
        is_online: true,
        last_active: new Date()
      })
      .select()
      .single();
    return { data, error };
  },

  async leave(socketId) {
    const { error } = await supabase
      .from('participants')
      .update({ is_online: false })
      .eq('socket_id', socketId);
    return { error };
  },

  async getByRoom(roomId) {
    const { data, error } = await supabase
      .from('participants')
      .select('*')
      .eq('room_id', roomId)
      .eq('is_online', true);
    return { data, error };
  }
};

// In-memory state for active auctions
const activeAuctions = new Map();

// Socket.IO Event Handlers
io.on('connection', (socket) => {
  console.log(`⚡ New connection: ${socket.id}`);

  // Create Room
  socket.on('create-room', async ({ name, bidIncrement }, callback) => {
    try {
      const { data: room, error } = await Room.create(name, bidIncrement);
      if (error) throw error;

      activeAuctions.set(room.id, {
        participants: [],
        callCount: 0,
        lastCallTime: null
      });

      callback({ success: true, roomId: room.id });
    } catch (err) {
      console.error('Create room error:', err);
      callback({ success: false, message: 'Failed to create room' });
    }
  });

  // Join Room
  socket.on('join-room', async ({ roomId, userId, name, role }, callback) => {
    try {
      const { data: room, error: roomError } = await Room.get(roomId);
      if (roomError || !room) throw new Error('Room not found');

      const { data: participant, error: joinError } = await Participant.join(
        roomId,
        userId,
        name,
        socket.id,
        role
      );
      if (joinError) throw joinError;

      socket.join(roomId);
      socket.roomId = roomId;
      socket.userId = userId;
      socket.userName = name;
      socket.role = role;

      // Update in-memory participants
      const auctionState = activeAuctions.get(roomId) || { participants: [] };
      auctionState.participants.push({
        id: userId,
        name,
        role,
        socketId: socket.id
      });
      activeAuctions.set(roomId, auctionState);

      // Get current auction state if exists
      let currentAuction = null;
      if (room.status === 'auction-active') {
        const { data: player } = await Player.getActive(roomId);
        if (player) {
          currentAuction = {
            id: player.id,
            name: player.name,
            club: player.club,
            position: player.position,
            startingPrice: player.starting_price,
            currentBid: player.current_bid,
            leadingBidder: player.leading_bidder,
            isActive: player.is_active
          };
        }
      }

      // Get participants
      const { data: participants } = await Participant.getByRoom(roomId);

      io.to(roomId).emit('participant-joined', {
        user: { id: userId, name, role },
        participants: participants.map(p => ({
          id: p.user_id,
          name: p.name,
          role: p.role
        })),
        currentAuction
      });

      callback({ 
        success: true,
        room: {
          id: room.id,
          name: room.name,
          bidIncrement: room.bid_increment,
          status: room.status
        },
        currentAuction,
        participants: participants.map(p => ({
          id: p.user_id,
          name: p.name,
          role: p.role
        }))
      });
    } catch (err) {
      console.error('Join room error:', err);
      callback({ success: false, message: err.message });
    }
  });

  // Start Auction
  socket.on('start-auction', async (playerData, callback) => {
    try {
      const roomId = socket.roomId;
      if (!roomId || socket.role !== 'auctioneer') {
        throw new Error('Not authorized');
      }

      const { data: player, error } = await Player.create(roomId, playerData);
      if (error) throw error;

      await Room.updateStatus(roomId, 'auction-active');

      const auctionData = {
        id: player.id,
        name: player.name,
        club: player.club,
        position: player.position,
        startingPrice: player.starting_price,
        currentBid: player.current_bid,
        isActive: player.is_active
      };

      io.to(roomId).emit('auction-started', auctionData);
      callback({ success: true });
    } catch (err) {
      console.error('Start auction error:', err);
      callback({ success: false, message: err.message });
    }
  });

  // Place Bid
  socket.on('place-bid', async ({ amount }, callback) => {
    try {
      const roomId = socket.roomId;
      if (!roomId) throw new Error('Not in a room');

      const { data: room } = await Room.get(roomId);
      if (!room) throw new Error('Room not found');

      const { data: player, error: playerError } = await Player.getActive(roomId);
      if (playerError || !player) throw new Error('No active auction');

      // Validate bid amount
      const minBid = player.current_bid + room.bid_increment;
      if (amount < minBid) {
        throw new Error(`Bid must be at least $${minBid}`);
      }

      // Save bid
      const { error: bidError } = await Bid.create({
        roomId,
        playerId: player.id,
        bidder: socket.userName,
        amount
      });
      if (bidError) throw bidError;

      // Update player current bid
      await Player.updateCurrentBid(player.id, amount, socket.userName);

      // Update in-memory call count
      const auctionState = activeAuctions.get(roomId);
      if (auctionState) {
        auctionState.callCount = 0;
        activeAuctions.set(roomId, auctionState);
      }

      io.to(roomId).emit('bid-placed', {
        playerId: player.id,
        amount,
        bidder: socket.userName,
        message: `New bid: $${amount} by ${socket.userName}`
      });

      io.to(roomId).emit('call-update', {
        callCount: 0,
        message: 'New bid placed!'
      });

      callback({ success: true });
    } catch (err) {
      console.error('Bid error:', err);
      callback({ success: false, message: err.message });
    }
  });

  // Final Call
  socket.on('final-call', async (callback) => {
    try {
      const roomId = socket.roomId;
      if (!roomId || socket.role !== 'auctioneer') {
        throw new Error('Not authorized');
      }

      const { data: player, error: playerError } = await Player.getActive(roomId);
      if (playerError || !player) throw new Error('No active auction');

      const auctionState = activeAuctions.get(roomId) || { callCount: 0 };
      const lastBid = await Bid.getHistory(player.id);
      
      // Reset call count if new bid since last call
      if (lastBid.data?.length > 0 && auctionState.lastCallTime && 
          new Date(lastBid.data[0].created_at) > auctionState.lastCallTime) {
        auctionState.callCount = 0;
      }

      auctionState.callCount++;
      auctionState.lastCallTime = new Date();
      activeAuctions.set(roomId, auctionState);

      const message = getCallMessage(auctionState.callCount);
      io.to(roomId).emit('call-update', {
        callCount: auctionState.callCount,
        message
      });

      // Handle auction ending after 3 calls
      if (auctionState.callCount === 3) {
        setTimeout(async () => {
          const currentState = activeAuctions.get(roomId);
          if (currentState?.callCount === 3) {
            const winnerName = player.leading_bidder || 'No winner';
            const winningBid = player.current_bid;

            // Save winner
            await Winner.create({
              roomId,
              playerId: player.id,
              winner: winnerName,
              amount: winningBid
            });

            // End auction
            await Player.endAuction(player.id);
            await Room.updateStatus(roomId, 'waiting');

            io.to(roomId).emit('auction-ended', {
              playerId: player.id,
              playerName: player.name,
              winnerName,
              winningBid
            });

            // Update participants with wins
            const { data: winners } = await Winner.getByRoom(roomId);
            const { data: participants } = await Participant.getByRoom(roomId);

            io.to(roomId).emit('participants-updated', {
              participants: participants.map(p => ({
                id: p.user_id,
                name: p.name,
                role: p.role,
                wins: winners.filter(w => w.winner_name === p.name).map(w => ({
                  playerName: player.name,
                  amount: w.winning_bid
                }))
              }))
            });
          }
        }, 3000);
      }

      callback({ success: true, callCount: auctionState.callCount });
    } catch (err) {
      console.error('Final call error:', err);
      callback({ success: false, message: err.message });
    }
  });

  // Get Bids History
  socket.on('get-bid-history', async ({ playerId }, callback) => {
    try {
      const { data, error } = await Bid.getHistory(playerId);
      if (error) throw error;

      callback({ 
        success: true, 
        bids: data.map(b => ({
          bidder: b.bidder_name,
          amount: b.amount,
          timestamp: b.created_at
        }))
      });
    } catch (err) {
      console.error('Bid history error:', err);
      callback({ success: false, message: err.message });
    }
  });

  // Get Winners
  socket.on('get-winners', async ({ roomId }, callback) => {
    try {
      const { data, error } = await Winner.getByRoom(roomId);
      if (error) throw error;

      callback({
        success: true,
        winners: data.map(w => ({
          playerId: w.player_id,
          winnerName: w.winner_name,
          amount: w.winning_bid,
          timestamp: w.created_at
        }))
      });
    } catch (err) {
      console.error('Get winners error:', err);
      callback({ success: false, message: err.message });
    }
  });

  // Disconnect Handler
  socket.on('disconnect', async () => {
    try {
      await Participant.leave(socket.id);
      
      const roomId = socket.roomId;
      if (roomId) {
        // Update in-memory participants
        const auctionState = activeAuctions.get(roomId);
        if (auctionState) {
          auctionState.participants = auctionState.participants.filter(
            p => p.socketId !== socket.id
          );
          activeAuctions.set(roomId, auctionState);
        }

        // Get updated participants list
        const { data: participants } = await Participant.getByRoom(roomId);
        io.to(roomId).emit('participant-left', {
          userId: socket.userId,
          participants: participants.map(p => ({
            id: p.user_id,
            name: p.name,
            role: p.role
          }))
        });
      }
    } catch (err) {
      console.error('Disconnect error:', err);
    }
  });
});

// Helper function for call messages
function getCallMessage(count) {
  switch(count) {
    case 1: return "First Call!";
    case 2: return "Second Call!";
    case 3: return "Final Call!";
    default: return "Going once...";
  }
}

// REST API Endpoints
app.get('/api/rooms/:id', async (req, res) => {
  try {
    const { data, error } = await Room.get(req.params.id);
    if (error || !data) throw new Error('Room not found');

    res.json({
      id: data.id,
      name: data.name,
      status: data.status,
      bidIncrement: data.bid_increment,
      createdAt: data.created_at
    });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date(),
    activeRooms: activeAuctions.size
  });
});

// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

// Start Server
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`
  🚀 Server running on port ${PORT}
  Supabase URL: ${process.env.SUPABASE_URL}
  Client URL: ${process.env.CLIENT_URL || 'Any'}
  `);
});