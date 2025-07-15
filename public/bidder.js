// bidder.js
document.addEventListener("DOMContentLoaded", () => {
  const socket = io();
  
  // DOM Elements
  const bidderNameInput = document.getElementById("bidderName");
  const joinBtn = document.getElementById("joinBtn");
  const auctionArea = document.getElementById("auctionArea");
  const placeBidBtn = document.getElementById("placeBidBtn");
  
  const livePlayerName = document.getElementById("livePlayerName");
  const livePlayerClub = document.getElementById("livePlayerClub");
  const livePlayerPosition = document.getElementById("livePlayerPosition");
  const liveBid = document.getElementById("liveBid");
  const leadingBidder = document.getElementById("leadingBidder");
  
  const winnerInfo = document.getElementById("winInfo");
  const winnerName = document.getElementById("winnerName");
  const winnerPlayer = document.getElementById("winnerPlayer");
  const winnerAmount = document.getElementById("winnerAmount");

  let roomId = "";
  let userName = "";

  // Extract roomId from URL
  const urlParams = new URLSearchParams(window.location.search);
  roomId = urlParams.get("room");

  // Join room
  joinBtn.addEventListener("click", () => {
    userName = bidderNameInput.value.trim();
    
    // Validation
    if (!userName) {
      alert("Please enter your name");
      return;
    }
    if (!roomId) {
      alert("Invalid or missing room link");
      return;
    }

    // Emit join-room event
    socket.emit("join-room", {
      roomId,
      userName,
      role: "bidder"
    }, (response) => {
      if (response && response.success) {
        auctionArea.classList.remove("hidden");
      } else {
        alert("Failed to join room: " + (response.message || "Unknown error"));
      }
    });
  });

  // Socket event listeners
  socket.on("auction-started", (data) => {
    livePlayerName.textContent = data.playerName;
    livePlayerClub.textContent = data.playerClub;
    livePlayerPosition.textContent = data.playerPosition;
    liveBid.textContent = data.startingPrice;
    leadingBidder.textContent = "-";
    winnerInfo.classList.add("hidden");
  });

  socket.on("bid-placed", ({ currentBid, leadingBidder: name }) => {
    liveBid.textContent = currentBid;
    leadingBidder.textContent = name;
  });

  socket.on("auction-ended", ({ winnerName: name, playerName, winningBid }) => {
    winnerInfo.classList.remove("hidden");
    winnerName.textContent = name;
    winnerPlayer.textContent = playerName;
    winnerAmount.textContent = winningBid;
  });

  // Place bid
  placeBidBtn.addEventListener("click", () => {
    socket.emit("place-bid");
  });

  // Connection handling
  socket.on("connect", () => {
    console.log("Connected to server");
  });

  socket.on("disconnect", () => {
    console.log("Disconnected from server");
  });
});