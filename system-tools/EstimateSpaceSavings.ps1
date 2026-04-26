# Estimate Potential Space Savings
Write-Host "=== SPACE SAVINGS ESTIMATE ===" -ForegroundColor Yellow

# 1. Check for unused Python virtual environments
Write-Host "1. PYTHON VIRTUAL ENVIRONMENTS:" -ForegroundColor Cyan
$venvDirs = Get-ChildItem -Path "C:\Users\Aomega Imaging" -Name "venv" -Recurse -ErrorAction SilentlyContinue | ForEach-Object { Join-Path "C:\Users\Aomega Imaging" $_ }
$venvSize = 0
foreach ($dir in $venvDirs) {
    if (Test-Path $dir) {
        $size = (Get-ChildItem $dir -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
        $venvSize += $size
        Write-Host "  Found: $dir - $([math]::Round($size/1MB,2)) MB"
    }
}
Write-Host "  Total Python venv size: $([math]::Round($venvSize/1MB,2)) MB" -ForegroundColor Green

# 2. Check for development build artifacts
Write-Host "`n2. DEVELOPMENT BUILD ARTIFACTS:" -ForegroundColor Cyan
$buildDirs = Get-ChildItem -Path "C:\Users\Aomega Imaging" -Include "build","dist","target","bin","obj" -Recurse -ErrorAction SilentlyContinue | Where-Object { $_.PSIsContainer }
$buildSize = 0
foreach ($dir in $buildDirs) {
    $size = (Get-ChildItem $dir.FullName -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
    $buildSize += $size
    if ($size -gt 10MB) {
        Write-Host "  Found: $($dir.FullName) - $([math]::Round($size/1MB,2)) MB"
    }
}
Write-Host "  Total build artifacts size: $([math]::Round($buildSize/1MB,2)) MB" -ForegroundColor Green

# 3. Check for old application installers
Write-Host "`n3. APPLICATION INSTALLERS:" -ForegroundColor Cyan
$installerFiles = Get-ChildItem -Path "C:\Users\Aomega Imaging" -Include "*.exe","*.msi" -Recurse -ErrorAction SilentlyContinue | Where-Object { $_.Length -gt 50MB }
$installerSize = 0
foreach ($file in $installerFiles) {
    $installerSize += $file.Length
    Write-Host "  Found: $($file.FullName) - $([math]::Round($file.Length/1MB,2)) MB"
}
Write-Host "  Total installer size: $([math]::Round($installerSize/1MB,2)) MB" -ForegroundColor Green

# 4. Check for browser caches
Write-Host "`n4. BROWSER CACHES:" -ForegroundColor Cyan
$cacheDirs = @(
    "C:\Users\Aomega Imaging\AppData\Local\Google\Chrome\User Data\Default\Cache",
    "C:\Users\Aomega Imaging\AppData\Local\Mozilla\Firefox\Profiles",
    "C:\Users\Aomega Imaging\AppData\Local\Microsoft\Edge\User Data\Default\Cache"
)
$cacheSize = 0
foreach ($dir in $cacheDirs) {
    if (Test-Path $dir) {
        $size = (Get-ChildItem $dir -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
        $cacheSize += $size
        Write-Host "  Found: $dir - $([math]::Round($size/1MB,2)) MB"
    }
}
Write-Host "  Total cache size: $([math]::Round($cacheSize/1MB,2)) MB" -ForegroundColor Green

# 5. Check for temp files
Write-Host "`n5. TEMPORARY FILES:" -ForegroundColor Cyan
$tempDirs = @("C:\Users\Aomega Imaging\AppData\Local\Temp", "C:\Users\Aomega Imaging\AppData\Local\Microsoft\Windows\INetCache")
$tempSize = 0
foreach ($dir in $tempDirs) {
    if (Test-Path $dir) {
        $size = (Get-ChildItem $dir -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
        $tempSize += $size
        Write-Host "  Found: $dir - $([math]::Round($size/1MB,2)) MB"
    }
}
Write-Host "  Total temp size: $([math]::Round($tempSize/1MB,2)) MB" -ForegroundColor Green

$totalPotential = $venvSize + $buildSize + $installerSize + $cacheSize + $tempSize
Write-Host "`n=== ESTIMATED TOTAL SPACE RECOVERY ===" -ForegroundColor Yellow
Write-Host "Python Virtual Environments: $([math]::Round($venvSize/1MB,2)) MB" -ForegroundColor White
Write-Host "Development Build Artifacts: $([math]::Round($buildSize/1MB,2)) MB" -ForegroundColor White
Write-Host "Application Installers: $([math]::Round($installerSize/1MB,2)) MB" -ForegroundColor White
Write-Host "Browser Caches: $([math]::Round($cacheSize/1MB,2)) MB" -ForegroundColor White
Write-Host "Temporary Files: $([math]::Round($tempSize/1MB,2)) MB" -ForegroundColor White
Write-Host "" -ForegroundColor White
$totalMB = [math]::Round($totalPotential/1MB,2)
$totalGB = [math]::Round($totalPotential/1GB,2)
Write-Host "TOTAL POTENTIAL RECOVERY: $totalMB MB ($totalGB GB)" -ForegroundColor Green

Write-Host "`n=== RECOMMENDATION PRIORITY ===" -ForegroundColor Yellow
Write-Host "1. Application Installers (Safest - can be re-downloaded)" -ForegroundColor Green
Write-Host "2. Temporary Files (Safe - auto-regenerated)" -ForegroundColor Green
Write-Host "3. Browser Caches (Safe - auto-regenerated)" -ForegroundColor Green
Write-Host "4. Development Build Artifacts (Medium - may need rebuild)" -ForegroundColor Yellow
Write-Host "5. Python Virtual Environments (Review - check if still needed)" -ForegroundColor Yellow
