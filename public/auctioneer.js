document.addEventListener("DOMContentLoaded", () => {
  const socket = io();
  
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

  // Create Room Button Handler
  createRoomBtn.addEventListener("click", async () => {
    const roomName = roomNameInput.value.trim();
    const bidIncrement = parseInt(bidIncrementInput.value);

    if (!roomName) {
      alert("Please enter a room name");
      return;
    }

    // Generate room ID
    roomId = generateRoomId();
    createRoomBtn.disabled = true;
    createRoomBtn.textContent = "Creating...";

    try {
      // Create room
      await emitWithTimeout(socket, "create-room", {
        roomId,
        roomName,
        bidIncrement,
        maxParticipants: 100
      });

      // Join room as auctioneer
      await emitWithTimeout(socket, "join-room", {
        roomId,
        userName: "Auctioneer",
        role: "auctioneer"
      });

      // Update UI
      roomIdDisplay.textContent = roomId;
      inviteLink.textContent = `${window.location.origin}/bidder.html?room=${roomId}`;
      roomInfo.classList.remove("hidden");
      playerForm.classList.remove("hidden");
      createRoomBtn.textContent = "Room Created";
    } catch (error) {
      console.error("Error:", error);
      alert(error.message || "Failed to create room");
      createRoomBtn.disabled = false;
      createRoomBtn.textContent = "Create Room";
    }
  });

  // Helper function to generate room ID
  function generateRoomId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  // Helper function for socket emits with timeout
  function emitWithTimeout(socket, event, data, timeout = 5000) {
    return new Promise((resolve, reject) => {
      socket.emit(event, data, (response) => {
        if (response && response.success) {
          resolve(response);
        } else {
          reject(new Error(response?.message || "Request failed"));
        }
      });

      setTimeout(() => {
        reject(new Error("Request timed out"));
      }, timeout);
    });
  }

  // Copy invite link to clipboard
  inviteLink.addEventListener('click', (e) => {
    e.preventDefault();
    navigator.clipboard.writeText(inviteLink.textContent)
      .then(() => alert("Invite link copied to clipboard!"))
      .catch(() => alert("Failed to copy link"));
  });
});