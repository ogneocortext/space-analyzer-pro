# Native Scanner Build Script for Visual Studio 2026
# This script builds all native scanners with maximum optimizations

param(
    [switch]$Clean,
    [switch]$SkipCpp,
    [switch]$SkipRust,
    [switch]$Verbose
)

$ErrorActionPreference = "Stop"
$StartTime = Get-Date

# Colors for output
function Write-Info($msg) { Write-Host "[INFO] $msg" -ForegroundColor Cyan }
function Write-Success($msg) { Write-Host "[OK] $msg" -ForegroundColor Green }
function Write-Error($msg) { Write-Host "[ERROR] $msg" -ForegroundColor Red }
function Write-Warn($msg) { Write-Host "[WARN] $msg" -ForegroundColor Yellow }

# Check if VS2026 environment is loaded
function Test-VSEnvironment {
    $vcvars = $env:VCINSTALLDIR
    if (-not $vcvars) {
        Write-Warn "VS2026 environment not detected. Attempting to load..."
        
        $possiblePaths = @(
            "D:\Program Files\Microsoft Visual Studio\2026\Professional\VC\Auxiliary\Build\vcvars64.bat",
            "D:\Program Files\Microsoft Visual Studio\2026\Enterprise\VC\Auxiliary\Build\vcvars64.bat",
            "D:\Program Files\Microsoft Visual Studio\2026\Community\VC\Auxiliary\Build\vcvars64.bat",
            "D:\VS2026\VC\Auxiliary\Build\vcvars64.bat"
        )
        
        $found = $false
        foreach ($path in $possiblePaths) {
            if (Test-Path $path) {
                Write-Info "Loading VS2026 from: $path"
                & cmd /c "`"$path`" && set" | ForEach-Object {
                    if ($_ -match "^(.+?)=(.+)$") {
                        [Environment]::SetEnvironmentVariable($matches[1], $matches[2])
                    }
                }
                $found = $true
                break
            }
        }
        
        if (-not $found) {
            Write-Error "Could not find VS2026 installation. Please run this script from a VS2026 Developer Command Prompt."
            exit 1
        }
    }
    return $true
}

# Build C++ Scanner
function Build-CppScanner {
    Write-Info "Building C++ Native Scanner..."
    
    $cppDir = "src\cpp\native-scanner"
    Push-Location $cppDir
    
    try {
        if ($Clean) {
            Write-Info "Cleaning C++ build..."
            npm run clean 2>$null
            Remove-Item -Recurse -Force "build" -ErrorAction SilentlyContinue
        }
        
        # Install dependencies
        Write-Info "Installing npm dependencies..."
        npm install | Out-String | ForEach-Object { if ($Verbose) { Write-Host $_ } }
        
        # Configure for VS2026
        Write-Info "Configuring for VS2026..."
        npx node-gyp configure --msvs_version=2026 2>&1 | ForEach-Object { if ($Verbose) { Write-Host $_ } }
        
        # Build Release
        Write-Info "Building Release with optimizations..."
        npx node-gyp rebuild --release --msvs_version=2026 2>&1 | ForEach-Object { 
            if ($_ -match "error|Error|ERROR") { Write-Error $_ }
            elseif ($Verbose) { Write-Host $_ }
        }
        
        # Verify build
        $buildPath = "build\Release\native_scanner.node"
        if (Test-Path $buildPath) {
            $size = (Get-Item $buildPath).Length
            Write-Success "C++ scanner built: $buildPath ($size bytes)"
        } else {
            throw "Build output not found: $buildPath"
        }
    }
    finally {
        Pop-Location
    }
}

# Build Rust Simple Scanner
function Build-RustSimpleScanner {
    Write-Info "Building Rust Simple Scanner..."
    
    $rustDir = "src\rust\simple-scanner"
    Push-Location $rustDir
    
    try {
        if ($Clean) {
            Write-Info "Cleaning Rust build..."
            cargo clean
            Remove-Item "scanner.node" -ErrorAction SilentlyContinue
        }
        
        # Update dependencies
        Write-Info "Updating Rust dependencies..."
        cargo update | Out-String | ForEach-Object { if ($Verbose) { Write-Host $_ } }
        
        # Build optimized release
        Write-Info "Building optimized release..."
        $env:RUSTFLAGS = "-C target-cpu=native"
        cargo build --release 2>&1 | ForEach-Object { 
            if ($_ -match "error\[|warning:") { 
                if ($_ -match "error\[") { Write-Error $_ }
                else { Write-Warn $_ }
            }
            elseif ($Verbose) { Write-Host $_ }
        }
        
        # Verify build
        $buildPath = "target\release\scanner.dll"
        $outputPath = "scanner.node"
        
        if (Test-Path $buildPath) {
            # Copy to expected location
            Copy-Item $buildPath $outputPath -Force
            $size = (Get-Item $outputPath).Length
            Write-Success "Rust scanner built: $outputPath ($size bytes)"
        } else {
            throw "Build output not found: $buildPath"
        }
    }
    finally {
        Remove-Item Env:\RUSTFLAGS -ErrorAction SilentlyContinue
        Pop-Location
    }
}

# Build Rust Native Scanner
function Build-RustNativeScanner {
    Write-Info "Building Rust Native Scanner (alternative)..."
    
    $rustDir = "native\scanner"
    Push-Location $rustDir
    
    try {
        if ($Clean) {
            Write-Info "Cleaning Rust build..."
            cargo clean
        }
        
        # Build optimized release
        Write-Info "Building optimized release..."
        $env:RUSTFLAGS = "-C target-cpu=native"
        cargo build --release 2>&1 | ForEach-Object { 
            if ($_ -match "error\[|warning:") { 
                if ($_ -match "error\[") { Write-Error $_ }
                else { Write-Warn $_ }
            }
            elseif ($Verbose) { Write-Host $_ }
        }
        
        # Verify build
        $buildPath = "target\release\libspace_scanner.dll"
        if (Test-Path $buildPath) {
            $size = (Get-Item $buildPath).Length
            Write-Success "Rust native scanner built: $buildPath ($size bytes)"
        } else {
            Write-Warn "Build output not found (this scanner is optional)"
        }
    }
    finally {
        Remove-Item Env:\RUSTFLAGS -ErrorAction SilentlyContinue
        Pop-Location
    }
}

# Main execution
Write-Host "========================================" -ForegroundColor Blue
Write-Host "  Native Scanner Build Script (VS2026)  " -ForegroundColor Blue
Write-Host "========================================" -ForegroundColor Blue
Write-Host ""

# Check VS environment
Test-VSEnvironment

# Build requested scanners
$buildCount = 0
$failed = @()

if (-not $SkipCpp) {
    try {
        Build-CppScanner
        $buildCount++
    }
    catch {
        Write-Error "C++ scanner build failed: $_"
        $failed += "C++"
    }
}

if (-not $SkipRust) {
    try {
        Build-RustSimpleScanner
        $buildCount++
    }
    catch {
        Write-Error "Rust simple scanner build failed: $_"
        $failed += "Rust Simple"
    }
    
    try {
        Build-RustNativeScanner
    }
    catch {
        Write-Warn "Rust native scanner build failed (optional): $_"
    }
}

# Summary
$EndTime = Get-Date
$duration = $EndTime - $StartTime

Write-Host ""
Write-Host "========================================" -ForegroundColor Blue
Write-Host "  Build Summary                        " -ForegroundColor Blue
Write-Host "========================================" -ForegroundColor Blue
Write-Host "Completed: $buildCount scanner(s)" -ForegroundColor Green
if ($failed.Count -gt 0) {
    Write-Host "Failed: $($failed -join ', ')" -ForegroundColor Red
}
Write-Host "Duration: $($duration.ToString('mm\:ss'))" -ForegroundColor Cyan
Write-Host ""

# Test loading
Write-Info "Testing module loading..."
try {
    $cpp = require(".\src\cpp\native-scanner")
    Write-Success "C++ scanner loads successfully"
} catch {
    Write-Warn "C++ scanner load test failed: $_"
}

try {
    $rust = require(".\src\rust\simple-scanner")
    Write-Success "Rust scanner loads successfully"
} catch {
    Write-Warn "Rust scanner load test failed: $_"
}

Write-Host ""
Write-Success "Build process complete!"
