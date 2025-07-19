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
  const connectionStatus = document.getElementById("connection-status");
  const statusDot = document.querySelector('.status-dot');
  const createRoomBtn = document.getElementById("createRoomBtn");
  const roomNameInput = document.getElementById("roomName");
  const bidIncrementInput = document.getElementById("bidIncrement");
  const roomInfo = document.getElementById("roomInfo");
  const roomIdDisplay = document.getElementById("roomIdDisplay");
  const inviteLink = document.getElementById("inviteLink");
  const copyLinkBtn = document.getElementById("copyLinkBtn");
  const participantCount = document.getElementById("participantCount");
  const playerForm = document.getElementById("playerForm");
  const playerPreview = document.getElementById("playerPreview");
  const participantsContainer = document.getElementById("participantsContainer");
  const participantModal = document.getElementById("participantModal");
  const modalParticipantName = document.getElementById("modalParticipantName");
  const wonPlayersList = document.getElementById("wonPlayersList");
  const closeModalBtn = document.querySelector(".close-btn");

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

  // Audio elements
  const firstCallAudio = document.getElementById('firstCallAudio');
  const secondCallAudio = document.getElementById('secondCallAudio');
  const finalCallAudio = document.getElementById('finalCallAudio');

  let roomId = "";
  let currentPlayer = null;
  let currentAuctionId = null;
  let callCount = 0;

  // Connection handling
  socket.on('connect', () => {
    connectionStatus.textContent = "Connected";
    connectionStatus.style.color = "#10B981";
    statusDot.style.backgroundColor = "#10B981";
    createRoomBtn.disabled = false;
    console.log("Connected to server");
  });

  socket.on('disconnect', () => {
    connectionStatus.textContent = "Disconnected";
    connectionStatus.style.color = "#EF4444";
    statusDot.style.backgroundColor = "#EF4444";
    createRoomBtn.disabled = true;
    console.log("Disconnected from server");
  });

  socket.on('connect_error', (err) => {
    connectionStatus.textContent = "Connection Error";
    connectionStatus.style.color = "#F59E0B";
    statusDot.style.backgroundColor = "#F59E0B";
    console.error("Connection error:", err);
  });

  // Create Room with Supabase
  createRoomBtn.addEventListener("click", async () => {
    const roomName = roomNameInput.value.trim();
    const bidIncrement = parseInt(bidIncrementInput.value);

    if (!roomName) {
      showToast("Please enter a room name", "error");
      return;
    }

    createRoomBtn.disabled = true;
    createRoomBtn.innerHTML = '<span class="spinner"></span> Creating...';
    createRoomBtn.classList.add("btn-processing");

    try {
      // Create room in Supabase
      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .insert([{ 
          name: roomName,
          bid_increment: bidIncrement || 10,
          status: 'active'
        }])
        .select();

      if (roomError) throw roomError;

      roomId = roomData[0].id;

      // Join room as auctioneer in Supabase
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

      roomInfo.classList.remove("hidden");
      playerForm.classList.remove("hidden");
      createRoomBtn.textContent = "Room Created";
      createRoomBtn.classList.remove("btn-processing");

      // Join socket room
      socket.emit("join-room", {
        roomId,
        userName: "Auctioneer",
        role: "auctioneer"
      });

      showToast("Room created successfully!", "success");

    } catch (err) {
      handleError("Failed to create room");
      console.error(err);
    }
  });

  // Copy Link Functionality
  copyLinkBtn.addEventListener("click", () => {
    navigator.clipboard.writeText(inviteLink.href)
      .then(() => {
        copyLinkBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
        setTimeout(() => {
          copyLinkBtn.innerHTML = '<i class="fas fa-copy"></i> Copy';
        }, 2000);
        showToast("Invite link copied to clipboard", "success");
      })
      .catch(() => {
        showToast("Failed to copy link", "error");
      });
  });

  // Start Auction with Supabase
  startAuctionBtn.addEventListener("click", async () => {
    const playerName = playerNameInput.value.trim();
    const playerClub = playerClubInput.value.trim();
    const playerPosition = playerPositionInput.value.trim();
    const startingPrice = parseInt(startingPriceInput.value);

    if (!playerName || !playerClub || !playerPosition || isNaN(startingPrice) || startingPrice <= 0) {
      showToast("Please fill all player fields correctly", "error");
      return;
    }

    try {
      startAuctionBtn.disabled = true;
      startAuctionBtn.innerHTML = '<span class="spinner"></span> Starting...';

      // Create player in Supabase
      const { data: playerData, error: playerError } = await supabase
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

      if (playerError) throw playerError;

      currentAuctionId = playerData[0].id;
      currentPlayer = { 
        playerName, 
        playerClub, 
        playerPosition, 
        startingPrice,
        playerId: playerData[0].id
      };

      // Update UI
      updatePlayerPreview(currentPlayer);
      playerPreview.classList.remove("hidden");
      startAuctionBtn.disabled = false;
      startAuctionBtn.textContent = "Start Bidding";
      finalCallBtn.classList.remove("hidden");
      finalCallBtn.disabled = false;

      // Notify all participants via socket
      socket.emit("start-auction", {
        ...currentPlayer,
        roomId
      });

      showToast("Auction started successfully!", "success");

    } catch (err) {
      showToast("Failed to start auction", "error");
      console.error(err);
      resetAuctionState();
    }
  });

  // [Rest of the existing code remains the same...]
  // (Final Call Handler, Next Player Handler, Socket event listeners, and helper functions)

  // Helper functions
  function updatePlayerPreview(player) {
    previewName.textContent = player.playerName.toUpperCase();
    previewClub.textContent = player.playerClub;
    previewPosition.textContent = player.playerPosition;
    previewPrice.textContent = `₹${player.startingPrice}M`;
    currentBidDisplay.textContent = player.startingPrice;
    leadingBidderDisplay.textContent = "-";
  }

  async function updateParticipantsList() {
    try {
      const { data: participants, error } = await supabase
        .from('participants')
        .select(`
          name,
          role,
          wins:winner_name (player_id (name, club, position))
        `)
        .eq('room_id', roomId)
        .eq('is_online', true)
        .neq('role', 'auctioneer');

      if (error) throw error;

      participantsContainer.innerHTML = '';

      participants.forEach(participant => {
        const participantElement = document.createElement('div');
        participantElement.className = 'participant-item';

        const winCount = participant.wins ? participant.wins.length : 0;

        participantElement.innerHTML = `
          <span>${participant.name}</span>
          <span class="badge">${winCount} wins</span>
        `;

        participantElement.addEventListener('click', () => {
          showParticipantWins(participant.name);
        });

        participantsContainer.appendChild(participantElement);
      });
    } catch (err) {
      console.error("Error updating participants list:", err);
    }
  }

  // [Remaining helper functions...]
});