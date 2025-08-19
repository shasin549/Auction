const socket = io();
let currentRoom = null;
let bidderName = null;

const joinPanel = document.getElementById("joinPanel");
const bidderPanel = document.getElementById("bidderPanel");

const joinBtn = document.getElementById("joinBtn");
const roomCodeInput = document.getElementById("roomCode");
const bidderNameInput = document.getElementById("bidderName");

const currentPlayer = document.getElementById("currentPlayer");
const manualBidInput = document.getElementById("manualBid");
const placeBidBtn = document.getElementById("placeBidBtn");
const bidsList = document.getElementById("bidderBids");

// Auto-fill room from invite link
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.has("room")) roomCodeInput.value = urlParams.get("room");

// Join Room
joinBtn.addEventListener("click", () => {
  bidderName = bidderNameInput.value.trim();
  const room = roomCodeInput.value.trim();
  if (!bidderName || !room) return alert("Enter name and room code!");
  currentRoom = room;
  socket.emit("joinRoom", { room, name: bidderName });
  joinPanel.classList.add("hidden");
  bidderPanel.classList.remove("hidden");
});

// Receive player details
socket.on("playerDetails", (player) => {
  currentPlayer.innerHTML = `
    <strong>${player.name} (${player.club})</strong><br>
    Position: ${player.position}<br>
    Style: ${player.style}<br>
    Base Value: ${player.value}
  `;
  bidsList.innerHTML = "";
});

// Place bid
placeBidBtn.addEventListener("click", () => {
  const bidAmount = parseInt(manualBidInput.value, 10);
  if (!bidAmount || bidAmount <= 0) return alert("Invalid bid!");
  socket.emit("placeBid", { room: currentRoom, name: bidderName, amount: bidAmount });
  manualBidInput.value = "";
});

// Listen for new bids
socket.on("newBid", ({ name, amount }) => {
  const li = document.createElement("li");
  li.textContent = `${name}: ${amount}`;
  li.dataset.amount = amount;

  const items = Array.from(bidsList.children);
  const insertIndex = items.findIndex(item => parseInt(item.dataset.amount, 10) < amount);
  if (insertIndex === -1) bidsList.appendChild(li);
  else bidsList.insertBefore(li, items[insertIndex]);
});

// Debug errors
socket.on("errorMsg", (msg) => console.error("Server Error:", msg));