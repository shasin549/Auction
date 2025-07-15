// bidder.js

document.addEventListener("DOMContentLoaded", () => { const socket = io();

const bidderNameInput = document.getElementById("bidderName"); const joinBtn = document.getElementById("joinBtn"); const auctionArea = document.getElementById("auctionArea"); const placeBidBtn = document.getElementById("placeBidBtn");

const livePlayerName = document.getElementById("livePlayerName"); const livePlayerClub = document.getElementById("livePlayerClub"); const livePlayerPosition = document.getElementById("livePlayerPosition"); const liveBid = document.getElementById("liveBid"); const leadingBidder = document.getElementById("leadingBidder");

const winnerInfo = document.getElementById("winInfo"); const winnerName = document.getElementById("winnerName"); const winnerPlayer = document.getElementById("winnerPlayer"); const winnerAmount = document.getElementById("winnerAmount");

let roomId = ""; let userName = "";

// Extract roomId from URL const urlParams = new URLSearchParams(window.location.search); roomId = urlParams.get("room");

// Join room joinBtn.addEventListener("click", () => { userName = bidderNameInput.value.trim(); if (!userName) return alert("Please enter your name"); if (!roomId) return alert("Invalid or missing room link");

socket.emit("join-room", {
  roomId,
  userName,
  role: "bidder"
});

auctionArea.classList.remove("hidden");

});

// Receive auction start socket.on("auction-started", (data) => { livePlayerName.textContent = data.playerName; livePlayerClub.textContent = data.playerClub; livePlayerPosition.textContent = data.playerPosition; liveBid.textContent = data.startingPrice; leadingBidder.textContent = "-"; winnerInfo.classList.add("hidden"); });

// Receive bid updates socket.on("bid-placed", ({ currentBid, leadingBidder: name }) => { liveBid.textContent = currentBid; leadingBidder.textContent = name; });

// Place bid placeBidBtn.addEventListener("click", () => { socket.emit("place-bid"); });

// Auction ended socket.on("auction-ended", ({ winnerName: name, playerName, winningBid }) => { winnerInfo.classList.remove("hidden"); winnerName.textContent = name; winnerPlayer.textContent = playerName; winnerAmount.textContent = winningBid; }); });



