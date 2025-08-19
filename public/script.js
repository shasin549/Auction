const socket = io();

// Show/hide sections
function showAuctioneer() {
  document.getElementById('auctioneerInfo').classList.remove('hidden');
  document.getElementById('bidderInfo').classList.add('hidden');
  socket.emit('requestAuctioneerInfo');
}

function showBidder() {
  const participantName = prompt("Enter your name:");
  document.getElementById('participantNameDisplay').innerText = participantName;
  document.getElementById('bidderInfo').classList.remove('hidden');
  document.getElementById('auctioneerInfo').classList.add('hidden');
  socket.emit('joinAsBidder', { name: participantName });
}

// Listen for live updates
socket.on('updateAuctioneerInfo', data => {
  document.getElementById('roomNameDisplay').innerText = data.roomName;
  document.getElementById('participantsDisplay').innerText = data.participants.length;
  document.getElementById('bidIncrementDisplay').innerText = data.bidIncrement;
});

socket.on('updateBidderInfo', data => {
  document.getElementById('roomCodeDisplay').innerText = data.roomCode;
});