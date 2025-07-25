// public/supabaseClient.js (100% complete and safe)

// Load Supabase client via CDN and initialize it globally

const SUPABASE_URL = 'https://flwqvepusbjmgoovqvmi.supabase.co'; const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZsd3F2ZXB1c2JqbWdvb3Zxdm1pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI5MDY3MzMsImV4cCI6MjA2ODQ4MjczM30.or5cIl99nUDZceOKlFMnu8PCzLuCvXT5TBJvKTPSUvM';

// Prevent re-initialization if already loaded (important for dev hot reloads) if (typeof supabase === 'undefined') { var supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY); }

// Optional: test connection 
(async () => { try { const { error } = await supabase.from('rooms').select('*').limit(1); if (error) console.warn('🟠 Supabase test query failed:', error.message); else console.log('✅ Supabase client connected'); } catch (e) { console.error('❌ Supabase connection error:', e); } })();

