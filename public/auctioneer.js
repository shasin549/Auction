document.addEventListener("DOMContentLoaded", () => {
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

  // Initialize button states
  finalCallBtn.textContent = "Final Call!";
  finalCallBtn.disabled = true;

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

  socket.on('reconnect_attempt', (attempt) => {
    console.log(`Reconnect attempt ${attempt}`);
  });

  socket.on('reconnect_error', (err) => {
    console.error('Reconnection error:', err);
  });

  socket.on('reconnect_failed', () => {
    console.error('Reconnection failed');
    connectionStatus.textContent = "Disconnected";
    connectionStatus.style.color = "#EF4444";
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
    createRoomBtn.classList.add("btn-processing");

    const timeout = setTimeout(() => {
      handleError("Connection timeout. Please check your internet and try again.");
    }, 10000);

    socket.emit("create-room", {
      roomId,
      roomName,
      bidIncrement,
      maxParticipants: 100
    }, (response) => {
      clearTimeout(timeout);
      
      if (response?.success) {
        socket.emit("join-room", {
          roomId,
          userName: "Auctioneer",
          role: "auctioneer"
        }, (joinResponse) => {
          if (joinResponse?.success) {
            roomIdDisplay.textContent = roomId;
            inviteLink.textContent = `${window.location.origin}/bidder.html?room=${roomId}`;
            inviteLink.href = `${window.location.origin}/bidder.html?room=${roomId}`;
            roomInfo.classList.remove("hidden");
            playerForm.classList.remove("hidden");
            createRoomBtn.textContent = "Room Created";
            createRoomBtn.classList.remove("btn-processing");

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

    updatePlayerPreview(currentPlayer);
    playerPreview.classList.remove("hidden");
    startAuctionBtn.disabled = true;
    finalCallBtn.classList.remove("hidden");
    finalCallBtn.textContent = "Final Call!";
    finalCallBtn.className = "btn btn-warning";
    finalCallBtn.disabled = false;

    socket.emit("start-auction", currentPlayer, (response) => {
      if (!response?.success) {
        alert(response?.message || "Failed to start auction");
        startAuctionBtn.disabled = false;
        finalCallBtn.classList.add("hidden");
        finalCallBtn.disabled = true;
      }
    });
  });

  // Final Call Button Handler
  finalCallBtn.addEventListener("click", () => {
    if (!roomId) {
      alert("Please create a room and start an auction first");
      return;
    }

    finalCallBtn.disabled = true;
    finalCallBtn.innerHTML = '<span class="spinner"></span> Processing...';

    socket.emit("final-call", { roomId }, (response) => {
      finalCallBtn.disabled = false;
      finalCallBtn.textContent = "Final Call!";

      if (response?.success) {
        if (response.callCount === 3) {
          finalCallBtn.disabled = true;
          nextPlayerBtn.classList.remove("hidden");
        }
      } else {
        alert(response?.message || "Failed to process final call");
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
  });

  socket.on("call-update", ({ callCount, message }) => {
    if (callCount > 0) {
      let type = '';
      if (callCount === 1) type = 'first';
      else if (callCount === 2) type = 'second';
      else if (callCount === 3) type = 'final';

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

  function updateParticipantsList(participants) {
    participantsContainer.innerHTML = '';
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
});