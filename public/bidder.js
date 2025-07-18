document.addEventListener("DOMContentLoaded", () => {
  const socket = io('https://auction-zfku.onrender.com', {
    transports: ['websocket', 'polling'],
    reconnectionAttempts: 5
  });

  // DOM Elements
  const joinSection = document.getElementById("joinSection");
  const auctionSection = document.getElementById("auctionSection");
  const connectionStatus = document.getElementById("connectionStatus");
  const joinBtn = document.getElementById("joinBtn");
  const placeBidBtn = document.getElementById("placeBidBtn");
  const bidIncrementValue = document.getElementById("bidIncrementValue");

  // Player Info
  const playerNameDisplay = document.getElementById("playerNameDisplay");
  const playerClubDisplay = document.getElementById("playerClub");
  const playerPositionDisplay = document.getElementById("playerPosition");
  const startingPriceDisplay = document.getElementById("startingPriceDisplay");

  // Bid Info
  const currentBidDisplay = document.getElementById("currentBid");
  const leadingBidderDisplay = document.getElementById("leadingBidder");

  // Winner Info
  const winnerSection = document.getElementById("winnerSection");
  const wonPlayerDisplay = document.getElementById("wonPlayer");
  const winnerNameDisplay = document.getElementById("winnerName");
  const winningBidDisplay = document.getElementById("winningBid");

  // State
  let userName = "";
  let roomId = "";
  let hasBid = false;
  let currentBidIncrement = 10;

  // Extract room ID from URL
  const urlParams = new URLSearchParams(window.location.search);
  const roomIdFromUrl = urlParams.get('room');
  if (roomIdFromUrl) {
    document.getElementById("roomId").value = roomIdFromUrl;
  }

  // Connection Status
  socket.on('connect', () => {
    connectionStatus.querySelector('.status-text').textContent = 'Connected';
    connectionStatus.querySelector('.status-icon').style.backgroundColor = '#10B981';
  });

  socket.on('disconnect', () => {
    connectionStatus.querySelector('.status-text').textContent = 'Disconnected';
    connectionStatus.querySelector('.status-icon').style.backgroundColor = '#EF4444';
  });

  // Join Room
  joinBtn.addEventListener("click", () => {
    userName = document.getElementById("bidderName").value.trim();
    roomId = document.getElementById("roomId").value.trim();

    if (!userName || !roomId) {
      alert("Please enter your name and room ID");
      return;
    }

    socket.emit("join-room", { 
      roomId, 
      userName, 
      role: "bidder" 
    }, (response) => {
      if (response.success) {
        currentBidIncrement = response.bidIncrement || 10;
        bidIncrementValue.textContent = currentBidIncrement;
        joinSection.classList.add("hidden");
        auctionSection.classList.remove("hidden");
      } else {
        alert(response.message || "Failed to join room");
      }
    });
  });

  // Place Bid (one bid per increment)
  placeBidBtn.addEventListener("click", () => {
    if (hasBid) {
      alert("Wait for another bid before placing again");
      return;
    }

    socket.emit("place-bid", (response) => {
      if (!response.success) {
        alert(response.message || "Bid failed");
        hasBid = false;
        placeBidBtn.disabled = false;
      } else {
        hasBid = true;
        placeBidBtn.disabled = true;
      }
    });
  });

  // Socket Events
  socket.on("auction-started", (playerData) => {
    playerNameDisplay.textContent = playerData.playerName.toUpperCase();
    playerClubDisplay.textContent = playerData.playerClub;
    playerPositionDisplay.textContent = playerData.playerPosition;
    startingPriceDisplay.textContent = `₹${playerData.startingPrice}M`;
    currentBidDisplay.textContent = playerData.startingPrice;
    leadingBidderDisplay.textContent = "-";

    hasBid = false;
    placeBidBtn.disabled = false;
    winnerSection.classList.add("hidden");
  });

  socket.on("bid-placed", ({ currentBid, leadingBidder }) => {
    currentBidDisplay.textContent = currentBid;
    leadingBidderDisplay.textContent = leadingBidder;

    if (leadingBidder !== userName) {
      hasBid = false;
      placeBidBtn.disabled = false;
    }
  });

  socket.on("auction-ended", ({ playerName, winnerName, winningBid }) => {
    wonPlayerDisplay.textContent = playerName;
    winnerNameDisplay.textContent = winnerName;
    winningBidDisplay.textContent = winningBid;
    winnerSection.classList.remove("hidden");
    placeBidBtn.disabled = true;
  });

  socket.on("call-update", ({ callCount, message }) => {
    if (callCount > 0) {
      let type = '';
      if (callCount === 1) type = 'first';
      else if (callCount === 2) type = 'second';
      else if (callCount === 3) type = 'final';
      
      showCallPopup(message, type);
    }
  });

  // Show call popup
  function showCallPopup(message, type) {
    const popup = document.createElement('div');
    popup.className = `call-popup ${type}`;
    popup.textContent = message;
    document.body.appendChild(popup);
    
    // Trigger animation
    setTimeout(() => popup.classList.add('show'), 10);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
      popup.classList.remove('show');
      setTimeout(() => popup.remove(), 500);
    }, 3000);
  }
});