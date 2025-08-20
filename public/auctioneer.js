// auctioneer.js
const socket = io();

// Panels
const createPanel = document.getElementById('createPanel');
const auctionPanel = document.getElementById('auctionPanel');

// Create fields
const createBtn = document.getElementById('createBtn');
const roomCodeInput = document.getElementById('roomCode');
const incrementInput = document.getElementById('increment');
const numParticipantsInput = document.getElementById('numParticipants');

// Invite link UI
const inviteLinkInput = document.getElementById('inviteLinkInput');
const copyLinkBtn = document.getElementById('copyLinkBtn');

// Player fields
const playerName = document.getElementById('playerName');
const playerClub = document.getElementById('playerClub');
const playerPosition = document.getElementById('playerPosition');
const playerStyle = document.getElementById('playerStyle');
const playerValue = document.getElementById('playerValue');

const addPlayerBtn = document.getElementById('addPlayerBtn');
const startAuctionBtn = document.getElementById('startAuctionBtn');

const currentPlayer = document.getElementById('currentPlayer');
const bidderList = document.getElementById('bidderList');

let currentRoom = null;

// Helper: debug log
function debugLog(...args) {
  console.log('[AUCTIONEER]', ...args);
}

// Create room
createBtn.addEventListener('click', () => {
  const room = (roomCodeInput.value || '').trim();
  const increment = parseInt(incrementInput.value, 10) || 0;
  const participants = parseInt(numParticipantsInput.value, 10) || 0;

  if (!room) return alert('Please enter a unique room code.');
  if (!increment || increment <= 0) return alert('Enter a valid bid increment.');
  if (!participants || participants <= 0) return alert('Enter number of participants.');

  currentRoom = room;
  debugLog('requesting createRoom', { room, increment, participants });
  socket.emit('createRoom', { room, increment, participants });
});

// On room created from server
socket.on('roomCreated', ({ room, inviteLink }) => {
  debugLog('roomCreated', room, inviteLink);

  currentRoom = room;

  // Toggle panels
  createPanel.classList.add('hidden');
  auctionPanel.classList.remove('hidden');

  // Show invite link
  inviteLinkInput.value = inviteLink || `${window.location.origin}/bidder.html?room=${room}`;

  // clear bidder list and current player UI
  bidderList.innerHTML = '';
  setCurrentPlayerPlaceholder();
});

// Copy invite link to clipboard
copyLinkBtn.addEventListener('click', async () => {
  try {
    // Use navigator.clipboard when available (safer on secure contexts)
    const text = inviteLinkInput.value.trim();
    if (!text) return alert('Invite link not available yet.');

    // Try clipboard API
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      alert('Invite link copied!');
      return;
    }

    // Fallback: select & execCommand (mobile-friendly)
    inviteLinkInput.select();
    inviteLinkInput.setSelectionRange(0, 99999);
    const successful = document.execCommand && document.execCommand('copy');
    if (successful) alert('Invite link copied!');
    else throw new Error('Copy not supported');
  } catch (err) {
    console.error('Copy failed', err);
    alert('Could not copy link — select and copy manually.');
  }
});

// Add player
addPlayerBtn.addEventListener('click', () => {
  if (!currentRoom) return alert('Create or join a room first.');

  const player = {
    name: (playerName.value || '').trim(),
    club: (playerClub.value || '').trim(),
    position: (playerPosition.value || '').trim(),
    style: (playerStyle.value || '').trim(),
    value: parseInt(playerValue.value, 10) || 0
  };

  if (!player.name || !player.club || !player.position || !player.style || !player.value) {
    return alert('Please fill all player details (including base value).');
  }

  debugLog('adding player', player);
  socket.emit('addPlayer', { room: currentRoom, player });

  // Clear inputs
  playerName.value = playerClub.value = playerPosition.value = playerStyle.value = '';
  playerValue.value = '';
});

// Start auction
startAuctionBtn.addEventListener('click', () => {
  if (!currentRoom) return alert('Create or join a room first.');
  debugLog('startAuction', currentRoom);
  socket.emit('startAuction', { room: currentRoom });
});

// Server sends player details (first / next player)
socket.on('playerDetails', (player) => {
  debugLog('playerDetails received', player);
  if (!player) {
    setCurrentPlayerPlaceholder();
    return;
  }

  currentPlayer.innerHTML = `
    <strong style="font-size:16px">${escapeHtml(player.name)} (${escapeHtml(player.club)})</strong>
    <div class="muted" style="margin-top:6px;">
      Position: ${escapeHtml(player.position)} • Style: ${escapeHtml(player.style)}
    </div>
    <div style="margin-top:8px;"><strong>Base Value:</strong> ${Number(player.value)}</div>
  `;

  // Clear bidder list so bidders see fresh list for this player
  bidderList.innerHTML = '';
});

// Update bidder list (if/when server emits updates)
socket.on('update-bidders', (bidders) => {
  debugLog('update-bidders', bidders);
  bidderList.innerHTML = '';
  if (!Array.isArray(bidders) || bidders.length === 0) {
    const li = document.createElement('li');
    li.className = 'muted';
    li.textContent = 'No bidders connected';
    bidderList.appendChild(li);
    return;
  }
  bidders.forEach(b => {
    const li = document.createElement('li');
    li.textContent = b.name || 'Unknown';
    bidderList.appendChild(li);
  });
});

// Server error messages
socket.on('errorMsg', (msg) => {
  console.error('Server error:', msg);
  alert('Server: ' + msg);
});

// Helper: placeholder
function setCurrentPlayerPlaceholder() {
  currentPlayer.innerHTML = `<span class="muted">No player selected. Add players then click "Start Auction".</span>`;
}

// Simple HTML escape to prevent injection if any free text shown
function escapeHtml(text) {
  if (text === undefined || text === null) return '';
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

// When page loads ensure placeholder
setCurrentPlayerPlaceholder();