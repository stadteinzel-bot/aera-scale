# diagnose_gcp.ps1 - Deep Diagnostics for Google Cloud Project
# Checks for:
# 1. Active Project ID
# 2. Enabled APIs (Maps, Vertex AI, etc.)
# 3. IAM Permissions for Cloud Run Service Account
# 4. Cloud Run Service Status

$ErrorActionPreference = "Continue"

Write-Host "🕵️ Starting Deep Google Cloud Diagnostics..." -ForegroundColor Cyan

# 1. Check Active Project
Write-Host "`n1. Checking Active Project..." -ForegroundColor Yellow
$projectConfig = gcloud config list project --format="value(core.project)" 2>$null
if (-not $projectConfig) {
    Write-Error "❌ No active Google Cloud project found. Run 'gcloud config set project [PROJECT_ID]'."
    exit 1
}
Write-Host "   Active Project: $projectConfig" -ForegroundColor Green

# 2. Check Enabled APIs
Write-Host "`n2. Verifying Required APIs..." -ForegroundColor Yellow
$requiredApis = @(
    "aiplatform.googleapis.com", 
    "firebasestorage.googleapis.com", 
    "firestore.googleapis.com",
    "maps-backend.googleapis.com", 
    "places-backend.googleapis.com",
    "geocoding-backend.googleapis.com",
    "run.googleapis.com"
)

$enabledServices = gcloud services list --enabled --format="value(config.name)"
foreach ($api in $requiredApis) {
    if ($enabledServices -contains $api) {
        Write-Host "   ✅ $api is ENABLED" -ForegroundColor Green
    }
    else {
        Write-Host "   ❌ $api is DISABLED" -ForegroundColor Red
        Write-Host "      -> Run: gcloud services enable $api" -ForegroundColor Gray
    }
}

# 3. Check IAM Permissions for Cloud Run
Write-Host "`n3. Checking IAM Permissions..." -ForegroundColor Yellow
# Get the default Compute Engine Service Account (default for Cloud Run)
$projectNumber = gcloud projects describe $projectConfig --format="value(projectNumber)"
$serviceAccount = "$projectNumber-compute@developer.gserviceaccount.com"
Write-Host "   Target Service Account: $serviceAccount" -ForegroundColor Gray

$policy = gcloud projects get-iam-policy $projectConfig --format="json" | ConvertFrom-Json
$bindings = $policy.bindings

$hasVertexUser = $false
$hasDatastoreUser = $false

foreach ($binding in $bindings) {
    if ($binding.members -contains "serviceAccount:$serviceAccount") {
        if ($binding.role -eq "roles/aiplatform.user") { $hasVertexUser = $true }
        if ($binding.role -eq "roles/datastore.user") { $hasDatastoreUser = $true }
        if ($binding.role -eq "roles/owner" -or $binding.role -eq "roles/editor") {
            $hasVertexUser = $true
            $hasDatastoreUser = $true
        }
    }
}

if ($hasVertexUser) {
    Write-Host "   ✅ Vertex AI User Role: GRANTED" -ForegroundColor Green
}
else {
    Write-Host "   ❌ Vertex AI User Role: MISSING" -ForegroundColor Red
    Write-Host "      -> Run: gcloud projects add-iam-policy-binding $projectConfig --member='serviceAccount:$serviceAccount' --role='roles/aiplatform.user'" -ForegroundColor Gray
}

if ($hasDatastoreUser) {
    Write-Host "   ✅ Firestore/Datastore User Role: GRANTED" -ForegroundColor Green
}
else {
    Write-Host "   ❌ Firestore/Datastore User Role: MISSING" -ForegroundColor Red
    Write-Host "      -> Run: gcloud projects add-iam-policy-binding $projectConfig --member='serviceAccount:$serviceAccount' --role='roles/datastore.user'" -ForegroundColor Gray
}

# 4. Cloud Run Status
Write-Host "`n4. Checking Cloud Run Service..." -ForegroundColor Yellow
gcloud run services describe area-scale --region europe-west1 --format="table(status.url, status.latestCreatedRevisionName, status.conditions[0].status)"

Write-Host "`n🏁 Diagnostics Complete." -ForegroundColor Cyan
