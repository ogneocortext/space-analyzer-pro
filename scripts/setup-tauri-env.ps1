# PowerShell script to set up Tauri build environment on Windows
# Run this before building: .\scripts\setup-tauri-env.ps1

Write-Host "Setting up Tauri build environment..." -ForegroundColor Cyan

# Try to find Windows SDK
$wdkPaths = @(
    'C:\Program Files (x86)\Windows Kits\10',
    'C:\Program Files\Windows Kits\10',
    'D:\Windows Kits\10'
)

$windowsSdkPath = $null
$windowsSdkVersion = $null

foreach ($basePath in $wdkPaths) {
    $includePath = Join-Path $basePath "Include"
    if (Test-Path $includePath) {
        $versions = Get-ChildItem $includePath -Directory | 
            Where-Object { $_.Name -match '^\d+\.\d+\.\d+' } | 
            Sort-Object Name -Descending
        
        if ($versions) {
            $windowsSdkPath = $basePath
            $windowsSdkVersion = $versions[0].Name
            Write-Host "Found Windows SDK: $windowsSdkVersion at $basePath" -ForegroundColor Green
            break
        }
    }
}

if (-not $windowsSdkPath) {
    Write-Error "Windows SDK not found! Please install it from Visual Studio Installer."
    exit 1
}

# Set up environment variables
$includePaths = @(
    (Join-Path $windowsSdkPath "Include\$windowsSdkVersion\um"),
    (Join-Path $windowsSdkPath "Include\$windowsSdkVersion\ucrt"),
    (Join-Path $windowsSdkPath "Include\$windowsSdkVersion\shared"),
    (Join-Path $windowsSdkPath "Include\$windowsSdkVersion\winrt")
)

$libPaths = @(
    (Join-Path $windowsSdkPath "Lib\$windowsSdkVersion\um\x64"),
    (Join-Path $windowsSdkPath "Lib\$windowsSdkVersion\ucrt\x64")
)

# Find Visual Studio VC tools
$vsPaths = @(
    'D:\Microsoft Visual Studio\18\Community',
    'C:\Program Files\Microsoft Visual Studio\2022\Community',
    'C:\Program Files\Microsoft Visual Studio\2022\Professional',
    'C:\Program Files\Microsoft Visual Studio\2022\Enterprise'
)

$vsPath = $null
$vcVersion = $null

foreach ($path in $vsPaths) {
    if (Test-Path $path) {
        $vcToolsPath = Join-Path $path "VC\Tools\MSVC"
        if (Test-Path $vcToolsPath) {
            $versions = Get-ChildItem $vcToolsPath -Directory | Sort-Object Name -Descending
            if ($versions) {
                $vsPath = $path
                $vcVersion = $versions[0].Name
                Write-Host "Found Visual Studio: $vcVersion at $path" -ForegroundColor Green
                
                # Add VC include path
                $vcInclude = Join-Path $path "VC\Tools\MSVC\$vcVersion\include"
                $vcLib = Join-Path $path "VC\Tools\MSVC\$vcVersion\lib\x64"
                $vcBin = Join-Path $path "VC\Tools\MSVC\$vcVersion\bin\Hostx64\x64"
                
                if (Test-Path $vcInclude) { $includePaths += $vcInclude }
                if (Test-Path $vcLib) { $libPaths += $vcLib }
                if (Test-Path $vcBin) { $env:PATH = "$vcBin;$env:PATH" }
                
                break
            }
        }
    }
}

# Set environment variables
$env:INCLUDE = ($includePaths -join ';')
$env:LIB = ($libPaths -join ';')

# Also set UniversalCRTSdkDir and UCRTVersion for some crates
$env:UniversalCRTSdkDir = $windowsSdkPath
$env:UCRTVersion = $windowsSdkVersion

Write-Host "" -ForegroundColor Cyan
Write-Host "Environment configured:" -ForegroundColor Cyan
Write-Host "  INCLUDE: $env:INCLUDE" -ForegroundColor Gray
Write-Host "  LIB: $env:LIB" -ForegroundColor Gray
Write-Host "  UniversalCRTSdkDir: $env:UniversalCRTSdkDir" -ForegroundColor Gray
Write-Host "  UCRTVersion: $env:UCRTVersion" -ForegroundColor Gray
Write-Host "" -ForegroundColor Cyan

# Verify cl.exe works
try {
    $clVersion = & cl.exe 2>&1 | Select-Object -First 1
    if ($clVersion -match "Microsoft") {
        Write-Host "C++ compiler verified: $clVersion" -ForegroundColor Green
    }
} catch {
    Write-Warning "Could not verify cl.exe. Build may fail."
}

Write-Host "" -ForegroundColor Green
Write-Host "Environment ready! You can now run:" -ForegroundColor Green
Write-Host "  npm run tauri:dev" -ForegroundColor White
Write-Host "  npm run tauri:build" -ForegroundColor White
