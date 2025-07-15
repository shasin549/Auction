document.addEventListener("DOMContentLoaded", () => {
  const socket = io('https://auction-zfku.onrender.com', {
    transports: ['websocket', 'polling'],
    reconnectionAttempts: 5
  });

  // DOM elements
  const bidderNameInput = document.getElementById("bidderName");
  const joinBtn = document.getElementById("joinBtn");
  const placeBidBtn = document.getElementById("placeBidBtn");
  const auctionArea = document.getElementById("auctionArea");
  const playerNameDisplay = document.getElementById("playerNameDisplay");
  const currentBidDisplay = document.getElementById("currentBid");
  const leadingBidderDisplay = document.getElementById("leadingBidder");
  const winnerSection = document.getElementById("winnerSection");
  const wonPlayerDisplay = document.getElementById("wonPlayer");
  const winnerNameDisplay = document.getElementById("winnerName");
  const winningBidDisplay = document.getElementById("winningBid");
  const participantsList = document.getElementById("participantsList");
  const bidHistoryList = document.getElementById("bidHistoryList");

  // State variables
  let userName = "";
  let roomId = "";
  let hasBid = false;

  // Extract room ID from URL
  const urlParams = new URLSearchParams(window.location.search);
  const roomIdFromUrl = urlParams.get('room');
  if (roomIdFromUrl) {
    document.getElementById("roomId").value = roomIdFromUrl;
  }

  // Join room
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
        auctionArea.classList.remove("hidden");
        joinBtn.disabled = true;
      } else {
        alert(response.message || "Failed to join room");
      }
    });
  });

  // Place bid (one bid per increment)
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

  // Socket event handlers
  socket.on("auction-started", (playerData) => {
    playerNameDisplay.textContent = playerData.playerName;
    currentBidDisplay.textContent = playerData.startingPrice;
    leadingBidderDisplay.textContent = "-";
    hasBid = false;
    placeBidBtn.disabled = false;
    winnerSection.classList.add("hidden");
  });

  socket.on("bid-placed", ({ currentBid, leadingBidder, bidHistory }) => {
    currentBidDisplay.textContent = currentBid;
    leadingBidderDisplay.textContent = leadingBidder;
    
    // Enable bidding if someone else bid
    if (leadingBidder !== userName) {
      hasBid = false;
      placeBidBtn.disabled = false;
    }
    
    updateBidHistory(bidHistory);
  });

  socket.on("auction-ended", ({ playerName, winnerName, winningBid, participants }) => {
    wonPlayerDisplay.textContent = playerName;
    winnerNameDisplay.textContent = winnerName;
    winningBidDisplay.textContent = winningBid;
    winnerSection.classList.remove("hidden");
    placeBidBtn.disabled = true;
    
    updateParticipantsList(participants);
  });

  // Helper functions
  function updateBidHistory(bidHistory) {
    bidHistoryList.innerHTML = "";
    bidHistory.forEach(bid => {
      const bidItem = document.createElement("div");
      bidItem.className = "bid-item";
      bidItem.innerHTML = `
        <input type="checkbox" ${bid.bidder === userName ? 'checked' : ''} disabled>
        ${bid.bidder} ₹${bid.amount}
      `;
      bidHistoryList.appendChild(bidItem);
    });
  }

  function updateParticipantsList(participants) {
    participantsList.innerHTML = "";
    participants.forEach(participant => {
      const participantItem = document.createElement("div");
      participantItem.className = "participant-item";
      participantItem.innerHTML = `
        <input type="checkbox" ${participant.name === userName ? 'checked' : ''} disabled>
        ${participant.name}
      `;
      participantsList.appendChild(participantItem);
    });
  }
});