const socket = io();

// Elements
const createRoomPanel = document.getElementById("createRoomPanel");
const auctionPanel = document.getElementById("auctionPanel");

const roomNameInput = document.getElementById("roomName");
const numParticipantsInput = document.getElementById("numParticipants");
const bidIncrementInput = document.getElementById("bidIncrement");

const roomDisplay = document.getElementById("roomDisplay");
const participantsDisplay = document.getElementById("participantsDisplay");
const incrementDisplay = document.getElementById("incrementDisplay");

const inviteLinkInput = document.getElementById("inviteLink");
const copyLinkBtn = document.getElementById("copyLinkBtn");

const playerPreview = document.getElementById("playerPreview");
const startBtn = document.getElementById("startBtn");
const finalCallBtn = document.getElementById("finalCallBtn");
const nextPlayerBtn = document.getElementById("nextPlayerBtn");

// Create Room
document.getElementById("createRoomBtn").addEventListener("click", () => {
  const roomName = roomNameInput.value.trim();
  const numParticipants = numParticipantsInput.value.trim();
  const bidIncrement = bidIncrementInput.value.trim();

  if (!roomName || !numParticipants || !bidIncrement) {
    alert("Please fill all fields");
    return;
  }

  // Emit room creation to server
  socket.emit("createRoom", { roomName, numParticipants, bidIncrement });

  // Update UI
  roomDisplay.textContent = roomName;
  participantsDisplay.textContent = numParticipants;
  incrementDisplay.textContent = bidIncrement;

  const inviteUrl = `https://auction-zfku.onrender.com/bidder.html?room=${roomName}`;
  inviteLinkInput.value = inviteUrl;

  createRoomPanel.classList.add("hidden");
  auctionPanel.classList.remove("hidden");
});

// Copy Invite Link
copyLinkBtn.addEventListener("click", () => {
  inviteLinkInput.select();
  document.execCommand("copy");
  copyLinkBtn.textContent = "Copied!";
  setTimeout(() => (copyLinkBtn.textContent = "Copy"), 1500);
});

// Start Bidding
startBtn.addEventListener("click", () => {
  socket.emit("startBidding");
});

// Final Call
finalCallBtn.addEventListener("click", () => {
  socket.emit("finalCall");
  nextPlayerBtn.classList.remove("hidden");
});

// Next Player
nextPlayerBtn.addEventListener("click", () => {
  socket.emit("nextPlayer");
  playerPreview.textContent = "No player loaded";
  nextPlayerBtn.classList.add("hidden");
});

// Listen for player updates
socket.on("updatePlayer", (player) => {
  playerPreview.innerHTML = `
    <strong>${player.name}</strong><br>
    Club: ${player.club}<br>
    Position: ${player.position}<br>
    Style: ${player.style}<br>
    Value: ${player.value}
  `;
});