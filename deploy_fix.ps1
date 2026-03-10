# deploy_fix.ps1 - Robust Cloud Run Deployment Script
# 1. Loads .env.local variables
# 2. Configures Nginx/Docker if missing
# 3. Deploys to Cloud Run (baking variables into build via temporary .env)

$ErrorActionPreference = "Stop"

Write-Host ">>> Starting Robust Deployment..." -ForegroundColor Cyan

# --- Step 1: Check/Fix Configuration ---
Write-Host "1. Checking configuration keys..."

# Check nginx.conf
if (-not (Test-Path "nginx.conf")) {
    Write-Host "Warning: nginx.conf missing. Creating default SPA config..." -ForegroundColor Yellow
    $nginxContent = @"
server {
    listen 8080;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;
    location / {
        try_files `$uri `$uri/ /index.html;
    }
}
"@
    Set-Content -Path "nginx.conf" -Value $nginxContent
}

# --- Step 2: Load Environment Variables ---
Write-Host "2. Loading environment variables from .env.local..."

$envFile = ".env.local"
if (-not (Test-Path $envFile)) {
    $envFile = ".env"
    if (-not (Test-Path $envFile)) {
        Write-Error "Error: No .env or .env.local file found! Cannot deploy safely."
    }
}

$envVars = @()
Get-Content $envFile | ForEach-Object {
    $line = $_.Trim()
    if ($line -and -not $line.StartsWith("#")) {
        # Split by first '=' only
        $parts = $line.Split("=", 2)
        if ($parts.Length -eq 2) {
            $key = $parts[0].Trim()
            $value = $parts[1].Trim()
            
            # Remove quotes if present
            if ($value.StartsWith('"') -and $value.EndsWith('"')) {
                $value = $value.Substring(1, $value.Length - 2)
            }
            
            if ($key.StartsWith("VITE_")) {
                $envVars += "$key=$value"
                Write-Host "   + Loaded: $key" -ForegroundColor Gray
            }
        }
    }
}

if ($envVars.Count -eq 0) {
    Write-Warning "Warning: No VITE_ variables found to deploy. App may be broken."
}
else {
    Write-Host "Success: Found $($envVars.Count) environment variables." -ForegroundColor Green
}

# --- Step 2.5: Enforce Google Maps Key ---
$mapsKeyFound = $envVars | Where-Object { $_ -match "VITE_GOOGLE_MAPS_API_KEY" }
if (-not $mapsKeyFound) {
    Write-Warning "Warning: Google Maps API Key is MISSING in .env files!"
    $inputKey = Read-Host "Please enter your Google Maps API Key (VITE_GOOGLE_MAPS_API_KEY)"
    
    if (-not [string]::IsNullOrWhiteSpace($inputKey)) {
        # Add to runtime list
        $envVars += "VITE_GOOGLE_MAPS_API_KEY=$inputKey"
        Write-Host "   + Added Temporary Maps Key for this deployment." -ForegroundColor Green
        
        # Optional: Ask to save
        $save = Read-Host "Save to .env.local? (y/n)"
        if ($save -eq 'y') {
            Add-Content -Path ".env.local" -Value "`nVITE_GOOGLE_MAPS_API_KEY=$inputKey"
            Write-Host "   Saved to .env.local" -ForegroundColor Gray
        }
    }
    else {
        Write-Error "Error: Deployment Aborted. Google Maps Key is required."
    }
}

# --- Step 3: Deploy to Cloud Run ---
Write-Host "3. Deploying to Cloud Run..."

# TRIGGER: Create temporary .env for Cloud Build
Write-Host "   Creating temporary .env for build process..." -ForegroundColor Gray
$envContent = $envVars -join [System.Environment]::NewLine
Set-Content -Path ".env" -Value $envContent

Try {
    $serviceName = "area-scale"
    $region = "europe-west1"
    
    Write-Host "Running: gcloud run deploy $serviceName --source . --region $region --allow-unauthenticated" -ForegroundColor DarkGray
    
    # RELAX ERROR PREFERENCE
    $OriginalErrorAction = $ErrorActionPreference
    $ErrorActionPreference = "Continue"

    # Execute directly (simplest and most robust method for PowerShell)
    gcloud run deploy $serviceName --source . --region $region --allow-unauthenticated

    
    # Capture exit code immediately
    $ExitCode = $LASTEXITCODE
    $ErrorActionPreference = $OriginalErrorAction
    
    Write-Host "   DEBUG: gcloud finished with exit code: $ExitCode" -ForegroundColor Magenta

    if ($ExitCode -ne 0) {
        throw "gcloud exited with code $ExitCode"
    }
}
Catch {
    Write-Error "Error: Deployment Error Detected: $_"
    exit 1
}
Finally {
    # Cleanup strict
    Write-Host "   Cleaning up temporary .env..." -ForegroundColor Gray
    if (Test-Path ".env") { 
        Remove-Item ".env" -Force -ErrorAction SilentlyContinue 
    }
}

Write-Host "   DEBUG: Final LASTEXITCODE check: $LASTEXITCODE" -ForegroundColor Magenta

if ($LASTEXITCODE -eq 0) {
    Write-Host "`nSuccess: Deployment Successful!" -ForegroundColor Green
    Write-Host "Your app should now have access to the VITE_ variables."
}
else {
    Write-Error "Error: Deployment Failed. (Final Exit Code: $LASTEXITCODE)"
}
