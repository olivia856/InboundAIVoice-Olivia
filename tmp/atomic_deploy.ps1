
$repoUrl = "https://github.com/tvijayy/InboundAIVoice.git"
$tempDir = "C:\Users\tvijayy\Downloads\InboundAIVoice-main\InboundAIVoice-main\tmp\final_deploy"
$sourceDir = "C:\Users\tvijayy\Downloads\InboundAIVoice-main\InboundAIVoice-main"

Write-Host "--- STARTING ROBURST DEPLOYMENT ---"

# 1. Cleanup
if (Test-Path $tempDir) { 
    Write-Host "Cleaning target $tempDir..."
    Remove-Item -Path $tempDir -Recurse -Force 
}

# 2. Clone accurately
Write-Host "Cloning repo $repoUrl..."
git clone $repoUrl $tempDir
Set-Location -Path $tempDir

# 3. Synchronize All Source Files (Exclude git/node_modules)
Write-Host "Synchronizing source files from $sourceDir to $tempDir..."
robocopy "$sourceDir" "$tempDir" /E /XF *.git* /XD .git node_modules .next .vercel tmp /MT:8

# 4. Commit and Force Push to Main
Write-Host "Committing changes..."
git add .
git commit -m "🚀 FINAL CALIBRATION: Theme, Analytics, and Tool refined"
Write-Host "Pushing to origin main..."
git push origin main --force

# 5. Proof of Push
Write-Host "--- DEPLOY DISPATCHED ---"
git log -n 1 --oneline
Write-Host "-------------------------"
