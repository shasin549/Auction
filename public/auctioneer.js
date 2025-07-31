import { supabase, getCurrentUser, getParticipantProfile, ensureParticipantProfile } from './supabaseClient.js';

// --- Global Variables ---
let currentRoomId = null;
let currentAuctionId = null;
let auctioneerUser = null;
let roomChannel = null; // Supabase Realtime Channel for the room
let participantPresence = null; // Supabase Realtime Presence for participants

// --- UI Elements ---
const logoutBtn = document.getElementById('logoutBtnAuctioneer');
const usernameDisplay = document.getElementById('usernameDisplayAuctioneer');
const roomCodeDisplay = document.getElementById('roomCodeDisplay');
const copyRoomCodeBtn = document.getElementById('copyRoomCodeBtn');
const roomStatusDisplay = document.getElementById('roomStatusDisplay');
const startAuctionBtn = document.getElementById('startAuctionBtn');
const endAuctionBtn = document.getElementById('endAuctionBtn');

const playerAuctionForm = document.getElementById('playerAuctionForm');
const formMessage = document.getElementById('formMessage');

const currentAuctionDetails = document.getElementById('currentAuctionDetails');
const auctionControlButtons = document.getElementById('auctionControlButtons');
const activateAuctionBtn = document.getElementById('activateAuctionBtn');
const finalCallBtn = document.getElementById('finalCallBtn');
const nextPlayerBtn = document.getElementById('nextPlayerBtn');
const auctionStatusMessage = document.getElementById('auctionStatusMessage');

const participantsList = document.getElementById('participantsList');
const playersInQueue = document.getElementById('playersInQueue');

// --- Audio Elements ---
const firstCallAudio = new Audio('audio/first-call.mp3');
const secondCallAudio = new Audio('audio/second-call.mp3');
const finalCallAudio = new Audio('audio/final-call.mp3');

// --- Auth and Room Setup ---
document.addEventListener('DOMContentLoaded', async () => {
    auctioneerUser = await getCurrentUser();
    if (!auctioneerUser) {
        alert('You must be logged in to access the Auctioneer Dashboard.');
        window.location.href = 'index.html'; // Redirect to home
        return;
    }
    await ensureParticipantProfile(auctioneerUser);
    await displayUserInfo();

    // Check if auctioneer already has an active room
    const { data: existingRoom, error: roomError } = await supabase
        .from('rooms')
        .select('*')
        .eq('auctioneer_id', auctioneerUser.id)
        .in('status', ['lobby', 'active'])
        .single();

    if (roomError && roomError.code !== 'PGRST116') { // PGRST116 means no rows found, which is fine
        console.error('Error fetching existing room:', roomError.message);
    }

    if (existingRoom) {
        currentRoomId = existingRoom.id;
        roomCodeDisplay.textContent = existingRoom.room_code;
        updateRoomUI(existingRoom.status);
        console.log(`Rejoining existing room: ${existingRoom.room_code}`);
    } else {
        // Create a new room
        await createNewRoom();
    }

    if (currentRoomId) {
        setupRoomRealtime(currentRoomId);
        fetchPlayersForRoom(currentRoomId);
        setupPlayerAuctionUpdates(currentRoomId);
        setupBidsUpdates(currentRoomId);
        updateCurrentAuctionDisplay(); // Initial display check
    }
});

logoutBtn.addEventListener('click', async () => {
    const { error } = await supabase.auth.signOut();
    if (error) console.error('Logout error:', error.message);
    else {
        // Clear participant's room_id on logout
        await supabase.from('participants').update({ current_room_id: null }).eq('id', auctioneerUser.id);
        if (roomChannel) roomChannel.unsubscribe();
        console.log('Logged out successfully.');
        window.location.href = 'index.html';
    }
});

async function displayUserInfo() {
    const profile = await getParticipantProfile(auctioneerUser.id);
    if (profile && profile.display_name) {
        usernameDisplay.textContent = profile.display_name;
    } else {
        usernameDisplay.textContent = auctioneerUser.email || 'Guest';
    }
    document.getElementById('user-info-auctioneer').style.display = 'inline-flex';
}

async function createNewRoom() {
    // Generate a simple 6-character alphanumeric room code
    const newRoomCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    const { data: room, error } = await supabase
        .from('rooms')
        .insert({ room_code: newRoomCode, auctioneer_id: auctioneerUser.id, status: 'lobby' })
        .select()
        .single();

    if (error) {
        console.error('Error creating room:', error.message);
        alert('Failed to create auction room. Please try again.');
        return;
    }

    currentRoomId = room.id;
    roomCodeDisplay.textContent = room.room_code;
    updateRoomUI(room.status);
    await supabase.from('participants').update({ current_room_id: currentRoomId }).eq('id', auctioneerUser.id);
    console.log(`New room created: ${room.room_code}`);
}

copyRoomCodeBtn.addEventListener('click', () => {
    const roomCode = roomCodeDisplay.textContent;
    if (roomCode && roomCode !== 'Loading...') {
        navigator.clipboard.writeText(roomCode).then(() => {
            alert('Room code copied to clipboard!');
        }).catch(err => {
            console.error('Failed to copy room code:', err);
        });
    }
});

startAuctionBtn.addEventListener('click', async () => {
    if (!currentRoomId) return;
    const { error } = await supabase
        .from('rooms')
        .update({ status: 'active' })
        .eq('id', currentRoomId);
    if (error) console.error('Error starting auction:', error.message);
});

endAuctionBtn.addEventListener('click', async () => {
    if (!currentRoomId) return;
    if (confirm('Are you sure you want to end this auction room? All active auctions will be cancelled.')) {
        const { error } = await supabase
            .from('rooms')
            .update({ status: 'ended' })
            .eq('id', currentRoomId);
        if (error) console.error('Error ending room:', error.message);
        else {
            alert('Room ended. Redirecting to home.');
            window.location.href = 'index.html';
        }
    }
});

function updateRoomUI(status) {
    roomStatusDisplay.textContent = status.charAt(0).toUpperCase() + status.slice(1);
    roomStatusDisplay.className = `status-badge status-${status}`;
    startAuctionBtn.style.display = (status === 'lobby' ? 'block' : 'none');
    endAuctionBtn.style.display = (status === 'active' || status === 'lobby' ? 'block' : 'none');
}


// --- Player Auction Form ---
playerAuctionForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!currentRoomId) {
        alert('Please create or join a room first.');
        return;
    }

    const playerName = document.getElementById('playerName').value;
    const playerClubNationality = document.getElementById('playerClubNationality').value;
    const startPrice = parseFloat(document.getElementById('startPrice').value);
    const imageUrl = document.getElementById('imageUrl').value;
    const bidIncrement = parseFloat(document.getElementById('bidIncrement').value);

    if (!playerName || isNaN(startPrice) || startPrice <= 0 || isNaN(bidIncrement) || bidIncrement <= 0) {
        showMessage(formMessage, 'Please fill all required fields correctly (Player Name, Starting Price, Bid Increment).', 'error');
        return;
    }

    showMessage(formMessage, 'Adding player...', 'info');

    const { error } = await supabase
        .from('player_auctions')
        .insert({
            room_id: currentRoomId,
            player_name: playerName,
            player_club_nationality: playerClubNationality || null,
            start_price: startPrice,
            current_price: startPrice,
            image_url: imageUrl || null,
            auctioneer_id: auctioneerUser.id,
            status: 'pending', // Awaiting auctioneer to start
            current_bid_increment: bidIncrement
        });

    if (error) {
        showMessage(formMessage, `Error adding player: ${error.message}`, 'error');
        console.error('Error adding player:', error);
    } else {
        showMessage(formMessage, 'Player added to queue successfully!', 'success');
        playerAuctionForm.reset();
        // UI update for queue will be handled by realtime subscription
    }
});

// --- Current Auction Control ---
activateAuctionBtn.addEventListener('click', async () => {
    if (!currentAuctionId) {
        showMessage(auctionStatusMessage, 'No player selected or in queue to activate.', 'error');
        return;
    }
    const { error } = await supabase
        .from('player_auctions')
        .update({ status: 'active' })
        .eq('id', currentAuctionId);
    if (error) showMessage(auctionStatusMessage, `Error activating auction: ${error.message}`, 'error');
});

let finalCallStage = 0; // 0: no call, 1: first, 2: second, 3: sold
finalCallBtn.addEventListener('click', async () => {
    if (!currentAuctionId || currentAuctionDetails.querySelector('.placeholder-text')) {
        showMessage(auctionStatusMessage, 'No active auction to make a call for.', 'error');
        return;
    }

    finalCallStage++;
    let newStatus = '';
    let notificationMessage = '';
    let audioToPlay;

    if (finalCallStage === 1) {
        newStatus = 'first_call';
        notificationMessage = 'First Call!';
        audioToPlay = firstCallAudio;
    } else if (finalCallStage === 2) {
        newStatus = 'second_call';
        notificationMessage = 'Second Call!';
        audioToPlay = secondCallAudio;
    } else if (finalCallStage === 3) {
        newStatus = 'sold';
        // Fetch current auction data to get winner_id and winning_bid_amount
        const { data: auction, error } = await supabase
            .from('player_auctions')
            .select('winner_id, winning_bid_amount, player_name')
            .eq('id', currentAuctionId)
            .single();

        if (error || !auction || !auction.winner_id) {
            showMessage(auctionStatusMessage, 'Error: Could not determine winner for sale.', 'error');
            finalCallStage = 0; // Reset stage
            return;
        }

        const { data: winnerProfile, error: winnerProfileError } = await supabase
            .from('participants')
            .select('display_name')
            .eq('id', auction.winner_id)
            .single();

        const winnerName = (winnerProfile && winnerProfile.display_name) ? winnerProfile.display_name : 'An unknown bidder';
        notificationMessage = `Player ${auction.player_name} Sold to ${winnerName} for ₹${parseFloat(auction.winning_bid_amount).toFixed(2)}!`;
        audioToPlay = finalCallAudio;

        // Also insert into won_players table
        const { error: wonPlayerError } = await supabase
            .from('won_players')
            .insert({
                bidder_id: auction.winner_id,
                auction_id: currentAuctionId,
                player_name: auction.player_name,
                winning_bid: auction.winning_bid_amount,
                won_time: new Date().toISOString()
            });
        if (wonPlayerError) {
            console.error('Error recording won player:', wonPlayerError.message);
        }
    } else {
        finalCallStage = 0; // Reset for next auction cycle
        return;
    }

    // Update auction status in DB
    const { error: updateError } = await supabase
        .from('player_auctions')
        .update({ status: newStatus, sold_at: (newStatus === 'sold' ? new Date().toISOString() : null) })
        .eq('id', currentAuctionId);

    if (updateError) {
        showMessage(auctionStatusMessage, `Error updating status to ${newStatus}: ${updateError.message}`, 'error');
        finalCallStage--; // Revert stage on error
    } else {
        showMessage(auctionStatusMessage, `Notification sent: ${notificationMessage}`, 'info');
        audioToPlay.play().catch(e => console.error("Error playing audio:", e));
        // Broadcast notification to all clients
        roomChannel.send({
            type: 'broadcast',
            event: 'auction_notification',
            payload: { message: notificationMessage, status: newStatus }
        });

        if (newStatus === 'sold') {
            currentAuctionId = null; // Mark current auction as complete
            finalCallStage = 0; // Reset for next player
            // Display button to load next player
            nextPlayerBtn.style.display = 'block';
            activateAuctionBtn.style.display = 'none';
            finalCallBtn.style.display = 'none';
            auctionStatusMessage.textContent = 'Player sold. Load next player or add a new one.';
            auctionStatusMessage.className = 'message success';
        }
    }
});

nextPlayerBtn.addEventListener('click', async () => {
    // This will be triggered by a change in player_auctions status to 'pending'
    // or when a new player is loaded.
    // For now, let's just refresh the display based on queue.
    nextPlayerBtn.style.display = 'none'; // Hide until another player is sold
    await updateCurrentAuctionDisplay();
    await fetchPlayersForRoom(currentRoomId); // Refresh queue
});


// --- Realtime Subscriptions ---

// Room status updates
function setupRoomRealtime(roomId) {
    roomChannel = supabase.channel(`room:${roomId}`);

    roomChannel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, payload => {
        console.log('Room status updated:', payload.new.status);
        updateRoomUI(payload.new.status);
    }).subscribe();

    // Presence for Participants
    participantPresence = supabase.channel(`room_presence:${roomId}`, {
        config: { presence: { key: auctioneerUser.id } }
    });

    participantPresence.on('presence', { event: 'sync' }, () => {
        updateParticipantsList();
    });

    participantPresence.on('presence', { event: 'join' }, ({ newPresences }) => {
        newPresences.forEach(presence => console.log(`${presence.display_name} joined the room.`));
        updateParticipantsList();
    });

    participantPresence.on('presence', { event: 'leave' }, ({ leftPresences }) => {
        leftPresences.forEach(presence => console.log(`${presence.display_name} left the room.`));
        updateParticipantsList();
    });

    participantPresence.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
            const { error } = await participantPresence.track({
                id: auctioneerUser.id,
                display_name: usernameDisplay.textContent || auctioneerUser.email,
                online_at: new Date().toISOString(),
                room_id: currentRoomId
            });
            if (error) console.error('Error tracking presence:', error.message);
            else {
                // Also update the current_room_id in the participants table
                const { error: updateError } = await supabase
                    .from('participants')
                    .update({ current_room_id: currentRoomId })
                    .eq('id', auctioneerUser.id);
                if (updateError) console.error('Error updating participant room_id:', updateError.message);
            }
        }
    });
}

async function updateParticipantsList() {
    if (!participantPresence) return;
    const presenceState = participantPresence.presenceState();
    const participants = Object.values(presenceState).flat(); // Flatten the array of arrays
    participantsList.innerHTML = '';
    if (participants.length === 0) {
        participantsList.innerHTML = '<li>No participants online.</li>';
        return;
    }
    const participantIds = participants.map(p => p.id);
    const { data: participantProfiles, error } = await supabase
        .from('participants')
        .select('id, display_name')
        .in('id', participantIds);

    if (error) {
        console.error('Error fetching participant profiles:', error.message);
        return;
    }

    const profileMap = new Map(participantProfiles.map(p => [p.id, p.display_name]));

    participants.forEach(p => {
        const li = document.createElement('li');
        const displayName = profileMap.get(p.id) || p.display_name || 'Anonymous';
        li.classList.add('online-participant');
        li.textContent = displayName;

        // Fetch won players for this participant
        const viewWonPlayersBtn = document.createElement('button');
        viewWonPlayersBtn.textContent = 'View Won Players';
        viewWonPlayersBtn.classList.add('button-small');
        viewWonPlayersBtn.style.marginLeft = '10px';
        viewWonPlayersBtn.addEventListener('click', async () => {
            const { data: wonPlayers, error: wonPlayersError } = await supabase
                .from('won_players')
                .select('player_name, winning_bid')
                .eq('bidder_id', p.id);

            if (wonPlayersError) {
                alert(`Error fetching won players for ${displayName}: ${wonPlayersError.message}`);
                return;
            }

            if (wonPlayers.length === 0) {
                alert(`${displayName} hasn't won any players yet.`);
            } else {
                const playerList = wonPlayers.map(wp => `${wp.player_name} (₹${parseFloat(wp.winning_bid).toFixed(2)})`).join('\n');
                alert(`${displayName} has won:\n${playerList}`);
            }
        });
        li.appendChild(viewWonPlayersBtn);
        participantsList.appendChild(li);
    });
}


// Player auction updates (from auction creation, status changes, bids)
function setupPlayerAuctionUpdates(roomId) {
    supabase
        .channel(`player_auctions_room_${roomId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'player_auctions', filter: `room_id=eq.${roomId}` }, payload => {
            console.log('Player auction change received:', payload);
            fetchPlayersForRoom(roomId); // Refresh queue and active display
            if (payload.new && payload.new.id === currentAuctionId && payload.eventType === 'UPDATE') {
                updateCurrentAuctionDisplay(payload.new); // Update active display with new data
            }
        })
        .subscribe();
}

// Bids updates (for current auction's bid history)
function setupBidsUpdates(roomId) {
    supabase
        .channel(`bids_room_${roomId}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bids', filter: `auction_id=in.(select id from player_auctions where room_id='${roomId}')` }, payload => {
            console.log('New bid in room received:', payload);
            if (currentAuctionId && payload.new.auction_id === currentAuctionId) {
                // Update the current auction's price on display if it was current_auction_id
                // (this is handled by player_auctions update trigger indirectly)
            }
            fetchPlayersForRoom(roomId); // Ensure queue updates if current auction status changes
        })
        .subscribe();
}


// --- Display Functions ---
async function fetchPlayersForRoom(roomId) {
    const { data: players, error } = await supabase
        .from('player_auctions')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true }); // Order by creation to manage queue

    if (error) {
        console.error('Error fetching players:', error.message);
        return;
    }

    const pendingPlayers = players.filter(p => p.status === 'pending');
    const activePlayer = players.find(p => p.status === 'active' || p.status === 'first_call' || p.status === 'second_call');
    const soldPlayers = players.filter(p => p.status === 'sold');

    playersInQueue.innerHTML = '';
    if (pendingPlayers.length === 0) {
        playersInQueue.innerHTML = '<li>No players in queue. Add new players above!</li>';
    } else {
        pendingPlayers.forEach(player => {
            const li = document.createElement('li');
            li.innerHTML = `<span>${player.player_name} (${player.player_club_nationality || 'N/A'}) - ₹${parseFloat(player.start_price).toFixed(2)}</span>
                            <button class="button-small activate-queued-player" data-player-id="${player.id}">Activate</button>`;
            playersInQueue.appendChild(li);
        });
        document.querySelectorAll('.activate-queued-player').forEach(button => {
            button.addEventListener('click', (e) => activateQueuedPlayer(e.target.dataset.playerId));
        });
    }

    if (!activePlayer && pendingPlayers.length > 0) {
        // Automatically set the first pending player as current if no active player
        // Or wait for auctioneer to click "Activate"
    }

    if (activePlayer) {
        currentAuctionId = activePlayer.id;
        updateCurrentAuctionDisplay(activePlayer);
    } else if (soldPlayers.length > 0 && currentAuctionId && soldPlayers.some(p => p.id === currentAuctionId)) {
        // If the last active player was just sold, clear current and prompt for next
        currentAuctionId = null;
        displayNoActiveAuction();
    } else {
        currentAuctionId = null;
        displayNoActiveAuction();
    }
}

async function activateQueuedPlayer(playerId) {
    // First, check if there's already an 'active' or 'call' player
    const { data: activePlayer, error: activeError } = await supabase
        .from('player_auctions')
        .select('id, player_name, status')
        .eq('room_id', currentRoomId)
        .in('status', ['active', 'first_call', 'second_call'])
        .single();

    if (activeError && activeError.code !== 'PGRST116') {
        console.error('Error checking active players:', activeError.message);
        showMessage(auctionStatusMessage, 'Error checking active players.', 'error');
        return;
    }

    if (activePlayer) {
        showMessage(auctionStatusMessage, `Player "${activePlayer.player_name}" is already active (Status: ${activePlayer.status}). Sell them first!`, 'warning');
        return;
    }

    // Now, activate the selected player
    const { error } = await supabase
        .from('player_auctions')
        .update({ status: 'active' })
        .eq('id', playerId)
        .eq('room_id', currentRoomId); // Ensure auctioneer owns this

    if (error) {
        showMessage(auctionStatusMessage, `Error activating player: ${error.message}`, 'error');
        console.error('Error activating player:', error);
    } else {
        showMessage(auctionStatusMessage, 'Player activated! Bidding can now begin.', 'success');
        // UI will update via realtime subscription
    }
}


async function updateCurrentAuctionDisplay(auction = null) {
    let player;
    if (auction) {
        player = auction;
    } else if (currentAuctionId) {
        const { data, error } = await supabase.from('player_auctions').select('*').eq('id', currentAuctionId).single();
        if (error || !data) {
            console.error('Error fetching current auction for display:', error?.message);
            displayNoActiveAuction();
            return;
        }
        player = data;
    } else {
        displayNoActiveAuction();
        return;
    }

    currentAuctionDetails.innerHTML = `
        ${player.image_url ? `<img src="${player.image_url}" alt="${player.player_name}">` : ''}
        <h3>${player.player_name}</h3>
        <p>Club/Nationality: <strong>${player.player_club_nationality || 'N/A'}</strong></p>
        <p>Starting Price: ₹<strong>${parseFloat(player.start_price).toFixed(2)}</strong></p>
        <p class="current-bid">Current Bid: ₹<strong>${parseFloat(player.current_price).toFixed(2)}</strong></p>
        <p>Bid Increment: ₹<strong>${parseFloat(player.current_bid_increment).toFixed(2)}</strong></p>
        <p>Status: <span class="status-badge status-${player.status}">${player.status.replace('_', ' ').toUpperCase()}</span></p>
        <p>Last Bidder: <span id="currentLastBidder">${(player.last_bidder_id ? await getParticipantName(player.last_bidder_id) : 'N/A')}</span></p>
        ${player.status === 'sold' && player.winner_id ? `<p><strong>WINNER:</strong> <span class="price">${await getParticipantName(player.winner_id)} for ₹${parseFloat(player.winning_bid_amount).toFixed(2)}!</span></p>` : ''}
    `;
    currentAuctionDetails.querySelector('.placeholder-text')?.remove(); // Remove if exists

    auctionControlButtons.style.display = 'block';
    nextPlayerBtn.style.display = 'none'; // Initially hide, show only after sold

    if (player.status === 'pending') {
        activateAuctionBtn.style.display = 'block';
        finalCallBtn.style.display = 'none';
        auctionStatusMessage.textContent = 'Player is in queue. Click "Start Bidding" when ready.';
        auctionStatusMessage.className = 'message info';
        finalCallStage = 0; // Reset
    } else if (player.status === 'active') {
        activateAuctionBtn.style.display = 'none';
        finalCallBtn.style.display = 'block';
        finalCallBtn.textContent = 'First Call';
        auctionStatusMessage.textContent = 'Bidding is active.';
        auctionStatusMessage.className = 'message info';
        finalCallStage = 0; // Reset
    } else if (player.status === 'first_call') {
        activateAuctionBtn.style.display = 'none';
        finalCallBtn.style.display = 'block';
        finalCallBtn.textContent = 'Second Call';
        auctionStatusMessage.textContent = 'First call made. Waiting for bids...';
        auctionStatusMessage.className = 'message call';
        finalCallStage = 1; // Set stage
    } else if (player.status === 'second_call') {
        activateAuctionBtn.style.display = 'none';
        finalCallBtn.style.display = 'block';
        finalCallBtn.textContent = 'Sell Player';
        auctionStatusMessage.textContent = 'Second call made. Final chance for bids...';
        auctionStatusMessage.className = 'message call';
        finalCallStage = 2; // Set stage
    } else if (player.status === 'sold' || player.status === 'ended') {
        activateAuctionBtn.style.display = 'none';
        finalCallBtn.style.display = 'none';
        nextPlayerBtn.style.display = 'block';
        auctionStatusMessage.textContent = `Player ${player.player_name} is ${player.status}. Click "Next Player" or add a new one.`;
        auctionStatusMessage.className = `message ${player.status === 'sold' ? 'success' : 'info'}`;
        finalCallStage = 0; // Reset
    }
}

function displayNoActiveAuction() {
    currentAuctionDetails.innerHTML = `<p class="placeholder-text">No player currently active. Add a player above!</p>`;
    auctionControlButtons.style.display = 'none';
    auctionStatusMessage.textContent = '';
    auctionStatusMessage.className = 'message';
}

async function getParticipantName(userId) {
    if (!userId) return 'N/A';
    const profile = await getParticipantProfile(userId);
    return (profile && profile.display_name) ? profile.display_name : 'Unknown Bidder';
}


// --- Utility Functions ---
function showMessage(element, msg, type) {
    element.textContent = msg;
    element.className = `message ${type}`;
    setTimeout(() => {
        element.textContent = '';
        element.className = 'message';
    }, 5000);
}
