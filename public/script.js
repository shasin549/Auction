
// WebSocket connection
const socket = io();

// Add connection error handling
socket.on('connect_error', (error) => {
    console.error('Connection error:', error);
    alert('Failed to connect to server. Please refresh the page.');
});

socket.on('disconnect', (reason) => {
    console.log('Disconnected:', reason);
    if (reason === 'io server disconnect') {
        socket.connect();
    }
});

// WebSocket Event Listeners
socket.on('room-state', (data) => {
    // Update participants
    participants = data.participants;
    updateParticipantList();
    
    // Update current auction if exists
    if (data.currentAuction) {
        updateAuctionDisplay(data.currentAuction);
        updateBidHistory(data.bidHistory);
    }
    
    bidIncrement = data.bidIncrement;
    currentBidIncrement.textContent = bidIncrement;
    bidIncrementValue.textContent = bidIncrement;
});

socket.on('participant-joined', (data) => {
    participants = data.participants;
    updateParticipantList();
    console.log('Participant joined:', data.name);
});

socket.on('participant-left', (data) => {
    participants = data.participants;
    updateParticipantList();
    console.log('Participant left:', data.name);
});

socket.on('auction-started', (data) => {
    auctionActive = true;
    currentBid = data.currentBid;
    leadingBidder = data.leadingBidder;
    
    // Update player info
    currentPlayerName.textContent = data.playerName;
    currentPlayerClub.textContent = data.playerClub;
    playerPositionDisplay.textContent = data.playerPosition;
    startingPriceDisplay.textContent = `₹${data.startingPrice}`;
    
    // Update bid display
    document.getElementById('currentBidAmount').textContent = `₹${data.currentBid}`;
    document.getElementById('leadingBidder').textContent = data.leadingBidder || 'None';
    
    // Reset UI
    document.getElementById('winnerDisplay').classList.add('hidden');
    winningBidDisplay.classList.add('hidden');
    document.getElementById('bidHistory').innerHTML = '';
    
    // Enable controls
    if (currentRole === 'bidder') {
        placeBidBtn.disabled = false;
    }
    if (currentRole === 'auctioneer') {
        finalCallBtn.disabled = false;
        finalCallBtn.style.display = 'block';
        nextPlayerBtn.style.display = 'none';
        startBiddingBtn.disabled = true;
    }
});

socket.on('bid-placed', (data) => {
    currentBid = data.currentBid;
    leadingBidder = data.leadingBidder;
    
    // Update displays
    document.getElementById('currentBidAmount').textContent = `₹${data.currentBid}`;
    document.getElementById('leadingBidder').textContent = data.leadingBidder;
    
    // Update bid history
    updateBidHistory(data.bidHistory);
});

socket.on('auction-ended', (data) => {
    auctionActive = false;
    
    // Display winner
    const winnerDisplay = document.getElementById('winnerDisplay');
    winnerDisplay.classList.remove('hidden');
    document.getElementById('winnerPlayerName').textContent = data.playerName;
    document.getElementById('winnerName').textContent = data.winnerName;
    document.getElementById('winningBid').textContent = `₹${data.winningBid}`;
    
    // Show winning bid at top
    winningBidDisplay.classList.remove('hidden');
    winningBidderName.textContent = data.winnerName;
    winningBidAmount.textContent = data.winningBid;
    
    // Disable controls
    placeBidBtn.disabled = true;
    if (currentRole === 'auctioneer') {
        finalCallBtn.disabled = true;
        finalCallBtn.style.display = 'none';
        nextPlayerBtn.style.display = 'block';
        startBiddingBtn.disabled = false;
    }
});

function updateParticipantList() {
    document.getElementById('participantCount').textContent = participants.length;
    const participantList = document.getElementById('participantList');
    participantList.innerHTML = '';
    
    participants.forEach(participant => {
        const participantEl = document.createElement('div');
        participantEl.className = 'participant';
        participantEl.textContent = participant.name;
        participantList.appendChild(participantEl);
    });
}

function updateBidHistory(bidHistory) {
    const bidHistoryEl = document.getElementById('bidHistory');
    bidHistoryEl.innerHTML = '';
    
    bidHistory.forEach(bid => {
        const bidItem = document.createElement('div');
        bidItem.className = 'bid-item';
        bidItem.innerHTML = `
            <div>${bid.bidder}</div>
            <div>₹${bid.amount}</div>
        `;
        bidHistoryEl.appendChild(bidItem);
    });
}

function updateAuctionDisplay(auction) {
    currentPlayerName.textContent = auction.playerName;
    currentPlayerClub.textContent = auction.playerClub;
    playerPositionDisplay.textContent = auction.playerPosition;
    startingPriceDisplay.textContent = `₹${auction.startingPrice}`;
    document.getElementById('currentBidAmount').textContent = `₹${auction.currentBid}`;
    document.getElementById('leadingBidder').textContent = auction.leadingBidder || 'None';
}


// DOM Elements
const auctioneerBtn = document.getElementById('auctioneerBtn');
const bidderBtn = document.getElementById('bidderBtn');
const auctioneerSection = document.getElementById('auctioneerSection');
const bidderSection = document.getElementById('bidderSection');
const createRoomBtn = document.getElementById('createRoomBtn');
const joinRoomBtn = document.getElementById('joinRoomBtn');
const joinFromLinkBtn = document.getElementById('joinFromLinkBtn');
const roomInactiveSection = document.getElementById('roomInactiveSection');
const roomActiveSection = document.getElementById('roomActiveSection');
const startBiddingBtn = document.getElementById('startBiddingBtn');
const finalCallBtn = document.getElementById('finalCallBtn');
const placeBidBtn = document.getElementById('placeBidBtn');
const winningBidDisplay = document.getElementById('winningBidDisplay');
const winningBidderName = document.getElementById('winningBidderName');
const winningBidAmount = document.getElementById('winningBidAmount');
const nextPlayerBtn = document.getElementById('nextPlayerBtn');
const inviteLinkContainer = document.getElementById('inviteLinkContainer');
const inviteLinkElement = document.getElementById('inviteLink');
const copyLinkBtn = document.getElementById('copyLinkBtn');
const shareWhatsApp = document.getElementById('shareWhatsApp');
const shareTelegram = document.getElementById('shareTelegram');
const shareEmail = document.getElementById('shareEmail');
const inviteLinkInput = document.getElementById('inviteLinkInput');

// Player detail inputs
const playerNameInput = document.getElementById('playerName');
const playerClubInput = document.getElementById('playerClub');
const playerPositionInput = document.getElementById('playerPositionInput');
const startingPriceInput = document.getElementById('startingPrice');
const bidIncrementSelect = document.getElementById('bidIncrement');

// Display elements
const currentPlayerName = document.getElementById('currentPlayerName');
const currentPlayerClub = document.getElementById('currentPlayerClub');
const playerPositionDisplay = document.getElementById('playerPosition');
const startingPriceDisplay = document.getElementById('startingPriceDisplay');
const bidIncrementValue = document.getElementById('bidIncrementValue');
const currentBidIncrement = document.getElementById('currentBidIncrement');
const roomCodeDisplay = document.getElementById('roomCodeDisplay');

// State variables
let currentRole = null;
let currentBid = 0;
let leadingBidder = null;
let auctionActive = false;
let participants = [];
let bidIncrement = 10;
let winningBidElement = null;
let roomId = '';

// Event Listeners
auctioneerBtn.addEventListener('click', () => {
    currentRole = 'auctioneer';
    auctioneerSection.classList.remove('hidden');
    bidderSection.classList.add('hidden');
    auctioneerBtn.classList.add('active');
    bidderBtn.classList.remove('active');
});

bidderBtn.addEventListener('click', () => {
    currentRole = 'bidder';
    bidderSection.classList.remove('hidden');
    auctioneerSection.classList.add('hidden');
    bidderBtn.classList.add('active');
    auctioneerBtn.classList.remove('active');
});

createRoomBtn.addEventListener('click', () => {
    const roomName = document.getElementById('roomName').value;
    const maxParticipants = parseInt(document.getElementById('maxParticipants').value);
    bidIncrement = parseInt(bidIncrementSelect.value);
    
    if (!roomName) {
        alert('Please enter a room name');
        return;
    }
    
    // Generate a random room ID
    roomId = generateRoomId();
    
    // Create room on server
    socket.emit('create-room', {
        roomId: roomId,
        roomName: roomName,
        bidIncrement: bidIncrement,
        maxParticipants: maxParticipants
    });
    
    // Join room as auctioneer
    socket.emit('join-room', {
        roomId: roomId,
        userName: 'Auctioneer',
        role: 'auctioneer'
    });
    
    // Set room info
    document.getElementById('roomTitle').textContent = roomName;
    roomCodeDisplay.textContent = roomId;
    currentBidIncrement.textContent = bidIncrement;
    
    // Show auction room
    roomInactiveSection.classList.add('hidden');
    roomActiveSection.classList.remove('hidden');
    
    // Show auctioneer controls
    document.getElementById('auctioneerControls').classList.remove('hidden');
    document.getElementById('bidderControls').classList.add('hidden');
    
    // Initialize final call button
    finalCallBtn.style.display = 'block';
    finalCallBtn.disabled = true;
    
    // Generate and display invite link
    generateInviteLink(roomId);
});

// Generate a random room ID
function generateRoomId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Generate invite link
function generateInviteLink(roomId) {
    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.set('room', roomId);
    const inviteLink = currentUrl.toString();
    
    inviteLinkElement.textContent = inviteLink;
    inviteLinkContainer.classList.remove('hidden');
    
    // Set up copy button
    copyLinkBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(inviteLink).then(() => {
            copyLinkBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
            copyLinkBtn.classList.add('copied');
            setTimeout(() => {
                copyLinkBtn.innerHTML = '<i class="fas fa-copy"></i> Copy Link';
                copyLinkBtn.classList.remove('copied');
            }, 2000);
        });
    });
    
    // Set up share buttons
    const roomName = document.getElementById('roomName').value || 'Player Auction Room';
    const message = `Join my ${roomName} auction! Click here: ${inviteLink}`;
    
    shareWhatsApp.addEventListener('click', () => {
        window.open(`https://wa.me/?text=${encodeURIComponent(message)}`);
    });
    
    shareTelegram.addEventListener('click', () => {
        window.open(`https://t.me/share/url?url=${encodeURIComponent(inviteLink)}&text=${encodeURIComponent(roomName)}`);
    });
    
    shareEmail.addEventListener('click', () => {
        window.open(`mailto:?subject=Join my auction room&body=${encodeURIComponent(message)}`);
    });
}

joinFromLinkBtn.addEventListener('click', () => {
    const bidderName = document.getElementById('bidderName').value.trim();
    const inviteLink = inviteLinkInput.value.trim();
    
    if (!bidderName) {
        alert('Please enter your name');
        return;
    }
    
    if (bidderName.length > 50) {
        alert('Name must be less than 50 characters');
        return;
    }
    
    if (!inviteLink) {
        alert('Please paste the invite link');
        return;
    }
    
    try {
        const url = new URL(inviteLink);
        const extractedRoomId = url.searchParams.get('room');
        
        if (!extractedRoomId) {
            alert('Invalid invite link. Please check and try again.');
            return;
        }
        
        roomId = extractedRoomId;
        
        // Join room as bidder
        socket.emit('join-room', {
            roomId: roomId,
            userName: bidderName,
            role: 'bidder'
        });
        
        // Set room info
        document.getElementById('roomTitle').textContent = `Room ${roomId}`;
        roomCodeDisplay.textContent = roomId;
        
        // Show auction room
        roomInactiveSection.classList.add('hidden');
        roomActiveSection.classList.remove('hidden');
        
        // Show bidder controls
        document.getElementById('bidderControls').classList.remove('hidden');
        document.getElementById('auctioneerControls').classList.add('hidden');
        
        // Hide bidder form
        bidderSection.classList.add('hidden');
    } catch (e) {
        alert('Invalid invite link format. Please check and try again.');
    }
});

startBiddingBtn.addEventListener('click', startAuction);

finalCallBtn.addEventListener('click', () => {
    if (finalCallBtn.disabled) return;
    socket.emit('end-auction');
});

placeBidBtn.addEventListener('click', () => {
    // Send bid to server
    socket.emit('place-bid', {});
});

nextPlayerBtn.addEventListener('click', resetAuction);

// Functions
function startAuction() {
    // Get player details from form
    const name = playerNameInput.value;
    const club = playerClubInput.value;
    const position = playerPositionInput.value;
    const price = parseInt(startingPriceInput.value);
    
    // Validate inputs
    if (!name || !club || !position || !price) {
        alert('Please fill in all player details');
        return;
    }
    
    if (price <= 0) {
        alert('Please enter a valid starting price');
        return;
    }
    
    // Send auction start to server
    socket.emit('start-auction', {
        playerName: name,
        playerClub: club,
        playerPosition: position,
        startingPrice: price
    });
    
    // Clear form for next player
    playerNameInput.value = '';
    playerClubInput.value = '';
    playerPositionInput.value = '';
    startingPriceInput.value = '';
}



function addParticipant(name) {
    participants.push(name);
    document.getElementById('participantCount').textContent = participants.length;
    
    const participantEl = document.createElement('div');
    participantEl.className = 'participant';
    participantEl.textContent = name;
    document.getElementById('participantList').appendChild(participantEl);
}

function resetAuction() {
    // Reset auction state
    auctionActive = false;
    currentBid = 0;
    leadingBidder = null;
    winningBidElement = null;
    
    // Reset UI elements
    document.getElementById('currentBidAmount').textContent = '₹0';
    document.getElementById('leadingBidder').textContent = 'None';
    document.getElementById('bidHistory').innerHTML = '';
    document.getElementById('winnerDisplay').classList.add('hidden');
    winningBidDisplay.classList.add('hidden');
    
    // Enable bidding for new auction
    if (currentRole === 'bidder') {
        placeBidBtn.disabled = false;
    }
    if (currentRole === 'auctioneer') {
        finalCallBtn.disabled = true;
        finalCallBtn.style.display = 'none';
        nextPlayerBtn.style.display = 'none';
        startBiddingBtn.disabled = false;
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Set bid increment value
    bidIncrementSelect.addEventListener('change', () => {
        bidIncrement = parseInt(bidIncrementSelect.value);
        bidIncrementValue.textContent = bidIncrement;
    });
    
    // Check for room code in URL
    const urlParams = new URLSearchParams(window.location.search);
    const roomCode = urlParams.get('room');
    
    if (roomCode) {
        // Auto-fill the invite link if coming from a shared link
        inviteLinkInput.value = window.location.href;
        document.getElementById('bidderName').focus();
    }
    
    
});
      
