require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function test() {
    let toPhone = "+91 7826936919";
    const clientId = "AZL-0004";
    console.log("Looking up phone:", toPhone);
    const last10 = toPhone.slice(-10);
    const { data: leads, error: leadErr } = await supabase.from('leads').select('*').eq('client_id', clientId).like('phone', '%' + last10 + '%');
    console.log("Leads found:", leads);
    const { data: calls, error: callErr } = await supabase.from('calls').select('ai_summary, direction, created_at, transcript').eq('client_id', clientId).like('caller_phone', '%' + last10 + '%').order('created_at', { ascending: false }).limit(3);
    console.log("Calls found:", calls);
}
test();
