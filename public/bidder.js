const socket = io();
let currentPlayer = null;
let roomId = null;

document.getElementById('joinRoomBtn').addEventListener('click', () => {
  roomId = document.getElementById('roomIdInput').value.trim();
  const participantName = document.getElementById('participantName').value.trim();
  if (!roomId || !participantName) return alert('Enter both Room ID and Name');
  socket.emit('join-room', { roomId, participantName });
  document.getElementById('joinScreen').style.display = 'none';
  document.getElementById('mainScreen').style.display = 'block';
});

socket.on('player-data', (player) => {
  currentPlayer = player;
  updatePlayerPreview(player);
});

socket.on('call-signal', ({ callCount }) => {
  const type = getCallType(callCount);
  const message = getCallMessage(callCount);
  showCallPopup(message, type);
});

document.getElementById('bidBtn').addEventListener('click', () => {
  const amount = parseInt(document.getElementById('bidAmount').value);
  if (!amount || amount <= 0) return alert('Enter valid bid');
  socket.emit('place-bid', {
    roomId,
    playerId: currentPlayer._id,
    amount
  });
});

function updatePlayerPreview(player) {
  document.getElementById('playerName').textContent = player.name;
  document.getElementById('playerTeam').textContent = player.team;
  document.getElementById('playerSkill').textContent = player.skill;
  document.getElementById('playerBasePrice').textContent = player.basePrice;
  document.getElementById('playerPreview').style.display = 'block';
}

// === Audio + Popup ===

function showCallPopup(message, type) {
  const popup = document.createElement('div');
  popup.className = `call-popup ${type}`;
  popup.textContent = message;
  document.body.appendChild(popup);

  let audioPath = "";
  if (type === 'first') audioPath = 'audio/First Call.mp3';
  else if (type === 'second') audioPath = 'audio/Second Call.mp3';
  else if (type === 'final') audioPath = 'audio/Final Call.mp3';

  if (audioPath) {
    const audio = new Audio(audioPath);
    audio.play().catch(err => console.warn(`Audio error (${type}):`, err));
  }

  setTimeout(() => popup.classList.add('show'), 10);
  setTimeout(() => {
    popup.classList.remove('show');
    setTimeout(() => popup.remove(), 500);
  }, 3000);
}

function getCallType(count) {
  if (count === 1) return 'first';
  if (count === 2) return 'second';
  if (count === 3) return 'final';
  return '';
}

function getCallMessage(count) {
  if (count === 1) return 'First Call!';
  if (count === 2) return 'Second Call!';
  if (count === 3) return 'Final Call!';
  return '';
}