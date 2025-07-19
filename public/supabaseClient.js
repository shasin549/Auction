// supabaseClient.js - Centralized Supabase client configuration
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

// Configuration (same for all environments)
const supabaseUrl = 'https://flwqvepusbjmgoovqvmi.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZsd3F2ZXB1c2JqbWdvb3Zxdm1pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI5MDY3MzMsImV4cCI6MjA2ODQ4MjczM30.or5cIl99nUDZceOKlFMnu8PCzLuCvXT5TBJvKTPSUvM'

// Create and configure the Supabase client
const supabase = createClient(supabaseUrl, supabaseKey, {
  db: {
    schema: 'public'
  },
  auth: {
    persistSession: false, // Recommended for real-time applications
    autoRefreshToken: false
  }
})

// Add error logging
supabase.onError((error) => {
  console.error('Supabase Error:', error)
})

// Test connection function (optional)
export async function testConnection() {
  const { data, error } = await supabase
    .from('rooms')
    .select('id')
    .limit(1)
  
  if (error) {
    console.error('Supabase connection test failed:', error)
    return false
  }
  return true
}

// Export the configured client
export default supabase