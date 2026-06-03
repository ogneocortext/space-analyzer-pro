# Space Analyzer Pro - Quick Launch Script

Write-Host "Starting Space Analyzer Pro..."

# Setup Visual Studio BuildTools
$vsRoot = "C:\Program Files (x86)\Microsoft Visual Studio\18\BuildTools"
if (-not (Test-Path "$vsRoot\VC\Auxiliary\Build\vcvarsall.bat")) {
    $vsRoot = "D:\Microsoft Visual Studio\18\Community"
}

& "$vsRoot\VC\Auxiliary\Build\vcvarsall.bat" x64 | Out-Null

# Setup Rust environment
$cargoBin = Join-Path $env:USERPROFILE '.cargo\bin'
$msvcBin = "$vsRoot\VC\Tools\MSVC\14.50.35717\bin\Hostx64\x64"
$env:PATH = "$cargoBin;$msvcBin;" + $env:PATH
$env:RUSTUP_TOOLCHAIN = 'stable-x86_64-pc-windows-msvc'
$env:VCINSTALLDIR = "$vsRoot\VC\"

Write-Host "Environment configured"
Write-Host "Rust: " -NoNewline; & rustc --version

# Navigate to the Tauri app
Set-Location src-tauri

Write-Host "Building and running Space Analyzer Pro..."

# Check if Tauri CLI is available
if (-not (Get-Command "cargo-tauri" -ErrorAction SilentlyContinue)) {
    Write-Host "Installing Tauri CLI..."
    cargo install tauri-cli --no-default-features
}

# Run the development server
Write-Host "Starting Space Analyzer Pro..."
cargo tauri dev
