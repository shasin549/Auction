document.addEventListener('DOMContentLoaded', function() {
    // Get URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const participantName = urlParams.get('name') || 'Bidder';
    const roomCode = urlParams.get('code') || 'ABCD123';
    
    // Set participant info
    document.getElementById('bidder-name').textContent = participantName;
    document.getElementById('bidder-room-code').textContent = roomCode;
    
    // Initialize bidding variables
    let currentBid = 15000000;
    let biddingActive = false;
    
    // Get DOM elements
    const bidAmountInput = document.getElementById('bid-amount');
    const placeBidBtn = document.getElementById('place-bid');
    const leaveRoomBtn = document.getElementById('leave-room');
    const currentBidValue = document.getElementById('bidder-current-bid');
    const bidHistoryContainer = document.querySelector('.bid-history');
    
    // Simulate connection to auction room
    simulateAuctionRoom();
    
    // Place bid
    placeBidBtn.addEventListener('click', () => {
        const bidAmount = parseInt(bidAmountInput.value);
        
        if (isNaN(bidAmount) || bidAmount <= currentBid) {
            alert(`Bid must be higher than current bid of $${currentBid.toLocaleString()}`);
            return;
        }
        
        currentBid = bidAmount;
        currentBidValue.textContent = `$${bidAmount.toLocaleString()}`;
        
        addBidHistory(`You bid $${bidAmount.toLocaleString()}`, 'own-bid');
        
        // Update next minimum bid
        bidAmountInput.value = bidAmount + 500000;
        
        // Visual feedback
        placeBidBtn.classList.add('pulse');
        setTimeout(() => {
            placeBidBtn.classList.remove('pulse');
        }, 1500);
    });
    
    // Leave room
    leaveRoomBtn.addEventListener('click', () => {
        window.location.href = 'index.html';
    });
    
    // Simulate auction room activity
    function simulateAuctionRoom() {
        // Simulate bidding starting after a delay
        setTimeout(() => {
            biddingActive = true;
            bidAmountInput.disabled = false;
            placeBidBtn.disabled = false;
            bidAmountInput.value = currentBid + 500000;
            
            addBidHistory('Bidding started!', 'system');
            
            // Simulate other bidders
            simulateOtherBidders();
        }, 3000);
    }
    
    // Simulate other bidders
    function simulateOtherBidders() {
        if (!biddingActive) return;
        
        const bidderNames = ['John', 'Emma', 'Mike', 'Sarah', 'David', 'Lisa'];
        const randomBidder = bidderNames[Math.floor(Math.random() * bidderNames.length)];
        const newBid = currentBid + 500000;
        
        // Only simulate bid if it's not our bid
        if (randomBidder !== participantName) {
            currentBid = newBid;
            currentBidValue.textContent = `$${newBid.toLocaleString()}`;
            
            addBidHistory(`${randomBidder} bid $${newBid.toLocaleString()}`, 'bid');
            
            // Update next minimum bid
            bidAmountInput.value = newBid + 500000;
        }
        
        // Continue simulation if bidding is still active
        if (biddingActive) {
            const delay = 3000 + Math.random() * 4000;
            setTimeout(simulateOtherBidders, delay);
        }
    }
    
    // Add to bid history
    function addBidHistory(message, type) {
        const bidItem = document.createElement('div');
        bidItem.className = `bid-item ${type}`;
        bidItem.textContent = message;
        bidHistoryContainer.appendChild(bidItem);
        bidHistoryContainer.scrollTop = bidHistoryContainer.scrollHeight;
    }
    
    // Initialize player image
    document.querySelector('.player-image').src = `https://randomuser.me/api/portraits/men/${Math.floor(Math.random() * 50)}.jpg`;
});