// This file sets up the Firebase client and handles authentication.
// It is used by all other JavaScript files.

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAwioYa6AGdvHu2Zz2TS185Lt-6f-pnvns",
  authDomain: "efootball-auction-cee8e.firebaseapp.com",
  projectId: "efootball-auction-cee8e",
  storageBucket: "efootball-auction-cee8e.firebasestorage.app",
  messagingSenderId: "228372328370",
  appId: "1:228372328370:web:e954dba1110bcd2f1c7eab",
  measurementId: "G-RGWK5LWY7N"
};

// Global variable provided by the Canvas environment for app ID.
const appId = typeof __app_id !== 'undefined' ? __app_id : firebaseConfig.projectId;

// Initialize Firebase
let app;
let db;
let auth;

try {
    // Check if Firebase is already initialized
    if (!firebase.apps.length) {
        app = firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
        auth = firebase.auth();
        console.log("Firebase initialized successfully.");
    } else {
        // Re-use an existing Firebase app if it exists
        app = firebase.app();
        db = firebase.firestore();
        auth = firebase.auth();
        console.log("Firebase already initialized.");
    }
} catch (error) {
    console.error("Firebase initialization failed:", error);
    showToast('Firebase initialization failed. Check your configuration.', 'error');
}


let userId = null;
let isAuthReady = false;

async function authenticate() {
    try {
        // We will use anonymous sign-in for this simple application.
        await auth.signInAnonymously();
        console.log("Signed in anonymously.");
    } catch (error) {
        console.error("Firebase authentication failed:", error);
        showToast('Firebase authentication failed. Please try again.', 'error');
    }
}

// Listen for auth state changes to get the user ID
auth.onAuthStateChanged(user => {
    if (user) {
        userId = user.uid;
        isAuthReady = true;
        console.log("User authenticated:", userId);
    } else {
        userId = crypto.randomUUID(); // Fallback to a temporary ID if auth fails
        isAuthReady = true;
        console.log("User is not authenticated, using a temporary ID:", userId);
    }
});

// Start the authentication process
authenticate();

