

// auctioneer.js

document.addEventListener("DOMContentLoaded", () => { const socket = io();

const createRoomBtn = document.getElementById("createRoomBtn"); const roomNameInput = document.getElementById("roomName"); const bidIncrementInput = document.getElementById("bidIncrement"); const roomIdDisplay = document.getElementById("roomIdDisplay"); const inviteLink = document.getElementById("inviteLink"); const roomInfo = document.getElementById("roomInfo"); const playerForm = document.getElementById("playerForm");

const playerNameInput = document.getElementById("playerName"); const playerClubInput = document.getElementById("playerClub"); const playerPositionInput = document.getElementById("playerPosition"); const startingPriceInput = document.getElementById("startingPrice"); const startAuctionBtn = document.getElementById("startAuctionBtn");

const previewName = document.getElementById("previewName"); const previewClub = document.getElementById("previewClub"); const previewPosition = document.getElementById("previewPosition"); const previewPrice = document.getElementById("previewPrice"); const playerPreview = document.getElementById("playerPreview");

let roomId = "";

// Helper: Generate room code function generateRoomId() { return Math.random().toString(36).substring(2, 8).toUpperCase(); }

// Create Room createRoomBtn.addEventListener("click", () => { const roomName = roomNameInput.value.trim(); const bidIncrement = parseInt(bidIncrementInput.value);

if (!roomName) return alert("Please enter a room name");

roomId = generateRoomId();

socket.emit("create-room", {
  roomId,
  roomName,
  bidIncrement,
  maxParticipants: 100 // default cap
});

socket.emit("join-room", {
  roomId,
  userName: "Auctioneer",
  role: "auctioneer"
});

roomIdDisplay.textContent = roomId;
inviteLink.textContent = `${window.location.origin}/bidder.html?room=${roomId}`;
roomInfo.classList.remove("hidden");
playerForm.classList.remove("hidden");

});

// Start Auction with Player Data startAuctionBtn.addEventListener("click", () => { const playerName = playerNameInput.value.trim(); const playerClub = playerClubInput.value.trim(); const playerPosition = playerPositionInput.value.trim(); const startingPrice = parseInt(startingPriceInput.value);

if (!playerName || !playerClub || !playerPosition || isNaN(startingPrice)) {
  return alert("Please fill all player fields correctly");
}

const playerData = {
  playerName,
  playerClub,
  playerPosition,
  startingPrice
};

socket.emit("start-auction", playerData);

// Show preview
previewName.textContent = playerName;
previewClub.textContent = playerClub;
previewPosition.textContent = playerPosition;
previewPrice.textContent = startingPrice;
playerPreview.classList.remove("hidden");

}); });

