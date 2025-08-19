const socket = io();

// DOM elements
const createRoomBtn = document.getElementById("createRoomBtn");
const roomNameInput = document.getElementById("roomName");
const incrementInput = document.getElementById("increment");
const roomCodeDisplay = document.getElementById("roomCode");
const auctionArea = document.getElementById("auction-area");
const participantsList = document.getElementById("participants");

const playerNameInput = document.getElementById("playerName");
const playerClubInput = document.getElementById("playerClub");
const playerPositionInput = document.getElementById("playerPosition");
const playerStyleInput = document.getElementById("playerStyle");
const playerValueInput = document.getElementById("playerValue");
const startPlayerBtn = document.getElementById("startPlayerBtn");
const finalCallBtn = document.getElementById("finalCallBtn");

// Create Room button
createRoomBtn.addEventListener("click", () => {
  const roomName = roomNameInput.value.trim();
  const increment = parseInt(incrementInput.value.trim());

  if (!roomName || isNaN(increment)) {
    alert("Enter room name and valid increment!");
    return;
  }

  socket.emit("createRoom", { roomName, increment }, ({ roomCode }) => {
    roomCodeDisplay.textContent = roomCode;
    document.getElementById("create-room").style.display = "none";
    auctionArea.style.display = "block";
  });
});

// Start Player Auction
startPlayerBtn.addEventListener("click", () => {
  const player = {
    name: playerNameInput.value.trim(),
    club: playerClubInput.value.trim(),
    position: playerPositionInput.value.trim(),
    style: playerStyleInput.value.trim(),
    value: parseInt(playerValueInput.value.trim()),
  };

  if (!player.name || isNaN(player.value)) {
    alert("Enter player details!");
    return;
  }

  const roomCode = roomCodeDisplay.textContent;
  socket.emit("startPlayer", { roomCode, player }, (res) => {
    if (res.success) {
      alert("Player auction started!");
      playerNameInput.value = "";
      playerClubInput.value = "";
      playerPositionInput.value = "";
      playerStyleInput.value = "";
      playerValueInput.value = "";
    }
  });
});

// Final Call button
finalCallBtn.addEventListener("click", () => {
  const roomCode = roomCodeDisplay.textContent;
  socket.emit("finalCall", { roomCode });
});

// Listen for participant updates
socket.on("participantsUpdate", (participants) => {
  participantsList.innerHTML = "";
  Object.values(participants).forEach((p) => {
    const li = document.createElement("li");
    li.textContent = p.name;
    participantsList.appendChild(li);
  });
});