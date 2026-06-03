# Tauri Build Script for Windows
# This script properly configures the environment for building Tauri on Windows

Write-Host "=== Tauri Windows Build Script ===" -ForegroundColor Cyan
Write-Host ""

# Stop on error
$ErrorActionPreference = "Stop"

# Set up Windows SDK paths
$WindowsSDK = "C:\Program Files (x86)\Windows Kits\10"
$SDKVersion = "10.0.22621.0"  # You can change this to 10.0.26100.0 if needed

# Verify SDK exists
$SDKInclude = Join-Path $WindowsSDK "Include\$SDKVersion"
if (-not (Test-Path $SDKInclude)) {
    # Try the newer version
    $SDKVersion = "10.0.26100.0"
    $SDKInclude = Join-Path $WindowsSDK "Include\$SDKVersion"
    
    if (-not (Test-Path $SDKInclude)) {
        Write-Error "Windows SDK not found at $WindowsSDK"
        exit 1
    }
}

Write-Host "Using Windows SDK: $SDKVersion" -ForegroundColor Green

# Set required environment variables
$env:UniversalCRTSdkDir = $WindowsSDK
$env:UCRTVersion = $SDKVersion

# Set INCLUDE path (order matters!)
$env:INCLUDE = @(
    "$WindowsSDK\Include\$SDKVersion\um",
    "$WindowsSDK\Include\$SDKVersion\ucrt", 
    "$WindowsSDK\Include\$SDKVersion\shared",
    "$WindowsSDK\Include\$SDKVersion\winrt",
    "$WindowsSDK\Include\$SDKVersion\cppwinrt"
) -join ";"

# Set LIB path
$env:LIB = @(
    "$WindowsSDK\Lib\$SDKVersion\um\x64",
    "$WindowsSDK\Lib\$SDKVersion\ucrt\x64"
) -join ";"

# Find and add VC++ tools
$VSPaths = @(
    "D:\Microsoft Visual Studio\18\Community",
    "C:\Program Files\Microsoft Visual Studio\2022\Community",
    "C:\Program Files\Microsoft Visual Studio\2022\Professional",
    "C:\Program Files\Microsoft Visual Studio\2022\Enterprise"
)

$VSToolsPath = $null
foreach ($vs in $VSPaths) {
    $vcTools = Join-Path $vs "VC\Tools\MSVC"
    if (Test-Path $vcTools) {
        # Find the latest version
        $versions = Get-ChildItem $vcTools -Directory | Sort-Object Name -Descending
        if ($versions) {
            $latest = $versions[0]
            $VSToolsPath = Join-Path $vs "VC\Tools\MSVC\$($latest.Name)"
            
            # Add to INCLUDE and LIB
            $env:INCLUDE = "$VSToolsPath\include;$env:INCLUDE"
            $env:LIB = "$VSToolsPath\lib\x64;$env:LIB"
            
            # Add to PATH
            $vcBin = "$VSToolsPath\bin\Hostx64\x64"
            $env:PATH = "$vcBin;$env:PATH"
            
            Write-Host "Found Visual C++ tools: $($latest.Name)" -ForegroundColor Green
            break
        }
    }
}

if (-not $VSToolsPath) {
    Write-Warning "Visual C++ tools not found. Build may fail."
}

# Also set VCINSTALLDIR for older build scripts
$env:VCINSTALLDIR = $VSPaths | Where-Object { Test-Path $_ } | Select-Object -First 1

Write-Host ""
Write-Host "Environment configured:" -ForegroundColor Yellow
Write-Host "  UniversalCRTSdkDir: $env:UniversalCRTSdkDir" -ForegroundColor Gray
Write-Host "  UCRTVersion: $env:UCRTVersion" -ForegroundColor Gray
Write-Host "  VCINSTALLDIR: $env:VCINSTALLDIR" -ForegroundColor Gray
Write-Host "  INCLUDE paths: $env:INCLUDE" -ForegroundColor Gray

# Verify cl.exe works
try {
    $clOutput = & cl.exe /? 2>&1 | Select-Object -First 1
    Write-Host "  C++ Compiler: OK" -ForegroundColor Green
} catch {
    Write-Warning "C++ Compiler (cl.exe) not found in PATH"
}

Write-Host ""

# Navigate to project
$projectPath = "E:\Self Built Web and Mobile Apps\Space Analyzer"
if (-not (Test-Path $projectPath)) {
    Write-Error "Project path not found: $projectPath"
    exit 1
}

Set-Location $projectPath
Write-Host "Project: $projectPath" -ForegroundColor Cyan

# Clean previous build
Write-Host ""
Write-Host "=== Cleaning previous build ===" -ForegroundColor Cyan
if (Test-Path "src-tauri\target") {
    Remove-Item -Recurse -Force "src-tauri\target" -ErrorAction SilentlyContinue
    Write-Host "Cleaned target directory" -ForegroundColor Green
}

# Build the application
Write-Host ""
Write-Host "=== Building Tauri Application ===" -ForegroundColor Cyan

# Option 1: Build just the Rust backend first (faster to catch errors)
Write-Host "Building Rust backend..." -ForegroundColor Yellow
Set-Location "src-tauri"

$cargoOutput = & cargo build 2>&1
$cargoExitCode = $LASTEXITCODE

if ($cargoExitCode -ne 0) {
    Write-Host ""
    Write-Host "=== BUILD FAILED ===" -ForegroundColor Red
    Write-Host $cargoOutput -ForegroundColor Red
    
    # Save log
    $cargoOutput | Out-File -FilePath "..\build-error.log" -Force
    Write-Host "Error log saved to: build-error.log" -ForegroundColor Yellow
    
    exit 1
}

Write-Host ""
Write-Host "=== BUILD SUCCESS ===" -ForegroundColor Green
Write-Host "Rust backend compiled successfully!" -ForegroundColor Green

# Option 2: Full Tauri build (includes frontend)
# Write-Host ""
# Write-Host "Running full Tauri build..." -ForegroundColor Yellow
# Set-Location $projectPath
# & npm run tauri:build

Write-Host ""
Write-Host "To run the development version, use:" -ForegroundColor Cyan
Write-Host "  npm run tauri:dev" -ForegroundColor White
