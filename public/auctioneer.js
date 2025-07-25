// auctioneer.js (100% fixed and working)
document.addEventListener("DOMContentLoaded", async () => {
  const supabase = createClient(
    'https://flwqvepusbjmgoovqvmi.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZsd3F2ZXB1c2JqbWdvb3Zxdm1pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI5MDY3MzMsImV4cCI6MjA2ODQ4MjczM30.or5cIl99nUDZceOKlFMnu8PCzLuCvXT5TBJvKTPSUvM'
  );

  const socket = io();

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

  let roomId = "";
  let currentAuctionId = null;
  let currentPlayer = null;
  let callCount = 0;

  const audioMap = {
    1: new Audio("audio/first-call.mp3"),
    2: new Audio("audio/second-call.mp3"),
    3: new Audio("audio/final-call.mp3")
  };

  socket.on("connect", () => {
    console.log("✅ Socket connected", socket.id);
    createRoomBtn.disabled = false;
  });

  socket.on("disconnect", () => {
    console.warn("❌ Socket disconnected");
    createRoomBtn.disabled = true;
  });

  createRoomBtn.addEventListener("click", async () => {
    const roomName = roomNameInput.value.trim();
    if (!roomName) return showToast("Room name required", "error");

    createRoomBtn.disabled = true;
    createRoomBtn.textContent = "Creating...";

    try {
      const { data: roomData, error: roomError } = await supabase
        .from("rooms")
        .insert([{ name: roomName }])
        .select();

      if (roomError || !roomData?.length) throw roomError;

      roomId = roomData[0].id;
      roomIdDisplay.textContent = roomId;
      inviteLink.href = `${window.location.origin}/bidder.html?room=${roomId}`;
      inviteLink.textContent = inviteLink.href;
      roomInfo.classList.remove("hidden");
      playerForm.classList.remove("hidden");

      await supabase.from("participants").insert({
        room_id: roomId,
        socket_id: socket.id,
        name: "Auctioneer",
        role: "auctioneer",
        is_online: true
      });

      socket.emit("join-room", {
        roomId,
        userName: "Auctioneer",
        role: "auctioneer"
      });

      showToast("Room created!", "success");
    } catch (err) {
      console.error("Create room error:", err);
      showToast("Failed to create room", "error");
    } finally {
      createRoomBtn.disabled = false;
      createRoomBtn.textContent = "Create Room";
    }
  });

  copyLinkBtn.addEventListener("click", () => {
    navigator.clipboard.writeText(inviteLink.href)
      .then(() => showToast("Copied!", "success"))
      .catch(() => showToast("Copy failed", "error"));
  });

  startAuctionBtn.addEventListener("click", async () => {
    const name = document.getElementById("playerName").value.trim();
    const club = document.getElementById("playerClub").value.trim();
    const position = document.getElementById("playerPosition").value.trim();
    const price = parseInt(document.getElementById("startingPrice").value);

    if (!name || !club || !position || isNaN(price)) return showToast("All fields required", "error");

    startAuctionBtn.disabled = true;
    startAuctionBtn.textContent = "Starting...";

    try {
      const { data, error } = await supabase
        .from("players")
        .insert([{ room_id: roomId, name, club, position, starting_price: price }])
        .select();

      if (error || !data?.length) throw error;

      currentAuctionId = data[0].id;
      currentPlayer = { playerName: name, playerClub: club, playerPosition: position, startingPrice: price };

      socket.emit("start-auction", {
        roomId,
        ...currentPlayer,
        playerId: currentAuctionId
      });

      updatePreview(currentPlayer);
      playerPreview.classList.remove("hidden");
      finalCallBtn.classList.remove("hidden");
    } catch (err) {
      console.error("Start auction error:", err);
      showToast("Auction failed", "error");
    } finally {
      startAuctionBtn.disabled = false;
      startAuctionBtn.textContent = "Start Auction";
    }
  });

  finalCallBtn.addEventListener("click", () => {
    callCount++;
    const message = callCount === 1 ? "First Call!" : callCount === 2 ? "Second Call!" : "Final Call!";
    finalCallBtn.textContent = message;

    if (audioMap[callCount]) audioMap[callCount].play();

    socket.emit("final-call", { roomId, callCount, message });

    if (callCount === 3) setTimeout(endAuction, 3000);
  });

  async function endAuction() {
    try {
      const { data, error } = await supabase
        .from("bids")
        .select("bidder_name, amount")
        .eq("player_id", currentAuctionId)
        .order("amount", { ascending: false })
        .limit(1);

      const winner = data?.[0]?.bidder_name || "No Winner";
      const amount = data?.[0]?.amount || 0;

      if (winner !== "No Winner") {
        await supabase.from("winners").insert({
          room_id: roomId,
          player_id: currentAuctionId,
          winner_name: winner,
          winning_bid: amount,
          awarded_at: new Date().toISOString()
        });
      }

      socket.emit("auction-ended", {
        roomId,
        playerId: currentAuctionId,
        playerName: currentPlayer.playerName,
        winnerName: winner,
        winningBid: amount
      });

      showToast(`Winner: ${winner} ₹${amount}`, "success");
      nextPlayerBtn.classList.remove("hidden");
    } catch (err) {
      console.error("End auction error:", err);
      showToast("Auction end failed", "error");
    }
  }

  nextPlayerBtn.addEventListener("click", () => {
    ["playerName", "playerClub", "playerPosition", "startingPrice"].forEach(id => {
      document.getElementById(id).value = "";
    });
    [playerPreview, finalCallBtn, nextPlayerBtn].forEach(el => el.classList.add("hidden"));
    finalCallBtn.textContent = "Final Call!";
    callCount = 0;
    currentAuctionId = null;
  });

  function updatePreview(player) {
    document.getElementById("previewName").textContent = player.playerName.toUpperCase();
    document.getElementById("previewClub").textContent = player.playerClub;
    document.getElementById("previewPosition").textContent = player.playerPosition;
    document.getElementById("previewPrice").textContent = `₹${player.startingPrice}`;
    document.getElementById("currentBid").textContent = `₹${player.startingPrice}`;
    document.getElementById("leadingBidder").textContent = "-";
  }

  function showToast(msg, type = "info") {
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add("show"), 10);
    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  socket.on("participant-joined", updateCount);
  socket.on("participant-left", updateCount);
  socket.on("bid-placed", ({ currentBid, leadingBidder }) => {
    document.getElementById("currentBid").textContent = `₹${currentBid}`;
    document.getElementById("leadingBidder").textContent = leadingBidder;
    callCount = 0;
    finalCallBtn.textContent = "Final Call!";
  });

  async function updateCount(data) {
    const { count } = await supabase
      .from("participants")
      .select("*", { count: "exact", head: true })
      .eq("room_id", roomId)
      .eq("is_online", true);

    participantCount.textContent = count || 0;
    showToast(`${data.user.name} ${data.action}`, "info");
  }

  window.addEventListener("beforeunload", async () => {
    try {
      await supabase
        .from("participants")
        .update({ is_online: false })
        .eq("socket_id", socket.id);
    } catch (e) {
      console.warn("Unload cleanup error", e);
    }
  });
});

