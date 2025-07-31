import { supabase, getCurrentUser, getUserProfile } from './supabaseClient.js';

document.addEventListener('DOMContentLoaded', () => {
    // --- Auth UI Elements ---
    const loginBtn = document.getElementById('loginBtn');
    const signupBtn = document.getElementById('signupBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const authLinks = document.getElementById('auth-links');
    const userInfo = document.getElementById('user-info');
    const usernameDisplay = document.getElementById('usernameDisplay');

    // --- Modal Elements ---
    const modal = document.getElementById('login-signup-modal');
    const closeModalBtn = document.querySelector('.close-button');
    const modalTitle = document.getElementById('modal-title');
    const authForm = document.getElementById('auth-form');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const authSubmitBtn = document.getElementById('authSubmitBtn');
    const authMessage = document.getElementById('auth-message');
    const toggleAuthMode = document.getElementById('toggleAuthMode');

    let isLoginMode = true; // State for login/signup modal

    // --- Event Listeners for Auth UI ---
    loginBtn.addEventListener('click', () => {
        isLoginMode = true;
        modalTitle.textContent = 'Login';
        authSubmitBtn.textContent = 'Login';
        toggleAuthMode.textContent = 'Need an account? Sign Up';
        authMessage.textContent = '';
        authForm.reset();
        modal.style.display = 'block';
    });

    signupBtn.addEventListener('click', () => {
        isLoginMode = false;
        modalTitle.textContent = 'Sign Up';
        authSubmitBtn.textContent = 'Sign Up';
        toggleAuthMode.textContent = 'Already have an account? Login';
        authMessage.textContent = '';
        authForm.reset();
        modal.style.display = 'block';
    });

    closeModalBtn.addEventListener('click', () => {
        modal.style.display = 'none';
    });

    window.addEventListener('click', (event) => {
        if (event.target == modal) {
            modal.style.display = 'none';
        }
    });

    toggleAuthMode.addEventListener('click', (event) => {
        event.preventDefault();
        isLoginMode = !isLoginMode;
        modalTitle.textContent = isLoginMode ? 'Login' : 'Sign Up';
        authSubmitBtn.textContent = isLoginMode ? 'Login' : 'Sign Up';
        toggleAuthMode.textContent = isLoginMode ? 'Need an account? Sign Up' : 'Already have an account? Login';
        authMessage.textContent = '';
        authForm.reset();
    });

    authForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const email = emailInput.value;
        const password = passwordInput.value;
        authMessage.textContent = ''; // Clear previous messages

        if (isLoginMode) {
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) {
                authMessage.textContent = error.message;
            } else {
                authMessage.textContent = 'Login successful!';
                authMessage.style.color = 'green';
                modal.style.display = 'none';
                checkAuthStatus();
                fetchAndDisplayAuctions(); // Refresh auctions if needed
            }
        } else {
            const { error: signUpError } = await supabase.auth.signUp({ email, password });
            if (signUpError) {
                authMessage.textContent = signUpError.message;
            } else {
                // If signup is successful, also attempt to insert into 'players Table'
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    const { error: insertPlayerError } = await supabase
                        .from('players Table')
                        .insert([
                            { id: user.id, name: user.email.split('@')[0] } // Use email prefix as default name
                        ]);
                    if (insertPlayerError) {
                        console.error('Error inserting into players Table:', insertPlayerError.message);
                        // Don't fail signup for this, but log the error
                    }
                }

                authMessage.textContent = 'Sign up successful! Please check your email for confirmation.';
                authMessage.style.color = 'green';
                // Automatically switch to login mode after successful signup
                setTimeout(() => {
                    isLoginMode = true;
                    modalTitle.textContent = 'Login';
                    authSubmitBtn.textContent = 'Login';
                    toggleAuthMode.textContent = 'Need an account? Sign Up';
                    authMessage.textContent = '';
                    authForm.reset();
                }, 2000);
            }
        }
    });

    logoutBtn.addEventListener('click', async () => {
        const { error } = await supabase.auth.signOut();
        if (error) {
            console.error('Logout error:', error.message);
        } else {
            console.log('Logged out successfully.');
            checkAuthStatus();
            fetchAndDisplayAuctions(); // Refresh auctions if needed
        }
    });

    // --- Auth Status Check ---
    async function checkAuthStatus() {
        const user = await getCurrentUser();
        if (user) {
            authLinks.style.display = 'none';
            userInfo.style.display = 'inline';
            const profile = await getUserProfile(user.id);
            if (profile && profile.name) {
                usernameDisplay.textContent = profile.name;
            } else {
                usernameDisplay.textContent = user.email; // Fallback to email if 'name' not found
            }
        } else {
            authLinks.style.display = 'inline';
            userInfo.style.display = 'none';
            usernameDisplay.textContent = '';
        }
    }

    // --- Auction Display Logic ---
    const auctionList = document.getElementById('auction-list');
    const noAuctionsMessage = document.getElementById('no-auctions-message');

    async function fetchAndDisplayAuctions() {
        const { data: auctions, error } = await supabase
            .from('auctions')
            .select('*')
            .eq('status', 'active') // Only show active auctions
            .order('end_time', { ascending: true });

        if (error) {
            console.error('Error fetching auctions:', error.message);
            auctionList.innerHTML = `<p style="color: red;">Failed to load auctions: ${error.message}</p>`;
            return;
        }

        if (auctions.length === 0) {
            noAuctionsMessage.style.display = 'block';
            auctionList.innerHTML = '';
            return;
        } else {
            noAuctionsMessage.style.display = 'none';
        }

        auctionList.innerHTML = ''; // Clear previous listings
        for (const auction of auctions) {
            const auctionCard = document.createElement('div');
            auctionCard.classList.add('auction-card');

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


            auctionCard.innerHTML = `
                ${auction.image_url ? `<img src="${auction.image_url}" alt="${auction.title}">` : ''}
                <h3>${auction.title}</h3>
                <p>${auction.description ? auction.description.substring(0, 100) + (auction.description.length > 100 ? '...' : '') : 'No description provided.'}</p>
                <p>Seller: ${sellerName}</p>
                <p class="price">Current Price: $${parseFloat(auction.current_price).toFixed(2)}</p>
                <p class="time-left" data-end-time="${auction.end_time}">Ends in: Calculating...</p>
                <button onclick="window.location.href='bidder.html?id=${auction.id}'" class="button-primary">View & Bid</button>
            `;
            auctionList.appendChild(auctionCard);
        }

        startCountdowns();
    }

    // --- Real-time Updates (Supabase Realtime) ---
    function setupRealtimeAuctionUpdates() {
        supabase
            .channel('public:auctions') // Listen to changes in the 'auctions' table
            .on('postgres_changes', { event: '*', schema: 'public', table: 'auctions' }, payload => {
                console.log('Auction change received!', payload);
                fetchAndDisplayAuctions();
            })
            .subscribe();

        supabase
            .channel('public:bids') // Listen to changes in the 'bids' table
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bids' }, payload => {
                console.log('New bid received!', payload);
                fetchAndDisplayAuctions();
            })
            .subscribe();
    }


    // --- Countdown Timer Logic ---
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

    function startCountdowns() {
        document.querySelectorAll('.time-left').forEach(timerElement => {
            const endTime = timerElement.dataset.endTime;
            if (timerElement.dataset.intervalId) {
                clearInterval(parseInt(timerElement.dataset.intervalId));
            }
            const intervalId = setInterval(() => {
                timerElement.textContent = `Ends in: ${getTimeRemaining(endTime)}`;
            }, 1000);
            timerElement.dataset.intervalId = intervalId.toString();
        });
    }

    // Initial load
    checkAuthStatus();
    fetchAndDisplayAuctions();
    setupRealtimeAuctionUpdates(); // Start listening for real-time changes
});
