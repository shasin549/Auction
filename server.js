import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import path from 'path';

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY,
  {
    db: {
      schema: 'public'
    },
    auth: {
      persistSession: false
    }
  }
);

// Express Configuration
const app = express();
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || '*',
  methods: ['GET', 'POST']
}));
app.use(express.json());
app.use(morgan('combined'));
app.use(express.static(path.join(process.cwd(), 'public')));

// Rate limiting (100 requests per 15 minutes)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use(limiter);

// HTTP Server + Socket.io
const server = http.createServer(app);
const io = new Server(server, {
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000 // 2 minutes
  },
  cors: {
    origin: process.env.CLIENT_URL || '*',
    methods: ['GET', 'POST']
  }
});

// Database Models
const RoomModel = {
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

const ParticipantModel = {
  async joinRoom(roomId, userId, name, socketId, role = 'bidder') {
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

  async getByRoom(roomId) {
    const { data, error } = await supabase
      .from('participants')
      .select('*')
      .eq('room_id', roomId)
      .eq('is_online', true);
    return { data, error };
  },

  async leave(socketId) {
    const { error } = await supabase
      .from('participants')
      .update({ is_online: false })
      .eq('socket_id', socketId);
    return { error };
  }
};

const AuctionModel = {
  async start(roomId, playerData) {
    const { data, error } = await supabase
      .from('auctions')
      .insert([{
        room_id: roomId,
        player_name: playerData.playerName,
        player_club: playerData.playerClub,
        player_position: playerData.playerPosition,
        starting_price: playerData.startingPrice,
        current_bid: playerData.startingPrice,
        is_active: true
      }])
      .select()
      .single();

    await supabase
      .from('rooms')
      .update({ status: 'auction-active' })
      .eq('id', roomId);

    return { data, error };
  },

  async getActive(roomId) {
    const { data, error } = await supabase
      .from('auctions')
      .select('*')
      .eq('room_id', roomId)
      .eq('is_active', true)
      .single();
    return { data, error };
  },

  async placeBid(roomId, auctionId, userId, userName, amount) {
    const { data, error } = await supabase
      .from('bids')
      .insert([{
        room_id: roomId,
        auction_id: auctionId,
        user_id: userId,
        user_name: userName,
        amount
      }]);

    if (!error) {
      await supabase
        .from('auctions')
        .update({ current_bid: amount, leading_bidder: userName })
        .eq('id', auctionId);
    }

    return { data, error };
  },

  async finalize(auctionId, winnerName, winningBid) {
    const { data, error } = await supabase
      .from('auctions')
      .update({
        is_active: false,
        winner_name: winnerName,
        winning_bid: winningBid
      })
      .eq('id', auctionId);

    if (!error && winnerName) {
      await supabase
        .from('wins')
        .insert([{
          auction_id: auctionId,
          winner_name: winnerName,
          amount: winningBid
        }]);
    }

    return { data, error };
  }
};

// Socket.io Event Handlers
io.on('connection', (socket) => {
  console.log(`⚡ New connection: ${socket.id}`);

  // Create Room
  socket.on('create-room', async ({ roomName, bidIncrement }, callback) => {
    try {
      const { data, error } = await RoomModel.create(roomName, bidIncrement);
      if (error) throw error;

      callback({ 
        success: true,
        roomId: data.id
      });
    } catch (err) {
      callback({ 
        success: false, 
        message: "Failed to create room",
        error: err.message 
      });
    }
  });

  // Join Room
  socket.on('join-room', async ({ roomId, userId, userName, role }, callback) => {
    try {
      const { data: room, error: roomError } = await RoomModel.get(roomId);
      if (roomError || !room) throw new Error("Room not found");

      const { data: participant, error: joinError } = await ParticipantModel.joinRoom(
        roomId, 
        userId, 
        userName,
        socket.id, 
        role
      );
      if (joinError) throw joinError;

      const { data: participants, error: participantsError } = await ParticipantModel.getByRoom(roomId);
      if (participantsError) throw participantsError;

      socket.join(roomId);
      socket.roomId = roomId;
      socket.userId = userId;
      socket.userName = userName;
      socket.role = role;

      // Get active auction if exists
      let currentAuction = null;
      if (room.status === 'auction-active') {
        const { data: auction } = await AuctionModel.getActive(roomId);
        currentAuction = auction ? {
          playerName: auction.player_name,
          playerClub: auction.player_club,
          playerPosition: auction.player_position,
          startingPrice: auction.starting_price,
          currentBid: auction.current_bid,
          leadingBidder: auction.leading_bidder,
          isActive: auction.is_active
        } : null;
      }

      io.to(roomId).emit('participant-joined', {
        name: userName,
        participants: participants.map(p => ({
          id: p.user_id,
          name: p.name,
          role: p.role,
          socketId: p.socket_id
        }))
      });

      callback({ 
        success: true,
        currentAuction,
        bidIncrement: room.bid_increment,
        participants: participants.map(p => ({
          id: p.user_id,
          name: p.name,
          role: p.role
        }))
      });
    } catch (err) {
      callback({ 
        success: false, 
        message: err.message || "Failed to join room" 
      });
    }
  });

  // Start Auction
  socket.on('start-auction', async (playerData, callback) => {
    try {
      if (socket.role !== 'auctioneer') {
        throw new Error("Not authorized");
      }

      const roomId = socket.roomId;
      if (!roomId) throw new Error("Not in a room");

      const { data: auction, error } = await AuctionModel.start(roomId, playerData);
      if (error) throw error;

      const auctionData = {
        playerName: auction.player_name,
        playerClub: auction.player_club,
        playerPosition: auction.player_position,
        startingPrice: auction.starting_price,
        currentBid: auction.current_bid,
        isActive: auction.is_active
      };

      io.to(roomId).emit('auction-started', auctionData);
      callback({ success: true });
    } catch (err) {
      callback({ 
        success: false, 
        message: err.message || "Failed to start auction" 
      });
    }
  });

  // Place Bid
  socket.on('place-bid', async (callback) => {
    try {
      const roomId = socket.roomId;
      if (!roomId) throw new Error("Not in a room");

      const { data: room, error: roomError } = await RoomModel.get(roomId);
      if (roomError || !room) throw new Error("Room not found");

      const { data: auction, error: auctionError } = await AuctionModel.getActive(roomId);
      if (auctionError || !auction) throw new Error("No active auction");

      const newBid = auction.current_bid + room.bid_increment;
      const { error: bidError } = await AuctionModel.placeBid(
        roomId,
        auction.id,
        socket.userId,
        socket.userName,
        newBid
      );
      if (bidError) throw bidError;

      io.to(roomId).emit('bid-placed', {
        currentBid: newBid,
        leadingBidder: socket.userName
      });

      io.to(roomId).emit('call-update', {
        callCount: 0,
        message: "New bid placed!"
      });

      callback({ success: true });
    } catch (err) {
      callback({ 
        success: false, 
        message: err.message || "Failed to place bid" 
      });
    }
  });

  // Final Call
  socket.on('final-call', async (callback) => {
    try {
      if (socket.role !== 'auctioneer') {
        throw new Error("Not authorized");
      }

      const roomId = socket.roomId;
      if (!roomId) throw new Error("Not in a room");

      const { data: auction, error: auctionError } = await AuctionModel.getActive(roomId);
      if (auctionError || !auction) throw new Error("No active auction");

      // In a real implementation, you would track call count in the database
      // For simplicity, we'll use the same logic as server.js but with database updates
      const callCount = auction.call_count ? auction.call_count + 1 : 1;

      await supabase
        .from('auctions')
        .update({ call_count: callCount })
        .eq('id', auction.id);

      const message = getCallMessage(callCount);
      io.to(roomId).emit('call-update', {
        callCount,
        message
      });

      if (callCount === 3) {
        setTimeout(async () => {
          const { data: updatedAuction } = await AuctionModel.getActive(roomId);
          if (updatedAuction && updatedAuction.call_count === 3) {
            await AuctionModel.finalize(
              auction.id,
              auction.leading_bidder,
              auction.current_bid
            );

            await RoomModel.updateStatus(roomId, 'waiting');

            io.to(roomId).emit('auction-ended', {
              playerName: auction.player_name,
              winnerName: auction.leading_bidder || 'No Winner',
              winningBid: auction.current_bid
            });

            // Update participants with wins
            const { data: participants } = await ParticipantModel.getByRoom(roomId);
            io.to(roomId).emit('participant-updated', {
              participants: participants.map(p => ({
                id: p.user_id,
                name: p.name,
                role: p.role,
                wins: [] // Would need to fetch actual wins in a real implementation
              }))
            });
          }
        }, 3000);
      }

      callback({ 
        success: true,
        callCount
      });
    } catch (err) {
      callback({ 
        success: false, 
        message: err.message || "Failed to process final call" 
      });
    }
  });

  // Get Participant Wins
  socket.on('get-participant-wins', async ({ participantName }, callback) => {
    try {
      const roomId = socket.roomId;
      if (!roomId) throw new Error("Not in a room");

      const { data: wins, error } = await supabase
        .from('wins')
        .select('*')
        .eq('winner_name', participantName)
        .eq('room_id', roomId);

      if (error) throw error;

      callback({ 
        success: true, 
        wins: wins.map(w => ({
          playerName: w.player_name,
          amount: w.amount
        }))
      });
    } catch (err) {
      callback({ 
        success: false, 
        message: err.message || "Failed to get wins" 
      });
    }
  });

  // Disconnect
  socket.on('disconnect', async () => {
    try {
      await ParticipantModel.leave(socket.id);
      
      const roomId = socket.roomId;
      if (roomId) {
        const { data: participants } = await ParticipantModel.getByRoom(roomId);
        io.to(roomId).emit('participant-left', {
          name: socket.userName,
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

function getCallMessage(count) {
  switch(count) {
    case 1: return "First Call!";
    case 2: return "Second Call!";
    case 3: return "Final Call!";
    default: return "Going once...";
  }
}

// Health Check Endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date()
  });
});

// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

// Start Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`
  🚀 Server running on port ${PORT}
  Supabase URL: ${process.env.SUPABASE_URL}
  Client URL: ${process.env.CLIENT_URL || 'Any'}
  `);
});