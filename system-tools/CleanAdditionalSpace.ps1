# Additional Space Cleanup - Medium Risk, High Impact
Write-Host "=== ADDITIONAL SPACE CLEANUP ===" -ForegroundColor Yellow
Write-Host "This will clean medium-risk items for additional 4.6 GB recovery" -ForegroundColor White

# Step 1: Clean Python Virtual Environments (Review first)
Write-Host "`n=== STEP 1: REVIEW PYTHON VIRTUAL ENVIRONMENTS (827 MB) ===" -ForegroundColor Green
Write-Host "Finding Python virtual environments..." -ForegroundColor White

$venvDirs = Get-ChildItem -Path "C:\Users\Aomega Imaging" -Name "venv" -Recurse -ErrorAction SilentlyContinue | ForEach-Object { Join-Path "C:\Users\Aomega Imaging" $_ }
$venvSpaceRecovered = 0

foreach ($dir in $venvDirs) {
    if (Test-Path $dir) {
        $size = (Get-ChildItem $dir -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
        $lastModified = (Get-Item $dir).LastWriteTime
        $daysOld = (New-TimeSpan $lastModified (Get-Date)).Days
        
        Write-Host "Found venv: $dir" -ForegroundColor Cyan
        Write-Host "  Size: $([math]::Round($size/1MB,2)) MB | Age: $daysOld days | Modified: $lastModified" -ForegroundColor White
        
        # Check if it's recently used (within last 30 days)
        if ($daysOld -gt 30) {
            Write-Host "  This venv appears old (>30 days). Safe to remove?" -ForegroundColor Yellow
            $confirm = Read-Host "Remove this venv? (y/n)"
            if ($confirm -eq "y" -or $confirm -eq "Y") {
                Write-Host "  Removing: $dir - $([math]::Round($size/1MB,2)) MB" -ForegroundColor Red
                Remove-Item $dir -Recurse -Force
                $venvSpaceRecovered += $size
                Write-Host "  ✓ Removed successfully" -ForegroundColor Green
            } else {
                Write-Host "  ✗ Kept" -ForegroundColor Yellow
            }
        } else {
            Write-Host "  This venv is recent (<30 days). Keeping." -ForegroundColor Green
        }
        Write-Host ""
    }
}

Write-Host "Python venvs cleaned: $([math]::Round($venvSpaceRecovered/1MB,2)) MB recovered" -ForegroundColor Green

# Step 2: Clean Rust Build Artifacts (High impact)
Write-Host "`n=== STEP 2: CLEANING RUST BUILD ARTIFACTS (962 MB) ===" -ForegroundColor Green
Write-Host "Cleaning Rust target directories..." -ForegroundColor White

$rustTargets = Get-ChildItem -Path "C:\Users\Aomega Imaging" -Name "target" -Recurse -ErrorAction SilentlyContinue | ForEach-Object { Join-Path "C:\Users\Aomega Imaging" $_ }
$rustSpaceRecovered = 0

foreach ($dir in $rustTargets) {
    if (Test-Path $dir) {
        $size = (Get-ChildItem $dir -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
        Write-Host "Found Rust target: $dir - $([math]::Round($size/1MB,2)) MB" -ForegroundColor Cyan
        
        # Keep only release builds, remove debug and other artifacts
        $debugDir = Join-Path $dir "debug"
        $releaseDir = Join-Path $dir "release"
        
        if (Test-Path $debugDir) {
            $debugSize = (Get-ChildItem $debugDir -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
            Write-Host "  Removing debug build: $debugDir - $([math]::Round($debugSize/1MB,2)) MB" -ForegroundColor Red
            Remove-Item $debugDir -Recurse -Force
            $rustSpaceRecovered += $debugSize
        }
        
        # Clean other large directories in target
        $otherDirs = Get-ChildItem $dir -Directory | Where-Object { $_.Name -notin @("release") }
        foreach ($otherDir in $otherDirs) {
            $otherSize = (Get-ChildItem $otherDir.FullName -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
            if ($otherSize -gt 50MB) {
                Write-Host "  Removing: $($otherDir.FullName) - $([math]::Round($otherSize/1MB,2)) MB" -ForegroundColor Red
                Remove-Item $otherDir.FullName -Recurse -Force
                $rustSpaceRecovered += $otherSize
            }
        }
    }
}

Write-Host "Rust artifacts cleaned: $([math]::Round($rustSpaceRecovered/1MB,2)) MB recovered" -ForegroundColor Green

# Step 3: Clean Node.js Build Caches
Write-Host "`n=== STEP 3: CLEANING NODE.JS BUILD CACHES (400 MB) ===" -ForegroundColor Green
Write-Host "Cleaning Node.js caches and build artifacts..." -ForegroundColor White

$nodeCacheDirs = @(
    "C:\Users\Aomega Imaging\AppData\Local\npm-cache",
    "C:\Users\Aomega Imaging\AppData\Roaming\npm-cache",
    "C:\Users\Aomega Imaging\.npm"
)

$nodeSpaceRecovered = 0
foreach ($dir in $nodeCacheDirs) {
    if (Test-Path $dir) {
        $size = (Get-ChildItem $dir -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
        Write-Host "Removing Node.js cache: $dir - $([math]::Round($size/1MB,2)) MB" -ForegroundColor Red
        Remove-Item $dir -Recurse -Force
        $nodeSpaceRecovered += $size
    }
}

# Clean node_modules in temp/build directories
$nodeModulesDirs = Get-ChildItem -Path "C:\Users\Aomega Imaging" -Name "node_modules" -Recurse -ErrorAction SilentlyContinue | ForEach-Object { Join-Path "C:\Users\Aomega Imaging" $_ }
foreach ($dir in $nodeModulesDirs) {
    if (Test-Path $dir) {
        $parentDir = Split-Path $dir -Parent
        # Only remove if in temp/build directories
        if ($parentDir -match "temp|build|cache" -or $parentDir -match "Downloads") {
            $size = (Get-ChildItem $dir -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
            if ($size -gt 100MB) {
                Write-Host "Removing node_modules in: $parentDir - $([math]::Round($size/1MB,2)) MB" -ForegroundColor Red
                Remove-Item $dir -Recurse -Force
                $nodeSpaceRecovered += $size
            }
        }
    }
}

Write-Host "Node.js caches cleaned: $([math]::Round($nodeSpaceRecovered/1MB,2)) MB recovered" -ForegroundColor Green

# Step 4: Clean Additional VS Code Extension Caches
Write-Host "`n=== STEP 4: CLEANING VS CODE EXTENSION CACHES (200 MB) ===" -ForegroundColor Green
Write-Host "Cleaning additional VS Code extension caches..." -ForegroundColor White

$vscodeCacheDirs = Get-ChildItem -Path "C:\Users\Aomega Imaging\.vscode\extensions" -Directory | ForEach-Object {
    Join-Path $_.FullName "node_modules"
}

$vscodeSpaceRecovered = 0
foreach ($dir in $vscodeCacheDirs) {
    if (Test-Path $dir) {
        $size = (Get-ChildItem $dir -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
        if ($size -gt 50MB) {
            $extName = Split-Path (Split-Path $dir -Parent) -Leaf
            Write-Host "Removing VS Code extension cache: $extName - $([math]::Round($size/1MB,2)) MB" -ForegroundColor Red
            Remove-Item $dir -Recurse -Force
            $vscodeSpaceRecovered += $size
        }
    }
}

Write-Host "VS Code caches cleaned: $([math]::Round($vscodeSpaceRecovered/1MB,2)) MB recovered" -ForegroundColor Green

# Step 5: Clean Mobile App Build Artifacts
Write-Host "`n=== STEP 5: CLEANING MOBILE APP BUILD ARTIFACTS (77 MB) ===" -ForegroundColor Green
Write-Host "Cleaning mobile app build directories..." -ForegroundColor White

$mobileBuildDirs = @(
    "C:\Users\Aomega Imaging\source\repos\Mobile Crypto Earnings Tracker\Mobile Crypto Earnings Tracker\bin",
    "C:\Users\Aomega Imaging\source\repos\Mobile Crypto Earnings Tracker\Mobile Crypto Earnings Tracker\obj",
    "C:\Users\Aomega Imaging\Downloads\droidrun-portal-main\app\build"
)

$mobileSpaceRecovered = 0
foreach ($dir in $mobileBuildDirs) {
    if (Test-Path $dir) {
        $size = (Get-ChildItem $dir -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
        Write-Host "Removing mobile build: $dir - $([math]::Round($size/1MB,2)) MB" -ForegroundColor Red
        Remove-Item $dir -Recurse -Force
        $mobileSpaceRecovered += $size
    }
}

Write-Host "Mobile app builds cleaned: $([math]::Round($mobileSpaceRecovered/1MB,2)) MB recovered" -ForegroundColor Green

# Summary
$totalRecovered = $venvSpaceRecovered + $rustSpaceRecovered + $nodeSpaceRecovered + $vscodeSpaceRecovered + $mobileSpaceRecovered
Write-Host "`n=== ADDITIONAL CLEANUP SUMMARY ===" -ForegroundColor Yellow
Write-Host "Python Virtual Environments: $([math]::Round($venvSpaceRecovered/1MB,2)) MB" -ForegroundColor White
Write-Host "Rust Build Artifacts: $([math]::Round($rustSpaceRecovered/1MB,2)) MB" -ForegroundColor White
Write-Host "Node.js Caches: $([math]::Round($nodeSpaceRecovered/1MB,2)) MB" -ForegroundColor White
Write-Host "VS Code Extension Caches: $([math]::Round($vscodeSpaceRecovered/1MB,2)) MB" -ForegroundColor White
Write-Host "Mobile App Builds: $([math]::Round($mobileSpaceRecovered/1MB,2)) MB" -ForegroundColor White
Write-Host "" -ForegroundColor White
Write-Host "ADDITIONAL SPACE RECOVERED: $([math]::Round($totalRecovered/1MB,2)) MB ($([math]::Round($totalRecovered/1GB,2)) GB)" -ForegroundColor Green

Write-Host "`n=== FINAL CLEANUP NOTES ===" -ForegroundColor Yellow
Write-Host "Some items may need to be rebuilt:" -ForegroundColor White
Write-Host "- Rust projects: Run 'cargo build' to recreate release builds" -ForegroundColor Yellow
Write-Host "- Node.js projects: Run 'npm install' to recreate node_modules" -ForegroundColor Yellow
Write-Host "- VS Code extensions: Will auto-download when needed" -ForegroundColor Yellow
Write-Host "- Mobile apps: Rebuild in your IDE" -ForegroundColor Yellow

Write-Host "`nAdditional cleanup complete! Even more space recovered." -ForegroundColor Green
