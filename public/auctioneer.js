const socket = io();
let roomName = "";
let numParticipants = 0;
let bidIncrement = 0;

function createRoom() {
  roomName = document.getElementById("roomName").value.trim();
  numParticipants = document.getElementById("numParticipants").value;
  bidIncrement = document.getElementById("bidIncrement").value;

  if (!roomName || !numParticipants || !bidIncrement) {
    alert("Please fill all fields");
    return;
  }

  socket.emit("createRoom", { roomName, numParticipants, bidIncrement });

  // Hide create room UI
  document.querySelector("h2").style.display = "none";
  document.getElementById("roomName").style.display = "none";
  document.getElementById("numParticipants").style.display = "none";
  document.getElementById("bidIncrement").style.display = "none";
  document.querySelector("button").style.display = "none";

  // Show auction panel
  document.getElementById("auctionPanel").style.display = "block";

  // Show invite link
  let inviteLink = `${window.location.origin}/bidder.html?room=${roomName}`;
  let linkDiv = document.createElement("div");
  linkDiv.innerHTML = `<p><b>Invite Link:</b> <a href="${inviteLink}" target="_blank">${inviteLink}</a></p>`;
  document.querySelector(".card").prepend(linkDiv);
}

function previewPlayer() {
  const player = {
    name: document.getElementById("playerName").value,
    club: document.getElementById("playerClub").value,
    position: document.getElementById("playerPosition").value,
    style: document.getElementById("playerStyle").value,
    value: document.getElementById("playerValue").value,
    room: roomName
  };

  if (!player.name || !player.club || !player.position || !player.style || !player.value) {
    alert("Fill all player details");
    return;
  }

  socket.emit("previewPlayer", player);
}

function startBidding() {
  socket.emit("startBidding", { room: roomName });
}

function finalCall() {
  socket.emit("finalCall", { room: roomName });
}