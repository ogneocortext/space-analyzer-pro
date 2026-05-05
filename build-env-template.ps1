# Build Environment Configuration Template
# Copy this file to build-env.ps1 and edit paths to match your installation
# Then run: .\build-env.ps1 before building

# =============================================================================
# EDIT THESE PATHS TO MATCH YOUR ACTUAL INSTALLATION LOCATIONS
# =============================================================================

# Visual Studio Build Tools
# Default: C:\Program Files\Microsoft Visual Studio\2022\BuildTools
# Or if on D: drive: D:\Program Files\Microsoft Visual Studio\2022\BuildTools
$env:VS_BUILD_TOOLS_PATH = "C:\Program Files\Microsoft Visual Studio\2022\BuildTools"

# Rust/Cargo
# Default: C:\Users\$env:USERNAME\.rustup and .cargo
# Or if on D: drive: D:\rust\rustup and D:\rust\cargo
$env:RUSTUP_HOME = "C:\Users\$env:USERNAME\.rustup"
$env:CARGO_HOME = "C:\Users\$env:USERNAME\.cargo"

# Node.js (if not already in system PATH)
# Default: C:\Program Files\nodejs
# Or if on D: drive: D:\nodejs
# $env:NODE_HOME = "C:\Program Files\nodejs"

# Windows SDK (usually auto-detected, but specify if needed)
# $env:WindowsSdkDir = "C:\Program Files (x86)\Windows Kits\10"

# =============================================================================
# PATH CONFIGURATION (DO NOT EDIT UNLESS NEEDED)
# =============================================================================

# Add Visual Studio tools to PATH
$vsToolsPath = "$env:VS_BUILD_TOOLS_PATH\VC\Tools\MSVC\14.35.32215\bin\Hostx64\x64"
if (Test-Path $vsToolsPath) {
    $env:PATH = "$vsToolsPath;" + $env:PATH
    Write-Host "✅ Added VS Tools to PATH" -ForegroundColor Green
} else {
    Write-Host "⚠️ VS Tools path not found: $vsToolsPath" -ForegroundColor Yellow
    Write-Host "   Update VS_BUILD_TOOLS_PATH in this file" -ForegroundColor Yellow
}

# Add Rust/Cargo to PATH
if (Test-Path "$env:CARGO_HOME\bin") {
    $env:PATH = "$env:CARGO_HOME\bin;" + $env:PATH
    Write-Host "✅ Added Rust/Cargo to PATH" -ForegroundColor Green
} else {
    Write-Host "⚠️ Cargo bin not found at $env:CARGO_HOME\bin" -ForegroundColor Yellow
}

# Add Node.js to PATH (if NODE_HOME is set)
if ($env:NODE_HOME -and (Test-Path $env:NODE_HOME)) {
    $env:PATH = "$env:NODE_HOME;" + $env:PATH
    Write-Host "✅ Added Node.js to PATH" -ForegroundColor Green
}

# =============================================================================
# VERIFICATION
# =============================================================================

Write-Host "`n🔍 Verifying tools..." -ForegroundColor Cyan

# Check link.exe (Visual Studio linker)
$link = Get-Command link.exe -ErrorAction SilentlyContinue
if ($link) {
    Write-Host "✅ link.exe found: $($link.Source)" -ForegroundColor Green
} else {
    Write-Host "❌ link.exe not found in PATH" -ForegroundColor Red
    Write-Host "   Check VS_BUILD_TOOLS_PATH setting" -ForegroundColor Yellow
}

# Check cargo
$cargo = Get-Command cargo -ErrorAction SilentlyContinue
if ($cargo) {
    $version = & cargo --version 2>$null
    Write-Host "✅ Cargo found: $version" -ForegroundColor Green
} else {
    Write-Host "❌ Cargo not found in PATH" -ForegroundColor Red
    Write-Host "   Check CARGO_HOME setting" -ForegroundColor Yellow
}

# Check node
$node = Get-Command node -ErrorAction SilentlyContinue
if ($node) {
    $version = & node --version 2>$null
    Write-Host "✅ Node.js found: $version" -ForegroundColor Green
} else {
    Write-Host "❌ Node.js not found in PATH" -ForegroundColor Red
    Write-Host "   Install Node.js or set NODE_HOME" -ForegroundColor Yellow
}

Write-Host "`n✨ Environment configuration complete!" -ForegroundColor Cyan
Write-Host "You can now run: cargo build or npm run tauri:dev" -ForegroundColor Cyan
