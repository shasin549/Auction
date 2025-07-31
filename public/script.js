import { supabase, getCurrentUser, getParticipantProfile, ensureParticipantProfile } from './supabaseClient.js';

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

    // --- Navigation Buttons ---
    const auctioneerBtn = document.getElementById('auctioneerBtn');
    const bidderBtn = document.getElementById('bidderBtn');

    // --- Event Listeners for Auth UI ---
    loginBtn.addEventListener('click', () => {
        isLoginMode = true;
        modalTitle.textContent = 'Login';
        authSubmitBtn.textContent = 'Login';
        toggleAuthMode.textContent = 'Need an account? Sign Up';
        authMessage.textContent = '';
        authForm.reset();
        modal.style.display = 'flex'; // Use flex for centering
    });

    signupBtn.addEventListener('click', () => {
        isLoginMode = false;
        modalTitle.textContent = 'Sign Up';
        authSubmitBtn.textContent = 'Sign Up';
        toggleAuthMode.textContent = 'Already have an account? Login';
        authMessage.textContent = '';
        authForm.reset();
        modal.style.display = 'flex'; // Use flex for centering
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
                authMessage.className = 'message error';
            } else {
                authMessage.textContent = 'Login successful!';
                authMessage.className = 'message success';
                setTimeout(() => {
                    modal.style.display = 'none';
                    checkAuthStatus();
                }, 500); // Give user time to see success message
            }
        } else {
            const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
            if (signUpError) {
                authMessage.textContent = signUpError.message;
                authMessage.className = 'message error';
            } else {
                // Ensure participant profile is created after successful signup
                if (data.user) {
                    await ensureParticipantProfile(data.user);
                }

                authMessage.textContent = 'Sign up successful! Please check your email for confirmation.';
                authMessage.className = 'message success';
                setTimeout(() => {
                    isLoginMode = true; // Switch to login mode
                    modalTitle.textContent = 'Login';
                    authSubmitBtn.textContent = 'Login';
                    toggleAuthMode.textContent = 'Need an account? Sign Up';
                    authMessage.textContent = '';
                    authForm.reset();
                }, 2000); // Show confirmation message then switch to login
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
        }
    });

    // --- Auth Status Check ---
    async function checkAuthStatus() {
        const user = await getCurrentUser();
        if (user) {
            authLinks.style.display = 'none';
            userInfo.style.display = 'inline-flex'; // Use flex for align items
            const profile = await getParticipantProfile(user.id);
            if (profile && profile.display_name) {
                usernameDisplay.textContent = profile.display_name;
            } else {
                usernameDisplay.textContent = user.email || 'Guest'; // Fallback
            }
        } else {
            authLinks.style.display = 'inline-flex';
            userInfo.style.display = 'none';
            usernameDisplay.textContent = '';
        }
    }

    // --- Navigation Button Handlers ---
    auctioneerBtn.addEventListener('click', async () => {
        const user = await getCurrentUser();
        if (!user) {
            alert('Please login/signup to access the Auctioneer Dashboard.');
            loginBtn.click(); // Open login modal
        } else {
            window.location.href = 'auctioneer.html';
        }
    });

    bidderBtn.addEventListener('click', async () => {
        const user = await getCurrentUser();
        if (!user) {
            alert('Please login/signup to access the Bidder Dashboard.');
            loginBtn.click(); // Open login modal
        } else {
            window.location.href = 'bidder.html';
        }
    });

    // Initial load
    checkAuthStatus();
});
