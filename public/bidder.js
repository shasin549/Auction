import { supabase, getCurrentUser, getParticipantProfile, ensureParticipantProfile } from './supabaseClient.js';

// --- Global Variables ---
let bidderUser = null;
let currentRoomId = null;
let currentAuction = null; // Stores details of the player currently being auctioned
let roomChannel = null; // Supabase Realtime Channel for the room
let lastBidderId = null; // Tracks the last person to bid on the current auction

// --- UI Elements ---
const logoutBtn = document.getElementById('logoutBtnBidder');
const usernameDisplay = document.getElementById('usernameDisplayBidder');

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

const wonPlayersList = document.getElementById('wonPlayersList');

// --- Auth and Room Join Setup ---
document.addEventListener('DOMContentLoaded', async () => {
    bidderUser = await getCurrentUser();
    if (!bidderUser) {
        alert('You must be logged in to access the Bidder Dashboard.');
        window.location.href = 'index.html'; // Redirect to home
        return;
    }
    await ensureParticipantProfile(bidderUser);
    await displayUserInfo();
    fetchWonPlayers(); // Always show won players

    // Check if user is already in a room (e.g., if page was refreshed)
    const { data: participantProfile, error: profileError } = await supabase
        .from('participants')
        .select('current_room_id')
        .eq('id', bidderUser.id)
        .single();

    if (profileError && profileError.code !== 'PGRST116') {
        console.error('Error fetching participant profile:', profileError.message);
    }

    if (participantProfile && participantProfile.current_room_id) {
        // Verify room exists and is active/lobby
        const { data: room, error: roomCheckError } = await supabase
            .from('rooms')
            .select('room_code, status')
            .eq('id', participantProfile.current_room_id)
            .single();

        if (!roomCheckError && room && (room.status === 'lobby' || room.status === 'active')) {
            currentRoomId = participantProfile.current_room_id;
            roomCodeInput.value = room.room_code; // Pre-fill room code
            await joinRoom(room.room_code); // Re-join the room
            return;
        } else if (roomCheckError || (room && room.status === 'ended')) {
            // Room no longer valid, clear participant's room_id
            await supabase.from('participants').update({ current_room_id: null }).eq('id', bidderUser.id);
        }
    }

    joinRoomSection.style.display = 'block';
    auctionDetailsSection.style.display = 'none';
});

logoutBtn.addEventListener('click', async () => {
    const { error } = await supabase.auth.signOut();
    if (error) console.error('Logout error:', error.message);
    else {
        // Clear participant's room_id on logout
        await supabase.from('participants').update({ current_room_id: null }).eq('id', bidderUser.id);
        if (roomChannel) roomChannel.unsubscribe();
        console.log('Logged out successfully.');
        window.location.href = 'index.html';
    }
});

async function displayUserInfo() {
    const profile = await getParticipantProfile(bidderUser.id);
    if (profile && profile.display_name) {
        usernameDisplay.textContent = profile.display_name;
    } else {
        usernameDisplay.textContent = bidderUser.email || 'Guest';
    }
    document.getElementById('user-info-bidder').style.display = 'inline-flex';
}


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
    // Update participant's current_room_id
    const { error: updateParticipantError } = await supabase
        .from('participants')
        .update({ current_room_id: currentRoomId })
        .eq('id', bidderUser.id);

    if (updateParticipantError) {
        console.error('Error updating participant room:', updateParticipantError.message);
        showMessage(joinRoomMessage, 'Failed to update your room status.', 'error');
        currentRoomId = null; // Reset to prevent half-joined state
        return;
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

    if (bidderUser.id === currentAuction.auctioneer_id) {
        showMessage(bidMessage, 'You cannot bid on your own player.', 'error');
        return;
    }

    if (lastBidderId === bidderUser.id) {
        showMessage(bidMessage, 'You are currently the top bidder. Wait for someone else to bid!', 'warning');
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
            bidder_id: bidderUser.id,
            bid_amount: bidAmount
        });

    if (bidError) {
        showMessage(bidMessage, `Error placing bid: ${bidError.message}`, 'error');
        console.error('Bid insert error:', bidError);
        return;
    }

    // Update player_auction's current_price and last_bidder_id
    const { error: auctionUpdateError } = await supabase
        .from('player_auctions')
        .update({
            current_price: bidAmount,
            last_bidder_id: bidderUser.id,
            winner_id: bidderUser.id, // Temporarily set winner, confirmed on "Sell Player"
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
    lastBidderId = bidderUser.id; // Update client-side last bidder to self

    // UI will update via real-time subscription
});

function updateBidButtonState(currentAuctionData) {
    if (!currentAuctionData || currentAuctionData.status !== 'active' || !bidderUser) {
        placeBidBtn.disabled = true;
        bidAmountInput.disabled = true;
        return;
    }

    const currentPrice = parseFloat(currentAuctionData.current_price);
    const bidIncrement = parseFloat(currentAuctionData.current_bid_increment);
    const minNextBid = currentPrice + bidIncrement;
    nextBidAmountDisplay.textContent = minNextBid.toFixed(2);
    bidAmountInput.min = minNextBid.toFixed(2);

    if (currentAuctionData.last_bidder_id === bidderUser.id) {
        placeBidBtn.disabled = true;
        bidAmountInput.disabled = true;
        showMessage(bidMessage, 'You are currently the top bidder. Wait for a counter bid!', 'info');
    } else {
        placeBidBtn.disabled = false;
        bidAmountInput.disabled = false;
        bidMessage.textContent = ''; // Clear message if not top bidder
        bidMessage.className = 'message';
    }
}


// --- Realtime Subscriptions ---

// Room status updates (e.g., room ended)
function setupRoomRealtime(roomId) {
    roomChannel = supabase.channel(`room:${roomId}`);
    roomChannel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, payload => {
        if (payload.new.status === 'ended') {
            showMessage(joinRoomMessage, 'The auction room has ended by the auctioneer.', 'warning');
            currentRoomId = null;
            joinRoomSection.style.display = 'block';
            auctionDetailsSection.style.display = 'none';
            if (roomChannel) roomChannel.unsubscribe();
            // Clear participant's room_id
            supabase.from('participants').update({ current_room_id: null }).eq('id', bidderUser.id).then(({error}) => {
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
            if (currentAuction && currentAuction.winner_id === bidderUser.id) {
                triggerConfetti();
                fetchWonPlayers(); // Refresh won players list
            }
        }
        showMessage(bidMessage, notification.message, notificationClass); // Display as a bid message for consistency
    }).subscribe();

    // Presence (optional for bidder, but good for tracking if you leave/rejoin)
    const participantPresence = supabase.channel(`room_presence:${roomId}`, {
        config: { presence: { key: bidderUser.id } }
    });

    participantPresence.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
            const { error } = await participantPresence.track({
                id: bidderUser.id,
                display_name: usernameDisplay.textContent || bidderUser.email,
                online_at: new Date().toISOString(),
                room_id: currentRoomId
            });
            if (error) console.error('Error tracking presence:', error.message);
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
                lastBidderId = currentAuction.last_bidder_id; // Update last bidder
                updateBidButtonState(currentAuction);

                // Update last bidder display name
                getParticipantName(currentAuction.last_bidder_id).then(name => {
                    auctionLastBidder.textContent = name;
                });

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
        lastBidderId = auction.last_bidder_id;
        if (auction.image_url) {
            auctionPlayerImage.src = auction.image_url;
            auctionPlayerImage.style.display = 'block';
        } else {
            auctionPlayerImage.style.display = 'none';
        }

        getParticipantName(auction.last_bidder_id).then(name => {
            auctionLastBidder.textContent = name;
        });

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

    for (const bid of bids) {
        const bidderName = await getParticipantName(bid.bidder_id);
        const listItem = document.createElement('li');
        listItem.textContent = `₹${parseFloat(bid.bid_amount).toFixed(2)} by ${bidderName} at ${new Date(bid.bid_time).toLocaleString()}`;
        bidHistoryList.appendChild(listItem);
    }
}

async function fetchWonPlayers() {
    if (!bidderUser) {
        wonPlayersList.innerHTML = '<li>Login to see your won players.</li>';
        return;
    }

    const { data: wonPlayers, error } = await supabase
        .from('won_players')
        .select('player_name, winning_bid, won_time')
        .eq('bidder_id', bidderUser.id)
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

function triggerConfetti() {
    confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
    });
}
