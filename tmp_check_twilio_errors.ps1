$supabaseUrl = "https://qhqmljwexivhvxzfklum.supabase.co/rest/v1/integrations?provider=eq.twilio&client_id=eq.AZL-0003&select=*"
$supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFocW1sandleGl2aHZ4emZrbHVtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3OTM3MjMsImV4cCI6MjA5MDM2OTcyM30.nO_aKJkRRsDNSIWDLgmvos7LxISvenFz2Fwn-62BgLo"

$headers = @{
    "apikey" = $supabaseKey
    "Authorization" = "Bearer $supabaseKey"
}

$twInt = Invoke-RestMethod -Uri $supabaseUrl -Headers $headers -Method Get
if ($twInt.Count -eq 0) {
    Write-Host "No Twilio integration found"
    exit
}

$sid = $twInt[0].meta_data.sid
$token = $twInt[0].api_key

$base64AuthInfo = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes(("{0}:{1}" -f $sid,$token)))

$twilioUrl = "https://monitor.twilio.com/v1/Alerts?PageSize=5"
$twilioHeaders = @{
    "Authorization" = "Basic $base64AuthInfo"
}

try {
    $alerts = Invoke-RestMethod -Uri $twilioUrl -Headers $twilioHeaders -Method Get
    foreach ($alert in $alerts.alerts) {
        Write-Host "[$($alert.date_generated)] Error $($alert.error_code): $($alert.alert_text)"
        Write-Host "URL: $($alert.request_url)"
    }
} catch {
    Write-Error $_.Exception.Message
}
