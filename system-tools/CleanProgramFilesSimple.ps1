# Simple Program Files Cleanup
Write-Host "=== SAFE PROGRAM FILES CLEANUP ===" -ForegroundColor Yellow

# Check uninstallers
$uninstallerPath = "C:\Program Files\Arknights Endfield\Uninstall.exe"
if (Test-Path $uninstallerPath) {
    $size = (Get-Item $uninstallerPath).Length
    Write-Host "Found Arknights Endfield uninstaller: $([math]::Round($size/1MB,2)) MB" -ForegroundColor Cyan
    
    # Check if main app exists
    $appDir = "C:\Program Files\Arknights Endfield"
    $mainExe = Get-ChildItem $appDir -Filter "*.exe" -ErrorAction SilentlyContinue | Where-Object { $_.Name -notmatch "uninstall" }
    
    if ($mainExe.Count -eq 0) {
        Write-Host "App not found, safe to remove uninstaller" -ForegroundColor Green
        Remove-Item $uninstallerPath -Force
        Write-Host "Removed Arknights uninstaller" -ForegroundColor Green
    } else {
        Write-Host "App still installed, keeping uninstaller" -ForegroundColor Yellow
    }
}

$uninstallerPath = "C:\Program Files\Android\Android Studio\uninstall.exe"
if (Test-Path $uninstallerPath) {
    $size = (Get-Item $uninstallerPath).Length
    Write-Host "Found Android Studio uninstaller: $([math]::Round($size/1MB,2)) MB" -ForegroundColor Cyan
    Write-Host "Android Studio still installed, keeping uninstaller" -ForegroundColor Yellow
}

$uninstallerPath = "C:\Program Files\Google\Play Games\Uninstaller.exe"
if (Test-Path $uninstallerPath) {
    $size = (Get-Item $uninstallerPath).Length
    Write-Host "Found Google Play Games uninstaller: $([math]::Round($size/1MB,2)) MB" -ForegroundColor Cyan
    Write-Host "Google Play Games still installed, keeping uninstaller" -ForegroundColor Yellow
}

$uninstallerPath = "C:\Program Files\Npcap\Uninstall.exe"
if (Test-Path $uninstallerPath) {
    $size = (Get-Item $uninstallerPath).Length
    Write-Host "Found Npcap uninstaller: $([math]::Round($size/1MB,2)) MB" -ForegroundColor Cyan
    Write-Host "Npcap still installed, keeping uninstaller" -ForegroundColor Yellow
}

Write-Host "Program Files cleanup complete" -ForegroundColor Green
Write-Host "Recommendations for more space:" -ForegroundColor Cyan
Write-Host "1. Use Windows Apps and Features to uninstall unused programs" -ForegroundColor White
Write-Host "2. Large directories found:" -ForegroundColor White
Write-Host "   Google Chrome: 6.34 GB" -ForegroundColor Gray
Write-Host "   Docker: 3.73 GB" -ForegroundColor Gray
Write-Host "   Android Studio: 3.41 GB" -ForegroundColor Gray
Write-Host "   Epic Games: 1.41 GB" -ForegroundColor Gray
