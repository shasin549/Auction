import { supabase, getCurrentUser, getUserProfile } from './supabaseClient.js';

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const auctionId = urlParams.get('id');

    if (!auctionId) {
        alert('No auction ID provided.');
        window.location.href = 'index.html';
        return;
    }

    // --- Auth UI Elements ---
    const logoutBtn = document.getElementById('logoutBtnBidder');
    const userInfo = document.getElementById('user-info-bidder');
    const usernameDisplay = document.getElementById('usernameDisplayBidder');

    async function checkAuthStatus() {
        const user = await getCurrentUser();
        if (user) {
            userInfo.style.display = 'inline';
            const profile = await getUserProfile(user.id);
            if (profile && profile.name) {
                usernameDisplay.textContent = profile.name;
            } else {
                usernameDisplay.textContent = user.email; // Fallback to email
            }
        } else {
            // Keep user on page but restrict bidding
            document.getElementById('placeBidBtn').disabled = true;
            document.getElementById('bidAmountInput').disabled = true;
            document.getElementById('bid-message').textContent = 'Please log in to place a bid.';
            document.getElementById('bid-message').style.color = 'blue';
        }
    }
    checkAuthStatus();

    logoutBtn.addEventListener('click', async () => {
        const { error } = await supabase.auth.signOut();
        if (error) {
            console.error('Logout error:', error.message);
        } else {
            console.log('Logged out successfully from bidder page.');
            window.location.reload(); // Reload to update auth state and disable bidding
        }
    });

    // --- Auction Details Elements ---
    const auctionTitle = document.getElementById('auction-title');
    const auctionImage = document.getElementById('auction-image');
    const auctionDescription = document.getElementById('auction-description');
    const auctionSeller = document.getElementById('auction-seller');
    const auctionCurrentPrice = document.getElementById('auction-current-price');
    const auctionTimeLeft = document.getElementById('auction-time-left');
    const bidAmountInput = document.getElementById('bidAmountInput');
    const placeBidBtn = document.getElementById('placeBidBtn');
    const bidMessage = document.getElementById('bid-message');
    const bidHistoryList = document.getElementById('bid-history-list');

    let currentAuction = null; // Store current auction data

    async function fetchAuctionDetails() {
        const { data: auction, error: auctionError } = await supabase
            .from('auctions')
            .select('*')
            .eq('id', auctionId)
            .single();

        if (auctionError || !auction) {
            console.error('Error fetching auction:', auctionError?.message || 'Auction not found');
            auctionTitle.textContent = 'Auction Not Found';
            return;
        }

        currentAuction = auction; // Store for bidding logic

        auctionTitle.textContent = auction.title;
        if (auction.image_url) {
            auctionImage.src = auction.image_url;
            auctionImage.style.display = 'block';
        } else {
            auctionImage.style.display = 'none';
        }
        auctionDescription.textContent = auction.description;
        auctionCurrentPrice.textContent = `$${parseFloat(auction.current_price).toFixed(2)}`;
        bidAmountInput.min = (parseFloat(auction.current_price) + 0.01).toFixed(2); // Set min bid

        // Fetch seller's name from 'players Table'
        let sellerName = 'Unknown Seller';
        if (auction.seller_id) {
            const { data: sellerProfile, error: sellerProfileError } = await supabase
                .from('players Table')
                .select('name')
                .eq('id', auction.seller_id)
                .single();
            if (sellerProfile && sellerProfile.name) {
                sellerName = sellerProfile.name;
            } else if (sellerProfileError) {
                console.warn(`Could not fetch seller name for ID ${auction.seller_id}:`, sellerProfileError.message);
            }
        }
        auctionSeller.textContent = sellerName;


        // Update countdown every second
        if (window.auctionCountdownInterval) {
            clearInterval(window.auctionCountdownInterval);
        }
        window.auctionCountdownInterval = setInterval(() => {
            const timeLeft = getTimeRemaining(auction.end_time);
            auctionTimeLeft.textContent = timeLeft;
            if (timeLeft === "Auction Ended" || auction.status === 'closed') {
                clearInterval(window.auctionCountdownInterval);
                auctionTimeLeft.style.color = 'red';
                placeBidBtn.disabled = true;
                bidAmountInput.disabled = true;
                bidMessage.textContent = 'This auction has ended.';
                bidMessage.style.color = 'orange';
                updateAuctionStatusIfEnded(auction.id); // Try to close the auction if time ran out
            }
        }, 1000);

        fetchBids(); // Load bids for this auction
    }

    async function fetchBids() {
        const { data: bids, error: bidsError } = await supabase
            .from('bids')
            .select('*')
            .eq('auction_id', auctionId)
            .order('bid_time', { ascending: false }); // Show newest bid first

        if (bidsError) {
            console.error('Error fetching bids:', bidsError.message);
            bidHistoryList.innerHTML = `<li style="color: red;">Failed to load bids.</li>`;
            return;
        }

        if (bids.length === 0) {
            bidHistoryList.innerHTML = '<li>No bids yet. Be the first!</li>';
            return;
        }

        bidHistoryList.innerHTML = ''; // Clear existing bids
        for (const bid of bids) {
            const { data: bidderProfile, error: bidderProfileError } = await supabase
                .from('players Table')
                .select('name')
                .eq('id', bid.bidder_id)
                .single();

            const bidderInfo = (bidderProfile && bidderProfile.name) ? bidderProfile.name : 'Anonymous';
            const listItem = document.createElement('li');
            listItem.textContent = `$${parseFloat(bid.bid_amount).toFixed(2)} by ${bidderInfo} at ${new Date(bid.bid_time).toLocaleString()}`;
            bidHistoryList.appendChild(listItem);
        }
    }

    // --- Place Bid Logic ---
    placeBidBtn.addEventListener('click', async () => {
        const bidAmount = parseFloat(bidAmountInput.value);
        const user = await getCurrentUser();

        if (!user) {
            bidMessage.textContent = 'Please log in to place a bid.';
            bidMessage.style.color = 'red';
            return;
        }

        if (isNaN(bidAmount) || bidAmount <= parseFloat(currentAuction.current_price)) {
            bidMessage.textContent = `Your bid must be higher than the current price ($${parseFloat(currentAuction.current_price).toFixed(2)}).`;
            bidMessage.style.color = 'red';
            return;
        }

        if (user.id === currentAuction.seller_id) {
            bidMessage.textContent = 'You cannot bid on your own auction.';
            bidMessage.style.color = 'red';
            return;
        }

        bidMessage.textContent = 'Placing bid...';
        bidMessage.style.color = 'blue';

        // Perform the bid and update auction
        const { error: bidError } = await supabase
            .from('bids')
            .insert({
                auction_id: auctionId,
                bidder_id: user.id,
                bid_amount: bidAmount
            });

        if (bidError) {
            bidMessage.textContent = `Error placing bid: ${bidError.message}`;
            bidMessage.style.color = 'red';
            console.error('Bid insert error:', bidError);
            return;
        }

        const { error: auctionUpdateError } = await supabase
            .from('auctions')
            .update({
                current_price: bidAmount,
                winner_id: user.id
            })
            .eq('id', auctionId);

        if (auctionUpdateError) {
            bidMessage.textContent = `Error updating auction price: ${auctionUpdateError.message}`;
            bidMessage.style.color = 'red';
            console.error('Auction update error:', auctionUpdateError);
            return;
        }

        bidMessage.textContent = 'Bid placed successfully!';
        bidMessage.style.color = 'green';
        bidAmountInput.value = ''; // Clear input
        fetchAuctionDetails(); // Re-fetch details to update UI with new price/bids
        fetchBids(); // Refresh bids list
    });

    // --- Real-time Updates (Supabase Realtime) for this specific auction ---
    function setupRealtimeBidUpdates() {
        supabase
            .channel(`auction_${auctionId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'auctions', filter: `id=eq.${auctionId}` }, payload => {
                console.log('Specific auction change received!', payload);
                if (payload.eventType === 'UPDATE') {
                    if (payload.new.current_price !== currentAuction.current_price) {
                        currentAuction.current_price = payload.new.current_price;
                        auctionCurrentPrice.textContent = `$${parseFloat(payload.new.current_price).toFixed(2)}`;
                        bidAmountInput.min = (parseFloat(payload.new.current_price) + 0.01).toFixed(2);
                        bidMessage.textContent = 'New bid placed by another user!';
                        bidMessage.style.color = 'orange';
                    }
                    if (payload.new.status === 'closed') {
                         auctionTimeLeft.textContent = "Auction Ended";
                         auctionTimeLeft.style.color = 'red';
                         placeBidBtn.disabled = true;
                         bidAmountInput.disabled = true;
                         bidMessage.textContent = 'This auction has ended.';
                         bidMessage.style.color = 'orange';
                         clearInterval(window.auctionCountdownInterval); // Stop countdown
                    }
                }
            })
            .subscribe();

        supabase
            .channel(`bids_for_auction_${auctionId}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bids', filter: `auction_id=eq.${auctionId}` }, payload => {
                console.log('New bid inserted for this auction!', payload);
                fetchBids(); // Refresh bid history
            })
            .subscribe();
    }


    // --- Countdown Timer Helper ---
    function getTimeRemaining(endTime) {
        const total = Date.parse(endTime) - Date.parse(new Date());
        if (total <= 0) {
            return "Auction Ended";
        }
        const seconds = Math.floor((total / 1000) % 60);
        const minutes = Math.floor((total / 1000 / 60) % 60);
        const hours = Math.floor((total / (1000 * 60 * 60)) % 24);
        const days = Math.floor(total / (1000 * 60 * 60 * 24));

        return `${days}d ${hours}h ${minutes}m ${seconds}s`;
    }

    // --- Function to update auction status to 'closed' if end time passed ---
    async function updateAuctionStatusIfEnded(auctionIdToCheck) {
        if (currentAuction && new Date(currentAuction.end_time) <= new Date() && currentAuction.status === 'active') {
             console.log(`Auction ${auctionIdToCheck} has ended. Attempting to close.`);
             const user = await getCurrentUser();
             if (user) {
                 const { error } = await supabase
                    .from('auctions')
                    .update({ status: 'closed' })
                    .eq('id', auctionIdToCheck);

                if (error) {
                    console.error('Error updating auction status to closed:', error.message);
                } else {
                    console.log(`Auction ${auctionIdToCheck} status updated to closed.`);
                }
             } else {
                 console.log('Not authenticated to update auction status. A backend job should handle this.');
             }
        }
    }


    // Initial load
    fetchAuctionDetails();
    setupRealtimeBidUpdates();
});
