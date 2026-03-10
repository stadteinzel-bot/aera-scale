# test_firestore.ps1 - Firestore Data Persistence Test
# Tests: Write -> Read -> Verify -> Delete (full CRUD cycle)
$ErrorActionPreference = "Stop"

$projectId = "aera-scale"
$token = gcloud auth print-access-token 2>$null
$baseUrl = "https://firestore.googleapis.com/v1/projects/$projectId/databases/(default)/documents"
$headers = @{Authorization = "Bearer $token"; "Content-Type" = "application/json" }
$passed = 0
$failed = 0

function Write-Result($label, $success, $detail) {
    if ($success) {
        Write-Host "  PASS: $label" -ForegroundColor Green
        if ($detail) { Write-Host "        $detail" -ForegroundColor Gray }
        $script:passed++
    }
    else {
        Write-Host "  FAIL: $label" -ForegroundColor Red
        if ($detail) { Write-Host "        $detail" -ForegroundColor Gray }
        $script:failed++
    }
}

Write-Host "=== FIRESTORE DATA PERSISTENCE TEST ===" -ForegroundColor Cyan
Write-Host ""

# --- TEST 1: Write a Property ---
Write-Host "1. WRITE TEST (Create Property)" -ForegroundColor Yellow
$testProperty = @{
    fields = @{
        name      = @{ stringValue = "TEST - Checkpoint Tower" }
        address   = @{ stringValue = "Checkpoint Charlie, Berlin" }
        type      = @{ stringValue = "Commercial" }
        units     = @{ integerValue = "12" }
        occupancy = @{ integerValue = "85" }
        revenue   = @{ integerValue = "45000" }
    }
} | ConvertTo-Json -Depth 4

try {
    $createResult = Invoke-RestMethod -Uri "$baseUrl/properties" -Method Post -Headers $headers -Body $testProperty
    $docName = $createResult.name
    $docId = $docName.Split("/")[-1]
    Write-Result "Created property" $true "ID: $docId"
}
catch {
    Write-Result "Create property" $false $_.Exception.Message
    $docId = $null
}

# --- TEST 2: Read it back ---
Write-Host ""
Write-Host "2. READ TEST (Retrieve Property)" -ForegroundColor Yellow
if ($docId) {
    try {
        $readResult = Invoke-RestMethod -Uri "$baseUrl/properties/$docId" -Method Get -Headers $headers
        $readName = $readResult.fields.name.stringValue
        $readAddr = $readResult.fields.address.stringValue
        Write-Result "Read property" ($readName -eq "TEST - Checkpoint Tower") "Name: $readName, Address: $readAddr"
    }
    catch {
        Write-Result "Read property" $false $_.Exception.Message
    }
}

# --- TEST 3: Read existing properties ---
Write-Host ""
Write-Host "3. LIST TEST (All Properties)" -ForegroundColor Yellow
try {
    $listResult = Invoke-RestMethod -Uri "$baseUrl/properties" -Method Get -Headers $headers
    $count = 0
    if ($listResult.documents) { $count = $listResult.documents.Count }
    Write-Result "List properties" ($count -gt 0) "Found $count properties in Firestore"
    
    foreach ($doc in $listResult.documents) {
        $n = $doc.fields.name.stringValue
        $a = $doc.fields.address.stringValue
        Write-Host "        - $n ($a)" -ForegroundColor Gray
    }
}
catch {
    Write-Result "List properties" $false $_.Exception.Message
}

# --- TEST 4: Read Tenants ---
Write-Host ""
Write-Host "4. TENANTS COLLECTION" -ForegroundColor Yellow
try {
    $tenantsResult = Invoke-RestMethod -Uri "$baseUrl/tenants" -Method Get -Headers $headers
    $tCount = 0
    if ($tenantsResult.documents) { $tCount = $tenantsResult.documents.Count }
    Write-Result "List tenants" $true "Found $tCount tenants"
}
catch {
    Write-Result "List tenants" $false $_.Exception.Message
}

# --- TEST 5: Read Tickets ---
Write-Host ""
Write-Host "5. TICKETS COLLECTION" -ForegroundColor Yellow
try {
    $ticketsResult = Invoke-RestMethod -Uri "$baseUrl/tickets" -Method Get -Headers $headers
    $tkCount = 0
    if ($ticketsResult.documents) { $tkCount = $ticketsResult.documents.Count }
    Write-Result "List tickets" $true "Found $tkCount tickets"
}
catch {
    Write-Result "List tickets" $false $_.Exception.Message
}

# --- TEST 6: Delete test property (cleanup) ---
Write-Host ""
Write-Host "6. DELETE TEST (Cleanup)" -ForegroundColor Yellow
if ($docId) {
    try {
        Invoke-RestMethod -Uri "$baseUrl/properties/$docId" -Method Delete -Headers $headers | Out-Null
        Write-Result "Delete test property" $true "Cleaned up: $docId"
    }
    catch {
        Write-Result "Delete test property" $false $_.Exception.Message
    }
    
    # Verify deletion
    try {
        Invoke-RestMethod -Uri "$baseUrl/properties/$docId" -Method Get -Headers $headers | Out-Null
        Write-Result "Verify deletion" $false "Document still exists!"
    }
    catch {
        Write-Result "Verify deletion" $true "Document confirmed deleted"
    }
}

# --- SUMMARY ---
Write-Host ""
Write-Host "=== RESULTS ===" -ForegroundColor Cyan
Write-Host "  Passed: $passed" -ForegroundColor Green
Write-Host "  Failed: $failed" -ForegroundColor $(if ($failed -gt 0) { "Red" } else { "Green" })
if ($failed -eq 0) {
    Write-Host "  ALL DATA TESTS PASSED!" -ForegroundColor Green
}
else {
    Write-Host "  SOME TESTS FAILED" -ForegroundColor Red
}
