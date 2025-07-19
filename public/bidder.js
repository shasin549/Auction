document.addEventListener("DOMContentLoaded", async () => {
  // Initialize Supabase
  const supabaseUrl = 'https://flwqvepusbjmgoovqvmi.supabase.co';
  const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZsd3F2ZXB1c2JqbWdvb3Zxdm1pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI5MDY3MzMsImV4cCI6MjA2ODQ4MjczM30.or5cIl99nUDZceOKlFMnu8PCzLuCvXT5TBJvKTPSUvM';
  const supabase = createClient(supabaseUrl, supabaseKey);

  const socket = io('https://auction-zfku.onrender.com', {
    transports: ['websocket', 'polling'],
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    timeout: 10000
  });

  // DOM Elements
  const joinSection = document.getElementById("joinSection");
  const auctionSection = document.getElementById("auctionSection");
  const connectionStatus = document.getElementById("connectionStatus");
  const joinBtn = document.getElementById("joinBtn");
  const placeBidBtn = document.getElementById("placeBidBtn");
  const bidIncrementValue = document.getElementById("bidIncrementValue");

  // Player Info Displays
  const playerNameDisplay = document.getElementById("playerNameDisplay");
  const playerClubDisplay = document.getElementById("playerClub");
  const playerPositionDisplay = document.getElementById("playerPosition");
  const startingPriceDisplay = document.getElementById("startingPriceDisplay");

  // Bid Info Displays
  const currentBidDisplay = document.getElementById("currentBid");
  const leadingBidderDisplay = document.getElementById("leadingBidder");

  // Winner Info
  const winnerSection = document.getElementById("winnerSection");
  const wonPlayerDisplay = document.getElementById("wonPlayer");
  const winnerNameDisplay = document.getElementById("winnerName");
  const winningBidDisplay = document.getElementById("winningBid");

  // State
  let userName = "";
  let roomId = "";
  let hasBid = false;
  const currentBidIncrement = 10; // Fixed increment since not in schema
  let currentPlayerId = null;

  // Set fixed bid increment display
  bidIncrementValue.textContent = currentBidIncrement;

  // Extract room ID from URL
  const urlParams = new URLSearchParams(window.location.search);
  const roomIdFromUrl = urlParams.get('room');
  if (roomIdFromUrl) {
    document.getElementById("roomId").value = roomIdFromUrl;
  }

  // Connection Status
  socket.on('connect', () => {
    connectionStatus.querySelector('span').textContent = 'Connected';
    connectionStatus.querySelector('.status-dot').style.backgroundColor = '#10B981';
  });

  socket.on('disconnect', () => {
    connectionStatus.querySelector('span').textContent = 'Disconnected';
    connectionStatus.querySelector('.status-dot').style.backgroundColor = '#EF4444';
  });

  // Join Room
  joinBtn.addEventListener("click", async () => {
    userName = document.getElementById("bidderName").value.trim();
    roomId = document.getElementById("roomId").value.trim();

    if (!userName || !roomId) {
      alert("Please enter your name and room ID");
      return;
    }

    try {
      // Check if room exists (simplified check)
      const { data: room, error: roomError } = await supabase
        .from('rooms')
        .select('id')
        .eq('id', roomId)
        .single();

      if (roomError || !room) {
        throw roomError || new Error("Room not found");
      }

      // Join room in Supabase
      const { error: joinError } = await supabase
        .from('participants')
        .insert([{
          room_id: roomId,
          socket_id: socket.id,
          name: userName,
          role: 'bidder',
          is_online: true
        }]);

      if (joinError) throw joinError;

      // Join socket room
      socket.emit("join-room", { 
        roomId, 
        userName, 
        role: "bidder" 
      });

      // Get current auction if one is active
      const { data: currentAuction, error: auctionError } = await supabase
        .from('players')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (!auctionError && currentAuction && currentAuction.length > 0) {
        updatePlayerDisplay(currentAuction[0]);
        currentPlayerId = currentAuction[0].id;
      }

      // Update UI
      joinSection.classList.add("hidden");
      auctionSection.classList.remove("hidden");

    } catch (err) {
      alert(err.message || "Failed to join room");
      console.error(err);
    }
  });

  // Place Bid
  placeBidBtn.addEventListener("click", async () => {
    if (!currentPlayerId) {
      alert("No active auction to bid on");
      return;
    }

    if (hasBid) {
      alert("Wait for another bid before placing again");
      return;
    }

    try {
      // Get current highest bid
      const { data: highestBid, error: bidError } = await supabase
        .from('bids')
        .select('amount')
        .eq('player_id', currentPlayerId)
        .order('amount', { ascending: false })
        .limit(1);

      if (bidError) throw bidError;

      const currentBid = highestBid.length > 0 ? highestBid[0].amount : 
        parseInt(currentBidDisplay.textContent.replace('₹', '')) || 0;
      const newBid = currentBid + currentBidIncrement;

      // Record bid in Supabase
      const { error } = await supabase
        .from('bids')
        .insert([{
          player_id: currentPlayerId,
          bidder_name: userName,
          amount: newBid,
          room_id: roomId
        }]);

      if (error) throw error;

      // Notify server of bid
      socket.emit("place-bid", { 
        roomId,
        playerId: currentPlayerId,
        bidderName: userName,
        amount: newBid
      });

      hasBid = true;
      placeBidBtn.disabled = true;

    } catch (err) {
      alert("Failed to place bid");
      console.error(err);
      hasBid = false;
      placeBidBtn.disabled = false;
    }
  });

  // Socket Events
  socket.on("auction-started", async (playerData) => {
    try {
      // Get full player details from Supabase
      const { data: player, error } = await supabase
        .from('players')
        .select('*')
        .eq('id', playerData.playerId)
        .single();

      if (error) throw error;

      updatePlayerDisplay(player);
      currentPlayerId = player.id;
      hasBid = false;
      placeBidBtn.disabled = false;
      winnerSection.classList.add("hidden");
    } catch (err) {
      console.error("Error updating player display:", err);
    }
  });

  socket.on("bid-placed", ({ currentBid, leadingBidder }) => {
    currentBidDisplay.textContent = `₹${currentBid}`;
    leadingBidderDisplay.textContent = leadingBidder;

    if (leadingBidder !== userName) {
      hasBid = false;
      placeBidBtn.disabled = false;
    }
  });

  socket.on("auction-ended", ({ playerName, winnerName, winningBid }) => {
    wonPlayerDisplay.textContent = playerName;
    winnerNameDisplay.textContent = winnerName;
    winningBidDisplay.textContent = `₹${winningBid}`;
    winnerSection.classList.remove("hidden");
    placeBidBtn.disabled = true;
    currentPlayerId = null;
  });

  socket.on("call-update", ({ callCount, message }) => {
    if (callCount > 0) {
      let type = '';
      if (callCount === 1) type = 'first';
      else if (callCount === 2) type = 'second';
      else if (callCount === 3) type = 'final';

      showCallPopup(message, type);
    }
  });

  // Helper functions
  function updatePlayerDisplay(player) {
    playerNameDisplay.textContent = player.name.toUpperCase();
    playerClubDisplay.textContent = player.club;
    playerPositionDisplay.textContent = player.position;
    startingPriceDisplay.textContent = `₹${player.starting_price}M`;
    currentBidDisplay.textContent = `₹${player.starting_price}`;
    leadingBidderDisplay.textContent = "-";
  }

  function showCallPopup(message, type) {
    const popup = document.createElement('div');
    popup.className = `call-popup ${type}`;
    popup.textContent = message;
    document.body.appendChild(popup);

    setTimeout(() => popup.classList.add('show'), 10);

    setTimeout(() => {
      popup.classList.remove('show');
      setTimeout(() => popup.remove(), 500);
    }, 3000);
  }

  // Handle page refresh or close
  window.addEventListener('beforeunload', async () => {
    try {
      await supabase
        .from('participants')
        .update({ is_online: false })
        .eq('socket_id', socket.id);
    } catch (err) {
      console.error("Error updating participant status:", err);
    }
  });
});