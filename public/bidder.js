const socket = io();

function q(id){return document.getElementById(id)}
let myName = null;
let roomCode = null;

function getQueryParam(name){
  const params = new URLSearchParams(location.search);
  return params.get(name);
}

// prefill room from URL if present
document.addEventListener("DOMContentLoaded", () => {
  const fromUrl = getQueryParam("room");
  if (fromUrl) q("roomCode").value = fromUrl;
});

q("joinBtn").addEventListener("click", () => {
  myName = q("bidderName").value.trim();
  roomCode = q("roomCode").value.trim();
  if (!myName || !roomCode) return alert("Enter name and room code");
  socket.emit("joinRoom", { roomCode, participantName: myName });
  q("livePanel").style.display = "block";
  q("placeBid").disabled = false;
  // ask for participants (optional)
  socket.emit("requestParticipants", { roomCode });
});

q("placeBid").addEventListener("click", () => {
  if (!roomCode || !myName) return alert("Join a room first");
  socket.emit("placeBid", { roomCode, bidderName: myName });
});

// show player update
socket.on("playerUpdate", (player) => {
  // render player card
  const container = q("playerBlock");
  container.innerHTML = "";
  const div = document.createElement("div");
  div.className = "auction-card card";
  // show image if available
  if (player.image) {
    const thumb = document.createElement("div");
    thumb.className = "auction-thumb";
    const img = document.createElement("img");
    img.src = player.image;
    img.alt = player.name;
    thumb.appendChild(img);
    div.appendChild(thumb);
  }
  const t = document.createElement("div");
  t.innerHTML = `<div class="title">${player.name}</div>
                 <div class="meta">${player.club} • ${player.position} • ${player.style}</div>
                 <div class="price-row"><div class="small-muted">Current</div><div class="huge">${player.value}</div></div>`;
  div.appendChild(t);
  container.appendChild(div);
});

// receive bid updates
socket.on("bidUpdate", ({ highestBid, highestBidder }) => {
  const h = document.createElement("div");
  h.className = "bid-entry";
  const who = document.createElement("div"); who.className = "who";
  const avatar = document.createElement("div"); avatar.className = "avatar";
  avatar.style.background = randomColorFrom(highestBidder);
  avatar.textContent = highestBidder ? highestBidder[0].toUpperCase() : "?";
  who.appendChild(avatar);
  const info = document.createElement("div");
  info.innerHTML = `<div style="font-weight:700">${highestBidder}</div><div class="small-muted">bid</div>`;
  who.appendChild(info);
  const amt = document.createElement("div"); amt.style.fontWeight = "800"; amt.textContent = highestBid;
  h.appendChild(who); h.appendChild(amt);
  q("bidHistory").appendChild(h);
  // scroll
  q("bidHistory").scrollIntoView({behavior:"smooth"});
});

// sold
socket.on("playerSold", ({ player, winner, price }) => {
  alert(`${player.name} sold to ${winner} for ${price}`);
  if (winner === myName) {
    const li = document.createElement("li");
    li.textContent = `${player.name} — ${price}`;
    q("myWins").appendChild(li);
  }
});

// participants
socket.on("participantsUpdate", (participants) => {
  // optional: show somewhere
  console.log("participants", participants);
});

function randomColorFrom(name){
  let hash = 0;
  if (!name) return "#888";
  for (let i=0;i<name.length;i++) hash = name.charCodeAt(i) + ((hash<<5)-hash);
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue} 70% 45%)`;
}