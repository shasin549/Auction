const socket = io();

// Elements
const createRoomBtn = document.getElementById("createRoomBtn");
const inviteLinkContainer = document.getElementById("inviteLinkContainer");
const inviteLinkInput = document.getElementById("inviteLink");
const startBiddingBtn = document.getElementById("startBiddingBtn");
const finalCallBtn = document.getElementById("finalCallBtn");
const nextPlayerBtn = document.getElementById("nextPlayerBtn");

// Create Room
createRoomBtn.addEventListener("click", () => {
    socket.emit("createRoom");
});

socket.on("roomCreated", (roomCode) => {
    const inviteLink = `${window.location.origin}/bidder.html?room=${roomCode}`;
    inviteLinkContainer.style.display = "block";
    inviteLinkInput.value = inviteLink;
});

// Start Bidding
startBiddingBtn.addEventListener("click", () => {
    socket.emit("startBidding");
});

// Final Call
finalCallBtn.addEventListener("click", () => {
    nextPlayerBtn.style.display = "inline-block";
    socket.emit("finalCall");
});

// Next Player
nextPlayerBtn.addEventListener("click", () => {
    socket.emit("nextPlayer");
    nextPlayerBtn.style.display = "none";
});