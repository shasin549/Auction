document.addEventListener('DOMContentLoaded', function() {
    // Get URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const roomName = urlParams.get('room') || 'Premier League Auction';
    const participants = urlParams.get('participants') || 10;
    const bidIncrement = urlParams.get('increment') || 5;
    const roomCode = urlParams.get('code') || Math.random().toString(36).substring(2, 8).toUpperCase();
    
    // Set room info
    document.getElementById('room-name-display').textContent = roomName;
    document.getElementById('room-code-display').textContent = roomCode;
    document.getElementById('participants-count').textContent = participants;
    
    // Initialize bidding variables
    let currentBid = 15000000;
    let biddingActive = false;
    let bidHistory = [];
    
    // Get DOM elements
    const startBiddingBtn = document.getElementById('start-bidding');
    const finalCallBtn = document.getElementById('final-call');
    const nextPlayerBtn = document.getElementById('next-player');
    const backToLobbyBtn = document.getElementById('back-to-lobby');
    const currentBidValue = document.getElementById('current-bid-value');
    const bidHistoryContainer = document.querySelector('.bid-history');
    
    // Start bidding
    startBiddingBtn.addEventListener('click', () => {
        biddingActive = true;
        startBiddingBtn.disabled = true;
        finalCallBtn.disabled = false;
        
        // Add to bid history
        addBidHistory('Bidding started!', 'system');
        
        // Simulate first bid
        setTimeout(() => {
            simulateBid();
        }, 2000);
    });
    
    // Final call
    finalCallBtn.addEventListener('click', () => {
        addBidHistory('Final call! Going once, going twice...', 'system');
        
        // Simulate sold after delay
        setTimeout(() => {
            addBidHistory(`Sold for $${currentBid.toLocaleString()}!`, 'system');
            biddingActive = false;
            finalCallBtn.disabled = true;
        }, 3000);
    });
    
    // Next player
    nextPlayerBtn.addEventListener('click', () => {
        // Reset for next player
        currentBid = 15000000;
        currentBidValue.textContent = `$${currentBid.toLocaleString()}`;
        biddingActive = false;
        bidHistory = [];
        bidHistoryContainer.innerHTML = '<div class="bid-item">Room created - bidding not started</div>';
        startBiddingBtn.disabled = false;
        finalCallBtn.disabled = true;
        
        // Change player (in a real app, this would cycle through a list)
        const players = [
            {name: 'Lionel Messi', club: 'PSG / Argentina', value: '20,000,000'},
            {name: 'Kylian Mbappé', club: 'PSG / France', value: '180,000,000'},
            {name: 'Kevin De Bruyne', club: 'Manchester City / Belgium', value: '120,000,000'}
        ];
        
        const randomPlayer = players[Math.floor(Math.random() * players.length)];
        
        document.querySelector('.player-name').textContent = randomPlayer.name;
        document.querySelectorAll('.player-details')[0].textContent = randomPlayer.club;
        document.querySelector('.player-value').textContent = `Starting Bid: $${randomPlayer.value}`;
        currentBid = parseInt(randomPlayer.value.replace(/,/g, ''));
        currentBidValue.textContent = `$${randomPlayer.value}`;
    });
    
    // Back to lobby
    backToLobbyBtn.addEventListener('click', () => {
        window.location.href = 'index.html';
    });
    
    // Simulate bid from bidders
    function simulateBid() {
        if (!biddingActive) return;
        
        const bidderNames = ['John', 'Emma', 'Mike', 'Sarah', 'David', 'Lisa'];
        const randomBidder = bidderNames[Math.floor(Math.random() * bidderNames.length)];
        const newBid = currentBid + parseInt(bidIncrement) * 1000000;
        
        currentBid = newBid;
        currentBidValue.textContent = `$${newBid.toLocaleString()}`;
        
        addBidHistory(`${randomBidder} bid $${newBid.toLocaleString()}`, 'bid');
        
        // Continue simulation if bidding is still active
        if (biddingActive) {
            const delay = 2000 + Math.random() * 3000;
            setTimeout(simulateBid, delay);
        }
    }
    
    // Add to bid history
    function addBidHistory(message, type) {
        const bidItem = document.createElement('div');
        bidItem.className = `bid-item ${type}`;
        bidItem.textContent = message;
        bidHistoryContainer.appendChild(bidItem);
        bidHistoryContainer.scrollTop = bidHistoryContainer.scrollHeight;
        bidHistory.push(message);
    }
    
    // Initialize player image
    document.querySelector('.player-image').src = `https://randomuser.me/api/portraits/men/${Math.floor(Math.random() * 50)}.jpg`;
});