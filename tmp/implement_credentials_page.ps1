
$serverPath = "C:\Users\tvijayy\Downloads\InboundAIVoice-main\InboundAIVoice-main\backend\server.js"
$appPath = "C:\Users\tvijayy\Downloads\InboundAIVoice-main\InboundAIVoice-main\frontend\src\App.jsx"

# --- 1. Update server.js (Backend Endpoints) ---
$serverContent = Get-Content -Path $serverPath -Raw
$backendEndpoints = @"
// --- INTEGRATIONS (TWILIO / API KEYS) ---
app.get('/api/integrations/twilio', async (req, res) => {
    try {
        const { data, error } = await supabase.from('integrations').select('*').eq('provider', 'twilio').single();
        if (error && error.code !== 'PGRST116') throw error;
        
        if (!data) return res.json({ success: true, integration: null });

        // Mask sensitive data for UI safety
        const masked = {
            sid: data.meta_data?.sid || '',
            phone: data.meta_data?.phone || '',
            api_key: data.api_key ? (data.api_key.substring(0, 4) + '****************' + data.api_key.substring(data.api_key.length - 4)) : ''
        };
        res.json({ success: true, integration: masked });
    } catch(err) {
        res.status(500).json({ error: "Failed to fetch integration settings" });
    }
});

app.post('/api/integrations/twilio', async (req, res) => {
    try {
        const { sid, api_key, phone } = req.body;
        const payload = {
            provider: 'twilio',
            api_key: api_key,
            meta_data: { sid, phone }
        };

        const { data: existing } = await supabase.from('integrations').select('id').eq('provider', 'twilio').single();
        
        if (existing) {
            await supabase.from('integrations').update(payload).eq('id', existing.id);
        } else {
            await supabase.from('integrations').insert([payload]);
        }
        res.json({ success: true, message: "Twilio integration updated successfully." });
    } catch(err) {
        res.status(500).json({ error: "Failed to save integration settings" });
    }
});

"@

if ($serverContent -notlike "*app.get('/api/integrations/twilio'*") {
    $serverContent = $serverContent.Replace("// PATCH campaign stats", "$backendEndpoints`n// PATCH campaign stats")
    $serverContent | Set-Content -Path $serverPath -NoNewline
}


# --- 2. Update App.jsx (Frontend UI & Logic) ---
$appContent = Get-Content -Path $appPath -Raw

# 2a. Add State & Fetch Effect
$appStateAndEffect = @"
  const [twilioConfig, setTwilioConfig] = useState({ sid: '', api_key: '', phone: '' });
  const [isSavingCreds, setIsSavingCreds] = useState(false);

  const fetchTwilioConfig = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/integrations/twilio`);
      const data = await res.json();
      if (data.success && data.integration) {
        setTwilioConfig(data.integration);
      }
    } catch (e) { console.error('Failed to fetch Twilio config'); }
  };

  useEffect(() => {
    if (activePage === 'credentials') fetchTwilioConfig();
  }, [activePage]);

  const saveTwilioConfig = async (e) => {
    e.preventDefault();
    setIsSavingCreds(true);
    try {
      const res = await fetch(`${API_BASE}/api/integrations/twilio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(twilioConfig)
      });
      const data = await res.json();
      if (data.success) {
        showToast('Twilio credentials updated successfully!', 'success');
        fetchTwilioConfig();
      } else {
        showToast(data.error || 'Failed to update credentials.', 'error');
      }
    } catch (e) { showToast('Update failed. Check backend.', 'error'); }
    setIsSavingCreds(false);
  };
"@

if ($appContent -notlike "*const [twilioConfig, setTwilioConfig]*") {
    $appContent = $appContent.Replace("const [toast, setToast] = useState(null);", "const [toast, setToast] = useState(null);`n$appStateAndEffect")
}

# 2b. Add UI Block for 'credentials'
$appCredentialsUI = @"
        {activePage === 'credentials' && (
          <div className="space-y-8 fade-in w-full max-w-2xl mx-auto">
            <div>
              <h2 className="text-3xl font-extrabold tracking-tight">API & Telephony Integration</h2>
              <p className="text-sm text-muted-foreground mt-1.5 font-medium">Configure your Twilio and AI provider credentials for outbound calling</p>
            </div>
            
            <div className="bg-card border border-border rounded-2xl p-8 shadow-premium-lg">
              <form onSubmit={saveTwilioConfig} className="space-y-6">
                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Twilio Account SID</label>
                  <input 
                    type="text" 
                    value={twilioConfig.sid}
                    onChange={(e) => setTwilioConfig({...twilioConfig, sid: e.target.value})}
                    placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" 
                    className="w-full bg-background border border-border p-3 rounded-xl text-sm outline-none focus:border-primary transition-all font-mono"
                    required 
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Twilio Auth Token</label>
                  <input 
                    type="password" 
                    value={twilioConfig.api_key}
                    onChange={(e) => setTwilioConfig({...twilioConfig, api_key: e.target.value})}
                    placeholder="••••••••••••••••••••••••••••••••" 
                    className="w-full bg-background border border-border p-3 rounded-xl text-sm outline-none focus:border-primary transition-all font-mono"
                    required 
                  />
                  <p className="text-[10px] text-muted-foreground mt-2 italic">Note: Only the first 4 and last 4 characters will be visible after saving.</p>
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Verified Twilio Phone Number</label>
                  <input 
                    type="text" 
                    value={twilioConfig.phone}
                    onChange={(e) => setTwilioConfig({...twilioConfig, phone: e.target.value})}
                    placeholder="+1234567890" 
                    className="w-full bg-background border border-border p-3 rounded-xl text-sm outline-none focus:border-primary transition-all font-mono"
                    required 
                  />
                </div>

                <div className="pt-4">
                  <button 
                    type="submit" 
                    disabled={isSavingCreds}
                    className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-4 rounded-xl shadow-glow transition-all flex items-center justify-center gap-2"
                  >
                    {isSavingCreds ? <RefreshCw className="animate-spin" size={18} /> : null}
                    {isSavingCreds ? 'Udating Connection...' : 'Save Twilio Integration'}
                  </button>
                </div>
              </form>
            </div>

            <div className="bg-blue-500/5 border border-blue-500/10 rounded-2xl p-6">
              <h4 className="text-blue-400 font-bold text-xs uppercase tracking-widest mb-2">Multi-Tenant Status</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Updating these credentials will immediately override the default platform settings. Your outbound campaigns and manual dials will instantly use this new Twilio subaccount. 
              </p>
            </div>
          </div>
        )}
"@

if ($appContent -notlike "*{activePage === 'credentials' && (*") {
    # Find a good place to insert - after 'campaigns' block
    $insertionMarker = "{activePage === 'campaigns' && ("
    # We need to find the end of that block. This is tricky with string replace. 
    # Let's try inserting it before the modals section.
    $appContent = $appContent.Replace("{/* ── MODALS ── */}", "$appCredentialsUI`n`n      {/* ── MODALS ── */}")
}

$appContent | Set-Content -Path $appPath -NoNewline

Write-Host "✅ API Credentials Dashboard implemented successfully."
