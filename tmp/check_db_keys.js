
const { createClient } = require('@supabase/supabase-js');
const finalDbUrl = 'https://qhqmljwexivhvxzfklum.supabase.co';
const finalDbKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFocW1sandleGl2aHZ4emZrbHVtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3OTM3MjMsImV4cCI6MjA5MDM2OTcyM30.nO_aKJkRRsDNSIWDLgmvos7LxISvenFz2Fwn-62BgLo';
const supabase = createClient(finalDbUrl, finalDbKey);

async function check() {
    const { data, error } = await supabase.from('platform_settings').select('*');
    if (error) {
        console.error('Error:', error);
        return;
    }
    console.log('Platform Settings:', JSON.stringify(data, null, 2));
}

check();
