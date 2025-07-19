const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Supabase configuration
const supabaseUrl = 'https://flwqvepusbjmgoovqvmi.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZsd3F2ZXB1c2JqbWdvb3Zxdm1pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI5MDY3MzMsImV4cCI6MjA2ODQ4MjczM30.or5cIl99nUDZceOKlFMnu8PCzLuCvXT5TBJvKTPSUvM';
const supabase = createClient(supabaseUrl, supabaseKey);

app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', (socket) => {
  console.log(`New connection: ${socket.id}`);

  // Create a new room
  socket.on('create-room', async ({ roomName, bidIncrement }, callback) => {
    try {
      const { data, error } = await supabase
        .from('rooms')
        .insert([
          { 
            name: roomName,
            bid_increment: bidIncrement || 10
          }
        ])
        .select();
        
      if (error) throw error;
      
      const room = data[0];
      callback({ 
        success: true,
        roomId: room.id
      });
    } catch (err) {
      console.error('Error creating room:', err);
      callback({ success: false, message: "Failed to create room" });
    }
  });

  // Join an existing room
  socket.on('join-room', async ({ roomId, userName, role }, callback) => {
    try {
      // Check if room exists
      const { data: room, error: roomError } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', roomId)
        .single();
        
      if (roomError || !room) {
        return callback({ success: false, message: "Room not found" });
      }

      // Add participant to database
      const { data: participant, error: participantError } = await supabase
        .from('participants')
        .insert([
          {
            room_id: roomId,
            socket_id: socket.id,
            name: userName,
            role: role
          }
        ])
        .select()
        .single();
        
      if (participantError) throw participantError;

      socket.join(roomId);
      socket.roomId = roomId;
      socket.userName = userName;
      socket.role = role;

      // Get all participants
      const { data: participants, error: participantsError } = await supabase
        .from('participants')
        .select('*')
        .eq('room_id', roomId);
        
      if (participantsError) throw participantsError;

      io.to(roomId).emit('participant-joined', {
        name: userName,
        participants: participants
      });

      // Check for active auction
      const { data: activeAuction, error: auctionError } = await supabase
        .from('players')
        .select('*')
        .eq('room_id', roomId)
        .eq('is_active', true)
        .single();

      callback({ 
        success: true,
        currentAuction: activeAuction || null,
        bidIncrement: room.bid_increment
      });
    } catch (err) {
      console.error('Error joining room:', err);
      callback({ success: false, message: "Failed to join room" });
    }
  });

  // Start a new auction
  socket.on('start-auction', async (playerData, callback) => {
    try {
      if (socket.role !== 'auctioneer') {
        return callback({ success: false, message: "Not authorized" });
      }

      const { data, error } = await supabase
        .from('players')
        .insert([
          {
            room_id: socket.roomId,
            name: playerData.playerName,
            club: playerData.playerClub,
            position: playerData.playerPosition,
            starting_price: playerData.startingPrice
          }
        ])
        .select()
        .single();
        
      if (error) throw error;

      socket.to(socket.roomId).emit('auction-started', {
        playerName: playerData.playerName,
        playerClub: playerData.playerClub,
        playerPosition: playerData.playerPosition,
        startingPrice: playerData.startingPrice
      });

      callback({ success: true });
    } catch (err) {
      console.error('Error starting auction:', err);
      callback({ success: false, message: "Failed to start auction" });
    }
  });

  // Place a bid
  socket.on('place-bid', async (callback) => {
    try {
      // Get active auction
      const { data: player, error: playerError } = await supabase
        .from('players')
        .select('*')
        .eq('room_id', socket.roomId)
        .eq('is_active', true)
        .single();
        
      if (playerError || !player) {
        return callback({ success: false, message: "No active auction" });
      }

      // Get current highest bid
      const { data: highestBid, error: bidError } = await supabase
        .from('bids')
        .select('amount')
        .eq('player_id', player.id)
        .order('amount', { ascending: false })
        .limit(1)
        .single();
        
      const currentBid = highestBid?.amount || player.starting_price;
      const newBid = currentBid + player.bid_increment;

      // Record the bid
      const { error } = await supabase
        .from('bids')
        .insert([
          {
            player_id: player.id,
            bidder_name: socket.userName,
            amount: newBid
          }
        ]);
        
      if (error) throw error;

      io.to(socket.roomId).emit('bid-placed', {
        currentBid: newBid,
        leadingBidder: socket.userName
      });

      io.to(socket.roomId).emit('call-update', {
        callCount: 0,
        message: "New bid placed!"
      });

      callback({ success: true });
    } catch (err) {
      console.error('Error placing bid:', err);
      callback({ success: false, message: "Bid failed" });
    }
  });

  // Final call for auction
  socket.on('final-call', async ({ roomId, callCount }, callback) => {
    try {
      if (socket.role !== 'auctioneer') {
        return callback({ success: false, message: "Not authorized" });
      }

      // Get active auction
      const { data: player, error: playerError } = await supabase
        .from('players')
        .select('*')
        .eq('room_id', roomId)
        .eq('is_active', true)
        .single();
        
      if (playerError || !player) {
        return callback({ success: false, message: "No active auction" });
      }

      const message = getCallMessage(callCount);
      io.to(roomId).emit('call-update', {
        callCount,
        message
      });

      if (callCount === 3) {
        // Get winning bid
        const { data: winningBid, error: bidError } = await supabase
          .from('bids')
          .select('*')
          .eq('player_id', player.id)
          .order('amount', { ascending: false })
          .limit(1)
          .single();
          
        if (bidError) throw bidError;

        const winnerName = winningBid?.bidder_name || 'No Winner';
        const winningBidAmount = winningBid?.amount || 0;

        if (winnerName !== 'No Winner') {
          // Record winner
          await supabase
            .from('winners')
            .insert([
              {
                player_id: player.id,
                room_id: roomId,
                winner_name: winnerName,
                winning_bid: winningBidAmount
              }
            ]);
        }

        // Mark player as inactive
        await supabase
          .from('players')
          .update({ is_active: false })
          .eq('id', player.id);

        io.to(roomId).emit('auction-ended', {
          playerName: player.name,
          winnerName,
          winningBid: winningBidAmount
        });

        // Update participants list with wins
        const { data: participants, error: participantsError } = await supabase
          .from('participants')
          .select('*')
          .eq('room_id', roomId);
          
        if (participantsError) throw participantsError;

        io.to(roomId).emit('participant-updated', {
          participants: participants
        });
      }

      callback({ 
        success: true,
        callCount
      });
    } catch (err) {
      console.error('Error processing final call:', err);
      callback({ success: false, message: "Failed to process final call" });
    }
  });

  // Get participant wins
  socket.on('get-participant-wins', async ({ participantName }, callback) => {
    try {
      const { data, error } = await supabase
        .from('winners')
        .select(`
          winning_bid,
          players:player_id (name)
        `)
        .eq('winner_name', participantName);
        
      if (error) throw error;

      const wins = data.map(win => ({
        playerName: win.players.name,
        amount: win.winning_bid
      }));

      callback({ 
        success: true,
        wins
      });
    } catch (err) {
      console.error('Error getting participant wins:', err);
      callback({ success: false, message: "Failed to get wins" });
    }
  });

  // Handle disconnection
  socket.on('disconnect', async () => {
    try {
      if (socket.roomId) {
        // Remove participant from database
        await supabase
          .from('participants')
          .delete()
          .eq('socket_id', socket.id);

        // Get updated participants list
        const { data: participants, error } = await supabase
          .from('participants')
          .select('*')
          .eq('room_id', socket.roomId);
          
        if (!error) {
          io.to(socket.roomId).emit('participant-left', {
            name: socket.userName,
            participants: participants || []
          });
        }
      }
    } catch (err) {
      console.error('Error handling disconnect:', err);
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

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});