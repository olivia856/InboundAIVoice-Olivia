const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const twilio = require('twilio');
const { Resend } = require('resend');
const nodemailer = require('nodemailer');
const cron = require('node-cron');
const axios = require('axios');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

// Polyfill fetch for older Node.js versions
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args)).catch(() => require('node-fetch')(...args));

const app = express();
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.json({ limit: '10mb' }));
app.use(cors());

// Friendly greeting for the root URL so the browser doesn't show an error
app.get('/', (req, res) => {
    res.send('✅ Azlon AI Backend is Live & Running! [v3.0 - caller-profiles]');
});

// Version endpoint for deployment verification
app.get('/api/version', (req, res) => {
    res.json({ version: '3.0', build: 'caller-profiles', timestamp: new Date().toISOString() });
});

// Inbound Webhook URL for clients to paste in Twilio
app.get('/api/inbound-webhook-url', (req, res) => {
    const { client_id } = req.query;
    let baseUrl = process.env.BACKEND_URL || `https://${req.get('host')}`;
    baseUrl = baseUrl.replace(/\/$/, '');
    const webhookUrl = client_id
        ? `${baseUrl}/api/twilio/inbound?client_id=${client_id}`
        : `${baseUrl}/api/twilio/inbound`;
    res.json({ success: true, webhook_url: webhookUrl });
});

const PORT = 8000;
const ULTRAVOX_API_KEY = process.env.ULTRAVOX_API_KEY;

// Base URL for Twilio callbacks (Prefer environment variable)
const BACKEND_URL = process.env.BACKEND_URL || process.env.SERVER_BASE_URL || '';
if (!BACKEND_URL) {
    console.warn("⚠️ [Startup] WARNING: BACKEND_URL environment variable is not set. Many callbacks will use the request host header, which might be unreliable in some environments.");
} else {
    console.log(`✅ [Startup] BACKEND_URL is configured as: ${BACKEND_URL}`);
}

// Hardcode failsafe for truncated Easypanel environment variables
let finalDbUrl = 'https://qhqmljwexivhvxzfklum.supabase.co';
let finalDbKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFocW1sandleGl2aHZ4emZrbHVtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3OTM3MjMsImV4cCI6MjA5MDM2OTcyM30.nO_aKJkRRsDNSIWDLgmvos7LxISvenFz2Fwn-62BgLo';
const supabase = createClient(finalDbUrl, finalDbKey);

// --- AUTO-MIGRATE: Add campaign_goal, tools_config, record_calls columns if they don't exist ---
(async () => {
    try {
        // 1. Check campaign_goal
        const { error: errorGoal } = await supabase.from('agent_settings').select('campaign_goal').limit(1);
        if (errorGoal && errorGoal.message && errorGoal.message.includes('campaign_goal')) {
            console.log('[Migration] campaign_goal column missing, attempting to add...');
            await supabase.rpc('exec_sql', { sql: 'ALTER TABLE agent_settings ADD COLUMN IF NOT EXISTS campaign_goal TEXT;' }).catch(() => {});
        }
        
        // 2. Check tools_config
        const { error: errorTools } = await supabase.from('agent_settings').select('tools_config').limit(1);
        if (errorTools && errorTools.message && (errorTools.message.includes('tools_config') || errorTools.message.includes('column') || errorTools.code === 'PGRST204')) {
            console.log('[Migration] tools_config column missing, attempting to add...');
            await supabase.rpc('exec_sql', { sql: 'ALTER TABLE agent_settings ADD COLUMN IF NOT EXISTS tools_config JSONB DEFAULT \'{"hangUp": true, "transferCall": false, "queryCorpus": false, "leaveVoicemail": false, "playDtmfSounds": false}\'::jsonb;' }).catch(() => {});
        }
        
        // 3. Check record_calls
        const { error: errorRecord } = await supabase.from('agent_settings').select('record_calls').limit(1);
        if (errorRecord && errorRecord.message && (errorRecord.message.includes('record_calls') || errorRecord.message.includes('column') || errorRecord.code === 'PGRST204')) {
            console.log('[Migration] record_calls column missing, attempting to add...');
            await supabase.rpc('exec_sql', { sql: 'ALTER TABLE agent_settings ADD COLUMN IF NOT EXISTS record_calls BOOLEAN DEFAULT true;' }).catch(() => {});
        }
        
        console.log('[Migration] Column checks completed.');
    } catch(e) { 
        console.warn('[Migration] Auto-migration warning:', e.message); 
    }
})();
// --- AWS S3 NOTIFICATION ENGINE ---
async function getS3Client() {
    // Check platform settings first, then client integrations, then env vars
    const { data: platformS3 } = await supabase.from('platform_settings').select('*').eq('provider', 'aws_s3').maybeSingle();
    const { data: awsInt } = await supabase.from('integrations').select('*').eq('provider', 'aws_s3').maybeSingle();
    
    const region = platformS3?.meta_data?.region || awsInt?.meta_data?.region || process.env.AWS_REGION || 'us-east-1';
    const accessKeyId = platformS3?.meta_data?.access_key || awsInt?.meta_data?.access_key || process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = platformS3?.api_key || awsInt?.api_key || process.env.AWS_SECRET_ACCESS_KEY;
    const bucketName = platformS3?.meta_data?.bucket || awsInt?.meta_data?.bucket || process.env.AWS_S3_BUCKET;

    if (!accessKeyId || !secretAccessKey) return null;

    const client = new S3Client({
        region,
        credentials: {
            accessKeyId,
            secretAccessKey
        }
    });
    client._bucketName = bucketName; // attach for convenience
    return client;
}

// --- PLATFORM KEY HELPER ---
// Reads the API key for a given provider from platform_settings table (super admin settings)
// Falls back to integrations table (client_id IS NULL means platform-level) then env vars.
async function getPlatformKey(provider) {
    try {
        const { data } = await supabase
            .from('platform_settings')
            .select('api_key, meta_data')
            .eq('provider', provider)
            .maybeSingle();
        if (data && data.api_key && data.api_key.length > 10) return data;
    } catch (e) {
        console.warn(`[getPlatformKey] platform_settings lookup failed for ${provider}:`, e.message);
    }
    // Also try integrations table with no client_id (platform-level row)
    try {
        const { data } = await supabase
            .from('integrations')
            .select('api_key, meta_data')
            .eq('provider', provider)
            .is('client_id', null)
            .maybeSingle();
        if (data && data.api_key && data.api_key.length > 10) return data;
    } catch (e) {
        console.warn(`[getPlatformKey] integrations lookup failed for ${provider}:`, e.message);
    }
    return null;
}

// --- OMNICHANNEL NOTIFICATIONS ENGINE ---
async function dispatchOmnichannel(appointmentId, name, phone, email, templateType, dynamicData) {
    console.log(`[Omnichannel] Dispatching ${templateType} for ${name} (ID: ${appointmentId})`);

    // --- 0. Get client_id from appointment ---
    let clientId = null;
    let companyName = "our company";
    if (appointmentId && appointmentId !== 'unknown') {
        const { data: appt } = await supabase.from('appointments').select('client_id').eq('id', appointmentId).maybeSingle();
        clientId = appt?.client_id || null;
        if (clientId) {
            const { data: client } = await supabase.from('clients').select('name').eq('client_code', clientId).maybeSingle();
            if (client?.name) companyName = client.name;
        }
    }

    // --- 1. Fetch Integration Keys (client-specific first, then platform fallback) ---
    const { data: twInt } = clientId
        ? await supabase.from('integrations').select('*').eq('provider', 'twilio').eq('client_id', clientId).maybeSingle()
        : { data: null };
    const { data: reInt } = clientId
        ? await supabase.from('integrations').select('*').eq('provider', 'resend').eq('client_id', clientId).maybeSingle()
        : { data: null };

    // Platform fallbacks
    const platformTw = await getPlatformKey('twilio');
    const platformRe = await getPlatformKey('resend');

    const TWILIO_SID = twInt?.meta_data?.sid || platformTw?.meta_data?.sid || process.env.TWILIO_ACCOUNT_SID;
    const TWILIO_AUTH = twInt?.api_key || platformTw?.api_key || process.env.TWILIO_AUTH_TOKEN;
    const TWILIO_PHONE = twInt?.meta_data?.phone || platformTw?.meta_data?.phone || process.env.TWILIO_PHONE_NUMBER;
    const RESEND_API_KEY = reInt?.api_key || platformRe?.api_key || process.env.RESEND_API_KEY;
    const TWILIO_WHATSAPP_SENDER = twInt?.meta_data?.whatsapp_phone || process.env.TWILIO_WHATSAPP_SENDER || 'whatsapp:+16895880182';

    console.log(`[Omnichannel] Using client_id=${clientId}, companyName=${companyName}, TWILIO_SID=${TWILIO_SID ? 'set' : 'MISSING'}, TWILIO_PHONE=${TWILIO_PHONE || 'MISSING'}`);


    const startTimeStr = dynamicData?.start_time ? new Date(dynamicData.start_time).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : "your scheduled time";

    let smsBody = "";
    let emailSubject = "";
    let emailHtml = "";

    if (templateType === 'booking_confirmed') {
        smsBody = `Hi ${name}, your ${companyName} appointment is confirmed for ${startTimeStr}. See you soon!`;
        emailSubject = `Your appointment is confirmed, ${name}!`;
        emailHtml = `<h2>Booking Confirmed</h2><p>Hi ${name},</p><p>We have successfully scheduled your appointment for <b>${startTimeStr}</b>.</p><p>We look forward to speaking with you.</p>`;
    } else if (templateType === 'meeting_reminder') {
        smsBody = `Reminder: Hi ${name}, your appointment is in 15 minutes at ${startTimeStr}. Please be ready!`;
        emailSubject = `Reminder: Your Appointment is in 15 Minutes`;
        emailHtml = `<h2>Appointment Reminder</h2><p>Hi ${name},</p><p>This is a quick reminder that your appointment starts in <b>15 minutes</b> at <b>${startTimeStr}</b>. Please be ready!</p>`;
    } else if (templateType === 'meeting_missed') {
        smsBody = `Hi ${name}, we missed you at your meeting today. Let us know when you're free to reschedule!`;
        emailSubject = `Sorry we missed you, ${name}`;
        emailHtml = `<h2>We missed you!</h2><p>Hi ${name},</p><p>We didn't see you at your appointment today at ${startTimeStr}.</p><p>Please let us know when you would like to reschedule!</p>`;
    } else if (templateType === 'follow_up') {
        smsBody = `Hi ${name}, thanks for speaking with us today! If you have any more questions about ${companyName}, feel free to ask here.`;
        emailSubject = `Great speaking with you, ${name}!`;
        emailHtml = `<h2>Thank you!</h2><p>Hi ${name},</p><p>It was great speaking with you earlier. If you have any further questions or need assistance, we're here to help.</p>`;
    } else if (templateType === 'booking_updated') {
        smsBody = `Hi ${name}, your ${companyName} appointment has been correctly rescheduled to ${startTimeStr}. We will speak with you then!`;
        emailSubject = `Your appointment has been updated, ${name}`;
        emailHtml = `<h2>Booking Rescheduled</h2><p>Hi ${name},</p><p>Your appointment has been successfully moved to <b>${startTimeStr}</b>.</p><p>We look forward to speaking with you.</p>`;
    } else if (templateType === 'booking_deleted') {
        smsBody = `Hi ${name}, your ${companyName} appointment has been cancelled as requested. Just text back whenever you're ready to re-book!`;
        emailSubject = `Your appointment has been cancelled`;
        emailHtml = `<h2>Booking Cancelled</h2><p>Hi ${name},</p><p>Per your request, we have cancelled your upcoming appointment.</p><p>Feel free to reach out when you're ready to reschedule.</p>`;
    }

    // --- 2. SMS via Twilio ---
    if (phone && TWILIO_SID && TWILIO_AUTH && TWILIO_PHONE) {
        const twilioClient = require('twilio')(TWILIO_SID, TWILIO_AUTH);
        let nums = String(phone).replace(/\D/g, '');
        const cleanPhone = String(phone).startsWith('+') ? String(phone) : (nums.length === 10 ? `+91${nums}` : `+${nums}`);
        
        try {
            await twilioClient.messages.create({ body: smsBody, from: TWILIO_PHONE, to: cleanPhone });
            console.log(`[Omnichannel] SMS sent to ${cleanPhone}`);
            if (appointmentId && appointmentId !== 'unknown') {
                await supabase.from('appointments').update({ sms_status: 'Sent' }).eq('id', appointmentId);
            }
        } catch(e) {
            console.error(`[Omnichannel] Twilio SMS Error:`, e.message);
            if (appointmentId && appointmentId !== 'unknown') {
                await supabase.from('appointments').update({ sms_status: 'Failed' }).eq('id', appointmentId);
            }
        }

        // --- 2.5 WhatsApp via Twilio ---
        const TWILIO_WHATSAPP_SENDER = twInt?.meta_data?.whatsapp_phone || process.env.TWILIO_WHATSAPP_SENDER || 'whatsapp:+16895880182';
        let waSenderFormat = TWILIO_WHATSAPP_SENDER.startsWith('whatsapp:') ? TWILIO_WHATSAPP_SENDER : `whatsapp:${TWILIO_WHATSAPP_SENDER}`;
        try {
            await twilioClient.messages.create({ body: smsBody, from: waSenderFormat, to: `whatsapp:${cleanPhone}` });
            console.log(`[Omnichannel] WhatsApp (Twilio) sent to ${cleanPhone}`);
            if (appointmentId && appointmentId !== 'unknown') {
                await supabase.from('appointments').update({ whatsapp_status: 'Sent' }).eq('id', appointmentId);
            }
        } catch(e) {
            console.error(`[Omnichannel] Twilio WhatsApp Error:`, e.message);
            if (appointmentId && appointmentId !== 'unknown') {
                await supabase.from('appointments').update({ whatsapp_status: 'Failed' }).eq('id', appointmentId);
            }
        }
    }

    // --- 3. Email Delivery (Dual Support) ---
    if (email) {
        // Priority 1: Gmail (SMTP) if credentials exist
        if (GMAIL_USER && GMAIL_PASS) {
            try {
                const transporter = nodemailer.createTransport({
                    service: 'gmail',
                    auth: { user: GMAIL_USER, pass: GMAIL_PASS }
                });
                await transporter.sendMail({
                    from: `"${companyName}" <${GMAIL_USER}>`,
                    to: email,
                    subject: emailSubject,
                    html: emailHtml
                });
                console.log(`[Omnichannel] Gmail sent to ${email}`);
                
                if (appointmentId && appointmentId !== 'unknown') {
                    await supabase.from('appointments').update({ email_status: 'Sent' }).eq('id', appointmentId);
                }
                return; // Sent!
            } catch(e) {
                console.error(`[Omnichannel] Gmail Error (falling back):`, e.message);
                if (appointmentId && appointmentId !== 'unknown') {
                    await supabase.from('appointments').update({ email_status: 'Failed' }).eq('id', appointmentId);
                }
            }
        }

        // Priority 2: Resend
        if (RESEND_API_KEY) {
            try {
                const resend = new Resend(RESEND_API_KEY);
                await resend.emails.send({
                    from: `${companyName} <onboarding@resend.dev>`, // Verifying domain needed for external
                    to: [email],
                    subject: emailSubject,
                    html: emailHtml
                });
                console.log(`[Omnichannel] Resend sent to ${email}`);
                if (appointmentId && appointmentId !== 'unknown') {
                    await supabase.from('appointments').update({ email_status: 'Sent' }).eq('id', appointmentId);
                }
            } catch(e) {
                console.error(`[Omnichannel] Resend Error:`, e.message);
                if (appointmentId && appointmentId !== 'unknown') {
                    await supabase.from('appointments').update({ email_status: 'Failed' }).eq('id', appointmentId);
                }
            }
        }
    }
}
// --- END OMNICHANNEL ENGINE ---

// --- PLATFORM SETTINGS (Master API Keys) ---
// Helper: Get a platform-level key by provider name
async function getPlatformKey(provider) {
    const { data } = await supabase
        .from('platform_settings')
        .select('*')
        .eq('provider', provider)
        .maybeSingle();
    return data;
}

// GET all platform settings
app.get('/api/platform-settings', async (req, res) => {
    try {
        const { data, error } = await supabase.from('platform_settings').select('*');
        if (error) throw error;
        // Mask sensitive keys for display
        const masked = (data || []).map(s => ({
            ...s,
            api_key: s.api_key ? '••••••' + s.api_key.slice(-4) : '',
        }));
        res.json({ success: true, settings: masked });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST save/update a platform setting
app.post('/api/platform-settings', async (req, res) => {
    try {
        const { provider, api_key, meta_data } = req.body;
        if (!provider) return res.status(400).json({ success: false, error: 'Provider is required' });

        // Upsert: update if exists, insert if not
        const { data: existing } = await supabase
            .from('platform_settings')
            .select('id, api_key')
            .eq('provider', provider)
            .maybeSingle();

        let result;
        if (existing) {
            const updatePayload = {};
            if (api_key) {
                let finalApiKey = api_key.trim();
                if (finalApiKey.includes('••••')) {
                    finalApiKey = existing.api_key || finalApiKey;
                }
                updatePayload.api_key = finalApiKey;
            }
            if (meta_data) updatePayload.meta_data = meta_data;
            updatePayload.updated_at = new Date().toISOString();
            result = await supabase.from('platform_settings').update(updatePayload).eq('id', existing.id).select().single();
        } else {
            result = await supabase.from('platform_settings').insert({
                provider,
                api_key: api_key || '',
                meta_data: meta_data || {},
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }).select().single();
        }

        if (result.error) throw result.error;
        res.json({ success: true, setting: result.data });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Inbound webhook from Twilio
// --- CLIENT MANAGEMENT (MULTI-TENANCY) ---
app.get('/api/clients', async (req, res) => {
    try {
        const { data, error } = await supabase.from('clients').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        res.json({ success: true, clients: data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/clients', async (req, res) => {
    try {
        const clientData = req.body;
        const { data, error } = await supabase.from('clients').insert([clientData]).select();
        if (error) throw error;
        res.json({ success: true, client: data[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/clients/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;
        const { data, error } = await supabase.from('clients').update(updateData).eq('id', id).select();
        if (error) throw error;
        res.json({ success: true, client: data[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/clients/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // id is the client identifier (e.g. AZL-0001) used to cascade delete isolated data
        const code = id;
        if (code) {
            console.log(`[Admin] Erasing all SaaS data for client code: ${code}`);
            await Promise.all([
                supabase.from('agent_settings').delete().eq('client_id', code),
                supabase.from('integrations').delete().eq('client_id', code),
                supabase.from('calls').delete().eq('client_id', code),
                supabase.from('leads').delete().eq('client_id', code),
                supabase.from('contacts').delete().eq('client_id', code),
                supabase.from('campaigns').delete().eq('client_id', code),
                supabase.from('campaign_contacts').delete().eq('client_id', code),
                supabase.from('appointments').delete().eq('client_id', code)
            ]);
        }

        const { error } = await supabase.from('clients').delete().eq('id', id);
        if (error) throw error;
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Portal Lookup by Slug
app.get('/api/clients/:slug', async (req, res) => {
    try {
        const { slug } = req.params;
        const { data, error } = await supabase.from('clients').select('*').eq('slug', slug).maybeSingle();
        if (error) throw error;
        if (!data) return res.status(404).json({ success: false, error: "Client not found" });
        res.json({ success: true, client: data });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/api/twilio/inbound', async (req, res) => {
    try {
        const { To, From, CallSid } = req.body;
        if (!To) {
            console.error("[Twilio Inbound] Missing 'To' number in request body.");
            res.set('Content-Type', 'text/xml');
            return res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?><Response><Say>Incoming call error: missing destination number.</Say></Response>`);
        }
        
        console.log(`[Twilio Inbound] Incoming call to ${To}. (Sid: ${CallSid})`);

        // 0. Find the Client by Twilio Number (Inbound Routing)
        const { data: client, error: clientErr } = await supabase.from('clients').select('client_code, agent_enabled, plan, mins_used').eq('twilio_phone', To).maybeSingle();
        if (clientErr) console.error("[Twilio Inbound] Database Error during client lookup:", clientErr);
        
        const clientId = client?.client_code || null; 
        console.log(`[Twilio Inbound] Resolved Client: ${clientId || 'NONE'}`);

        if (client) {
            if (client.agent_enabled === false) {
                console.log(`[Twilio Inbound] AI Agent is paused for ${To}. Rejecting call.`);
                return res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?><Response><Reject reason="busy"/></Response>`);
            }
            const planLimits = { Starter: 500, Pro: 2000, Business: 5000, Enterprise: null };
            const planKey = (client.plan || 'Starter').split(' ')[0];
            const limit = planLimits[planKey] ?? null;
            if (limit !== null && (client.mins_used || 0) >= limit) {
                console.log(`[Twilio Inbound] AI Agent limit exhausted for ${To}. Rejecting call.`);
                return res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?><Response><Reject reason="busy"/></Response>`);
            }
        }

        // 1. Determine key and base URL
        let ACTIVE_ULTRAVOX_KEY = process.env.ULTRAVOX_API_KEY;
        try {
            const { data: clientUV } = await supabase.from('integrations').select('*').eq('provider', 'ultravox').eq('client_id', clientId).maybeSingle();
            const platformUV = await getPlatformKey('ultravox');
            ACTIVE_ULTRAVOX_KEY = clientUV?.api_key || platformUV?.api_key || ACTIVE_ULTRAVOX_KEY;
        } catch (dbErr) {
            console.error("[Twilio Inbound] Key lookup error:", dbErr.message);
        }

        if (!ACTIVE_ULTRAVOX_KEY) {
            console.error("[Twilio Inbound] CRITICAL: No Ultravox key found.");
            res.set('Content-Type', 'text/xml');
            return res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?><Response><Say>AI configuration is missing. Please contact support.</Say></Response>`);
        }

        // 2. Check database for Custom System Prompt and settings for THIS client
        // Ensure we don't accidentally load a null/default row if clientId is missing
        const { data: agentData } = clientId ? await supabase.from('agent_settings').select('*').eq('client_id', clientId).maybeSingle() : { data: null };
        const { data: clientRow } = clientId ? await supabase.from('clients').select('name').eq('client_code', clientId).maybeSingle() : { data: null };
        
        // Safety Guard: If no clientRow found, we MUST NOT use Azlon AI defaults.
        const companyName = clientRow?.name || "our company";
        const fallbackPrompt = `You are the smart AI receptionist for ${companyName}. Keep answers extremely short, professional, and confident. Focus on booking appointments and answering questions using the Knowledge Base. Avoid repeating your introduction unless specifically asked.`;
        
        let finalPrompt = agentData?.system_prompt || fallbackPrompt;
        let initialMessage = undefined;

        // 2.2 CALLER MEMORY SYSTEM v3 — caller_profiles + leads + calls fallback
        let callerProfile = null;
        if (From) {
            try {
                const cleanCaller = String(From).replace(/\D/g, '');
                if (cleanCaller.length >= 10) {
                    const callerSuffix = cleanCaller.slice(-10);

                    // === LAYER 0 (NEW): Check caller_profiles table ===
                    try {
                        let profileQuery = supabase.from('caller_profiles').select('*').eq('phone_suffix', callerSuffix);
                        if (clientId && clientId !== 'undefined' && clientId !== 'null') {
                            profileQuery = profileQuery.eq('client_id', clientId);
                        }
                        const { data: profiles } = await profileQuery.limit(1);
                        callerProfile = profiles && profiles.length > 0 ? profiles[0] : null;
                    } catch (profileErr) {
                        console.log(`[CallerMemory] caller_profiles table not ready yet: ${profileErr.message}`);
                    }

                    let profileHasHistory = callerProfile && (callerProfile.total_calls > 0 || (callerProfile.conversation_history && callerProfile.conversation_history.length > 0));

                    if (callerProfile && (callerProfile.full_name || profileHasHistory)) {
                        console.log(`[CallerMemory] Profile Match for ${From}, name: ${callerProfile.full_name || 'UNKNOWN'}`);
                        const isCallback = callerProfile.last_call_direction === 'outbound' && 
                            (callerProfile.last_call_outcome === 'No Answer' || callerProfile.last_call_outcome === 'Missed' || callerProfile.last_call_outcome === 'Voicemail');

                        let profileContext = `[CALLER MEMORY — KNOWN CALLER PROFILE]:\n`;
                        if (callerProfile.full_name) profileContext += `Name: ${callerProfile.full_name}\n`;
                        profileContext += `Phone: ${From}\n`;
                        if (callerProfile.email) profileContext += `Email: ${callerProfile.email}\n`;
                        if (callerProfile.city) profileContext += `City: ${callerProfile.city}\n`;
                        if (callerProfile.business_type) profileContext += `Business: ${callerProfile.business_type}\n`;
                        if (callerProfile.company) profileContext += `Company: ${callerProfile.company}\n`;
                        profileContext += `Total past calls: ${callerProfile.total_calls || 0}\n`;
                        if (callerProfile.last_call_summary) profileContext += `Last call summary: ${callerProfile.last_call_summary}\n`;
                        if (callerProfile.last_call_outcome) profileContext += `Last call outcome: ${callerProfile.last_call_outcome}\n`;
                        // Add conversation history
                        if (callerProfile.conversation_history && Array.isArray(callerProfile.conversation_history) && callerProfile.conversation_history.length > 0) {
                            profileContext += `\nConversation History (most recent first):\n`;
                            callerProfile.conversation_history.slice(-5).reverse().forEach(h => {
                                profileContext += `[${h.date} ${h.direction}]: ${h.summary}\n`;
                            });
                        }
                        if (callerProfile.notes) profileContext += `\nNotes: ${callerProfile.notes}\n`;

                        if (callerProfile.full_name) {
                            const firstName = callerProfile.first_name || callerProfile.full_name.split(' ')[0];
                            if (isCallback) {
                                profileContext += `\nCALLBACK DETECTED: We tried reaching ${firstName} via an outbound call but they did not answer. They are now calling back. Reference why we called them.`;
                                initialMessage = `Hi ${firstName}! I'm glad you called back. We tried reaching you earlier. How can I help you?`;
                            } else if ((callerProfile.total_calls || 0) > 0) {
                                profileContext += `\nRETURNING CALLER: ${firstName} has called before. Be warm and continue naturally.`;
                                initialMessage = `Hi ${firstName}, welcome back! How can I help you today?`;
                            } else {
                                initialMessage = `Hi ${firstName}, great to hear from you! How can I help you today?`;
                            }
                            profileContext += `\n\nINSTRUCTION: Greet them by first name "${firstName}" immediately. DO NOT ask for their name — you already know it. If you learn any NEW details (email, city, business type, company) during the conversation, IMMEDIATELY call save_caller_info to store them. Be warm and personal.`;
                        } else {
                            if (isCallback) {
                                profileContext += `\nCALLBACK DETECTED: We tried reaching them via an outbound call but they did not answer. They are now calling back.`;
                                initialMessage = `Hi! I'm glad you called back. We tried reaching you earlier. How can I help you?`;
                            } else {
                                profileContext += `\nRETURNING CALLER: They have called before, but we don't have their name yet.`;
                                initialMessage = `Hi, welcome back! How can I help you today?`;
                            }
                            profileContext += `\n\nINSTRUCTION: Greet them warmly. You do NOT know their name yet. Naturally ask for their name and any other details (email, city, business), and IMMEDIATELY call save_caller_info to store it.`;
                        }

                        finalPrompt += `\n\n${profileContext}`;
                        console.log(`[CallerMemory] Profile opening: "${initialMessage}"`);

                    } else {
                        // === LAYER 1: Check leads table (primary CRM source) ===
                        let leadQuery = supabase.from('leads').select('id, name, ai_context, segment, email').ilike('phone', `%${callerSuffix}%`);
                        if (clientId && clientId !== 'undefined' && clientId !== 'null') {
                            leadQuery = leadQuery.eq('client_id', clientId);
                        }
                        const { data: leadMatches } = await leadQuery.limit(1);
                        const leadMatch = leadMatches && leadMatches.length > 0 ? leadMatches[0] : null;

                        if (leadMatch && leadMatch.name) {
                            console.log(`[CallerMemory] Lead Match: "${leadMatch.name}" (${From})`);
                            const firstName = leadMatch.name.split(' ')[0];
                            const hasHistory = !!(leadMatch.ai_context && leadMatch.ai_context.trim());

                            const recentOutbound = hasHistory && 
                                (leadMatch.ai_context.toLowerCase().includes('outbound') || 
                                 leadMatch.ai_context.toLowerCase().includes('voicemail') ||
                                 leadMatch.ai_context.toLowerCase().includes('no answer') ||
                                 leadMatch.ai_context.toLowerCase().includes('tried reaching'));

                            let smartOpening;
                            if (recentOutbound) {
                                smartOpening = `Hi ${firstName}! I'm glad you called back. `;
                            } else if (hasHistory) {
                                smartOpening = `Hi ${firstName}, welcome back! `;
                            } else {
                                smartOpening = `Hi ${firstName}, great to hear from you! `;
                            }

                            const ctxBlock = hasHistory 
                                ? `Their previous interaction history:\n${leadMatch.ai_context}\n`
                                : 'This is their first recorded call. ';
                            const segmentNote = leadMatch.segment ? `Their segment/category is: ${leadMatch.segment}. ` : '';

                            finalPrompt += `\n\n[CALLER MEMORY — KNOWN LEAD]:\nThe caller's phone number matched an existing lead named "${leadMatch.name}"${leadMatch.email ? ` (email: ${leadMatch.email})` : ''}. ${segmentNote}\n${ctxBlock}\nINSTRUCTION: Greet them by first name "${firstName}" immediately. Never ask for their name. If you learn any NEW details (email, city, business, company) call save_caller_info immediately.`;

                            initialMessage = smartOpening + 'How can I help you today?';
                            console.log(`[CallerMemory] Lead opening: "${initialMessage}"`);

                        } else {
                            // === LAYER 2: Check call history ===
                            console.log(`[CallerMemory] No lead match. Checking call history for ${From}...`);
                            let callQuery = supabase.from('calls')
                                .select('id, direction, ai_summary, sentiment_category, created_at, caller_name')
                                .or(`from_phone.ilike.%${callerSuffix}%,to_phone.ilike.%${callerSuffix}%`)
                                .order('created_at', { ascending: false })
                                .limit(3);
                            if (clientId && clientId !== 'undefined' && clientId !== 'null') {
                                callQuery = callQuery.eq('client_id', clientId);
                            }
                            const { data: pastCalls } = await callQuery;

                            if (pastCalls && pastCalls.length > 0) {
                                console.log(`[CallerMemory] Call history: Found ${pastCalls.length} past call(s) for ${From}`);
                                const lastCall = pastCalls[0];
                                const isCallback = lastCall.direction === 'outbound';
                                const knownName = pastCalls.find(c => c.caller_name)?.caller_name || null;
                                const firstName2 = knownName ? knownName.split(' ')[0] : null;

                                const historySummary = pastCalls
                                    .map(c => {
                                        const dateStr = new Date(c.created_at).toLocaleDateString('en-IN');
                                        const dir = c.direction === 'inbound' ? 'Inbound call' : 'Outbound call';
                                        return `[${dateStr} - ${dir}]: ${c.ai_summary || 'No summary available.'}`;
                                    })
                                    .join('\n');

                                if (isCallback && firstName2) {
                                    finalPrompt += `\n\n[CALLER MEMORY — CALLBACK DETECTED]:\nThis caller (${From}) previously received an outbound call from us. Their name is "${knownName}".\n\nPrevious call history:\n${historySummary}\n\nINSTRUCTION: Greet them as ${firstName2} and reference that we tried reaching them. Call save_caller_info to save any new details.`;
                                    initialMessage = `Hi ${firstName2}, glad you called back! How can I help you?`;
                                } else if (firstName2) {
                                    finalPrompt += `\n\n[CALLER MEMORY — RETURNING CALLER]:\nThis caller (${From}) has called before. Their name is "${knownName}".\n\nPrevious call history:\n${historySummary}\n\nINSTRUCTION: Greet them warmly as ${firstName2}. Never ask for their name again. Call save_caller_info with any new details.`;
                                    initialMessage = `Hi ${firstName2}, welcome back! How can I help you today?`;
                                } else {
                                    finalPrompt += `\n\n[CALLER MEMORY — RETURNING CALLER (NAME UNKNOWN)]:\nThis phone number (${From}) has called before.\n\nPrevious call history:\n${historySummary}\n\nINSTRUCTION: Greet warmly. Organically collect their name, email, city, and business type. Call save_caller_info to store everything.`;
                                }
                            } else {
                                // === LAYER 3: Brand new caller ===
                                console.log(`[CallerMemory] New caller ${From}. Will collect details.`);
                                finalPrompt += `\n\n[NEW CALLER DETECTED]:\nThis is a brand new caller (${From}). We have no history for them.\nINSTRUCTION: During the conversation, naturally and organically collect their: full name, email address, city/location, and business type or what they do. As soon as you learn each detail, call 'save_caller_info' to store it. Do NOT interrogate them — weave data collection into the natural flow of conversation.`;
                            }
                        }
                    }
                }
            } catch (e) {
                console.error("[CallerMemory] Lookup error:", e.message);
            }
        }
        
        // 2.5 Load Knowledge Base automatically
        const { data: kbDocs } = clientId ? await supabase.from('knowledge_base').select('content').eq('status', 'Active').eq('client_id', clientId) : { data: [] };
        let contextText = "";
        if (kbDocs && kbDocs.length > 0) {
            contextText = "\n\nCOMPANY KNOWLEDGE BASE (Use this to answer questions):\n" + kbDocs.map(k => k.content).join("\n---\n");
        }

        finalPrompt += contextText;
        
        const nowIST = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const todayISO = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
        
        finalPrompt += `\n\nCALENDAR CONTEXT: You operate strictly in IST (UTC+05:30). 
        Current detailed time is ${nowIST}. 
        Today's ISO date is ${todayISO}.
        
        STRICT RULES:
        1. ALWAYS call 'check_availability' before suggesting ANY time to a caller.
        2. DO NOT book appointments outside of business hours or on holidays.
        3. When booking, ALWAYS use the +05:30 offset in ISO format.
        4. DATA COLLECTION: Organically collect Name, Phone, and Email BEFORE booking.
        5. EMAIL HANDLING - CRITICAL: When a caller gives you an email address by voice, pass it EXACTLY as you heard it into the 'email' parameter. DO NOT validate, reformat, or spell-check it. The backend system will automatically fix it.
           - If caller says 'contact dot simplicium at gmail dot com', pass exactly: 'contact dot simplicium at gmail dot com'
           - NEVER say phrases like 'could you spell that out', 'is that correct?', or 'can you confirm your email'. Just use what you heard.
        6. CRITICAL - ONE BOOKING ONLY: Call 'book_appointment' EXACTLY ONCE per caller per slot. NEVER retry, NEVER call it twice. If you get a conflict error, offer the caller a DIFFERENT time slot instead of retrying the same one.
        7. APPOINTMENT MODIFICATION/CANCELLATION: If a caller wants to update or delete their appointment, you MUST verify their identity by asking for their Name and Phone number first. Only call 'update_appointment' or 'delete_appointment' AFTER they provide this verification.`;
        
        finalPrompt += `\n\nSILENCE & GOODBYE PROTOCOL (CRITICAL):
- If the caller says "bye", "goodbye", "thank you bye", "ok bye", "see you", or similar farewell words, say a warm one-sentence goodbye THEN IMMEDIATELY call hang_up.
- Do NOT continue the conversation after goodbye.
- If the caller is completely silent for 15 seconds or more, politely say "I haven't heard from you, take care, goodbye!" then IMMEDIATELY call hang_up.
- Never wait for the caller to disconnect. You must hang up proactively.`;

        finalPrompt += "\n\nHUMAN TRANSFER: If the caller explicitly asks to speak to a real person, a human, or a manager, or if they have a complex technical issue that you cannot solve using the knowledge base, tell them 'I will transfer you to one of our specialists now' and then IMMEDIATELY call 'transfer_call'.";
        
        finalPrompt += "\n\nMULTILINGUAL DIRECTIVE: Automatically detect the caller's language and reply in the same language at all times.";

        let baseUrl = `https://${req.get('host')}`;
        if (process.env.BACKEND_URL && !process.env.BACKEND_URL.includes('your-server.com')) {
            baseUrl = process.env.BACKEND_URL.replace(/\/$/, '');
        } else if (process.env.SERVER_BASE_URL && !process.env.SERVER_BASE_URL.includes('your-server.com')) {
            baseUrl = process.env.SERVER_BASE_URL.replace(/\/$/, '');
        }
        console.log(`[Ultravox] Creating session with tools/callbacks at: ${baseUrl}`);
        
        const finalVoice = agentData?.voice_preset || "Mark";

        const toolsConfig = agentData?.tools_config || { hangUp: true, transferCall: false, queryCorpus: false };
        const selectedTools = [
            {
                temporaryTool: {
                    modelToolName: "save_caller_info",
                    description: "Save or update the caller's personal details to the CRM database. IMPORTANT: Call this tool IMMEDIATELY whenever you learn ANY new detail about the caller — their name, email, city, business type, or company. If you do not have their full name, make it a priority to ask for it organically. Do NOT wait until end of conversation. Call this multiple times if needed as you learn more.",
                    dynamicParameters: [
                        { name: "full_name", location: "PARAMETER_LOCATION_BODY", schema: { type: "string", description: "The caller's full name" }, required: false },
                        { name: "email", location: "PARAMETER_LOCATION_BODY", schema: { type: "string", description: "Email address exactly as spoken. Pass raw text — the system auto-converts." }, required: false },
                        { name: "city", location: "PARAMETER_LOCATION_BODY", schema: { type: "string", description: "City or location" }, required: false },
                        { name: "business_type", location: "PARAMETER_LOCATION_BODY", schema: { type: "string", description: "Type of business or industry (e.g. 'real estate', 'healthcare', 'e-commerce')" }, required: false },
                        { name: "company", location: "PARAMETER_LOCATION_BODY", schema: { type: "string", description: "Company or organization name" }, required: false }
                    ],
                    staticParameters: [
                        { name: "phone", location: "PARAMETER_LOCATION_BODY", value: From || '' },
                        { name: "client_id", location: "PARAMETER_LOCATION_BODY", value: clientId || '' },
                        { name: "call_direction", location: "PARAMETER_LOCATION_BODY", value: 'inbound' }
                    ],
                    http: { httpMethod: "POST", baseUrlPattern: `${baseUrl}/api/tools/save_caller_info` }
                }
            },
            {
                temporaryTool: {
                    modelToolName: "check_availability",
                    description: "Check the calendar for free available time slots on a specific date (YYYY-MM-DD).",
                    dynamicParameters: [
                        {
                            name: "target_date",
                            location: "PARAMETER_LOCATION_BODY",
                            schema: { type: "string", description: "Target date in YYYY-MM-DD" },
                            required: true
                        }
                    ],
                    http: { httpMethod: "POST", baseUrlPattern: clientId ? `${baseUrl}/api/tools/availability/${clientId}` : `${baseUrl}/api/tools/availability` }
                }
            },
            {
                temporaryTool: {
                    modelToolName: "book_appointment",
                    description: "Book an appointment for the caller on the calendar.",
                    dynamicParameters: [
                        {
                            name: "start_time",
                            location: "PARAMETER_LOCATION_BODY",
                            schema: { type: "string", description: "ISO 8601 datetime string. e.g. 2026-04-08T15:00:00+05:30" },
                            required: true
                        },
                        {
                            name: "name",
                            location: "PARAMETER_LOCATION_BODY",
                            schema: { type: "string", description: "Full name" },
                            required: true
                        },
                        {
                            name: "phone",
                            location: "PARAMETER_LOCATION_BODY",
                            schema: { type: "string", description: "Phone number" },
                            required: true
                        },
                        {
                            name: "email",
                            location: "PARAMETER_LOCATION_BODY",
                            schema: { type: "string", description: "Email address exactly as spoken by the caller. Pass raw spoken text like 'contact dot name at gmail dot com' - the system will auto-convert it. Do NOT reformat or validate yourself." },
                            required: false
                        }
                    ],
                    http: { httpMethod: "POST", baseUrlPattern: clientId ? `${baseUrl}/api/tools/book/${clientId}` : `${baseUrl}/api/tools/book` }
                }
            },
            {
                temporaryTool: {
                    modelToolName: "update_appointment",
                    description: "Reschedule or update an existing appointment to a new time. Requires caller verification.",
                    dynamicParameters: [
                        {
                            name: "name",
                            location: "PARAMETER_LOCATION_BODY",
                            schema: { type: "string", description: "First and last name used originally" },
                            required: true
                        },
                        {
                            name: "phone",
                            location: "PARAMETER_LOCATION_BODY",
                            schema: { type: "string", description: "Phone number used originally" },
                            required: true
                        },
                        {
                            name: "new_start_time",
                            location: "PARAMETER_LOCATION_BODY",
                            schema: { type: "string", description: "ISO 8601 datetime string of the new desired time slot" },
                            required: true
                        }
                    ],
                    http: { httpMethod: "POST", baseUrlPattern: `${baseUrl}/api/tools/update` }
                }
            },
            {
                temporaryTool: {
                    modelToolName: "delete_appointment",
                    description: "Cancel and delete an existing appointment. Strongly requires caller verification.",
                    dynamicParameters: [
                        {
                            name: "name",
                            location: "PARAMETER_LOCATION_BODY",
                            schema: { type: "string", description: "First and last name used originally" },
                            required: true
                        },
                        {
                            name: "phone",
                            location: "PARAMETER_LOCATION_BODY",
                            schema: { type: "string", description: "Phone number used originally" },
                            required: true
                        }
                    ],
                    http: { httpMethod: "POST", baseUrlPattern: `${baseUrl}/api/tools/delete` }
                }
            },
            {
                temporaryTool: {
                    modelToolName: "log_call_outcome",
                    description: "Record the final outcome of the call including a descriptive reason and its overall category. IMPORTANT: Category MUST be one of: Interested, Not Interested, Follow Up, Booked Meeting, or Standard Enquiry.",
                    dynamicParameters: [
                        { name: "phone", location: "PARAMETER_LOCATION_BODY", schema: { type: "string", description: "The caller's exact phone number" }, required: true },
                        { name: "sentiment", location: "PARAMETER_LOCATION_BODY", schema: { type: "string", description: "A short 2-4 word phrase describing the specific reason for the classification." }, required: true },
                        { name: "category", location: "PARAMETER_LOCATION_BODY", schema: { type: "string", description: "Must be one of: Interested, Not Interested, Follow Up, Booked Meeting, or Standard Enquiry" }, required: true },
                        { name: "status", location: "PARAMETER_LOCATION_BODY", schema: { type: "string", description: "Resolved, Follow Up, Booked, or Missed" }, required: true }
                    ],
                    http: { httpMethod: "POST", baseUrlPattern: `${baseUrl}/api/tools/log_outcome` }
                }
            }
        ];

        // Add optional tools based on dashboard settings
        if (toolsConfig.hangUp) {
            let finalPromptWithHangup = finalPrompt;
            finalPromptWithHangup += "\n\nCRITICAL CALL TERMINATION DIRECTIVES:\n1. If the user says 'goodbye', 'bye', or indicates they are leaving, you MUST immediately call the 'hangUp' tool without saying another word.\n2. If the user is silent for more than 15-20 seconds and does not respond to your prompts, you MUST automatically call the 'hangUp' tool to end the call and save costs.";
            finalPrompt = finalPromptWithHangup;

            selectedTools.push({
                temporaryTool: {
                    modelToolName: "hangUp",
                    description: "Hang up and terminate the phone call immediately. You MUST call this tool the instant the caller says 'bye', 'goodbye', 'thank you bye', 'see you', 'ok bye', or any farewell. No further speech after calling this tool.",
                    staticParameters: [
                        { name: "client_id", location: "PARAMETER_LOCATION_BODY", value: clientId || '' },
                        { name: "twilio_sid", location: "PARAMETER_LOCATION_BODY", value: CallSid || '' }
                    ],
                    http: { httpMethod: "POST", baseUrlPattern: `${baseUrl}/api/tools/hang_up` }
                }
            });
        }

        if (toolsConfig.transferCall) {
            selectedTools.push({
                temporaryTool: {
                    modelToolName: "transfer_call",
                    description: "Transfer the caller to a human representative. Use this if the caller specifically asks to speak to a person or representative. Call this immediately without asking for any phone number.",
                    staticParameters: [
                        { name: "client_id", location: "PARAMETER_LOCATION_BODY", value: clientId || '' },
                        { name: "twilio_sid", location: "PARAMETER_LOCATION_BODY", value: CallSid || '' }
                    ],
                    http: { httpMethod: "POST", baseUrlPattern: `${baseUrl}/api/tools/transfer` }
                }
            });
        }

        if (toolsConfig.queryCorpus) {
            selectedTools.push({
                temporaryTool: {
                    modelToolName: "query_corpus",
                    description: "Search the company's advanced knowledge base (PDFs, documents, and websites) for specific information. Use this if the standard knowledge base doesn't have the answer.",
                    dynamicParameters: [
                        { name: "query", location: "PARAMETER_LOCATION_BODY", schema: { type: "string", description: "The specific question or search term" }, required: true }
                    ],
                    http: { httpMethod: "POST", baseUrlPattern: clientId ? `${baseUrl}/api/tools/query-corpus/${clientId}` : `${baseUrl}/api/tools/query-corpus` }
                }
            });
        }

        if (toolsConfig.leaveVoicemail) {
            selectedTools.push({ toolName: "leaveVoicemail" });
        }

        if (toolsConfig.playDtmfSounds) {
            selectedTools.push({ toolName: "playDtmfSounds" });
        }

        let apiKeysObj = undefined;
        let finalUltravoxVoice = finalVoice;
        
        if (finalVoice === 'elevenlabs:custom') {
            const { data: elInt } = await supabase.from('integrations').select('*').eq('provider', 'elevenlabs').eq('client_id', clientId).maybeSingle();
            if (elInt && elInt.api_key && elInt.meta_data?.voice_id) {
                finalUltravoxVoice = `elevenlabs:${elInt.meta_data.voice_id}`;
                apiKeysObj = { elevenlabs: elInt.api_key };
            } else {
                console.warn("[Ultravox] ElevenLabs selected but no valid integration found. Falling back to default.");
                finalUltravoxVoice = "terrence";
            }
        }

        const uvResponse = await fetch('https://api.ultravox.ai/api/calls', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-API-Key': ACTIVE_ULTRAVOX_KEY },
            body: JSON.stringify({
                systemPrompt: finalPrompt,
                voice: finalUltravoxVoice,
                temperature: agentData?.temperature || 0.3,
                firstSpeaker: "FIRST_SPEAKER_AGENT",
                initialMessages: initialMessage ? [{ role: 'MESSAGE_ROLE_AGENT', text: initialMessage }] : undefined,
                medium: { twilio: {} },
                selectedTools: selectedTools,
                inactivityMessages: [
                    { duration: '20s', message: "Are you still there? I haven't heard from you." }
                ],
                maxDuration: '1800s'
            })
        });

        const uvData = await uvResponse.json();
        if (!uvData.joinUrl) {
            console.error("Ultravox API failed to generate WebSocket:", uvData);
            res.set('Content-Type', 'text/xml');
            return res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?><Response><Say>The AI engine returned an error. Please check the platform credentials.</Say></Response>`);
        }
        const joinUrl = uvData.joinUrl;
        const safeJoinUrl = joinUrl.replace(/&/g, '&amp;');
        const ultravoxCallId = uvData.callId; // CAPTURE FOR SUMMARIES!

        // 3. SECURE LOGGING: Save the call instantly directly into your Supabase Database
        await supabase.from('calls').insert([{
            direction: 'inbound',
            from_phone: From,
            to_phone: To,
            status: 'active',
            twilio_sid: CallSid,
            ultravox_call_id: ultravoxCallId,
            client_id: clientId
        }]);

        // 4. TRIGGER RECORDING (If enabled in settings)
        // Re-fetch agent settings to ensure we have the latest toggle state
        try {
            const { data: currentAgent } = await supabase.from('agent_settings').select('record_calls').eq('client_id', clientId).limit(1).maybeSingle();
            const recordingEnabled = currentAgent?.record_calls !== false; 
            
            if (recordingEnabled) {
                const { data: twInt } = await supabase.from('integrations').select('*').eq('provider', 'twilio').eq('client_id', clientId).maybeSingle();
                const TW_SID = twInt?.meta_data?.sid || process.env.TWILIO_ACCOUNT_SID;
                const TW_AUTH = twInt?.api_key || process.env.TWILIO_AUTH_TOKEN;

                if (TW_SID && TW_AUTH && baseUrl) {
                    const client = require('twilio')(TW_SID, TW_AUTH);
                    client.calls(CallSid).recordings.create({
                        recordingStatusCallback: `${baseUrl}/api/twilio/recording-callback`,
                        recordingStatusCallbackEvent: ['completed'],
                        trim: 'trim-silence'
                    }).catch(e => console.error("[Twilio] Inbound Recording Trigger Error:", e.message));
                    console.log(`[Twilio] Recording triggered for call ${CallSid}`);
                }
            } else {
                console.log(`[Twilio] Recording skipped for call ${CallSid} (User disabled)`);
            }
        } catch (confErr) {
            console.error("[Twilio] Failed to check recording settings:", confErr.message);
        }

        // 5. Return Twilio XML (TwiML) instantly bridging the caller to the Ultravox WebSocket
        const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Connect>
        <Stream url="${safeJoinUrl}">
            <Parameter name="myCustomMetadata" value="InboundCall"/>
        </Stream>
    </Connect>
</Response>`;

        res.set('Content-Type', 'text/xml');
        res.send(twiml);
        console.log("Audio Stream successfully relayed to Ultravox!");

    } catch (error) {
        console.error("[Twilio Inbound] CRITICAL ERROR:", error.message);
        // Safely try to log Ultravox error details if available
        if (error.response && typeof error.response.text === 'function') {
            try {
                const body = await error.response.text();
                console.error("Ultravox API Error Body:", body);
            } catch (e) {}
        }
        res.set('Content-Type', 'text/xml');
        return res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?><Response><Say>A server error occurred while connecting the A I. Please try again later.</Say></Response>`);
    }
});

// Outbound trigger endpoint (For the React Dashboard)
app.post('/api/calls/outbound', async (req, res) => {
    try {
        const { toPhone, systemPrompt, voice, goal, name, client_id } = req.body;
        if (!toPhone) return res.status(400).json({ error: "Missing toPhone parameter." });
        
        console.log(`Initiating Outbound Call to: ${toPhone}`);

        // 1. Check Twilio Credentials & Agent Status
        const { data: client } = await supabase.from('clients').select('agent_enabled, plan, mins_used').eq('id', client_id).maybeSingle();
        if (client) {
            if (client.agent_enabled === false) {
                return res.status(400).json({ error: "AI Agent is currently paused. Please enable it in the dashboard to make outbound calls." });
            }
            const planLimits = { Starter: 500, Pro: 2000, Business: 5000, Enterprise: null };
            const planKey = (client.plan || 'Starter').split(' ')[0];
            const limit = planLimits[planKey] ?? null;
            if (limit !== null && (client.mins_used || 0) >= limit) {
                return res.status(400).json({ error: "Plan limit exhausted. Please upgrade your plan to resume outbound calls." });
            }
        }

        const { data: twInt } = await supabase.from('integrations').select('*').eq('provider', 'twilio').eq('client_id', client_id).single();
        const TWILIO_SID = (twInt?.meta_data?.sid || process.env.TWILIO_ACCOUNT_SID)?.trim();
        const TWILIO_AUTH = (twInt?.api_key || process.env.TWILIO_AUTH_TOKEN)?.trim();
        const TWILIO_PHONE = (twInt?.meta_data?.phone || process.env.TWILIO_PHONE_NUMBER)?.trim();

        if (!TWILIO_SID || !TWILIO_AUTH || !TWILIO_PHONE) {
            return res.status(400).json({ error: "Twilio credentials missing. Set them in the Dashboard." });
        }

        const twilioClient = twilio(TWILIO_SID, TWILIO_AUTH);
        
        // Dynamic backend URL selection (Ignore dummy env variables)
        let serverBaseUrl = `https://${req.get('host')}`;
        if (process.env.BACKEND_URL && !process.env.BACKEND_URL.includes('your-server.com')) {
            serverBaseUrl = process.env.BACKEND_URL.replace(/\/$/, '');
        } else if (process.env.SERVER_BASE_URL && !process.env.SERVER_BASE_URL.includes('your-server.com')) {
            serverBaseUrl = process.env.SERVER_BASE_URL.replace(/\/$/, '');
        }
        
        const webhookUrl = `${serverBaseUrl}/api/twilio/outbound-twiml?toPhone=${encodeURIComponent(toPhone || '')}&voice=${encodeURIComponent(voice || '')}&goal=${encodeURIComponent(goal || '')}&name=${encodeURIComponent(name || '')}&client_id=${encodeURIComponent(client_id || '')}`;

        // Get agent settings to check if recording and voicemail are enabled
        const { data: agentData } = await supabase.from('agent_settings').select('record_calls, tools_config').eq('client_id', client_id).limit(1).maybeSingle();
        const recordingEnabled = agentData?.record_calls !== false;
        const toolsConfig = agentData?.tools_config || {};
        const leaveVoicemailEnabled = toolsConfig.leaveVoicemail === true;

        const callOptions = {
            url: webhookUrl,
            to: toPhone,
            from: TWILIO_PHONE,
            statusCallback: `${serverBaseUrl}/api/twilio/status`,
            statusCallbackEvent: ['completed'],
            record: recordingEnabled,
            recordingStatusCallback: `${serverBaseUrl}/api/twilio/recording-callback`,
            recordingStatusCallbackEvent: ['completed']
        };

        if (leaveVoicemailEnabled) {
            callOptions.machineDetection = 'DetectMessageEnd';
            callOptions.machineDetectionTimeout = 15;
            callOptions.machineDetectionSpeechThreshold = 2000;
            callOptions.machineDetectionSpeechEndThreshold = 1000;
            callOptions.machineDetectionSilenceTimeout = 3000;
        }

        // 3. Directly command Twilio to physically dial the lead
        const call = await twilioClient.calls.create(callOptions);

        // 4. SECURE LOGGING: Write the outbound call directly into your Supabase Data Table!
        await supabase.from('calls').insert([{
            direction: 'outbound',
            from_phone: TWILIO_PHONE,
            to_phone: toPhone,
            status: call.status,
            twilio_sid: call.sid,
            client_id: client_id
        }]);

        console.log(`Outbound Call Live - Status: ${call.status} - SID: ${call.sid}`);
        res.json({ success: true, callSid: call.sid, message: "Dialing the lead now!" });

    } catch (error) {
        console.error("Critical Outbound Dialing Error:", error);
        // Handle Twilio Trial/Restriction errors gracefully
        let userMessage = error.message || "Failed to launch outbound API.";
        
        if (userMessage.includes("Authenticate")) {
            userMessage = "Twilio Authentication Failed! Invalid Account SID or Auth Token in Integration Settings.";
        } else if (userMessage.toLowerCase().includes("not allowed") || userMessage.toLowerCase().includes("restricted")) {
            userMessage = "Twilio Restriction: This number is not verified or allowed on your trial account.";
        }
        
        res.status(400).json({ success: false, error: userMessage });
    }
});

// Twilio Webhook (Hit exactly when the user presses the key on a trial account, or instantly on full accounts)
app.post('/api/twilio/outbound-twiml', async (req, res) => {
    try {
        const { toPhone, voice: reqVoice, goal: reqGoal, name: reqName, client_id } = req.query;
        const clientId = client_id;
        const callSid = req.body.CallSid || req.query.CallSid || '';

        // 1. Determine key and base URL
        let ACTIVE_ULTRAVOX_KEY = process.env.ULTRAVOX_API_KEY;
        try {
            const { data: clientUV2 } = await supabase.from('integrations').select('*').eq('provider', 'ultravox').eq('client_id', client_id).maybeSingle();
            const platformUV2 = await getPlatformKey('ultravox');
            ACTIVE_ULTRAVOX_KEY = clientUV2?.api_key || platformUV2?.api_key || ACTIVE_ULTRAVOX_KEY;
        } catch (dbErr) {
            console.error("[Twilio Outbound] Key lookup error:", dbErr.message);
        }

        if (!ACTIVE_ULTRAVOX_KEY) {
            console.error("[Twilio Outbound] CRITICAL: No Ultravox key found.");
            res.set('Content-Type', 'text/xml');
            return res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?><Response><Say>AI configuration is missing. Please contact support.</Say></Response>`);
        }

        // 1. Resolve Client & Prompt settings
        const { data: clientRow } = client_id ? await supabase.from('clients').select('name').eq('client_code', client_id).maybeSingle() : { data: null };
        const { data: agentData } = client_id ? await supabase.from('agent_settings').select('*').eq('client_id', client_id).limit(1).maybeSingle() : { data: null };
        
        console.log(`[Twilio Outbound] Generating TwiML for client: ${client_id || 'NONE'}`);

        const companyName = clientRow?.name || "our company";
        const fallbackPrompt = `You are the professional AI receptionist for ${companyName}. Introduce yourself, identify the company, and help the caller. Focus on being concise and helpful.`;
        
        // 1.5 Load Knowledge Base automatically
        const { data: kbDocs } = client_id ? await supabase.from('knowledge_base').select('content').eq('status', 'Active').eq('client_id', client_id) : { data: [] };
        let contextText = "";
        if (kbDocs && kbDocs.length > 0) {
            contextText = "\n\nCOMPANY KNOWLEDGE BASE (Use this to answer questions):\n" + kbDocs.map(k => k.content).join("\n---\n");
        }

        // 1.6 CALLER MEMORY SYSTEM for Outbound
        let leadHistory = "";
        let leadName = reqName || "";
        let leadEmail = "";
        let leadSegment = "";
        let initialMessage = undefined;
        let callerProfile = null;
        if (toPhone) {
            try {
                const cleanPhone = String(toPhone).replace(/\D/g, '');
                if (cleanPhone.length >= 10) {
                    const phoneSuffix = cleanPhone.slice(-10);

                    // === LAYER 0 (NEW): Check caller_profiles table first ===
                    try {
                        let profileQuery = supabase.from('caller_profiles').select('*').eq('phone_suffix', phoneSuffix);
                        if (clientId && clientId !== 'undefined' && clientId !== 'null') {
                            profileQuery = profileQuery.eq('client_id', clientId);
                        }
                        const { data: profiles } = await profileQuery.limit(1);
                        callerProfile = profiles && profiles.length > 0 ? profiles[0] : null;
                    } catch (profileErr) {
                        console.log(`[Outbound CallerMemory] caller_profiles table not ready: ${profileErr.message}`);
                    }

                    let profileHasHistory = callerProfile && (callerProfile.total_calls > 0 || (callerProfile.conversation_history && callerProfile.conversation_history.length > 0));
                    
                    if (callerProfile && (callerProfile.full_name || profileHasHistory)) {
                        console.log(`[Outbound CallerMemory] Profile Match: name: ${callerProfile.full_name || 'UNKNOWN'} (${toPhone}), calls: ${callerProfile.total_calls}`);
                        leadName = callerProfile.full_name || leadName || reqName || "";
                        leadEmail = callerProfile.email || "";
                        // Build history from profile
                        if (callerProfile.conversation_history && Array.isArray(callerProfile.conversation_history) && callerProfile.conversation_history.length > 0) {
                            leadHistory = callerProfile.conversation_history.slice(-5).reverse()
                                .map(h => `[${h.date} ${h.direction}]: ${h.summary}`)
                                .join('\n');
                        } else if (callerProfile.last_call_summary) {
                            leadHistory = callerProfile.last_call_summary;
                        }
                        if (callerProfile.notes) leadHistory = (leadHistory ? leadHistory + '\n' : '') + `Notes: ${callerProfile.notes}`;
                    } else {
                        // Layer 1: Check leads table
                        let leadQuery = supabase.from('leads').select('name, ai_context, segment, email').ilike('phone', `%${phoneSuffix}%`);
                        if (clientId && clientId !== 'undefined' && clientId !== 'null') {
                            leadQuery = leadQuery.eq('client_id', clientId);
                        }
                        const { data: leadMatches } = await leadQuery.limit(1);
                        const leadMatch = leadMatches && leadMatches.length > 0 ? leadMatches[0] : null;

                        if (leadMatch) {
                            console.log(`[Outbound CallerMemory] Lead Match: "${leadMatch.name}" (${toPhone})`);
                            if (leadMatch.name && !leadName) leadName = leadMatch.name;
                            if (leadMatch.ai_context && leadMatch.ai_context.trim()) leadHistory = leadMatch.ai_context.trim();
                            leadEmail = leadMatch.email || "";
                            leadSegment = leadMatch.segment || "";
                        } else {
                            // Layer 2: Check calls table
                            console.log(`[Outbound CallerMemory] Checking calls table for ${toPhone}...`);
                            let callQuery = supabase.from('calls').select('ai_summary, created_at, caller_name')
                                .or(`from_phone.ilike.%${phoneSuffix}%,to_phone.ilike.%${phoneSuffix}%`)
                                .order('created_at', { ascending: false }).limit(3);
                            if (clientId && clientId !== 'undefined' && clientId !== 'null') {
                                callQuery = callQuery.eq('client_id', clientId);
                            }
                            const { data: pastCalls } = await callQuery;
                            if (pastCalls && pastCalls.length > 0) {
                                const knownName = pastCalls.find(c => c.caller_name)?.caller_name || null;
                                if (knownName && !leadName) leadName = knownName;
                                leadHistory = pastCalls.map(c => {
                                    const dateStr = new Date(c.created_at).toLocaleDateString('en-IN');
                                    return `[${dateStr} Call]: ${c.ai_summary || 'No summary available.'}`;
                                }).join('\n');
                            }
                        }
                    }
                }
            } catch (e) {
                console.error("[Outbound CallerMemory] Lookup error:", e.message);
            }
        }

        // --- AMD (Answering Machine Detection) VOICEMAIL LOGIC ---
        const answeredBy = req.body.AnsweredBy || '';
        let amdPrompt = "";
        if (answeredBy.includes('machine')) {
            console.log(`[Twilio Outbound] VOICEMAIL DETECTED for ${toPhone}. Instructing AI to leave a message.`);
            amdPrompt = `\n\n[VOICEMAIL PROTOCOL CRITICAL]: You have reached an answering machine. The beep has just played. IMMEDIATELY leave a voicemail. If a specific "VOICEMAIL TEMPLATE" or instructions are provided earlier in your system prompt, use them exactly. Otherwise, leave a brief, professional voicemail mentioning you are calling from ${companyName} and asking them to call back. Do not wait for a response. As soon as you finish your voicemail message, you MUST call the hangUp tool.`;
        } else if (answeredBy === 'human') {
            console.log(`[Twilio Outbound] Human answered ${toPhone}. Continuing normally.`);
        }

        let finalPrompt = (agentData?.system_prompt || `You are an outbound sales AI calling a lead on behalf of ${companyName}. Be incredibly persuasive, warm, and brief.`) + contextText;
        if (amdPrompt) finalPrompt += amdPrompt;
        
        const nowIST_out = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const todayISO_out = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
        
        finalPrompt += `\n\nCALENDAR CONTEXT: You operate strictly in IST (UTC+05:30). 
        Current detailed time is ${nowIST_out}. 
        Today's ISO date is ${todayISO_out}.
        
        STRICT RULES:
        1. ALWAYS call 'check_availability' before suggesting ANY time to a lead.
        2. DO NOT book outside of business hours or on holidays.
        3. ALWAYS use +05:30 offset. Example: 2026-04-08T15:00:00+05:30.
        4. If they ask about an existing slot, cross-reference the context provided.
        5. APPOINTMENT MODIFICATION/CANCELLATION: If a lead wants to update or delete their appointment, you MUST verify their identity by asking for their Name and Phone number first. Only call 'update_appointment' or 'delete_appointment' AFTER they provide this verification.`;
        
        if (agentData?.personality) finalPrompt += `\n\nYour Personality/Tone: ${agentData.personality}`;
        if (reqGoal) finalPrompt += `\n\n[PRIMARY MISSION GOAL]: ${reqGoal}`;
        
        const resolvedName = leadName || reqName || "";
        if (resolvedName || toPhone) {
            const firstName = resolvedName ? resolvedName.split(' ')[0] : "";
            finalPrompt += `\n\n[CRITICAL OUTBOUND CONTEXT]: You are initiating an outbound call to a designated lead.`;
            if (resolvedName) {
                finalPrompt += `\n- The lead's name is "${resolvedName}". Greet them naturally by their first name "${firstName}" as soon as they answer. DO NOT ask them for their name.`;
            } else {
                finalPrompt += `\n- The lead's name is UNKNOWN. Greet them warmly and organically ask for their name early in the call, and IMMEDIATELY call save_caller_info to save it.`;
            }
            finalPrompt += `\n- Phone number is: ${toPhone}. DO NOT ask for their phone number.`;
            if (leadEmail) finalPrompt += `\n- Email: ${leadEmail}. DO NOT ask unless updating.`;
            if (callerProfile?.city) finalPrompt += `\n- City: ${callerProfile.city}.`;
            if (callerProfile?.business_type) finalPrompt += `\n- Business: ${callerProfile.business_type}.`;
            if (callerProfile?.company) finalPrompt += `\n- Company: ${callerProfile.company}.`;
            if (leadSegment) finalPrompt += `\n- Lead Category/Segment: ${leadSegment}.`;
            if (leadHistory) {
                finalPrompt += `\n- Past interaction history:\n${leadHistory}\n\nINSTRUCTION: Use this context naturally. Reference their previous interests/concerns if relevant to the campaign goal: "${reqGoal || ''}".`;
                if (firstName) {
                    initialMessage = `Hi ${firstName}, this is ${companyName} calling. I'm following up with you! How are you doing today?`;
                } else {
                    initialMessage = `Hi there, this is ${companyName} calling. I'm following up on our previous interaction. How are you doing today?`;
                }
            } else if (firstName) {
                initialMessage = `Hi ${firstName}, this is ${companyName} calling. How are you doing today?`;
            }
            finalPrompt += `\n\nDATA COLLECTION: If you learn any NEW details about the lead (email, city, business type, company name), IMMEDIATELY call save_caller_info to store them. Do not wait.`;
        }

        finalPrompt += "\n\nULTRA-IMPORTANT - CALL TERMINATION: As soon as you say a FINAL goodbye or the lead says goodbye, you MUST call 'hang_up' IMMEDIATELY. Never wait for them to hang up. This is critical to reduce telephony costs.";

        finalPrompt += "\n\nHUMAN TRANSFER: If the lead explicitly asks to speak to a real person, a human, or a manager, or if they have a complex technical issue that you cannot solve using the knowledge base, tell them 'I will transfer you to one of our specialists now' and then IMMEDIATELY call 'transfer_call'.";
        
        finalPrompt += "\n\nMULTILINGUAL DIRECTIVE: You are a multilingual AI. You MUST automatically detect whether the caller is speaking English or Serbian. If they speak Serbian, you MUST reply natively in Serbian. If they speak English, reply in English. Match their language exactly at all times.";

        const finalVoice = reqVoice || agentData?.voice_preset || "Mark";

        const baseUrl = `https://${req.get('host')}`;
        
        // 2. Create the Ultravox Session right now (no timeout risk because they just pressed the key!)
        const toolsConfig = agentData?.tools_config || { hangUp: true, transferCall: false, queryCorpus: false };
        const selectedTools = [
            {
                temporaryTool: {
                    modelToolName: "check_availability",
                    description: "Check the calendar for free available time slots on a specific date (YYYY-MM-DD).",
                    dynamicParameters: [
                        {
                            name: "target_date",
                            location: "PARAMETER_LOCATION_BODY",
                            schema: { type: "string", description: "The target date to check in YYYY-MM-DD format" },
                            required: true
                        }
                    ],
                    http: { httpMethod: "POST", baseUrlPattern: clientId ? `${baseUrl}/api/tools/availability/${clientId}` : `${baseUrl}/api/tools/availability` }
                }
            },
            {
                temporaryTool: {
                    modelToolName: "book_appointment",
                    description: reqName ? `Book an appointment for ${reqName} on the calendar. Use context variables directly, do NOT ask the user for name or phone.` : "Book an appointment for the caller on the calendar.",
                    dynamicParameters: [
                        {
                            name: "start_time",
                            location: "PARAMETER_LOCATION_BODY",
                            schema: { type: "string", description: "ISO 8601 datetime string. e.g. 2026-04-08T15:00:00+05:30" },
                            required: true
                        },
                        {
                            name: "name",
                            location: "PARAMETER_LOCATION_BODY",
                            schema: { type: "string", description: reqName ? `Must be exactly: ${reqName}` : "Full name of caller" },
                            required: reqName ? false : true // Required if no context, false if context exists
                        },
                        {
                            name: "phone",
                            location: "PARAMETER_LOCATION_BODY",
                            schema: { type: "string", description: reqName ? `Must be exactly: ${toPhone}` : "Contact number" },
                            required: false
                        }
                    ],
                    http: { httpMethod: "POST", baseUrlPattern: clientId ? `${baseUrl}/api/tools/book/${clientId}` : `${baseUrl}/api/tools/book` }
                }
            },
            {
                temporaryTool: {
                    modelToolName: "update_appointment",
                    description: "Reschedule or update an existing appointment to a new time. Requires caller verification.",
                    dynamicParameters: [
                        {
                            name: "name",
                            location: "PARAMETER_LOCATION_BODY",
                            schema: { type: "string", description: "First and last name used originally" },
                            required: true
                        },
                        {
                            name: "phone",
                            location: "PARAMETER_LOCATION_BODY",
                            schema: { type: "string", description: "Phone number used originally" },
                            required: true
                        },
                        {
                            name: "new_start_time",
                            location: "PARAMETER_LOCATION_BODY",
                            schema: { type: "string", description: "ISO 8601 datetime string of the new desired time slot" },
                            required: true
                        }
                    ],
                    http: { httpMethod: "POST", baseUrlPattern: `${baseUrl}/api/tools/update` }
                }
            },
            {
                temporaryTool: {
                    modelToolName: "delete_appointment",
                    description: "Cancel and delete an existing appointment. Strongly requires caller verification.",
                    dynamicParameters: [
                        {
                            name: "name",
                            location: "PARAMETER_LOCATION_BODY",
                            schema: { type: "string", description: "First and last name used originally" },
                            required: true
                        },
                        {
                            name: "phone",
                            location: "PARAMETER_LOCATION_BODY",
                            schema: { type: "string", description: "Phone number used originally" },
                            required: true
                        }
                    ],
                    http: { httpMethod: "POST", baseUrlPattern: `${baseUrl}/api/tools/delete` }
                }
            },
            {
                temporaryTool: {
                    modelToolName: "log_call_outcome",
                    description: "Record the final outcome of the call including a descriptive reason and its overall category. IMPORTANT: Category MUST be one of: Interested, Not Interested, Follow Up, Booked Meeting, or Standard Enquiry.",
                    dynamicParameters: [
                        { name: "phone", location: "PARAMETER_LOCATION_BODY", schema: { type: "string", description: "The lead's exact phone number" }, required: true },
                        { name: "sentiment", location: "PARAMETER_LOCATION_BODY", schema: { type: "string", description: "A short descriptive reason (e.g. 'Disappointed with service', 'Happy to book')" }, required: true },
                        { name: "category", location: "PARAMETER_LOCATION_BODY", schema: { type: "string", description: "Must be one of: Interested, Not Interested, Follow Up, Booked Meeting, or Standard Enquiry" }, required: true },
                        { name: "status", location: "PARAMETER_LOCATION_BODY", schema: { type: "string", description: "Resolved, Follow Up, Booked, or Missed" }, required: true }
                    ],
                    http: { httpMethod: "POST", baseUrlPattern: `${baseUrl}/api/tools/log_outcome` }
                }
            }
        ];

        // Add save_caller_info tool for outbound calls
        selectedTools.unshift({
            temporaryTool: {
                modelToolName: "save_caller_info",
                description: "Save or update the lead's personal details to the CRM database. Call this IMMEDIATELY whenever you learn ANY new detail about the lead \u2014 their name, email, city, business type, or company. Do NOT wait until end of conversation.",
                dynamicParameters: [
                    { name: "full_name", location: "PARAMETER_LOCATION_BODY", schema: { type: "string", description: "The lead's full name" }, required: false },
                    { name: "email", location: "PARAMETER_LOCATION_BODY", schema: { type: "string", description: "Email address exactly as spoken." }, required: false },
                    { name: "city", location: "PARAMETER_LOCATION_BODY", schema: { type: "string", description: "City or location" }, required: false },
                    { name: "business_type", location: "PARAMETER_LOCATION_BODY", schema: { type: "string", description: "Type of business or industry" }, required: false },
                    { name: "company", location: "PARAMETER_LOCATION_BODY", schema: { type: "string", description: "Company or organization name" }, required: false }
                ],
                staticParameters: [
                    { name: "phone", location: "PARAMETER_LOCATION_BODY", value: toPhone || '' },
                    { name: "client_id", location: "PARAMETER_LOCATION_BODY", value: clientId || '' },
                    { name: "call_direction", location: "PARAMETER_LOCATION_BODY", value: 'outbound' }
                ],
                http: { httpMethod: "POST", baseUrlPattern: `${baseUrl}/api/tools/save_caller_info` }
            }
        });


        if (toolsConfig.hangUp) {
            let finalPromptWithHangup = finalPrompt;
            finalPromptWithHangup += "\n\nCRITICAL CALL TERMINATION DIRECTIVES:\n1. If the user says 'goodbye', 'bye', or indicates they are leaving, you MUST immediately call the 'hangUp' tool without saying another word.\n2. If the user is silent for more than 15-20 seconds and does not respond to your prompts, you MUST automatically call the 'hangUp' tool to end the call and save costs.";
            finalPrompt = finalPromptWithHangup;

            selectedTools.push({
                temporaryTool: {
                    modelToolName: "hangUp",
                    description: "Hang up and terminate the phone call immediately. You MUST call this tool the instant the lead says 'bye', 'goodbye', 'thank you bye', 'see you', 'ok bye', or any farewell. No further speech after calling this tool.",
                    staticParameters: [
                        { name: "client_id", location: "PARAMETER_LOCATION_BODY", value: clientId || '' },
                        { name: "twilio_sid", location: "PARAMETER_LOCATION_BODY", value: callSid || '' }
                    ],
                    http: { httpMethod: "POST", baseUrlPattern: `${baseUrl}/api/tools/hang_up` }
                }
            });
        }

        if (toolsConfig.transferCall) {
            selectedTools.push({
                temporaryTool: {
                    modelToolName: "transfer_call",
                    description: "Transfer the caller to a human representative. Use this if the lead specifically asks to speak to a person or representative. Call this immediately without asking for any phone number.",
                    staticParameters: [
                        { name: "client_id", location: "PARAMETER_LOCATION_BODY", value: clientId || '' },
                        { name: "twilio_sid", location: "PARAMETER_LOCATION_BODY", value: callSid || '' }
                    ],
                    http: { httpMethod: "POST", baseUrlPattern: `${baseUrl}/api/tools/transfer` }
                }
            });
        }

        if (toolsConfig.queryCorpus) {
            selectedTools.push({
                temporaryTool: {
                    modelToolName: "query_corpus",
                    description: "Search the company's advanced knowledge base (PDFs, documents, and websites) for specific information. Use this if the standard knowledge base doesn't have the answer.",
                    dynamicParameters: [
                        { name: "query", location: "PARAMETER_LOCATION_BODY", schema: { type: "string", description: "The specific question or search term" }, required: true }
                    ],
                    http: { httpMethod: "POST", baseUrlPattern: clientId ? `${baseUrl}/api/tools/query-corpus/${clientId}` : `${baseUrl}/api/tools/query-corpus` }
                }
            });
        }

        if (toolsConfig.leaveVoicemail) {
            selectedTools.push({ toolName: "leaveVoicemail" });
        }

        if (toolsConfig.playDtmfSounds) {
            selectedTools.push({ toolName: "playDtmfSounds" });
        }

        let apiKeysObj = undefined;
        let finalUltravoxVoice = finalVoice;
        
        if (finalVoice === 'elevenlabs:custom') {
            const { data: elInt } = await supabase.from('integrations').select('*').eq('provider', 'elevenlabs').eq('client_id', client_id).maybeSingle();
            if (elInt && elInt.api_key && elInt.meta_data?.voice_id) {
                finalUltravoxVoice = `elevenlabs:${elInt.meta_data.voice_id}`;
                apiKeysObj = { elevenlabs: elInt.api_key };
            } else {
                console.warn("[Ultravox] ElevenLabs selected but no valid integration found. Falling back to default.");
                finalUltravoxVoice = "terrence";
            }
        }

        const uvResponse = await fetch('https://api.ultravox.ai/api/calls', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': ACTIVE_ULTRAVOX_KEY
            },
            body: JSON.stringify({
                systemPrompt: finalPrompt,
                voice: finalUltravoxVoice,
                temperature: agentData?.temperature || 0.3,
                firstSpeaker: "FIRST_SPEAKER_AGENT",
                initialMessages: initialMessage ? [{ role: 'MESSAGE_ROLE_AGENT', text: initialMessage }] : undefined,
                medium: { twilio: {} },
                selectedTools: selectedTools,
                inactivityMessages: [
                    { duration: '20s', message: "Are you still there?" }
                ],
                maxDuration: '1800s'
            })
        });

        const uvData = await uvResponse.json();
        const joinUrl = uvData.joinUrl;
        
        if (!joinUrl) {
            console.error("[Ultravox Outbound Error] Failed to generate joinUrl:", uvData);
            res.set('Content-Type', 'text/xml');
            const safeData = JSON.stringify(uvData).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
            return res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?><Response><Say>API Error: ${safeData}</Say></Response>`);
        }

        const safeJoinUrl = joinUrl.replace(/&/g, '&amp;');
        const ultravoxCallId = uvData.callId;

        // 3. Connect the Ultravox ID back to the original call
        if (callSid) {
            await supabase.from('calls').update({ ultravox_call_id: ultravoxCallId }).eq('twilio_sid', callSid);
        }

        // 4. Return TwiML
        const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Connect>
        <Stream url="${safeJoinUrl}">
            <Parameter name="myCustomMetadata" value="Outbound Sales Call"/>
        </Stream>
    </Connect>
</Response>`;

        res.set('Content-Type', 'text/xml');
        res.send(twiml);

    } catch (err) {
        console.error("[Twilio Outbound-TWIML] CRITICAL ERROR:", err.message);
        res.set('Content-Type', 'text/xml');
        return res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?><Response><Say>A server error occurred while connecting the A I. Please try again later.</Say></Response>`);
    }
});

// --- RECORDING CALLBACK: Move Twilio recordings to AWS S3 ---
app.post('/api/twilio/recording-callback', async (req, res) => {
    try {
        const { RecordingUrl, CallSid, RecordingSid, RecordingStatus } = req.body;
        console.log(`[Recording] Callback for Call: ${CallSid} | Sid: ${RecordingSid} | Status: ${RecordingStatus}`);
        res.send("OK"); // Respond immediately to Twilio

        if (RecordingStatus !== 'completed' || !RecordingUrl) return;

        // 1. Get client_id from call record
        const { data: callInfo } = await supabase.from('calls').select('client_id').eq('twilio_sid', CallSid).maybeSingle();
        const clientId = callInfo?.client_id;

        // 2. ALWAYS save Twilio URL immediately (works without S3)
        const twilioMp3Url = RecordingUrl + '.mp3';
        await supabase.from('calls').update({ recording_url: twilioMp3Url }).eq('twilio_sid', CallSid);
        console.log(`[Recording] Twilio URL saved for ${CallSid}: ${twilioMp3Url}`);

        // 3. Try S3 upload as enhancement (non-blocking)
        try {
            const { data: twInt } = await supabase.from('integrations').select('*').eq('provider', 'twilio').eq('client_id', clientId).maybeSingle();
            const { data: awsInt } = await supabase.from('integrations').select('*').eq('provider', 'aws_s3').eq('client_id', clientId).maybeSingle();
            const platformAws = await getPlatformKey('aws_s3');
            const platformTw = await getPlatformKey('twilio');

            const TW_SID = twInt?.meta_data?.sid || platformTw?.meta_data?.sid || process.env.TWILIO_ACCOUNT_SID;
            const TW_AUTH = twInt?.api_key || platformTw?.api_key || process.env.TWILIO_AUTH_TOKEN;
            const S3_BUCKET = awsInt?.meta_data?.bucket || platformAws?.meta_data?.bucket || process.env.S3_BUCKET_NAME;
            const s3 = await getS3Client();

            if (s3 && S3_BUCKET && TW_SID && TW_AUTH) {
                const audioResp = await axios({ method: 'get', url: twilioMp3Url, responseType: 'arraybuffer', auth: { username: TW_SID, password: TW_AUTH } });
                const key = `recordings/${clientId || 'platform'}/${CallSid}.mp3`;
                await s3.send(new PutObjectCommand({ Bucket: S3_BUCKET, Key: key, Body: audioResp.data, ContentType: 'audio/mpeg' }));
                const s3Url = `https://${S3_BUCKET}.s3.amazonaws.com/${key}`;
                await supabase.from('calls').update({ recording_url: s3Url }).eq('twilio_sid', CallSid);
                console.log(`[Recording] Upgraded to S3: ${s3Url}`);
            }
        } catch (s3Err) {
            console.warn(`[Recording] S3 upload skipped (Twilio URL kept): ${s3Err.message}`);
        }
    } catch (err) {
        console.error("[Recording] Error processing callback:", err);
        res.status(500).send("Error");
    }

});

// Fetch Call Logs - STRICTLY filtered by client_id for data isolation
app.get('/api/calls', async (req, res) => {
    try {
        const { client_id } = req.query;
        // SECURITY: Never return all calls - require client_id
        if (!client_id) {
            console.warn('[/api/calls] Request without client_id rejected - data isolation enforced');
            return res.json({ success: true, calls: [] });
        }
        const { data, error } = await supabase
            .from('calls').select('*')
            .eq('client_id', client_id)
            .order('created_at', { ascending: false })
            .limit(200);
        if (error) throw error;
        res.json({ success: true, calls: data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Proxy Twilio Recordings securely
app.get('/api/recordings/:callSid', async (req, res) => {
    try {
        const { callSid } = req.params;
        const { data: call } = await supabase.from('calls').select('*').eq('twilio_sid', callSid).maybeSingle();
        
        if (!call || !call.recording_url) {
            return res.status(404).send('Recording not found');
        }

        if (!call.recording_url.includes('api.twilio.com')) {
            return res.redirect(call.recording_url); // Redirect to S3 if upgraded
        }

        // Fetch credentials
        const { data: twInt } = await supabase.from('integrations').select('*').eq('provider', 'twilio').eq('client_id', call.client_id).maybeSingle();
        const platformTw = await getPlatformKey('twilio');
        const TW_SID = twInt?.meta_data?.sid || platformTw?.meta_data?.sid || process.env.TWILIO_ACCOUNT_SID;
        const TW_AUTH = twInt?.api_key || platformTw?.api_key || process.env.TWILIO_AUTH_TOKEN;

        if (!TW_SID || !TW_AUTH) {
            return res.status(401).send('Telephony credentials missing');
        }

        const axios = require('axios');
        const response = await axios({
            method: 'get',
            url: call.recording_url,
            responseType: 'stream',
            auth: { username: TW_SID, password: TW_AUTH }
        });

        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Content-Disposition', `inline; filename="recording_${callSid}.mp3"`);
        response.data.pipe(res);

    } catch (err) {
        console.error("[Recording Proxy] Error fetching recording:", err.message);
        res.status(500).send("Error fetching recording stream");
    }
});

// CRM Contacts - STRICTLY filtered by client_id
app.get('/api/contacts', async (req, res) => {
    try {
        const { client_id } = req.query;
        if (!client_id) return res.json({ success: true, contacts: [] });
        const { data, error } = await supabase
            .from('contacts').select('*')
            .eq('client_id', client_id)
            .order('created_at', { ascending: false });
        if (error) throw error;
        res.json({ success: true, contacts: data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/contacts', async (req, res) => {
    try {
        const { name, phone_number, email, notes, client_id } = req.body;
        const { data, error } = await supabase
            .from('contacts')
            .insert([{ name, phone_number, email, notes, client_id }])
            .select();
        if (error) throw error;
        res.json({ success: true, contact: data[0] });
    } catch (err) {
        res.status(500).json({ error: err.message || "Could not save contact." });
    }
});

app.delete('/api/contacts/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabase.from('contacts').delete().eq('id', id);
        if (error) throw error;
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Could not delete contact." });
    }
});

// GET Agent Settings from Dashboard
app.get('/api/agent', async (req, res) => {
    try {
        const { client_id } = req.query;
        let { data: agentData, error } = await supabase.from('agent_settings').select('*').eq('client_id', client_id).limit(1).maybeSingle();
        if (error || !agentData) {
            agentData = { system_prompt: "You are an AI assistant.", voice_preset: "Mark", temperature: 0.3 };
        }
        res.json({ success: true, agent: agentData });
    } catch (err) {
        res.status(500).json({ error: "Could not fetch agent settings." });
    }
});

// POST Agent Settings from Dashboard (Saving updates!)
app.post('/api/agent', async (req, res) => {
    try {
        const { 
            client_id, system_prompt, voice_preset, temperature, 
            personality, greeting_message,
            working_days, open_time, close_time, non_working_dates,
            tools_config, campaign_goal
        } = req.body;
        
        const updateData = {
            client_id, system_prompt, voice_preset, temperature, 
            personality, greeting_message, working_days, open_time, 
            close_time, non_working_dates, tools_config
        };
        
        if (req.body.record_calls !== undefined) updateData.record_calls = req.body.record_calls;
        if (campaign_goal !== undefined) updateData.campaign_goal = campaign_goal;
        
        const { data: existing, error: findErr } = await supabase.from('agent_settings').select('id').eq('client_id', client_id).limit(1).maybeSingle();
        if (findErr) throw findErr;
        
        let result;
        if (existing && existing.id) {
            result = await supabase.from('agent_settings').update(updateData).eq('id', existing.id);
        } else {
            result = await supabase.from('agent_settings').insert([updateData]);
        }
        
        if (result.error) {
            console.error("[Agent Update Error] Supabase details:", result.error);
            if (result.error.message && (result.error.message.includes('tools_config') || result.error.message.includes('record_calls'))) {
                return res.status(400).json({ 
                    error: "Database columns 'tools_config' or 'record_calls' are missing. Please execute the migration file 'backend/migration_add_tools_config.sql' in your Supabase SQL Editor."
                });
            }
            throw result.error;
        }
        
        res.json({ success: true, message: "Agent successfully updated!" });
    } catch (err) {
        console.error("Agent Update Catch Error:", err);
        res.status(500).json({ error: err.message || "Could not save agent settings." });
    }
});

// --- DEDICATED: Save campaign goal only (safe - won't overwrite other settings) ---
app.patch('/api/agent/campaign-goal', async (req, res) => {
    try {
        const { client_id, campaign_goal } = req.body;
        if (!client_id) return res.status(400).json({ error: 'client_id required' });
        const { data: existing } = await supabase.from('agent_settings').select('id').eq('client_id', client_id).limit(1).maybeSingle();
        if (existing?.id) {
            await supabase.from('agent_settings').update({ campaign_goal }).eq('id', existing.id);
        } else {
            await supabase.from('agent_settings').insert([{ client_id, campaign_goal }]);
        }
        res.json({ success: true });
    } catch(err) { res.status(500).json({ error: 'Failed to save campaign goal' }); }
});

// Twilio Call Status Webhook (Hangs up, fetches Summary from Ultravox!)
app.post('/api/twilio/status/:client_id?', async (req, res) => {
    let client_id = req.params.client_id || req.body.client_id || "";
    if (client_id === "undefined" || client_id === "null") client_id = "";
    const callSid = req.body.CallSid;
    const callDuration = req.body.CallDuration || 0;
    const callStatus = req.body.CallStatus; // 'completed'

    console.log(`Call Ended: ${callSid}. Waiting 5 seconds for Ultravox to generate Summary...`);
    res.sendStatus(200); // Instantly reply to Twilio so it drops the connection cleanly.

    // Background process: wait 8 seconds to ensure LLM has generated transcript/summary
    if (callStatus === 'completed') {
        setTimeout(async () => {
            try {
                // Find mapping row
                const { data: callRow } = await supabase.from('calls').select('ultravox_call_id, client_id, direction, from_phone, to_phone').eq('twilio_sid', callSid).single();
                if (!callRow || !callRow.ultravox_call_id) return;

                // Fetch Key (Priority: Client -> Platform -> Env)
                const { data: clientUV3 } = await supabase.from('integrations').select('*').eq('provider', 'ultravox').eq('client_id', callRow.client_id).maybeSingle();
                const platformUV3 = await getPlatformKey('ultravox');
                const ACTIVE_ULTRAVOX_KEY = clientUV3?.api_key || platformUV3?.api_key || process.env.ULTRAVOX_API_KEY;

                // Fetch data from Ultravox
                const uvRes = await fetch(`https://api.ultravox.ai/api/calls/${callRow.ultravox_call_id}`, {
                    headers: { 'X-API-Key': ACTIVE_ULTRAVOX_KEY }
                });
                const uvData = await uvRes.json();

                // Save to Supabase
                const summary = uvData.summary || "No summary available.";

                // ── Keyword-based failsafe sentiment scanner ──────────────────
                const negativeWords = ["frustrat", "angr", "angry", "disappoint", "complaint", "unhappy", "bad", "terrible", "don't call", "stop calling", "no further contact", "abrupt", "hangs up", "escalated", "rude", "useless", "waste", "not interested", "failed to book", "fail to book"];
                const positiveWords = ["happy", "great", "thank", "helpful", "interested", "excellent", "excited", "looking forward", "confirmed", "resolved", "satisfied", "pleased", "appreciate", "good experience"];

                const lowerSummary = summary.toLowerCase();
                
                // Smart check for NOT booked vs Booked
                const isExplicitlyNotBooked = lowerSummary.includes("not book") || lowerSummary.includes("didn't book") || lowerSummary.includes("did not book") || lowerSummary.includes("no appointment") || lowerSummary.includes("unsuccessful") || lowerSummary.includes("decline");
                const isExplicitlyBooked = !isExplicitlyNotBooked && (lowerSummary.includes("booked") || lowerSummary.includes("confirmed appointment"));

                let isNegative = negativeWords.some(word => lowerSummary.includes(word)) || isExplicitlyNotBooked;
                let isPositive = positiveWords.some(word => lowerSummary.includes(word)) || isExplicitlyBooked;

                // Map a short 1-2 word reason from keywords
                let mappedReason = null;
                if (isExplicitlyNotBooked) mappedReason = "Not Booked";
                else if (isExplicitlyBooked) mappedReason = "Booked";
                else if (lowerSummary.includes("frustrat")) mappedReason = "Frustrated";
                else if (lowerSummary.includes("angr")) mappedReason = "Angry";
                else if (lowerSummary.includes("disappoint")) mappedReason = "Disappointed";
                else if (lowerSummary.includes("escalat")) mappedReason = "Escalated";
                else if (lowerSummary.includes("interest")) mappedReason = "Interested";
                else if (lowerSummary.includes("thank")) mappedReason = "Thankful";
                else if (lowerSummary.includes("satisf") || lowerSummary.includes("pleased")) mappedReason = "Satisfied";
                else if (lowerSummary.includes("resolv")) mappedReason = "Resolved";
                else if (isPositive) mappedReason = "Positive";
                else if (isNegative) mappedReason = "Negative";

                // ── Check if AI already logged a real sentiment via log_call_outcome ──
                const { data: currCall } = await supabase.from('calls').select('sentiment_category, sentiment').eq('twilio_sid', callSid).single();

                const aiAlreadyLogged = currCall?.sentiment_category && currCall.sentiment_category !== 'Neutral' && currCall.sentiment_category !== null;

                let finalCategory = currCall?.sentiment_category || 'Neutral';
                let finalSentiment = currCall?.sentiment || 'Neutral';

                if (aiAlreadyLogged) {
                    // ✅ AI logged a real sentiment in real-time — trust it, don't override
                    console.log(`[SENTIMENT] AI already logged: ${finalCategory} (${finalSentiment}) for ${callSid} — keeping AI result.`);
                } else {
                    // Fallback: use keyword scan on the summary
                    if (isNegative && !isPositive) {
                        finalCategory = 'Negative';
                        finalSentiment = mappedReason || 'Negative';
                        console.log(`[SENTIMENT] Keyword fallback → NEGATIVE for ${callSid}.`);
                    } else if (isPositive && !isNegative) {
                        finalCategory = 'Positive';
                        finalSentiment = mappedReason || 'Positive';
                        console.log(`[SENTIMENT] Keyword fallback → POSITIVE for ${callSid}.`);
                    } else {
                        // If conflict or none, default to neutral but keep reasoned tag
                        finalCategory = 'Neutral';
                        finalSentiment = mappedReason || 'Neutral';
                        console.log(`[SENTIMENT] No strong/conflicting signal found — staying Neutral for ${callSid}.`);
                    }
                }

                await supabase.from('calls').update({
                    status: 'completed',
                    duration_seconds: callDuration,
                    ai_summary: summary,
                    sentiment: finalSentiment,
                    sentiment_category: finalCategory,
                    transcript: "Feature pending native Ultravox messages mapping."
                }).eq('twilio_sid', callSid);

                // Update Client Cumulative Stats
                if (callRow.client_id) {
                    const { data: client } = await supabase.from('clients').select('calls_count, mins_used').eq('id', callRow.client_id).maybeSingle();
                    if (client) {
                        await supabase.from('clients').update({
                            calls_count: (client.calls_count || 0) + 1,
                            mins_used: (client.mins_used || 0) + Math.ceil(callDuration / 60)
                        }).eq('id', callRow.client_id);
                    }

                    // --- CALLER MEMORY: INJECT CALL SUMMARY INTO PROFILES & LEADS ---
                    try {
                        const leadPhone = callRow.direction === 'inbound' ? callRow.from_phone : callRow.to_phone;
                        if (leadPhone) {
                            const cleanPhone = String(leadPhone).replace(/\D/g, '');
                            if (cleanPhone.length >= 10) {
                                const phoneSuffix = cleanPhone.slice(-10);
                                const dateStr = new Date().toISOString().split('T')[0];
                                const dirLabel = callRow.direction === 'inbound' ? 'inbound' : 'outbound';
                                const newSummaryEntry = `[${dateStr} - ${dirLabel}]: ${summary}`;

                                // 1. Update caller_profiles (NEW)
                                try {
                                    const { data: profileMatch } = await supabase.from('caller_profiles')
                                        .select('id, total_calls, conversation_history')
                                        .eq('client_id', callRow.client_id || '')
                                        .eq('phone_suffix', phoneSuffix)
                                        .limit(1);

                                    const historyItem = {
                                        date: dateStr,
                                        direction: dirLabel,
                                        summary: summary,
                                        outcome: finalSentiment
                                    };

                                    if (profileMatch && profileMatch.length > 0) {
                                        const p = profileMatch[0];
                                        const oldHistory = Array.isArray(p.conversation_history) ? p.conversation_history : [];
                                        await supabase.from('caller_profiles').update({
                                            total_calls: (p.total_calls || 0) + 1,
                                            last_call_at: new Date().toISOString(),
                                            last_call_direction: dirLabel,
                                            last_call_summary: summary,
                                            last_call_outcome: finalSentiment,
                                            conversation_history: [...oldHistory, historyItem],
                                            updated_at: new Date().toISOString()
                                        }).eq('id', p.id);
                                    } else {
                                        await supabase.from('caller_profiles').insert([{
                                            phone: leadPhone,
                                            phone_suffix: phoneSuffix,
                                            client_id: callRow.client_id || null,
                                            total_calls: 1,
                                            last_call_at: new Date().toISOString(),
                                            last_call_direction: dirLabel,
                                            last_call_summary: summary,
                                            last_call_outcome: finalSentiment,
                                            conversation_history: [historyItem]
                                        }]);
                                    }
                                } catch (pErr) {
                                    console.error("[CallerMemory] caller_profiles update error:", pErr.message);
                                }

                                // 2. Update leads table (LEGACY)
                                const { data: leadMatch } = await supabase.from('leads')
                                    .select('id, name, ai_context')
                                    .eq('client_id', callRow.client_id || '')
                                    .ilike('phone', `%${phoneSuffix}%`)
                                    .maybeSingle();
                                    
                                if (leadMatch) {
                                    const newContext = leadMatch.ai_context 
                                        ? `${leadMatch.ai_context}\n${newSummaryEntry}`
                                        : newSummaryEntry;
                                    await supabase.from('leads').update({ ai_context: newContext }).eq('id', leadMatch.id);
                                    console.log(`[CallerMemory] Appended summary to Lead ID: ${leadMatch.id} ("${leadMatch.name}")`);
                                } else {
                                    console.log(`[CallerMemory] New caller ${leadPhone} — auto-creating lead entry...`);
                                    await supabase.from('leads').insert([{
                                        phone: leadPhone,
                                        client_id: callRow.client_id || null,
                                        source: callRow.direction === 'inbound' ? 'Inbound Call' : 'Outbound Call',
                                        ai_context: newSummaryEntry,
                                        segment: 'Auto-captured'
                                    }]);
                                }
                            }
                        }
                    } catch (err) {
                        console.error("[CallerMemory] Failed to update/create caller context:", err);
                    }
                }

                console.log(`[SENTIMENT_SYSTEM_v3.0] Final for ${callSid}: ${finalCategory} (${finalSentiment})`);
            } catch (err) {
                console.error("Failed capturing AI Summary in background:", err);
            }
        }, 8000); // 8 second buffer
    }
});

app.get('/api/integrations', async (req, res) => {
    try {
        const { client_id } = req.query;
        let query = supabase.from('integrations').select('*');
        if (client_id) query = query.eq('client_id', client_id);
        const { data, error } = await query;
        if (error) return res.json({ success: true, integrations: [] });
        res.json({ success: true, integrations: data });
    } catch (err) {
        res.status(500).json({ error: "Could not fetch integrations." });
    }
});

app.post('/api/integrations', async (req, res) => {
    try {
        const { provider, api_key, meta_data, client_id } = req.body;
        const { data: existing } = await supabase.from('integrations').select('id').eq('provider', provider).eq('client_id', client_id).maybeSingle();
        
        if (existing && existing.id) {
            await supabase.from('integrations').update({ api_key, meta_data }).eq('id', existing.id);
        } else {
            await supabase.from('integrations').insert([{ provider, api_key, meta_data, client_id }]);
        }
        
        res.json({ success: true, message: "Integration updated successfully!" });
    } catch (err) {
        res.status(500).json({ error: "Could not save integration." });
    }
});

// Helper: Force incoming date strings into IST (UTC+05:30) if offset is missing
function forceIST(dateStr) {
    if (!dateStr) return null;
    let s = String(dateStr).trim();
    // If it's just YYYY-MM-DD, add start of day and offset
    if (s.length === 10 && /^\d{4}-\d{2}-\d{2}$/.test(s)) {
        return `${s}T00:00:00+05:30`;
    }
    // If it has T but no offset sign (+ or -) and doesn't end with Z, append IST offset
    if (s.includes('T') && !s.includes('+') && !s.includes('-', s.indexOf('T')) && !s.endsWith('Z')) {
        return `${s}+05:30`;
    }
    return s;
}

app.post('/api/tools/availability/:client_id?', async (req, res) => {
    try {
        let client_id = req.params.client_id || req.body.client_id || "";
        if (client_id === "undefined" || client_id === "null") client_id = "";
        const { target_date } = req.body;
        console.log(`[AI TOOL] 🔍 Availability check requested for: ${target_date}`);
        
        if (!target_date || !target_date.match(/^\d{4}-\d{2}-\d{2}$/)) {
            console.warn(`[AI TOOL] ⚠️ Invalid or missing target_date: ${target_date}`);
            return res.json({ available_slots: "Please provide a valid target_date in YYYY-MM-DD format." });
        }

        // 1. Fetch current agent settings for business hours (Defensive Fetch)
        const { data: agentData, error: agentError } = await supabase.from('agent_settings').select('*').eq('client_id', client_id).limit(1).maybeSingle();
        
        // 2. Determine day name (Timezone Independent Fix)
        const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        const [y, m, d] = target_date.split('-');
        const targetDateObj = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
        const targetDayName = days[targetDateObj.getUTCDay()];

        // 3. Apply Settings or Defaults
        const nonWorkingDates = agentData?.non_working_dates || [];
        const workingDays = Array.isArray(agentData?.working_days) ? agentData.working_days : ["Mon", "Tue", "Wed", "Thu", "Fri"];
        const openTime = agentData?.open_time || '09:00';
        const closeTime = agentData?.close_time || '18:00';

        if (nonWorkingDates.includes(target_date)) {
            console.log(`[AI TOOL] 🏖️ Holiday detected on ${target_date}`);
            return res.json({ available_slots: "The business is closed for a holiday on " + target_date });
        }
        
        if (!workingDays.includes(targetDayName)) {
            console.log(`[AI TOOL] 🚪 Closed on ${targetDayName}`);
            return res.json({ available_slots: "The business is closed on " + targetDayName + "s." });
        }
        
        // 4. Generate slots in IST (30-minute intervals)
        const [openH, openM] = openTime.split(':').map(Number);
        const [closeH, closeM] = (closeTime || '18:00').split(':').map(Number);
        
        const openMinutes = openH * 60 + (openM || 0);
        const closeMinutes = closeH * 60 + (closeM || 0);
        
        let allSlots = [];
        for (let m = openMinutes; m < closeMinutes; m += 30) {
            const h = Math.floor(m / 60);
            const min = m % 60;
            const timeStr = `${h.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
            allSlots.push(`${target_date}T${timeStr}:00+05:30`);
        }
        
        // 5. Fetch confirmed appointments to find conflicts
        const dayStart = `${target_date}T00:00:00+05:30`;
        const dayEnd = `${target_date}T23:59:59+05:30`;
        const { data: existingApps, error: dbErr } = await supabase
            .from('appointments')
            .select('start_time')
            .eq('status', 'confirmed')
            .eq('client_id', client_id)
            .gte('start_time', dayStart)
            .lte('start_time', dayEnd);
        
        const bookedISOs = (existingApps || []).map(a => new Date(a.start_time).toISOString());
        
        let freeSlots = allSlots.filter(slot => {
            const slotISO = new Date(slot).toISOString();
            // Check for overlap within 25 minutes
            return !bookedISOs.some(bookedISO => {
                const diff = Math.abs(new Date(slotISO) - new Date(bookedISO));
                return diff < 25 * 60 * 1000;
            });
        });
        
        console.log(`[AI TOOL] ✅ Availability Summary for ${target_date} (${targetDayName}): Found ${freeSlots.length} free slots from ${allSlots.length} possible.`);
        res.json({ available_slots: freeSlots.length > 0 ? freeSlots : "No free slots available on this date. Please check another day." });
    } catch (e) {
        console.error("[AI TOOL] 🚨 Availability Crash:", e);
        res.json({ available_slots: "I'm having a technical issue checking the calendar. Please suggest a date and time, and I will record your request." });
    }
});

// Revised Helper: Extracts and repairs email from body by scanning all fields
function extractEmailFromBody(body) {
    const scanAndProcess = (val) => {
        if (typeof val !== 'string' || val.length < 5) return null;
        let repaired = repairEmail(val);
        // Even MORE forgiving check: just @ and some length is enough to try
        if (repaired.includes('@') && repaired.length > 5) {
            return repaired;
        }
        return null;
    };

    // 1. Check known keys first
    const emailKeys = ['email', 'email_address', 'user_email', 'emailAddress', 'callerEmail', 'contact_email', 'customer_email', 'mail'];
    for (const key of emailKeys) {
        let result = scanAndProcess(body[key]);
        if (result) return result;
    }

    // 2. Scan every value in the body (Deep Scan)
    for (const val of Object.values(body)) {
        let result = scanAndProcess(val);
        if (result) return result;
    }

    return null;
}

// Helper: aggressively repair STT-transcribed email text
function repairEmail(raw) {
    if (!raw) return null;
    let e = String(raw).toLowerCase().trim();
    // Replace spoken words with symbols (most specific patterns first)
    e = e.replace(/\bat\s+the\s+rate\s+of\b/g, '@');
    e = e.replace(/\bat\s+the\s+rate\b/g, '@');
    e = e.replace(/\bthe\s+at\s+sign\b/g, '@');
    e = e.replace(/\bat\s+symbol\b/g, '@');
    e = e.replace(/\s*@\s*/g, '@');  // remove spaces around @
    e = e.replace(/\bunder\s+score\b/g, '_');
    e = e.replace(/\bunderscore\b/g, '_');
    e = e.replace(/\bdash\b/g, '-');
    e = e.replace(/\bhyphen\b/g, '-');
    e = e.replace(/\bdot\b/g, '.');
    e = e.replace(/\bpoint\b/g, '.');
    e = e.replace(/\bperiod\b/g, '.');
    e = e.replace(/\bat\b/g, '@');  // standalone 'at'
    
    // Remove all remaining whitespace
    e = e.replace(/\s+/g, '');

    // AUTO-CORRECT: common voice mistakes (e.g. "gmailcom" -> "gmail.com")
    if (e.includes('gmailcom')) e = e.replace('gmailcom', 'gmail.com');
    if (e.includes('outlookcom')) e = e.replace('outlookcom', 'outlook.com');
    if (e.includes('yahooitaly')) e = e.replace('yahooitaly', 'yahoo.it');
    if (e.includes('yahoocom')) e = e.replace('yahoocom', 'yahoo.com');
    if (e.includes('hotmailcom')) e = e.replace('hotmailcom', 'hotmail.com');
    if (e.includes('icloudcom')) e = e.replace('icloudcom', 'icloud.com');

    return e;
}

app.post('/api/tools/book/:client_id?', async (req, res) => {
    try {
        let client_id = req.params.client_id || req.body.client_id || "";
        if (client_id === "undefined" || client_id === "null") client_id = "";
        let { start_time, name, phone } = req.body;
        
        // HYPER-RESILIENT: Extract using the new Repair-First logic
        let email = extractEmailFromBody(req.body);

        // --- AI VALIDATION GUARDRAILS (softened messages to stop loops) ---
        if (!name || name.trim() === '' || name.toLowerCase().includes('unknown')) {
            return res.json({ result: "I still need the caller's full name to complete the booking. Could you please collect it?" });
        }
        if (!phone || phone.trim() === '' || phone.toLowerCase().includes('unknown')) {
            return res.json({ result: "I still need the caller's phone number to complete the booking. Could you please collect it?" });
        }

        // --- DATA INTEGRITY FIX: Force IST and check conflicts with 'Self-Recognition' ---
        const istStartTime = forceIST(start_time);
        const startDate = new Date(istStartTime);
        if (isNaN(startDate.getTime())) {
            return res.json({ result: "Invalid date format." });
        }

        const windowStart = new Date(startDate.getTime() - 25 * 60 * 1000); // 25 min buffer
        const windowEnd = new Date(startDate.getTime() + 25 * 60 * 1000);
        
        const { data: existing } = await supabase
            .from('appointments')
            .select('id, name, phone, status')
            .eq('status', 'confirmed')
            .eq('client_id', client_id)
            .gte('start_time', windowStart.toISOString())
            .lte('start_time', windowEnd.toISOString());

        if (existing && existing.length > 0) {
            const myMatch = existing.find(ex => ex.phone === phone);
            if (!myMatch) {
                const occupant = existing[0].name || "another caller";
                return res.json({ result: `That time slot was just taken by ${occupant}. Please check for the next available slot.` });
            }
        }

        const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // 1 hour duration
        
        const bookingPayload = { 
            name: name || "AI Caller", 
            phone: phone || "", 
            email: email || null,
            notes: req.body.notes || null,
            start_time: startDate.toISOString(), 
            end_time: endDate.toISOString(),
            status: 'confirmed',
            source: 'ai_agent',
            client_id
        };

        const { data, error } = await supabase.from('appointments').insert([bookingPayload]).select();
        
        if (error) return res.json({ result: "Failed to save appointment." });

        // --- SUCCESS RESPONSE (Early Return) ---
        res.json({ result: `Appointment successfully booked for ${name} on ${startDate.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}. Confirmed!` });

        // --- BACKGROUND SYNC (Protected) ---
        (async () => {
            try {
                if (phone) {
                    await supabase.from('leads').upsert([{ 
                        phone, 
                        name: name || 'Valued Customer', 
                        email: email || null, 
                        client_id
                    }], { onConflict: 'phone' });

                    await dispatchOmnichannel((data?.[0]?.id || 'unknown'), name || 'caller', phone, email, 'booking_confirmed', { start_time: startDate.toISOString() });
                }
            } catch (syncErr) {}
        })();
    } catch(err) {
        res.json({ result: "I encountered a technical error while booking." });
    }
});

app.post('/api/tools/update', async (req, res) => {
    try {
        const { name, phone, new_start_time, client_id } = req.body;
        const { data: appointments } = await supabase.from('appointments').select('*').eq('client_id', client_id).ilike('name', `%${name}%`).eq('phone', phone);
        if (!appointments || appointments.length === 0) return res.json({ result: "Authentication failed." });

        const target = appointments[0]; 
        await supabase.from('appointments').update({ start_time: new_start_time }).eq('id', target.id);
        
        dispatchOmnichannel(target.id, target.name, target.phone, target.email, 'booking_updated', { start_time: new_start_time });
        res.json({ result: "Appointment successfully rescheduled." });
    } catch(err) {
        res.status(500).json({ result: "Failed to update" });
    }
});

app.post('/api/tools/delete', async (req, res) => {
    try {
        const { name, phone, client_id } = req.body;
        const { data: appointments } = await supabase.from('appointments').select('*').eq('client_id', client_id).ilike('name', `%${name}%`).eq('phone', phone);
        if (!appointments || appointments.length === 0) return res.json({ result: "Authentication failed." });

        const target = appointments[0];
        await supabase.from('appointments').delete().eq('id', target.id);
        dispatchOmnichannel(target.id, target.name, target.phone, target.email, 'booking_deleted', { start_time: target.start_time });
        res.json({ result: "Appointment successfully cancelled." });
    } catch(err) {
        res.status(500).json({ result: "Failed to delete" });
    }
});

// ===== CALLER PROFILES: AI Tool to save caller details during a call =====
app.post('/api/tools/save_caller_info', async (req, res) => {
    try {
        const { phone, full_name, email, city, business_type, company, client_id, call_direction } = req.body;
        console.log(`[SaveCallerInfo] Saving: phone=${phone}, name=${full_name}, email=${email}, city=${city}, biz=${business_type}, company=${company}, client=${client_id}`);

        if (!phone || phone === 'undefined') {
            return res.json({ result: "Details noted. Thank you!" });
        }

        const cleanPhone = String(phone).replace(/\D/g, '');
        const phoneSuffix = cleanPhone.length >= 10 ? cleanPhone.slice(-10) : cleanPhone;

        // Build update object (only include fields that have values)
        const updateData = {};
        if (full_name && full_name.trim()) {
            updateData.full_name = full_name.trim();
            updateData.first_name = full_name.trim().split(' ')[0];
        }
        if (email && email.trim()) {
            // Auto-convert spoken email: "john at gmail dot com" → "john@gmail.com"
            let cleanEmail = email.trim()
                .replace(/\s+dot\s+/gi, '.')
                .replace(/\s+at\s+/gi, '@')
                .replace(/\s+/g, '');
            updateData.email = cleanEmail;
        }
        if (city && city.trim()) updateData.city = city.trim();
        if (business_type && business_type.trim()) updateData.business_type = business_type.trim();
        if (company && company.trim()) updateData.company = company.trim();

        if (Object.keys(updateData).length === 0) {
            return res.json({ result: "No new details to save." });
        }

        // Upsert into caller_profiles
        try {
            const { data: existingProfile } = await supabase.from('caller_profiles')
                .select('id, full_name, email, city, business_type, company')
                .eq('phone_suffix', phoneSuffix)
                .eq('client_id', client_id || '')
                .limit(1);

            if (existingProfile && existingProfile.length > 0) {
                // Update existing profile — only overwrite fields that are newly provided
                const mergedUpdate = { ...updateData, updated_at: new Date().toISOString() };
                await supabase.from('caller_profiles').update(mergedUpdate).eq('id', existingProfile[0].id);
                console.log(`[SaveCallerInfo] Updated profile ${existingProfile[0].id}`);
            } else {
                // Create new profile
                await supabase.from('caller_profiles').insert([{
                    phone: phone,
                    phone_suffix: phoneSuffix,
                    client_id: client_id || null,
                    ...updateData
                }]);
                console.log(`[SaveCallerInfo] Created new profile for ${phoneSuffix}`);
            }
        } catch (profileErr) {
            console.error(`[SaveCallerInfo] caller_profiles error (table may not exist yet):`, profileErr.message);
        }

        // Also update leads table for backwards compatibility
        try {
            const { data: leadMatch } = await supabase.from('leads')
                .select('id, name, email')
                .ilike('phone', `%${phoneSuffix}%`)
                .limit(1);

            if (leadMatch && leadMatch.length > 0) {
                const leadUpdate = {};
                if (updateData.full_name && !leadMatch[0].name) leadUpdate.name = updateData.full_name;
                if (updateData.email && !leadMatch[0].email) leadUpdate.email = updateData.email;
                if (Object.keys(leadUpdate).length > 0) {
                    await supabase.from('leads').update(leadUpdate).eq('id', leadMatch[0].id);
                }
            }
        } catch (leadErr) {
            console.error(`[SaveCallerInfo] leads table error:`, leadErr.message);
        }

        const savedFields = Object.keys(updateData).join(', ');
        res.json({ result: `Successfully saved: ${savedFields}. Details are now in the CRM.` });
    } catch (err) {
        console.error("[SaveCallerInfo] Error:", err.message);
        res.json({ result: "Details noted. Thank you!" });
    }
});

app.post('/api/tools/log_outcome', async (req, res) => {
    try {
        const { phone, sentiment, category, status, client_id } = req.body;
        const cleanPhone = String(phone).replace(/\D/g, '');
        const { data: calls } = await supabase.from('calls').select('id').eq('client_id', client_id).or(`from_phone.ilike.%${cleanPhone}%,to_phone.ilike.%${cleanPhone}%`).order('created_at', { ascending: false }).limit(1);

        if (calls && calls.length > 0) {
            await supabase.from('calls').update({ sentiment, sentiment_category: category, call_status: status }).eq('id', calls[0].id);
            await supabase.from('leads').upsert([{ phone, client_id, segment: 'Qualified' }], { onConflict: 'phone' });
        }
        res.json({ result: "Outcome logged." });
    } catch(err) { res.status(500).json({ result: "Failed to log" }); }
});

app.post('/api/tools/hang_up', async (req, res) => {
    // Respond to Ultravox FIRST so the AI stops talking immediately
    res.setHeader('X-Ultravox-Response-Type', 'hang-up');
    res.json({ result: "Goodbye! Ending the call now." });
    try {
        const { phone } = req.body;
        const paramClientId = req.body.client_id;
        const paramTwilioSid = req.body.twilio_sid;
        const ultravoxCallId = req.body.callId;

        console.log(`[HANG_UP] Triggered for paramClientId=${paramClientId}, paramTwilioSid=${paramTwilioSid}, phone=${phone}, ultravoxCallId=${ultravoxCallId}`);
        
        let activeClientId = paramClientId;
        let activeTwilioSid = paramTwilioSid;

        if (ultravoxCallId && (!activeClientId || !activeTwilioSid)) {
            const { data: calls } = await supabase.from('calls').select('twilio_sid, client_id').eq('ultravox_call_id', ultravoxCallId).limit(1);
            if (calls && calls.length > 0) {
                activeClientId = activeClientId || calls[0].client_id;
                activeTwilioSid = activeTwilioSid || calls[0].twilio_sid;
            }
        }

        if (!activeClientId || !activeTwilioSid) {
            const cleanPhone = String(phone || '').replace(/\D/g, '');
            let query = supabase.from('calls').select('twilio_sid, client_id').eq('client_id', activeClientId).order('created_at', { ascending: false }).limit(1);
            if (cleanPhone.length > 5) {
                query = supabase.from('calls').select('twilio_sid, client_id').eq('client_id', activeClientId).or(`from_phone.ilike.%${cleanPhone}%,to_phone.ilike.%${cleanPhone}%`).order('created_at', { ascending: false }).limit(1);
            }
            const { data: calls } = await query;
            if (calls && calls.length > 0) {
                activeClientId = activeClientId || calls[0].client_id;
                activeTwilioSid = activeTwilioSid || calls[0].twilio_sid;
            }
        }

        console.log(`[HANG_UP] Resolved activeClientId=${activeClientId}, activeTwilioSid=${activeTwilioSid}`);
        if (activeClientId && activeTwilioSid) {
            const { data: twInt } = await supabase.from('integrations').select('*').eq('provider', 'twilio').eq('client_id', activeClientId).maybeSingle();
            if (twInt?.meta_data?.sid && twInt?.api_key) {
                const twilioClient = require('twilio')(twInt.meta_data.sid, twInt.api_key);
                await twilioClient.calls(activeTwilioSid).update({ status: 'completed' });
                console.log(`[HANG_UP] Successfully terminated call ${activeTwilioSid}`);
            } else { console.warn('[HANG_UP] No Twilio credentials found for client'); }
        } else { console.warn('[HANG_UP] Could not resolve call details to terminate'); }
    } catch(err) { console.error('[HANG_UP] Error:', err.message); }
});

app.post('/api/tools/transfer', async (req, res) => {
    try {
        const paramClientId = req.body.client_id;
        const paramTwilioSid = req.body.twilio_sid;
        const ultravoxCallId = req.body.callId;

        console.log(`[TRANSFER] Triggered. client_id=${paramClientId}, twilio_sid=${paramTwilioSid}, ultravoxCallId=${ultravoxCallId}`);
        console.log(`[TRANSFER] Full req.body:`, JSON.stringify(req.body));

        let activeClientId = paramClientId;

        // Fallback: resolve client from ultravox call ID if not in static params
        if (!activeClientId && ultravoxCallId) {
            const { data: calls } = await supabase.from('calls').select('client_id').eq('ultravox_call_id', ultravoxCallId).limit(1);
            if (calls && calls.length > 0) {
                activeClientId = calls[0].client_id;
            }
        }

        if (!activeClientId) {
            console.warn('[TRANSFER] Could not determine client_id.');
            return res.json({ result: "Transfer failed. Could not identify the client." });
        }

        // Look up the transfer number from integrations
        const { data: twInt } = await supabase.from('integrations').select('*').eq('provider', 'twilio').eq('client_id', activeClientId).maybeSingle();
        const rawTransferNumber = twInt?.meta_data?.transfer_number || '';
        const cleanTransferNumber = rawTransferNumber ? ('+' + rawTransferNumber.replace(/\D/g, '')) : '';

        if (!cleanTransferNumber) {
            console.warn('[TRANSFER] No transfer number configured for client_id:', activeClientId);
            return res.json({ result: "No transfer number is configured. Please ask the administrator to set a transfer number in the dashboard." });
        }

        console.log(`[TRANSFER] Using Ultravox new-stage + coldTransfer to number: ${cleanTransferNumber}`);

        // Use Ultravox Call Stages: respond with new-stage header
        // This tells Ultravox to enter a new stage with coldTransfer tool targeting the transfer number
        res.setHeader('X-Ultravox-Response-Type', 'new-stage');
        res.json({
            systemPrompt: "You are transferring this call to a human agent. Say nothing else. The transfer is in progress.",
            selectedTools: [
                {
                    toolName: "coldTransfer",
                    parameterOverrides: {
                        destinationNumber: cleanTransferNumber
                    }
                }
            ],
            firstSpeakerTools: ["coldTransfer"]
        });

        console.log(`[TRANSFER] new-stage response sent successfully for client ${activeClientId} → ${cleanTransferNumber}`);
    } catch (err) {
        console.error('[TRANSFER] Error:', err.message, err.stack);
        res.status(500).json({ result: "Transfer failed due to a server error." });
    }
});

// --- SUPER ADMIN PLATFORM STATS ---
app.get('/api/admin/stats', async (req, res) => {
    try {
        const { data: clients } = await supabase.from('clients').select('id, name, client_code, plan, calls_count, mins_used, status, agent_enabled');
        const totalCalls = clients.reduce((acc, c) => acc + (c.calls_count || 0), 0);
        const totalMins = clients.reduce((acc, c) => acc + (c.mins_used || 0), 0);

        // Real-time call counts from calls table
        const { data: callsData } = await supabase.from('calls').select('client_id, duration_seconds');
        const callsByClient = {};
        const minsByClient = {};
        (callsData || []).forEach(call => {
            callsByClient[call.client_id] = (callsByClient[call.client_id] || 0) + 1;
            minsByClient[call.client_id] = (minsByClient[call.client_id] || 0) + Math.round((call.duration_seconds || 0) / 60);
        });

        const { count: totalActiveAgents } = await supabase.from('agent_settings').select('*', { count: 'exact', head: true });
        
        const clientBreakdown = (clients || []).map(c => ({
            id: c.id,
            name: c.name,
            client_code: c.client_code,
            plan: c.plan || 'Starter',
            total_calls: callsByClient[c.client_code] || c.calls_count || 0,
            mins_used: minsByClient[c.client_code] || c.mins_used || 0,
            status: c.status,
            agent_enabled: c.agent_enabled
        }));

        res.json({
            success: true,
            stats: {
                totalCalls: callsData?.length || totalCalls,
                totalMins,
                activeClients: clients.length,
                activeAgents: totalActiveAgents || 0
            },
            clientBreakdown
        });
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch platform stats" });
    }
});

app.post('/api/fix-sentiment', async (req, res) => {
    try {
        const { client_id } = req.body;
        const { data: calls } = await supabase.from('calls').select('*').eq('client_id', client_id).eq('sentiment_category', 'Neutral');
        // Logic for mass fix omitted for brevity but applies client_id filter
        res.json({ success: true, fixed: 0 });
    } catch(err) { res.status(500).json({ error: "Correction failed" }); }
});

app.get('/api/appointments', async (req, res) => {
    try {
        const { client_id } = req.query;
        const { data, error } = await supabase.from('appointments').select('*').eq('client_id', client_id).order('start_time', { ascending: true });
        res.json({ success: true, appointments: data || [] });
    } catch(err) { res.status(500).json({ error: "API Failure" }); }
});

// --- DASHBOARD APPOINTMENT MANAGEMENT ---
app.post('/api/appointments/manual', async (req, res) => {
    try {
        const { name, phone, start_time, client_id } = req.body;
        const { data } = await supabase.from('appointments').insert([{ name, phone, start_time, client_id, status: 'confirmed' }]).select();
        res.json({ success: true, appointment: data[0] });
    } catch(err) { res.status(500).json({ error: "Failed to book." }); }
});

app.put('/api/appointments/manual/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await supabase.from('appointments').update(req.body).eq('id', id);
        res.json({ success: true });
    } catch(err) { res.status(500).json({ error: "Update failed." }); }
});

app.delete('/api/appointments/manual/:id', async (req, res) => {
    try {
        await supabase.from('appointments').delete().eq('id', req.params.id);
        res.json({ success: true });
    } catch(err) { res.status(500).json({ error: "Delete failed." }); }
});

// --- ADVANCED CRM ENDPOINTS ---

app.get('/api/leads', async (req, res) => {
    try {
        const { client_id } = req.query;
        const { data } = await supabase.from('leads').select('*').eq('client_id', client_id).order('created_at', { ascending: false });
        res.json({ success: true, leads: data || [] });
    } catch(err) { res.status(500).json({ error: "API Failure" }); }
});

app.post('/api/leads', async (req, res) => {
    try {
        const { name, phone, email, ai_context, segment, source, client_id } = req.body;
        const { data } = await supabase.from('leads').insert([{ name, phone, email, ai_context, segment, source, client_id }]).select();
        res.json({ success: true, lead: data[0] });
    } catch(err) { res.status(500).json({ error: "API Failure" }); }
});

app.patch('/api/leads/:id', async (req, res) => {
    try {
        const { name, phone, email, ai_context, segment } = req.body;
        const updateData = {};
        if (name !== undefined) updateData.name = name;
        if (phone !== undefined) updateData.phone = phone;
        if (email !== undefined) updateData.email = email;
        if (ai_context !== undefined) updateData.ai_context = ai_context;
        if (segment !== undefined) updateData.segment = segment;

        const { data, error } = await supabase.from('leads').update(updateData).eq('id', req.params.id).select();
        if (error) {
            return res.status(400).json({ success: false, error: error.message });
        }
        res.json({ success: true, lead: data?.[0] });
    } catch(err) { res.status(500).json({ error: "API Failure" }); }
});

app.get('/api/knowledge_base', async (req, res) => {
    try {
        const { client_id } = req.query;
        const { data } = await supabase.from('knowledge_base').select('*').eq('client_id', client_id).order('created_at', { ascending: false });
        res.json({ success: true, docs: data || [] });
    } catch(err) { res.status(500).json({ error: "API Failure" }); }
});

app.post('/api/knowledge_base', async (req, res) => {
    try {
        const { title, content, client_id } = req.body;
        const { data } = await supabase.from('knowledge_base').insert([{ title, content, status: 'Active', client_id }]).select();
        res.json({ success: true, doc: data[0] });
    } catch(err) { res.status(500).json({ error: "API Failure" }); }
});

app.delete('/api/knowledge_base/:id', async (req, res) => {
    try {
        await supabase.from('knowledge_base').delete().eq('id', req.params.id);
        res.json({ success: true });
    } catch(err) { res.status(500).json({ error: "API Failure" }); }
});

app.get('/api/campaigns', async (req, res) => {
    try {
        const { client_id } = req.query;
        const { data } = await supabase.from('campaigns').select('*').eq('client_id', client_id).order('created_at', { ascending: false });
        res.json({ success: true, campaigns: data || [] });
    } catch(err) { res.status(500).json({ error: "API Failure" }); }
});

app.post('/api/campaigns', async (req, res) => {
    try {
        const { name, total_calls, goal, voice, client_id } = req.body;
        const { data } = await supabase.from('campaigns').insert([{ name, total_calls, goal, voice: voice || 'Mark', status: 'running', pending: total_calls || 0, client_id }]).select();
        res.json({ success: true, campaign: data[0] });
    } catch(err) {
        res.status(500).json({ error: "API Failure" });
    }
});

// Handlers moved to bottom of file for consolidation


// PATCH campaign stats (increment counters)
app.patch('/api/campaigns/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body; // e.g. { answered: 5, positive: 2 }
        const { data, error } = await supabase.from('campaigns').update(updates).eq('id', id).select();
        if (error) throw error;
        res.json({ success: true, campaign: data[0] });
    } catch(err) {
        res.status(500).json({ error: "API Failure" });
    }
});

// --- INTEGRATIONS (TWILIO / API KEYS) ---
app.get('/api/integrations/twilio', async (req, res) => {
    try {
        const { client_id } = req.query;
        const { data, error } = await supabase.from('integrations').select('*').eq('provider', 'twilio').eq('client_id', client_id).maybeSingle();
        if (error && error.code !== 'PGRST116') throw error;
        if (!data) return res.json({ success: true, integration: null });
        const masked = {
            sid: data.meta_data?.sid || '',
            phone: data.meta_data?.phone || '',
            transfer_number: data.meta_data?.transfer_number || '',
            api_key: data.api_key ? (data.api_key.substring(0, 4) + '****************' + data.api_key.substring(data.api_key.length - 4)) : ''
        };
        res.json({ success: true, integration: masked });
    } catch(err) { res.status(500).json({ error: "Failed to fetch integration" }); }
});

app.post('/api/integrations/twilio', async (req, res) => {
    try {
        const { sid, api_key, phone, transfer_number, client_id } = req.body;
        const { data: existing } = await supabase.from('integrations').select('*').eq('provider', 'twilio').eq('client_id', client_id).maybeSingle();
        
        let finalApiKey = api_key?.trim();
        if (finalApiKey && finalApiKey.includes('****')) {
            finalApiKey = existing?.api_key || finalApiKey;
        }

        const payload = { 
            provider: 'twilio', 
            api_key: finalApiKey, 
            meta_data: { 
                sid: sid?.trim(), 
                phone: phone?.trim(), 
                transfer_number: transfer_number?.trim() 
            },
            client_id
        };
        
        const { error: dbErr } = await supabase.from('integrations').upsert(payload, { onConflict: 'provider,client_id' });
        
        if (dbErr) return res.status(500).json({ error: dbErr.message });
        res.json({ success: true, message: "Twilio integration updated." });
    } catch(err) { res.status(500).json({ error: "Failed to save integration" }); }
});

// --- RESEND INTEGRATION ---
app.get('/api/integrations/resend', async (req, res) => {
    try {
        const { client_id } = req.query;
        const { data, error } = await supabase.from('integrations').select('*').eq('provider', 'resend').eq('client_id', client_id).maybeSingle();
        if (error && error.code !== 'PGRST116') throw error;
        if (!data) return res.json({ success: true, integration: null });
        const masked = {
            api_key: data.api_key ? (data.api_key.substring(0, 4) + '****************' + data.api_key.substring(data.api_key.length - 4)) : ''
        };
        res.json({ success: true, integration: masked });
    } catch(err) { res.status(500).json({ error: "Failed to fetch integration" }); }
});

app.post('/api/integrations/resend', async (req, res) => {
    try {
        const { api_key, client_id } = req.body;
        if (!api_key) return res.status(400).json({ error: "Missing API Key" });

        const { data: existing } = await supabase.from('integrations').select('*').eq('provider', 'resend').eq('client_id', client_id).maybeSingle();
        
        let finalApiKey = api_key.trim();
        if (finalApiKey.includes('****')) {
            finalApiKey = existing?.api_key || finalApiKey;
        }

        const payload = { 
            provider: 'resend', 
            api_key: finalApiKey,
            client_id
        };
        
        const { error: revErr } = await supabase.from('integrations').upsert(payload, { onConflict: 'provider, client_id' });

        if (revErr) return res.status(500).json({ error: revErr.message });
        res.json({ success: true, message: "Resend integration updated." });
    } catch(err) { res.status(500).json({ error: "Failed to save integration" }); }
});

// --- ULTRAVOX INTEGRATION ---
app.get('/api/integrations/ultravox', async (req, res) => {
    try {
        const { client_id } = req.query;
        const { data, error } = await supabase.from('integrations').select('*').eq('provider', 'ultravox').eq('client_id', client_id).maybeSingle();
        if (error && error.code !== 'PGRST116') throw error;
        if (!data) return res.json({ success: true, integration: null });
        const masked = {
            api_key: data.api_key ? (data.api_key.substring(0, 4) + '****************' + data.api_key.substring(data.api_key.length - 4)) : ''
        };
        res.json({ success: true, integration: masked });
    } catch(err) { res.status(500).json({ error: "Failed to fetch integration" }); }
});

app.post('/api/integrations/ultravox', async (req, res) => {
    try {
        const { api_key, client_id } = req.body;
        if (!api_key) return res.status(400).json({ error: "Missing API Key" });

        const { data: existing } = await supabase.from('integrations').select('*').eq('provider', 'ultravox').eq('client_id', client_id).maybeSingle();
        
        let finalApiKey = api_key.trim();
        if (finalApiKey.includes('****')) {
            finalApiKey = existing?.api_key || finalApiKey;
        }

        const payload = { 
            provider: 'ultravox', 
            api_key: finalApiKey,
            client_id
        };
        
        const { error: uvErr } = await supabase.from('integrations').upsert(payload, { onConflict: 'provider, client_id' });

        if (uvErr) return res.status(500).json({ error: uvErr.message });
        res.json({ success: true, message: "Ultravox integration updated." });
    } catch(err) { res.status(500).json({ error: "Failed to save integration" }); }
});

// --- ELEVENLABS INTEGRATION ---
app.get('/api/integrations/elevenlabs', async (req, res) => {
    try {
        const { client_id } = req.query;
        const { data, error } = await supabase.from('integrations').select('*').eq('provider', 'elevenlabs').eq('client_id', client_id).maybeSingle();
        if (error && error.code !== 'PGRST116') throw error;
        if (!data) return res.json({ success: true, integration: null });
        const masked = {
            api_key: data.api_key ? (data.api_key.substring(0, 4) + '****************' + data.api_key.substring(data.api_key.length - 4)) : '',
            meta_data: data.meta_data || {}
        };
        res.json({ success: true, integration: masked });
    } catch(err) { res.status(500).json({ error: "Failed to fetch ElevenLabs integration" }); }
});

app.post('/api/integrations/elevenlabs', async (req, res) => {
    try {
        const { api_key, meta_data, client_id } = req.body;
        if (!api_key) return res.status(400).json({ error: "Missing API Key" });

        const { data: existing } = await supabase.from('integrations').select('*').eq('provider', 'elevenlabs').eq('client_id', client_id).maybeSingle();
        
        let finalApiKey = api_key.trim();
        if (finalApiKey.includes('****')) {
            finalApiKey = existing?.api_key || finalApiKey;
        }

        const payload = { 
            provider: 'elevenlabs', 
            api_key: finalApiKey,
            meta_data: meta_data || {},
            client_id
        };
        
        const { error: elErr } = await supabase.from('integrations').upsert(payload, { onConflict: 'provider, client_id' });

        if (elErr) return res.status(500).json({ error: elErr.message });
        res.json({ success: true, message: "ElevenLabs integration updated." });
    } catch(err) { res.status(500).json({ error: "Failed to save ElevenLabs integration" }); }
});


// --- Shared CSV Parser (used by both CSV upload and Google Sheets) ---
function parseCSVContacts(csvText) {
    const lines = csvText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) return [];
    
    let startIdx = 0;
    const firstLine = lines[0].toLowerCase();
    if (firstLine.includes('phone') || firstLine.includes('name') || firstLine.includes('number')) {
        startIdx = 1;
    }

    const contacts = [];
    for (let i = startIdx; i < lines.length; i++) {
        const parts = lines[i].split(',').map(p => p.trim().replace(/"/g, ''));
        let phone = null;
        let name = null;
        for (const part of parts) {
            if (part.match(/^\+?\d[\d\s\-()]{6,}$/)) {
                phone = part.replace(/[\s\-()]/g, '');
            } else if (part.length > 1 && !phone) {
                name = part;
            }
        }
        if (phone) {
            if (!phone.startsWith('+')) {
                phone = '+' + phone;
            }
            contacts.push({ phone, name: name || 'Unknown' });
        }
    }
    return contacts;
}

async function launchCampaignWithContacts(contacts, campaignName, voice, goal, supabase, client_id) {
    const { data: campaignData, error: campErr } = await supabase.from('campaigns').insert([{
        name: campaignName,
        goal: goal || '',
        voice: voice || 'Mark',
        total_calls: contacts.length,
        pending: contacts.length,
        answered: 0,
        positive: 0,
        declined: 0,
        failed: 0,
        completed: 0,
        status: 'running',
        client_id
    }]).select();

    if (campErr) throw campErr;
    const campaign = campaignData[0];

    // BACKGROUND: Sequentially dial each contact
    (async () => {
        const { data: twInt } = await supabase.from('integrations').select('*').eq('provider', 'twilio').eq('client_id', client_id).maybeSingle();
        const TWILIO_SID = (twInt?.meta_data?.sid || process.env.TWILIO_ACCOUNT_SID)?.trim();
        const TWILIO_AUTH = (twInt?.api_key || process.env.TWILIO_AUTH_TOKEN)?.trim();
        const TWILIO_PHONE = (twInt?.meta_data?.phone || process.env.TWILIO_PHONE_NUMBER)?.trim();

        if (!TWILIO_SID || !TWILIO_AUTH || !TWILIO_PHONE) {
            console.error("Campaign aborted: Twilio credentials missing.");
            await supabase.from('campaigns').update({ status: 'failed' }).eq('id', campaign.id);
            return;
        }

        let twilioClient;
        try {
            twilioClient = require('twilio')(TWILIO_SID, TWILIO_AUTH);
        } catch(err) {
            console.error("Twilio Initialization Error:", err.message);
            await supabase.from('campaigns').update({ status: 'failed' }).eq('id', campaign.id);
            return;
        }
        let serverBaseUrl = process.env.BACKEND_URL;
        if (!serverBaseUrl || serverBaseUrl.includes('your-server.com')) {
            console.error("⚠️ [Campaign] BACKEND_URL is missing or uses dummy template. Campaign callbacks will fail. Set it in your environment variables.");
            serverBaseUrl = `https://${process.env.RAILWAY_PUBLIC_DOMAIN || 'localhost'}`;
        }

        let agentData = null;
        try {
            const { data } = await supabase.from('agent_settings').select('record_calls, tools_config').eq('client_id', client_id).limit(1).maybeSingle();
            agentData = data;
        } catch(err) {
            console.error("Error fetching agent settings for campaign:", err.message);
        }
        const recordingEnabled = agentData?.record_calls !== false;
        const toolsConfig = agentData?.tools_config || {};
        const leaveVoicemailEnabled = toolsConfig.leaveVoicemail === true;

        for (let i = 0; i < contacts.length; i++) {
            const contact = contacts[i];
            try {
                const webhookUrl = `${serverBaseUrl}/api/twilio/outbound-twiml?toPhone=${encodeURIComponent(contact.phone)}&voice=${encodeURIComponent(voice || '')}&goal=${encodeURIComponent(goal || '')}&name=${encodeURIComponent(contact.name || '')}&client_id=${encodeURIComponent(client_id || '')}`;
                
                const callOptions = {
                    url: webhookUrl,
                    to: contact.phone,
                    from: TWILIO_PHONE,
                    statusCallback: `${serverBaseUrl}/api/twilio/status`,
                    statusCallbackEvent: ['completed']
                };

                if (recordingEnabled) {
                    callOptions.record = true;
                    callOptions.recordingStatusCallback = `${serverBaseUrl}/api/twilio/recording-callback`;
                    callOptions.recordingStatusCallbackEvent = ['completed'];
                }

                if (leaveVoicemailEnabled) {
                    callOptions.machineDetection = 'DetectMessageEnd';
                    callOptions.machineDetectionTimeout = 15;
                    callOptions.machineDetectionSpeechThreshold = 2000;
                    callOptions.machineDetectionSpeechEndThreshold = 1000;
                    callOptions.machineDetectionSilenceTimeout = 3000;
                }

                const call = await twilioClient.calls.create(callOptions);

                await supabase.from('calls').insert([{
                    direction: 'outbound',
                    from_phone: TWILIO_PHONE,
                    to_phone: contact.phone,
                    caller_name: contact.name,
                    status: call.status,
                    twilio_sid: call.sid,
                    client_id
                }]);

                const newPending = contacts.length - (i + 1);
                await supabase.from('campaigns').update({ 
                    pending: newPending,
                    answered: i + 1
                }).eq('id', campaign.id);

                console.log(`Campaign "${campaignName}" - Dialed ${i+1}/${contacts.length}: ${contact.phone}`);

                if (i < contacts.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 30000));
                }
            } catch (dialErr) {
                console.error(`Campaign dial failed for ${contact.phone}:`, dialErr.message);
                const { data: curr } = await supabase.from('campaigns').select('failed').eq('id', campaign.id).single();
                await supabase.from('campaigns').update({ 
                    failed: (curr?.failed || 0) + 1,
                    pending: contacts.length - (i + 1)
                }).eq('id', campaign.id);
            }
        }

        await supabase.from('campaigns').update({ status: 'completed', pending: 0 }).eq('id', campaign.id);
        console.log(`Campaign "${campaignName}" finished all ${contacts.length} calls.`);
    })();

    return campaign;
}

// CSV BULK UPLOAD + AUTO LAUNCH CAMPAIGN
app.post('/api/campaigns/csv-launch', async (req, res) => {
    try {
        const { csvText, campaignName, voice, goal, client_id } = req.body;
        // Also check header as fallback (some parts of frontend use it)
        const activeClientId = client_id || req.headers['x-client-id'];
        
        console.log('CSV Launch received:', { hasCsvText: !!csvText, csvLength: csvText?.length, campaignName, activeClientId });
        if (!csvText || !campaignName) {
            return res.status(400).json({ error: "Missing CSV data or campaign name." });
        }

        const contacts = parseCSVContacts(csvText);

        if (contacts.length === 0) {
            return res.status(400).json({ error: "No valid phone numbers found in CSV." });
        }

        const campaign = await launchCampaignWithContacts(contacts, campaignName, voice, goal, supabase, activeClientId);

        res.json({ 
            success: true, 
            campaign, 
            message: `Campaign "${campaignName}" created with ${contacts.length} contacts. Dialing will begin shortly.` 
        });

    } catch(err) {
        console.error("CSV Campaign Launch Error:", err);
        res.status(500).json({ error: err.message || "Failed to launch campaign." });
    }
});

// GOOGLE SHEETS IMPORT + AUTO LAUNCH CAMPAIGN
app.post('/api/campaigns/gsheet-launch', async (req, res) => {
    try {
        const { sheetUrl, campaignName, voice, goal, client_id } = req.body;
        const activeClientId = client_id || req.headers['x-client-id'];
        if (!sheetUrl || !campaignName) {
            return res.status(400).json({ error: "Missing Google Sheet URL or campaign name." });
        }

        const match = sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
        if (!match) {
            return res.status(400).json({ error: "Invalid Google Sheets URL. Make sure you copied the full link." });
        }
        const sheetId = match[1];

        console.log('Fetching Google Sheet:', sheetId);
        const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
        const csvResponse = await fetch(csvUrl);

        if (!csvResponse.ok) {
            return res.status(400).json({ error: "Could not fetch Google Sheet. Make sure sharing is set to 'Anyone with the link can view'." });
        }

        const csvText = await csvResponse.text();
        console.log('Google Sheet CSV length:', csvText.length);

        // Parse contacts directly (no internal HTTP call)
        const contacts = parseCSVContacts(csvText);
        if (contacts.length === 0) {
            return res.status(400).json({ error: "No valid phone numbers found in the Google Sheet." });
        }

        const campaign = await launchCampaignWithContacts(contacts, campaignName, voice, goal, supabase);

        res.json({ 
            success: true, 
            campaign, 
            message: `Campaign "${campaignName}" created with ${contacts.length} contacts from Google Sheet. Dialing will begin shortly.` 
        });

    } catch(err) {
        console.error("Google Sheet Import Error:", err);
        res.status(500).json({ error: err.message || "Failed to import Google Sheet." });
    }
});

app.get('/api/reports', async (req, res) => {
    try {
        const { client_id } = req.query;
        // SECURITY: Never return all-client reports - require client_id
        if (!client_id) return res.json({ success: true, metrics: null });
        let callsQuery = supabase.from('calls').select('*').eq('client_id', client_id);
        let leadsQuery = supabase.from('leads').select('id').eq('client_id', client_id);
        let appsQuery = supabase.from('appointments').select('*').eq('client_id', client_id);

        const { data: calls } = await callsQuery;
        const { data: leads } = await leadsQuery;
        const { data: apps } = await appsQuery;

        const totalCalls = calls ? calls.length : 0;
        const totalDuration = calls ? calls.reduce((acc, c) => acc + parseInt(c.duration_seconds || 0), 0) : 0;
        let positive = 0; let negative = 0; let neutral = 0;
        
        // Advanced aggregations for charting
        const statusCounts = { "Booked": 0, "Resolved": 0, "Follow Up": 0, "Missed": 0, "Standard Inquiry": 0 };
        const hourlyVolume = new Array(24).fill(0).map((_, i) => {
            const h = i === 0 ? 12 : (i > 12 ? i - 12 : i);
            const ampm = i < 12 ? 'AM' : 'PM';
            return { hour: `${h} ${ampm}`, count: 0, index: i };
        });
        const recentDurations = [];

        if (calls) {
            const nowUTC = new Date();
            const nowIST = new Date(nowUTC.getTime() + (5.5 * 60 * 60 * 1000));
            const todayStr = nowIST.toISOString().split('T')[0]; // Current IST date (YYYY-MM-DD)

            calls.forEach(c => {
                // 1. Sentiment stats
                const cat = (c.sentiment_category || '').toLowerCase();
                if (cat === 'positive') positive++;
                else if (cat === 'negative') negative++;
                else neutral++;

                // 2. Status/Outcome Stats
                const rawStatus = c.status || '';
                let s = rawStatus;
                if (!c.duration_seconds || Number(c.duration_seconds) === 0) {
                    s = "No Connection";
                } else {
                    // Use the specific call_status column if the AI set it (Booked, Follow Up, Resolved)
                    s = c.call_status || "Standard Inquiry";
                }
                
                if (Object.prototype.hasOwnProperty.call(statusCounts, s)) {
                    statusCounts[s]++;
                } else if (s.toLowerCase().includes('book')) {
                    statusCounts["Booked"]++;
                } else if (s.toLowerCase().includes('standard')) {
                    statusCounts["Standard Inquiry"]++;
                } else if (s === "No Connection") {
                    if (!statusCounts["No Connection"]) statusCounts["No Connection"] = 0;
                    statusCounts["No Connection"]++;
                }

                // 3. Hourly Trend (TIMEZONE FIX: Shift UTC to IST for charts)
                if (c.created_at) {
                    const utcDate = new Date(c.created_at);
                    const istDate = new Date(utcDate.getTime() + (5.5 * 60 * 60 * 1000));
                    const callDateStr = istDate.toISOString().split('T')[0];
                    
                    // ONLY include calls from TODAY in the hourly chart to prevent cumulative peaks
                    if (callDateStr === todayStr) {
                        const hour = istDate.getUTCHours();
                        if (!isNaN(hour) && hour >= 0 && hour < 24) {
                            hourlyVolume[hour].count++;
                        }
                    }
                }

                // 4. Duration Trend (Last 20, Sorted)
                if (c.duration_seconds && c.created_at) {
                    recentDurations.push({
                        time: new Date(c.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }),
                        duration: Math.round(c.duration_seconds),
                        raw_time: new Date(c.created_at).getTime()
                    });
                }
            });

            // FALLBACK: If calls aren't tagged 'Booked' but appointments exist, override.
            if (apps && apps.length > statusCounts["Booked"]) {
                const diff = apps.length - statusCounts["Booked"];
                statusCounts["Booked"] = apps.length;
                if (statusCounts["Standard Inquiry"] >= diff) statusCounts["Standard Inquiry"] -= diff;
            }
        }

        // Sort charts chronologically
        recentDurations.sort((a, b) => a.raw_time - b.raw_time);

        res.json({ 
            success: true, 
            metrics: {
                totalCalls,
                inboundCalls: calls ? calls.filter(c => c.direction === 'inbound').length : 0,
                outboundCalls: calls ? calls.filter(c => c.direction === 'outbound').length : 0,
                totalMinutes: Math.floor(totalDuration / 60) || 0,
                sentiment: { positive, negative, neutral },
                totalLeads: leads ? leads.length : 0,
                bookedAppointments: apps ? apps.length : 0,
                // NEW: Chart Data
                outcomes: Object.entries(statusCounts).map(([name, value]) => ({ name, value })),
                hourlyVolume: hourlyVolume,
                recentDurations: recentDurations.slice(-10)
            }
        });
    } catch (err) {
        console.error("Reports API Error:", err);
        res.status(500).json({ error: "Could not generate reports." });
    }
});

// --- CRON JOBS FOR NOTIFICATIONS ---
// Run every 5 minutes
cron.schedule('*/5 * * * *', async () => {
    console.log('[Cron] Checking for upcoming & missed appointments...');
    try {
        const now = new Date();
        const fifteenMinsFromNow = new Date(now.getTime() + 20 * 60 * 1000); // +20min window (catches 15min mark)
        const fiveMinsFromNow = new Date(now.getTime() + 5 * 60 * 1000);   // lower bound
        const nowIso = now.toISOString();
        const fifteenMinsIso = fifteenMinsFromNow.toISOString();
        const fiveMinsIso = fiveMinsFromNow.toISOString();

        // 1. Upcoming Reminders (Starting between now+5min and now+20min = ~15min window)
        const { data: upcoming } = await supabase.from('appointments')
            .select('*')
            .eq('status', 'confirmed')
            .eq('reminder_sent', false)
            .gte('start_time', fiveMinsIso)
            .lte('start_time', fifteenMinsIso);

        if (upcoming && upcoming.length > 0) {
            for (const appt of upcoming) {
                // To fetch their email, join with leads table
                let leadEmail = appt.email;
                if (!leadEmail && appt.phone) {
                    const { data: ld } = await supabase.from('leads').select('email').eq('phone', appt.phone).single();
                    if (ld?.email) leadEmail = ld.email;
                }
                await dispatchOmnichannel(appt.id, appt.name, appt.phone, leadEmail, 'meeting_reminder', { start_time: appt.start_time });
                await supabase.from('appointments').update({ reminder_sent: true }).eq('id', appt.id);
            }
        }

        // 2. Missed Appointments (NOT 'completed' AND ended in the past)
        const { data: missed } = await supabase.from('appointments')
            .select('*')
            .eq('status', 'confirmed')
            .eq('missed_notified', false)
            .lte('end_time', nowIso); // meeting time has passed

        if (missed && missed.length > 0) {
            for (const appt of missed) {
                let leadEmail = appt.email;
                if (!leadEmail && appt.phone) {
                    const { data: ld } = await supabase.from('leads').select('email').eq('phone', appt.phone).single();
                    if (ld?.email) leadEmail = ld.email;
                }
                
                await dispatchOmnichannel(appt.id, appt.name, appt.phone, leadEmail, 'meeting_missed', { start_time: appt.start_time });
                // We auto-mark them as missed
                await supabase.from('appointments').update({ status: 'missed', missed_notified: true }).eq('id', appt.id);
            }
        }
    } catch(err) {
        console.error('[Cron Error]', err);
    }
});

// ── ULTRAVOX CORPORA ROUTES ──

const multer = require('multer');
const FormData = require('form-data');
// fetch is now defined at the top of the file
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

async function getCorpusKey() {
    const { data } = await supabase.from('integrations').select('api_key').eq('provider', 'ultravox_corpus').maybeSingle();
    return data?.api_key || process.env.ULTRAVOX_API_KEY;
}

// Upload a PDF/Word file to Ultravox Corpora
app.post('/api/corpora/upload', upload.single('file'), async (req, res) => {
    try {
        const apiKey = await getCorpusKey();
        if (!apiKey) return res.json({ success: false, error: 'No Corpus API key configured. Add it in API Credentials.' });
        if (!req.file) return res.json({ success: false, error: 'No file provided.' });

        // Step 1: Create a corpus
        const corpusRes = await fetch('https://api.ultravox.ai/api/corpora', {
            method: 'POST',
            headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: req.file.originalname || 'Uploaded Document' })
        });
        const corpus = await corpusRes.json();
        if (!corpus.corpusId) return res.json({ success: false, error: `Corpus creation failed: ${JSON.stringify(corpus)}` });

        // Step 2: Upload file to corpus
        const formData = new FormData();
        formData.append('file', req.file.buffer, { filename: req.file.originalname, contentType: req.file.mimetype });
        const uploadRes = await fetch(`https://api.ultravox.ai/api/corpora/${corpus.corpusId}/documents`, {
            method: 'POST',
            headers: { 'X-API-Key': apiKey, ...formData.getHeaders() },
            body: formData
        });
        const uploadData = await uploadRes.json();
        console.log('[Corpus Upload]', uploadData);

        // Save this as our active search corpus
        await supabase.from('integrations').upsert({
            provider: 'ultravox_corpus',
            api_key: apiKey,
            meta_data: { corpusId: corpus.corpusId, last_updated: new Date().toISOString() }
        }, { onConflict: 'provider' });

        res.json({ success: true, corpusId: corpus.corpusId, document: uploadData });
    } catch (err) {
        console.error('[Corpus Upload Error]', err);
        res.json({ success: false, error: err.message });
    }
});

// Add a URL as a source to Ultravox Corpora
app.post('/api/corpora/add-url', async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) return res.json({ success: false, error: 'No URL provided.' });
        const apiKey = await getCorpusKey();
        if (!apiKey) return res.json({ success: false, error: 'No Corpus API key configured.' });

        // Create a corpus for this URL
        const corpusRes = await fetch('https://api.ultravox.ai/api/corpora', {
            method: 'POST',
            headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: `Web: ${url.substring(0, 50)}` })
        });
        const corpus = await corpusRes.json();
        if (!corpus.corpusId) return res.json({ success: false, error: `Corpus creation failed: ${JSON.stringify(corpus)}` });

        // Add URL as a source
        const srcRes = await fetch(`https://api.ultravox.ai/api/corpora/${corpus.corpusId}/sources`, {
            method: 'POST',
            headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'url', url })
        });
        const srcData = await srcRes.json();
        console.log('[Corpus URL Add]', srcData);

        // Save this as our active search corpus
        await supabase.from('integrations').upsert({
            provider: 'ultravox_corpus',
            api_key: apiKey,
            meta_data: { corpusId: corpus.corpusId, source_url: url, last_updated: new Date().toISOString() }
        }, { onConflict: 'provider' });

        res.json({ success: true, corpusId: corpus.corpusId, source: srcData });
    } catch (err) {
        console.error('[Corpus URL Error]', err);
        res.json({ success: false, error: err.message });
    }
});

// --- KNOWLEDGE BASE / CORPUS QUERY TOOL ---
app.post('/api/tools/query-corpus', async (req, res) => {
    try {
        const { query } = req.body;
        if (!query) return res.json({ result: "No query provided." });

        // 1. Fetch the active corpus ID
        const { data: corpusInt } = await supabase.from('integrations').select('*').eq('provider', 'ultravox_corpus').maybeSingle();
        const corpusId = corpusInt?.meta_data?.corpusId;
        const apiKey = corpusInt?.api_key || process.env.ULTRAVOX_API_KEY;

        if (!corpusId || !apiKey) {
            console.warn("[CORPUS] Missing Corpus configuration.");
            return res.json({ result: "I'm sorry, I don't have access to the advanced knowledge base right now." });
        }

        console.log(`[CORPUS] Querying: "${query}" in Corpus: ${corpusId}`);

        // 2. Query Ultravox Corpora API (Search / Query)
        const searchRes = await fetch(`https://api.ultravox.ai/api/corpora/${corpusId}/query`, {
            method: 'POST',
            headers: {
                'X-API-Key': apiKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ query, maxResults: 3 })
        });

        const searchData = await searchRes.json();
        
        if (searchData.results && searchData.results.length > 0) {
            const context = searchData.results.map(r => r.text).join("\n---\n");
            return res.json({ result: context });
        }

        res.json({ result: "I couldn't find any specific information about that in my documents." });
    } catch (err) {
        console.error("Corpus Query Error:", err);
        res.json({ result: "I'm having trouble searching my documents right now." });
    }
});


app.listen(PORT, '0.0.0.0', () => {
    console.log(`AI Backend API running on port ${PORT}...`);
});


