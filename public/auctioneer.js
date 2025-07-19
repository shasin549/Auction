document.addEventListener("DOMContentLoaded", async () => {
  // Initialize Supabase
  const supabaseUrl = 'https://flwqvepusbjmgoovqvmi.supabase.co';
  const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZsd3F2ZXB1c2JqbWdvb3Zxdm1pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI5MDY3MzMsImV4cCI6MjA2ODQ4MjczM30.or5cIl99nUDZceOKlFMnu8PCzLuCvXT5TBJvKTPSUvM';
  const supabase = createClient(supabaseUrl, supabaseKey, {
    db: { schema: 'public' },
    auth: { persistSession: false }
  });

  // Initialize Socket.IO
  const socket = io('https://auction-zfku.onrender.com', {
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    timeout: 20000,
    transports: ['websocket']
  });

  // DOM Elements
  const connectionStatus = document.getElementById("connection-status");
  const statusDot = document.querySelector('.status-dot');
  const createRoomBtn = document.getElementById("createRoomBtn");
  const roomNameInput = document.getElementById("roomName");
  const roomInfo = document.getElementById("roomInfo");
  const roomIdDisplay = document.getElementById("roomIdDisplay");
  const inviteLink = document.getElementById("inviteLink");
  const copyLinkBtn = document.getElementById("copyLinkBtn");
  const participantCount = document.getElementById("participantCount");
  const playerForm = document.getElementById("playerForm");
  const startAuctionBtn = document.getElementById("startAuctionBtn");
  const finalCallBtn = document.getElementById("finalCallBtn");
  const nextPlayerBtn = document.getElementById("nextPlayerBtn");
  const participantsContainer = document.getElementById("participantsContainer");

  // State variables
  let roomId = "";
  let currentPlayer = null;
  let currentAuctionId = null;
  let callCount = 0;

  // Connection status handling
  function updateConnectionStatus(text, color) {
    connectionStatus.textContent = text;
    connectionStatus.style.color = color;
    statusDot.style.backgroundColor = color;
  }

  socket.on('connect', () => {
    updateConnectionStatus("Connected", "#10B981");
    createRoomBtn.disabled = false;
  });

  socket.on('disconnect', () => {
    updateConnectionStatus("Disconnected", "#EF4444");
    createRoomBtn.disabled = true;
  });

  socket.on('connect_error', (err) => {
    updateConnectionStatus("Connection Error", "#F59E0B");
    console.error("Socket error:", err);
  });

  // Create Auction Room (Fixed for your schema)
  createRoomBtn.addEventListener("click", async () => {
    const roomName = roomNameInput.value.trim();

    if (!roomName) {
      showToast("Please enter a room name", "error");
      return;
    }

    setButtonLoading(createRoomBtn, true);

    try {
      // Create room with just name (other columns don't exist)
      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .insert([{ name: roomName }])
        .select()
        .single();

      if (roomError || !roomData) {
        throw roomError || new Error("Failed to create room");
      }

      roomId = roomData.id;
      console.log("Room created with ID:", roomId);

      // Join as auctioneer in Supabase
      const { error: joinError } = await supabase
        .from('participants')
        .insert([{
          room_id: roomId,
          socket_id: socket.id,
          name: "Auctioneer",
          role: "auctioneer",
          is_online: true
        }]);

      if (joinError) throw joinError;

      // Update UI
      roomIdDisplay.textContent = roomId;
      inviteLink.href = `${window.location.origin}/bidder.html?room=${roomId}`;
      inviteLink.textContent = `${window.location.origin}/bidder.html?room=${roomId}`;

      // Join socket room
      socket.emit("join-room", {
        roomId,
        userName: "Auctioneer",
        role: "auctioneer"
      }, (response) => {
        if (response.error) throw new Error(response.error);
      });

      // Show UI updates
      roomInfo.classList.remove("hidden");
      playerForm.classList.remove("hidden");
      showToast("Room created successfully!", "success");

    } catch (err) {
      console.error("Room creation failed:", err);
      showToast(`Failed to create room: ${err.message}`, "error");
    } finally {
      setButtonLoading(createRoomBtn, false, "Create Room");
    }
  });

  // Copy Invite Link
  copyLinkBtn?.addEventListener("click", () => {
    navigator.clipboard.writeText(inviteLink.href)
      .then(() => {
        showToast("Invite link copied!", "success");
        copyLinkBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
        setTimeout(() => {
          copyLinkBtn.innerHTML = '<i class="fas fa-copy"></i> Copy';
        }, 2000);
      })
      .catch(() => showToast("Failed to copy link", "error"));
  });

  // Start Auction
  startAuctionBtn.addEventListener("click", async () => {
    const playerName = document.getElementById("playerName").value.trim();
    const playerClub = document.getElementById("playerClub").value.trim();
    const playerPosition = document.getElementById("playerPosition").value.trim();
    const startingPrice = parseInt(document.getElementById("startingPrice").value);

    if (!validatePlayerInput(playerName, playerClub, playerPosition, startingPrice)) {
      return;
    }

    setButtonLoading(startAuctionBtn, true);

    try {
      const { data: playerData, error } = await supabase
        .from('players')
        .insert([{
          room_id: roomId,
          name: playerName,
          club: playerClub,
          position: playerPosition,
          starting_price: startingPrice,
          status: 'auctioning',
          current_bid: startingPrice
        }])
        .select();

      if (error || !playerData) throw error || new Error("Failed to create player");

      currentAuctionId = playerData[0].id;
      currentPlayer = { 
        playerName, playerClub, playerPosition, startingPrice,
        playerId: playerData[0].id
      };

      updatePlayerPreview(currentPlayer);
      document.getElementById("playerPreview").classList.remove("hidden");
      finalCallBtn.classList.remove("hidden");

      socket.emit("start-auction", {
        ...currentPlayer,
        roomId
      });

      showToast("Auction started!", "success");
    } catch (err) {
      console.error("Start auction failed:", err);
      showToast(`Failed to start auction: ${err.message}`, "error");
    } finally {
      setButtonLoading(startAuctionBtn, false, "Start Auction");
    }
  });

  // Final Call Handler
  finalCallBtn.addEventListener("click", async () => {
    callCount++;
    const message = getCallMessage(callCount);

    try {
      await supabase
        .from('players')
        .update({ call_count: callCount })
        .eq('id', currentAuctionId);

      socket.emit("final-call", { 
        roomId,
        callCount,
        message 
      });

      finalCallBtn.textContent = message;

      if (callCount === 3) {
        setTimeout(async () => {
          await endAuction();
        }, 3000);
      }
    } catch (err) {
      console.error("Final call failed:", err);
      showToast("Failed to process final call", "error");
    }
  });

  // Helper Functions
  function validatePlayerInput(name, club, position, price) {
    if (!name || !club || !position || isNaN(price) || price <= 0) {
      showToast("Please fill all fields with valid values", "error");
      return false;
    }
    return true;
  }

  async function endAuction() {
    try {
      const { data: bidData, error: bidError } = await supabase
        .from('bids')
        .select('bidder_name, amount')
        .eq('player_id', currentAuctionId)
        .order('amount', { ascending: false })
        .limit(1);

      if (bidError) throw bidError;

      const winnerName = bidData.length > 0 ? bidData[0].bidder_name : 'No Winner';
      const winningBid = bidData.length > 0 ? bidData[0].amount : 0;

      if (winnerName !== 'No Winner') {
        await supabase
          .from('winners')
          .insert([{
            player_id: currentAuctionId,
            winner_name: winnerName,
            winning_bid: winningBid,
            room_id: roomId
          }]);
      }

      await supabase
        .from('players')
        .update({ status: 'sold' })
        .eq('id', currentAuctionId);

      socket.emit("auction-ended", {
        roomId,
        playerName: currentPlayer.playerName,
        winnerName,
        winningBid
      });

      nextPlayerBtn.classList.remove("hidden");
      showToast(`Auction ended! Winner: ${winnerName}`, "success");
    } catch (err) {
      console.error("End auction failed:", err);
      showToast("Failed to end auction", "error");
    }
  }

  function updatePlayerPreview(player) {
    document.getElementById("previewName").textContent = player.playerName.toUpperCase();
    document.getElementById("previewClub").textContent = player.playerClub;
    document.getElementById("previewPosition").textContent = player.playerPosition;
    document.getElementById("previewPrice").textContent = `₹${player.startingPrice}M`;
    document.getElementById("currentBid").textContent = player.startingPrice;
    document.getElementById("leadingBidder").textContent = "-";
  }

  function setButtonLoading(button, isLoading, originalText = "Create Room") {
    button.disabled = isLoading;
    button.innerHTML = isLoading 
      ? '<span class="spinner"></span> Processing...' 
      : originalText;
  }

  function getCallMessage(count) {
    switch(count) {
      case 1: return "First Call!";
      case 2: return "Second Call!";
      case 3: return "Final Call!";
      default: return "Going once...";
    }
  }

  function showToast(message, type) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // Socket event listeners
  socket.on("participant-joined", updateParticipants);
  socket.on("participant-left", updateParticipants);
  socket.on("bid-placed", handleNewBid);

  async function updateParticipants(data) {
    const { count } = await supabase
      .from('participants')
      .select('*', { count: 'exact', head: true })
      .eq('room_id', roomId)
      .eq('is_online', true);

    participantCount.textContent = count || 0;
    showToast(`${data.user.name} ${data.action} the room`, "info");
  }

  function handleNewBid({ currentBid, leadingBidder }) {
    document.getElementById("currentBid").textContent = currentBid;
    document.getElementById("leadingBidder").textContent = leadingBidder;
    callCount = 0;
    finalCallBtn.textContent = "Final Call!";
    showToast(`New bid: ₹${currentBid} by ${leadingBidder}`, "info");
  }

  // Cleanup on page exit
  window.addEventListener('beforeunload', async () => {
    try {
      await supabase
        .from('participants')
        .update({ is_online: false })
        .eq('socket_id', socket.id);
    } catch (err) {
      console.error("Cleanup error:", err);
    }
  });
});