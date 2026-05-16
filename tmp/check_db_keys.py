
import os
import json
from supabase import create_client, Client

url = "https://qhqmljwexivhvxzfklum.supabase.co"
key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFocW1sandleGl2aHZ4emZrbHVtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3OTM3MjMsImV4cCI6MjA5MDM2OTcyM30.nO_aKJkRRsDNSIWDLgmvos7LxISvenFz2Fwn-62BgLo"

supabase: Client = create_client(url, key)

try:
    response = supabase.table("platform_settings").select("*").execute()
    print("Platform Settings:")
    print(json.dumps(response.data, indent=2))
except Exception as e:
    print(f"Error: {e}")
