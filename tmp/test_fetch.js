require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function testSupabase() {
    const finalDbUrl = 'https://qhqmljwexivhvxzfklum.supabase.co';
    const finalDbKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFocW1sandleGl2aHZ4emZrbHVtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ3MjI3NjQsImV4cCI6MjA4Njg0MDA2M30.M0N3e-7u58W0G2Cis_G1410X83Y9V8n-6P88z4zL0nU';
    
    console.log("Initializing Supabase Client...");
    const supabase = createClient(finalDbUrl, finalDbKey);
    
    console.log("Fetching appointments...");
    const { data: calls, error } = await supabase
        .from('appointments')
        .select('*')
        .limit(1);
        
    if (error) {
        console.error("❌ Fetch Error:", error);
    } else {
        console.log("✅ Success! Fetched rows:", calls ? calls.length : 0);
    }
}

testSupabase();
