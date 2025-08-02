// This file contains the logic for the Auctioneer's page.

document.addEventListener('DOMContentLoaded', () => {
    const roomCode = sessionStorage.getItem('roomCode');
    const userName = sessionStorage.getItem('userName');
    let currentAuctionId = null;
    let currentBidIncrement = 0;
    let playersInQueue = [];

    // UI Elements
    const roomCodeDisplay = document.getElementById('room-code-display');
    const copyRoomCodeBtn = document.getElementById('copy-room-code-btn');
    const addPlayerForm = document.getElementById('add-player-form');
    const playerQueueList = document.getElementById('player-queue-list');
    const playerCardContent = document.getElementById('player-card-content');
    const noAuctionMessage = document.getElementById('player-card');
    const playerNameDisplay = document.getElementById('player-name-display');
    const playerClubDisplay = document.getElementById('player-club-display');
    const playerPositionDisplay = document.getElementById('player-position-display');
    const playerImage = document.getElementById('player-image');
    const currentBidDisplay = document.getElementById('current-bid-display');
    const topBidderDisplay = document.getElementById('top-bidder-display');
    const finalCallBtn = document.getElementById('final-call-btn');
    const nextPlayerBtn = document.getElementById('next-player-btn');
    const participantsList = document.getElementById('participants-list');
    const participantsCount = document.getElementById('participants-count');
    const modalWinningList = document.getElementById('modal-winning-list');

    // Make sure we have a room code
    if (!roomCode) {
        showToast('No room code found. Redirecting...', 'error');
        setTimeout(() => window.location.href = 'index.html', 2000);
        return;
    }
    
    // Wait for authentication before proceeding
    const checkAuth = setInterval(() => {
        if (isAuthReady) {
            clearInterval(checkAuth);
            initializeAuctioneerPage();
        }
    }, 100);

    async function initializeAuctioneerPage() {
        if (!userId) {
            console.error("User ID is not available.");
            return;
        }

        roomCodeDisplay.textContent = `Room Code: ${roomCode}`;

        // Listen for room data changes (participants list and bid increment)
        db.collection(`artifacts/${appId}/public/data/rooms`).doc(roomCode)
          .onSnapshot(doc => {
            if (doc.exists) {
                const roomData = doc.data();
                currentBidIncrement = roomData.bidIncrement;

                // Update participants list
                const participants = roomData.participants || [];
                participantsCount.textContent = participants.length;
                participantsList.innerHTML = '';
                participants.forEach(participant => {
                    const li = document.createElement('li');
                    li.className = 'flex justify-between items-center bg-gray-700 p-3 rounded-lg shadow';
                    li.innerHTML = `
                        <span>${participant.name}</span>
                        <button class="view-wins-btn text-sm text-blue-400 hover:text-blue-300" data-user-id="${participant.id}" data-user-name="${participant.name}">View Wins</button>
                    `;
                    participantsList.appendChild(li);
                });
            }
        }, error => {
            console.error("Error fetching room data:", error);
        });
        
        // Listen for player queue changes
        db.collection(`artifacts/${appId}/public/data/players`).where('roomId', '==', roomCode).orderBy('timestamp', 'asc')
            .onSnapshot(snapshot => {
                playersInQueue = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                updatePlayerQueueUI();
                
                // If there's no current auction, start one with the first player in the queue.
                if (!currentAuctionId && playersInQueue.length > 0) {
                    startNextAuction(playersInQueue[0]);
                }
            }, error => {
                console.error("Error fetching player queue:", error);
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
                    currentAuctionId = null;
                    noAuctionMessage.style.display = 'block';
                    playerCardContent.style.display = 'none';
                    nextPlayerBtn.style.display = 'none';
                    finalCallBtn.style.display = 'none';
                }
            }, error => {
                console.error("Error fetching active auction:", error);
            });
    }

    // Event Listeners
    copyRoomCodeBtn.addEventListener('click', () => {
        const roomCodeText = roomCodeDisplay.textContent.replace('Room Code: ', '');
        navigator.clipboard.writeText(roomCodeText)
            .then(() => showToast('Room code copied to clipboard!', 'success'))
            .catch(err => console.error('Could not copy text: ', err));
    });

    addPlayerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const playerName = document.getElementById('player-name').value;
        const playerClub = document.getElementById('player-club').value;
        const playerPrice = parseFloat(document.getElementById('player-price').value);
        const playerPosition = document.getElementById('player-position').value;
        
        try {
            await db.collection(`artifacts/${appId}/public/data/players`).add({
                name: playerName,
                club: playerClub,
                position: playerPosition,
                startingPrice: playerPrice,
                roomId: roomCode,
                image_url: `https://placehold.co/120x120/4b5563/ffffff?text=${playerName.substring(0, 3)}`,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            showToast(`Player '${playerName}' added to the queue!`, 'success');
            addPlayerForm.reset();
        } catch (error) {
            console.error("Error adding player:", error);
            showToast('Failed to add player.', 'error');
        }
    });

    finalCallBtn.addEventListener('click', async () => {
        const callCount = parseInt(finalCallBtn.dataset.call, 10);
        if (callCount < 3) {
            const nextCall = callCount + 1;
            finalCallBtn.dataset.call = nextCall;
            finalCallBtn.textContent = `Final Call: ${nextCall}`;
            
            showToast(`'${playerNameDisplay.textContent}' - Call #${nextCall}!`, 'warning');
            
            await db.collection(`artifacts/${appId}/public/data/auctions`).doc(currentAuctionId).update({
                lastCall: nextCall
            });
        } else {
            // Player Sold
            await sellPlayer();
        }
    });
    
    nextPlayerBtn.addEventListener('click', () => {
        const nextPlayer = playersInQueue[0];
        if (nextPlayer) {
            startNextAuction(nextPlayer);
        } else {
            showToast('No more players in the queue.', 'info');
        }
    });
    
    participantsList.addEventListener('click', async (e) => {
        if (e.target.classList.contains('view-wins-btn')) {
            const userId = e.target.dataset.userId;
            const userName = e.target.dataset.userName;
            await showWinningListModal(userId, userName);
        }
    });

    // Helper functions
    function updatePlayerQueueUI() {
        document.getElementById('queue-count').textContent = playersInQueue.length;
        playerQueueList.innerHTML = '';
        playersInQueue.forEach(player => {
            const li = document.createElement('li');
            li.className = 'bg-gray-700 p-3 rounded-lg shadow';
            li.textContent = `${player.name} (${player.club})`;
            playerQueueList.appendChild(li);
        });
    }

    async function updateLiveAuctionUI(auctionData) {
        if (auctionData.status === 'active') {
            noAuctionMessage.style.display = 'none';
            playerCardContent.style.display = 'block';
            nextPlayerBtn.style.display = 'none';
            finalCallBtn.style.display = 'block';
            
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
            
            // Update Final Call Button state
            const call = auctionData.lastCall;
            finalCallBtn.dataset.call = call;
            if (call === 0) finalCallBtn.textContent = "First Call";
            if (call === 1) finalCallBtn.textContent = "Second Call";
            if (call === 2) finalCallBtn.textContent = "Final Call";
        } else if (auctionData.status === 'sold') {
            const winnerName = auctionData.winnerName;
            const winningBid = auctionData.winningBid;
            
            finalCallBtn.style.display = 'none';
            nextPlayerBtn.style.display = 'block';
            
            const playerDoc = await db.collection(`artifacts/${appId}/public/data/players`).doc(auctionData.playerId).get();
            const playerData = playerDoc.data();
            
            showToast(`${playerData.name} sold to ${winnerName} for $${winningBid}!`, 'success');
        }
    }
    
    async function startNextAuction(player) {
        const auctionsCollection = db.collection(`artifacts/${appId}/public/data/auctions`);
        
        try {
            await auctionsCollection.add({
                roomId: roomCode,
                playerId: player.id,
                currentBid: player.startingPrice,
                currentBidderId: null,
                lastCall: 0,
                status: 'active',
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            // Remove player from the queue
            await db.collection(`artifacts/${appId}/public/data/players`).doc(player.id).delete();
        } catch (error) {
            console.error("Error starting new auction:", error);
            showToast('Failed to start a new auction.', 'error');
        }
    }
    
    async function sellPlayer() {
        const auctionRef = db.collection(`artifacts/${appId}/public/data/auctions`).doc(currentAuctionId);
        const auctionDoc = await auctionRef.get();
        const auctionData = auctionDoc.data();
        
        const winningBid = auctionData.currentBid;
        const winnerId = auctionData.currentBidderId;
        
        if (!winnerId) {
            showToast('No bids were placed. Player not sold.', 'warning');
            await auctionRef.update({ status: 'closed', winnerId: null, winningBid: 0 });
            return;
        }

        const roomDoc = await db.collection(`artifacts/${appId}/public/data/rooms`).doc(roomCode).get();
        const winnerName = roomDoc.data().participants.find(p => p.id === winnerId).name;

        // Update auction status to sold and record winner
        await auctionRef.update({
            status: 'sold',
            winnerId: winnerId,
            winningBid: winningBid,
            winnerName: winnerName
        });
        
        // Add player to the winner's private collection
        await db.collection(`artifacts/${appId}/users/${winnerId}/winningPlayers`).add({
            playerId: auctionData.playerId,
            winningBid: winningBid,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
    }

    async function showWinningListModal(targetUserId, targetUserName) {
        const winningPlayersRef = db.collection(`artifacts/${appId}/users/${targetUserId}/winningPlayers`).orderBy('timestamp', 'desc');
        const winningPlayersSnapshot = await winningPlayersRef.get();
        
        const modalTitle = document.getElementById('modal-winning-list-title');
        const modalList = document.getElementById('modal-winning-list-items');
        
        modalTitle.textContent = `${targetUserName}'s Winning List`;
        modalList.innerHTML = '';
        
        if (winningPlayersSnapshot.empty) {
            modalList.innerHTML = '<li class="text-gray-400">No players won yet.</li>';
        } else {
            for (const doc of winningPlayersSnapshot.docs) {
                const winData = doc.data();
                const playerDoc = await db.collection(`artifacts/${appId}/public/data/players`).doc(winData.playerId).get();
                const playerData = playerDoc.data();
                
                const li = document.createElement('li');
                li.className = 'bg-gray-700 p-3 rounded-lg shadow flex items-center space-x-3';
                li.innerHTML = `
                    <img src="${playerData.image_url}" alt="Player" class="w-10 h-10 rounded-full">
                    <div>
                        <p class="font-bold">${playerData.name}</p>
                        <p class="text-sm text-gray-400">Won for $${winData.winningBid}</p>
                    </div>
                `;
                modalList.appendChild(li);
            }
        }
        
        openModal('modal-winning-list', null);
    }
});

