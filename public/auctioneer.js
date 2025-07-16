document.addEventListener("DOMContentLoaded", () => {
  // Socket.IO connection with enhanced configuration
  const socket = io('https://auction-zfku.onrender.com', {
    transports: ['websocket', 'polling'],
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    timeout: 10000
  });

  // DOM Elements
  const connectionStatus = document.getElementById("connection-status");
  const createRoomBtn = document.getElementById("createRoomBtn");
  const roomNameInput = document.getElementById("roomName");
  const bidIncrementInput = document.getElementById("bidIncrement");
  const roomInfo = document.getElementById("roomInfo");
  const roomIdDisplay = document.getElementById("roomIdDisplay");
  const inviteLink = document.getElementById("inviteLink");
  const participantCount = document.getElementById("participantCount");
  const playerForm = document.getElementById("playerForm");
  const playerPreview = document.getElementById("playerPreview");

  // Player form elements
  const playerNameInput = document.getElementById("playerName");
  const playerClubInput = document.getElementById("playerClub");
  const playerPositionInput = document.getElementById("playerPosition");
  const startingPriceInput = document.getElementById("startingPrice");
  const startAuctionBtn = document.getElementById("startAuctionBtn");
  const finalCallBtn = document.getElementById("finalCallBtn");
  const nextPlayerBtn = document.getElementById("nextPlayerBtn");

  // Preview elements
  const previewName = document.getElementById("previewName");
  const previewClub = document.getElementById("previewClub");
  const previewPosition = document.getElementById("previewPosition");
  const previewPrice = document.getElementById("previewPrice");
  const currentBidDisplay = document.getElementById("currentBid");
  const leadingBidderDisplay = document.getElementById("leadingBidder");

  let roomId = "";
  let currentPlayer = null;

  // Connection handling
  socket.on('connect', () => {
    console.log('✅ Connected to server');
    connectionStatus.textContent = "Connected";
    connectionStatus.style.color = "#10B981";
    createRoomBtn.disabled = false;
  });

  socket.on('disconnect', () => {
    console.log('❌ Disconnected from server');
    connectionStatus.textContent = "Disconnected";
    connectionStatus.style.color = "#EF4444";
    createRoomBtn.disabled = true;
  });

  socket.on('connect_error', (err) => {
    console.error('Connection error:', err);
    connectionStatus.textContent = "Connection Error";
    connectionStatus.style.color = "#F59E0B";
  });

  // Create Room Button Handler
  createRoomBtn.addEventListener("click", () => {
    const roomName = roomNameInput.value.trim();
    const bidIncrement = parseInt(bidIncrementInput.value);

    if (!roomName) {
      alert("Please enter a room name");
      return;
    }

    roomId = generateRoomId();
    createRoomBtn.disabled = true;
    createRoomBtn.textContent = "Creating...";

    socket.emit("create-room", {
      roomId,
      roomName,
      bidIncrement,
      maxParticipants: 100
    }, (response) => {
      if (response?.success) {
        // Join as auctioneer
        socket.emit("join-room", {
          roomId,
          userName: "Auctioneer",
          role: "auctioneer"
        }, (joinResponse) => {
          if (joinResponse?.success) {
            // Update UI
            roomIdDisplay.textContent = roomId;
            inviteLink.textContent = `${window.location.origin}/bidder.html?room=${roomId}`;
            inviteLink.href = `${window.location.origin}/bidder.html?room=${roomId}`;
            roomInfo.classList.remove("hidden");
            playerForm.classList.remove("hidden");
            createRoomBtn.textContent = "Room Created";

            // Enable copy functionality
            inviteLink.addEventListener('click', (e) => {
              e.preventDefault();
              navigator.clipboard.writeText(inviteLink.textContent)
                .then(() => alert("Invite link copied to clipboard!"))
                .catch(() => alert("Failed to copy link"));
            });
          } else {
            handleError(joinResponse?.message || "Failed to join room");
          }
        });
      } else {
        handleError(response?.message || "Failed to create room");
      }
    });
  });

  // Start Auction Button Handler
  startAuctionBtn.addEventListener("click", () => {
    const playerName = playerNameInput.value.trim();
    const playerClub = playerClubInput.value.trim();
    const playerPosition = playerPositionInput.value.trim();
    const startingPrice = parseInt(startingPriceInput.value);

    if (!playerName || !playerClub || !playerPosition || isNaN(startingPrice)) {
      alert("Please fill all player fields correctly");
      return;
    }

    currentPlayer = {
      playerName,
      playerClub,
      playerPosition,
      startingPrice
    };

    // Update preview
    updatePlayerPreview(currentPlayer);
    playerPreview.classList.remove("hidden");
    startAuctionBtn.disabled = true;
    finalCallBtn.classList.remove("hidden");

    // Start auction
    socket.emit("start-auction", currentPlayer, (response) => {
      if (!response?.success) {
        alert(response?.message || "Failed to start auction");
        startAuctionBtn.disabled = false;
        finalCallBtn.classList.add("hidden");
      }
    });
  });

  // Final Call Button Handler
  finalCallBtn.addEventListener("click", () => {
    finalCallBtn.disabled = true;
    nextPlayerBtn.classList.remove("hidden");

    // End the auction
    socket.emit("end-auction", (response) => {
      if (!response?.success) {
        alert(response?.message || "Failed to end auction");
        finalCallBtn.disabled = false;
        nextPlayerBtn.classList.add("hidden");
      }
    });
  });

  // Next Player Button Handler
  nextPlayerBtn.addEventListener("click", () => {
    resetPlayerForm();
    playerPreview.classList.add("hidden");
    startAuctionBtn.disabled = false;
    finalCallBtn.classList.add("hidden");
    nextPlayerBtn.classList.add("hidden");
    finalCallBtn.disabled = false;
  });

  // Socket event listeners
  socket.on("participant-joined", (data) => {
    participantCount.textContent = data.participants.length;
  });

  socket.on("participant-left", (data) => {
    participantCount.textContent = data.participants.length;
  });

  socket.on("bid-placed", (data) => {
    currentBidDisplay.textContent = data.currentBid;
    leadingBidderDisplay.textContent = data.leadingBidder;
  });

  // Helper functions
  function generateRoomId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  function updatePlayerPreview(player) {
    previewName.textContent = player.playerName.toUpperCase();
    previewClub.textContent = player.playerClub;
    previewPosition.textContent = player.playerPosition;
    previewPrice.textContent = `₹${player.startingPrice}M`;
    currentBidDisplay.textContent = player.startingPrice;
    leadingBidderDisplay.textContent = "-";
  }

  function resetPlayerForm() {
    playerNameInput.value = "";
    playerClubInput.value = "";
    playerPositionInput.value = "";
    startingPriceInput.value = "";
    currentPlayer = null;
  }

  function handleError(message) {
    alert(message);
    createRoomBtn.disabled = false;
    createRoomBtn.textContent = "Create Room";
  }
});