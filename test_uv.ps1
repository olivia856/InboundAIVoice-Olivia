$url = "https://api.ultravox.ai/api/calls"
$key = "ZvQ0T7ti.HkEmcEDWaeLT2R6tB8iQXuYZgQuvwLWg"

$headers = @{
    "Content-Type" = "application/json"
    "X-API-Key" = $key
}

$body = @{
    "systemPrompt" = "You are a helpful assistant."
    "voice" = "Mark"
    "temperature" = 0.3
    "firstSpeaker" = "FIRST_SPEAKER_AGENT"
    "medium" = @{ "twilio" = @{} }
    "selectedTools" = @()
} | ConvertTo-Json -Depth 5

try {
    $response = Invoke-RestMethod -Uri $url -Headers $headers -Method Post -Body $body
    Write-Host "Success!"
    $response | ConvertTo-Json -Depth 5 | Write-Host
} catch {
    Write-Host "Error!"
    Write-Host $_.Exception.Message
    if ($_.ErrorDetails) {
        Write-Host $_.ErrorDetails.Message
    }
}
