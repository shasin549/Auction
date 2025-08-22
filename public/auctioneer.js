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
    
    // Set up invite link
    const inviteLink = document.getElementById('invite-link');
    inviteLink.value = `${window.location.origin}${window.location.pathname.replace('auctioneer.html', '')}bidder.html?code=${roomCode}`;
    
    // Initialize bidding variables
    let currentBid = 15000000;
    let biddingActive = false;
    let bidHistory = [];
    let players = [];
    let currentPlayerIndex = -1;
    
    // Get DOM elements
    const startBiddingBtn = document.getElementById('start-bidding');
    const finalCallBtn = document.getElementById('final-call');
    const nextPlayerBtn = document.getElementById('next-player');
    const backToLobbyBtn = document.getElementById('back-to-lobby');
    const currentBidValue = document.getElementById('current-bid-value');
    const bidHistoryContainer = document.querySelector('.bid-history');
    const addPlayerBtn = document.getElementById('add-player-btn');
    const copyInviteBtn = document.getElementById('copy-invite-btn');
    
    // Add player
    addPlayerBtn.addEventListener('click', () => {
        const playerName = document.getElementById('player-name').value;
        const playerClub = document.getElementById('player-club').value;
        const playerPosition = document.getElementById('player-position').value;
        const playerStyle = document.getElementById('player-style').value;
        const playerValue = document.getElementById('player-value').value;
        const startingBid = document.getElementById('starting-bid').value;
        
        if (!playerName || !startingBid) {
            alert('Please enter at least player name and starting bid');
            return;
        }
        
        const player = {
            name: playerName,
            club: playerClub || 'Free Agent / Unknown',
            position: playerPosition || 'Unknown Position',
            style: playerStyle || 'Standard',
            value: playerValue || startingBid,
            startingBid: startingBid
        };
        
        players.push(player);
        
        // If this is the first player, display them
        if (players.length === 1) {
            currentPlayerIndex = 0;
            displayPlayer(player);
        }
        
        // Clear form
        document.getElementById('player-name').value = '';
        document.getElementById('player-club').value = '';
        document.getElementById('player-position').value = '';
        document.getElementById('player-style').value = '';
        document.getElementById('player-value').value = '';
        document.getElementById('starting-bid').value = '';
        
        alert(`Player ${playerName} added successfully!`);
    });
    
    // Copy invite link
    copyInviteBtn.addEventListener('click', () => {
        inviteLink.select();
        document.execCommand('copy');
        alert('Invite link copied to clipboard!');
    });
    
    // Start bidding
    startBiddingBtn.addEventListener('click', () => {
        if (players.length === 0) {
            alert('Please add at least one player first');
            return;
        }
        
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
        if (players.length === 0) {
            alert('No players available');
            return;
        }
        
        // Move to next player
        currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
        const player = players[currentPlayerIndex];
        
        // Reset bidding
        currentBid = parseInt(player.startingBid);
        currentBidValue.textContent = `$${currentBid.toLocaleString()}`;
        biddingActive = false;
        bidHistory = [];
        bidHistoryContainer.innerHTML = '<div class="bid-item">Bidding not started</div>';
        startBiddingBtn.disabled = false;
        finalCallBtn.disabled = true;
        
        // Display player
        displayPlayer(player);
    });
    
    // Back to lobby
    backToLobbyBtn.addEventListener('click', () => {
        window.location.href = 'index.html';
    });
    
    // Display player function
    function displayPlayer(player) {
        document.getElementById('display-player-name').textContent = player.name;
        document.getElementById('display-player-club').textContent = player.club;
        document.getElementById('display-player-position').textContent = player.position;
        document.getElementById('display-player-style').textContent = player.style;
        document.getElementById('display-starting-bid').textContent = parseInt(player.startingBid).toLocaleString();
        
        currentBid = parseInt(player.startingBid);
        currentBidValue.textContent = `$${currentBid.toLocaleString()}`;
        
        // Update player image
        document.querySelector('.player-image').src = `https://randomuser.me/api/portraits/men/${Math.floor(Math.random() * 50)}.jpg`;
    }
    
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