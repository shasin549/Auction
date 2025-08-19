const socket = io();

const createRoomBtn = document.getElementById('createRoomBtn');
const roomCodeDisplay = document.getElementById('roomCodeDisplay');
const inviteLinkDisplay = document.getElementById('inviteLinkDisplay');
const currentBidDisplay = document.getElementById('currentBidDisplay');
const currentWinnerDisplay = document.getElementById('currentWinnerDisplay');

createRoomBtn.addEventListener('click', () => {
  socket.emit('create-room');
});

socket.on('room-created', (roomCode) => {
  roomCodeDisplay.innerText = roomCode;
  const inviteLink = `${window.location.origin.replace('auctioneer.html','bidder.html')}?room=${roomCode}`;
  inviteLinkDisplay.innerHTML = `<a href="${inviteLink}" target="_blank">${inviteLink}</a>`;
});

socket.on('current-bid', (bidValue, bidderName) => {
  currentBidDisplay.innerText = bidValue;
  currentWinnerDisplay.innerText = bidderName;
});

socket.on('update-bidders', (bidders) => {
  const bidderList = document.getElementById('bidderList');
  bidderList.innerHTML = '';
  bidders.forEach(b => {
    const li = document.createElement('li');
    li.innerText = b.name;
    bidderList.appendChild(li);
  });
});

socket.on('room-closed', () => {
  alert('The auctioneer has closed the room.');
  window.location.reload();
});