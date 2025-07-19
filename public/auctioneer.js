// auctioneer.js - Complete Fixed Version
document.addEventListener("DOMContentLoaded", async () => {
  // =============================================
  // 1. INITIALIZATION
  // =============================================
  
  // Supabase Configuration
  const supabase = createClient(
    'https://flwqvepusbjmgoovqvmi.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZsd3F2ZXB1c2JqbWdvb3Zxdm1pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI5MDY3MzMsImV4cCI6MjA2ODQ4MjczM30.or5cIl99nUDZceOKlFMnu8PCzLuCvXT5TBJvKTPSUvM',
    {
      db: { schema: 'public' },
      auth: { persistSession: false }
    }
  );

  // Socket.IO Configuration
  const socket = io('https://auction-zfku.onrender.com', {
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    transports: ['websocket']
  });

  // =============================================
  // 2. DOM ELEMENTS
  // =============================================
  const elements = {
    // Connection
    connectionStatus: document.getElementById("connection-status"),
    statusDot: document.querySelector('.status-dot'),
    
    // Room Creation
    createRoomBtn: document.getElementById("createRoomBtn"),
    roomNameInput: document.getElementById("roomName"),
    
    // Room Info
    roomInfo: document.getElementById("roomInfo"),
    roomIdDisplay: document.getElementById("roomIdDisplay"),
    inviteLink: document.getElementById("inviteLink"),
    copyLinkBtn: document.getElementById("copyLinkBtn"),
    participantCount: document.getElementById("participantCount"),
    
    // Auction Controls
    playerForm: document.getElementById("playerForm"),
    startAuctionBtn: document.getElementById("startAuctionBtn"),
    finalCallBtn: document.getElementById("finalCallBtn"),
    nextPlayerBtn: document.getElementById("nextPlayerBtn"),
    
    // Player Display
    previewName: document.getElementById("previewName"),
    previewClub: document.getElementById("previewClub"),
    previewPosition: document.getElementById("previewPosition"),
    previewPrice: document.getElementById("previewPrice"),
    currentBid: document.getElementById("currentBid"),
    leadingBidder: document.getElementById("leadingBidder")
  };

  // =============================================
  // 3. STATE MANAGEMENT
  // =============================================
  const state = {
    roomId: "",
    currentPlayer: null,
    currentAuctionId: null,
    callCount: 0
  };

  // =============================================
  // 4. CORE FUNCTIONS
  // =============================================

  /**
   * Creates a new auction room
   */
  async function createRoom() {
    try {
      console.log("[DEBUG] Create room initiated");
      
      const roomName = elements.roomNameInput.value.trim();
      if (!roomName) {
        showToast("Please enter a room name", "error");
        return;
      }

      setButtonLoading(elements.createRoomBtn, true, "Creating...");

      // 1. Create room in Supabase
      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .insert([{ name: roomName }])
        .select()
        .single();

      if (roomError || !roomData) {
        throw roomError || new Error("Failed to create room");
      }

      state.roomId = roomData.id;
      console.log("[DEBUG] Room created with ID:", state.roomId);

      // 2. Join as auctioneer
      const { error: joinError } = await supabase
        .from('participants')
        .insert([{
          room_id: state.roomId,
          socket_id: socket.id,
          name: "Auctioneer",
          role: "auctioneer",
          is_online: true
        }]);

      if (joinError) throw joinError;

      // 3. Update UI
      updateRoomUI();
      showToast("Room created successfully!", "success");

      // 4. Join socket room
      socket.emit("join-room", {
        roomId: state.roomId,
        userName: "Auctioneer",
        role: "auctioneer"
      });

    } catch (err) {
      console.error("[ERROR] Room creation failed:", err);
      showToast(`Failed: ${err.message}`, "error");
    } finally {
      setButtonLoading(elements.createRoomBtn, false, "Create Room");
    }
  }

  /**
   * Starts a new player auction
   */
  async function startAuction() {
    try {
      const playerName = document.getElementById("playerName").value.trim();
      const playerClub = document.getElementById("playerClub").value.trim();
      const playerPosition = document.getElementById("playerPosition").value.trim();
      const startingPrice = parseInt(document.getElementById("startingPrice").value);

      if (!validatePlayerInput(playerName, playerClub, playerPosition, startingPrice)) {
        return;
      }

      setButtonLoading(elements.startAuctionBtn, true, "Starting...");

      const { data: playerData, error } = await supabase
        .from('players')
        .insert([{
          room_id: state.roomId,
          name: playerName,
          club: playerClub,
          position: playerPosition,
          starting_price: startingPrice,
          status: 'auctioning',
          current_bid: startingPrice
        }])
        .select();

      if (error || !playerData) throw error || new Error("Failed to create player");

      state.currentAuctionId = playerData[0].id;
      state.currentPlayer = { 
        playerName, playerClub, playerPosition, startingPrice,
        playerId: playerData[0].id
      };

      updatePlayerDisplay(state.currentPlayer);
      elements.playerPreview.classList.remove("hidden");
      elements.finalCallBtn.classList.remove("hidden");

      socket.emit("start-auction", {
        ...state.currentPlayer,
        roomId: state.roomId
      });

      showToast("Auction started!", "success");
    } catch (err) {
      console.error("[ERROR] Start auction failed:", err);
      showToast(`Failed: ${err.message}`, "error");
    } finally {
      setButtonLoading(elements.startAuctionBtn, false, "Start Auction");
    }
  }

  // =============================================
  // 5. HELPER FUNCTIONS
  // =============================================

  function updateRoomUI() {
    elements.roomIdDisplay.textContent = state.roomId;
    elements.inviteLink.href = `${window.location.origin}/bidder.html?room=${state.roomId}`;
    elements.inviteLink.textContent = `${window.location.origin}/bidder.html?room=${state.roomId}`;
    elements.roomInfo.classList.remove("hidden");
    elements.playerForm.classList.remove("hidden");
  }

  function updatePlayerDisplay(player) {
    elements.previewName.textContent = player.playerName.toUpperCase();
    elements.previewClub.textContent = player.playerClub;
    elements.previewPosition.textContent = player.playerPosition;
    elements.previewPrice.textContent = `₹${player.startingPrice}M`;
    elements.currentBid.textContent = player.startingPrice;
    elements.leadingBidder.textContent = "-";
  }

  function validatePlayerInput(name, club, position, price) {
    if (!name || !club || !position || isNaN(price) || price <= 0) {
      showToast("Please fill all fields with valid values", "error");
      return false;
    }
    return true;
  }

  function setButtonLoading(button, isLoading, text) {
    button.disabled = isLoading;
    button.innerHTML = isLoading 
      ? `<span class="spinner"></span> ${text}`
      : text;
  }

  function showToast(message, type) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('show');
      setTimeout(() => toast.remove(), 3000);
    }, 10);
  }

  // =============================================
  // 6. EVENT LISTENERS
  // =============================================

  function setupEventListeners() {
    // Mobile-friendly button handling
    const createRoomBtn = elements.createRoomBtn;
    createRoomBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      createRoom();
    }, { passive: false });
    
    createRoomBtn.addEventListener('click', createRoom);

    // Other event listeners
    elements.copyLinkBtn?.addEventListener('click', copyInviteLink);
    elements.startAuctionBtn?.addEventListener('click', startAuction);
    elements.finalCallBtn?.addEventListener('click', finalCall);

    // Socket events
    socket.on('connect', () => {
      elements.connectionStatus.textContent = "Connected";
      elements.statusDot.style.backgroundColor = "#10B981";
    });

    socket.on('disconnect', () => {
      elements.connectionStatus.textContent = "Disconnected";
      elements.statusDot.style.backgroundColor = "#EF4444";
    });
  }

  // =============================================
  // 7. INITIALIZATION
  // =============================================
  setupEventListeners();
  console.log("[INIT] Auctioneer panel ready");
});