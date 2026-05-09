
$serverPath = "C:\Users\tvijayy\Downloads\InboundAIVoice-main\InboundAIVoice-main\backend\server.js"
$appPath = "C:\Users\tvijayy\Downloads\InboundAIVoice-main\InboundAIVoice-main\frontend\src\App.jsx"

# --- Fix server.js System Prompt ---
$serverContent = Get-Content -Path $serverPath -Raw
$oldPrompt = "finalPrompt += `"\n\nULTRA-IMPORTANT - EMOTIONAL EVALUATION: Monitor the user's mood and call status. \nSTRICT RULES:\n1. 'sentiment' MUST be EXACTLY 1 or 2 words (e.g. 'Angry', 'Very Happy', 'Frustrated', 'Interested').\n2. 'category' MUST be: Positive, Negative, or Neutral.\n3. CALL TERMINATION: As soon as you say a FINAL goodbye at the end of a successful session (e.g., 'Have a great day!') or the caller says goodbye, you MUST call 'hang_up' IMMEDIATELY. Never wait for the caller to hang up first. Do NOT use hang_up for apologies or errors.`";"
$newPrompt = "finalPrompt += `"\n\nULTRA-IMPORTANT - EMOTIONAL EVALUATION: Monitor the user's mood and call status. \nSTRICT RULES:\n1. 'sentiment' MUST be EXACTLY 1 or 2 words (e.g. 'Angry', 'Looking for job', 'Interested'). Use 'Booked' ONLY IF you successfully confirmed a calendar slot.\n2. 'category' MUST be: Positive, Negative, or Neutral.\n3. CALL TERMINATION: As soon as you say a FINAL goodbye at the end of a successful session (e.g., 'Have a great day!') or the caller says goodbye, you MUST call 'hang_up' IMMEDIATELY. Never wait for the caller to hang up first. Do NOT use hang_up for apologies or errors.`";"

if ($serverContent.Contains("$oldPrompt")) {
    $serverContent = $serverContent.Replace("$oldPrompt", "$newPrompt")
}

$serverContent | Set-Content -Path $serverPath -NoNewline


# --- Fix App.jsx Status Logic ---
$appContent = Get-Content -Path $appPath -Raw

# 1. Fix Sentiment Colors
$oldSentimentCn = '(!c.duration_seconds || c.duration_seconds === 0) ? "bg-slate-500/10 text-slate-400 border-slate-500/20" :
                               (c.sentiment_category === ''Positive'') ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : 
                               (c.sentiment_category === ''Negative'') ? "bg-red-500/10 text-red-400 border-red-500/20" : 
                               "bg-cyan-500/10 text-cyan-400 border-cyan-500/20"'

$newSentimentCn = '(!c.duration_seconds || c.duration_seconds === 0) ? "bg-slate-500/10 text-slate-400 border-slate-500/20" :
                               (c.sentiment && (c.sentiment.toLowerCase().includes(''book'') || c.sentiment.toLowerCase().includes(''interest''))) ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                               (c.sentiment_category === ''Positive'') ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : 
                               (c.sentiment_category === ''Negative'') ? "bg-red-500/10 text-red-400 border-red-500/20" : 
                               "bg-cyan-500/10 text-cyan-400 border-cyan-500/20"'

# 2. Fix Status Mapping
$oldStatusSpan = '<span className={cn("px-2.5 py-1 rounded-full text-[10px] uppercase font-bold tracking-wider",
                             c.call_status === ''Booked'' ? "bg-blue-500/10 text-blue-400" :
                             c.call_status === ''Missed'' ? "bg-red-500/10 text-red-500" :
                             c.call_status === ''Follow Up'' ? "bg-yellow-500/10 text-yellow-500" :
                             c.call_status === ''Resolved'' ? "bg-green-500/10 text-green-500" :
                             "bg-primary/10 text-primary")}>
                             {c.call_status || c.status || ''Completed''}
                           </span>'

$newStatusSpan = '<span className={cn("px-2.5 py-1 rounded-full text-[10px] uppercase font-bold tracking-wider",
                               (c.call_status === ''Booked'' || c.call_status === ''Resolved'') ? "bg-emerald-500/10 text-emerald-400" :
                               ((c.call_status === ''Missed'' || c.status === ''Missed'') && (!c.duration_seconds || c.duration_seconds === 0)) ? "bg-red-500/10 text-red-500" :
                               (c.call_status === ''Follow Up'') ? "bg-yellow-500/10 text-yellow-500" :
                               "bg-primary/10 text-primary")}>
                               {Number(c.duration_seconds || 0) > 0 && (c.call_status === ''Missed'' || c.status === ''Missed'') ? ''Completed'' : (c.call_status || c.status || ''Completed'')}
                             </span>'

# Normalize newlines for replacement
$appContent = $appContent -replace "`r`n", "`n"
$oldSentimentCn = $oldSentimentCn -replace "`r`n", "`n"
$newSentimentCn = $newSentimentCn -replace "`r`n", "`n"
$oldStatusSpan = $oldStatusSpan -replace "`r`n", "`n"
$newStatusSpan = $newStatusSpan -replace "`r`n", "`n"

$appContent = $appContent.Replace($oldSentimentCn, $newSentimentCn)
$appContent = $appContent.Replace($oldStatusSpan, $newStatusSpan)

$appContent | Set-Content -Path $appPath -NoNewline

Write-Host "✅ Files updated successfully via fallback script."
