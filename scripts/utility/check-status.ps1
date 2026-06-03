# Check node processes
Write-Host "=== Node Processes ===" -ForegroundColor Cyan
Get-Process -Name node -ErrorAction SilentlyContinue | Select-Object Id,ProcessName,CPU,WorkingSet | Format-Table -AutoSize

# Check port 5173
Write-Host "`n=== Port 5173 Status ===" -ForegroundColor Cyan
$connections = Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue
if ($connections) {
    $connections | Format-Table LocalAddress,LocalPort,RemoteAddress,State,OwningProcess -AutoSize
} else {
    Write-Host "No connections found for port 5173" -ForegroundColor Yellow
}

# Test connectivity
Write-Host "`n=== Connectivity Test ===" -ForegroundColor Cyan
try {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:5173/" -Method Head -TimeoutSec 5 -ErrorAction Stop
    Write-Host "Frontend: OK - Status $($response.StatusCode)" -ForegroundColor Green
} catch {
    Write-Host "Frontend: Failed - $($_.Exception.Message)" -ForegroundColor Red
}