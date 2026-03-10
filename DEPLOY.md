# Deploying to Google Cloud Run (Public Launch)

This guide helps you deploy the `area-scale` application to Google Cloud Run for a fully public website.

## Prerequisites

Start by installing the Google Cloud CLI (gcloud):
1.  **Download and Install**: [Google Cloud CLI Install](https://cloud.google.com/sdk/docs/install)
2.  **Initialize**: Run `gcloud init` in your terminal to login and select your project.
3.  **Enable Services**: Ensure Cloud Run and Container Registry/Artifact Registry are enabled for your project.

## Automated Deployment (Recommended)

Start PowerShell in this directory and run:

```powershell
.\deploy.ps1
```

1.  Enter your **Google Cloud Project ID** when prompted.
2.  The script will:
    - Build your container image using Cloud Build.
    - Deploy the service to Cloud Run (Region: `europe-west1`).
    - Configure it to allow **public access** (`--allow-unauthenticated`).

## Manual Deployment

If you prefer deploying step-by-step:

1.  **Build the Image**:
    ```bash
    gcloud builds submit --tag gcr.io/[PROJECT_ID]/area-scale .
    ```

2.  **Deploy the Service**:
    ```bash
    gcloud run deploy area-scale \
      --image gcr.io/[PROJECT_ID]/area-scale \
      --platform managed \
      --region europe-west1 \
      --allow-unauthenticated
    ```

## Environment Variables

Your application requires the following environment variables. You can set them during deployment or in the Cloud Run Console > Edit & Deploy New Revision > Variables:

- `VITE_FIREBASE_API_KEY`: `AIzaSyAPVxY8yQ8Z0dHuwgoblLQPYTAQ2yKq0No`
- `VITE_FIREBASE_AUTH_DOMAIN`: `aera-scale.firebaseapp.com`
- `VITE_FIREBASE_PROJECT_ID`: `aera-scale`
- `VITE_FIREBASE_STORAGE_BUCKET`: `aera-scale.firebasestorage.app`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`: `983360724436`
- `VITE_FIREBASE_APP_ID`: `1:983360724436:web:f34b37407b8535ef6f0a41`

> **Note:** The application now uses **Vertex AI for Firebase**. It authenticates automatically using the Cloud Run service identity. You do **not** need a separate `VITE_GEMINI_API_KEY`.

### 4. Enable Vertex AI Permissions (Important)
For the AI features to work, the Cloud Run service account must have access to Vertex AI.
Run the following command in your terminal (replace `YOUR_PROJECT_ID` and `PROJECT_NUMBER`):

```bash
# Get your project number
gcloud projects describe aera-scale --format="value(projectNumber)"

# Grant Vertex AI User role to the default compute service account
gcloud projects add-iam-policy-binding aera-scale \
  --member="serviceAccount:983360724436-compute@developer.gserviceaccount.com" \
  --role="roles/aiplatform.user"
```
*(Note: 983360724436 is your Project Number found in Firebase Console)*

Once deployed, you will receive a public HTTPS URL (e.g., `https://area-scale-xyz.a.run.app`).
