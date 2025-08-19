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

// --- Handle URL Params (Invite Link Auto-Join) ---
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.has("room")) {
  roomCodeInput.value = urlParams.get("room");
}
if (urlParams.has("room") && urlParams.has("name")) {
  // Auto-join if both room & name provided
  bidderName = urlParams.get("name").trim();
  currentRoom = urlParams.get("room").trim();

  socket.emit("joinRoom", { room: currentRoom, name: bidderName });

  joinPanel.style.display = "none";
  bidderPanel.style.display = "block";
}

// --- Join Room ---
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

// --- Receive Player Details ---
socket.on("playerDetails", (player) => {
  currentPlayer.innerHTML = `
    <strong>${player.name} (${player.club})</strong><br>
    Position: ${player.position}<br>
    Style: ${player.style}<br>
    Start: ${player.value}
  `;

  // Reset bids list when new player comes
  bidsList.innerHTML = "";
});

// --- Place Bid ---
placeBidBtn.addEventListener("click", () => {
  let bidAmount;

  if (manualBidInput.value.trim() !== "") {
    bidAmount = parseInt(manualBidInput.value, 10);
  } else {
    const topBid = bidsList.firstChild
      ? parseInt(bidsList.firstChild.dataset.amount, 10)
      : 0;
    bidAmount = topBid + (increment || 1);
  }

  if (!bidAmount || bidAmount <= 0) {
    alert("Invalid bid amount!");
    return;
  }

  const topBid = bidsList.firstChild
    ? parseInt(bidsList.firstChild.dataset.amount, 10)
    : 0;

  if (bidAmount <= topBid) {
    alert("Your bid must be higher than the current top bid!");
    return;
  }

  socket.emit("placeBid", { room: currentRoom, name: bidderName, amount: bidAmount });
  manualBidInput.value = "";
});

// --- Listen for New Bids ---
socket.on("newBid", (data) => {
  // Remove old bids from the same bidder
  const items = Array.from(bidsList.children);
  items.forEach(item => {
    if (item.textContent.startsWith(`${data.name}:`)) {
      bidsList.removeChild(item);
    }
  });

  // Create new bid entry
  const li = document.createElement("li");
  li.textContent = `${data.name}: ${data.amount}`;
  li.dataset.amount = data.amount;

  // Insert in descending order (highest bid on top)
  const insertIndex = items.findIndex(
    item => parseInt(item.dataset.amount, 10) < data.amount
  );

  if (insertIndex === -1) {
    bidsList.appendChild(li);
  } else {
    bidsList.insertBefore(li, bidsList.children[insertIndex]);
  }
});

// --- Receive Increment Info from Auctioneer ---
socket.on("setIncrement", (value) => {
  increment = value;
});