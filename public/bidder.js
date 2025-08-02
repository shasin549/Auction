// This file contains the logic for the Bidder's page.

document.addEventListener('DOMContentLoaded', () => {
    const roomCode = sessionStorage.getItem('roomCode');
    const userName = sessionStorage.getItem('userName');
    
    let currentAuctionId = null;
    let currentBidIncrement = 0;
    let myLastBid = 0;
    let isMyTurnToBid = true;

    // UI Elements
    const roomCodeDisplay = document.getElementById('room-code-display');
    const userIdDisplay = document.getElementById('user-id-display');
    const playerCardContent = document.getElementById('player-card-content');
    const noAuctionMessage = document.getElementById('no-auction-message');
    const playerNameDisplay = document.getElementById('player-name-display');
    const playerClubDisplay = document.getElementById('player-club-display');
    const playerPositionDisplay = document.getElementById('player-position-display');
    const playerImage = document.getElementById('player-image');
    const currentBidDisplay = document.getElementById('current-bid-display');
    const topBidderDisplay = document.getElementById('top-bidder-display');
    const placeBidBtn = document.getElementById('place-bid-btn');
    const winningList = document.getElementById('winning-list');
    const noWinsMessage = document.getElementById('no-wins-message');
    
    // Confetti
    const confettiSettings = { target: 'confetti-canvas' };
    const confetti = new ConfettiGenerator(confettiSettings);

    if (!roomCode) {
        showToast('No room code found. Redirecting...', 'error');
        setTimeout(() => window.location.href = 'index.html', 2000);
        return;
    }

    // Wait for authentication before proceeding
    const checkAuth = setInterval(() => {
        if (isAuthReady) {
            clearInterval(checkAuth);
            initializeBidderPage();
        }
    }, 100);

    async function initializeBidderPage() {
        if (!userId) {
            console.error("User ID is not available.");
            return;
        }

        roomCodeDisplay.textContent = `Room Code: ${roomCode}`;
        userIdDisplay.textContent = `Your ID: ${userId}`;
        userIdDisplay.style.display = 'block';

        // Listen for room data changes (to get bid increment)
        db.collection(`artifacts/${appId}/public/data/rooms`).doc(roomCode)
          .onSnapshot(doc => {
            if (doc.exists) {
                const roomData = doc.data();
                currentBidIncrement = roomData.bidIncrement;
            }
        }, error => {
            console.error("Error fetching room data:", error);
        });
        
        // Listen for active auction changes
        db.collection(`artifacts/${appId}/public/data/auctions`).where('roomId', '==', roomCode).where('status', '==', 'active')
            .onSnapshot(snapshot => {
                if (!snapshot.empty) {
                    const auctionDoc = snapshot.docs[0];
                    const auctionData = auctionDoc.data();
                    currentAuctionId = auctionDoc.id;
                    updateLiveAuctionUI(auctionData);
                } else {
                    noAuctionMessage.style.display = 'block';
                    playerCardContent.style.display = 'none';
                    placeBidBtn.disabled = true;
                }
            }, error => {
                console.error("Error fetching active auction:", error);
            });

        // Listen for sold auction changes (for winning notifications)
        db.collection(`artifacts/${appId}/public/data/auctions`).where('roomId', '==', roomCode)
            .where('status', '==', 'sold').onSnapshot(async (snapshot) => {
                for (const change of snapshot.docChanges()) {
                    if (change.type === 'added') {
                        const auctionData = change.doc.data();
                        
                        // Check if the current user is the winner
                        if (auctionData.winnerId === userId) {
                            showToast(`You won "${auctionData.winnerName}" for $${auctionData.winningBid}!`, 'success');
                            confetti.render();
                            setTimeout(() => confetti.clear(), 5000);
                        } else {
                            showToast(`${auctionData.winnerName} won the auction for $${auctionData.winningBid}!`, 'info');
                        }
                    }
                }
            }, error => {
                console.error("Error fetching sold auctions:", error);
            });
            
        // Listen for changes in the user's winning list
        db.collection(`artifacts/${appId}/users/${userId}/winningPlayers`).orderBy('timestamp', 'desc')
            .onSnapshot(async (snapshot) => {
                if (snapshot.empty) {
                    winningList.style.display = 'block';
                    noWinsMessage.style.display = 'block';
                } else {
                    winningList.innerHTML = '';
                    noWinsMessage.style.display = 'none';
                    
                    for (const doc of snapshot.docs) {
                        const winData = doc.data();
                        const playerDoc = await db.collection(`artifacts/${appId}/public/data/players`).doc(winData.playerId).get();
                        const playerData = playerDoc.data();
                        
                        if (playerData) {
                            const li = document.createElement('li');
                            li.className = 'bg-gray-700 p-3 rounded-lg shadow flex items-center space-x-3';
                            li.innerHTML = `
                                <img src="${playerData.image_url}" alt="Player" class="w-10 h-10 rounded-full">
                                <div>
                                    <p class="font-bold">${playerData.name}</p>
                                    <p class="text-sm text-gray-400">Won for $${winData.winningBid}</p>
                                </div>
                            `;
                            winningList.appendChild(li);
                        }
                    }
                }
            }, error => {
                console.error("Error fetching winning list:", error);
            });
    }

    // Event Listeners
    placeBidBtn.addEventListener('click', async () => {
        if (!isMyTurnToBid || !currentAuctionId) {
            showToast('Please wait for another bidder to place a bid.', 'warning');
            return;
        }

        try {
            const auctionRef = db.collection(`artifacts/${appId}/public/data/auctions`).doc(currentAuctionId);
            const auctionDoc = await auctionRef.get();
            const auctionData = auctionDoc.data();
            
            const newBidAmount = (auctionData.currentBid || 0) + currentBidIncrement;
            
            // Check if another bidder placed a bid in the meantime
            if (auctionData.currentBidderId === userId) {
                 showToast('You are already the top bidder.', 'warning');
                 return;
            }
            
            await auctionRef.update({
                currentBid: newBidAmount,
                currentBidderId: userId
            });
            
            myLastBid = newBidAmount;
            isMyTurnToBid = false;
            placeBidBtn.disabled = true;
            
            showToast(`You placed a bid of $${newBidAmount}!`, 'success');
        } catch (error) {
            console.error("Error placing bid:", error);
            showToast('Failed to place bid. Please try again.', 'error');
        }
    });

    // Helper functions
    async function updateLiveAuctionUI(auctionData) {
        noAuctionMessage.style.display = 'none';
        playerCardContent.style.display = 'block';
        
        const playerDoc = await db.collection(`artifacts/${appId}/public/data/players`).doc(auctionData.playerId).get();
        const playerData = playerDoc.data();
        
        playerNameDisplay.textContent = playerData.name;
        playerClubDisplay.textContent = playerData.club;
        playerPositionDisplay.textContent = playerData.position;
        playerImage.src = playerData.image_url;
        currentBidDisplay.textContent = `$${auctionData.currentBid || playerData.startingPrice}`;
        
        if (auctionData.currentBidderId) {
             const roomDoc = await db.collection(`artifacts/${appId}/public/data/rooms`).doc(roomCode).get();
             const participant = roomDoc.data().participants.find(p => p.id === auctionData.currentBidderId);
             topBidderDisplay.textContent = `Top Bidder: ${participant ? participant.name : 'Unknown'}`;
        } else {
             topBidderDisplay.textContent = 'Top Bidder: No bids yet';
        }

        // Handle the "one bidder at a time" logic
        if (auctionData.currentBidderId === userId) {
            isMyTurnToBid = false;
            placeBidBtn.disabled = true;
            placeBidBtn.textContent = 'You are the top bidder!';
        } else {
            isMyTurnToBid = true;
            placeBidBtn.disabled = false;
            placeBidBtn.textContent = 'Place Bid';
            
            // Update bid button text based on the next bid
            const nextBid = (auctionData.currentBid || 0) + currentBidIncrement;
            placeBidBtn.textContent = `Bid $${nextBid}`;
        }
        
        // Handle call notifications
        switch (auctionData.lastCall) {
            case 1:
                showToast(`First Call for ${playerData.name}!`, 'warning');
                break;
            case 2:
                showToast(`Second Call for ${playerData.name}!`, 'warning');
                break;
            case 3:
                showToast(`Final Call for ${playerData.name}!`, 'warning');
                break;
            default:
                break;
        }
    }
});

