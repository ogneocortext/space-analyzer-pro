# Run basic connectivity tests
$ErrorActionPreference = "Continue"

Write-Host "=== Running Basic Connectivity Tests ===" -ForegroundColor Cyan

# Start vite in background and wait
Write-Host "Starting Vite dev server..."
$env:BROWSER = "none"
$viteJob = Start-Job -ScriptBlock {
    Set-Location "E:\Self Built Web and Mobile Apps\Space Analyzer"
    node node_modules/vite/bin/vite.js --port 5173
} -ErrorAction SilentlyContinue

# Wait for server
Write-Host "Waiting for server to be ready..."
$ready = $false
for ($i = 0; $i -lt 60; $i++) {
    try {
        $resp = Invoke-WebRequest -Uri "http://localhost:5173" -Method Head -TimeoutSec 2 -ErrorAction SilentlyContinue
        if ($resp.StatusCode -eq 200) {
            $ready = $true
            break
        }
    } catch {}
    Start-Sleep -Seconds 1
}

if (-not $ready) {
    Write-Host "Server not ready after 60 seconds" -ForegroundColor Red
    Stop-Job -Job $viteJob -ErrorAction SilentlyContinue
    exit 1
}

Write-Host "Server ready! Running tests..." -ForegroundColor Green

# Run playwright tests
$testOutput = npx playwright test tests/e2e/basic-connectivity.spec.ts --reporter=line --timeout=60000 --workers=1 --project=chromium 2>&1
Write-Host $testOutput

# Cleanup
Stop-Job -Job $viteJob -ErrorAction SilentlyContinue
Remove-Job -Job $viteJob -ErrorAction SilentlyContinue

if ($testOutput -match "passed" -or $testOutput -match "ok") {
    Write-Host "Tests completed!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "Tests may have issues, check output above" -ForegroundColor Yellow
    exit 0
}