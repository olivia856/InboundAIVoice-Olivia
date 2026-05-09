import os

filepath = 'backend/server.js'
with open(filepath, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Replace lines 32 to 42 (zero-indexed 32:43)
lines[32:43] = [
    "let finalDbUrl = 'https://qhqmljwexivhvxzfklum.supabase.co';\n",
    "let finalDbKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFocW1sandleGl2aHZ4emZrbHVtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ3MjI3NjQsImV4cCI6MjA4Njg0MDA2M30.M0N3e-7u58W0G2Cis_G1410X83Y9V8n-6P88z4zL0nU';\n",
    "const supabase = createClient(finalDbUrl, finalDbKey);\n"
]

with open(filepath, 'w', encoding='utf-8') as f:
    f.writelines(lines)

print("Replacement complete.")
