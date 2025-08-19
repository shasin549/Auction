const socket = io();
let currentRoom = null;

// Elements
const createRoomPanel = document.getElementById("createRoomPanel");
const auctionPanel = document.getElementById("auctionPanel");
const auctioneerNameInput = document.getElementById("auctioneerName");
const maxParticipantsInput = document.getElementById("maxParticipants");
const bidIncrementInput = document.getElementById("bidIncrement");
const createRoomBtn = document.getElementById("createRoomBtn");
const inviteLink = document.getElementById("inviteLink");

const roomCodeDisplay = document.getElementById("roomCode");
const participantCount = document.getElementById("participantCount");
const maxCount = document.getElementById("maxCount");

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
  const maxParticipants = parseInt(maxParticipantsInput.value, 10);
  const increment = parseInt(bidIncrementInput.value, 10);

  if (!name || !maxParticipants || !increment) {
    alert("Please fill all details!");
    return;
  }

  socket.emit("createRoom", { name, maxParticipants, increment });
});

socket.on("roomCreated", ({ room, maxParticipants, increment }) => {
  currentRoom = room;

  createRoomPanel.style.display = "none";
  auctionPanel.style.display = "block";

  roomCodeDisplay.textContent = currentRoom;
  maxCount.textContent = maxParticipants;

  inviteLink.innerHTML = `
    Share this link: 
    <a href="${window.location.origin}/bidder.html?room=${currentRoom}">
      ${window.location.origin}/bidder.html?room=${currentRoom}
    </a>
  `;

  socket.emit("setIncrement", { room: currentRoom, increment });
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
    alert("Please