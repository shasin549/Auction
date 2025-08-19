const socket = io();

function joinRoom() {
  const participant = document.getElementById("participantName").value;
  const roomName = document.getElementById("roomCode").value;
  socket.emit("joinRoom", { roomName, participant });
}

socket.on("joinedRoom", (roomName) => {
  alert(`✅ Joined room '${roomName}'`);
  document.getElementById("auction-screen").style.display = "block";
});

socket.on("errorMsg", (msg) => {
  alert(msg);
});

socket.on("playerData", (player) => {
  document.getElementById("livePlayerName").textContent = player.name;
  document.getElementById("livePlayerClub").textContent = player.club;
  document.getElementById("livePlayerPosition").textContent = player.position;
  document.getElementById("livePlayerStyle").textContent = player.style;
  document.getElementById("livePlayerValue").textContent = player.value;
  document.getElementById("highestBid").textContent = player.value;
});

function placeBid() {
  const roomName = document.getElementById("roomCode").value;
  const bidder = document.getElementById("participantName").value;
  const amount = document.getElementById("customBid").value;
  socket.emit("placeBid", { roomName, amount, bidder });
}

socket.on("newBid", ({ bidder, amount }) => {
  document.getElementById("highestBid").textContent = amount;
});

socket.on("auctionResult", (lastBid) => {
  alert(`🏆 Winner: ${lastBid.bidder} with $${lastBid.amount}`);
});