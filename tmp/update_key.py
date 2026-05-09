import os

filepath = 'backend/server.js'
with open(filepath, 'r', encoding='utf-8') as f:
    lines = f.readlines()

lines[33] = "let finalDbKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFocW1sandleGl2aHZ4emZrbHVtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3OTM3MjMsImV4cCI6MjA5MDM2OTcyM30.nO_aKJkRRsDNSIWDLgmvos7LxISvenFz2Fwn-62BgLo';\n"

with open(filepath, 'w', encoding='utf-8') as f:
    f.writelines(lines)

print("Key update complete.")
