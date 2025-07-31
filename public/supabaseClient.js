// Initialize the Supabase client
const SUPABASE_URL = 'https://flwqvepusbjmgoovqvmi.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZsd3F2ZXB1c2JqbWdvb3Zxdm1pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI5MDY3MzMsImV4cCI6MjA2ODQ4MjczM30.or5cIl99nUDZceOKlFMnu8PCyLuCvXT5TBJvKTPSUvM';

export const supabase = Supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Helper function to get current user
export async function getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
}

// Helper function to get user profile (now attempts to get 'name' from 'players Table')
export async function getUserProfile(userId) {
    const { data, error } = await supabase
        .from('players Table') // Query your 'players Table'
        .select('name') // Select the 'name' column
        .eq('id', userId) // Assuming 'id' in 'players Table' matches auth.users.id
        .single();

    if (error) {
        console.warn('Error fetching user profile from "players Table":', error.message, 'Falling back to email for display.');
        return null;
    }
    return data; // Will contain { name: "Player Name" } or similar
}
