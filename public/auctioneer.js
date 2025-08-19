const socket = io();
let roomName = "";

// Create room
document.getElementById("createRoomBtn").addEventListener("click", () => {
  roomName = document.getElementById("roomName").value.trim();
  const participants = document.getElementById("participants").value.trim();
  const increment = document.getElementById("increment").value.trim();
  if (!roomName || !participants || !increment) {
    alert("Please fill all fields.");
    return;
  }
  socket.emit("createRoom", { roomName, participants, increment });
});

socket.on("roomCreated", ({ roomName }) => {
  // Show invite & panel
  document.getElementById("panelCard").style.display = "block";
  const inviteURL = `${window.location.origin}/bidder.html?room=${encodeURIComponent(roomName)}`;
  document.getElementById("inviteLink").value = inviteURL;
  const wrap = document.getElementById("inviteWrap");
  wrap.style.display = "block";

  document.getElementById("copyBtn").onclick = async () => {
    try {
      await navigator.clipboard.writeText(inviteURL);
      document.getElementById("copyBtn").textContent = "Copied!";
      setTimeout(() => (document.getElementById("copyBtn").textContent = "Copy"), 1200);
    } catch {
      alert("Copy failed. Long-press to select and copy.");
    }
  };
});

// Start bidding (also broadcasts preview)
document.getElementById("startBtn").addEventListener("click", () => {
  const player = {
    name: document.getElementById("playerName").value.trim(),
    club: document.getElementById("playerClub").value.trim(),
    position: document.getElementById("playerPosition").value.trim(),
    style: document.getElementById("playerStyle").value.trim(),
    value: document.getElementById("playerValue").value.trim(),
  };
  if (!player.name || !player.club || !player.position || !player.style || !player.value) {
    alert("Please enter all player fields.");
    return;
  }
  socket.emit("startBidding", { roomName, player });
});

socket.on("biddingStarted", ({ player, currentBid }) => {
  document.getElementById("preview").innerHTML =
    `<strong>${player.name}</strong> (${player.club})<br/>` +
    `Position: ${player.position} · Style: ${player.style}<br/>` +
    `Starting Value: ${currentBid}`;
  document.getElementById("liveBids").textContent = "Awaiting bids…";
});

socket.on("newBid", ({ bidderName, bidAmount }) => {
  document.getElementById("liveBids").innerHTML =
    `<strong>${bidderName}</strong> bids 💰 ${bidAmount}`;
});

socket.on("finalResult", ({ highestBidder, finalBid }) => {
  document.getElementById("liveBids").innerHTML =
    `🏆 Winner: <strong>${highestBidder || "—"}</strong> with ${finalBid}`;
});

// Final call
document.getElementById("finalBtn").addEventListener("click", () => {
  socket.emit("finalCall", { roomName });
});

// Errors
socket.on("errorMsg", (m) => alert(m));