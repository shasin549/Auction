const socket = io();

let roomCode = "";
let participantName = "";
let currentIncrement = 0;

// autofill room from invite link
const params = new URLSearchParams(window.location.search);
if (params.has("room")) {
  document.getElementById("roomCode").value = params.get("room");
}

document.getElementById("joinBtn").addEventListener("click", () => {
  participantName = document.getElementById("participantName").value.trim();
  roomCode = document.getElementById("roomCode").value.trim();
  if (!participantName || !roomCode) {
    alert("Enter your name and room code.");
    return;
  }
  socket.emit("joinRoom", { roomCode, participantName });
});

socket.on("roomJoined", ({ roomCode: joined, roomName, increment }) => {
  // show live card
  document.getElementById("liveCard").style.display = "block";
  // store increment
  currentIncrement = increment || 0;
});

// If bidding started, show preview and current bid
socket.on("biddingStarted", ({ player, currentBid, increment }) => {
  document.getElementById("playerTitle").innerHTML = `<strong>${player.name}</strong> <div class="small">${player.club} · ${player.position} · ${player.style}</div>`;
  document.getElementById("currentBid").textContent = currentBid;
  // clean list
  document.getElementById("bidList").innerHTML = "";
  currentIncrement = increment || 0;
});

// Place bid by increment
document.getElementById("placeIncrementBtn").addEventListener("click", () => {
  // signal server to use increment (server will compute)
  socket.emit("placeBid", { roomCode, bidderName: participantName, bidAmount: null, useIncrement: true });
});

// Place manual
document.getElementById("placeManualBtn").addEventListener("click", () => {
  const val = document.getElementById("manualBid").value;
  if (!val) {
    alert("Enter a bid value or use Increment.");
    return;
  }
  socket.emit("placeBid", { roomCode, bidderName: participantName, bidAmount: parseInt(val, 10), useIncrement: false });
});

// Update bids list
socket.on("bidsUpdated", ({ bids, currentBid }) => {
  const ul = document.getElementById("bidList");
  ul.innerHTML = "";
  bids.forEach((b, idx) => {
    const li = document.createElement("li");
    li.className = idx === 0 ? "top" : "";
    li.innerHTML = `<span>${b.bidderName}</span><span>${b.bidAmount}</span>`;
    ul.appendChild(li);
  });
  document.getElementById("currentBid").textContent = currentBid;
});

// Final result
socket.on("finalResult", ({ winner, player, finalBid }) => {
  document.getElementById("playerTitle").innerHTML = `<strong>${player ? player.name : "—"}</strong> — Sold for ${finalBid} to ${winner ? winner.bidderName : "No one"}`;
});