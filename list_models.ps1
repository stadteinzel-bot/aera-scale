# list_models.ps1
$ErrorActionPreference = "Stop"

$projectId = "aera-scale"
$region = "us-central1"
$url = "https://$region-aiplatform.googleapis.com/v1/projects/$projectId/locations/$region/publishers/google/models"
$token = gcloud auth print-access-token 2>$null

try {
    Write-Host "Querying available models in $region..." -ForegroundColor Cyan
    $response = Invoke-RestMethod -Uri $url -Method Get -Headers @{Authorization = "Bearer $token" }
    
    $models = $response.models
    Write-Host "Found $($models.Count) models." -ForegroundColor Green
    
    foreach ($m in $models) {
        if ($m.name -match "gemini") {
            Write-Host " 🔹 $($m.name)" -ForegroundColor Yellow
            Write-Host "    ID: $($m.name.Split('/')[-1])" -ForegroundColor Gray
        }
    }
}
catch {
    Write-Host "Failed to list models." -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        Write-Host $reader.ReadToEnd()
    }
    else {
        Write-Host $_.Exception.Message
    }
}
