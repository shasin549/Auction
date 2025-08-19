const socket = io();
let currentRoom = null;

// Elements
const createRoomPanel = document.getElementById("createRoomPanel");
const auctionPanel = document.getElementById("auctionPanel");
const auctioneerNameInput = document.getElementById("auctioneerName");
const createRoomBtn = document.getElementById("createRoomBtn");
const inviteLink = document.getElementById("inviteLink");

const roomCodeDisplay = document.getElementById("roomCode");
const participantCount = document.getElementById("participantCount");

const playerNameInput = document.getElementById("playerName");
const playerClubInput = document.getElementById("playerClub");
const playerPositionInput = document.getElementById("playerPosition");
const playerStyleInput = document.getElementById("playerStyle");
const playerValueInput = document.getElementById("playerValue");
const startBiddingBtn = document.getElementById("startBiddingBtn");

const playerPreview = document.getElementById("playerPreview");
const finalCallBtn = document.getElementById("finalCallBtn");
const nextPlayerBtn = document.getElementById("nextPlayerBtn");

// --- Create Room ---
createRoomBtn.addEventListener("click", () => {
  const name = auctioneerNameInput.value.trim();
  if (!name) {
    alert("Please enter your name!");
    return;
  }

  socket.emit("createRoom", { name });
});

socket.on("roomCreated", ({ room }) => {
  currentRoom = room;

  createRoomPanel.style.display = "none";
  auctionPanel.style.display = "block";

  roomCodeDisplay.textContent = currentRoom;
  inviteLink.innerHTML = `
    Share this link with bidders: 
    <a href="${window.location.origin}/bidder.html?room=${currentRoom}">${window.location.origin}/bidder.html?room=${currentRoom}</a>
  `;
});

// --- Update participant count ---
socket.on("updateParticipants", (count) => {
  participantCount.textContent = count;
});

// --- Start bidding for a player ---
startBiddingBtn.addEventListener("click", () => {
  const player = {
    name: playerNameInput.value.trim(),
    club: playerClubInput.value.trim(),
    position: playerPositionInput.value.trim(),
    style: playerStyleInput.value.trim(),
    value: parseInt(playerValueInput.value, 10) || 0,
  };

  if (!player.name || !player.club || !player.position) {
    alert("Please fill player details!");
    return;
  }

  playerPreview.innerHTML = `
    <h3>${player.name} (${player.club})</h3>
    <p>Position: ${player.position}</p>
    <p>Style: ${player.style}</p>
    <p>Base Value: ${player.value}</p>
  `;

  socket.emit("playerDetails", { room: currentRoom, player });
});

// --- Final Call ---
finalCallBtn.addEventListener("click", () => {
  socket.emit("finalCall", { room: currentRoom });
  nextPlayerBtn.style.display = "inline-block";
});

// --- Next Player ---
nextPlayerBtn.addEventListener("click", () => {
  playerPreview.innerHTML = "";
  nextPlayerBtn.style.display = "none";
});