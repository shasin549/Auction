// DOM Elements
const elements = {
    auctioneerBtn: document.getElementById('auctioneerBtn'),
    bidderBtn: document.getElementById('bidderBtn'),
    auctioneerSection: document.getElementById('auctioneerSection'),
    bidderSection: document.getElementById('bidderSection'),
    roomInactiveSection: document.getElementById('roomInactiveSection'),
    roomActiveSection: document.getElementById('roomActiveSection'),
    roomTitle: document.getElementById('roomTitle'),
    roomCodeDisplay: document.getElementById('roomCodeDisplay'),
    currentBidAmount: document.getElementById('currentBidAmount'),
    leadingBidder: document.getElementById('leadingBidder'),
    placeBidBtn: document.getElementById('placeBidBtn'),
    currentBidIncrement: document.getElementById('currentBidIncrement'),
    bidIncrementValue: document.getElementById('bidIncrementValue'),
    participantList: document.getElementById('participantList'),
    participantCount: document.getElementById('participantCount'),
    bidHistory: document.getElementById('bidHistory'),
    inviteLink: document.getElementById('inviteLink'),
    copyLinkBtn: document.getElementById('copyLinkBtn'),
    inviteLinkContainer: document.getElementById('inviteLinkContainer'),
    finalCallBtn: document.getElementById('finalCallBtn'),
    nextPlayerBtn: document.getElementById('nextPlayerBtn')
};

// App State
let state = {
    socket: null,
    roomId: null,
    currentRole: null,
    participants: [],
    bidIncrement: 10,
    reconnectAttempts: 0,
    hammer: null
};

// Socket Initialization
function initializeSocket() {
    state.socket = io({
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000
    });

    // Connection Events
    state.socket.on('connect', () => {
        console.log('Connected to server');
        state.reconnectAttempts = 0;
        showNotification('Connected to auction server');
    });

    state.socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        showNotification(`Connection error: ${error.message || 'Unknown error'}`);
    });

    state.socket.on('disconnect', (reason) => {
        console.log('Disconnected:', reason);
        showNotification(`Disconnected: ${reason}. Reconnecting...`);
    });

    state.socket.on('reconnect_failed', () => {
        showNotification('Failed to reconnect. Please refresh the page.');
    });

    state.socket.on('error', (error) => {
        console.error('Socket error:', error);
        showNotification(`Error: ${error.message || error}`);
    });

    // Application Events
    state.socket.on('room-created', handleRoomCreated);
    state.socket.on('room-joined', handleRoomJoined);
    state.socket.on('room-state', handleRoomState);
    state.socket.on('new-bid', handleNewBid);
    state.socket.on('auction-started', handleAuctionStarted);
    state.socket.on('auction-ended', handleAuctionEnded);
    state.socket.on('participant-joined', handleParticipantJoined);
    state.socket.on('participant-left', handleParticipantLeft);
}

// Event Handlers
function handleRoomCreated(data) {
    state.roomId = data.roomId;
    state.currentRole = 'auctioneer';
    elements.roomTitle.textContent = data.roomName;
    elements.roomCodeDisplay.textContent = data.roomCode;
    updateRoomDisplay(true);
    showInviteLink(data.inviteLink);
    showNotification('Room created successfully!');
}

function handleRoomJoined(data) {
    state.roomId = data.roomId;
    state.currentRole = 'bidder';
    elements.roomTitle.textContent = data.roomName;
    elements.roomCodeDisplay.textContent = data.roomCode;
    updateRoomDisplay(true);
    showNotification(`Joined room: ${data.roomName}`);
}

function handleRoomState(data) {
    state.participants = data.participants;
    state.bidIncrement = data.bidIncrement || 10;
    
    updateParticipantList();
    updateBidControls();

    if (data.currentAuction) {
        updateAuctionDisplay(data.currentAuction);
        updateBidHistory(data.bidHistory);
        elements.placeBidBtn.disabled = false;
        if (state.currentRole === 'auctioneer') {
            elements.finalCallBtn.classList.remove('hidden');
        }
    }
}

function handleNewBid(data) {
    elements.currentBidAmount.textContent = `₹${data.amount}`;
    elements.leadingBidder.textContent = data.bidderName;
    updateBidHistory(data.bidHistory);
    showNotification(`New bid: ₹${data.amount} by ${data.bidderName}`);
}

function handleAuctionStarted(data) {
    updateAuctionDisplay(data);
    elements.placeBidBtn.disabled = false;
    if (state.currentRole === 'auctioneer') {
        elements.finalCallBtn.classList.remove('hidden');
    }
    showNotification(`Auction started for ${data.playerName}`);
}

function handleAuctionEnded(data) {
    showWinnerDisplay(data);
    elements.placeBidBtn.disabled = true;
    if (state.currentRole === 'auctioneer') {
        elements.finalCallBtn.classList.add('hidden');
    }
    showNotification(`Auction ended! ${data.playerName} sold for ₹${data.winningBid}`);
}

function handleParticipantJoined(data) {
    state.participants = data.participants;
    updateParticipantList();
    showNotification(`${data.userName} joined the auction`);
}

function handleParticipantLeft(data) {
    state.participants = data.participants;
    updateParticipantList();
    showNotification(`${data.name} left the auction`);
}

// UI Functions
function updateRoomDisplay(isActive) {
    elements.roomInactiveSection.classList.toggle('hidden', isActive);
    elements.roomActiveSection.classList.toggle('hidden', !isActive);

    if (state.currentRole === 'auctioneer') {
        document.getElementById('auctioneerControls').classList.remove('hidden');
        document.getElementById('bidderControls').classList.add('hidden');
    } else {
        document.getElementById('auctioneerControls').classList.add('hidden');
        document.getElementById('bidderControls').classList.remove('hidden');
    }
}

function updateParticipantList() {
    elements.participantList.innerHTML = '';
    state.participants.forEach(participant => {
        const participantEl = document.createElement('div');
        participantEl.className = 'participant';
        participantEl.textContent = participant.name;
        if (participant.role === 'auctioneer') {
            participantEl.classList.add('auctioneer');
        }
        elements.participantList.appendChild(participantEl);
    });
    elements.participantCount.textContent = state.participants.length;
}

function updateAuctionDisplay(auction) {
    document.getElementById('currentPlayerName').textContent = auction.playerName;
    document.getElementById('currentPlayerClub').textContent = auction.playerClub;
    document.getElementById('playerPosition').textContent = auction.playerPosition;
    document.getElementById('startingPriceDisplay').textContent = `₹${auction.startingPrice}`;
    elements.currentBidAmount.textContent = `₹${auction.currentBid}`;
    elements.leadingBidder.textContent = auction.leadingBidder || 'None';
    elements.currentBidIncrement.textContent = state.bidIncrement;
    elements.bidIncrementValue.textContent = `₹${state.bidIncrement}`;
}

function updateBidHistory(history) {
    elements.bidHistory.innerHTML = '';
    if (!history || history.length === 0) {
        elements.bidHistory.innerHTML = '<div class="no-bids">No bids yet</div>';
        return;
    }

    const recentBids = history.slice(-10).reverse();
    recentBids.forEach(bid => {
        const bidEl = document.createElement('div');
        bidEl.className = 'bid-item';
        bidEl.innerHTML = `
            <div class="bid-amount">₹${bid.amount}</div>
            <div class="bidder-name">${bid.bidderName}</div>
            <div class="bid-time">${new Date(bid.timestamp).toLocaleTimeString()}</div>
        `;
        elements.bidHistory.appendChild(bidEl);
    });
}

function updateBidControls() {
    elements.currentBidIncrement.textContent = state.bidIncrement;
    elements.bidIncrementValue.textContent = `₹${state.bidIncrement}`;
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
    elements.inviteLink.textContent = link;
    elements.inviteLinkContainer.classList.remove('hidden');
}

function showNotification(message) {
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

// Event Bindings
function bindEvents() {
    // Role selection
    elements.auctioneerBtn.addEventListener('click', () => {
        elements.auctioneerSection.classList.remove('hidden');
        elements.bidderSection.classList.add('hidden');
    });

    elements.bidderBtn.addEventListener('click', () => {
        elements.bidderSection.classList.remove('hidden');
        elements.auctioneerSection.classList.add('hidden');
    });

    // Create room
    document.getElementById('createRoomBtn').addEventListener('click', () => {
        const roomName = document.getElementById('roomName').value.trim();
        const maxParticipants = document.getElementById('maxParticipants').value;
        const bidIncrement = document.getElementById('bidIncrement').value;

        if (!roomName) {
            showNotification('Please enter a room name');
            return;
        }

        state.socket.emit('create-room', {
            roomName,
            maxParticipants: parseInt(maxParticipants) || 10,
            bidIncrement: parseInt(bidIncrement) || 10
        });
    });

    // Join room
    document.getElementById('joinFromLinkBtn').addEventListener('click', () => {
        const bidderName = document.getElementById('bidderName').value.trim();
        const inviteLink = document.getElementById('inviteLinkInput').value.trim();

        if (!bidderName) {
            showNotification('Please enter your name');
            return;
        }

        if (!inviteLink) {
            showNotification('Please enter an invite link');
            return;
        }

        const roomId = inviteLink.split('/').pop();
        state.socket.emit('join-room', {
            roomId,
            userName: bidderName
        });
    });

    // Place bid
    elements.placeBidBtn.addEventListener('click', () => {
        state.socket.emit('place-bid');
    });

    // Start bidding
    document.getElementById('startBiddingBtn').addEventListener('click', () => {
        const playerName = document.getElementById('playerName').value.trim();
        const playerClub = document.getElementById('playerClub').value.trim();
        const playerPosition = document.getElementById('playerPositionInput').value;
        const startingPrice = document.getElementById('startingPrice').value;

        if (!playerName || !playerClub || !startingPrice) {
            showNotification('Please fill all player details');
            return;
        }

        state.socket.emit('start-auction', {
            playerName,
            playerClub,
            playerPosition,
            startingPrice: parseInt(startingPrice) || 100
        });
    });

    // End auction
    elements.finalCallBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to end the auction?')) {
            state.socket.emit('end-auction');
        }
    });

    // Next player
    elements.nextPlayerBtn.addEventListener('click', () => {
        document.getElementById('playerName').value = '';
        document.getElementById('playerClub').value = '';
        document.getElementById('startingPrice').value = '100';
        showNotification('Ready for next player');
    });

    // Copy invite link
    elements.copyLinkBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(elements.inviteLink.textContent)
            .then(() => showNotification('Link copied to clipboard!'))
            .catch(err => showNotification('Failed to copy link'));
    });

    // Share buttons
    document.getElementById('shareWhatsApp').addEventListener('click', () => shareLink('whatsapp'));
    document.getElementById('shareTelegram').addEventListener('click', () => shareLink('telegram'));
    document.getElementById('shareEmail').addEventListener('click', () => shareLink('email'));

    // Touch gestures
    setupTouchGestures();
}

function shareLink(platform) {
    const link = elements.inviteLink.textContent;
    const message = `Join my player card auction: ${link}`;
    
    switch(platform) {
        case 'whatsapp':
            window.open(`https://wa.me/?text=${encodeURIComponent(message)}`);
            break;
        case 'telegram':
            window.open(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent('Join my auction!')}`);
            break;
        case 'email':
            window.open(`mailto:?subject=Join my player card auction&body=${encodeURIComponent(message)}`);
            break;
    }
}

function setupTouchGestures() {
    if (typeof Hammer === 'undefined') return;

    // Bid history swipe
    const bidHistoryEl = elements.bidHistory;
    if (bidHistoryEl) {
        const mc = new Hammer(bidHistoryEl);
        mc.on("swipeleft", () => {
            bidHistoryEl.scrollBy({ left: 100, behavior: 'smooth' });
        });
        mc.on("swiperight", () => {
            bidHistoryEl.scrollBy({ left: -100, behavior: 'smooth' });
        });
    }

    // Bid button tap
    if (elements.placeBidBtn) {
        state.hammer = new Hammer(elements.placeBidBtn, { 
            recognizers: [[Hammer.Tap, { time: 250 }]]
        });
        state.hammer.on('tap', () => {
            if (!elements.placeBidBtn.disabled) {
                elements.placeBidBtn.classList.add('active-tap');
                setTimeout(() => elements.placeBidBtn.classList.remove('active-tap'), 200);
                state.socket.emit('place-bid');
            }
        });
    }
}

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    initializeSocket();
    bindEvents();
});