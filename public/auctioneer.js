const socket = io();

function createRoom() {
  const roomName = document.getElementById("roomName").value;
  const increment = document.getElementById("increment").value;
  socket.emit("createRoom", { roomName, increment });
}

socket.on("roomCreated", (roomName) => {
  alert(`✅ Room '${roomName}' created!`);
});

socket.on("errorMsg", (msg) => {
  alert(msg);
});

function startBidding() {
  const roomName = document.getElementById("roomName").value;
  const player = {
    name: document.getElementById("playerName").value,
    club: document.getElementById("playerClub").value,
    position: document.getElementById("playerPosition").value,
    style: document.getElementById("playerStyle").value,
    value: document.getElementById("playerValue").value
  };
  socket.emit("startBidding", { roomName, player });
}

function finalCall() {
  const roomName = document.getElementById("roomName").value;
  socket.emit("finalCall", roomName);
}