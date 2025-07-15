// auctioneer.js
document.addEventListener("DOMContentLoaded", () => {
  // Initialize Socket.io connection
  const socket = io();
  
  // DOM Elements
  const createRoomBtn = document.getElementById("createRoomBtn");
  const roomNameInput = document.getElementById("roomName");
  const bidIncrementInput = document.getElementById("bidIncrement");
  const roomIdDisplay = document.getElementById("roomIdDisplay");
  const inviteLink = document.getElementById("inviteLink");
  const roomInfo = document.getElementById("roomInfo");
  const playerForm = document.getElementById("playerForm");

  // Player form elements
  const playerNameInput = document.getElementById("playerName");
  const playerClubInput = document.getElementById("playerClub");
  const playerPositionInput = document.getElementById("playerPosition");
  const startingPriceInput = document.getElementById("startingPrice");
  const startAuctionBtn = document.getElementById("startAuctionBtn");

  // Preview elements
  const previewName = document.getElementById("previewName");
  const previewClub = document.getElementById("previewClub");
  const previewPosition = document.getElementById("previewPosition");
  const previewPrice = document.getElementById("previewPrice");
  const playerPreview = document.getElementById("playerPreview");

  let roomId = "";

  // Connection status indicators
  socket.on('connect', () => {
    console.log('✅ Connected to server');
    createRoomBtn.disabled = false;
    createRoomBtn.textContent = "Create Room";
  });

  socket.on('disconnect', () => {
    console.log('❌ Disconnected from server');
    createRoomBtn.disabled = true;
    createRoomBtn.textContent = "Disconnected";
  });

  // Generate random room ID
  function generateRoomId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  // Create Room Button Handler
  createRoomBtn.addEventListener("click", () => {
    const roomName = roomNameInput.value.trim();
    const bidIncrement = parseInt(bidIncrementInput.value);

    if (!roomName) {
      alert("Please enter a room name");
      return;
    }

    // Generate room ID and create room
    roomId = generateRoomId();
    createRoomBtn.disabled = true;
    createRoomBtn.textContent = "Creating...";

    socket.emit("create-room", {
      roomId,
      roomName,
      bidIncrement,
      maxParticipants: 100
    }, (response) => {
      if (response && response.success) {
        // Join the room as auctioneer
        socket.emit("join-room", {
          roomId,
          userName: "Auctioneer",
          role: "auctioneer"
        }, (joinResponse) => {
          if (joinResponse && joinResponse.success) {
            // Update UI
            roomIdDisplay.textContent = roomId;
            inviteLink.textContent = `${window.location.origin}/bidder.html?room=${roomId}`;
            roomInfo.classList.remove("hidden");
            playerForm.classList.remove("hidden");
            createRoomBtn.textContent = "Room Created!";
          } else {
            alert("Failed to join room");
            createRoomBtn.disabled = false;
            createRoomBtn.textContent = "Create Room";
          }
        });
      } else {
        alert("Failed to create room");
        createRoomBtn.disabled = false;
        createRoomBtn.textContent = "Create Room";
      }
    });
  });

  // Start Auction Button Handler
  startAuctionBtn.addEventListener("click", () => {
    const playerName = playerNameInput.value.trim();
    const playerClub = playerClubInput.value.trim();
    const playerPosition = playerPositionInput.value.trim();
    const startingPrice = parseInt(startingPriceInput.value);

    if (!playerName || !playerClub || !playerPosition || isNaN(startingPrice)) {
      alert("Please fill all player fields correctly");
      return;
    }

    const playerData = {
      playerName,
      playerClub,
      playerPosition,
      startingPrice
    };

    // Show preview
    previewName.textContent = playerName;
    previewClub.textContent = playerClub;
    previewPosition.textContent = playerPosition;
    previewPrice.textContent = startingPrice;
    playerPreview.classList.remove("hidden");

    // Start auction
    socket.emit("start-auction", playerData, (response) => {
      if (!response || !response.success) {
        alert("Failed to start auction");
      }
    });
  });

  // Copy invite link to clipboard
  inviteLink.addEventListener('click', (e) => {
    e.preventDefault();
    navigator.clipboard.writeText(inviteLink.textContent)
      .then(() => alert("Invite link copied to clipboard!"))
      .catch(() => alert("Failed to copy link"));
  });
});