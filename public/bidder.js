import { supabase, getOrCreateClientId, getStoredDisplayName, setStoredDisplayName, clearStoredDisplayName } from './supabaseClient.js';

// --- Global Variables ---
let bidderDisplayName = null;
let bidderClientId = null; // Client-generated ID for presence
let currentRoomId = null;
let currentAuction = null; // Stores details of the player currently being auctioned
let roomChannel = null; // Supabase Realtime Channel for the room
let participantPresence = null; // Supabase Realtime Presence for participants
let lastBidderDisplayName = null; // Tracks the last person to bid on the current auction by their display name

// --- UI Elements ---
const bidderNameDisplay = document.getElementById('bidderNameDisplay');
const changeBidderBtn = document.getElementById('changeBidderBtn');

const bidderSetupSection = document.getElementById('bidder-setup-section');
const bidderSetupForm = document.getElementById('bidderSetupForm');
const bidderDisplayNameInput = document.getElementById('bidderDisplayName');
const bidderSetupMessage = document.getElementById('bidderSetupMessage');

const joinRoomSection = document.getElementById('join-room-section');
const joinRoomForm = document.getElementById('joinRoomForm');
const roomCodeInput = document.getElementById('roomCodeInput');
const joinRoomMessage = document.getElementById('joinRoomMessage');

const auctionDetailsSection = document.getElementById('auction-details-section');
const auctionPlayerName = document.getElementById('auctionPlayerName');
const auctionPlayerImage = document.getElementById('auctionPlayerImage');
const auctionPlayerClub = document.getElementById('auctionPlayerClub');
const auctionPlayerStartPrice = document.getElementById('auctionPlayerStartPrice');
const auctionCurrentPrice = document.getElementById('auctionCurrentPrice');
const auctionLastBidder = document.getElementById('auctionLastBidder');
const nextBidAmountDisplay = document.getElementById('nextBidAmountDisplay');
const bidAmountInput = document.getElementById('bidAmountInput');
const placeBidBtn = document.getElementById('placeBidBtn');
const bidMessage = document.getElementById('bidMessage');
const bidHistoryList = document.getElementById('bidHistoryList');

const wonPlayersSection = document.getElementById('won-players-section');
const wonPlayersDisplayName = document.getElementById('wonPlayersDisplayName');
const wonPlayersList = document.getElementById('wonPlayersList');


// --- Auth and Room Join Setup ---
document.addEventListener('DOMContentLoaded', async () => {
    bidderClientId = getOrCreateClientId(); // Get or create unique ID for this client
    bidderDisplayName = getStoredDisplayName('bidder_display_name');

    if (bidderDisplayName) {
        bidderNameDisplay.textContent = bidderDisplayName;
        wonPlayersDisplayName.textContent = bidderDisplayName;
        bidderSetupSection.style.display = 'none';
        joinRoomSection.style.display = 'block';
        wonPlayersSection.style.display = 'block';
        await setupClientPresence(); // Set up presence with display name
        fetchWonPlayers(bidderDisplayName); // Fetch won players for this display name
    } else {
        bidderSetupSection.style.display = 'block';
        joinRoomSection.style.display = 'none';
        auctionDetailsSection.style.display = 'none';
        wonPlayersSection.style.display = 'none';
    }
});

changeBidderBtn.addEventListener('click', () => {
    clearStoredDisplayName('bidder_display_name');
    window.location.reload(); // Force a full reload to reset everything
});

bidderSetupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const displayName = bidderDisplayNameInput.value.trim();
    if (!displayName) {
        showMessage(bidderSetupMessage, 'Please enter your display name.', 'error');
        return;
    }
    bidderDisplayName = displayName;
    setStoredDisplayName('bidder_display_name', bidderDisplayName);
    bidderNameDisplay.textContent = bidderDisplayName;
    wonPlayersDisplayName.textContent = bidderDisplayName;

    showMessage(bidderSetupMessage, 'Display name set!', 'success');
    bidderSetupSection.style.display = 'none';
    joinRoomSection.style.display = 'block';
    wonPlayersSection.style.display = 'block';
    await setupClientPresence();
    fetchWonPlayers(bidderDisplayName);
});


// --- Join Room Logic ---
joinRoomForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const roomCode = roomCodeInput.value.trim().toUpperCase();
    if (!roomCode) {
        showMessage(joinRoomMessage, 'Please enter a room code.', 'error');
        return;
    }
    await joinRoom(roomCode);
});

async function joinRoom(roomCode) {
    if (!bidderDisplayName) {
        showMessage(joinRoomMessage, 'Please set your display name first.', 'error');
        return;
    }

    showMessage(joinRoomMessage, 'Joining room...', 'info');
    const { data: room, error } = await supabase
        .from('rooms')
        .select('id, status')
        .eq('room_code', roomCode)
        .single();

    if (error || !room || room.status === 'ended') {
        showMessage(joinRoomMessage, 'Invalid or ended room code.', 'error');
        console.error('Room join error:', error?.message || 'Room not found or ended.');
        return;
    }

    currentRoomId = room.id;
    // Update participant's current_room_id for presence
    const { data: existingParticipant, error: fetchError } = await supabase
        .from('participants')
        .select('id')
        .eq('id', bidderClientId)
        .single();

    if (fetchError && fetchError.code === 'PGRST116') { // No existing participant
        const { error: insertError } = await supabase
            .from('participants')
            .insert({ id: bidderClientId, display_name: bidderDisplayName, current_room_id: currentRoomId });
        if (insertError) console.error('Error inserting new participant for join:', insertError.message);
    } else if (!fetchError) { // Existing participant
        const { error: updateError } = await supabase
            .from('participants')
            .update({ display_name: bidderDisplayName, current_room_id: currentRoomId, last_online: new Date().toISOString() })
            .eq('id', bidderClientId);
        if (updateError) console.error('Error updating participant room_id for join:', updateError.message);
    } else {
        console.error('Error checking participant existence on join:', fetchError.message);
    }

    showMessage(joinRoomMessage, 'Successfully joined room!', 'success');
    joinRoomSection.style.display = 'none';
    auctionDetailsSection.style.display = 'block';

    setupRoomRealtime(currentRoomId);
    await fetchCurrentAuction(currentRoomId); // Fetch initial current auction
    setupAuctionRealtime(currentRoomId); // Setup listener for auction changes
    setupBidsRealtime(currentRoomId); // Setup listener for bid changes
}


// --- Current Auction Display & Bidding ---
placeBidBtn.addEventListener('click', async () => {
    if (!currentAuction || currentAuction.status !== 'active') {
        showMessage(bidMessage, 'Bidding is not active for this player.', 'error');
        return;
    }

    // Bidder cannot bid if they were the last bidder
    if (lastBidderDisplayName === bidderDisplayName) {
        showMessage(bidMessage, 'You are currently the top bidder. Wait for someone else to bid!', 'warning');
        return;
    }

    // Auctioneer cannot bid on their own auction
    if (currentAuction.auctioneer_display_name === bidderDisplayName) {
         showMessage(bidMessage, 'The auctioneer cannot bid on their own auction.', 'error');
         return;
    }

    const bidAmount = parseFloat(bidAmountInput.value);
    const requiredMinBid = parseFloat(currentAuction.current_price) + parseFloat(currentAuction.current_bid_increment);

    if (isNaN(bidAmount) || bidAmount < requiredMinBid) {
        showMessage(bidMessage, `Your bid must be at least ₹${requiredMinBid.toFixed(2)}.`, 'error');
        return;
    }

    showMessage(bidMessage, 'Placing bid...', 'info');

    // Insert bid
    const { error: bidError } = await supabase
        .from('bids')
        .insert({
            auction_id: currentAuction.id,
            bidder_display_name: bidderDisplayName, // Use bidder display name
            bid_amount: bidAmount
        });

    if (bidError) {
        showMessage(bidMessage, `Error placing bid: ${bidError.message}`, 'error');
        console.error('Bid insert error:', bidError);
        return;
    }

    // Update player_auction's current_price and last_bidder_display_name
    const { error: auctionUpdateError } = await supabase
        .from('player_auctions')
        .update({
            current_price: bidAmount,
            last_bidder_display_name: bidderDisplayName, // Use bidder display name
            winner_display_name: bidderDisplayName, // Temporarily set winner, confirmed on "Sell Player"
            winning_bid_amount: bidAmount
        })
        .eq('id', currentAuction.id)
        .eq('status', 'active'); // Ensure we only update if still active

    if (auctionUpdateError) {
        showMessage(bidMessage, `Error updating auction: ${auctionUpdateError.message}`, 'error');
        console.error('Auction update error:', auctionUpdateError);
        // Consider rolling back bid insert if this fails significantly
        return;
    }

    showMessage(bidMessage, 'Bid placed successfully!', 'success');
    bidAmountInput.value = ''; // Clear input
    placeBidBtn.disabled = true; // Disable button immediately
    lastBidderDisplayName = bidderDisplayName; // Update client-side last bidder to self

    // UI will update via real-time subscription
});

function updateBidButtonState(currentAuctionData) {
    if (!currentAuctionData || currentAuctionData.status !== 'active' || !bidderDisplayName) {
        placeBidBtn.disabled = true;
        bidAmountInput.disabled = true;
        return;
    }

    const currentPrice = parseFloat(currentAuctionData.current_price);
    const bidIncrement = parseFloat(currentAuctionData.current_bid_increment);
    const minNextBid = currentPrice + bidIncrement;
    nextBidAmountDisplay.textContent = minNextBid.toFixed(2);
    bidAmountInput.min = minNextBid.toFixed(2);

    if (currentAuctionData.last_bidder_display_name === bidderDisplayName) {
        placeBidBtn.disabled = true;
        bidAmountInput.disabled = true;
        showMessage(bidMessage, 'You are currently the top bidder. Wait for a counter bid!', 'info');
    } else if (currentAuctionData.auctioneer_display_name === bidderDisplayName) {
        placeBidBtn.disabled = true;
        bidAmountInput.disabled = true;
        showMessage(bidMessage, 'You are the auctioneer. You cannot bid on your own auction.', 'error');
    }
    else {
        placeBidBtn.disabled = false;
        bidAmountInput.disabled = false;
        bidMessage.textContent = ''; // Clear message if not top bidder
        bidMessage.className = 'message';
    }
}


// --- Realtime Subscriptions ---

// Supabase Realtime Channels
function setupRoomRealtime(roomId) {
    if (roomChannel) {
        roomChannel.unsubscribe();
    }
    roomChannel = supabase.channel(`room:${roomId}`);
    roomChannel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, payload => {
        if (payload.new.status === 'ended') {
            showMessage(joinRoomMessage, 'The auction room has ended by the auctioneer.', 'warning');
            currentRoomId = null;
            joinRoomSection.style.display = 'block';
            auctionDetailsSection.style.display = 'none';
            if (roomChannel) roomChannel.unsubscribe();
            if (participantPresence) participantPresence.unsubscribe(); // Stop presence tracking for this room
            // Remove current room from participant's profile
            supabase.from('participants').update({ current_room_id: null }).eq('id', bidderClientId).then(({error}) => {
                if(error) console.error("Error clearing participant room_id on room end:", error.message);
            });
        }
    }).subscribe();

    // Listen for broadcast notifications from auctioneer
    roomChannel.on('broadcast', { event: 'auction_notification' }, (payload) => {
        console.log('Broadcast notification:', payload.payload);
        const notification = payload.payload;
        let notificationClass = 'info';
        if (notification.status === 'first_call' || notification.status === 'second_call') {
            notificationClass = 'call';
            if (notification.status === 'first_call') firstCallAudio.play().catch(e => console.error("Audio error:", e));
            if (notification.status === 'second_call') secondCallAudio.play().catch(e => console.error("Audio error:", e));
        } else if (notification.status === 'sold') {
            notificationClass = 'success';
            finalCallAudio.play().catch(e => console.error("Audio error:", e));
            // Trigger confetti if this bidder won
            if (currentAuction && currentAuction.winner_display_name === bidderDisplayName) {
                triggerConfetti();
                fetchWonPlayers(bidderDisplayName); // Refresh won players list
            }
        }
        showMessage(bidMessage, notification.message, notificationClass); // Display as a bid message for consistency
    }).subscribe();
}

// Presence (optional for bidder, but good for tracking if you leave/rejoin)
async function setupClientPresence(roomId = null) {
    if (participantPresence) {
        await participantPresence.unsubscribe(); // Unsubscribe from previous presence channel
    }

    participantPresence = supabase.channel(`room_presence:${roomId}`, {
        config: { presence: { key: bidderClientId } }
    });

    participantPresence.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
            const { error } = await participantPresence.track({
                id: bidderClientId,
                display_name: bidderDisplayName,
                online_at: new Date().toISOString(),
                room_id: roomId // Send room_id for RLS and display
            });
            if (error) console.error('Error tracking presence:', error.message);
            else {
                // Update the current_room_id in the participants table (optional for this non-auth setup, primarily for tracking)
                const { data: existingParticipant, error: fetchError } = await supabase
                    .from('participants')
                    .select('id')
                    .eq('id', bidderClientId)
                    .single();

                if (fetchError && fetchError.code === 'PGRST116') { // No existing participant
                    const { error: insertError } = await supabase
                        .from('participants')
                        .insert({ id: bidderClientId, display_name: bidderDisplayName, current_room_id: roomId });
                    if (insertError) console.error('Error inserting new participant:', insertError.message);
                } else if (!fetchError) { // Existing participant
                    const { error: updateError } = await supabase
                        .from('participants')
                        .update({ display_name: bidderDisplayName, current_room_id: roomId, last_online: new Date().toISOString() })
                        .eq('id', bidderClientId);
                    if (updateError) console.error('Error updating participant room_id:', updateError.message);
                } else {
                    console.error('Error checking participant existence:', fetchError.message);
                }
            }
        }
    });
}

// Player auction updates (e.g., status changes, price updates)
function setupAuctionRealtime(roomId) {
    supabase
        .channel(`player_auction_updates_room_${roomId}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'player_auctions', filter: `room_id=eq.${roomId}` }, payload => {
            console.log('Player auction update received:', payload);
            if (payload.new && currentAuction && payload.new.id === currentAuction.id) {
                // Update current auction details only if it's the current player being viewed
                currentAuction = payload.new;
                auctionCurrentPrice.textContent = parseFloat(currentAuction.current_price).toFixed(2);
                lastBidderDisplayName = currentAuction.last_bidder_display_name; // Update last bidder
                auctionLastBidder.textContent = lastBidderDisplayName || 'N/A';
                updateBidButtonState(currentAuction);

                // Handle status changes (e.g., if sold or ended by auctioneer)
                if (currentAuction.status === 'sold' || currentAuction.status === 'ended' || currentAuction.status === 'cancelled') {
                    placeBidBtn.disabled = true;
                    bidAmountInput.disabled = true;
                    bidMessage.textContent = `This player is ${currentAuction.status}!`;
                    bidMessage.className = 'message warning';
                    setTimeout(() => { // Clear player display after a short delay
                        auctionDetailsSection.style.display = 'none';
                        showMessage(joinRoomMessage, 'Auction for this player has concluded. Waiting for next player...', 'info');
                    }, 5000);
                }
            } else if (payload.new && payload.new.status === 'active' && !currentAuction) {
                // A new auction became active and bidder doesn't have one displayed
                fetchCurrentAuction(roomId);
            }
        })
        .subscribe();
}

// Bids updates (for current auction's bid history)
function setupBidsRealtime(roomId) {
    supabase
        .channel(`bids_for_room_${roomId}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bids', filter: `auction_id=in.(select id from public.player_auctions where room_id='${roomId}')` }, payload => {
            console.log('New bid received in room:', payload);
            if (currentAuction && payload.new.auction_id === currentAuction.id) {
                fetchBids(currentAuction.id); // Refresh bid history for the current player
            }
        })
        .subscribe();
}

async function fetchCurrentAuction(roomId) {
    const { data: auction, error } = await supabase
        .from('player_auctions')
        .select('*')
        .eq('room_id', roomId)
        .in('status', ['pending', 'active', 'first_call', 'second_call']) // Get the current player in the room
        .order('created_at', { ascending: true }) // Get the next one in queue if multiple
        .limit(1)
        .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 means no rows found
        console.error('Error fetching current auction:', error.message);
        auctionDetailsSection.style.display = 'none';
        showMessage(joinRoomMessage, 'Failed to load current auction.', 'error');
        return;
    }

    if (auction) {
        currentAuction = auction;
        auctionPlayerName.textContent = auction.player_name;
        auctionPlayerClub.textContent = auction.player_club_nationality || 'N/A';
        auctionPlayerStartPrice.textContent = parseFloat(auction.start_price).toFixed(2);
        auctionCurrentPrice.textContent = parseFloat(auction.current_price).toFixed(2);
        lastBidderDisplayName = auction.last_bidder_display_name;
        auctionLastBidder.textContent = lastBidderDisplayName || 'N/A'; // Update last bidder display
        if (auction.image_url) {
            auctionPlayerImage.src = auction.image_url;
            auctionPlayerImage.style.display = 'block';
        } else {
            auctionPlayerImage.style.display = 'none';
        }

        updateBidButtonState(currentAuction);
        fetchBids(currentAuction.id);
        auctionDetailsSection.style.display = 'block';
        joinRoomMessage.textContent = ''; // Clear room join message
        joinRoomMessage.className = 'message';
    } else {
        // No active auction in this room
        currentAuction = null;
        auctionDetailsSection.style.display = 'none';
        showMessage(joinRoomMessage, 'No active auction for this room yet. Waiting for auctioneer to list a player.', 'info');
    }
}

async function fetchBids(auctionId) {
    const { data: bids, error: bidsError } = await supabase
        .from('bids')
        .select('*')
        .eq('auction_id', auctionId)
        .order('bid_time', { ascending: false }); // Newest bid first

    if (bidsError) {
        console.error('Error fetching bids:', bidsError.message);
        bidHistoryList.innerHTML = `<li style="color: var(--error-color);">Failed to load bids.</li>`;
        return;
    }

    bidHistoryList.innerHTML = ''; // Clear previous bids
    if (bids.length === 0) {
        bidHistoryList.innerHTML = '<li>No bids yet. Be the first!</li>';
        return;
    }

    bids.forEach(bid => {
        const listItem = document.createElement('li');
        listItem.textContent = `₹${parseFloat(bid.bid_amount).toFixed(2)} by ${bid.bidder_display_name} at ${new Date(bid.bid_time).toLocaleString()}`;
        bidHistoryList.appendChild(listItem);
    });
}

async function fetchWonPlayers(displayName) {
    if (!displayName) {
        wonPlayersList.innerHTML = '<li>Set your display name to see your won players.</li>';
        return;
    }

    const { data: wonPlayers, error } = await supabase
        .from('won_players')
        .select('player_name, winning_bid, won_time')
        .eq('bidder_display_name', displayName) // Query by display name
        .order('won_time', { ascending: false });

    if (error) {
        console.error('Error fetching won players:', error.message);
        wonPlayersList.innerHTML = `<li style="color: var(--error-color);">Error loading won players.</li>`;
        return;
    }

    wonPlayersList.innerHTML = '';
    if (wonPlayers.length === 0) {
        wonPlayersList.innerHTML = '<li>No players won yet.</li>';
        return;
    }

    wonPlayers.forEach(player => {
        const li = document.createElement('li');
        li.innerHTML = `<span>${player.player_name}</span> <span class="player-won-details">₹${parseFloat(player.winning_bid).toFixed(2)}</span>`;
        wonPlayersList.appendChild(li);
    });
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

function triggerConfetti() {
    confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
    });
}
