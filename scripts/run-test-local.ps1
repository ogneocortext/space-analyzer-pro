# Test runner script
$ErrorActionPreference = "Stop"

Write-Host "=== Space Analyzer Test Runner ===" -ForegroundColor Cyan

# Kill any existing vite/node processes on ports
Write-Host "Cleaning up existing processes..." -ForegroundColor Yellow
Get-NetTCPConnection -LocalPort 5173,8080 -ErrorAction SilentlyContinue | ForEach-Object {
    try {
        Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
        Write-Host "  Killed process $($_.OwningProcess)" -ForegroundColor Gray
    } catch {}
}
Start-Sleep -Seconds 2

# Start vite dev server
Write-Host "Starting Vite dev server..." -ForegroundColor Yellow
$viteProcess = Start-Process -FilePath "node" -ArgumentList "node_modules/vite/bin/vite.js" -WorkingDirectory (Get-Location) -NoNewWindow -PassThru -RedirectStandardOutput "test-results/vite-stdout.log" -RedirectStandardError "test-results/vite-stderr.log"

# Wait for vite to start
Write-Host "Waiting for Vite to be ready..." -ForegroundColor Yellow
$attempts = 0
$maxAttempts = 30
while ($attempts -lt $maxAttempts) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:5173" -Method Head -TimeoutSec 2 -ErrorAction SilentlyContinue
        if ($response.StatusCode -eq 200) {
            Write-Host "Vite is ready!" -ForegroundColor Green
            break
        }
    } catch {}
    Start-Sleep -Seconds 1
    $attempts++
    Write-Host "  Attempt $attempts/$maxAttempts..." -ForegroundColor Gray
}

if ($attempts -ge $maxAttempts) {
    Write-Host "Vite failed to start. Check logs." -ForegroundColor Red
    exit 1
}

# Run Playwright tests
Write-Host "Running Playwright tests..." -ForegroundColor Yellow
$testResult = & npx playwright test tests/e2e/basic-connectivity.spec.ts --reporter=line --timeout=60000 --workers=1 --project=chromium

exit $LASTEXITCODE