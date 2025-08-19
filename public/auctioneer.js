const socket = io();
let currentRoom = null;

// Elements
const createRoomPanel = document.getElementById("createRoomPanel");
const auctionPanel = document.getElementById("auctionPanel");
const createRoomBtn = document.getElementById("createRoomBtn");
const roomNameInput = document.getElementById("roomName");
const participantsInput = document.getElementById("participants");
const incrementInput = document.getElementById("increment");
const inviteLink = document.getElementById("inviteLink");

const roomDisplay = document.getElementById("roomDisplay");
const playerPreview = document.getElementById("playerPreview");
const startBiddingBtn = document.getElementById("startBiddingBtn");
const finalCallBtn = document.getElementById("finalCallBtn");
const nextPlayerBtn = document.getElementById("nextPlayerBtn");
const auctionBids = document.getElementById("auctionBids");

// Create Room
createRoomBtn.addEventListener("click", () => {
  const room = roomNameInput.value.trim();
  const participants = parseInt(participantsInput.value, 10);
  const increment = parseInt(incrementInput.value, 10);

  if (!room || !participants || !increment) {
    alert("Please enter room name, participants, and increment!");
    return;
  }

  currentRoom = room;
  socket.emit("createRoom", { room, participants, increment });

  // Show invite link
  const link = `${window.location.origin}/bidder.html?room=${room}`;
  inviteLink.textContent = `Invite Link: ${link}`;
  inviteLink.style.cursor = "pointer";
  inviteLink.onclick = () => navigator.clipboard.writeText(link);

  // Switch panels
  createRoomPanel.classList.add("hidden");
  auctionPanel.classList.remove("hidden");

  roomDisplay.textContent = room;
});

// Show player details
socket.on("playerDetails", (player) => {
  playerPreview.innerHTML = `
    <strong>${player.name} (${player.club})</strong><br>
    Position: ${player.position}<br>
    Style: ${player.style}<br>
    Start Value: ${player.value}
  `;
});

// New bid
socket.on("newBid", (data) => {
  const li = document.createElement("li");
  li.textContent = `${data.name}: ${data.amount}`;
  li.dataset.amount = data.amount;

  const items = Array.from(auctionBids.children);
  const insertIndex = items.findIndex(item => parseInt(item.dataset.amount, 10) < data.amount);

  if (insertIndex === -1) {
    auctionBids.appendChild(li);
  } else {
    auctionBids.insertBefore(li, items[insertIndex]);
  }
});

// Bidding controls
startBiddingBtn.addEventListener("click", () => {
  socket.emit("startBidding", { room: currentRoom });
});

finalCallBtn.addEventListener("click", () => {
  socket.emit("finalCall", { room: currentRoom });
  nextPlayerBtn.classList.remove("hidden");
});

nextPlayerBtn.addEventListener("click", () => {
  socket.emit("nextPlayer", { room: currentRoom });
  playerPreview.innerHTML = "";
  auctionBids.innerHTML = "";
  nextPlayerBtn.classList.add("hidden");
});