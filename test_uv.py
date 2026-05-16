import urllib.request
import json

url = "https://api.ultravox.ai/api/calls"
api_key = "ZvQ0T7ti.HkEmcEDWaeLT2R6tB8iQXuYZgQuvwLWg"

payload = {
    "systemPrompt": "You are a helpful assistant.",
    "voice": "Mark",
    "temperature": 0.3,
    "firstSpeaker": "FIRST_SPEAKER_AGENT",
    "medium": { "twilio": {} },
    "selectedTools": []
}

req = urllib.request.Request(url, method="POST")
req.add_header("Content-Type", "application/json")
req.add_header("X-API-Key", api_key)

try:
    with urllib.request.urlopen(req, data=json.dumps(payload).encode('utf-8')) as response:
        print("Status:", response.status)
        data = json.loads(response.read().decode('utf-8'))
        print("Response:", json.dumps(data, indent=2))
except urllib.error.HTTPError as e:
    print("HTTP Error:", e.code)
    print("Error Data:", e.read().decode('utf-8'))
except Exception as e:
    print("Error:", e)
