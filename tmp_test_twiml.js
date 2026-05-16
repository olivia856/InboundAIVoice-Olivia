
const fetch = require('node-fetch');

async function testOutboundTwiml() {
    const url = 'http://localhost:8000/api/twilio/outbound-twiml?toPhone=+919876543210&client_id=AZL-0002';
    
    try {
        const resp = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ CallSid: 'test_sid_123' })
        });
        
        console.log('Status:', resp.status);
        const text = await resp.text();
        console.log('Body:', text);
    } catch (err) {
        console.error('Error:', err.message);
    }
}

testOutboundTwiml();
