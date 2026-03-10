# AREA SCALE - Google Cloud API Setup Script
# Run this script to enable all required services for the application.

$PROJECT_ID = "aera-scale"
$REGION = "europe-west1"

Write-Host "🚀 Setting up Google Cloud Project: $PROJECT_ID" -ForegroundColor Cyan

# 1. Set Project
Write-Host "👉 Setting active project..."
gcloud config set project $PROJECT_ID

# 2. Enable APIs
Write-Host "👉 Enabling Required APIs..."
# Maps JavaScript API
gcloud services enable maps-backend.googleapis.com
# Geocoding API
gcloud services enable geocoding-backend.googleapis.com
# Places API
gcloud services enable places-backend.googleapis.com
# Firestore
gcloud services enable firestore.googleapis.com
# Vertex AI
gcloud services enable aiplatform.googleapis.com
# Cloud Run
gcloud services enable run.googleapis.com
# Container Registry / Artifact Registry
gcloud services enable artifactregistry.googleapis.com
# Cloud Build
gcloud services enable cloudbuild.googleapis.com

Write-Host "✅ APIs Enabled!" -ForegroundColor Green

# 3. Firestore Database Check (Informational)
Write-Host "ℹ️  Ensure your Firestore database is created in Native mode."
Write-Host "   If not, run: gcloud firestore databases create --location=$REGION"

# 4. Vertex AI Permissions (for default compute service account)
Write-Host "👉 Granting AI User role to Cloud Run Service Account..."
$PROJECT_NUMBER = gcloud projects describe $PROJECT_ID --format="value(projectNumber)"
$SERVICE_ACCOUNT = "$PROJECT_NUMBER-compute@developer.gserviceaccount.com"

gcloud projects add-iam-policy-binding $PROJECT_ID `
    --member="serviceAccount:$SERVICE_ACCOUNT" `
    --role="roles/aiplatform.user"

Write-Host "✅ Permissions Granted!" -ForegroundColor Green
Write-Host "🎉 Setup Complete! Your project is ready for AREA SCALE." -ForegroundColor Cyan
