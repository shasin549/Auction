const socket = io();
let currentRoom = null;

// Elements
const joinRoomBtn = document.getElementById("joinRoomBtn");
const roomCodeInput = document.getElementById("roomCodeInput");
const playerName = document.getElementById("playerName");
const playerClub = document.getElementById("playerClub");
const playerPosition = document.getElementById("playerPosition");
const playerPrice = document.getElementById("playerPrice");
const playerImage = document.getElementById("playerImage");
const bidInput = document.getElementById("bidInput");
const placeBidBtn = document.getElementById("placeBidBtn");

// Auto-join if invite link contains room
const urlParams = new URLSearchParams(window.location.search);
const roomFromLink = urlParams.get("room");

if (roomFromLink) {
    currentRoom = roomFromLink;
    joinRoom(roomFromLink);
} else {
    // Manual join
    joinRoomBtn.addEventListener("click", () => {
        const roomCode = roomCodeInput.value.trim();
        if (roomCode) {
            currentRoom = roomCode;
            joinRoom(roomCode);
        }
    });
}

// Join Room Function
function joinRoom(roomCode) {
    socket.emit("joinRoom", roomCode);
}

// Show Player Details When Updated
socket.on("updatePlayer", (player) => {
    playerName.textContent = player.name || "Unknown";
    playerClub.textContent = player.club || "";
    playerPosition.textContent = player.position || "";
    playerPrice.textContent = player.price ? `₹${player.price}` : "";

    if (player.image) {
        playerImage.src = player.image;
        playerImage.style.display = "block";
    } else {
        playerImage.style.display = "none";
    }
});

// Place Bid
placeBidBtn.addEventListener("click", () => {
    const bidValue = parseInt(bidInput.value);
    if (!isNaN(bidValue) && currentRoom) {
        socket.emit("placeBid", { room: currentRoom, bid: bidValue });
    }
});