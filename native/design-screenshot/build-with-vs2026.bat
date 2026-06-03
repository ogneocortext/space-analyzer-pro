@echo off
REM Build script for design-screenshot using Visual Studio 2026

echo ==========================================
echo Building Design Screenshot Tool
echo Searching for Visual Studio installation...
echo ==========================================

REM Try multiple common Visual Studio paths
set "VS_FOUND=0"

REM Check for VS 2022/2023/2024/2025/2026 in default locations
for %%P in (
    "D:\Microsoft Visual Studio\2026\Community\VC\Auxiliary\Build\vcvarsall.bat"
    "C:\Program Files\Microsoft Visual Studio\2026\Community\VC\Auxiliary\Build\vcvarsall.bat"
    "D:\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvarsall.bat"
    "C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvarsall.bat"
    "D:\Microsoft Visual Studio\18\Community\VC\Auxiliary\Build\vcvarsall.bat"
    "C:\Program Files\Microsoft Visual Studio\18\Community\VC\Auxiliary\Build\vcvarsall.bat"
) do (
    if exist %%P (
        echo Found Visual Studio at: %%~dpP
        set "VS_PATH=%%P"
        set "VS_FOUND=1"
        goto :vs_found
    )
)

:vs_not_found
echo ERROR: Visual Studio not found in common locations
echo Please install Visual Studio with C++ development tools
echo or update the paths in this script
exit /b 1

:vs_found
if %VS_FOUND%==0 goto :vs_not_found

REM Set Visual Studio environment for x64
set "VSCMD_SKIP_SENDTELEMETRY=1"
call "%VS_PATH%" x64

if errorlevel 1 (
    echo ERROR: Failed to set up Visual Studio environment
    exit /b 1
)

echo.
echo [1/2] Setting up environment variables...

REM Check if Rust is installed
where cargo >nul 2>&1
if errorlevel 1 (
    echo WARNING: Rust/Cargo not found in PATH
    echo Please install Rust from https://rustup.rs/
    echo Attempting to continue anyway...
)

REM Check if project has Cargo.toml
if not exist "Cargo.toml" (
    echo ERROR: Cargo.toml not found in current directory
    echo Please run this script from the project root
    exit /b 1
)

echo.
echo [2/2] Building release binary...
echo Running: cargo build --release
cargo build --release

if errorlevel 1 (
    echo.
    echo ==========================================
    echo BUILD FAILED!
    echo ==========================================
    echo.
    echo Common issues:
    echo 1. Rust not installed - install from https://rustup.rs/
    echo 2. Missing dependencies - run: cargo fetch
    echo 3. Visual Studio C++ tools not installed
    echo 4. Network issues preventing crate downloads
    echo.
    echo Try running: cargo check to see detailed errors
    pause
    exit /b 1
)

echo.
echo ==========================================
echo Build completed successfully!
echo ==========================================
echo.

REM Check if executable was created
if exist "target\release\design-screenshot.exe" (
    echo ✅ Executable created: target\release\design-screenshot.exe

    REM Show file size
    for %%I in ("target\release\design-screenshot.exe") do echo 📦 File size: %%~zI bytes

    REM Test if executable runs (quick version check)
    echo.
    echo Testing executable...
    target\release\design-screenshot.exe --version >nul 2>&1
    if errorlevel 1 (
        echo ⚠️  Warning: Executable created but may have runtime issues
    ) else (
        echo ✅ Executable test passed
    )
) else (
    echo ⚠️  Warning: Executable not found at expected location
)

echo.
pause
