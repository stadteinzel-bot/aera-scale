# inject_keys.ps1 - Emergency API Key Injection
# Updates Cloud Run service with missing API keys without full redeploy.

$ErrorActionPreference = "Stop"
$serviceName = "area-scale"
$region = "europe-west1"

Write-Host "🚨 Starting Emergency Key Injection..." -ForegroundColor Yellow

# Try to find keys in .env.local or .env
$mapsKey = $null
$geminiKey = $null

$envFiles = @(".env.local", ".env")
foreach ($file in $envFiles) {
    if (Test-Path $file) {
        Get-Content $file | ForEach-Object {
            if ($_ -match "VITE_GOOGLE_MAPS_API_KEY=(.*)") { $mapsKey = $matches[1].Trim() }
            if ($_ -match "VITE_GEMINI_API_KEY=(.*)") { $geminiKey = $matches[1].Trim() }
        }
    }
}

# Prompt if missing
if (-not $mapsKey) {
    Write-Warning "VITE_GOOGLE_MAPS_API_KEY not found in .env files."
    $mapsKey = Read-Host "Please enter Google Maps API Key"
}
if (-not $geminiKey) {
    Write-Warning "VITE_GEMINI_API_KEY not found in .env files."
    $geminiKey = Read-Host "Please enter Gemini API Key (or press Enter to skip if using Firebase)"
}

if (-not $mapsKey) {
    Write-Error "❌ Maps Key is required to proceed."
}

# Construct Update Command
$updateEnvVars = "VITE_GOOGLE_MAPS_API_KEY=$mapsKey"
if ($geminiKey) {
    $updateEnvVars += ",VITE_GEMINI_API_KEY=$geminiKey"
}

Write-Host "💉 Injecting keys into Cloud Run service '$serviceName'..." -ForegroundColor Cyan
$cmd = "gcloud run services update $serviceName --region $region --update-env-vars $updateEnvVars"

Write-Host "Running: $cmd" -ForegroundColor DarkGray
Invoke-Expression $cmd

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ Keys Injected Successfully!" -ForegroundColor Green
    Write-Host "The service is restarting with the new configuration."
}
else {
    Write-Error "❌ Injection Failed."
}
