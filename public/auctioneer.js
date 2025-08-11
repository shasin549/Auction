const socket = io();
let currentRoom = null;
let currentPlayer = null;

function $(id){return document.getElementById(id)}

// Create room
$("createRoom").addEventListener("click", () => {
  const roomName = $("roomName").value || `Room`;
  const participants = $("numParticipants").value || 10;
  const increment = $("bidIncrement").value || 10;

  socket.emit("createRoom", { roomName, participants, increment });
});

socket.on("roomCreated", ({ roomName, roomCode }) => {
  currentRoom = roomCode;
  $("createSection").style.display = "none";
  $("panel").style.display = "block";
  $("roomTitle").textContent = `${roomName} — ${roomCode}`;
  $("inviteLink").textContent = `${window.location.origin}/bidder.html?room=${roomCode}`;
  $("roomSub").textContent = `Room: ${roomName}`;
});

// copy link
$("copyBtn").addEventListener("click", () => {
  const link = $("inviteLink").textContent;
  if (!link) return;
  navigator.clipboard.writeText(link).then(()=>alert("Invite link copied"));
});

// Upload player (optional image)
$("uploadPlayer").addEventListener("click", () => {
  if (!currentRoom) return alert("Create a room first");
  const player = {
    name: $("playerName").value.trim(),
    club: $("playerClub").value.trim(),
    position: $("playerPosition").value.trim(),
    style: $("playerStyle").value.trim(),
    value: Number($("playerValue").value) || 0,
    image: $("playerImage").value.trim() || null
  };
  if (!player.name || !player.club || !player.position || !player.style || !player.value) {
    alert("Please fill required fields (value must be a number)");
    return;
  }
  currentPlayer = player;
  showPreview(player);
  socket.emit("uploadPlayer", { roomCode: currentRoom, player });
});

function showPreview(p){
  $("previewArea").style.display = "flex";
  $("previewName").textContent = p.name;
  $("previewClub").textContent = p.club;
  $("previewPosition").textContent = p.position;
  $("previewStyle").textContent = p.style;
  $("previewValue").textContent = `Value: ${p.value}`;

  const imgWrap = $("previewImageWrap");
  imgWrap.innerHTML = "";
  if (p.image) {
    const img = document.createElement("img");
    img.src = p.image;
    img.alt = p.name;
    img.style.width = "100%";
    img.style.height = "100%";
    img.style.objectFit = "cover";
    imgWrap.appendChild(img);
  } else {
    // show a small placeholder (no alert)
    imgWrap.innerHTML = `<div style="padding:18px;text-align:center;color:var(--muted)">No image</div>`;
  }
}

// Start bidding
$("startBidding").addEventListener("click", () => {
  if (!currentRoom) return alert("Create room first");
  if (!currentPlayer) return alert("Upload a player first");
  socket.emit("startBidding", { roomCode: currentRoom });
});

// Final call
$("finalCall").addEventListener("click", () => {
  if (!currentRoom) return;
  socket.emit("finalCall", { roomCode: currentRoom });
});

// update participants list
socket.on("participantsUpdate", (participants) => {
  const ul = $("participantsList");
  ul.innerHTML = "";
  participants.forEach(p => {
    const li = document.createElement("li");
    li.textContent = `${p.name} (${(p.wins||[]).length})`;
    li.onclick = () => {
      const wins = (p.wins || []).map(w=> `${w.name || "(player)"} - ${w.soldPrice || "-"}`).join("\n") || "No wins";
      alert(`${p.name}'s wins:\n${wins}`);
    };
    ul.appendChild(li);
  });
});

// show call updates, bids, sold
socket.on("callUpdate", (payload) => {
  // payload can be {msg, stage}
  alert(payload.msg || payload);
});

socket.on("bidUpdate", ({ highestBid, highestBidder }) => {
  // small toast
  console.log("Bid", highestBid, highestBidder);
});

// playerSold
socket.on("playerSold", ({ player, winner, price }) => {
  alert(`${player.name} SOLD to ${winner} for ${price}`);
  // clear preview
  currentPlayer = null;
  $("previewArea").style.display = "none";
  // clear form
  $("playerName").value = $("playerClub").value = $("playerPosition").value = $("playerStyle").value = $("playerValue").value = $("playerImage").value = "";
});