
$url = "https://qhqmljwexivhvxzfklum.supabase.co/rest/v1/integrations?select=*"
$key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFocW1sandleGl2aHZ4emZrbHVtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3OTM3MjMsImV4cCI6MjA5MDM2OTcyM30.nO_aKJkRRsDNSIWDLgmvos7LxISvenFz2Fwn-62BgLo"

$headers = @{
    "apikey" = $key
    "Authorization" = "Bearer $key"
}

try {
    $response = Invoke-RestMethod -Uri $url -Headers $headers -Method Get
    Write-Host "Integrations:"
    $response | ConvertTo-Json | Write-Host
} catch {
    Write-Error $_.Exception.Message
}
