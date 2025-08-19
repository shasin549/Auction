const socket = io();
const urlParams = new URLSearchParams(window.location.search);
const room = urlParams.get("room");
document.getElementById("roomCode").textContent = room;

let bidderName = "";

// Join room
socket.emit("joinRoom", room);

// Start Bidding Event
socket.on("playerDetails", (details) => {
  document.getElementById("playerPreview").innerText =
    `${details.name} (${details.club})\n` +
    `Position: ${details.position}\nStyle: ${details.style}\nStart: ${details.value}`;
});

// Place bid
document.getElementById("placeBid").onclick = () => {
  bidderName = document.getElementById("bidderName").value.trim();
  const bid = parseInt(document.getElementById("bidValue").value);

  if (!bidderName) return alert("Enter your name!");
  if (!bid || bid <= 0) return alert("Enter valid bid!");

  socket.emit("placeBid", { room, name: bidderName, amount: bid });
};

// Update live bids
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