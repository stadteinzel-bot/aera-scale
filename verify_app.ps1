# verify_app.ps1 - Full App Verification Suite
$ErrorActionPreference = "Continue"
$baseUrl = "https://area-scale-besf3ognsa-ew.a.run.app"
$passed = 0
$failed = 0

function Test-Endpoint {
    param([string]$path, [string]$label)
    try {
        $url = "$baseUrl$path"
        $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 10
        if ($r.StatusCode -eq 200) {
            Write-Host "  PASS: $label ($($r.Content.Length) bytes)" -ForegroundColor Green
            $script:passed++
            return $r.Content
        }
        else {
            Write-Host "  FAIL: $label (Status $($r.StatusCode))" -ForegroundColor Red
            $script:failed++
            return $null
        }
    }
    catch {
        Write-Host "  FAIL: $label ($($_.Exception.Message))" -ForegroundColor Red
        $script:failed++
        return $null
    }
}

Write-Host "=== AREA SCALE - Full Production Verification ===" -ForegroundColor Cyan
Write-Host "URL: $baseUrl"
Write-Host ""

# 1. Page Load Tests
Write-Host "1. PAGE LOAD TESTS" -ForegroundColor Yellow
$html = Test-Endpoint "/" "Homepage"
Test-Endpoint "/debug-test" "Debug Page"

# 2. Static Asset Tests
Write-Host ""
Write-Host "2. STATIC ASSET TESTS" -ForegroundColor Yellow
if ($html) {
    # Extract JS filename
    if ($html -match 'src="/assets/(index-[^"]+\.js)"') {
        Test-Endpoint "/assets/$($Matches[1])" "Main JS Bundle"
    }
    # Extract CSS filename
    if ($html -match 'href="/assets/(index-[^"]+\.css)"') {
        Test-Endpoint "/assets/$($Matches[1])" "Main CSS Bundle"
    }
}

# 3. Environment Variable Check
Write-Host ""
Write-Host "3. ENVIRONMENT VARIABLE CHECK" -ForegroundColor Yellow
if ($html) {
    $envVars = @(
        "VITE_FIREBASE_API_KEY",
        "VITE_FIREBASE_AUTH_DOMAIN",
        "VITE_FIREBASE_PROJECT_ID",
        "VITE_FIREBASE_STORAGE_BUCKET",
        "VITE_FIREBASE_MESSAGING_SENDER_ID",
        "VITE_FIREBASE_APP_ID",
        "VITE_GOOGLE_MAPS_API_KEY"
    )
    foreach ($v in $envVars) {
        if ($html -match "$v`: `"([^`"]+)`"") {
            Write-Host "  PASS: $v = $($Matches[1].Substring(0, [Math]::Min(20, $Matches[1].Length)))..." -ForegroundColor Green
            $passed++
        }
        else {
            Write-Host "  FAIL: $v is MISSING or EMPTY" -ForegroundColor Red
            $failed++
        }
    }
}

# 4. SPA Router Check (all routes should return 200 via nginx fallback)
Write-Host ""
Write-Host "4. SPA ROUTER CHECK" -ForegroundColor Yellow
Test-Endpoint "/properties" "Properties Route"
Test-Endpoint "/tenants" "Tenants Route"
Test-Endpoint "/maintenance" "Maintenance Route"
Test-Endpoint "/calendar" "Calendar Route"
Test-Endpoint "/reconciliation" "Reconciliation Route"
Test-Endpoint "/settings" "Settings Route"
Test-Endpoint "/health" "Health Check Route"

# 5. Model Version Check
Write-Host ""
Write-Host "5. MODEL VERSION CHECK" -ForegroundColor Yellow
if ($html) {
    # Check the JS bundle for the model name
    if ($html -match 'src="/assets/(index-[^"]+\.js)"') {
        $jsUrl = "$baseUrl/assets/$($Matches[1])"
        $js = (Invoke-WebRequest -Uri $jsUrl -UseBasicParsing).Content
        if ($js -match "gemini-2\.0-flash") {
            Write-Host "  PASS: Model is gemini-2.0-flash" -ForegroundColor Green
            $passed++
        }
        elseif ($js -match "gemini-1\.5-flash") {
            Write-Host "  FAIL: Still using RETIRED gemini-1.5-flash!" -ForegroundColor Red
            $failed++
        }
        else {
            Write-Host "  WARN: Could not verify model version in bundle" -ForegroundColor DarkYellow
        }
    }
}

# 6. Firebase Config Check
Write-Host ""
Write-Host "6. FIREBASE CONFIG IN BUNDLE" -ForegroundColor Yellow
if ($js) {
    if ($js -match "window._env_" -or $js -match "_env_") {
        Write-Host "  PASS: Runtime env fallback code present" -ForegroundColor Green
        $passed++
    }
    else {
        Write-Host "  WARN: No runtime fallback detected in bundle" -ForegroundColor DarkYellow
    }
}

# Summary
Write-Host ""
Write-Host "=== RESULTS ===" -ForegroundColor Cyan
Write-Host "  Passed: $passed" -ForegroundColor Green
Write-Host "  Failed: $failed" -ForegroundColor $(if ($failed -gt 0) { "Red" } else { "Green" })
if ($failed -eq 0) {
    Write-Host "  ALL TESTS PASSED!" -ForegroundColor Green
}
else {
    Write-Host "  SOME TESTS FAILED - Review above." -ForegroundColor Red
}
