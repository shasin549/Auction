document.addEventListener("DOMContentLoaded", async () => {
  // ======================
  // INITIALIZATION
  // ======================
  // Supabase Client
  const supabaseUrl = 'https://flwqvepusbjmgoovqvmi.supabase.co';
  const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZsd3F2ZXB1c2JqbWdvb3Zxdm1pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI5MDY3MzMsImV4cCI6MjA2ODQ4MjczM30.or5cIl99nUDZceOKlFMnu8PCzLuCvXT5TBJvKTPSUvM';
  const supabase = createClient(supabaseUrl, supabaseKey, {
    db: { schema: 'public' },
    auth: { persistSession: false }
  });

  // Socket.IO Client
  const socket = io('https://auction-zfku.onrender.com', {
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    transports: ['websocket']
  });

  // ======================
  // DOM ELEMENTS
  // ======================
  const elements = {
    connectionStatus: document.getElementById("connection-status"),
    statusDot: document.querySelector('.status-dot'),
    createRoomBtn: document.getElementById("createRoomBtn"),
    roomNameInput: document.getElementById("roomName"),
    roomInfo: document.getElementById("roomInfo"),
    roomIdDisplay: document.getElementById("roomIdDisplay"),
    inviteLink: document.getElementById("inviteLink"),
    copyLinkBtn: document.getElementById("copyLinkBtn"),
    participantCount: document.getElementById("participantCount"),
    playerForm: document.getElementById("playerForm"),
    startAuctionBtn: document.getElementById("startAuctionBtn"),
    finalCallBtn: document.getElementById("finalCallBtn"),
    nextPlayerBtn: document.getElementById("nextPlayerBtn")
  };

  // ======================
  // STATE MANAGEMENT
  // ======================
  const state = {
    roomId: "",
    currentPlayer: null,
    currentAuctionId: null,
    callCount: 0
  };

  // ======================
  // CORE FUNCTIONS
  // ======================

  // CREATE ROOM (FIXED FOR MOBILE)
  async function createRoom() {
    try {
      console.log("[DEBUG] Create room triggered");
      
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
        throw roomError || new Error("Supabase returned no data");
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
      elements.roomIdDisplay.textContent = state.roomId;
      elements.inviteLink.href = `${window.location.origin}/bidder.html?room=${state.roomId}`;
      elements.inviteLink.textContent = `${window.location.origin}/bidder.html?room=${state.roomId}`;
      elements.roomInfo.classList.remove("hidden");
      elements.playerForm.classList.remove("hidden");

      // 4. Join socket room
      socket.emit("join-room", {
        roomId: state.roomId,
        userName: "Auctioneer",
        role: "auctioneer"
      });

      showToast("Room created successfully!", "success");

    } catch (err) {
      console.error("[ERROR] Room creation failed:", err);
      showToast(`Failed: ${err.message}`, "error");
    } finally {
      setButtonLoading(elements.createRoomBtn, false, "Create Room");
    }
  }

  // ======================
  // EVENT HANDLERS
  // ======================

  // MOBILE-FRIENDLY EVENT BINDING
  function setupEventListeners() {
    // Universal button handler (works for touch and click)
    const handleButtonPress = (btn, callback) => {
      btn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        callback();
      }, { passive: false });
      
      btn.addEventListener('click', callback);
    };

    handleButtonPress(elements.createRoomBtn, createRoom);
    
    elements.copyLinkBtn?.addEventListener('click', copyInviteLink);
    elements.startAuctionBtn?.addEventListener('click', startAuction);
    elements.finalCallBtn?.addEventListener('click', finalCall);
  }

  // ======================
  // HELPER FUNCTIONS
  // ======================

  function setButtonLoading(button, isLoading, text = "Create Room") {
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

    setTimeout(() => toast.remove(), 3000);
  }

  // ======================
  // INITIALIZATION
  // ======================
  setupEventListeners();
  console.log("[DEBUG] Auctioneer panel initialized");
});