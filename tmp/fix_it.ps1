
$serverPath = "C:\Users\tvijayy\Downloads\InboundAIVoice-main\InboundAIVoice-main\backend\server.js"
$appPath = "C:\Users\tvijayy\Downloads\InboundAIVoice-main\InboundAIVoice-main\frontend\src\App.jsx"

# 1. Update server.js
$serverContent = Get-Content -Path $serverPath -Raw
$oldPrompt = 'finalPrompt += "\n\nULTRA-IMPORTANT - EMOTIONAL EVALUATION: Monitor the user''s mood constantly. If they express strong emotion, you MUST call ''log_call_outcome'' IMMEDIATELY. \nSTRICT RULES:\n1. ''sentiment'' MUST be EXACTLY 1 or 2 words (e.g. ''Angry'', ''Very Happy'', ''Frustrated'', ''Interested'').\n2. ''category'' MUST be: Positive, Negative, or Neutral.\n3. CALL TERMINATION: As soon as you say your final goodbye (e.g., ''Have a great day!''), you MUST call ''hang_up'' IMMEDIATELY to end the session. Never wait for the caller to hang up first.";'
$newPrompt = 'finalPrompt += "\n\nULTRA-IMPORTANT - EMOTIONAL EVALUATION: Monitor the user''s mood and call status. \nSTRICT RULES:\n1. ''sentiment'' MUST be EXACTLY 1 or 2 words (e.g. ''Angry'', ' + "'Very Happy', 'Frustrated', 'Interested').\n2. 'category' MUST be: Positive, Negative, or Neutral.\n3. CALL TERMINATION: As soon as you say a FINAL goodbye at the end of a successful session (e.g., 'Have a great day!') or the caller says goodbye, you MUST call 'hang_up' IMMEDIATELY. Never wait for the caller to hang up first. Do NOT use hang_up for apologies or errors.\";"

if ($serverContent -contains $oldPrompt) {
    # PowerShell escape issue: let's use a simpler match
    $serverContent = $serverContent.Replace($oldPrompt, $newPrompt)
    $serverContent | Set-Content -Path $serverPath -NoNewline
    Write-Host "✅ server.js updated"
} else {
    Write-Host "❌ server.js target not found"
}

# 2. Update App.jsx
$appContent = Get-Content -Path $appPath -Raw
$oldStats = "{ label: 'Total Calls', value: callLogs.length, sub: 'All time', color: 'from-violet-500/10 to-indigo-500/10', accent: 'text-violet-400' },`r`n                { label: 'Appointments', value: appointments.length, sub: 'Booked by AI', color: 'from-emerald-500/10 to-teal-500/10', accent: 'text-emerald-400' },`r`n                { label: 'Active Contacts', value: contacts.length, sub: 'In CRM', color: 'from-blue-500/10 to-cyan-500/10', accent: 'text-blue-400' },`r`n                { label: 'Completed', value: callLogs.filter(c => c.status === 'completed').length, sub: 'Finished calls', color: 'from-amber-500/10 to-orange-500/10', accent: 'text-amber-400' }"
$newStats = "{ label: 'Total Calls', value: reports?.totalCalls || callLogs.length, sub: 'All time', color: 'from-violet-500/10 to-indigo-500/10', accent: 'text-violet-400' },`r`n                { label: 'Appointments', value: reports?.bookedAppointments || appointments.length, sub: 'Booked by AI', color: 'from-emerald-500/10 to-teal-500/10', accent: 'text-emerald-400' },`r`n                { label: 'Active Contacts', value: contacts.length, sub: 'In CRM', color: 'from-blue-500/10 to-cyan-500/10', accent: 'text-blue-400' },`r`n                { label: 'Completed', value: reports?.hourlyVolume ? reports.hourlyVolume.reduce((acc, h) => acc + h.count, 0) : callLogs.filter(c => c.status === 'completed').length, sub: 'Finished calls', color: 'from-amber-500/10 to-orange-500/10', accent: 'text-amber-400' }"

# Normalize line endings for replacement
$appContent = $appContent -replace "`r`n", "`n"
$oldStatsNorm = $oldStats -replace "`r`n", "`n"
$newStatsNorm = $newStats -replace "`r`n", "`n"

if ($appContent.Contains($oldStatsNorm)) {
    $appContent = $appContent.Replace($oldStatsNorm, $newStatsNorm)
    $appContent | Set-Content -Path $appPath -NoNewline
    Write-Host "✅ App.jsx updated"
} else {
    Write-Host "❌ App.jsx target not found"
}
