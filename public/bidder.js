document.addEventListener("DOMContentLoaded", () => {
  const socket = io('https://auction-zfku.onrender.com', {
    transports: ['websocket', 'polling'],
    reconnectionAttempts: 5
  });

  // DOM Elements
  const joinForm = document.getElementById("joinForm");
  const bidderNameInput = document.getElementById("bidderName");
  const joinBtn = document.getElementById("joinBtn");
  const playerDetails = document.getElementById("playerDetails");
  
  // Player Details
  const playerNameDisplay = document.getElementById("playerName");
  const playerClubDisplay = document.getElementById("playerClub");
  const playerPositionDisplay = document.getElementById("playerPosition");
  const startingPriceDisplay = document.getElementById("startingPrice");
  
  // Current Player
  const currentPlayerName = document.getElementById("currentPlayerName");
  const currentPlayerClub = document.getElementById("currentPlayerClub");
  const currentPlayerPosition = document.getElementById("currentPlayerPosition");
  const currentBidDisplay = document.getElementById("currentBid");
  const leadingBidderDisplay = document.getElementById("leadingBidder");
  const placeBidBtn = document.getElementById("placeBidBtn");
  
  // Winner Info
  const winnerInfo = document.getElementById("winnerInfo");
  const winnerNameDisplay = document.getElementById("winnerName");
  const winningBidDisplay = document.getElementById("winningBid");

  // State
  let userName = "";
  let roomId = "";
  let hasBid = false;

  // Extract room ID from URL
  const urlParams = new URLSearchParams(window.location.search);
  const roomIdFromUrl = urlParams.get('room');
  if (roomIdFromUrl) {
    document.getElementById("roomId").value = roomIdFromUrl;
  }

  // Join Room
  joinBtn.addEventListener("click", () => {
    userName = bidderNameInput.value.trim();
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
        joinForm.classList.add("hidden");
        playerDetails.classList.remove("hidden");
      } else {
        alert(response.message || "Failed to join room");
      }
    });
  });

  // Place Bid
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

  // Socket Event Handlers
  socket.on("auction-started", (playerData) => {
    // Update player details
    playerNameDisplay.textContent = playerData.playerName;
    playerClubDisplay.textContent = playerData.playerClub;
    playerPositionDisplay.textContent = playerData.playerPosition;
    startingPriceDisplay.textContent = playerData.startingPrice;
    
    // Update current player display
    currentPlayerName.textContent = playerData.playerName;
    currentPlayerClub.textContent = playerData.playerClub;
    currentPlayerPosition.textContent = playerData.playerPosition;
    currentBidDisplay.textContent = `¥${playerData.startingPrice}`;
    leadingBidderDisplay.textContent = "-";
    
    // Reset bid state
    hasBid = false;
    placeBidBtn.disabled = false;
    winnerInfo.classList.add("hidden");
  });

  socket.on("bid-placed", ({ currentBid, leadingBidder }) => {
    currentBidDisplay.textContent = `¥${currentBid}`;
    leadingBidderDisplay.textContent = leadingBidder;
    
    // Enable bidding if someone else bid
    if (leadingBidder !== userName) {
      hasBid = false;
      placeBidBtn.disabled = false;
    }
  });

  socket.on("auction-ended", ({ playerName, winnerName, winningBid }) => {
    winnerNameDisplay.textContent = winnerName;
    winningBidDisplay.textContent = `¥${winningBid}`;
    winnerInfo.classList.remove("hidden");
    placeBidBtn.disabled = true;
  });
});