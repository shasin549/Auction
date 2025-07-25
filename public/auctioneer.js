document.addEventListener("DOMContentLoaded", async () => {
  // ✅ Supabase setup
  const supabase = createClient(
    'https://flwqvepusbjmgoovqvmi.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZsd3F2ZXB1c2JqbWdvb3Zxdm1pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI5MDY3MzMsImV4cCI6MjA2ODQ4MjczM30.or5cIl99nUDZceOKlFMnu8PCzLuCvXT5TBJvKTPSUvM'
  );

  // ✅ Socket connection
  const socket = io();

  // Elements
  const connectionStatus = document.getElementById("connection-status");
  const statusDot = document.querySelector(".status-dot");
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
  const playerPreview = document.getElementById("playerPreview");

  // State
  let roomId = "";
  let currentPlayer = null;
  let currentAuctionId = null;
  let callCount = 0;

  // Connection status
  socket.on('connect', () => {
    updateConnectionStatus("Connected", "#10B981");
    console.log("✅ Socket connected:", socket.id);
    createRoomBtn.disabled = false;
  });

  socket.on('disconnect', () => {
    updateConnectionStatus("Disconnected", "#EF4444");
    createRoomBtn.disabled = true;
  });

  function updateConnectionStatus(text, color) {
    connectionStatus.textContent = text;
    connectionStatus.style.color = color;
    statusDot.style.backgroundColor = color;
  }

  createRoomBtn.addEventListener("click", async () => {
    const roomName = roomNameInput.value.trim();
    if (!roomName) return showToast("Enter room name", "error");

    if (!socket.connected || !socket.id) {
      showToast("Not connected to server", "error");
      return;
    }

    setButtonLoading(createRoomBtn, true);

    try {
      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .insert([{ name: roomName }])
        .select();

      if (roomError || !roomData?.length) {
        console.error("Room insert failed:", roomError);
        showToast("Room creation failed", "error");
        return;
      }

      roomId = roomData[0].id;
      console.log("✅ Room created:", roomId);

      await supabase.from('participants').insert([{
        room_id: roomId,
        socket_id: socket.id,
        name: "Auctioneer",
        role: "auctioneer",
        is_online: true
      }]);

      socket.emit("join-room", {
        roomId,
        userName: "Auctioneer",
        role: "auctioneer"
      });

      roomIdDisplay.textContent = roomId;
      inviteLink.href = `${window.location.origin}/bidder.html?room=${roomId}`;
      inviteLink.textContent = inviteLink.href;
      roomInfo.classList.remove("hidden");
      playerForm.classList.remove("hidden");

      showToast("Room created!", "success");

    } catch (err) {
      console.error("Error creating room:", err.message);
      showToast("Error creating room", "error");
    } finally {
      setButtonLoading(createRoomBtn, false, "Create Room");
    }
  });

  copyLinkBtn.addEventListener("click", () => {
    navigator.clipboard.writeText(inviteLink.href).then(() => {
      showToast("Link copied!", "success");
    }).catch(() => {
      showToast("Failed to copy", "error");
    });
  });

  startAuctionBtn.addEventListener("click", async () => {
    const playerName = document.getElementById("playerName").value.trim();
    const playerClub = document.getElementById("playerClub").value.trim();
    const playerPosition = document.getElementById("playerPosition").value.trim();
    const startingPrice = parseInt(document.getElementById("startingPrice").value);

    if (!playerName || !playerClub || !playerPosition || isNaN(startingPrice)) {
      return showToast("Fill all fields", "error");
    }

    setButtonLoading(startAuctionBtn, true, "Starting...");

    try {
      const { data, error } = await supabase
        .from('players')
        .insert([{
          room_id: roomId,
          name: playerName,
          club: playerClub,
          position: playerPosition,
          starting_price: startingPrice
        }])
        .select();

      if (error || !data?.length) throw error;

      const playerId = data[0].id;
      currentAuctionId = playerId;
      currentPlayer = { playerName, playerClub, playerPosition, startingPrice, playerId };

      updatePlayerPreview(currentPlayer);
      playerPreview.classList.remove("hidden");
      finalCallBtn.classList.remove("hidden");

      socket.emit("start-auction", {
        roomId,
        ...currentPlayer
      });

      showToast("Auction started!", "success");
    } catch (err) {
      console.error("Auction start error:", err.message);
      showToast("Start failed", "error");
    } finally {
      setButtonLoading(startAuctionBtn, false, "Start Auction");
    }
  });

  finalCallBtn.addEventListener("click", () => {
    callCount++;
    const message = callCount === 1 ? "First Call!" :
                    callCount === 2 ? "Second Call!" :
                    callCount === 3 ? "Final Call!" : "Calling...";
    finalCallBtn.textContent = message;

    socket.emit("final-call", {
      roomId,
      callCount,
      message
    });

    if (callCount === 3) {
      setTimeout(endAuction, 3000);
    }
  });

  async function endAuction() {
    try {
      const { data, error } = await supabase
        .from('bids')
        .select('bidder_name, amount')
        .eq('player_id', currentAuctionId)
        .order('amount', { ascending: false })
        .limit(1);

      const winnerName = data?.[0]?.bidder_name || "No Winner";
      const winningBid = data?.[0]?.amount || 0;

      if (winnerName !== "No Winner") {
        await supabase.from('winners').insert([{
          player_id: currentAuctionId,
          room_id: roomId,
          winner_name: winnerName,
          winning_bid: winningBid,
          awarded_at: new Date().toISOString()
        }]);
      }

      socket.emit("auction-ended", {
        roomId,
        playerId: currentAuctionId,
        playerName: currentPlayer.playerName,
        winnerName,
        winningBid
      });

      showToast(`Winner: ${winnerName} ₹${winningBid}`, "success");
      nextPlayerBtn.classList.remove("hidden");

    } catch (err) {
      console.error("End auction error:", err.message);
      showToast("Auction end failed", "error");
    }
  }

  nextPlayerBtn.addEventListener("click", () => {
    document.getElementById("playerName").value = "";
    document.getElementById("playerClub").value = "";
    document.getElementById("playerPosition").value = "";
    document.getElementById("startingPrice").value = "";

    playerPreview.classList.add("hidden");
    finalCallBtn.classList.add("hidden");
    nextPlayerBtn.classList.add("hidden");
    finalCallBtn.textContent = "Final Call!";

    callCount = 0;
    currentAuctionId = null;
    currentPlayer = null;
  });

  function updatePlayerPreview(player) {
    document.getElementById("previewName").textContent = player.playerName.toUpperCase();
    document.getElementById("previewClub").textContent = player.playerClub;
    document.getElementById("previewPosition").textContent = player.playerPosition;
    document.getElementById("previewPrice").textContent = `₹${player.startingPrice}`;
    document.getElementById("currentBid").textContent = `₹${player.startingPrice}`;
    document.getElementById("leadingBidder").textContent = "-";
  }

  function setButtonLoading(button, loading, text = "Loading...") {
    button.disabled = loading;
    button.innerHTML = loading ? `<span class="spinner"></span> ${text}` : text;
  }

  function showToast(message, type = "info") {
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add("show"), 10);
    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // Real-time updates
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
    document.getElementById("currentBid").textContent = `₹${currentBid}`;
    document.getElementById("leadingBidder").textContent = leadingBidder;
    callCount = 0;
    finalCallBtn.textContent = "Final Call!";
    showToast(`New bid: ₹${currentBid} by ${leadingBidder}`, "info");
  }

  window.addEventListener('beforeunload', async () => {
    try {
      await supabase
        .from('participants')
        .update({ is_online: false })
        .eq('socket_id', socket.id);
    } catch (err) {
      console.error("Unload cleanup failed:", err.message);
    }
  });
});