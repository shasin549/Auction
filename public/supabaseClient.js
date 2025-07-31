// Initialize the Supabase client
const SUPABASE_URL = 'https://flwqvepusbjmgoovqvmi.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZsd3F2ZXB1c2JqbWdvb3Zxdm1pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI5MDY3MzMsImV4cCI6MjA2ODQ4MjczM30.or5cIl99nUDZceOKsFVMnu8PCyLuCvXT5TBJvKTPSUvM';

export const supabase = Supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Generates a simple UUID for anonymous user tracking.
 * In a real application, consider a more robust ID system or proper auth.
 */
function generateUuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * Gets or creates a unique client ID for the current browser session.
 * This ID is used for presence and to identify an anonymous "participant".
 */
export function getOrCreateClientId() {
    let clientId = localStorage.getItem('anon_client_id');
    if (!clientId) {
        clientId = generateUuid();
        localStorage.setItem('anon_client_id', clientId);
    }
    return clientId;
}


/**
 * Calls the Supabase RPC to set the 'app.manage_token' session variable.
 * This is crucial for RLS policies that rely on the manage_token.
 * @param {string} token - The manage token for the room.
 */
export async function setSupabaseManageToken(token) {
    if (!token) {
        // Clear the token if provided null/undefined to prevent unauthorized actions
        console.warn("Clearing Supabase manage token.");
        const { data, error } = await supabase.rpc('set_manage_token', { token_val: null });
        if (error) console.error("Error clearing manage token RPC:", error.message);
        return;
    }
    const { data, error } = await supabase.rpc('set_manage_token', { token_val: token });
    if (error) {
        console.error("Error setting manage token RPC:", error.message);
        // It's critical to handle this error, as subsequent RLS-protected actions will fail
        throw new Error("Failed to set manage token for session.");
    }
}

/**
 * Manages the participant's display name, typically stored in localStorage.
 * @param {string} key - 'auctioneer_display_name' or 'bidder_display_name'
 * @returns {string|null} The stored display name.
 */
export function getStoredDisplayName(key) {
    return localStorage.getItem(key);
}

/**
 * Sets the participant's display name in localStorage.
 * @param {string} key - 'auctioneer_display_name' or 'bidder_display_name'
 * @param {string} name - The display name to store.
 */
export function setStoredDisplayName(key, name) {
    localStorage.setItem(key, name);
}

/**
 * Removes the participant's display name from localStorage.
 * @param {string} key - 'auctioneer_display_name' or 'bidder_display_name'
 */
export function clearStoredDisplayName(key) {
    localStorage.removeItem(key);
}
