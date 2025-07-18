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
  const participantsContainer = document.getElementById("participantsContainer");
  const participantModal = document.getElementById("participantModal");
  const modalParticipantName = document.getElementById("modalParticipantName");
  const wonPlayersList = document.getElementById("wonPlayersList");
  const closeModalBtn = document.querySelector(".close-btn");
  const callModal = document.getElementById("callModal");
  const callMessage = document.getElementById("callMessage");

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

  // State variables
  let roomId = "";
  let currentPlayer = null;
  let finalCallStage = 0; // 0=not started, 1=first call, 2=second call, 3=final call
  let callModalTimeout;

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
    finalCallStage = 0; // Reset final call state

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
    finalCallStage++;
    
    // Show appropriate call message
    switch(finalCallStage) {
      case 1:
        showCall("FIRST CALL!", "first-call");
        break;
      case 2:
        showCall("SECOND CALL!", "second-call");
        break;
      case 3:
        showCall("FINAL CALL!", "final-call");
        // Disable button after final call
        finalCallBtn.disabled = true;
        nextPlayerBtn.classList.remove("hidden");
        // End auction after delay
        setTimeout(() => {
          socket.emit("end-auction");
        }, 2000);
        break;
    }
    
    // Notify bidders
    socket.emit("final-call-notification", { stage: finalCallStage });
  });

  // Next Player Button Handler
  nextPlayerBtn.addEventListener("click", () => {
    resetPlayerForm();
    playerPreview.classList.add("hidden");
    startAuctionBtn.disabled = false;
    finalCallBtn.classList.add("hidden");
    nextPlayerBtn.classList.add("hidden");
    finalCallBtn.disabled = false;
    finalCallStage = 0; // Reset final call state
  });

  // Socket event listeners
  socket.on("participant-joined", (data) => {
    participantCount.textContent = data.participants.length;
    updateParticipantsList(data.participants);
  });

  socket.on("participant-left", (data) => {
    participantCount.textContent = data.participants.length;
    updateParticipantsList(data.participants);
  });

  socket.on("participant-updated", (data) => {
    updateParticipantsList(data.participants);
  });

  socket.on("bid-placed", (data) => {
    currentBidDisplay.textContent = data.currentBid;
    leadingBidderDisplay.textContent = data.leadingBidder;
    
    // If we're in final call stage and a bid is placed
    if (finalCallStage > 0 && finalCallStage < 3) {
      // Reset the final call process
      clearTimeout(callModalTimeout);
      callModal.classList.add("hidden");
      finalCallStage = 0;
      
      // Show notification
      alert("New bid received! Final call reset to first call.");
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

  function updateParticipantsList(participants) {
    participantsContainer.innerHTML = '';
    
    // Filter out the auctioneer
    const bidders = participants.filter(p => p.role === 'bidder');
    
    bidders.forEach(participant => {
      const participantElement = document.createElement('div');
      participantElement.className = 'participant-item';
      participantElement.innerHTML = `
        <span>${participant.name}</span>
        <span>${participant.wins ? participant.wins.length : 0} wins</span>
      `;
      
      participantElement.addEventListener('click', () => {
        showParticipantWins(participant.name);
      });
      
      participantsContainer.appendChild(participantElement);
    });
  }

  function showParticipantWins(participantName) {
    socket.emit("get-participant-wins", { roomId, participantName }, (response) => {
      if (response.success) {
        modalParticipantName.textContent = participantName;
        wonPlayersList.innerHTML = '';
        
        if (response.wins && response.wins.length > 0) {
          response.wins.forEach(win => {
            const wonPlayerElement = document.createElement('div');
            wonPlayerElement.className = 'won-player-item';
            wonPlayerElement.innerHTML = `
              <span>${win.playerName}</span>
              <span>₹${win.amount}M</span>
            `;
            wonPlayersList.appendChild(wonPlayerElement);
          });
        } else {
          wonPlayersList.innerHTML = '<p>No players won yet</p>';
        }
        
        participantModal.classList.add('show');
      } else {
        alert(response.message || "Failed to get participant wins");
      }
    });
  }

  function showCall(message, className) {
    callMessage.textContent = message;
    callModal.className = "modal-content call-modal " + className;
    callModal.classList.remove("hidden");
    
    // Auto-hide after 1.5 seconds
    clearTimeout(callModalTimeout);
    callModalTimeout = setTimeout(() => {
      callModal.classList.add("hidden");
    }, 1500);
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