// WebSocket connection with reconnection handling
let reconnectAttempts = 0;
let socket;

function setupSocket() {
    socket = io({
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000
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
    // Existing WebSocket Event Listeners
    socket.on('room-state', (data) => {
        participants = data.participants;
        updateParticipantList();

        if (data.currentAuction) {
            updateAuctionDisplay(data.currentAuction);
            updateBidHistory(data.bidHistory);
        }

        bidIncrement = data.bidIncrement;
        currentBidIncrement.textContent = bidIncrement;
        bidIncrementValue.textContent = bidIncrement;
    });

    // ... (keep all other existing socket.on handlers)
}

// Initialize socket
setupSocket();

// Notification System
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

// Touch Gestures
document.addEventListener('DOMContentLoaded', () => {
    // Bid history swipe
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

    // Tap for bid button
    const placeBidBtn = document.getElementById('placeBidBtn');
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

    // Rest of your DOMContentLoaded code...
});

// ... (keep all other existing functions)

