// This file sets up the Firebase client and handles authentication.
// It is used by all other JavaScript files.

// Global variables provided by the Canvas environment.
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// Initialize Firebase
let app;
let db;
let auth;

// Check if Firebase is already initialized
if (!firebase.apps.length) {
    app = firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    auth = firebase.auth();
    console.log("Firebase initialized.");
} else {
    // Re-use an existing Firebase app if it exists
    app = firebase.app();
    db = firebase.firestore();
    auth = firebase.auth();
    console.log("Firebase already initialized.");
}

let userId = null;
let isAuthReady = false;

async function authenticate() {
    try {
        if (initialAuthToken) {
            await auth.signInWithCustomToken(initialAuthToken);
            console.log("Signed in with custom token.");
        } else {
            await auth.signInAnonymously();
            console.log("Signed in anonymously.");
        }
    } catch (error) {
        console.error("Firebase authentication failed:", error);
    }
}

// Listen for auth state changes
auth.onAuthStateChanged(user => {
    if (user) {
        userId = user.uid;
        isAuthReady = true;
        console.log("User authenticated:", userId);
    } else {
        userId = crypto.randomUUID(); // Use a random ID if not authenticated
        isAuthReady = true;
        console.log("User is not authenticated, using a temporary ID:", userId);
    }
});

// Immediately try to authenticate
authenticate();

