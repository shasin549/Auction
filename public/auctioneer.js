document.addEventListener("DOMContentLoaded", () => {
  const socket = io('https://auction-zfku.onrender.com', {
    transports: ['websocket', 'polling'],
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    timeout: 10000
  });

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

  const playerNameInput = document.getElementById("playerName");
  const playerClubInput = document.getElementById("playerClub");
  const playerPositionInput = document.getElementById("playerPosition");
  const startingPriceInput = document.getElementById("startingPrice");
  const startAuctionBtn = document.getElementById("startAuctionBtn");
  const finalCallBtn = document.getElementById("finalCallBtn");
  const nextPlayerBtn = document.getElementById("nextPlayerBtn");

  const previewName = document.getElementById("previewName");
  const previewClub = document.getElementById("previewClub");
  const previewPosition = document.getElementById("previewPosition");
  const previewPrice = document.getElementById("previewPrice");
  const currentBidDisplay = document.getElementById("currentBid");
  const leadingBidderDisplay = document.getElementById("leadingBidder");

  let roomId = "";
  let currentPlayer = null;

  socket.on('connect', () => {
    connectionStatus.textContent = "Connected";
    connectionStatus.style.color = "#10B981";
    createRoomBtn.disabled = false;
  });

  socket.on('disconnect', () => {
    connectionStatus.textContent = "Disconnected";
    connectionStatus.style.color = "#EF4444";
    createRoomBtn.disabled = true;
  });

  socket.on('connect_error', (err) => {
    connectionStatus.textContent = "Connection Error";
    connectionStatus.style.color = "#F59E0B";
  });

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

    socket.emit("start-auction", currentPlayer, (response) => {
      if (!response?.success) {
        alert(response?.message || "Failed to start auction");
        startAuctionBtn.disabled = false;
        finalCallBtn.classList.add("hidden");
      }
    });
  });

  finalCallBtn.addEventListener("click", () => {
    socket.emit("final-call", (response) => {
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

  nextPlayerBtn.addEventListener("click", () => {
    resetPlayerForm();
    playerPreview.classList.add("hidden");
    startAuctionBtn.disabled = false;
    finalCallBtn.classList.add("hidden");
    nextPlayerBtn.classList.add("hidden");
    finalCallBtn.disabled = false;
  });

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
    } else {
      finalCallBtn.textContent = "Final Call!";
    }
  });

  closeModalBtn.addEventListener('click', () => {
    participantModal.classList.remove('show');
  });

  participantModal.addEventListener('click', (e) => {
    if (e.target === participantModal) {
      participantModal.classList.remove('show');
    }
  });

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
  }

  function showCallPopup(message, type) {
    const popup = document.createElement('div');
    popup.className = `call-popup ${type}`;
    popup.textContent = message;
    document.body.appendChild(popup);

    // 🔊 Play audio based on type
    let audioPath = "";
    if (type === 'first') audioPath = 'audio/first-call.mp3';
    else if (type === 'second') audioPath = 'audio/second-call.mp3';
    else if (type === 'final') audioPath = 'audio/final-call.mp3'; // ⬅️ You can replace this file later

    if (audioPath) {
      const audio = new Audio(audioPath);
      audio.play().catch(err => console.warn(`Audio playback failed for ${type} call:`, err));
    }

    setTimeout(() => popup.classList.add('show'), 10);

    setTimeout(() => {
      popup.classList.remove('show');
      setTimeout(() => popup.remove(), 500);
    }, 3000);
  }
});