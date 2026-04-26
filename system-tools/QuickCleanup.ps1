# Quick Additional Cleanup
Write-Host "Starting additional cleanup..." -ForegroundColor Yellow

# Clean Rust targets
Write-Host "Cleaning Rust build artifacts..." -ForegroundColor White
$rustDirs = Get-ChildItem -Path "C:\Users\Aomega Imaging" -Name "target" -Recurse -ErrorAction SilentlyContinue
$rustSpace = 0
foreach ($dir in $rustDirs) {
    $fullPath = Join-Path "C:\Users\Aomega Imaging" $dir
    if (Test-Path $fullPath) {
        $debugPath = Join-Path $fullPath "debug"
        if (Test-Path $debugPath) {
            $size = (Get-ChildItem $debugPath -Recurse | Measure-Object -Property Length -Sum).Sum
            Write-Host "Removing: $debugPath ($([math]::Round($size/1MB,2)) MB)" -ForegroundColor Red
            Remove-Item $debugPath -Recurse -Force
            $rustSpace += $size
        }
    }
}
Write-Host "Rust cleanup: $([math]::Round($rustSpace/1MB,2)) MB" -ForegroundColor Green

# Clean Node.js caches
Write-Host "Cleaning Node.js caches..." -ForegroundColor White
$nodeDirs = @("C:\Users\Aomega Imaging\AppData\Local\npm-cache", "C:\Users\Aomega Imaging\.npm")
$nodeSpace = 0
foreach ($dir in $nodeDirs) {
    if (Test-Path $dir) {
        $size = (Get-ChildItem $dir -Recurse | Measure-Object -Property Length -Sum).Sum
        Write-Host "Removing: $dir ($([math]::Round($size/1MB,2)) MB)" -ForegroundColor Red
        Remove-Item $dir -Recurse -Force
        $nodeSpace += $size
    }
}
Write-Host "Node.js cleanup: $([math]::Round($nodeSpace/1MB,2)) MB" -ForegroundColor Green

# Clean mobile builds
Write-Host "Cleaning mobile app builds..." -ForegroundColor White
$mobileDirs = @(
    "C:\Users\Aomega Imaging\source\repos\Mobile Crypto Earnings Tracker\Mobile Crypto Earnings Tracker\bin",
    "C:\Users\Aomega Imaging\source\repos\Mobile Crypto Earnings Tracker\Mobile Crypto Earnings Tracker\obj"
)
$mobileSpace = 0
foreach ($dir in $mobileDirs) {
    if (Test-Path $dir) {
        $size = (Get-ChildItem $dir -Recurse | Measure-Object -Property Length -Sum).Sum
        Write-Host "Removing: $dir ($([math]::Round($size/1MB,2)) MB)" -ForegroundColor Red
        Remove-Item $dir -Recurse -Force
        $mobileSpace += $size
    }
}
Write-Host "Mobile cleanup: $([math]::Round($mobileSpace/1MB,2)) MB" -ForegroundColor Green

# Clean old Python venvs
Write-Host "Cleaning old Python virtual environments..." -ForegroundColor White
$venvDirs = Get-ChildItem -Path "C:\Users\Aomega Imaging" -Name "venv" -Recurse -ErrorAction SilentlyContinue
$venvSpace = 0
foreach ($dir in $venvDirs) {
    $fullPath = Join-Path "C:\Users\Aomega Imaging" $dir
    if (Test-Path $fullPath) {
        $daysOld = (New-TimeSpan (Get-Item $fullPath).LastWriteTime (Get-Date)).Days
        if ($daysOld -gt 90) {
            $size = (Get-ChildItem $fullPath -Recurse | Measure-Object -Property Length -Sum).Sum
            Write-Host "Removing old venv: $fullPath ($([math]::Round($size/1MB,2)) MB)" -ForegroundColor Red
            Remove-Item $fullPath -Recurse -Force
            $venvSpace += $size
        }
    }
}
Write-Host "Python cleanup: $([math]::Round($venvSpace/1MB,2)) MB" -ForegroundColor Green

# Summary
$totalSpace = $rustSpace + $nodeSpace + $mobileSpace + $venvSpace
Write-Host "Additional cleanup complete!" -ForegroundColor Green
Write-Host "Total space recovered: $([math]::Round($totalSpace/1MB,2)) MB" -ForegroundColor Yellow
