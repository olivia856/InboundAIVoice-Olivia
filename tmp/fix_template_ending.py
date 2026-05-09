import os

filepath = 'backend/server.js'
with open(filepath, 'r', encoding='utf-8') as f:
    lines = f.readlines()

lines[81] = "        smsBody = `Reminder: Hi ${name}, your meeting starts in 30 minutes at ${startTimeStr}. Please be ready.`;\n"
lines[93] = "        smsBody = `Hi ${name}, your Azlon AI appointment has been correctly rescheduled to ${startTimeStr}. We will speak with you then!`;\n"

with open(filepath, 'w', encoding='utf-8') as f:
    f.writelines(lines)

print("Updated server.js to fix WhatsApp variable endings.")
