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
const finalCallBtn = document.getElementById('finalCallBtn');
const nextPlayerBtn = document.getElementById('nextPlayerBtn');

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
        showBidNotification('Connected to auction server');
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
        showBidNotification('Room created successfully!');
    });

    socket.on('room-joined', (data) => {
        roomId = data.roomId;
        currentRole = 'bidder';
        roomTitle.textContent = data.roomName;
        roomCodeDisplay.textContent = data.roomCode;
        updateRoomDisplay(true);
        showBidNotification(`Joined room: ${data.roomName}`);
    });

    socket.on('room-state', (data) => {
        participants = data.participants;
        updateParticipantList();

        if (data.currentAuction) {
            updateAuctionDisplay(data.currentAuction);
            updateBidHistory(data.bidHistory);
            placeBidBtn.disabled = false;
            finalCallBtn.classList.remove('hidden');
        }

        bidIncrement = data.bidIncrement || 10;
        currentBidIncrement.textContent = bidIncrement;
        bidIncrementValue.textContent = `₹${bidIncrement}`;
    });

    socket.on('new-bid', (data) => {
        currentBidAmount.textContent = `₹${data.amount}`;
        leadingBidder.textContent = data.bidderName;
        updateBidHistory(data.bidHistory);
        showBidNotification(`New bid: ₹${data.amount} by ${data.bidderName}`);
    });

    socket.on('auction-started', (data) => {
        updateAuctionDisplay(data);
        placeBidBtn.disabled = false;
        finalCallBtn.classList.remove('hidden');
        showBidNotification(`Auction started for ${data.playerName}`);
    });

    socket.on('auction-ended', (data) => {
        showWinnerDisplay(data);
        placeBidBtn.disabled = true;
        finalCallBtn.classList.add('hidden');
        showBidNotification(`Auction ended! ${data.playerName} sold for ₹${data.winningBid}`);
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
        auctioneerSection.classList.remove('hidden');
        bidderSection.classList.add('hidden');
        document.getElementById('auctioneerControls').classList.remove('hidden');
        document.getElementById('bidderControls').classList.add('hidden');
    } else {
        auctioneerSection.classList.add('hidden');
        bidderSection.classList.remove('hidden');
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
        if (participant.role === 'auctioneer') {
            participantEl.classList.add('auctioneer');
        }
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
    if (!history || history.length === 0) {
        bidHistory.innerHTML = '<div class="no-bids">No bids yet</div>';
        return;
    }

    // Show latest 10 bids
    const recentBids = history.slice(-10).reverse();
    recentBids.forEach(bid => {
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
        const roomName = document.getElementById('roomName').value.trim();
        const maxParticipants = document.getElementById('maxParticipants').value;
        const bidIncrement = document.getElementById('bidIncrement').value;

        if (!roomName) {
            showBidNotification('Please enter a room name');
            return;
        }

        socket.emit('create-room', {
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
        const playerName = document.getElementById('playerName').value.trim();
        const playerClub = document.getElementById('playerClub').value.trim();
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
            startingPrice: parseInt(startingPrice) || 100
        });
    });

    // End auction
    finalCallBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to end the auction?')) {
            socket.emit('end-auction');
        }
    });

    // Next player
    nextPlayerBtn.addEventListener('click', () => {
        // Clear current player fields
        document.getElementById('playerName').value = '';
        document.getElementById('playerClub').value = '';
        document.getElementById('startingPrice').value = '100';
        showBidNotification('Ready for next player');
    });

    // Copy invite link
    copyLinkBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(inviteLink.textContent)
            .then(() => showBidNotification('Link copied to clipboard!'))
            .catch(err => showBidNotification('Failed to copy link'));
    });

    // Share buttons
    document.getElementById('shareWhatsApp').addEventListener('click', () => {
        shareLink('whatsapp');
    });

    document.getElementById('shareTelegram').addEventListener('click', () => {
        shareLink('telegram');
    });

    document.getElementById('shareEmail').addEventListener('click', () => {
        shareLink('email');
    });

    function shareLink(platform) {
        const link = inviteLink.textContent;
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

    // Touch gestures
    const bidHistoryEl = document.getElementById('bidHistory');
    if (bidHistoryEl && typeof Hammer !== 'undefined') {
        const mc = new Hammer(bidHistoryEl);
        mc.on("swipeleft", () => {
            bidHistoryEl.scrollBy({ left: 100, behavior: 'smooth' });
        });
        mc.on("swiperight", () => {
            bidHistoryEl.scrollBy({ left: -100, behavior: 'smooth' });
        });
    }

    if (placeBidBtn && typeof Hammer !== 'undefined') {
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