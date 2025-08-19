const socket = io();
let roomCode = "";
let participantName = "";

function joinRoom() {
  roomCode = document.getElementById("roomCode").value.trim();
  participantName = document.getElementById("participantName").value.trim();

  if (!roomCode || !participantName) {
    alert("Please enter room code and your name");
    return;
  }

  socket.emit("joinRoom", { roomCode, participantName });

  // Hide join UI
  document.querySelector("h2").style.display = "none";
  document.getElementById("roomCode").style.display = "none";
  document.getElementById("participantName").style.display = "none";
  document.querySelector("button").style.display = "none";

  // Show bidder panel
  document.getElementById("bidderPanel").style.display = "block";
}

function placeBid() {
  const bidValue = document.getElementById("bidValue").value;
  if (!bidValue) {
    alert("Enter your bid value");
    return;
  }

  socket.emit("placeBid", { roomCode, participantName, bidValue });
}

// --- LISTENERS ---

socket.on("playerPreview", (player) => {
  document.getElementById("livePlayerName").textContent = player.name;
  document.getElementById("livePlayerClub").textContent = player.club;
  document.getElementById("livePlayerPosition").textContent = player.position;
  document.getElementById("livePlayerStyle").textContent = player.style;
  document.getElementById("livePlayerValue").textContent = player.value;
});

socket.on("updateBid", (bid) => {
  document.getElementById("currentBid").textContent = bid;
});