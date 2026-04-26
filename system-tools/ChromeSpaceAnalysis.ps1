# Chrome Space Analysis - Simplified
Write-Host "=== CHROME SPACE ANALYSIS ===" -ForegroundColor Yellow

# Analyze Chrome user data
$chromePath = "C:\Users\Aomega Imaging\AppData\Local\Google\Chrome"
if (Test-Path $chromePath) {
    Write-Host "Analyzing Chrome installation..." -ForegroundColor White
    
    # Get main directories
    $dirs = Get-ChildItem $chromePath -Directory -ErrorAction SilentlyContinue
    foreach ($dir in $dirs) {
        try {
            $size = (Get-ChildItem $dir.FullName -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
            if ($size -gt 100MB) {
                Write-Host "$($dir.Name): $([math]::Round($size/1MB,2)) MB" -ForegroundColor Cyan
            }
        } catch {
            Write-Host "Cannot access: $($dir.Name)" -ForegroundColor Yellow
        }
    }
}

# Analyze User Data specifically
$userDataPath = "C:\Users\Aomega Imaging\AppData\Local\Google\Chrome\User Data"
if (Test-Path $userDataPath) {
    Write-Host "`nAnalyzing Chrome User Data..." -ForegroundColor White
    
    # Check Default profile
    $defaultProfile = Join-Path $userDataPath "Default"
    if (Test-Path $defaultProfile) {
        Write-Host "Default Profile:" -ForegroundColor Cyan
        
        # Check cache directories
        $cacheDirs = @("Cache", "Code Cache", "GPUCache", "Service Worker")
        foreach ($cacheDir in $cacheDirs) {
            $cachePath = Join-Path $defaultProfile $cacheDir
            if (Test-Path $cachePath) {
                try {
                    $size = (Get-ChildItem $cachePath -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
                    Write-Host "  $cacheDir`: $([math]::Round($size/1MB,2)) MB" -ForegroundColor White
                } catch {
                    Write-Host "  $cacheDir`: Cannot access" -ForegroundColor Yellow
                }
            }
        }
        
        # Check for large files
        Write-Host "  Large files:" -ForegroundColor Yellow
        Get-ChildItem $defaultProfile -File -Recurse -ErrorAction SilentlyContinue | 
            Where-Object { $_.Length -gt 50MB } | 
            Sort-Object Length -Descending | 
            Select-Object -First 5 | 
            ForEach-Object {
                Write-Host "    $($_.Name): $([math]::Round($_.Length/1MB,2)) MB" -ForegroundColor Gray
            }
    }
    
    # Check other profiles
    $profiles = Get-ChildItem $userDataPath -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -match "Profile \d+" }
    foreach ($profile in $profiles) {
        try {
            $size = (Get-ChildItem $profile.FullName -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
            if ($size -gt 100MB) {
                Write-Host "$($profile.Name): $([math]::Round($size/1MB,2)) MB" -ForegroundColor Cyan
            }
        } catch {
            Write-Host "Cannot access: $($profile.Name)" -ForegroundColor Yellow
        }
    }
}

# Check Chrome installation
$chromeInstall = "C:\Program Files\Google\Chrome\Application"
if (Test-Path $chromeInstall) {
    Write-Host "`nChrome Installation:" -ForegroundColor Cyan
    $versionDirs = Get-ChildItem $chromeInstall -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -match "^\d+\.\d+\.\d+\.\d+" }
    if ($versionDirs.Count -gt 1) {
        Write-Host "Multiple Chrome versions found:" -ForegroundColor Yellow
        foreach ($version in $versionDirs) {
            try {
                $size = (Get-ChildItem $version.FullName -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
                Write-Host "  $($version.Name): $([math]::Round($size/1MB,2)) MB" -ForegroundColor White
            } catch {
                Write-Host "  $($version.Name): Cannot access" -ForegroundColor Yellow
            }
        }
    } else {
        Write-Host "Single Chrome version installed" -ForegroundColor Green
    }
}

Write-Host "`n=== CHROME CLEANUP RECOMMENDATIONS ===" -ForegroundColor Green
Write-Host "1. Clear Chrome cache: Settings > Privacy > Clear browsing data" -ForegroundColor White
Write-Host "2. Remove unused Chrome profiles" -ForegroundColor White
Write-Host "3. Uninstall unused Chrome extensions" -ForegroundColor White
Write-Host "4. Use Chrome Storage Manager for site data" -ForegroundColor White

Write-Host "`nChrome analysis complete!" -ForegroundColor Green
