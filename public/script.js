// Global variables
let socket;
let roomId = null;
let currentRole = null;
let participants = [];
let bidIncrement = 10;
let reconnectAttempts = 0;

// DOM elements
const auctioneerBtn = document.getElementById('auctioneerBtn');
const bidderBtn = document.getElementById('bidderBtn');
const auctioneerSection = document.getElementById('auctioneerSection');
const bidderSection = document.getElementById('bidderSection');
const roomInactiveSection = document.getElementById('roomInactiveSection');
const roomActiveSection = document.getElementById('roomActiveSection');
const roomTitle = document.getElementById('roomTitle');
const roomCodeDisplay = document.getElementById('roomCodeDisplay');
const currentBidAmount = document.getElementById('currentBidAmount');
const leadingBidder = document.getElementById('leadingBidder');
const placeBidBtn = document.getElementById('placeBidBtn');
const currentBidIncrement = document.getElementById('currentBidIncrement');
const bidIncrementValue = document.getElementById('bidIncrementValue');
const participantList = document.getElementById('participantList');
const participantCount = document.getElementById('participantCount');
const bidHistory = document.getElementById('bidHistory');
const inviteLink = document.getElementById('inviteLink');
const copyLinkBtn = document.getElementById('copyLinkBtn');
const inviteLinkContainer = document.getElementById('inviteLinkContainer');

// Initialize socket connection
function setupSocket() {
    socket = io({
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000
    });

    socket.on('connect', () => {
        console.log('Connected to server');
        reconnectAttempts = 0;
    });

    socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        showBidNotification('Connection lost. Reconnecting...');
    });

    socket.on('disconnect', (reason) => {
        console.log('Disconnected:', reason);
        if (reason === 'io server disconnect') {
            showBidNotification('Disconnected from server. Reconnecting...');
            socket.connect();
        }
    });

    socket.on('reconnect', () => {
        if (roomId && currentRole) {
            socket.emit('rejoin-room', {
                roomId: roomId,
                userName: currentRole === 'auctioneer' ? 'Auctioneer' : document.getElementById('bidderName').value,
                role: currentRole
            });
        }
        reconnectAttempts = 0;
        showBidNotification('Reconnected successfully!');
    });

    socket.on('reconnect_failed', () => {
        if (reconnectAttempts < 3) {
            setTimeout(setupSocket, 2000);
            reconnectAttempts++;
        } else {
            showBidNotification('Failed to reconnect. Please refresh the page.');
        }
    });

    setupSocketHandlers();
}

function setupSocketHandlers() {
    socket.on('room-created', (data) => {
        roomId = data.roomId;
        currentRole = 'auctioneer';
        roomTitle.textContent = data.roomName;
        roomCodeDisplay.textContent = data.roomCode;
        updateRoomDisplay(true);
        showInviteLink(data.inviteLink);
    });

    socket.on('room-joined', (data) => {
        roomId = data.roomId;
        currentRole = 'bidder';
        roomTitle.textContent = data.roomName;
        roomCodeDisplay.textContent = data.roomCode;
        updateRoomDisplay(true);
    });

    socket.on('room-state', (data) => {
        participants = data.participants;
        updateParticipantList();

        if (data.currentAuction) {
            updateAuctionDisplay(data.currentAuction);
            updateBidHistory(data.bidHistory);
        }

        bidIncrement = data.bidIncrement;
        currentBidIncrement.textContent = bidIncrement;
        bidIncrementValue.textContent = `₹${bidIncrement}`;
    });

    socket.on('new-bid', (data) => {
        currentBidAmount.textContent = `₹${data.amount}`;
        leadingBidder.textContent = data.bidderName;
        updateBidHistory(data.bidHistory);
    });

    socket.on('auction-started', (data) => {
        updateAuctionDisplay(data);
        placeBidBtn.disabled = false;
    });

    socket.on('auction-ended', (data) => {
        showWinnerDisplay(data);
    });

    socket.on('participant-joined', (data) => {
        participants = data.participants;
        updateParticipantList();
        showBidNotification(`${data.userName} joined the auction`);
    });

    socket.on('participant-left', (data) => {
        participants = data.participants;
        updateParticipantList();
        showBidNotification(`${data.name} left the auction`);
    });

    socket.on('error', (message) => {
        showBidNotification(message);
    });
}

// UI Functions
function updateRoomDisplay(isActive) {
    roomInactiveSection.classList.toggle('hidden', isActive);
    roomActiveSection.classList.toggle('hidden', !isActive);
    
    if (currentRole === 'auctioneer') {
        document.getElementById('auctioneerControls').classList.remove('hidden');
        document.getElementById('bidderControls').classList.add('hidden');
    } else {
        document.getElementById('auctioneerControls').classList.add('hidden');
        document.getElementById('bidderControls').classList.remove('hidden');
    }
}

function updateParticipantList() {
    participantList.innerHTML = '';
    participants.forEach(participant => {
        const participantEl = document.createElement('div');
        participantEl.className = 'participant';
        participantEl.textContent = participant.name;
        participantList.appendChild(participantEl);
    });
    participantCount.textContent = participants.length;
}

function updateAuctionDisplay(auction) {
    document.getElementById('currentPlayerName').textContent = auction.playerName;
    document.getElementById('currentPlayerClub').textContent = auction.playerClub;
    document.getElementById('playerPosition').textContent = auction.playerPosition;
    document.getElementById('startingPriceDisplay').textContent = `₹${auction.startingPrice}`;
    currentBidAmount.textContent = `₹${auction.currentBid}`;
    leadingBidder.textContent = auction.leadingBidder || 'None';
}

function updateBidHistory(history) {
    bidHistory.innerHTML = '';
    history.forEach(bid => {
        const bidEl = document.createElement('div');
        bidEl.className = 'bid-item';
        bidEl.innerHTML = `
            <div class="bid-amount">₹${bid.amount}</div>
            <div class="bidder-name">${bid.bidderName}</div>
            <div class="bid-time">${new Date(bid.timestamp).toLocaleTimeString()}</div>
        `;
        bidHistory.appendChild(bidEl);
    });
}

function showWinnerDisplay(data) {
    const winnerDisplay = document.getElementById('winnerDisplay');
    document.getElementById('winnerPlayerName').textContent = data.playerName;
    document.getElementById('winnerName').textContent = data.winnerName;
    document.getElementById('winningBid').textContent = data.winningBid;
    winnerDisplay.classList.remove('hidden');
    
    setTimeout(() => {
        winnerDisplay.classList.add('hidden');
    }, 5000);
}

function showInviteLink(link) {
    inviteLink.textContent = link;
    inviteLinkContainer.classList.remove('hidden');
}

function showBidNotification(message) {
    const container = document.querySelector('.notification-container') || 
        (() => {
            const div = document.createElement('div');
            div.className = 'notification-container';
            document.body.appendChild(div);
            return div;
        })();

    const notification = document.createElement('div');
    notification.className = 'bid-notification';
    notification.textContent = message;
    container.appendChild(notification);

    setTimeout(() => {
        notification.remove();
        if (container.children.length === 0) {
            container.remove();
        }
    }, 3000);
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    setupSocket();

    // Role selection
    auctioneerBtn.addEventListener('click', () => {
        auctioneerSection.classList.remove('hidden');
        bidderSection.classList.add('hidden');
    });

    bidderBtn.addEventListener('click', () => {
        bidderSection.classList.remove('hidden');
        auctioneerSection.classList.add('hidden');
    });

    // Create room
    document.getElementById('createRoomBtn').addEventListener('click', () => {
        const roomName = document.getElementById('roomName').value;
        const maxParticipants = document.getElementById('maxParticipants').value;
        const bidIncrement = document.getElementById('bidIncrement').value;
        
        if (!roomName) {
            showBidNotification('Please enter a room name');
            return;
        }

        socket.emit('create-room', {
            roomName,
            maxParticipants,
            bidIncrement
        });
    });

    // Join room
    document.getElementById('joinFromLinkBtn').addEventListener('click', () => {
        const bidderName = document.getElementById('bidderName').value;
        const inviteLink = document.getElementById('inviteLinkInput').value;
        
        if (!bidderName) {
            showBidNotification('Please enter your name');
            return;
        }
        
        if (!inviteLink) {
            showBidNotification('Please enter an invite link');
            return;
        }

        // Extract room ID from link
        const roomId = inviteLink.split('/').pop();
        socket.emit('join-room', {
            roomId,
            userName: bidderName
        });
    });

    // Place bid
    placeBidBtn.addEventListener('click', () => {
        socket.emit('place-bid');
    });

    // Start bidding
    document.getElementById('startBiddingBtn').addEventListener('click', () => {
        const playerName = document.getElementById('playerName').value;
        const playerClub = document.getElementById('playerClub').value;
        const playerPosition = document.getElementById('playerPositionInput').value;
        const startingPrice = document.getElementById('startingPrice').value;
        
        if (!playerName || !playerClub || !startingPrice) {
            showBidNotification('Please fill all player details');
            return;
        }

        socket.emit('start-auction', {
            playerName,
            playerClub,
            playerPosition,
            startingPrice
        });
    });

    // Copy invite link
    copyLinkBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(inviteLink.textContent);
        showBidNotification('Link copied to clipboard!');
    });

    // Touch gestures
    const bidHistoryEl = document.getElementById('bidHistory');
    if (bidHistoryEl) {
        const mc = new Hammer(bidHistoryEl);
        mc.on("swipeleft", () => {
            bidHistoryEl.scrollBy({ left: 100, behavior: 'smooth' });
        });
        mc.on("swiperight", () => {
            bidHistoryEl.scrollBy({ left: -100, behavior: 'smooth' });
        });
    }

    if (placeBidBtn) {
        const tap = new Hammer(placeBidBtn, { 
            recognizers: [[Hammer.Tap, { time: 250 }]]
        });
        tap.on('tap', () => {
            if (!placeBidBtn.disabled) {
                placeBidBtn.classList.add('active-tap');
                setTimeout(() => placeBidBtn.classList.remove('active-tap'), 200);
                socket.emit('place-bid');
            }
        });
    }
});