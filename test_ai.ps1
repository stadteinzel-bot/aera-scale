# test_ai.ps1
$ErrorActionPreference = "Stop"

function Test-Region {
    param([string]$region)
    Write-Host "Checking Region: $region..." -NoNewline
    
    $projectId = "aera-scale"
    $modelId = "gemini-1.5-flash"
    $url = "https://$region-aiplatform.googleapis.com/v1/projects/$projectId/locations/$region/publishers/google/models/$modelId`:generateContent"
    
    # Get token silently
    $token = gcloud auth print-access-token 2>$null
    
    $body = @{
        contents = @(
            @{
                role  = "user"
                parts = @(
                    @{ text = "Hello" }
                )
            }
        )
    } | ConvertTo-Json -Depth 4

    try {
        $response = Invoke-RestMethod -Uri $url -Method Post -Headers @{Authorization = "Bearer $token"; "Content-Type" = "application/json" } -Body $body
        Write-Host " [SUCCESS]" -ForegroundColor Green
        return $true
    }
    catch {
        Write-Host " [FAILED]" -ForegroundColor Red
        if ($_.Exception.Response) {
            # Read error stream
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $err = $reader.ReadToEnd()
            Write-Host "   API Says: $err" -ForegroundColor Gray
        }
        else {
            Write-Host "   Error: $($_.Exception.Message)"
        }
        return $false
    }
}

Write-Host "starting tests..."
if (Test-Region "us-central1") { exit 0 }
if (Test-Region "europe-west1") { exit 0 }
if (Test-Region "europe-west2") { exit 0 }
if (Test-Region "europe-west3") { exit 0 }

Write-Error "All regions failed."
