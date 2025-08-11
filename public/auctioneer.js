// auctioneer.js
const socket = io();
let currentRoom = null;
let currentPlayer = null;

const $ = id => document.getElementById(id);

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

$("copyBtn").addEventListener("click", () => {
  const link = $("inviteLink").textContent;
  if (!link) return;
  navigator.clipboard.writeText(link).then(()=>toast("Invite copied"));
});

$("uploadPlayer").addEventListener("click", () => {
  if (!currentRoom) return toast("Create a room first");
  const player = {
    name: $("playerName").value.trim(),
    club: $("playerClub").value.trim(),
    position: $("playerPosition").value.trim(),
    style: $("playerStyle").value.trim(),
    value: Number($("playerValue").value) || 0,
    image: $("playerImage").value.trim() || null
  };
  if (!player.name || !player.club || !player.position || !player.style || !player.value) {
    return toast("Please fill required fields (value must be a number)");
  }
  currentPlayer = player;
  showPreview(player);
  socket.emit("uploadPlayer", { roomCode: currentRoom, player });
});

function showPreview(p){
  $("previewArea").classList.remove("hidden");
  $("previewName").textContent = p.name;
  $("previewClub").textContent = p.club;
  $("previewPosition").textContent = p.position;
  $("previewStyle").textContent = p.style;
  $("previewValue").textContent = `Value: ${p.value}`;

  const wrap = $("previewImageWrap");
  wrap.innerHTML = "";
  if (p.image) {
    const img = document.createElement("img");
    img.src = p.image;
    img.alt = p.name;
    img.style.width = "100%";
    img.style.height = "100%";
    img.style.objectFit = "cover";
    wrap.appendChild(img);
  } else {
    wrap.innerHTML = `<div style="padding:18px;text-align:center;color:var(--muted)">No image</div>`;
  }
}

$("startBidding").addEventListener("click", () => {
  if (!currentRoom) return toast("Create room first");
  if (!currentPlayer) return toast("Upload a player first");
  socket.emit("startBidding", { roomCode: currentRoom });
});

$("finalCall").addEventListener("click", () => {
  if (!currentRoom) return;
  socket.emit("finalCall", { roomCode: currentRoom });
});

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

socket.on("callUpdate", payload => toast(payload.msg || payload));
socket.on("bidUpdate", ({ highestBid, highestBidder }) => {
  toast(`Bid ${highestBid} by ${highestBidder}`);
});
socket.on("playerSold", ({ player, winner, price }) => {
  toast(`${player.name} sold to ${winner} for ${price}`);
  // reset preview + form
  currentPlayer = null;
  $("previewArea").classList.add("hidden");
  ["playerName","playerClub","playerPosition","playerStyle","playerValue","playerImage"].forEach(id=>$(id).value="");
});

function toast(text){
  const t = document.createElement("div");
  t.className = "toaster";
  t.textContent = text;
  document.body.appendChild(t);
  setTimeout(()=>t.remove(), 2800);
}