const socket = io();
let currentRoom = null;
let bidderName = null;
let increment = 0;

// Elements
const joinPanel = document.getElementById("joinPanel");
const bidderPanel = document.getElementById("bidderPanel");

const joinBtn = document.getElementById("joinBtn");
const roomCodeInput = document.getElementById("roomCode");
const bidderNameInput = document.getElementById("bidderName");

const currentPlayer = document.getElementById("currentPlayer");
const manualBidInput = document.getElementById("manualBid");
const placeBidBtn = document.getElementById("placeBidBtn");
const bidsList = document.getElementById("bidderBids");

// Auto join from invite link
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.has("room")) {
  roomCodeInput.value = urlParams.get("room");
}

// Join Room
joinBtn.addEventListener("click", () => {
  bidderName = bidderNameInput.value.trim();
  const room = roomCodeInput.value.trim();

  if (!bidderName || !room) {
    alert("Please enter your name and room code!");
    return;
  }

  currentRoom = room;
  socket.emit("joinRoom", { room, name: bidderName });

  joinPanel.style.display = "none";
  bidderPanel.style.display = "block";
});

// Receive Player Details
socket.on("playerDetails", (player) => {
  currentPlayer.innerHTML = `
    <strong>${player.name} (${player.club})</strong><br>
    Position: ${player.position}<br>
    Style: ${player.style}<br>
    Base Value: ${player.value}
  `;
});

// Place Bid
placeBidBtn.addEventListener("click", () => {
  let bidAmount;

  if (manualBidInput.value.trim() !== "") {
    bidAmount = parseInt(manualBidInput.value, 10);
  } else {
    const topBid = bidsList.firstChild ? parseInt(bidsList.firstChild.dataset.amount, 10) : 0;
    bidAmount = topBid + (increment || 1);
  }

  if (!bidAmount || bidAmount <= 0) {
    alert("Invalid bid amount!");
    return;
  }

  socket.emit("placeBid", { room: currentRoom, name: bidderName, amount: bidAmount });
  manualBidInput.value = "";
});

// Listen for bids
socket.on("newBid", (data) => {
  const li = document.createElement("li");
  li.textContent = `${data.name}: ${data.amount}`;
  li.dataset.amount = data.amount;

  const items = Array.from(bidsList.children);
  const insertIndex = items.findIndex(item => parseInt(item.dataset.amount, 10) < data.amount);

  if (insertIndex === -1) {
    bidsList.appendChild(li);
  } else {
    bidsList.insertBefore(li, items[insertIndex]);
  }
});

// Receive increment info
socket.on("setIncrement", (value) => {
  increment = value;
});