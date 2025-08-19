const socket = io();
let currentRoom = null;

// Create Room
document.getElementById("createRoomBtn").onclick = () => {
  const room = document.getElementById("roomName").value.trim();
  const participants = document.getElementById("participants").value;
  const increment = document.getElementById("bidIncrement").value;

  if (!room) return alert("Enter room name!");

  socket.emit("createRoom", { room, participants, increment }, (success) => {
    if (success) {
      currentRoom = room;

      // Show invite link
      const inviteLink = `${window.location.origin}/bidder.html?room=${room}`;
      document.getElementById("inviteLink").value = inviteLink;
      document.getElementById("inviteBox").classList.remove("hidden");

      // Hide Create Room, show Auction Panel
      document.getElementById("createRoomSection").classList.add("hidden");
      document.getElementById("auctionPanel").classList.remove("hidden");
    } else {
      alert("Room already exists!");
    }
  });
};

// Copy invite link
document.getElementById("copyLink").onclick = () => {
  const link = document.getElementById("inviteLink");
  link.select();
  document.execCommand("copy");
};

// Start Bidding
document.getElementById("startBidding").onclick = () => {
  const details = {
    name: document.getElementById("playerName").value,
    club: document.getElementById("playerClub").value,
    position: document.getElementById("playerPosition").value,
    style: document.getElementById("playerStyle").value,
    value: document.getElementById("playerValue").value
  };

  socket.emit("startBidding", { room: currentRoom, details });

  // Preview locally
  updatePreview(details);
};

function updatePreview(details) {
  document.getElementById("previewBox").innerText =
    `${details.name} (${details.club})\n` +
    `Position: ${details.position}\nStyle: ${details.style}\nStart: ${details.value}`;
}

// Live bids update
socket.on("updateBids", (bids) => {
  const bidList = document.getElementById("bidList");
  bidList.innerHTML = "";
  bids
    .sort((a, b) => b.amount - a.amount)
    .forEach(b => {
      const li = document.createElement("li");
      li.textContent = `${b.name} - ${b.amount}`;
      bidList.appendChild(li);
    });
});