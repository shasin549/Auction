const socket = io();

const roomSetupSection = document.getElementById("room-setup-section");
const auctionSection = document.getElementById("auction-section");
const createRoomBtn = document.getElementById("createRoomBtn");

const roomNameInput = document.getElementById("roomName");
const numParticipantsInput = document.getElementById("numParticipants");
const bidIncrementInput = document.getElementById("bidIncrement");

const roomNameDisplay = document.getElementById("roomNameDisplay");

const playerNameInput = document.getElementById("playerName");
const playerClubInput = document.getElementById("playerClub");
const playerPositionInput = document.getElementById("playerPosition");
const playerStyleInput = document.getElementById("playerStyle");
const playerValueInput = document.getElementById("playerValue");
const addPlayerBtn = document.getElementById("addPlayerBtn");
const playersListDiv = document.getElementById("playersList");

const inviteLinkInput = document.getElementById("inviteLink");
const copyInviteBtn = document.getElementById("copyInviteBtn");

const startBiddingBtn = document.getElementById("startBiddingBtn");
const finalCallBtn = document.getElementById("finalCallBtn");
const callStatusDiv = document.getElementById("callStatus");

const participantsListDiv = document.getElementById("participantsList");
const participantWinsDiv = document.getElementById("participantWins");

const toast = document.getElementById("toast");

let roomCreated = false;
let roomCode = "";
let bidIncrement = 1;
let callStage = 0; // 0=none, 1=first call, 2=second call
let highestBidder = null;
let participants = [];
let players = [];
let winningPlayersByParticipant = {}; // { participantName: [players] }

function showToast(message, isError = false) {
  toast.textContent = message;
  toast.style.backgroundColor = isError ? "var(--color-danger)" : "var(--color-success)";
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 3000);
}

createRoomBtn.addEventListener("click", () => {
  const name = roomNameInput.value.trim();
  const maxParticipants = parseInt(numParticipantsInput.value);
  const increment = parseInt(bidIncrementInput.value);

  if (!name) return showToast("Room name required", true);
  if (!maxParticipants || maxParticipants < 1) return showToast("Valid participants number required", true);
  if (!increment || increment < 1) return showToast("Valid bid increment required", true);

  roomCode = generateRoomCode();
  bidIncrement = increment;

  socket.emit("create-room", {
    roomName: name,
    maxParticipants,
    bidIncrement: increment,
    roomCode,
  });

  roomCreated = true;
  roomNameDisplay.textContent = name;
  inviteLinkInput.value = `${window.location.origin}/bidder.html?room=${roomCode}`;

  roomSetupSection.style.display = "none";
  auctionSection.style.display = "block";

  startBiddingBtn.disabled = false;
  finalCallBtn.disabled = true;

  players = [];
  participants = [];
  winningPlayersByParticipant = {};
  callStage = 0;
  highestBidder = null;

  updatePlayersList();
  updateParticipantsList();
  participantWinsDiv.innerHTML = "";
});

addPlayerBtn.addEventListener("click", () => {
  const name = playerNameInput.value.trim();
  const club = playerClubInput.value.trim();
  const position = playerPositionInput.value.trim();
  const style = playerStyleInput.value.trim();
  const value = parseInt(playerValueInput.value);

  if (!name || !club || !position || !style || isNaN(value)) {
    return showToast("Fill all player fields correctly", true);
  }

  const player = {
    id: Date.now() + Math.random().toString(36).slice(2),
    name,
    club,
    position,
    style,
    value,
    currentBid: value,
    highestBidder: null,
    sold: false,
  };

  players.push(player);
  socket.emit("update-players", { roomCode, players });

  updatePlayersList();
  clearPlayerInputs();
});

function clearPlayerInputs() {
  playerNameInput.value = "";
  playerClubInput.value = "";
  playerPositionInput.value = "";
  playerStyleInput.value = "";
  playerValueInput.value = "";
}

function updatePlayersList() {
  if (players.length === 0) {
    playersListDiv.innerHTML = "<p>No players added yet.</p>";
    return;
  }
  playersListDiv.innerHTML = "";
  players.forEach((p) => {
    const div = document.createElement("div");
    div.className = "card";
    div.innerHTML = `
      <strong>${p.name}</strong> (${p.club})<br/>
      Position: ${p.position} | Style: ${p.style}<br/>
      Base Value: ${p.value} | Current Bid: ${p.currentBid} <br/>
      Sold: ${p.sold ? "Yes" : "No"}
    `;
    playersListDiv.appendChild(div);
  });
}

copyInviteBtn.addEventListener("click", () => {
  inviteLinkInput.select();
  inviteLinkInput.setSelectionRange(0, 99999); // For mobile
  document.execCommand("copy");
  showToast("Invite link copied!");
});

startBiddingBtn.addEventListener("click", () => {
  if (players.length === 0) return showToast("Add at least one player before starting", true);

  socket.emit("start-bidding", { roomCode });
  startBiddingBtn.disabled = true;
  finalCallBtn.disabled = false;
  showToast("Bidding started!");
});

finalCallBtn.addEventListener("click", () => {
  if (players.length === 0) return;

  callStage++;
  if (callStage === 1) {
    callStatusDiv.textContent = "First Call";
    socket.emit("final-call", { roomCode, stage: "first" });
  } else if (callStage === 2) {
    callStatusDiv.textContent = "Second Call";
    socket.emit("final-call", { roomCode, stage: "second" });
  } else if (callStage === 3) {
    const currentPlayer = players.find((p) => !p.sold);
    if (!currentPlayer) {
      callStatusDiv.textContent = "No player left";
      finalCallBtn.disabled = true;
      return;
    }

    if (!highestBidder) {
      showToast("No bids placed on current player, cannot finalize sale", true);
      callStage = 2; // Stay on second call until bid placed
      return;
    }

    // Mark player sold
    currentPlayer.sold = true;
    currentPlayer.highestBidder = highestBidder;

    // Assign player to bidder
    if (!winningPlayersByParticipant[highestBidder]) {
      winningPlayersByParticipant[highestBidder] = [];
    }
    winningPlayersByParticipant[highestBidder].push(currentPlayer);

    socket.emit("player-sold", {
      roomCode,
      player: currentPlayer,
      highestBidder,
    });

    showToast(`Player sold to ${highestBidder} for ${currentPlayer.currentBid}`);

    // Reset call state
    callStatusDiv.textContent = "";
    callStage = 0;
    highestBidder = null;

    updatePlayersList();
    updateParticipantsList();
    participantWinsDiv.innerHTML = "";

    // Move to next player or disable final call
    if (players.some((p) => !p.sold)) {
      finalCallBtn.disabled = false;
    } else {
      finalCallBtn.disabled = true;
      showToast("All players sold!");
    }
  }
  socket.emit("call-stage", { roomCode, stage: callStage });
});

socket.on("new-participant", ({ roomCode: r, participantName }) => {
  if (r !== roomCode) return;
  if (!participants.includes(participantName)) {
    participants.push(participantName);
    updateParticipantsList();
  }
});

socket.on("new-bid", ({ roomCode: r, bidderName, amount }) => {
  if (r !== roomCode) return;

  // Reset call stage if bid during calls
  if (callStage > 0) {
    callStage = 1;
    callStatusDiv.textContent = "First Call";
    showToast(`Bid placed by ${bidderName} during call, restarting First Call`);
    socket.emit("call-stage", { roomCode, stage: callStage });
  }

  // Update highest bid & bidder on current player
  const currentPlayer = players.find((p) => !p.sold);
  if (!currentPlayer) return;

  if (amount >= currentPlayer.currentBid + bidIncrement) {
    currentPlayer.currentBid = amount;
    currentPlayer.highestBidder = bidderName;
    highestBidder = bidderName;
    updatePlayersList();
  } else{
    showToast(`Bid must be at least ${currentPlayer.currentBid + bidIncrement}`, true);
  }
});

function updateParticipantsList() {
  if (participants.length === 0) {
    participantsListDiv.innerHTML = "<p>No participants joined yet.</p>";
    return;
  }
  participantsListDiv.innerHTML = "";
  participants.forEach((p) => {
    const pDiv = document.createElement("div");
    pDiv.textContent = p;
    pDiv.className = "card";
    pDiv.style.cursor = "pointer";
    pDiv.addEventListener("click", () => {
      showParticipantWins(p);
    });
    participantsListDiv.appendChild(pDiv);
  });
}

function showParticipantWins(participant) {
  const wins = winningPlayersByParticipant[participant] || [];
  if (wins.length === 0) {
    participantWinsDiv.innerHTML = `<p>${participant} has not won any players yet.</p>`;
    return;
  }
  participantWinsDiv.innerHTML = "";
  wins.forEach((player) => {
    const pDiv = document.createElement("div");
    pDiv.className = "card";
    pDiv.innerHTML = `
      <strong>${player.name}</strong> (${player.club}) - ${player.position} - ${player.style}<br/>
      Sold for: ${player.currentBid}
    `;
    participantWinsDiv.appendChild(pDiv);
  });
}

function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}