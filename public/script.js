const socket = io();

const joinRoomSection = document.getElementById("join-room-section");
const biddingSection = document.getElementById("bidding-section");

const participantNameInput = document.getElementById("participantName");
const roomCodeInput = document.getElementById("roomCodeInput");
const joinRoomBtn = document.getElementById("joinRoomBtn");

const roomNameDisplay = document.getElementById("roomNameDisplay");
const playersListDiv = document.getElementById("playersList");

const bidAmountInput = document.getElementById("bidAmount");
const placeBidBtn = document.getElementById("placeBidBtn");

const winningPlayersList = document.getElementById("winningPlayersList");
const toast = document.getElementById("toast");

let participantName = "";
let roomCode = "";
let bidIncrement = 1;
let players = [];
let winningPlayers = [];

function showToast(message, isError = false) {
  toast.textContent = message;
  toast.style.backgroundColor = isError ? "var(--color-danger)" : "var(--color-success)";
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 3000);
}

joinRoomBtn.addEventListener("click", () => {
  participantName = participantNameInput.value.trim();
  roomCode = roomCodeInput.value.trim().toUpperCase();

  if (!participantName) return showToast("Enter your name", true);
  if (!roomCode || roomCode.length !== 6) return showToast("Enter a valid 6-character room code", true);

  socket.emit("join-room", { participantName, roomCode });
});

socket.on("room-joined", ({ roomName, bidIncrement: inc, players: currentPlayers }) => {
  roomNameDisplay.textContent = roomName;
  bidIncrement = inc;
  players = currentPlayers;

  joinRoomSection.style.display = "none";
  biddingSection.style.display = "block";

  updatePlayersList();
  updateWinningPlayersList();

  showToast(`Joined room: ${roomName}`);
});

socket.on("room-join-error", (message) => {
  showToast(message, true);
});

socket.on("update-players", ({ players: updatedPlayers }) => {
  players = updatedPlayers;
  updatePlayersList();
});

socket.on("player-sold", ({ player, highestBidder }) => {
  if (highestBidder === participantName) {
    winningPlayers.push(player);
    updateWinningPlayersList();
    showToast(`You won player ${player.name} for ${player.currentBid}!`);
  } else {
    showToast(`Player ${player.name} sold to ${highestBidder} for ${player.currentBid}`);
  }
});

function updatePlayersList() {
  if (players.length === 0) {
    playersListDiv.innerHTML = "<p>No players available yet.</p>";
    return;
  }

  playersListDiv.innerHTML = "";
  players.forEach((p) => {
    const div = document.createElement("div");
    div.className = "card";
    div.innerHTML = `
      <strong>${p.name}</strong> (${p.club})<br/>
      Position: ${p.position} | Style: ${p.style}<br/>
      Current Bid: ${p.currentBid} | Sold: ${p.sold ? "Yes" : "No"}
    `;
    playersListDiv.appendChild(div);
  });
}

placeBidBtn.addEventListener("click", () => {
  const amount = parseInt(bidAmountInput.value);
  if (isNaN(amount)) return showToast("Enter a valid bid amount", true);

  const currentPlayer = players.find((p) => !p.sold);
  if (!currentPlayer) return showToast("No active player to bid on", true);

  if (amount < currentPlayer.currentBid + bidIncrement) {
    return showToast(`Bid must be at least ${currentPlayer.currentBid + bidIncrement}`, true);
  }

  socket.emit("place-bid", {
    roomCode,
    bidderName: participantName,
    amount,
  });

  bidAmountInput.value = "";
  showToast(`Bid placed: ${amount}`);
});

function updateWinningPlayersList() {
  if (winningPlayers.length === 0) {
    winningPlayersList.innerHTML = "<p>You have no winning players yet.</p>";
    return;
  }

  winningPlayersList.innerHTML = "";
  winningPlayers.forEach((player) => {
    const div = document.createElement("div");
    div.className = "card";
    div.innerHTML = `
      <strong>${player.name}</strong> (${player.club}) - ${player.position} - ${player.style}<br/>
      Sold for: ${player.currentBid}
    `;
    winningPlayersList.appendChild(div);
  });
}

// Notify server participant left on window unload
window.addEventListener("beforeunload", () => {
  if (participantName && roomCode) {
    socket.emit("leave-room", { participantName, roomCode });
  }
});
