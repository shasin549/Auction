document.addEventListener("DOMContentLoaded", () => {
  // 1. First try direct WebSocket connection
  const socket = io('https://auction-zfku.onrender.com', {
    transports: ['websocket'],
    reconnectionAttempts: 5
  });

  // 2. Fallback to polling if WS fails
  socket.on('connect_error', () => {
    socket.io.opts.transports = ['polling', 'websocket'];
  });

  // DOM elements
  const bidderNameInput = document.getElementById("bidderName");
  const joinBtn = document.getElementById("joinBtn");
  const placeBidBtn = document.getElementById("placeBidBtn");
  
  // Extract roomId from URL
  const roomId = new URLSearchParams(window.location.search).get("room");

  // Join room handler
  joinBtn.addEventListener("click", () => {
    const userName = bidderNameInput.value.trim();
    
    if (!userName) return alert("Please enter your name");
    if (!roomId) return alert("Invalid room link");

    joinBtn.disabled = true;
    
    socket.emit("join-room", { roomId, userName, role: "bidder" }, (response) => {
      if (response?.success) {
        document.getElementById("auctionArea").classList.remove("hidden");
      } else {
        alert(response?.message || "Failed to join");
        joinBtn.disabled = false;
      }
    });
  });

  // Place bid handler
  placeBidBtn.addEventListener("click", () => {
    socket.emit("place-bid", (response) => {
      if (!response?.success) {
        alert("Bid failed. Try again.");
      }
    });
  });

  // Auction event handlers
  socket.on("auction-started", (data) => {
    document.getElementById("livePlayerName").textContent = data.playerName;
    document.getElementById("liveBid").textContent = data.startingPrice;
    placeBidBtn.disabled = false;
  });

  socket.on("bid-placed", ({ currentBid }) => {
    document.getElementById("liveBid").textContent = currentBid;
  });
});