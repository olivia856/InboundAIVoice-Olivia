
$serverPath = "C:\Users\tvijayy\Downloads\InboundAIVoice-main\InboundAIVoice-main\backend\server.js"
$appPath = "C:\Users\tvijayy\Downloads\InboundAIVoice-main\InboundAIVoice-main\frontend\src\App.jsx"

$backendCreds = Get-Content -Path "C:\Users\tvijayy\Downloads\InboundAIVoice-main\InboundAIVoice-main\tmp\backend_creds.txt" -Raw
$frontendState = Get-Content -Path "C:\Users\tvijayy\Downloads\InboundAIVoice-main\InboundAIVoice-main\tmp\frontend_state.txt" -Raw
$frontendUI = Get-Content -Path "C:\Users\tvijayy\Downloads\InboundAIVoice-main\InboundAIVoice-main\tmp\frontend_ui.txt" -Raw

# --- 1. Update server.js ---
$serverContent = Get-Content -Path $serverPath -Raw
if ($serverContent -notlike "*app.get('/api/integrations/twilio'*") {
    $marker = "// --- Shared CSV Parser"
    $serverContent = $serverContent.Replace($marker, "$backendCreds`n$marker")
    $serverContent | Set-Content -Path $serverPath -NoNewline
    Write-Host "✅ Backend updated."
}

# --- 2. Update App.jsx ---
$appContent = Get-Content -Path $appPath -Raw

# 2a. State Injection
if ($appContent -notlike "*const [twilioConfig, setTwilioConfig]*") {
    $marker = "const [toast, setToast] = useState(null);"
    $appContent = $appContent.Replace($marker, "$marker`n$frontendState")
    Write-Host "✅ Frontend state injected."
}

# 2b. UI Injection
if ($appContent -notlike "*{activePage === 'credentials' && (*") {
    $marker = "{/* ── MODALS ── */}"
    # Use a simpler marker if the full comment fails
    if (-not $appContent.Contains($marker)) {
        $marker = "{viewSummaryModal && ("
    }
    $appContent = $appContent.Replace($marker, "$frontendUI`n`n      $marker")
    Write-Host "✅ Frontend UI injected."
}

$appContent | Set-Content -Path $appPath -NoNewline
Write-Host "🚀 Deployment successful."
