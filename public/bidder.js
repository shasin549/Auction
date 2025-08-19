const socket = io();
let roomCode = null;
let bidderName = null;
let bidIncrement = 0;

document.getElementById("joinRoomBtn").addEventListener("click", () => {
  roomCode = document.getElementById("roomCode").value;
  bidderName = document.getElementById("bidderName").value;
  socket.emit("joinRoom", { roomCode, bidderName });
});

socket.on("roomJoined", ({ success, roomCode: joinedRoom }) => {
  if (success) {
    document.getElementById("auctionSection").style.display = "block";
  } else {
    alert("Room not found!");
  }
});

socket.on("biddingStarted", (player) => {
  document.getElementById("currentPlayer").innerText = 
    `${player.name} - ${player.club} - ${player.position} - ${player.style} - Value: ${player.value}`;
});

document.getElementById("placeBidBtn").addEventListener("click", () => {
  let manualBid = document.getElementById("manualBid").value;
  let bidAmount = manualBid ? parseInt(manualBid) : null;

  if (!bidAmount) {
    // fallback to increment-based bidding
    const highest = document.querySelector("#bidList li:first-child");
    let highestBid = highest ? parseInt(highest.dataset.amount) : 0;
    bidAmount = highestBid + parseInt(bidIncrement || 1);
  }

  socket.emit("placeBid", { roomCode, bidderName, bidAmount });
});

socket.on("bidPlaced", (bids) => {
  const bidList = document.getElementById("bidList");
  bidList.innerHTML = "";
  bids.forEach((bid) => {
    const li = document.createElement("li");
    li.innerText = `${bid.bidderName}: ${bid.bidAmount}`;
    li.dataset.amount = bid.bidAmount;
    bidList.appendChild(li);
  });
});