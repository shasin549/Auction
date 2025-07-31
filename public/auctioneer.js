import { supabase, setSupabaseManageToken, getStoredDisplayName, setStoredDisplayName, clearStoredDisplayName, getOrCreateClientId } from './supabaseClient.js';

// --- Global Variables ---
let auctioneerDisplayName = null;
let auctioneerManageToken = null; // The secret token for managing the room
let currentRoomId = null;
let currentRoomCode = null;
let currentAuctionId = null;
let roomChannel = null; // Supabase Realtime Channel for the room
let participantPresence = null; // Supabase Realtime Presence for participants

// --- UI Elements ---
const auctioneerNameDisplay = document.getElementById('auctioneerNameDisplay');
const changeAuctioneerBtn = document.getElementById('changeAuctioneerBtn');

const auctioneerSetupSection = document.getElementById('auctioneer-setup-section');
const auctioneerSetupForm = document.getElementById('auctioneerSetupForm');
const newRoomSetup = document.getElementById('newRoomSetup');
const createNewRoomBtn = document.getElementById('createNewRoomBtn');
const newRoomMessage = document.getElementById('newRoomMessage');
const joinExistingRoom = document.getElementById('joinExistingRoom');
const existingRoomCodeInput = document.getElementById('existingRoomCode');
const manageTokenInput = document.getElementById('manageTokenInput');
const joinRoomAsAuctioneerBtn = document.getElementById('joinRoomAsAuctioneerBtn');
const joinRoomMessage = document.getElementById('joinRoomMessage');
const toggleRoomModeLink = document.getElementById('toggleRoomModeLink');

const auctioneerDashboard = document.getElementById('auctioneer-dashboard');
const roomCodeDisplay = document.getElementById('roomCodeDisplay');
const copyRoomCodeBtn = document.getElementById('copyRoomCodeBtn');
const manageTokenDisplay = document.getElementById('manageTokenDisplay');
const copyManageTokenBtn = document.getElementById('copyManageTokenBtn');
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

// --- Setup Flow ---
document.addEventListener('DOMContentLoaded', async () => {
    auctioneerDisplayName = getStoredDisplayName('auctioneer_display_name');
    auctioneerManageToken = localStorage.getItem('auctioneer_manage_token'); // Get stored token

    if (auctioneerDisplayName) {
        auctioneerNameDisplay.textContent = auctioneerDisplayName;
        if (auctioneerManageToken) {
            // Try to re-establish connection to a room if token is present
            // This is complex without knowing WHICH room. User will have to rejoin.
            // For now, prompt them to join an existing room with their token.
            auctioneerSetupSection.style.display = 'block';
            newRoomSetup.style.display = 'none';
            joinExistingRoom.style.display = 'block';
            toggleRoomModeLink.textContent = 'Need a new room? Create one.';
            manageTokenInput.value = auctioneerManageToken; // Pre-fill token
        } else {
            // Display name but no token - force create new room or join with token
            auctioneerSetupSection.style.display = 'block';
            newRoomSetup.style.display = 'block';
            joinExistingRoom.style.display = 'none';
            toggleRoomModeLink.textContent = 'Already have a room? Join existing.';
        }
    } else {
        // No display name, fresh start
        auctioneerSetupSection.style.display = 'block';
        newRoomSetup.style.display = 'block';
        joinExistingRoom.style.display = 'none';
        toggleRoomModeLink.textContent = 'Already have a room? Join existing.';
    }

    // Set up presence for this client.
    await setupClientPresence();
});

changeAuctioneerBtn.addEventListener('click', () => {
    clearStoredDisplayName('auctioneer_display_name');
    localStorage.removeItem('auctioneer_manage_token'); // Clear token
    window.location.reload(); // Force a full reload to reset everything
});

// Toggle between 'Create New Room' and 'Join Existing Room' forms
toggleRoomModeLink.addEventListener('click', (e) => {
    e.preventDefault();
    const isCreatingNew = newRoomSetup.style.display !== 'none';
    newRoomSetup.style.display = isCreatingNew ? 'none' : 'block';
    joinExistingRoom.style.display = isCreatingNew ? 'block' : 'none';
    toggleRoomModeLink.textContent = isCreatingNew ? 'Need a new room? Create one.' : 'Already have a room? Join existing.';
    newRoomMessage.textContent = '';
    joinRoomMessage.textContent = '';
    auctioneerSetupForm.reset();
});


// --- Room Creation / Joining ---
createNewRoomBtn.addEventListener('click', async () => {
    auctioneerDisplayName = document.getElementById('auctioneerDisplayName').value.trim();
    if (!auctioneerDisplayName) {
        showMessage(newRoomMessage, 'Please enter your display name.', 'error');
        return;
    }
    setStoredDisplayName('auctioneer_display_name', auctioneerDisplayName);
    auctioneerNameDisplay.textContent = auctioneerDisplayName;

    showMessage(newRoomMessage, 'Creating new room...', 'info');

    // Generate a simple 6-character alphanumeric room code
    const newRoomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    // Generate a UUID for the manage token
    const newManageToken = crypto.randomUUID();

    const { data: room, error } = await supabase
        .from('rooms')
        .insert({ room_code: newRoomCode, auctioneer_display_name: auctioneerDisplayName, manage_token: newManageToken, status: 'lobby' })
        .select()
        .single();

    if (error) {
        showMessage(newRoomMessage, `Error creating room: ${error.message}`, 'error');
        console.error('Error creating room:', error);
        return;
    }

    currentRoomId = room.id;
    currentRoomCode = room.room_code;
    auctioneerManageToken = room.manage_token;
    localStorage.setItem('auctioneer_manage_token', auctioneerManageToken); // Store token for future use

    await setupAuctioneerSession(currentRoomId, auctioneerManageToken);
    showMessage(newRoomMessage, 'Room created successfully!', 'success');
    updateDashboardUI(room.status);
    await setupClientPresence(currentRoomId);
    fetchPlayersForRoom(currentRoomId);
    setupPlayerAuctionUpdates(currentRoomId);
    setupBidsUpdates(currentRoomId);
    updateCurrentAuctionDisplay(); // Initial display check
});

joinRoomAsAuctioneerBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    auctioneerDisplayName = document.getElementById('auctioneerDisplayName').value.trim();
    const roomCode = existingRoomCodeInput.value.trim().toUpperCase();
    const manageToken = manageTokenInput.value.trim();

    if (!auctioneerDisplayName || !roomCode || !manageToken) {
        showMessage(joinRoomMessage, 'Please fill all fields.', 'error');
        return;
    }

    setStoredDisplayName('auctioneer_display_name', auctioneerDisplayName);
    auctioneerNameDisplay.textContent = auctioneerDisplayName;

    showMessage(joinRoomMessage, 'Joining room...', 'info');

    // First, verify the room code and manage token
    const { data: room, error } = await supabase
        .from('rooms')
        .select('id, room_code, status')
        .eq('room_code', roomCode)
        .eq('manage_token', manageToken) // Verify token here
        .single();

    if (error || !room) {
        showMessage(joinRoomMessage, 'Invalid Room Code or Manage Token.', 'error');
        console.error('Room join error:', error?.message);
        return;
    }

    currentRoomId = room.id;
    currentRoomCode = room.room_code;
    auctioneerManageToken = manageToken; // Use the provided token

    await setupAuctioneerSession(currentRoomId, auctioneerManageToken);
    showMessage(joinRoomMessage, 'Successfully joined room!', 'success');
    updateDashboardUI(room.status);
    await setupClientPresence(currentRoomId);
    fetchPlayersForRoom(currentRoomId);
    setupPlayerAuctionUpdates(currentRoomId);
    setupBidsUpdates(currentRoomId);
    updateCurrentAuctionDisplay(); // Initial display check
});

// Sets the manage_token in the Supabase session
async function setupAuctioneerSession(roomId, token) {
    try {
        await setSupabaseManageToken(token);
        auctioneerSetupSection.style.display = 'none';
        auctioneerDashboard.style.display = 'grid';
        roomCodeDisplay.textContent = currentRoomCode;
        manageTokenDisplay.textContent = auctioneerManageToken;
        console.log(`Auctioneer session set for room ${roomId} with token ${token}`);
    } catch (e) {
        console.error('Failed to set up auctioneer session:', e.message);
        alert('Failed to set up auctioneer session. Please try again or check console for details.');
        // Optionally, reset UI or log out
    }
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

copyManageTokenBtn.addEventListener('click', () => {
    const manageToken = manageTokenDisplay.textContent;
    if (manageToken && manageToken !== 'Loading...') {
        navigator.clipboard.writeText(manageToken).then(() => {
            alert('Manage Token copied to clipboard! Keep it safe!');
        }).catch(err => {
            console.error('Failed to copy manage token:', err);
        });
    }
});

startAuctionBtn.addEventListener('click', async () => {
    if (!currentRoomId) return;
    try {
        await setSupabaseManageToken(auctioneerManageToken); // Set token before update
        const { error } = await supabase
            .from('rooms')
            .update({ status: 'active' })
            .eq('id', currentRoomId);
        if (error) throw error;
    } catch (error) {
        console.error('Error starting auction:', error.message);
        alert(`Failed to start auction: ${error.message}. Make sure your Manage Token is correct.`);
    } finally {
        await setSupabaseManageToken(null); // Clear token after action
    }
});

endAuctionBtn.addEventListener('click', async () => {
    if (!currentRoomId) return;
    if (confirm('Are you sure you want to end this auction room? All active auctions will be cancelled.')) {
        try {
            await setSupabaseManageToken(auctioneerManageToken); // Set token before update
            const { error } = await supabase
                .from('rooms')
                .update({ status: 'ended' })
                .eq('id', currentRoomId);
            if (error) throw error;
            alert('Room ended.');
            // Clear current room data and reload setup section
            currentRoomId = null;
            currentRoomCode = null;
            localStorage.removeItem('auctioneer_manage_token');
            if (roomChannel) roomChannel.unsubscribe(); // Stop real-time updates for this room
            if (participantPresence) participantPresence.unsubscribe(); // Stop presence tracking
            window.location.reload(); // Simplest way to reset UI
        } catch (error) {
            console.error('Error ending room:', error.message);
            alert(`Failed to end room: ${error.message}. Make sure your Manage Token is correct.`);
        } finally {
            await setSupabaseManageToken(null); // Clear token after action
        }
    }
});

function updateDashboardUI(status) {
    roomStatusDisplay.textContent = status.charAt(0).toUpperCase() + status.slice(1);
    roomStatusDisplay.className = `status-badge status-${status}`;
    startAuctionBtn.style.display = (status === 'lobby' ? 'block' : 'none');
    endAuctionBtn.style.display = (status === 'active' || status === 'lobby' ? 'block' : 'none');
}


// --- Player Auction Form ---
playerAuctionForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!currentRoomId) {
        showMessage(formMessage, 'Please create or join a room first.', 'error');
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

    try {
        await setSupabaseManageToken(auctioneerManageToken); // Set token before update
        const { error } = await supabase
            .from('player_auctions')
            .insert({
                room_id: currentRoomId,
                player_name: playerName,
                player_club_nationality: playerClubNationality || null,
                start_price: startPrice,
                current_price: startPrice,
                image_url: imageUrl || null,
                auctioneer_display_name: auctioneerDisplayName, // Use display name
                status: 'pending', // Awaiting auctioneer to start
                current_bid_increment: bidIncrement
            });

        if (error) throw error;
        showMessage(formMessage, 'Player added to queue successfully!', 'success');
        playerAuctionForm.reset();
    } catch (error) {
        showMessage(formMessage, `Error adding player: ${error.message}`, 'error');
        console.error('Error adding player:', error);
    } finally {
        await setSupabaseManageToken(null); // Clear token after action
    }
});

// --- Current Auction Control ---
activateAuctionBtn.addEventListener('click', async () => {
    if (!currentAuctionId) {
        showMessage(auctionStatusMessage, 'No player selected or in queue to activate.', 'error');
        return;
    }
    try {
        await setSupabaseManageToken(auctioneerManageToken); // Set token before update
        const { error } = await supabase
            .from('player_auctions')
            .update({ status: 'active' })
            .eq('id', currentAuctionId);
        if (error) throw error;
        showMessage(auctionStatusMessage, 'Player activated! Bidding can now begin.', 'success');
    } catch (error) {
        showMessage(auctionStatusMessage, `Error activating auction: ${error.message}`, 'error');
        console.error('Error activating auction:', error);
    } finally {
        await setSupabaseManageToken(null); // Clear token after action
    }
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
    let winnerName = 'N/A';
    let winningBidAmount = null;
    let playerName = 'the player';

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
        // Fetch current auction data to get winner_display_name and winning_bid_amount
        const { data: auction, error } = await supabase
            .from('player_auctions')
            .select('winner_display_name, winning_bid_amount, player_name')
            .eq('id', currentAuctionId)
            .single();

        if (error || !auction || !auction.winner_display_name) {
            showMessage(auctionStatusMessage, 'Error: Could not determine winner for sale. Ensure there are bids.', 'error');
            finalCallStage = 0; // Reset stage
            return;
        }

        winnerName = auction.winner_display_name;
        winningBidAmount = auction.winning_bid_amount;
        playerName = auction.player_name;
        notificationMessage = `Player ${playerName} Sold to ${winnerName} for ₹${parseFloat(winningBidAmount).toFixed(2)}!`;
        audioToPlay = finalCallAudio;

        // Also insert into won_players table
        try {
            // No need to set manage token for won_players as it's public write.
            const { error: wonPlayerError } = await supabase
                .from('won_players')
                .insert({
                    bidder_display_name: winnerName,
                    auction_id: currentAuctionId,
                    player_name: playerName,
                    winning_bid: winningBidAmount,
                    won_time: new Date().toISOString()
                });
            if (wonPlayerError) {
                console.error('Error recording won player:', wonPlayerError.message);
            }
        } catch (e) {
            console.error('Exception recording won player:', e.message);
        }
    } else {
        finalCallStage = 0; // Reset for next auction cycle
        return;
    }

    // Update auction status in DB
    try {
        await setSupabaseManageToken(auctioneerManageToken); // Set token before update
        const { error: updateError } = await supabase
            .from('player_auctions')
            .update({ status: newStatus, sold_at: (newStatus === 'sold' ? new Date().toISOString() : null) })
            .eq('id', currentAuctionId);

        if (updateError) throw updateError;

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
            nextPlayerBtn.style.display = 'block';
            activateAuctionBtn.style.display = 'none';
            finalCallBtn.style.display = 'none';
            auctionStatusMessage.textContent = 'Player sold. Load next player or add a new one.';
            auctionStatusMessage.className = 'message success';
        }
    } catch (error) {
        showMessage(auctionStatusMessage, `Error updating status to ${newStatus}: ${error.message}`, 'error');
        console.error('Auction status update error:', error);
        finalCallStage--; // Revert stage on error
    } finally {
        await setSupabaseManageToken(null); // Clear token after action
    }
});

nextPlayerBtn.addEventListener('click', async () => {
    nextPlayerBtn.style.display = 'none'; // Hide until another player is sold
    await updateCurrentAuctionDisplay();
    await fetchPlayersForRoom(currentRoomId); // Refresh queue
});


// --- Realtime Subscriptions ---

// Supabase Realtime Channels (requires manage_token to be set for RLS-protected actions)
function setupRoomRealtime(roomId) {
    if (roomChannel) {
        roomChannel.unsubscribe(); // Unsubscribe from previous room if any
    }
    roomChannel = supabase.channel(`room:${roomId}`);

    roomChannel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, payload => {
        console.log('Room status updated:', payload.new.status);
        updateDashboardUI(payload.new.status);
    }).subscribe();
}

async function setupClientPresence(roomId = null) {
    const clientId = getOrCreateClientId();
    const displayName = auctioneerDisplayName || "Auctioneer"; // Fallback name for presence if not set yet

    if (participantPresence) {
        await participantPresence.unsubscribe(); // Unsubscribe from previous presence channel
    }

    participantPresence = supabase.channel(`room_presence:${roomId}`, {
        config: { presence: { key: clientId } }
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
                id: clientId, // Use client-generated ID
                display_name: displayName,
                online_at: new Date().toISOString(),
                room_id: roomId // Send room_id for RLS and display
            });
            if (error) console.error('Error tracking presence:', error.message);
            else {
                // Update the current_room_id in the participants table (optional for this non-auth setup, primarily for tracking)
                const { data: existingParticipant, error: fetchError } = await supabase
                    .from('participants')
                    .select('id')
                    .eq('id', clientId)
                    .single();

                if (fetchError && fetchError.code === 'PGRST116') { // No existing participant
                    const { error: insertError } = await supabase
                        .from('participants')
                        .insert({ id: clientId, display_name: displayName, current_room_id: roomId });
                    if (insertError) console.error('Error inserting new participant:', insertError.message);
                } else if (!fetchError) { // Existing participant
                    const { error: updateError } = await supabase
                        .from('participants')
                        .update({ display_name: displayName, current_room_id: roomId, last_online: new Date().toISOString() })
                        .eq('id', clientId);
                    if (updateError) console.error('Error updating participant room_id:', updateError.message);
                } else {
                    console.error('Error checking participant existence:', fetchError.message);
                }
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

    // Filter participants to only those explicitly associated with the current room
    const filteredParticipants = participants.filter(p => p.room_id === currentRoomId);

    if (filteredParticipants.length === 0) {
        participantsList.innerHTML = '<li>No participants in this room.</li>';
        return;
    }

    filteredParticipants.forEach(p => {
        const li = document.createElement('li');
        li.classList.add('online-participant');
        li.textContent = p.display_name || 'Anonymous'; // Use display_name from presence directly

        // Fetch won players for this participant's display name
        const viewWonPlayersBtn = document.createElement('button');
        viewWonPlayersBtn.textContent = 'View Won Players';
        viewWonPlayersBtn.classList.add('button-small');
        viewWonPlayersBtn.style.marginLeft = '10px';
        viewWonPlayersBtn.addEventListener('click', async () => {
            const { data: wonPlayers, error: wonPlayersError } = await supabase
                .from('won_players')
                .select('player_name, winning_bid')
                .eq('bidder_display_name', p.display_name); // Query by display name

            if (wonPlayersError) {
                alert(`Error fetching won players for ${p.display_name}: ${wonPlayersError.message}`);
                return;
            }

            if (wonPlayers.length === 0) {
                alert(`${p.display_name} hasn't won any players yet.`);
            } else {
                const playerList = wonPlayers.map(wp => `${wp.player_name} (₹${parseFloat(wp.winning_bid).toFixed(2)})`).join('\n');
                alert(`${p.display_name} has won:\n${playerList}`);
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
            // The auction_id filter is only for the channel. We still need to check if it's the current auction
            // updateCurrentAuctionDisplay handles updating current price indirectly via player_auctions update.
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
    try {
        await setSupabaseManageToken(auctioneerManageToken); // Set token before update
        const { error } = await supabase
            .from('player_auctions')
            .update({ status: 'active' })
            .eq('id', playerId)
            .eq('room_id', currentRoomId); // Ensure auctioneer owns this

        if (error) throw error;
        showMessage(auctionStatusMessage, 'Player activated! Bidding can now begin.', 'success');
    } catch (error) {
        showMessage(auctionStatusMessage, `Error activating player: ${error.message}`, 'error');
        console.error('Error activating player:', error);
    } finally {
        await setSupabaseManageToken(null); // Clear token after action
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
        <p>Last Bidder: <span id="currentLastBidder">${(player.last_bidder_display_name || 'N/A')}</span></p>
        ${player.status === 'sold' && player.winner_display_name ? `<p><strong>WINNER:</strong> <span class="price">${player.winner_display_name} for ₹${parseFloat(player.winning_bid_amount).toFixed(2)}!</span></p>` : ''}
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

// --- Utility Functions ---
function showMessage(element, msg, type) {
    element.textContent = msg;
    element.className = `message ${type}`;
    setTimeout(() => {
        element.textContent = '';
        element.className = 'message';
    }, 5000);
}
