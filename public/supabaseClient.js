// public/supabaseClient.js

// Ensure Supabase is loaded via CDN
// Add this to your HTML before this script:
// <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js"></script>

const SUPABASE_URL = 'https://flwqvepusbjmgoovqvmi.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZsd3F2ZXB1c2JqbWdvb3Zxdm1pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI5MDY3MzMsImV4cCI6MjA2ODQ4MjczM30.or5cIl99nUDZceOKlFMnu8PCzLuCvXT5TBJvKTPSUvM';

// Only create the Supabase client if it doesn't exist
if (typeof supabase === 'undefined') {
  var supabase = supabase || window.supabase || createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// Optional: Test connection
(async () => {
  try {
    const { error } = await supabase.from('rooms').select('*').limit(1);
    if (error) {
      console.warn('🟠 Supabase test query failed:', error.message);
    } else {
      console.log('✅ Supabase client is working');
    }
  } catch (err) {
    console.error('❌ Supabase connection test failed:', err);
  }
})();