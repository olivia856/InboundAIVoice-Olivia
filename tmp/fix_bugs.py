
import os

def fix_file(path, replacements):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    for old, new in replacements:
        if old in content:
            content = content.replace(old, new)
            print(f"✅ Replaced in {os.path.basename(path)}")
        else:
            print(f"❌ Target not found in {os.path.basename(path)}: {old[:50]}...")
            
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

# 1. Fix Server.js
server_path = r'C:\Users\tvijayy\Downloads\InboundAIVoice-main\InboundAIVoice-main\backend\server.js'
server_replaces = [
    # Remove .limit(50)
    (".order('created_at', { ascending: false })\n            .limit(50);", ".order('created_at', { ascending: false });"),
    
    # Update AI Prompt
    ('finalPrompt += "\\n\\nULTRA-IMPORTANT - EMOTIONAL EVALUATION: Monitor the user\'s mood constantly. If they express strong emotion, you MUST call \'log_call_outcome\' IMMEDIATELY. \\nSTRICT RULES:\\n1. \'sentiment\' MUST be EXACTLY 1 or 2 words (e.g. \'Angry\', \'Very Happy\', \'Frustrated\', \'Interested\').\\n2. \'category\' MUST be: Positive, Negative, or Neutral.\\n3. CALL TERMINATION: As soon as you say your final goodbye (e.g., \'Have a great day!\'), you MUST call \'hang_up\' IMMEDIATELY to end the session. Never wait for the caller to hang up first.";', 
     'finalPrompt += "\\n\\nULTRA-IMPORTANT - EMOTIONAL EVALUATION: Monitor the user\'s mood and call status. \\nSTRICT RULES:\\n1. \'sentiment\' MUST be EXACTLY 1 or 2 words (e.g. \'Angry\', \'Very Happy\', \'Frustrated\', \'Interested\').\\n2. \'category\' MUST be: Positive, Negative, or Neutral.\\n3. CALL TERMINATION: As soon as you say a FINAL goodbye at the end of a successful session (e.g., \'Have a great day!\') or the caller says goodbye, you MUST call \'hang_up\' IMMEDIATELY. Never wait for the caller to hang up first. Do NOT use hang_up for apologies or errors.";')
]
fix_file(server_path, server_replaces)

# 2. Fix App.jsx
app_path = r'C:\Users\tvijayy\Downloads\InboundAIVoice-main\InboundAIVoice-main\frontend\src\App.jsx'
app_replaces = [
    (
        "{ label: 'Total Calls', value: callLogs.length, sub: 'All time', color: 'from-violet-500/10 to-indigo-500/10', accent: 'text-violet-400' },\n                { label: 'Appointments', value: appointments.length, sub: 'Booked by AI', color: 'from-emerald-500/10 to-teal-500/10', accent: 'text-emerald-400' },\n                { label: 'Active Contacts', value: contacts.length, sub: 'In CRM', color: 'from-blue-500/10 to-cyan-500/10', accent: 'text-blue-400' },\n                { label: 'Completed', value: callLogs.filter(c => c.status === 'completed').length, sub: 'Finished calls', color: 'from-amber-500/10 to-orange-500/10', accent: 'text-amber-400' }",
        "{ label: 'Total Calls', value: reports?.totalCalls || callLogs.length, sub: 'All time', color: 'from-violet-500/10 to-indigo-500/10', accent: 'text-violet-400' },\n                { label: 'Appointments', value: reports?.bookedAppointments || appointments.length, sub: 'Booked by AI', color: 'from-emerald-500/10 to-teal-500/10', accent: 'text-emerald-400' },\n                { label: 'Active Contacts', value: contacts.length, sub: 'In CRM', color: 'from-blue-500/10 to-cyan-500/10', accent: 'text-blue-400' },\n                { label: 'Completed', value: reports?.hourlyVolume ? reports.hourlyVolume.reduce((acc, h) => acc + h.count, 0) : callLogs.filter(c => c.status === 'completed').length, sub: 'Finished calls', color: 'from-amber-500/10 to-orange-500/10', accent: 'text-amber-400' }"
    )
]
fix_file(app_path, app_replaces)
