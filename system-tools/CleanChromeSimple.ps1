# Simple Chrome Cleanup
Write-Host "=== CHROME CACHE CLEANUP ===" -ForegroundColor Yellow

$chromePath = "C:\Users\Aomega Imaging\AppData\Local\Google\Chrome\User Data\Default"
$spaceRecovered = 0

$caches = @("Code Cache", "GPUCache", "Service Worker", "Shader Cache")

Write-Host "Cleaning Chrome caches..." -ForegroundColor White

foreach ($cacheName in $caches) {
    $cachePath = Join-Path $chromePath $cacheName
    if (Test-Path $cachePath) {
        try {
            $size = (Get-ChildItem $cachePath -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
            Write-Host "Removing $cacheName - $([math]::Round($size/1MB,2)) MB" -ForegroundColor Red
            Remove-Item $cachePath -Recurse -Force
            $spaceRecovered += $size
            Write-Host "Removed successfully" -ForegroundColor Green
        } catch {
            Write-Host "Could not remove $cacheName" -ForegroundColor Yellow
        }
    }
}

Write-Host "Chrome cleanup complete!" -ForegroundColor Green
Write-Host "Space recovered: $([math]::Round($spaceRecovered/1MB,2)) MB" -ForegroundColor Yellow
