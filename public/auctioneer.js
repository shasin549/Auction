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

const playerNameInput = document.getElementById("playerName");
const playerClubInput = document.getElementById("playerClub");
const playerPositionInput = document.getElementById("playerPosition");
const playerStyleInput = document.getElementById("playerStyle");
const playerValueInput = document.getElementById("playerValue");

const playerPreview = document.getElementById("playerPreview");
const previewBtn = document.getElementById("previewBtn");

const startBtn = document.getElementById("startBtn");
const finalCallBtn = document.getElementById("finalCallBtn");
const nextPlayerBtn = document.getElementById("nextPlayerBtn");

let currentRoomCode = null;
let currentPlayer = null;

// Generate random room code
function generateRoomCode(length = 6) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Create Room
document.getElementById("createRoomBtn").addEventListener("click", () => {
  const roomName = roomNameInput.value.trim();
  const numParticipants = numParticipantsInput.value.trim();
  const bidIncrement = bidIncrementInput.value.trim();

  if (!roomName || !numParticipants || !bidIncrement) {
    alert("Please fill all fields");
    return;
  }

  // Generate random room code
  currentRoomCode = generateRoomCode();

  // Emit room creation to server
  socket.emit("createRoom", { 
    roomName, 
    roomCode: currentRoomCode, 
    numParticipants, 
    bidIncrement 
  });

  // Update UI
  roomDisplay.textContent = currentRoomCode;
  participantsDisplay.textContent = numParticipants;
  incrementDisplay.textContent = bidIncrement;

  const inviteUrl = `https://auction-zfku.onrender.com/bidder.html?room=${currentRoomCode}`;
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

// Preview Player
previewBtn.addEventListener("click", () => {
  const player = {
    name: playerNameInput.value.trim(),
    club: playerClubInput.value.trim(),
    position: playerPositionInput.value.trim(),
    style: playerStyleInput.value.trim(),
    value: playerValueInput.value.trim(),
  };

  if (!player.name || !player.club || !player.position || !player.style || !player.value) {
    alert("Please enter all player details");
    return;
  }

  currentPlayer = player;
  playerPreview.innerHTML = `
    <strong>${player.name}</strong><br>
    Club: ${player.club}<br>
    Position: ${player.position}<br>
    Style: ${player.style}<br>
    Value: ${player.value}
  `;

  // Send player details to bidders
  socket.emit("updatePlayer", { room: currentRoomCode, player });
});

// Start Bidding
startBtn.addEventListener("click", () => {
  if (!currentPlayer) {
    alert("Please preview a player before starting bidding");
    return;
  }
  socket.emit("startBidding", { room: currentRoomCode });
});

// Final Call
finalCallBtn.addEventListener("click", () => {
  socket.emit("finalCall", { room: currentRoomCode });
  nextPlayerBtn.classList.remove("hidden");
});

// Next Player
nextPlayerBtn.addEventListener("click", () => {
  socket.emit("nextPlayer", { room: currentRoomCode });
  playerPreview.textContent = "No player loaded";
  currentPlayer = null;

  // Reset player input fields
  playerNameInput.value = "";
  playerClubInput.value = "";
  playerPositionInput.value = "";
  playerStyleInput.value = "";
  playerValueInput.value = "";

  nextPlayerBtn.classList.add("hidden");
});