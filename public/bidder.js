// bidder.js

document.addEventListener("DOMContentLoaded", () => {
  // Establish socket connection
  const socket = io();

  // DOM Elements
  const bidderNameInput = document.getElementById("bidderName");
  const joinBtn = document.getElementById("joinBtn");
  const auctionArea = document.getElementById("auctionArea");
  const placeBidBtn = document.getElementById("placeBidBtn");

  // Player Info Elements
  const livePlayerName = document.getElementById("livePlayerName");
  const livePlayerClub = document.getElementById("livePlayerClub");
  const livePlayerPosition = document.getElementById("livePlayerPosition");
  const liveBid = document.getElementById("liveBid");
  const leadingBidder = document.getElementById("leadingBidder");

  // Winner Info Elements
  const winnerInfo = document.getElementById("winInfo");
  const winnerName = document.getElementById("winnerName");
  const winnerPlayer = document.getElementById("winnerPlayer");
  const winnerAmount = document.getElementById("winnerAmount");

  // State variables
  let roomId = "";
  let userName = "";
  let isConnected = false;
  let isAuctionActive = false;

  // Socket connection status
  socket.on('connect', () => {
    console.log('✅ Connected to server with socket id:', socket.id);
    showToast('Connected to auction server', 'success');
    isConnected = true;
  });

  socket.on('disconnect', () => {
    console.log('❌ Disconnected from server');
    showToast('Disconnected from server', 'error');
    isConnected = false;
    disableBidButton();
  });

  socket.on('connect_error', (err) => {
    console.error('Connection error:', err);
    showToast('Connection error: ' + err.message, 'error');
    isConnected = false;
    disableBidButton();
  });

  // Helper functions
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.remove();
    }, 3000);
  }

  function enableBidButton() {
    if (isConnected && isAuctionActive) {
      placeBidBtn.disabled = false;
      placeBidBtn.classList.remove('btn-disabled');
      placeBidBtn.classList.add('btn-success');
    }
  }

  function disableBidButton() {
    placeBidBtn.disabled = true;
    placeBidBtn.classList.remove('btn-success');
    placeBidBtn.classList.add('btn-disabled');
  }

  function resetAuctionDisplay() {
    livePlayerName.textContent = '-';
    livePlayerClub.textContent = '-';
    livePlayerPosition.textContent = '-';
    liveBid.textContent = '0';
    leadingBidder.textContent = '-';
    winnerInfo.classList.add('hidden');
    disableBidButton();
  }

  // Extract roomId from URL
  const urlParams = new URLSearchParams(window.location.search);
  roomId = urlParams.get("room");

  if (!roomId) {
    showToast('No room ID specified in URL', 'error');
    joinBtn.disabled = true;
  }

  // Join room
  joinBtn.addEventListener("click", () => {
    if (!isConnected) {
      showToast('Not connected to server', 'error');
      return;
    }

    userName = bidderNameInput.value.trim();
    if (!userName) {
      showToast('Please enter your name', 'error');
      return;
    }

    if (!roomId) {
      showToast('Invalid or missing room link', 'error');
      return;
    }

    socket.emit("join-room", {
      roomId,
      userName,
      role: "bidder"
    }, (response) => {
      if (response && response.success) {
        showToast(`Joined room as ${userName}`, 'success');
        auctionArea.classList.remove("hidden");
        bidderNameInput.disabled = true;
        joinBtn.disabled = true;
      } else {
        showToast('Failed to join room', 'error');
      }
    });
  });

  // Place bid
  placeBidBtn.addEventListener("click", () => {
    if (!isAuctionActive) {
      showToast('No active auction to bid on', 'error');
      return;
    }

    socket.emit("place-bid", (response) => {
      if (response && response.success) {
        showToast(`Bid placed!`, 'success');
      } else {
        showToast(response.message || 'Failed to place bid', 'error');
      }
    });
  });

  // Socket event listeners
  socket.on("room-state", (data) => {
    console.log('Received room state:', data);
    if (data.currentAuction) {
      handleAuctionStart(data.currentAuction);
    }
  });

  socket.on("auction-started", (data) => {
    handleAuctionStart(data);
    showToast(`Auction started for ${data.playerName}!`, 'info');
  });

  function handleAuctionStart(data) {
    livePlayerName.textContent = data.playerName;
    livePlayerClub.textContent = data.playerClub;
    livePlayerPosition.textContent = data.playerPosition;
    liveBid.textContent = data.startingPrice;
    leadingBidder.textContent = "-";
    winnerInfo.classList.add("hidden");
    isAuctionActive = true;
    enableBidButton();
  }

  socket.on("bid-placed", ({ currentBid, leadingBidder: name }) => {
    liveBid.textContent = currentBid;
    leadingBidder.textContent = name;
    
    // Highlight if this bidder is the leading bidder
    if (name === userName) {
      leadingBidder.classList.add('leading-bidder');
      showToast(`You're the top bidder at ₹${currentBid}!`, 'success');
    } else {
      leadingBidder.classList.remove('leading-bidder');
    }
  });

  socket.on("auction-ended", ({ winnerName: name, playerName, winningBid }) => {
    winnerInfo.classList.remove("hidden");
    winnerName.textContent = name;
    winnerPlayer.textContent = playerName;
    winnerAmount.textContent = winningBid;
    isAuctionActive = false;
    disableBidButton();

    if (name === userName) {
      showToast(`🏆 You won ${playerName} for ₹${winningBid}!`, 'success');
    } else if (name !== 'No Winner') {
      showToast(`${name} won ${playerName} for ₹${winningBid}`, 'info');
    } else {
      showToast(`Auction ended with no winner`, 'warning');
    }
  });

  socket.on('participant-joined', (data) => {
    showToast(`${data.name} joined the auction`, 'info');
  });

  socket.on('participant-left', (data) => {
    showToast(`${data.name} left the auction`, 'warning');
  });

  // Initialize
  resetAuctionDisplay();
  disableBidButton();

  // Add some basic styles
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
  .btn-disabled {
    background: #6b7280 !important;
    cursor: not-allowed;
  }
  .leading-bidder {
    color: #10b981;
    font-weight: bold;
  }
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }
  `;
  document.head.appendChild(toastStyles);
});