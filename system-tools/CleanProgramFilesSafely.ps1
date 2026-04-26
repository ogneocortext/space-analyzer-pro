# Safe Program Files Cleanup - Uninstallers Only
Write-Host "=== SAFE PROGRAM FILES CLEANUP ===" -ForegroundColor Yellow
Write-Host "This will only remove uninstallers (23.89 MB) - very safe" -ForegroundColor Green
Write-Host "" -ForegroundColor White

# Found uninstallers from analysis
$uninstallers = @(
    @{
        Name = "Arknights Endfield Uninstaller"
        Path = "C:\Program Files\Arknights Endfield\Uninstall.exe"
        Size = 19.05
    },
    @{
        Name = "Android Studio Uninstaller"
        Path = "C:\Program Files\Android\Android Studio\uninstall.exe"
        Size = 2.25
    },
    @{
        Name = "Google Play Games Uninstaller"
        Path = "C:\Program Files\Google\Play Games\Uninstaller.exe"
        Size = 1.57
    },
    @{
        Name = "Npcap Uninstaller"
        Path = "C:\Program Files\Npcap\Uninstall.exe"
        Size = 1.02
    }
)

$totalSpace = 0
Write-Host "Found uninstallers to review:" -ForegroundColor Cyan

foreach ($uninstaller in $uninstallers) {
    if (Test-Path $uninstaller.Path) {
        Write-Host "" -ForegroundColor White
        Write-Host "Application: $($uninstaller.Name)" -ForegroundColor Yellow
        Write-Host "Size: $($uninstaller.Size) MB" -ForegroundColor White
        Write-Host "Path: $($uninstaller.Path)" -ForegroundColor Gray
        
        # Check if the application is still installed
        $appDir = Split-Path $uninstaller.Path -Parent
        $hasMainExe = $false
        
        # Look for main executable
        $mainExes = Get-ChildItem $appDir -Filter "*.exe" -ErrorAction SilentlyContinue | Where-Object { $_.Name -notmatch "uninstall|setup|install" }
        if ($mainExes.Count -gt 0) {
            $hasMainExe = $true
            Write-Host "Status: Application still installed" -ForegroundColor Red
            Write-Host "Recommendation: Keep uninstaller for proper removal" -ForegroundColor Yellow
        } else {
            Write-Host "Status: Application appears to be removed" -ForegroundColor Green
            Write-Host "Recommendation: Safe to remove uninstaller" -ForegroundColor Green
            
            $confirm = Read-Host "Remove this uninstaller? (y/n)"
            if ($confirm -eq "y" -or $confirm -eq "Y") {
                Write-Host "Removing: $($uninstaller.Path)" -ForegroundColor Red
                Remove-Item $uninstaller.Path -Force
                Write-Host "✓ Removed successfully" -ForegroundColor Green
                $totalSpace += $uninstaller.Size
            } else {
                Write-Host "✗ Kept" -ForegroundColor Yellow
            }
        }
    } else {
        Write-Host "Not found: $($uninstaller.Path)" -ForegroundColor Gray
    }
}

Write-Host "" -ForegroundColor White
Write-Host "=== CLEANUP SUMMARY ===" -ForegroundColor Yellow
Write-Host "Space recovered: $totalSpace MB" -ForegroundColor Green

if ($totalSpace -gt 0) {
    Write-Host "Uninstaller cleanup complete!" -ForegroundColor Green
} else {
    Write-Host "No uninstallers were removed." -ForegroundColor Yellow
}

Write-Host "" -ForegroundColor White
Write-Host "=== ADDITIONAL RECOMMENDATIONS ===" -ForegroundColor Cyan
Write-Host "For more space from Program Files:" -ForegroundColor White
Write-Host "1. Use Windows Apps & Features to uninstall unused applications" -ForegroundColor Yellow
Write-Host "2. Review large directories:" -ForegroundColor White
Write-Host "   - Google Chrome (6.34 GB)" -ForegroundColor Gray
Write-Host "   - Docker (3.73 GB) - if not used" -ForegroundColor Gray
Write-Host "   - Android Studio (3.41 GB) - if not developing" -ForegroundColor Gray
Write-Host "   - Epic Games (1.41 GB) - if not gaming" -ForegroundColor Gray
Write-Host "3. Clean Docker unused images and containers" -ForegroundColor Yellow
Write-Host "4. Remove unused Android SDK components" -ForegroundColor Yellow

Write-Host "" -ForegroundColor White
Write-Host "Program Files cleanup complete!" -ForegroundColor Green
