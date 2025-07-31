// Initialize Supabase client
const supabaseUrl = 'YOUR_SUPABASE_URL'; // Replace with your Supabase Project URL
const supabaseAnonKey = 'YOUR_SUPABASE_ANON_KEY'; // Replace with your Supabase Public (anon) Key

const supabaseClient = supabase.createClient(supabaseUrl, supabaseAnonKey);

// Make the supabase client globally accessible (optional, but convenient for small apps)
window.supabaseClient = supabaseClient;

console.log('Supabase client initialized.');
