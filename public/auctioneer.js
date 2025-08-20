const socket = io();

let roomCode = "";
let players = [];
let currentPlayer = null;

// Generate random 6-char room code
function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Create Room
document.getElementById("createBtn").addEventListener("click", () => {
  const numParticipants = document.getElementById("numParticipants").value;
  const increment = document.getElementById("increment").value;

  if (!numParticipants || !increment) {
    alert("Please fill all fields!");
    return;
  }

  roomCode = generateRoomCode();

  socket.emit("createRoom", {
    roomCode,
    numParticipants,
    increment
  });

  // Switch UI
  document.getElementById("createPanel").classList.add("hidden");
  document.getElementById("auctionPanel").classList.remove("hidden");

  // Show invite info
  document.getElementById("roomCodeDisplay").innerText = roomCode;
  const inviteURL = `${window.location.origin}/bidder.html?room=${roomCode}`;
  document.getElementById("inviteLink").innerText = inviteURL;
  document.getElementById("inviteLink").href = inviteURL;
});

// Update participants list
socket.on("participantsUpdate", (list) => {
  const ul = document.getElementById("participantsList");
  ul.innerHTML = "";
  list.forEach(name => {
    const li = document.createElement("li");
    li.innerText = name;
    ul.appendChild(li);
  });
});

// Add player
document.getElementById("addPlayerBtn").addEventListener("click", () => {
  const player = {
    name: document.getElementById("playerName").value,
    club: document.getElementById("playerClub").value,
    position: document.getElementById("playerPosition").value,
    style: document.getElementById("playerStyle").value,
    value: document.getElementById("playerValue").value
  };

  if (!player.name || !player.value) {
    alert("Player must have a name and base value!");
    return;
  }

  players.push(player);
  alert(`Player ${player.name} added!`);
});

// Start Bidding
document.getElementById("startAuctionBtn").addEventListener("click", () => {
  if (players.length === 0) {
    alert("No players available!");
    return;
  }

  currentPlayer = players.shift();
  document.getElementById("currentPlayer").innerHTML = `
    <strong>${currentPlayer.name}</strong><br>
    Club: ${currentPlayer.club || "-"}<br>
    Position: ${currentPlayer.position || "-"}<br>
    Style: ${currentPlayer.style || "-"}<br>
    Base Value: ${currentPlayer.value}
  `;

  socket.emit("startBidding", { roomCode, player: currentPlayer });
});