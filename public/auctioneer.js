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
  const createRoomBtn = document.getElementById("createRoomBtn");
  const roomNameInput = document.getElementById("roomName");
  const bidIncrementInput = document.getElementById("bidIncrement");
  const roomInfo = document.getElementById("roomInfo");
  const roomIdDisplay = document.getElementById("roomIdDisplay");
  const inviteLink = document.getElementById("inviteLink");
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
    createRoomBtn.disabled = false;
    console.log("Connected to server");
  });

  socket.on('disconnect', () => {
    connectionStatus.textContent = "Disconnected";
    connectionStatus.style.color = "#EF4444";
    createRoomBtn.disabled = true;
    console.log("Disconnected from server");
  });

  socket.on('connect_error', (err) => {
    connectionStatus.textContent = "Connection Error";
    connectionStatus.style.color = "#F59E0B";
    console.error("Connection error:", err);
  });

  // Create Room with Supabase
  createRoomBtn.addEventListener("click", async () => {
    const roomName = roomNameInput.value.trim();
    const bidIncrement = parseInt(bidIncrementInput.value);

    if (!roomName) {
      alert("Please enter a room name");
      return;
    }

    createRoomBtn.disabled = true;
    createRoomBtn.textContent = "Creating...";
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
      inviteLink.textContent = `${window.location.origin}/bidder.html?room=${roomId}`;
      inviteLink.href = `${window.location.origin}/bidder.html?room=${roomId}`;
      
      roomInfo.classList.remove("hidden");
      playerForm.classList.remove("hidden");
      createRoomBtn.textContent = "Room Created";
      createRoomBtn.classList.remove("btn-processing");

      // Setup invite link copy functionality
      inviteLink.addEventListener('click', (e) => {
        e.preventDefault();
        navigator.clipboard.writeText(inviteLink.textContent)
          .then(() => alert("Invite link copied to clipboard!"))
          .catch(() => alert("Failed to copy link"));
      });

      // Join socket room
      socket.emit("join-room", {
        roomId,
        userName: "Auctioneer",
        role: "auctioneer"
      });

    } catch (err) {
      handleError("Failed to create room");
      console.error(err);
    }
  });

  // Start Auction with Supabase
  startAuctionBtn.addEventListener("click", async () => {
    const playerName = playerNameInput.value.trim();
    const playerClub = playerClubInput.value.trim();
    const playerPosition = playerPositionInput.value.trim();
    const startingPrice = parseInt(startingPriceInput.value);

    if (!playerName || !playerClub || !playerPosition || isNaN(startingPrice)) {
      alert("Please fill all player fields correctly");
      return;
    }

    try {
      // Create player in Supabase
      const { data: playerData, error: playerError } = await supabase
        .from('players')
        .insert([{
          room_id: roomId,
          name: playerName,
          club: playerClub,
          position: playerPosition,
          starting_price: startingPrice,
          status: 'auctioning'
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
      startAuctionBtn.disabled = true;
      finalCallBtn.classList.remove("hidden");
      finalCallBtn.disabled = false;

      // Notify all participants via socket
      socket.emit("start-auction", {
        ...currentPlayer,
        roomId
      });

    } catch (err) {
      alert("Failed to start auction");
      console.error(err);
      resetAuctionState();
    }
  });

  // Final Call Handler with Supabase
  finalCallBtn.addEventListener("click", async () => {
    if (!roomId || !currentAuctionId) {
      alert("Please create a room and start an auction first");
      return;
    }

    finalCallBtn.disabled = true;
    finalCallBtn.innerHTML = '<span class="spinner"></span> Processing...';

    try {
      callCount++;
      const message = getCallMessage(callCount);
      
      // Update call count in Supabase
      const { error } = await supabase
        .from('auctions')
        .update({ call_count: callCount })
        .eq('id', currentAuctionId);

      if (error) throw error;

      // Broadcast call update
      socket.emit("final-call", { 
        roomId,
        callCount,
        message 
      });

      if (callCount === 3) {
        // End auction after final call
        setTimeout(async () => {
          if (callCount === 3) {
            // Get highest bid from Supabase
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
              // Record winner in Supabase
              const { error: winError } = await supabase
                .from('winners')
                .insert([{
                  player_id: currentAuctionId,
                  winner_name: winnerName,
                  winning_bid: winningBid,
                  room_id: roomId
                }]);

              if (winError) throw winError;
            }

            // Update player status
            await supabase
              .from('players')
              .update({ status: 'sold' })
              .eq('id', currentAuctionId);

            // Broadcast auction end
            socket.emit("auction-ended", {
              roomId,
              playerName: currentPlayer.playerName,
              winnerName,
              winningBid
            });

            // Update UI
            finalCallBtn.disabled = true;
            nextPlayerBtn.classList.remove("hidden");
          }
        }, 3000);
      }

      finalCallBtn.disabled = false;
      finalCallBtn.textContent = message;

    } catch (err) {
      alert("Failed to process final call");
      console.error(err);
      finalCallBtn.disabled = false;
      finalCallBtn.textContent = "Final Call!";
    }
  });

  // Next Player Handler
  nextPlayerBtn.addEventListener("click", () => {
    resetPlayerForm();
    playerPreview.classList.add("hidden");
    startAuctionBtn.disabled = false;
    finalCallBtn.classList.add("hidden");
    nextPlayerBtn.classList.add("hidden");
    finalCallBtn.disabled = false;
    callCount = 0;
    currentAuctionId = null;
  });

  // Socket event listeners
  socket.on("participant-joined", async (data) => {
    try {
      // Get updated participant count from Supabase
      const { count, error } = await supabase
        .from('participants')
        .select('*', { count: 'exact', head: true })
        .eq('room_id', roomId)
        .eq('is_online', true);

      if (error) throw error;

      participantCount.textContent = count;
      await updateParticipantsList();
    } catch (err) {
      console.error("Error updating participants:", err);
    }
  });

  socket.on("participant-left", async (data) => {
    try {
      // Get updated participant count from Supabase
      const { count, error } = await supabase
        .from('participants')
        .select('*', { count: 'exact', head: true })
        .eq('room_id', roomId)
        .eq('is_online', true);

      if (error) throw error;

      participantCount.textContent = count;
      await updateParticipantsList();
    } catch (err) {
      console.error("Error updating participants:", err);
    }
  });

  socket.on("bid-placed", (data) => {
    currentBidDisplay.textContent = data.currentBid;
    leadingBidderDisplay.textContent = data.leadingBidder;
    callCount = 0; // Reset call count on new bid
  });

  socket.on("call-update", ({ callCount: count, message }) => {
    if (count > 0) {
      let type = '';
      if (count === 1) type = 'first';
      else if (count === 2) type = 'second';
      else if (count === 3) type = 'final';

      showCallPopup(message, type);
      finalCallBtn.textContent = message;
      playCallSound(type);
    } else {
      finalCallBtn.textContent = "Final Call!";
    }
  });

  // Modal functionality
  closeModalBtn.addEventListener('click', () => {
    participantModal.classList.remove('show');
  });

  participantModal.addEventListener('click', (e) => {
    if (e.target === participantModal) {
      participantModal.classList.remove('show');
    }
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
          <span>${winCount} wins</span>
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

  async function showParticipantWins(participantName) {
    try {
      const { data: wins, error } = await supabase
        .from('winners')
        .select(`
          winning_bid,
          players:player_id (name, club, position)
        `)
        .eq('winner_name', participantName)
        .eq('room_id', roomId);

      if (error) throw error;

      modalParticipantName.textContent = participantName;
      wonPlayersList.innerHTML = '';

      if (wins && wins.length > 0) {
        wins.forEach(win => {
          const wonPlayerElement = document.createElement('div');
          wonPlayerElement.className = 'won-player-item';
          wonPlayerElement.innerHTML = `
            <span>${win.players.name} (${win.players.position}, ${win.players.club})</span>
            <span>₹${win.winning_bid}M</span>
          `;
          wonPlayersList.appendChild(wonPlayerElement);
        });
      } else {
        wonPlayersList.innerHTML = '<p>No players won yet</p>';
      }

      participantModal.classList.add('show');
    } catch (err) {
      alert("Failed to get participant wins");
      console.error(err);
    }
  }

  function resetPlayerForm() {
    playerNameInput.value = "";
    playerClubInput.value = "";
    playerPositionInput.value = "";
    startingPriceInput.value = "";
    currentPlayer = null;
  }

  function resetAuctionState() {
    startAuctionBtn.disabled = false;
    finalCallBtn.classList.add("hidden");
    finalCallBtn.disabled = true;
    callCount = 0;
  }

  function handleError(message) {
    alert(message);
    createRoomBtn.disabled = false;
    createRoomBtn.textContent = "Create Room";
    createRoomBtn.classList.remove("btn-processing");
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

  function playCallSound(type) {
    try {
      let audioElement;
      if (type === 'first') audioElement = firstCallAudio;
      else if (type === 'second') audioElement = secondCallAudio;
      else if (type === 'final') audioElement = finalCallAudio;

      if (audioElement) {
        audioElement.currentTime = 0;
        audioElement.play().catch(e => console.error("Audio play failed:", e));
      }
    } catch (e) {
      console.error("Error playing sound:", e);
    }
  }

  function getCallMessage(count) {
    switch(count) {
      case 1: return "First Call!";
      case 2: return "Second Call!";
      case 3: return "Final Call!";
      default: return "Going once...";
    }
  }
});