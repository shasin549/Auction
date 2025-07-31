import { supabase, getCurrentUser, getUserProfile } from './supabaseClient.js';

document.addEventListener('DOMContentLoaded', async () => {
    const auctionForm = document.getElementById('auctionForm');
    const messageElement = document.getElementById('message');

    // --- Auth UI Elements ---
    const logoutBtn = document.getElementById('logoutBtnAuctioneer');
    const userInfo = document.getElementById('user-info-auctioneer');
    const usernameDisplay = document.getElementById('usernameDisplayAuctioneer');

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
            alert('You must be logged in to create an auction.');
            window.location.href = 'index.html';
        }
    }
    checkAuthStatus();

    logoutBtn.addEventListener('click', async () => {
        const { error } = await supabase.auth.signOut();
        if (error) {
            console.error('Logout error:', error.message);
        } else {
            console.log('Logged out successfully from auctioneer page.');
            window.location.href = 'index.html'; // Redirect to home after logout
        }
    });


    auctionForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const user = await getCurrentUser();
        if (!user) {
            messageElement.textContent = 'Please log in to create an auction.';
            messageElement.style.color = 'red';
            return;
        }

        const title = document.getElementById('title').value;
        const description = document.getElementById('description').value;
        const startPrice = parseFloat(document.getElementById('startPrice').value);
        const imageUrl = document.getElementById('imageUrl').value;
        const endTime = document.getElementById('endTime').value; // This will be in local datetime format

        // Validate inputs
        if (!title || !startPrice || !endTime) {
            messageElement.textContent = 'Please fill in all required fields.';
            messageElement.style.color = 'red';
            return;
        }
        if (isNaN(startPrice) || startPrice <= 0) {
            messageElement.textContent = 'Starting price must be a positive number.';
            messageElement.style.color = 'red';
            return;
        }

        // Convert local datetime to ISO string for Supabase (UTC recommended)
        const endDateTime = new Date(endTime).toISOString();

        messageElement.textContent = 'Creating auction...';
        messageElement.style.color = 'blue';

        const { data, error } = await supabase
            .from('auctions')
            .insert([
                {
                    title: title,
                    description: description,
                    start_price: startPrice,
                    current_price: startPrice, // Initial current price is the start price
                    image_url: imageUrl || null,
                    end_time: endDateTime,
                    seller_id: user.id, // Associate auction with logged-in user
                    status: 'active'
                }
            ]);

        if (error) {
            messageElement.textContent = `Error creating auction: ${error.message}`;
            messageElement.style.color = 'red';
            console.error('Error creating auction:', error);
        } else {
            messageElement.textContent = 'Auction created successfully!';
            messageElement.style.color = 'green';
            auctionForm.reset(); // Clear the form
            console.log('Auction created:', data);
            setTimeout(() => {
                window.location.href = 'index.html'; // Go back to the main list
            }, 1500);
        }
    });
});
