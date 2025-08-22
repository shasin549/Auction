// Get modals and buttons
const auctioneerModal = document.getElementById('auctioneer-modal');
const bidderModal = document.getElementById('bidder-modal');
const auctioneerBtn = document.getElementById('auctioneer-btn');
const bidderBtn = document.getElementById('bidder-btn');
const createRoomBtn = document.getElementById('create-room-btn');
const joinRoomBtn = document.getElementById('join-room-btn');
const closeButtons = document.querySelectorAll('.close');

// Open modals
auctioneerBtn.addEventListener('click', () => {
    auctioneerModal.style.display = 'block';
});

bidderBtn.addEventListener('click', () => {
    bidderModal.style.display = 'block';
});

// Close modals
closeButtons.forEach(button => {
    button.addEventListener('click', () => {
        auctioneerModal.style.display = 'none';
        bidderModal.style.display = 'none';
    });
});

// Create room
createRoomBtn.addEventListener('click', () => {
    const roomName = document.getElementById('room-name').value || 'Premier League Auction';
    const participants = document.getElementById('participants').value || 10;
    const bidIncrement = document.getElementById('bid-increment').value || 5;
    
    // Generate a random room code
    const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    // Redirect to auctioneer page with parameters
    window.location.href = `auctioneer.html?room=${encodeURIComponent(roomName)}&participants=${participants}&increment=${bidIncrement}&code=${roomCode}`;
});

// Join room
joinRoomBtn.addEventListener('click', () => {
    const participantName = document.getElementById('participant-name').value || 'Bidder';
    const roomCode = document.getElementById('room-code').value;
    
    if (!roomCode) {
        alert('Please enter a room code');
        return;
    }
    
    // Redirect to bidder page with parameters
    window.location.href = `bidder.html?name=${encodeURIComponent(participantName)}&code=${roomCode}`;
});

// Close modal when clicking outside
window.addEventListener('click', (event) => {
    if (event.target === auctioneerModal) {
        auctioneerModal.style.display = 'none';
    }
    if (event.target === bidderModal) {
        bidderModal.style.display = 'none';
    }
});

// Initialize with some demo data
document.addEventListener('DOMContentLoaded', function() {
    // Set default values for demo
    document.getElementById('room-name').value = 'Premier League Auction';
    document.getElementById('participants').value = 10;
    document.getElementById('bid-increment').value = 5;
    document.getElementById('participant-name').value = 'John Doe';
    document.getElementById('room-code').value = 'PL2023';
});