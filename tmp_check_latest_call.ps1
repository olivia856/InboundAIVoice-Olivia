$url = "https://qhqmljwexivhvxzfklum.supabase.co/rest/v1/calls?select=*&limit=1&order=created_at.desc"
$key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFocW1sandleGl2aHZ4emZrbHVtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3OTM3MjMsImV4cCI6MjA5MDM2OTcyM30.nO_aKJkRRsDNSIWDLgmvos7LxISvenFz2Fwn-62BgLo"

$headers = @{
    "apikey" = $key
    "Authorization" = "Bearer $key"
}

try {
    $response = Invoke-RestMethod -Uri $url -Headers $headers -Method Get
    $response | ConvertTo-Json -Depth 10 | Write-Host
} catch {
    Write-Error $_.Exception.Message
}
