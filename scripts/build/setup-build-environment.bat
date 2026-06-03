@echo off
echo ========================================
echo Space Analyzer Pro - Build Setup
echo ========================================

set "VS_PATH="
for %%P in (
    "%ProgramFiles(x86)%\Microsoft Visual Studio\2022\BuildTools"
    "%ProgramFiles%\Microsoft Visual Studio\2022\Community"
    "%ProgramFiles%\Microsoft Visual Studio\2022\Professional"
    "%ProgramFiles%\Microsoft Visual Studio\2022\Enterprise"
    "D:\Microsoft Visual Studio\18\Community"
    "C:\Program Files (x86)\Microsoft Visual Studio\18\BuildTools"
) do (
    if exist "%%~P\VC\Auxiliary\Build\vcvarsall.bat" set "VS_PATH=%%~P"
)

if not defined VS_PATH (
    for /f "usebackq tokens=*" %%I in (`where vswhere.exe 2^>nul`) do set "VSWHERE=%%I"
    if defined VSWHERE (
        for /f "usebackq tokens=*" %%I in (`"%VSWHERE%" -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath 2^>nul`) do (
            if exist "%%~I\VC\Auxiliary\Build\vcvarsall.bat" set "VS_PATH=%%~I"
        )
    )
)

if not defined VS_PATH (
    echo ❌ Visual Studio Build Tools not found!
    echo Please install Visual Studio Build Tools 2022 with C++ workload
    echo Download: https://visualstudio.microsoft.com/downloads/
    pause
    exit /b 1
)

REM Check Rust installation
rustc --version >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo ❌ Rust not found!
    echo Please install Rust from: https://rustup.rs/
    pause
    exit /b 1
)

echo ✅ Prerequisites check passed!

REM Setup Visual Studio environment
echo 🚀 Setting up Visual Studio environment...
call "%VS_PATH%\VC\Auxiliary\Build\vcvarsall.bat" x64

if %ERRORLEVEL% neq 0 (
    echo ❌ Failed to setup Visual Studio environment
    pause
    exit /b 1
)

REM Setup Rust environment
echo 🔧 Setting up Rust environment...
set PATH=%USERPROFILE%\.cargo\bin;%PATH%
set RUSTUP_TOOLCHAIN=stable-x86_64-pc-windows-msvc

REM Verify tools
echo 🔍 Verifying build tools...
echo Rust version:
rustc --version
echo Cargo version:
cargo --version
echo Linker location:
where link.exe

REM Test compilation
echo 🧪 Testing compilation...
cd src-tauri
cargo check --lib --message-format=short

if %ERRORLEVEL% equ 0 (
    echo.
    echo ✅ Build environment setup successful!
    echo.
    echo 🎯 Ready to build Space Analyzer Pro!
    echo.
    echo 💡 To build the application:
    echo   cargo tauri dev     # Development mode
    echo   cargo tauri build   # Production build
    echo.
) else (
    echo.
    echo ❌ Build test failed!
    echo.
    echo 🔧 Troubleshooting steps:
    echo   1. Ensure Visual Studio Build Tools are properly installed
    echo   2. Run this script from "Developer Command Prompt for VS 2022"
    echo   3. Check that MSVC toolchain is active: rustup show
    echo   4. Verify PATH doesn't have conflicting link.exe
    echo.
)

pause
