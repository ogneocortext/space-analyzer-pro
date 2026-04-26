# Direct C++ build script for native scanner using VS 2026
# Bypasses node-gyp to work with Visual Studio 2026

$ErrorActionPreference = "Stop"

$vsPath = "D:\Microsoft Visual Studio\18\Community"
$vcvarsPath = "$vsPath\VC\Auxiliary\Build\vcvars64.bat"

# Get Node.js paths
$nodeExePath = node -p "process.execPath"
$nodePath = Split-Path -Parent (Split-Path -Parent $nodeExePath)
$nodeInclude = Join-Path $nodePath "include"
$nodeLib = Join-Path $nodePath "lib"

Write-Host "Setting up Visual Studio 2026 environment..." -ForegroundColor Cyan
Write-Host "Node.js path: $nodePath" -ForegroundColor Yellow
Write-Host "Node.js include: $nodeInclude" -ForegroundColor Yellow

# Create build directory
$buildDir = "build"
if (Test-Path $buildDir) {
    Remove-Item -Recurse -Force $buildDir
}
New-Item -ItemType Directory -Path $buildDir | Out-Null

# Get node-addon-api include
$addonApiInclude = node -p "require('node-addon-api').include"
Write-Host "node-addon-api include: $addonApiInclude" -ForegroundColor Yellow

# Build compile command with proper quoting
$scriptRoot = $PSScriptRoot
$compileCmd = @"
@echo off
call "$vcvarsPath"
cd /d "$scriptRoot"
cl.exe /EHsc /std:c++20 /O2 /GL /arch:AVX2 /fp:fast /Gw /LD /I"$nodeInclude" /I"$addonApiInclude" /DNAPI_VERSION=4 /DNAPI_DISABLE_CPP_EXCEPTIONS /D_HAS_EXCEPTIONS=0 /DNOMINMAX /DWIN32_LEAN_AND_MEAN src/native_scanner.cpp /Fe:build\native_scanner.dll /link /LTCG /OPT:REF /OPT:ICF /DLL /LIBPATH:"$nodeLib" node.lib
"@

Write-Host "Compiling native_scanner.cpp..." -ForegroundColor Cyan
Write-Host "Compile command: $compileCmd" -ForegroundColor Gray

# Execute compilation
$compileCmd | Out-File -FilePath "build\compile.bat" -Encoding ASCII
& cmd /c "build\compile.bat"

if ($LASTEXITCODE -ne 0) {
    Write-Host "Compilation failed with exit code $LASTEXITCODE" -ForegroundColor Red
    exit 1
}

# Rename DLL to .node
if (Test-Path "build\native_scanner.dll") {
    Move-Item -Path "build\native_scanner.dll" -Destination "build\native_scanner.node" -Force
    Write-Host "✅ Build successful: build\native_scanner.node" -ForegroundColor Green
} else {
    Write-Host "❌ Build failed: native_scanner.dll not found" -ForegroundColor Red
    exit 1
}

# Copy to scanner.node location
Copy-Item -Path "build\native_scanner.node" -Destination "scanner.node" -Force
Write-Host "✅ Copied to scanner.node" -ForegroundColor Green
