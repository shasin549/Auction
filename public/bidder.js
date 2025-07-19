document.addEventListener("DOMContentLoaded", () => {
  // Initialize Supabase client
  const supabaseUrl = 'https://flwqvepusbjmgoovqvmi.supabase.co';
  const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZsd3F2ZXB1c2JqbWdvb3Zxdm1pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI5MDY3MzMsImV4cCI6MjA2ODQ4MjczM30.or5cIl99nUDZceOKlFMnu8PCzLuCvXT5TBJvKTPSUvM';
  const supabase = createClient(supabaseUrl, supabaseKey);

  const socket = io('https://auction-zfku.onrender.com', {
    transports: ['websocket', 'polling'],
    reconnectionAttempts: 5
  });

  // DOM Elements
  const joinSection = document.getElementById("joinSection");
  const auctionSection = document.getElementById("auctionSection");
  const connectionStatus = document.getElementById("connectionStatus");
  const joinBtn = document.getElementById("joinBtn");
  const placeBidBtn = document.getElementById("placeBidBtn");
  const bidIncrementValue = document.getElementById("bidIncrementValue");

  // Player Info
  const playerNameDisplay = document.getElementById("playerNameDisplay");
  const playerClubDisplay = document.getElementById("playerClub");
  const playerPositionDisplay = document.getElementById("playerPosition");
  const startingPriceDisplay = document.getElementById("startingPriceDisplay");

  // Bid Info
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
  let currentBidIncrement = 10;
  let currentPlayerId = null;

  // Extract room ID from URL
  const urlParams = new URLSearchParams(window.location.search);
  const roomIdFromUrl = urlParams.get('room');
  if (roomIdFromUrl) {
    document.getElementById("roomId").value = roomIdFromUrl;
  }

  // Connection Status
  socket.on('connect', () => {
    connectionStatus.querySelector('.status-text').textContent = 'Connected';
    connectionStatus.querySelector('.status-icon').style.backgroundColor = '#10B981';
  });

  socket.on('disconnect', () => {
    connectionStatus.querySelector('.status-text').textContent = 'Disconnected';
    connectionStatus.querySelector('.status-icon').style.backgroundColor = '#EF4444';
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
      // Verify room exists
      const { data: room, error: roomError } = await supabase
        .from('rooms')
        .select('bid_increment')
        .eq('id', roomId)
        .single();

      if (roomError || !room) {
        alert("Room not found");
        return;
      }

      socket.emit("join-room", { 
        roomId, 
        userName, 
        role: "bidder" 
      }, (response) => {
        if (response.success) {
          currentBidIncrement = response.bidIncrement || 10;
          bidIncrementValue.textContent = currentBidIncrement;
          joinSection.classList.add("hidden");
          auctionSection.classList.remove("hidden");
          
          // Check for active auction
          checkActiveAuction();
        } else {
          alert(response.message || "Failed to join room");
        }
      });
    } catch (err) {
      console.error("Error joining room:", err);
      alert("Failed to join room");
    }
  });

  // Check for active auction when joining
  async function checkActiveAuction() {
    try {
      const { data: player, error } = await supabase
        .from('players')
        .select('*')
        .eq('room_id', roomId)
        .eq('is_active', true)
        .single();

      if (!error && player) {
        currentPlayerId = player.id;
        playerNameDisplay.textContent = player.name.toUpperCase();
        playerClubDisplay.textContent = player.club;
        playerPositionDisplay.textContent = player.position;
        startingPriceDisplay.textContent = `₹${player.starting_price}M`;
        
        // Get current highest bid
        const { data: highestBid, error: bidError } = await supabase
          .from('bids')
          .select('amount, bidder_name')
          .eq('player_id', player.id)
          .order('amount', { ascending: false })
          .limit(1)
          .single();

        currentBidDisplay.textContent = highestBid?.amount || player.starting_price;
        leadingBidderDisplay.textContent = highestBid?.bidder_name || "-";
        
        hasBid = false;
        placeBidBtn.disabled = false;
      }
    } catch (err) {
      console.error("Error checking active auction:", err);
    }
  }

  // Place Bid
  placeBidBtn.addEventListener("click", () => {
    if (hasBid) {
      alert("Wait for another bid before placing again");
      return;
    }

    socket.emit("place-bid", (response) => {
      if (!response.success) {
        alert(response.message || "Bid failed");
        hasBid = false;
        placeBidBtn.disabled = false;
      } else {
        hasBid = true;
        placeBidBtn.disabled = true;
      }
    });
  });

  // Socket Events
  socket.on("auction-started", (playerData) => {
    playerNameDisplay.textContent = playerData.playerName.toUpperCase();
    playerClubDisplay.textContent = playerData.playerClub;
    playerPositionDisplay.textContent = playerData.playerPosition;
    startingPriceDisplay.textContent = `₹${playerData.startingPrice}M`;
    currentBidDisplay.textContent = playerData.startingPrice;
    leadingBidderDisplay.textContent = "-";

    hasBid = false;
    placeBidBtn.disabled = false;
    winnerSection.classList.add("hidden");
  });

  socket.on("bid-placed", ({ currentBid, leadingBidder }) => {
    currentBidDisplay.textContent = currentBid;
    leadingBidderDisplay.textContent = leadingBidder;

    if (leadingBidder !== userName) {
      hasBid = false;
      placeBidBtn.disabled = false;
    }
  });

  socket.on("auction-ended", async ({ playerName, winnerName, winningBid }) => {
    wonPlayerDisplay.textContent = playerName;
    winnerNameDisplay.textContent = winnerName;
    winningBidDisplay.textContent = winningBid;
    winnerSection.classList.remove("hidden");
    placeBidBtn.disabled = true;
    
    // Update local state
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

  // Show call popup
  function showCallPopup(message, type) {
    const popup = document.createElement('div');
    popup.className = `call-popup ${type}`;
    popup.textContent = message;
    document.body.appendChild(popup);

    // Trigger animation
    setTimeout(() => popup.classList.add('show'), 10);

    // Auto-remove after 3 seconds
    setTimeout(() => {
      popup.classList.remove('show');
      setTimeout(() => popup.remove(), 500);
    }, 3000);
  }

  // Handle page visibility changes
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && roomId) {
      checkActiveAuction();
    }
  });
});