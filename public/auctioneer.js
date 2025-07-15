document.addEventListener("DOMContentLoaded", () => {
  const socket = io('https://autciton-zfku.onrender.com', {
    transports: ['websocket'],
    reconnectionAttempts: 5,
    reconnectionDelay: 1000
  });

  // DOM Elements
  const createRoomBtn = document.getElementById("createRoomBtn");
  const roomNameInput = document.getElementById("roomName");
  const bidIncrementInput = document.getElementById("bidIncrement");
  const roomIdDisplay = document.getElementById("roomIdDisplay");
  const inviteLink = document.getElementById("inviteLink");
  const roomInfo = document.getElementById("roomInfo");
  const playerForm = document.getElementById("playerForm");

  let roomId = "";

  // Connection handling
  socket.on('connect', () => {
    console.log('✅ Connected to server');
    createRoomBtn.disabled = false;
  });

  socket.on('disconnect', () => {
    console.log('❌ Disconnected from server');
    createRoomBtn.disabled = true;
  });

  socket.on('connect_error', (err) => {
    console.error('Connection error:', err);
    alert('Connection error: ' + err.message);
  });

  // Create Room Button Handler
  createRoomBtn.addEventListener("click", () => {
    const roomName = roomNameInput.value.trim();
    const bidIncrement = parseInt(bidIncrementInput.value);

    if (!roomName) {
      alert("Please enter a room name");
      return;
    }

    roomId = generateRoomId();
    createRoomBtn.disabled = true;
    createRoomBtn.textContent = "Creating...";

    socket.emit("create-room", {
      roomId,
      roomName,
      bidIncrement,
      maxParticipants: 100
    }, (response) => {
      if (response?.success) {
        socket.emit("join-room", {
          roomId,
          userName: "Auctioneer",
          role: "auctioneer"
        }, (joinResponse) => {
          if (joinResponse?.success) {
            roomIdDisplay.textContent = roomId;
            inviteLink.textContent = `${window.location.origin}/bidder.html?room=${roomId}`;
            roomInfo.classList.remove("hidden");
            playerForm.classList.remove("hidden");
            createRoomBtn.textContent = "Room Created";
          } else {
            handleError("Failed to join room");
          }
        });
      } else {
        handleError(response?.message || "Failed to create room");
      }
    });
  });

  function generateRoomId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  function handleError(message) {
    alert(message);
    createRoomBtn.disabled = false;
    createRoomBtn.textContent = "Create Room";
  }

  // Copy invite link
  inviteLink.addEventListener('click', (e) => {
    e.preventDefault();
    navigator.clipboard.writeText(inviteLink.textContent)
      .then(() => alert("Link copied!"))
      .catch(() => alert("Copy failed"));
  });
});