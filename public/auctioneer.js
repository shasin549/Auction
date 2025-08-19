const socket = io();

document.getElementById("createRoomBtn").addEventListener("click", () => {
  const roomName = document.getElementById("roomName").value;
  const participants = document.getElementById("participants").value;
  const bidIncrement = document.getElementById("bidIncrement").value;

  socket.emit("createRoom", { roomName, participants, bidIncrement });
});

socket.on("roomCreated", ({ roomCode }) => {
  const inviteLink = `${window.location.origin}/bidder.html?room=${roomCode}`;
  document.getElementById("inviteLink").innerText = inviteLink;
  document.getElementById("inviteSection").style.display = "block";
  document.getElementById("playerSection").style.display = "block";

  document.getElementById("copyLinkBtn").onclick = () => {
    navigator.clipboard.writeText(inviteLink);
    alert("Invite link copied!");
  };

  document.getElementById("startBiddingBtn").onclick = () => {
    const player = {
      name: document.getElementById("playerName").value,
      club: document.getElementById("playerClub").value,
      position: document.getElementById("playerPosition").value,
      style: document.getElementById("playerStyle").value,
      value: document.getElementById("playerValue").value,
    };
    socket.emit("startBidding", { roomCode, player });
  };
});