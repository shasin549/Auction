document.addEventListener("DOMContentLoaded", () => {
  const socket = io('https://autciton-zfku.onrender.com', {
    transports: ['websocket'],
    reconnectionAttempts: 5,
    reconnectionDelay: 1000
  });

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

  // Connection handling
  socket.on('connect', () => {
    console.log('✅ Connected to server');
    joinBtn.disabled = false;
  });

  socket.on('disconnect', () => {
    console.log('❌ Disconnected from server');
    joinBtn.disabled = true;
  });

  socket.on('connect_error', (err) => {
    console.error('Connection error:', err);
    alert('Connection error: ' + err.message);
  });

  // Join room
  joinBtn.addEventListener("click", () => {
    userName = bidderNameInput.value.trim();
    
    if (!userName) {
      alert("Please enter your name");
      return;
    }
    if (!roomId) {
      alert("Invalid or missing room link");
      return;
    }

    joinBtn.disabled = true;
    joinBtn.textContent = "Joining...";

    socket.emit("join-room", {
      roomId,
      userName,
      role: "bidder"
    }, (response) => {
      if (response?.success) {
        auctionArea.classList.remove("hidden");
        joinBtn.textContent = "Joined";
      } else {
        alert(response?.message || "Failed to join room");
        joinBtn.disabled = false;
        joinBtn.textContent = "Join Room";
      }
    });
  });

  // Socket events
  socket.on("auction-started", (data) => {
    livePlayerName.textContent = data.playerName;
    livePlayerClub.textContent = data.playerClub;
    livePlayerPosition.textContent = data.playerPosition;
    liveBid.textContent = data.startingPrice;
    leadingBidder.textContent = "-";
    winnerInfo.classList.add("hidden");
    placeBidBtn.disabled = false;
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
    placeBidBtn.disabled = true;
  });

  // Place bid
  placeBidBtn.addEventListener("click", () => {
    socket.emit("place-bid");
  });
});