# Additional Space Cleanup - Simplified Version
Write-Host "=== ADDITIONAL SPACE CLEANUP ===" -ForegroundColor Yellow

# Step 1: Clean Rust Build Artifacts
Write-Host "Cleaning Rust build artifacts..." -ForegroundColor White
$rustTargets = Get-ChildItem -Path "C:\Users\Aomega Imaging" -Name "target" -Recurse -ErrorAction SilentlyContinue | ForEach-Object { Join-Path "C:\Users\Aomega Imaging" $_ }
$rustSpaceRecovered = 0

foreach ($dir in $rustTargets) {
    if (Test-Path $dir) {
        $size = (Get-ChildItem $dir -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
        Write-Host "Found Rust target: $dir - $([math]::Round($size/1MB,2)) MB" -ForegroundColor Cyan
        
        # Remove debug builds and other large artifacts
        $debugDir = Join-Path $dir "debug"
        if (Test-Path $debugDir) {
            $debugSize = (Get-ChildItem $debugDir -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
            Write-Host "Removing debug build: $debugDir - $([math]::Round($debugSize/1MB,2)) MB" -ForegroundColor Red
            Remove-Item $debugDir -Recurse -Force
            $rustSpaceRecovered += $debugSize
        }
        
        # Clean other large directories
        $otherDirs = Get-ChildItem $dir -Directory | Where-Object { $_.Name -notin @("release") }
        foreach ($otherDir in $otherDirs) {
            $otherSize = (Get-ChildItem $otherDir.FullName -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
            if ($otherSize -gt 50MB) {
                Write-Host "Removing: $($otherDir.FullName) - $([math]::Round($otherSize/1MB,2)) MB" -ForegroundColor Red
                Remove-Item $otherDir.FullName -Recurse -Force
                $rustSpaceRecovered += $otherSize
            }
        }
    }
}

Write-Host "Rust artifacts cleaned: $([math]::Round($rustSpaceRecovered/1MB,2)) MB" -ForegroundColor Green

# Step 2: Clean Node.js Caches
Write-Host "Cleaning Node.js caches..." -ForegroundColor White
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
        if ($parentDir -match "temp|build|cache|Downloads") {
            $size = (Get-ChildItem $dir -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
            if ($size -gt 100MB) {
                Write-Host "Removing node_modules in: $parentDir - $([math]::Round($size/1MB,2)) MB" -ForegroundColor Red
                Remove-Item $dir -Recurse -Force
                $nodeSpaceRecovered += $size
            }
        }
    }
}

Write-Host "Node.js caches cleaned: $([math]::Round($nodeSpaceRecovered/1MB,2)) MB" -ForegroundColor Green

# Step 3: Clean VS Code Extension Caches
Write-Host "Cleaning VS Code extension caches..." -ForegroundColor White
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

Write-Host "VS Code caches cleaned: $([math]::Round($vscodeSpaceRecovered/1MB,2)) MB" -ForegroundColor Green

# Step 4: Clean Mobile App Build Artifacts
Write-Host "Cleaning mobile app build artifacts..." -ForegroundColor White
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

Write-Host "Mobile app builds cleaned: $([math]::Round($mobileSpaceRecovered/1MB,2)) MB" -ForegroundColor Green

# Step 5: Review Python Virtual Environments
Write-Host "Reviewing Python virtual environments..." -ForegroundColor White
$venvDirs = Get-ChildItem -Path "C:\Users\Aomega Imaging" -Name "venv" -Recurse -ErrorAction SilentlyContinue | ForEach-Object { Join-Path "C:\Users\Aomega Imaging" $_ }
$venvSpaceRecovered = 0

foreach ($dir in $venvDirs) {
    if (Test-Path $dir) {
        $size = (Get-ChildItem $dir -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
        $lastModified = (Get-Item $dir).LastWriteTime
        $daysOld = (New-TimeSpan $lastModified (Get-Date)).Days
        
        Write-Host "Found venv: $dir" -ForegroundColor Cyan
        Write-Host "  Size: $([math]::Round($size/1MB,2)) MB | Age: $daysOld days" -ForegroundColor White
        
        # Auto-remove very old venvs (>90 days)
        if ($daysOld -gt 90) {
            Write-Host "  Auto-removing old venv (>90 days): $dir - $([math]::Round($size/1MB,2)) MB" -ForegroundColor Red
            Remove-Item $dir -Recurse -Force
            $venvSpaceRecovered += $size
            Write-Host "  ✓ Removed automatically" -ForegroundColor Green
        } else {
            Write-Host "  Keeping (recent venv)" -ForegroundColor Green
        }
    }
}

Write-Host "Python venvs cleaned: $([math]::Round($venvSpaceRecovered/1MB,2)) MB" -ForegroundColor Green

# Summary
$totalRecovered = $rustSpaceRecovered + $nodeSpaceRecovered + $vscodeSpaceRecovered + $mobileSpaceRecovered + $venvSpaceRecovered
Write-Host "`n=== ADDITIONAL CLEANUP SUMMARY ===" -ForegroundColor Yellow
Write-Host "Rust Build Artifacts: $([math]::Round($rustSpaceRecovered/1MB,2)) MB" -ForegroundColor White
Write-Host "Node.js Caches: $([math]::Round($nodeSpaceRecovered/1MB,2)) MB" -ForegroundColor White
Write-Host "VS Code Extension Caches: $([math]::Round($vscodeSpaceRecovered/1MB,2)) MB" -ForegroundColor White
Write-Host "Mobile App Builds: $([math]::Round($mobileSpaceRecovered/1MB,2)) MB" -ForegroundColor White
Write-Host "Python Virtual Environments: $([math]::Round($venvSpaceRecovered/1MB,2)) MB" -ForegroundColor White
Write-Host "" -ForegroundColor White
Write-Host "ADDITIONAL SPACE RECOVERED: $([math]::Round($totalRecovered/1MB,2)) MB ($([math]::Round($totalRecovered/1GB,2)) GB)" -ForegroundColor Green

Write-Host "`n=== REBUILD NOTES ===" -ForegroundColor Yellow
Write-Host "- Rust projects: Run 'cargo build' to recreate" -ForegroundColor White
Write-Host "- Node.js projects: Run 'npm install' to recreate" -ForegroundColor White
Write-Host "- VS Code extensions: Will auto-download when needed" -ForegroundColor White
Write-Host "- Mobile apps: Rebuild in your IDE" -ForegroundColor White

Write-Host "`nAdditional cleanup complete!" -ForegroundColor Green
