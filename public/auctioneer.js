const socket = io();

const createPanel = document.getElementById("createPanel");
const auctionPanel = document.getElementById("auctionPanel");
const createBtn = document.getElementById("createBtn");

const roomCodeInput = document.getElementById("roomCode");
const incrementInput = document.getElementById("increment");
const numParticipants = document.getElementById("numParticipants");
const inviteLinkEl = document.getElementById("inviteLink");

const playerName = document.getElementById("playerName");
const playerClub = document.getElementById("playerClub");
const playerPosition = document.getElementById("playerPosition");
const playerStyle = document.getElementById("playerStyle");
const playerValue = document.getElementById("playerValue");

const addPlayerBtn = document.getElementById("addPlayerBtn");
const startAuctionBtn = document.getElementById("startAuctionBtn");
const currentPlayer = document.getElementById("currentPlayer");

let currentRoom = null;

// Create Room
createBtn.addEventListener("click", () => {
  const room = roomCodeInput.value.trim();
  const increment = parseInt(incrementInput.value, 10);
  const participants = parseInt(numParticipants.value, 10);

  if (!room || !increment || !participants) {
    alert("Enter room code, bid increment and number of participants!");
    return;
  }

  currentRoom = room;
  socket.emit("createRoom", { room, increment, participants });
});

// Room created
socket.on("roomCreated", ({ room, inviteLink }) => {
  createPanel.classList.add("hidden");
  auctionPanel.classList.remove("hidden");
  inviteLinkEl.innerHTML = `<a href="${inviteLink}" target="_blank">${inviteLink}</a>`;
});

// Add Player
addPlayerBtn.addEventListener("click", () => {
  const player = {
    name: playerName.value,
    club: playerClub.value,
    position: playerPosition.value,
    style: playerStyle.value,
    value: parseInt(playerValue.value, 10)
  };
  if (!player.name || !player.club || !player.position || !player.style || !player.value) {
    alert("Please fill all player details!");
    return;
  }
  socket.emit("addPlayer", { room: currentRoom, player });
  playerName.value = "";
  playerClub.value = "";
  playerPosition.value = "";
  playerStyle.value = "";
  playerValue.value = "";
});

// Start Auction
startAuctionBtn.addEventListener("click", () => {
  socket.emit("startAuction", { room: currentRoom });
});

// Show player details
socket.on("playerDetails", (player) => {
  currentPlayer.innerHTML = `
    <strong>${player.name} (${player.club})</strong><br>
    Position: ${player.position}<br>
    Style: ${player.style}<br>
    Base Value: ${player.value}
  `;
});