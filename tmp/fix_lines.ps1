
$serverPath = "C:\Users\tvijayy\Downloads\InboundAIVoice-main\InboundAIVoice-main\backend\server.js"
$appPath = "C:\Users\tvijayy\Downloads\InboundAIVoice-main\InboundAIVoice-main\frontend\src\App.jsx"

# --- Fix server.js Line 69 ---
$serverLines = Get-Content -Path $serverPath
$oldPromptLine = '        finalPrompt += "\n\nULTRA-IMPORTANT - EMOTIONAL EVALUATION: Monitor the user''s mood constantly. If they express strong emotion, you MUST call ''log_call_outcome'' IMMEDIATELY. \nSTRICT RULES:\n1. ''sentiment'' MUST be EXACTLY 1 or 2 words (e.g. ''Angry'', ''Very Happy'', ''Frustrated'', ''Interested'').\n2. ''category'' MUST be: Positive, Negative, or Neutral.\n3. CALL TERMINATION: As soon as you say your final goodbye (e.g., ''Have a great day!''), you MUST call ''hang_up'' IMMEDIATELY to end the session. Never wait for the caller to hang up first.";'
$newPromptLine = '        finalPrompt += "\n\nULTRA-IMPORTANT - EMOTIONAL EVALUATION: Monitor the user''s mood and call status. \nSTRICT RULES:\n1. ''sentiment'' MUST be EXACTLY 1 or 2 words (e.g. ''Angry'', ''Very Happy'', ''Frustrated'', ''Interested'').\n2. ''category'' MUST be: Positive, Negative, or Neutral.\n3. CALL TERMINATION: As soon as you say a FINAL goodbye at the end of a successful session (e.g., ''Have a great day!'') or the caller says goodbye, you MUST call ''hang_up'' IMMEDIATELY. Never wait for the caller to hang up first. Do NOT use hang_up for apologies or errors.";'

$foundServer = $false
for($i=0; $i -lt $serverLines.Count; $i++) {
    if ($serverLines[$i].Trim() -eq $oldPromptLine.Trim()) {
        $serverLines[$i] = $newPromptLine
        $foundServer = $true
        # break # Don't break in case there are multiple (AllowMultiple=false behavior)
    }
}
if ($foundServer) {
    # Write back with original line endings (detected by Get-Content)
    $serverLines | Set-Content -Path $serverPath
    Write-Host "✅ server.js prompt updated"
} else {
    Write-Host "❌ server.js target line not found"
}

# --- Fix App.jsx Line 232 ---
$appLines = Get-Content -Path $appPath
$oldStatLine = '                { label: ''Completed'', value: callLogs.filter(c => c.status === ''completed'').length, sub: ''Finished calls'', color: ''from-amber-500/10 to-orange-500/10'', accent: ''text-amber-400'' }'
$newStatLine = '                { label: ''Completed'', value: reports?.hourlyVolume ? reports.hourlyVolume.reduce((acc, h) => acc + h.count, 0) : callLogs.filter(c => c.status === ''completed'').length, sub: ''Finished calls'', color: ''from-amber-500/10 to-orange-500/10'', accent: ''text-amber-400'' }'

$foundApp = $false
for($i=0; $i -lt $appLines.Count; $i++) {
    if ($appLines[$i].Trim() -eq $oldStatLine.Trim()) {
        $appLines[$i] = $newStatLine
        $foundApp = $true
    }
}
if ($foundApp) {
    $appLines | Set-Content -Path $appPath
    Write-Host "✅ App.jsx stats updated"
} else {
    Write-Host "❌ App.jsx target line not found"
}
