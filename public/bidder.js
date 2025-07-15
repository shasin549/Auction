// bidder.js
document.addEventListener("DOMContentLoaded", () => {
  // Establish Socket.IO connection with Render.com URL
  const socket = io('https://auction-zfku.onrender.com', {
    transports: ['websocket', 'polling'],
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

  // Connection status element
  const connectionStatus = document.createElement('div');
  connectionStatus.style.position = 'fixed';
  connectionStatus.style.bottom = '10px';
  connectionStatus.style.right = '10px';
  connectionStatus.style.padding = '8px 16px';
  connectionStatus.style.borderRadius = '20px';
  connectionStatus.style.backgroundColor = '#EF4444';
  connectionStatus.style.color = 'white';
  connectionStatus.style.zIndex = '1000';
  connectionStatus.textContent = 'Disconnected';
  document.body.appendChild(connectionStatus);

  let roomId = "";
  let userName = "";
  let isConnected = false;

  // Extract roomId from URL
  const urlParams = new URLSearchParams(window.location.search);
  roomId = urlParams.get("room");

  // Connection handling
  socket.on('connect', () => {
    console.log('✅ Connected to server');
    connectionStatus.textContent = 'Connected';
    connectionStatus.style.backgroundColor = '#10B981';
    isConnected = true;
    joinBtn.disabled = false;
  });

  socket.on('disconnect', () => {
    console.log('❌ Disconnected from server');
    connectionStatus.textContent = 'Disconnected';
    connectionStatus.style.backgroundColor = '#EF4444';
    isConnected = false;
    joinBtn.disabled = true;
    placeBidBtn.disabled = true;
  });

  socket.on('connect_error', (err) => {
    console.error('Connection error:', err);
    connectionStatus.textContent = 'Connection Error';
    connectionStatus.style.backgroundColor = '#F59E0B';
  });

  // Join room handler
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

    if (!isConnected) {
      alert("Not connected to server. Please try again.");
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

  // Socket event handlers
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
    
    // Highlight if current user is leading bidder
    if (name === userName) {
      leadingBidder.style.color = "#10B981";
      leadingBidder.style.fontWeight = "bold";
    } else {
      leadingBidder.style.color = "";
      leadingBidder.style.fontWeight = "";
    }
  });

  socket.on("auction-ended", ({ winnerName: name, playerName, winningBid }) => {
    winnerInfo.classList.remove("hidden");
    winnerName.textContent = name;
    winnerPlayer.textContent = playerName;
    winnerAmount.textContent = winningBid;
    placeBidBtn.disabled = true;

    // Highlight if current user won
    if (name === userName) {
      winnerInfo.style.backgroundColor = "rgba(16, 185, 129, 0.2)";
      winnerInfo.style.border = "1px solid #10B981";
      winnerInfo.style.borderRadius = "8px";
    } else {
      winnerInfo.style.backgroundColor = "";
      winnerInfo.style.border = "";
    }
  });

  // Place bid handler
  placeBidBtn.addEventListener("click", () => {
    if (!isConnected) {
      alert("Not connected to server");
      return;
    }
    
    placeBidBtn.disabled = true;
    placeBidBtn.textContent = "Placing Bid...";
    
    socket.emit("place-bid", (response) => {
      placeBidBtn.disabled = false;
      placeBidBtn.textContent = "Place Bid";
      
      if (!response?.success) {
        alert(response?.message || "Failed to place bid");
      }
    });
  });

  // Disable bid button initially
  placeBidBtn.disabled = true;
});