# deploy.ps1 - Google Cloud Run Deployment Script
# Service: aera-scale (matches GCP project name)
# Strategy: Build locally with Vite, then upload pre-built dist/ to Cloud Build

$gcloudPath = "C:\Users\Salih Kerey\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"
if (-not (Test-Path $gcloudPath)) {
    $gcloudPath = "gcloud" # Fallback to PATH if not found at specific location
}

$currentProject = & $gcloudPath config get-value project 2>$null
if (-not $currentProject) {
    $projectId = Read-Host -Prompt "Enter your Google Cloud Project ID"
}
else {
    Write-Host "Using current project: $currentProject"
    $projectId = $currentProject
}

$region = "europe-west1" # Default region
$serviceName = "aera-scale"

Write-Host "Deploying $serviceName to Project: $projectId in Region: $region..."

# 0. Build locally with Vite (ensures correct code is deployed)
Write-Host "Step 0: Building locally with Vite..."
npx vite build
if ($LASTEXITCODE -ne 0) {
    Write-Error "Vite build failed!"
    exit 1
}

# Add a build version marker to bust Docker layer cache
$ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss.fff"
Set-Content -Path "dist\_build_version.txt" -Value "Built: $ts"
Write-Host "Build marker: $ts"

# 1. Build the Container Image using Cloud Build (with unique tag)
$tag = "v" + (Get-Date -Format "yyyyMMddHHmmss")
Write-Host "Step 1: Building Container Image (tag: $tag)..."
& $gcloudPath builds submit --tag gcr.io/$projectId/area-scale:$tag .
if ($LASTEXITCODE -ne 0) {
    Write-Error "Build failed!"
    exit 1
}

# 2. Deploy to Cloud Run
Write-Host "Step 2: Deploying to Cloud Run..."

# Read env vars from .env.local
$envVars = @()
if (Test-Path .env.local) {
    Get-Content .env.local | ForEach-Object {
        if ($_ -match "^(VITE_[A-Z_]+)=(.*)$") {
            $key = $matches[1]
            $val = $matches[2]
            if (-not [string]::IsNullOrWhiteSpace($val)) {
                $envVars += "$key=$val"
            }
        }
    }
}
$envString = $envVars -join ","
Write-Host "Injecting Environment Variables: $envString"

& $gcloudPath run deploy $serviceName --image gcr.io/$projectId/area-scale:$tag --platform managed --region $region --allow-unauthenticated --set-env-vars "$envString" --port 8080
if ($LASTEXITCODE -ne 0) {
    Write-Error "Deployment failed!"
    exit 1
}

Write-Host "Deployment Successful! Your app should be live at:"
Write-Host "  https://$serviceName-983360724436.$region.run.app"
