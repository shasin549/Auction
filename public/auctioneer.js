const socket = io();
let callCount = 0;
let currentPlayer = null;

document.getElementById("createRoomBtn").addEventListener("click", () => {
  const roomName = document.getElementById("roomName").value;
  const numParticipants = document.getElementById("numParticipants").value;
  const bidIncrement = document.getElementById("bidIncrement").value;

  if (!roomName || !numParticipants || !bidIncrement) {
    alert("Please fill all fields");
    return;
  }

  socket.emit("createRoom", { roomName, numParticipants, bidIncrement });
});

socket.on("roomCreated", ({ roomName, roomCode }) => {
  document.querySelector(".create-room").style.display = "none";
  document.getElementById("auctionPanel").style.display = "block";
  document.getElementById("roomInfo").textContent = `Room: ${roomName}`;
  const link = `${window.location.origin}/bidder.html?room=${roomCode}`;
  document.getElementById("inviteLink").textContent = link;

  document.getElementById("shareBtn").onclick = () => {
    navigator.clipboard.writeText(link);
    alert("Invite link copied!");
  };
});

document.getElementById("uploadPlayerBtn").addEventListener("click", () => {
  const player = {
    name: document.getElementById("playerName").value,
    club: document.getElementById("playerClub").value,
    position: document.getElementById("playerPosition").value,
    style: document.getElementById("playerStyle").value,
    value: document.getElementById("playerValue").value,
    image: document.getElementById("playerImage").value || null
  };

  if (!player.name || !player.club || !player.position || !player.style || !player.value) {
    alert("Please fill all required fields");
    return;
  }

  currentPlayer = player;
  showPlayerPreview(player);
  socket.emit("uploadPlayer", player);
});

function showPlayerPreview(player) {
  const previewCard = document.getElementById("playerPreview");

  if (player.image) {
    document.getElementById("playerImageContainer").style.display = "block";
    document.getElementById("previewImage").src = player.image;
  } else {
    document.getElementById("playerImageContainer").style.display = "none";
  }

  document.getElementById("previewName").textContent = player.name;
  document.getElementById("previewClub").textContent = `Club: ${player.club}`;
  document.getElementById("previewPosition").textContent = `Position: ${player.position}`;
  document.getElementById("previewStyle").textContent = `Style: ${player.style}`;
  document.getElementById("previewValue").textContent = `Value: ${player.value}`;
  previewCard.style.display = "block";
}

document.getElementById("startBiddingBtn").addEventListener("click", () => {
  if (!currentPlayer) {
    alert("No player uploaded yet");
    return;
  }
  socket.emit("startBidding", currentPlayer);
});

document.getElementById("finalCallBtn").addEventListener("click", () => {
  if (!currentPlayer) return;

  callCount++;
  let callText = "";

  if (callCount === 1) callText = "First Call!";
  else if (callCount === 2) callText = "Second Call!";
  else if (callCount === 3) {
    callText = "Final Call!";
    socket.emit("playerSold", currentPlayer);
    callCount = 0;
  }

  socket.emit("callUpdate", callText);
});

socket.on("resetCalls", () => {
  callCount = 0;
});

socket.on("updateParticipants", (participants) => {
  const list = document.getElementById("participantsList");
  list.innerHTML = "";
  participants.forEach(p => {
    const li = document.createElement("li");
    li.textContent = `${p.name} (${p.wins.length} wins)`;
    li.onclick = () => alert(`${p.name}'s Wins:\n${p.wins.join(", ") || "None"}`);
    list.appendChild(li);
  });
});