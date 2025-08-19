const socket = io();
let roomName = "";
let participantName = "";

// Pre-fill room from invite link
const params = new URLSearchParams(window.location.search);
if (params.get("room")) {
  document.getElementById("roomCode").value = params.get("room");
}

document.getElementById("joinBtn").addEventListener("click", () => {
  participantName = document.getElementById("participantName").value.trim();
  roomName = document.getElementById("roomCode").value.trim();
  if (!participantName || !roomName) {
    alert("Enter your name and room code.");
    return;
  }
  socket.emit("joinRoom", { roomName, participantName });
  document.getElementById("liveCard").style.display = "block";
});

socket.on("roomNotFound", () => {
  alert("Room not found.");
});

// When auctioneer starts bidding (also acts as preview)
socket.on("biddingStarted", ({ player, currentBid }) => {
  document.getElementById("playerDetails").innerHTML =
    `<strong>${player.name}</strong> (${player.club})<br/>` +
    `Position: ${player.position} · Style: ${player.style}<br/>` +
    `Starting Value: ${currentBid}`;
  document.getElementById("currentBid").textContent = `Current Bid: ${currentBid}`;
});

// Place a bid
document.getElementById("bidBtn").addEventListener("click", () => {
  const bidAmount = parseInt(document.getElementById("bidAmount").value, 10);
  if (isNaN(bidAmount)) {
    alert("Enter a valid number.");
    return;
  }
  socket.emit("placeBid", { roomName, bidderName: participantName, bidAmount });
});

// Bid accepted → update live
socket.on("newBid", ({ bidderName, bidAmount }) => {
  document.getElementById("currentBid").innerHTML =
    `<strong>${bidderName}</strong> bids 💰 ${bidAmount}`;
});

// Bid rejected (wrong increment / too low)
socket.on("bidRejected", ({ message }) => {
  alert(message);
});

// Final result
socket.on("finalResult", ({ highestBidder, finalBid }) => {
  document.getElementById("currentBid").innerHTML =
    `🏆 Winner: <strong>${highestBidder || "—"}</strong> with ${finalBid}`;
});