require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const twilio = require('twilio');

async function testTwilio() {
  const SUPABASE_URL = process.env.SUPABASE_URL || 'https://yplraarslqarwuedzlfr.supabase.co';
  const SUPABASE_KEY = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlwbHJhYXJzbHFhcnd1ZWR6bGZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNjQwNjMsImV4cCI6MjA4Njg0MDA2M30.YDQsu_sc_QF4v6wpe8uW8u-OlvMludrnAqBdN8AMHoI';
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  
  console.log("Fetching twilio integraton from database...");
  const { data: twInt, error } = await supabase.from('integrations').select('*').eq('provider', 'twilio').single();
  
  if (error) {
    console.log("Supabase error fetching Twilio:", error.message);
    return;
  }
  
  if (!twInt) {
    console.log("No Twilio row found in the database. Relying on .env fallback.");
  } else {
    console.log("Found Twilio credentials in DB.");
  }

  const sid = (twInt?.meta_data?.sid || process.env.TWILIO_ACCOUNT_SID || '').trim();
  const auth = (twInt?.api_key || process.env.TWILIO_AUTH_TOKEN || '').trim();
  const phone = (twInt?.meta_data?.phone || process.env.TWILIO_PHONE_NUMBER || '').trim();

  console.log(`SID Length: ${sid.length}, Starts with AC: ${sid.startsWith('AC')}`);
  console.log(`AUTH Length: ${auth.length}, Starts with ********: ${auth.includes('****')}`);
  console.log(`PHONE Length: ${phone.length}`);

  if (!sid || !auth) {
    console.log("Missing SID or AUTH to test.")
    return;
  }
  
  if (auth.includes('****')) {
    console.log("CRITICAL ERROR: Auth token is literal *******!");
    return;
  }

  console.log("\nAttempting to connect to Twilio API natively...");
  const client = twilio(sid, auth);
  
  try {
    const records = await client.calls.list({limit: 1});
    console.log("SUCCESS! Twilio authentication worked. Found calls:", records.length);
  } catch(e) {
    console.log("TWILIO API ERROR:");
    console.log("Message:", e.message);
    console.log("Code:", e.code);
    console.log("Status:", e.status);
  }
}

testTwilio();
