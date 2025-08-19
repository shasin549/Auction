const socket = io();

// ---- UI Navigation ----
function showSection(id) {
  document.getElementById("landing").style.display = "none";
  document.getElementById("auctioneer").style.display = "none";
  document.getElementById("bidder").style.display = "none";
  document.getElementById(id).style.display = "block";
}

// ---- Auctioneer Logic ----
const createRoomBtn = document.getElementById("createRoomBtn");
const startBiddingBtn = document.getElementById("startBiddingBtn");
const finalCallBtn = document.getElementById("finalCallBtn");

let roomCode, callStage = 0;

if (createRoomBtn) {
  createRoomBtn.onclick = () => {
    const roomName = document.getElementById("roomName").value;
    const participants = document.getElementById("participants").value;
    const bidIncrement = document.getElementById("bidIncrement").value;

    socket.emit("createRoom", { roomName, participants, bidIncrement }, (code) => {
      roomCode = code;
      document.getElementById("roomDisplay").innerText = roomName;
      document.getElementById("inviteLink").innerText = window.location.origin + "/index.html?room=" + code;
      document.getElementById("room-setup").style.display = "none";
      document.getElementById("auction-controls").style.display = "block";
    });
  };

  startBiddingBtn.onclick = () => {
    const player = {
      name: document.getElementById("playerName").value,
      club: document.getElementById("playerClub").value,
      position: document.getElementById("playerPosition").value,
      style: document.getElementById("playerStyle").value,
      value: parseInt(document.getElementById("playerValue").value)
    };
    callStage = 0;
    socket.emit("startBidding", { roomCode, player });
  };

  finalCallBtn.onclick = () => {
    callStage++;
    if (callStage === 1) {
      document.getElementById("callStatus").innerText = "First Call!";
    } else if (callStage === 2) {
      document.getElementById("callStatus").innerText = "Second Call!";
    } else {
      socket.emit("finalizeSale", roomCode);
      document.getElementById("callStatus").innerText = "Player Sold!";
      callStage = 0;
    }
  };

  socket.on("participantsUpdate", (list) => {
    const ul = document.getElementById("participantsList");
    ul.innerHTML = "";
    list.forEach(p => {
      const li = document.createElement("li");
      li.innerText = p.name;
      ul.appendChild(li);
    });
  });
}

// ---- Bidder Logic ----
const joinRoomBtn = document.getElementById("joinRoomBtn");
const placeBidBtn = document.getElementById("placeBidBtn");

let myName;

if (joinRoomBtn) {
  joinRoomBtn.onclick = () => {
    myName = document.getElementById("name").value;
    roomCode = document.getElementById("roomCode").value;
    socket.emit("joinRoom", { name: myName, roomCode }, (success) => {
      if (success) {
        document.getElementById("auction-area").style.display = "block";
      } else {
        alert("Room not found!");
      }
    });
  };

  placeBidBtn.onclick = () => {
    socket.emit("placeBid", { roomCode, name: myName });
  };

  socket.on("newPlayer", (player) => {
    document.getElementById("playerDetails").innerText =
      `${player.name} (${player.club}) - ${player.position}, ${player.style}, Value: ${player.value}`;
    document.getElementById("highestBid").innerText = player.value;
  });

  socket.on("updateBid", (bid) => {
    document.getElementById("highestBid").innerText = bid;
  });

  socket.on("playerWon", (player) => {
    const li = document.createElement("li");
    li.innerText = `${player.name} (${player.club}) - ${player.value}`;
    document.getElementById("myPlayers").appendChild(li);
  });
}