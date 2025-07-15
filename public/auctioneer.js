// auctioneer.js

document.addEventListener("DOMContentLoaded", () => {
  // Establish socket connection
  const socket = io();

  // DOM Elements
  const createRoomBtn = document.getElementById("createRoomBtn");
  const roomNameInput = document.getElementById("roomName");
  const bidIncrementInput = document.getElementById("bidIncrement");
  const roomIdDisplay = document.getElementById("roomIdDisplay");
  const inviteLink = document.getElementById("inviteLink");
  const roomInfo = document.getElementById("roomInfo");
  const playerForm = document.getElementById("playerForm");

  const playerNameInput = document.getElementById("playerName");
  const playerClubInput = document.getElementById("playerClub");
  const playerPositionInput = document.getElementById("playerPosition");
  const startingPriceInput = document.getElementById("startingPrice");
  const startAuctionBtn = document.getElementById("startAuctionBtn");

  const previewName = document.getElementById("previewName");
  const previewClub = document.getElementById("previewClub");
  const previewPosition = document.getElementById("previewPosition");
  const previewPrice = document.getElementById("previewPrice");
  const playerPreview = document.getElementById("playerPreview");

  // State variables
  let roomId = "";
  let currentAuction = null;

  // Socket connection status
  socket.on('connect', () => {
    console.log('✅ Connected to server with socket id:', socket.id);
    showToast('Connected to auction server', 'success');
  });

  socket.on('disconnect', () => {
    console.log('❌ Disconnected from server');
    showToast('Disconnected from server', 'error');
  });

  socket.on('connect_error', (err) => {
    console.error('Connection error:', err);
    showToast('Connection error: ' + err.message, 'error');
  });

  // Helper functions
  function generateRoomId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  function showToast(message, type = 'info') {
    // Simple toast notification
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.remove();
    }, 3000);
  }

  function resetPlayerForm() {
    playerNameInput.value = '';
    playerClubInput.value = '';
    playerPositionInput.value = '';
    startingPriceInput.value = '';
    playerPreview.classList.add('hidden');
  }

  function validatePlayerForm() {
    if (!playerNameInput.value.trim()) {
      showToast('Please enter player name', 'error');
      return false;
    }
    if (!playerClubInput.value.trim()) {
      showToast('Please enter player club', 'error');
      return false;
    }
    if (!playerPositionInput.value.trim()) {
      showToast('Please enter player position', 'error');
      return false;
    }
    if (!startingPriceInput.value || isNaN(startingPriceInput.value) || startingPriceInput.value < 1) {
      showToast('Please enter valid starting price', 'error');
      return false;
    }
    return true;
  }

  // Event Listeners
  createRoomBtn.addEventListener("click", () => {
    const roomName = roomNameInput.value.trim();
    const bidIncrement = parseInt(bidIncrementInput.value);

    if (!roomName) {
      showToast('Please enter a room name', 'error');
      return;
    }

    roomId = generateRoomId();

    // Create and join room
    socket.emit("create-room", {
      roomId,
      roomName,
      bidIncrement,
      maxParticipants: 100
    }, (response) => {
      if (response && response.success) {
        showToast(`Room ${roomName} created successfully!`, 'success');
        
        socket.emit("join-room", {
          roomId,
          userName: "Auctioneer",
          role: "auctioneer"
        });

        // Update UI
        roomIdDisplay.textContent = roomId;
        inviteLink.textContent = `${window.location.origin}/bidder.html?room=${roomId}`;
        roomInfo.classList.remove("hidden");
        playerForm.classList.remove("hidden");
        resetPlayerForm();
      } else {
        showToast('Failed to create room', 'error');
      }
    });
  });

  startAuctionBtn.addEventListener("click", () => {
    if (!validatePlayerForm()) return;

    const playerData = {
      playerName: playerNameInput.value.trim(),
      playerClub: playerClubInput.value.trim(),
      playerPosition: playerPositionInput.value.trim(),
      startingPrice: parseInt(startingPriceInput.value)
    };

    // Show preview
    previewName.textContent = playerData.playerName;
    previewClub.textContent = playerData.playerClub;
    previewPosition.textContent = playerData.playerPosition;
    previewPrice.textContent = playerData.startingPrice;
    playerPreview.classList.remove("hidden");

    // Start auction
    socket.emit("start-auction", playerData, (response) => {
      if (response && response.success) {
        showToast(`Auction started for ${playerData.playerName}!`, 'success');
        currentAuction = playerData;
      } else {
        showToast('Failed to start auction', 'error');
      }
    });
  });

  // Socket event listeners
  socket.on('participant-joined', (data) => {
    showToast(`${data.name} joined the auction!`, 'info');
  });

  socket.on('participant-left', (data) => {
    showToast(`${data.name} left the auction`, 'warning');
  });

  socket.on('bid-placed', (data) => {
    showToast(`New bid: ₹${data.currentBid} by ${data.leadingBidder}`, 'info');
  });

  socket.on('auction-ended', (data) => {
    showToast(`Auction ended! ${data.winnerName} won ${data.playerName} for ₹${data.winningBid}`, 'success');
    resetPlayerForm();
    currentAuction = null;
  });

  // Copy invite link to clipboard
  inviteLink.addEventListener('click', () => {
    navigator.clipboard.writeText(inviteLink.textContent)
      .then(() => showToast('Invite link copied!', 'success'))
      .catch(() => showToast('Failed to copy link', 'error'));
  });
});

// Add some basic styles for the toast notifications
const toastStyles = document.createElement('style');
toastStyles.textContent = `
.toast {
  position: fixed;
  bottom: 20px;
  right: 20px;
  padding: 12px 24px;
  border-radius: 8px;
  color: white;
  background: #333;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  z-index: 1000;
  animation: fadeIn 0.3s;
}
.toast.success { background: #10b981; }
.toast.error { background: #ef4444; }
.toast.warning { background: #f59e0b; }
.toast.info { background: #3b82f6; }
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
`;
document.head.appendChild(toastStyles);