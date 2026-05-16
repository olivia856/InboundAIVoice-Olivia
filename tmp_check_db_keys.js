const { createClient } = require('@supabase/supabase-js');

const supabase = createClient('https://qhqmljwexivhvxzfklum.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFocW1sandleGl2aHZ4emZrbHVtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ3MjI3NjQsImV4cCI6MjA2MDMwMjc2NH0.M0N3e-7u58W0G2Cis_G1410X83Y9V8n-6P88z4zL0nU');

async function test() {
    const { data } = await supabase.from('integrations').select('*').eq('provider', 'ultravox');
    console.log("Keys:", data);
}
test();
