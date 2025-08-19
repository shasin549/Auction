const socket = io();

let currentRoom = null;
let currentIncrement = 0;

document.getElementById("createBtn").addEventListener("click", () => {
  const roomName = document.getElementById("roomName").value.trim();
  const increment = parseInt(document.getElementById("increment").value, 10) || 0;
  socket.emit("createRoom", { roomName, participants: 0, increment });
});

socket.on("roomCreated", ({ roomCode, roomName, increment }) => {
  currentRoom = roomCode;
  currentIncrement = increment || 0;
  // show invite
  document.getElementById("inviteInput").value = `${window.location.origin}/bidder.html?room=${encodeURIComponent(roomCode)}`;
  document.getElementById("inviteWrap").style.display = "block";
  // show panel
  document.getElementById("panel").style.display = "block";
  // scroll to panel on small screens (helps visibility)
  window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });

  document.getElementById("copyInvite").onclick = async () => {
    try {
      await navigator.clipboard.writeText(document.getElementById("inviteInput").value);
      document.getElementById("copyInvite").textContent = "Copied";
      setTimeout(() => (document.getElementById("copyInvite").textContent = "Copy"), 1000);
    } catch (e) {
      alert("Copy failed — please copy manually.");
    }
  };
});

// start bidding -> broadcast preview & reset bids
document.getElementById("startBtn").addEventListener("click", () => {
  if (!currentRoom) { alert("Create a room first."); return; }
  const player = {
    name: document.getElementById("playerName").value.trim(),
    club: document.getElementById("playerClub").value.trim(),
    position: document.getElementById("playerPosition").value.trim(),
    style: document.getElementById("playerStyle").value.trim(),
    value: parseInt(document.getElementById("playerValue").value, 10) || 0
  };
  if (!player.name) { alert("Enter player name."); return; }
  socket.emit("startBidding", { roomCode: currentRoom, player });
});

socket.on("biddingStarted", ({ player, currentBid, increment }) => {
  const preview = `<strong>${player.name}</strong> (${player.club})<div class="small">Position: ${player.position} · Style: ${player.style}</div><div class="small">Start: ${currentBid}</div>`;
  document.getElementById("preview").innerHTML = preview;
  // clear current bids list
  document.getElementById("bids").innerHTML = "";
  // store increment
  currentIncrement = increment || 0;
});

socket.on("bidsUpdated", ({ bids, currentBid }) => {
  const ul = document.getElementById("bids");
  ul.innerHTML = "";
  bids.forEach((b, idx) => {
    const li = document.createElement("li");
    li.className = idx === 0 ? "top" : "";
    li.innerHTML = `<span>${b.bidderName}</span><span>${b.bidAmount}</span>`;
    ul.appendChild(li);
  });
});

socket.on("finalResult", ({ winner, player, finalBid }) => {
  document.getElementById("preview").innerHTML = `<strong>${player ? player.name : "—"}</strong> — Sold for ${finalBid} to ${winner ? winner.bidderName : "No one"}`;
  // you may clear bids but keep them for history
  // document.getElementById("bids").innerHTML = "";
});

socket.on("roomNotFound", () => {
  alert("Room not found.");
});

socket.on("bidRejected", ({ message }) => {
  // show non-blocking rejection (no popup requirement)
  console.warn("Bid rejected:", message);
});