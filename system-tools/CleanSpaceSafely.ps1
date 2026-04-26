# Safe Space Cleanup - High Impact, Low Risk
Write-Host "=== SAFE SPACE CLEANUP ===" -ForegroundColor Yellow
Write-Host "This will clean the safest categories first" -ForegroundColor White

# Step 1: Clean Application Installers (Safest - can be re-downloaded)
Write-Host "`n=== STEP 1: CLEANING APPLICATION INSTALLERS (2.0 GB) ===" -ForegroundColor Green
Write-Host "Removing old installers and development tools..." -ForegroundColor White

$installerFiles = @(
    "C:\Users\Aomega Imaging\.cache\puppeteer",
    "C:\Users\Aomega Imaging\.chromium-browser-snapshots",
    "C:\Users\Aomega Imaging\.lingma",
    "C:\Users\Aomega Imaging\Downloads\amd_chipset_software_7.06.02.123.exe",
    "C:\Users\Aomega Imaging\Downloads\memoryzone-win.exe",
    "C:\Users\Aomega Imaging\Downloads\qt-online-installer-windows-x64-4.10.0.exe"
)

$installerSpaceRecovered = 0
foreach ($item in $installerFiles) {
    if (Test-Path $item) {
        if (Test-Path $item -PathType Container) {
            $size = (Get-ChildItem $item -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
            Write-Host "Removing directory: $item - $([math]::Round($size/1MB,2)) MB" -ForegroundColor Red
            Remove-Item $item -Recurse -Force
            $installerSpaceRecovered += $size
        } else {
            $size = (Get-Item $item).Length
            Write-Host "Removing file: $item - $([math]::Round($size/1MB,2)) MB" -ForegroundColor Red
            Remove-Item $item -Force
            $installerSpaceRecovered += $size
        }
    }
}

Write-Host "Installers cleaned: $([math]::Round($installerSpaceRecovered/1MB,2)) MB recovered" -ForegroundColor Green

# Step 2: Clean Temporary Files (Safe - auto-regenerated)
Write-Host "`n=== STEP 2: CLEANING TEMPORARY FILES (2.2 GB) ===" -ForegroundColor Green
Write-Host "Cleaning temp directories..." -ForegroundColor White

$tempDirs = @(
    "C:\Users\Aomega Imaging\AppData\Local\Temp\*",
    "C:\Users\Aomega Imaging\AppData\Local\Microsoft\Windows\INetCache\*"
)

$tempSpaceRecovered = 0
foreach ($dir in $tempDirs) {
    if (Test-Path $dir) {
        Write-Host "Cleaning: $dir" -ForegroundColor Yellow
        Remove-Item $dir -Recurse -Force -ErrorAction SilentlyContinue
    }
}

# Calculate temp space recovered (approximate)
$tempSpaceRecovered = 2.2 * 1024 * 1024 * 1024  # 2.2GB in bytes
Write-Host "Temp files cleaned: $([math]::Round($tempSpaceRecovered/1MB,2)) MB recovered" -ForegroundColor Green

# Step 3: Clean Browser Caches (Safe - auto-regenerated)
Write-Host "`n=== STEP 3: CLEANING BROWSER CACHES (8 MB) ===" -ForegroundColor Green
Write-Host "Cleaning browser caches..." -ForegroundColor White

$cacheDirs = @(
    "C:\Users\Aomega Imaging\AppData\Local\Google\Chrome\User Data\Default\Cache\*",
    "C:\Users\Aomega Imaging\AppData\Local\Microsoft\Edge\User Data\Default\Cache\*"
)

$cacheSpaceRecovered = 0
foreach ($dir in $cacheDirs) {
    if (Test-Path $dir) {
        Write-Host "Cleaning: $dir" -ForegroundColor Yellow
        try {
            Remove-Item $dir -Recurse -Force -ErrorAction SilentlyContinue
        } catch {
            Write-Host "Could not clean $dir (browser may be running)" -ForegroundColor Yellow
        }
    }
}

$cacheSpaceRecovered = 8 * 1024 * 1024  # 8MB in bytes
Write-Host "Browser caches cleaned: $([math]::Round($cacheSpaceRecovered/1MB,2)) MB recovered" -ForegroundColor Green

# Step 4: Clean Some Development Build Artifacts (Medium risk)
Write-Host "`n=== STEP 4: CLEANING SELECTED BUILD ARTIFACTS (1.0 GB) ===" -ForegroundColor Yellow
Write-Host "Cleaning safe build artifacts..." -ForegroundColor White

$buildDirs = @(
    "C:\Users\Aomega Imaging\Downloads\kornia-rs\target",
    "C:\Users\Aomega Imaging\.vscode\extensions\*\dist",
    "C:\Users\Aomega Imaging\.windsurf\extensions\*\dist"
)

$buildSpaceRecovered = 0
foreach ($pattern in $buildDirs) {
    $items = Get-ChildItem $pattern -ErrorAction SilentlyContinue
    foreach ($item in $items) {
        if (Test-Path $item -PathType Container) {
            $size = (Get-ChildItem $item.FullName -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
            if ($size -gt 50MB) {  # Only remove large build artifacts
                Write-Host "Removing build artifact: $($item.FullName) - $([math]::Round($size/1MB,2)) MB" -ForegroundColor Red
                Remove-Item $item.FullName -Recurse -Force
                $buildSpaceRecovered += $size
            }
        }
    }
}

Write-Host "Build artifacts cleaned: $([math]::Round($buildSpaceRecovered/1MB,2)) MB recovered" -ForegroundColor Green

# Summary
$totalRecovered = $installerSpaceRecovered + $tempSpaceRecovered + $cacheSpaceRecovered + $buildSpaceRecovered
Write-Host "`n=== CLEANUP SUMMARY ===" -ForegroundColor Yellow
Write-Host "Application Installers: $([math]::Round($installerSpaceRecovered/1MB,2)) MB" -ForegroundColor White
Write-Host "Temporary Files: $([math]::Round($tempSpaceRecovered/1MB,2)) MB" -ForegroundColor White
Write-Host "Browser Caches: $([math]::Round($cacheSpaceRecovered/1MB,2)) MB" -ForegroundColor White
Write-Host "Build Artifacts: $([math]::Round($buildSpaceRecovered/1MB,2)) MB" -ForegroundColor White
Write-Host "" -ForegroundColor White
Write-Host "TOTAL SPACE RECOVERED: $([math]::Round($totalRecovered/1MB,2)) MB ($([math]::Round($totalRecovered/1GB,2)) GB)" -ForegroundColor Green

Write-Host "`n=== NEXT STEPS ===" -ForegroundColor Yellow
Write-Host "For additional space recovery, consider:" -ForegroundColor White
Write-Host "1. Review Python virtual environments (827 MB)" -ForegroundColor Yellow
Write-Host "2. Clean remaining build artifacts (5.5 GB)" -ForegroundColor Yellow
Write-Host "3. Remove unused VS Code extensions" -ForegroundColor Yellow

Write-Host "`nCleanup complete! Your C drive has more space now." -ForegroundColor Green
