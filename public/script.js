// script.js

document.addEventListener("DOMContentLoaded", () => {
  const socket = io();

  // Role and UI state
  let currentRole = null;
  let roomId = '';
  let bidIncrement = 10;

  // Buttons and Sections
  const auctioneerBtn = document.getElementById('auctioneerBtn');
  const bidderBtn = document.getElementById('bidderBtn');
  const auctioneerSection = document.getElementById('auctioneerSection');
  const bidderSection = document.getElementById('bidderSection');
  const createRoomBtn = document.getElementById('createRoomBtn');
  const joinFromLinkBtn = document.getElementById('joinFromLinkBtn');
  const roomInactiveSection = document.getElementById('roomInactiveSection');
  const roomActiveSection = document.getElementById('roomActiveSection');
  const placeBidBtn = document.getElementById('placeBidBtn');
  const startBiddingBtn = document.getElementById('startBiddingBtn');
  const finalCallBtn = document.getElementById('finalCallBtn');

  // Inputs
  const roomNameInput = document.getElementById('roomName');
  const maxParticipantsInput = document.getElementById('maxParticipants');
  const bidIncrementSelect = document.getElementById('bidIncrement');
  const inviteLinkInput = document.getElementById('inviteLinkInput');
  const bidderNameInput = document.getElementById('bidderName');
  const playerNameInput = document.getElementById('playerName');
  const playerClubInput = document.getElementById('playerClub');
  const playerPositionInput = document.getElementById('playerPositionInput');
  const startingPriceInput = document.getElementById('startingPrice');

  // Displays
  const roomCodeDisplay = document.getElementById('roomCodeDisplay');
  const roomTitle = document.getElementById('roomTitle');
  const inviteLinkContainer = document.getElementById('inviteLinkContainer');
  const inviteLinkElement = document.getElementById('inviteLink');
  const copyLinkBtn = document.getElementById('copyLinkBtn');
  const participantList = document.getElementById('participantList');
  const participantCount = document.getElementById('participantCount');
  const winnerDisplay = document.getElementById('winnerDisplay');
  const winnerPlayerName = document.getElementById('winnerPlayerName');
  const winnerName = document.getElementById('winnerName');
  const winningBid = document.getElementById('winningBid');

  // Role selection
  auctioneerBtn.addEventListener('click', () => {
    currentRole = 'auctioneer';
    auctioneerSection.classList.remove('hidden');
    bidderSection.classList.add('hidden');
  });

  bidderBtn.addEventListener('click', () => {
    currentRole = 'bidder';
    bidderSection.classList.remove('hidden');
    auctioneerSection.classList.add('hidden');
  });

  // Create Room
  createRoomBtn.addEventListener('click', () => {
    const roomName = roomNameInput.value.trim();
    const maxParticipants = parseInt(maxParticipantsInput.value);
    bidIncrement = parseInt(bidIncrementSelect.value);

    if (!roomName) {
      alert("Please enter a room name");
      return;
    }

    roomId = generateRoomId();

    socket.emit('create-room', {
      roomId,
      roomName,
      bidIncrement,
      maxParticipants
    });

    socket.emit('join-room', {
      roomId,
      userName: 'Auctioneer',
      role: 'auctioneer'
    });

    roomTitle.textContent = roomName;
    roomCodeDisplay.textContent = roomId;
    generateInviteLink(roomId);

    roomInactiveSection.classList.add('hidden');
    roomActiveSection.classList.remove('hidden');
    document.getElementById('auctioneerControls').classList.remove('hidden');
  });

  // Join Room
  joinFromLinkBtn.addEventListener('click', () => {
    const inviteLink = inviteLinkInput.value.trim();
    const bidderName = bidderNameInput.value.trim() || 'Bidder';

    if (!inviteLink) {
      alert("Please paste the invite link");
      return;
    }

    const url = new URL(inviteLink);
    const roomFromUrl = url.searchParams.get('room');
    if (!roomFromUrl) {
      alert("Invalid invite link");
      return;
    }

    roomId = roomFromUrl;

    socket.emit('join-room', {
      roomId,
      userName: bidderName,
      role: 'bidder'
    });

    roomInactiveSection.classList.add('hidden');
    roomActiveSection.classList.remove('hidden');
    document.getElementById('bidderControls').classList.remove('hidden');
  });

  // Start Auction
  startBiddingBtn.addEventListener('click', () => {
    const playerName = playerNameInput.value.trim();
    const playerClub = playerClubInput.value.trim();
    const playerPosition = playerPositionInput.value.trim();
    const startingPrice = parseInt(startingPriceInput.value);

    if (!playerName || !playerClub || !playerPosition || !startingPrice) {
      alert("Fill in all player details");
      return;
    }

    socket.emit('start-auction', {
      playerName,
      playerClub,
      playerPosition,
      startingPrice
    });

    startBiddingBtn.disabled = true;
    finalCallBtn.disabled = false;
  });

  // Place Bid
  placeBidBtn.addEventListener('click', () => {
    socket.emit('place-bid');
  });

  // Final Call
  finalCallBtn.addEventListener('click', () => {
    socket.emit('end-auction');
    finalCallBtn.disabled = true;
    startBiddingBtn.disabled = false;
  });

  // Socket Listeners
  socket.on('room-state', (data) => {
    participantCount.textContent = data.participants.length;
    participantList.innerHTML = '';
    data.participants.forEach(p => {
      const el = document.createElement('div');
      el.classList.add('participant');
      el.textContent = p.name;
      participantList.appendChild(el);
    });
  });

  socket.on('auction-started', (data) => {
    console.log("Auction Started:", data);
    finalCallBtn.disabled = false;
    placeBidBtn.disabled = false;
  });

  socket.on('auction-ended', (data) => {
    winnerDisplay.classList.remove('hidden');
    winnerPlayerName.textContent = data.playerName;
    winnerName.textContent = data.winnerName;
    winningBid.textContent = data.winningBid;
    placeBidBtn.disabled = true;
    finalCallBtn.disabled = true;
  });

  // Utility: Generate Room ID
  function generateRoomId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  // Utility: Generate Invite Link
  function generateInviteLink(roomId) {
    const link = `${window.location.origin}?room=${roomId}`;
    inviteLinkElement.textContent = link;
    inviteLinkContainer.classList.remove('hidden');

    copyLinkBtn.onclick = () => {
      navigator.clipboard.writeText(link);
      copyLinkBtn.textContent = "Copied!";
      setTimeout(() => {
        copyLinkBtn.textContent = "Copy";
      }, 2000);
    };
  }
});