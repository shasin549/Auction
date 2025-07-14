// WebSocket connection
const socket = io({
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000
});

// Connection status elements
const connectionStatus = document.createElement('div');
connectionStatus.className = 'connection-status hidden';
document.body.appendChild(connectionStatus);

// Connection state management
let isConnected = false;

// Connection event handlers
socket.on('connect', () => {
    console.log('Connected to server');
    isConnected = true;
    updateConnectionStatus('Connected', 'success');
});

socket.on('disconnect', (reason) => {
    console.log('Disconnected:', reason);
    isConnected = false;
    
    if (reason === 'io server disconnect') {
        updateConnectionStatus('Server disconnected - trying to reconnect', 'error');
        socket.connect();
    } else {
        updateConnectionStatus('Disconnected', 'error');
    }
});

socket.on('connect_error', (error) => {
    console.error('Connection error:', error);
    updateConnectionStatus('Connection error - retrying', 'error');
});

socket.on('reconnect', (attempt) => {
    console.log(`Reconnected after ${attempt} attempts`);
    updateConnectionStatus('Reconnected', 'success');
});

socket.on('reconnect_attempt', (attempt) => {
    console.log(`Reconnection attempt ${attempt}`);
    updateConnectionStatus(`Trying to reconnect (attempt ${attempt})`, 'warning');
});

socket.on('reconnect_error', (error) => {
    console.error('Reconnection error:', error);
});

socket.on('reconnect_failed', () => {
    console.error('Reconnection failed');
    updateConnectionStatus('Connection lost - please refresh', 'error');
});

// Update connection status UI
function updateConnectionStatus(message, type) {
    connectionStatus.textContent = message;
    connectionStatus.className = `connection-status ${type}`;
    
    if (type === 'error') {
        connectionStatus.classList.remove('hidden');
    } else {
        setTimeout(() => {
            connectionStatus.classList.add('hidden');
        }, 3000);
    }
}

// WebSocket Event Listeners
socket.on('room-state', (data) => {
    // Update participants
    participants = data.participants;
    updateParticipantList();
    
    // Update current auction if exists
    if (data.currentAuction) {
        updateAuctionDisplay(data.currentAuction);
        updateBidHistory(data.bidHistory);
    }
    
    bidIncrement = data.bidIncrement;
    currentBidIncrement.textContent = bidIncrement;
    bidIncrementValue.textContent = bidIncrement;
});

socket.on('participant-joined', (data) => {
    participants = data.participants;
    updateParticipantList();
    console.log('Participant joined:', data.name);
});

socket.on('participant-left', (data) => {
    participants = data.participants;
    updateParticipantList();
    console.log('Participant left:', data.name);
});

socket.on('auction-started', (data) => {
    auctionActive = true;
    current