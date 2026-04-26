# Safe Chrome Cleanup
Write-Host "=== SAFE CHROME CLEANUP ===" -ForegroundColor Yellow
Write-Host "This will clean Chrome caches safely" -ForegroundColor Green

# Close Chrome first
Write-Host "Checking if Chrome is running..." -ForegroundColor White
$chromeProcesses = Get-Process "chrome" -ErrorAction SilentlyContinue
if ($chromeProcesses) {
    Write-Host "Chrome is running. Please close Chrome and press Enter to continue..." -ForegroundColor Yellow
    Read-Host
}

# Clean Chrome caches
$chromePath = "C:\Users\Aomega Imaging\AppData\Local\Google\Chrome\User Data\Default"
$spaceRecovered = 0

$cachesToClean = @(
    "Cache",
    "Code Cache", 
    "GPUCache",
    "Service Worker",
    "Shader Cache"
)

Write-Host "Cleaning Chrome caches..." -ForegroundColor White
foreach ($cacheName in $cachesToClean) {
    $cachePath = Join-Path $chromePath $cacheName
    if (Test-Path $cachePath) {
        try {
            $size = (Get-ChildItem $cachePath -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
            Write-Host "Removing $cacheName`: $([math]::Round($size/1MB,2)) MB" -ForegroundColor Red
            Remove-Item $cachePath -Recurse -Force
            $spaceRecovered += $size
            Write-Host "  ✓ Removed successfully" -ForegroundColor Green
        } catch {
            Write-Host "Could not remove $cacheName" -ForegroundColor Yellow
        }
    }
}

# Clean other Chrome profiles
$otherProfiles = Get-ChildItem "C:\Users\Aomega Imaging\AppData\Local\Google\Chrome\User Data" -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -match "Profile \d+" }
foreach ($profile in $otherProfiles) {
    Write-Host "Cleaning profile: $($profile.Name)" -ForegroundColor Cyan
    foreach ($cacheName in $cachesToClean) {
        $cachePath = Join-Path $profile.FullName $cacheName
        if (Test-Path $cachePath) {
            try {
                $size = (Get-ChildItem $cachePath -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
                if ($size -gt 10MB) {
                    Write-Host "  Removing $cacheName`: $([math]::Round($size/1MB,2)) MB" -ForegroundColor Red
                    Remove-Item $cachePath -Recurse -Force
                    $spaceRecovered += $size
                }
            } catch {
                Write-Host "  Could not remove $cacheName" -ForegroundColor Yellow
            }
        }
    }
}

Write-Host "`nChrome cleanup complete!" -ForegroundColor Green
Write-Host "Space recovered: $([math]::Round($spaceRecovered/1MB,2)) MB" -ForegroundColor Yellow

Write-Host "`nAdditional Chrome optimization tips:" -ForegroundColor Cyan
Write-Host "1. Open Chrome Settings > Privacy > Clear browsing data" -ForegroundColor White
Write-Host "2. Check Extensions and remove unused ones" -ForegroundColor White
Write-Host "3. Use Chrome Storage Manager (chrome://settings/siteData)" -ForegroundColor White
Write-Host "4. Clear Downloads folder if needed" -ForegroundColor White
