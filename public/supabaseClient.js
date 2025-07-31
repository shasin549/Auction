// Initialize the Supabase client
const SUPABASE_URL = 'https://flwqvepusbjmgoovqvmi.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZsd3F2ZXB1c2JqbWdvb3Zxdm1pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI5MDY3MzMsImV4cCI6MjA2ODQ4MjczM30.or5cIl99nUDZceOKsFVMnu8PCyLuCvXT5TBJvKTPSUvM';

export const supabase = Supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Helper function to get current user
export async function getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
}

// Helper function to get user's participant profile (display_name)
export async function getParticipantProfile(userId) {
    if (!userId) return null;
    const { data, error } = await supabase
        .from('participants')
        .select('display_name')
        .eq('id', userId)
        .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 means no rows found (expected for new users)
        console.error('Error fetching participant profile:', error.message);
        return null;
    }
    return data; // { display_name: "User Name" } or null
}

// Function to ensure a participant profile exists for the user
export async function ensureParticipantProfile(user) {
    if (!user) return;

    const profile = await getParticipantProfile(user.id);
    if (!profile) {
        // Create a default profile if it doesn't exist
        const defaultDisplayName = user.email.split('@')[0] || 'Anonymous';
        const { error } = await supabase
            .from('participants')
            .insert({ id: user.id, display_name: defaultDisplayName });
        if (error) {
            console.error('Error creating participant profile:', error.message);
        } else {
            console.log('Participant profile created.');
        }
    }
}
