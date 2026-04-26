# Analyze Chrome Space Usage
Write-Host "=== CHROME SPACE ANALYSIS ===" -ForegroundColor Yellow

# Find Chrome installation directories
$chromePaths = @(
    "C:\Program Files\Google\Chrome\Application",
    "C:\Program Files (x86)\Google\Chrome\Application",
    "C:\Users\Aomega Imaging\AppData\Local\Google\Chrome"
)

$totalChromeSize = 0
$chromeAnalysis = @()

foreach ($basePath in $chromePaths) {
    if (Test-Path $basePath) {
        Write-Host "Analyzing: $basePath" -ForegroundColor Cyan
        
        try {
            # Get all subdirectories and their sizes
            $dirs = Get-ChildItem $basePath -Directory -ErrorAction SilentlyContinue
            foreach ($dir in $dirs) {
                try {
                    $size = (Get-ChildItem $dir.FullName -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
                    $totalChromeSize += $size
                    
                    $chromeAnalysis += [PSCustomObject]@{
                        Path = $dir.FullName
                        Name = $dir.Name
                        Size = $size
                        SizeMB = [math]::Round($size/1MB,2)
                        SizeGB = [math]::Round($size/1GB,2)
                    }
                    
                    if ($size -gt 100MB) {
                        Write-Host "  $($dir.Name): $($dir.SizeGB) GB ($($dir.SizeMB) MB)" -ForegroundColor White
                    }
                } catch {
                    Write-Host "  Cannot access: $($dir.Name)" -ForegroundColor Yellow
                }
            }
        } catch {
            Write-Host "Cannot analyze: $basePath" -ForegroundColor Red
        }
    }
}

Write-Host "`n=== CHROME SPACE BREAKDOWN ===" -ForegroundColor Yellow
Write-Host "Total Chrome size: $([math]::Round($totalChromeSize/1GB,2)) GB" -ForegroundColor Green

# Sort by size and show top consumers
$topConsumers = $chromeAnalysis | Sort-Object Size -Descending | Select-Object -First 15
Write-Host "`nTop space consumers:" -ForegroundColor Cyan
foreach ($item in $topConsumers) {
    $percentage = [math]::Round(($item.Size / $totalChromeSize) * 100, 1)
    Write-Host "  $($item.Name): $($item.SizeGB) GB ($($item.SizeMB) MB) - $percentage%" -ForegroundColor White
}

# Analyze specific Chrome user data directories
Write-Host "`n=== CHROME USER DATA ANALYSIS ===" -ForegroundColor Yellow
$userDataPath = "C:\Users\Aomega Imaging\AppData\Local\Google\Chrome\User Data"
if (Test-Path $userDataPath) {
    Write-Host "Analyzing user data..." -ForegroundColor White
    
    $userDataDirs = @("Default", "Profile 1", "Profile 2", "Guest Profile")
    foreach $profile in $userDataDirs) {
        $profilePath = Join-Path $userDataPath $profile
        if (Test-Path $profilePath) {
            Write-Host "`nProfile: $profile" -ForegroundColor Cyan
            
            # Analyze key Chrome directories
            $chromeDirs = @(
                "Cache",
                "Code Cache",
                "GPUCache",
                "Service Worker",
                "IndexedDB",
                "Local Storage",
                "Session Storage",
                "Extensions",
                "Application Cache",
                "File System",
                "QuotaManager"
            )
            
            foreach ($dirName in $chromeDirs) {
                $dirPath = Join-Path $profilePath $dirName
                if (Test-Path $dirPath) {
                    try {
                        $size = (Get-ChildItem $dirPath -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
                        if ($size -gt 50MB) {
                            Write-Host "  $dirName`: $([math]::Round($size/1MB,2)) MB" -ForegroundColor White
                        }
                    } catch {
                        Write-Host "  $dirName`: Cannot access" -ForegroundColor Yellow
                    }
                }
            }
            
            # Check for large files in profile
            Write-Host "  Large files in profile:" -ForegroundColor Yellow
            Get-ChildItem $profilePath -File -Recurse -ErrorAction SilentlyContinue | 
                Where-Object { $_.Length -gt 50MB } | 
                Sort-Object Length -Descending | 
                Select-Object -First 5 | 
                ForEach-Object {
                    Write-Host "    $($_.Name): $([math]::Round($_.Length/1MB,2)) MB" -ForegroundColor Gray
                }
        }
    }
}

# Look for Chrome installation files
Write-Host "`n=== CHROME INSTALLATION FILES ===" -ForegroundColor Yellow
$chromeInstallPaths = @(
    "C:\Program Files\Google\Chrome\Application",
    "C:\Program Files (x86)\Google\Chrome\Application"
)

foreach $installPath in $chromeInstallPaths) {
    if (Test-Path $installPath) {
        Write-Host "Installation directory: $installPath" -ForegroundColor Cyan
        
        # Look for old Chrome versions
        $versionDirs = Get-ChildItem $installPath -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -match "^\d+\.\d+\.\d+\.\d+" }
        if ($versionDirs.Count -gt 1) {
            Write-Host "  Multiple Chrome versions found:" -ForegroundColor Yellow
            foreach ($version in $versionDirs) {
                $size = (Get-ChildItem $version.FullName -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
                Write-Host "    $($version.Name): $([math]::Round($size/1MB,2)) MB" -ForegroundColor White
            }
        }
    }
}

Write-Host "`n=== CLEANUP RECOMMENDATIONS ===" -ForegroundColor Green
Write-Host "1. Use Chrome's built-in cleanup tool:" -ForegroundColor White
Write-Host "   Settings > Privacy and security > Clear browsing data" -ForegroundColor Gray
Write-Host "2. Remove old Chrome versions (if found)" -ForegroundColor White
Write-Host "3. Clear cache and browsing data for unused profiles" -ForegroundColor White
Write-Host "4. Remove unused extensions" -ForegroundColor White
Write-Host "5. Use Chrome's Storage settings to manage site data" -ForegroundColor White

Write-Host "`nAnalysis complete!" -ForegroundColor Green
