const twilio = require('twilio');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://qhqmljwexivhvxzfklum.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFocW1sandleGl2aHZ4emZrbHVtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3OTM3MjMsImV4cCI6MjA5MDM2OTcyM30.nO_aKJkRRsDNSIWDLgmvos7LxISvenFz2Fwn-62BgLo';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTwilioErrors() {
    const { data: twInt } = await supabase.from('integrations').select('*').eq('provider', 'twilio').eq('client_id', 'AZL-0003').maybeSingle();
    
    if (!twInt) {
        console.log("No Twilio integration found for AZL-0003");
        return;
    }

    const TWILIO_SID = twInt.meta_data.sid;
    const TWILIO_AUTH = twInt.api_key;

    const client = twilio(TWILIO_SID, TWILIO_AUTH);

    try {
        const notifications = await client.monitor.v1.alerts.list({limit: 5});
        for (let n of notifications) {
            console.log(`[${n.dateGenerated}] Error ${n.errorCode}: ${n.alertText}`);
            // if (n.requestUrl) console.log(`   URL: ${n.requestUrl}`);
        }
    } catch (e) {
        console.error("Failed to fetch Twilio alerts:", e.message);
    }
}

checkTwilioErrors();
