@echo off
REM Build script for design-screenshot using Visual Studio 2026

echo ==========================================
echo Building Design Screenshot Tool
echo Using VS 2026 from D:\Microsoft Visual Studio
echo ==========================================

REM Set Visual Studio environment for x64
set "VSCMD_SKIP_SENDTELEMETRY=1"
call "D:\Microsoft Visual Studio\18\Community\VC\Auxiliary\Build\vcvarsall.bat" x64

if errorlevel 1 (
    echo ERROR: Failed to set up Visual Studio environment
    exit /b 1
)

echo.
echo [1/2] Setting up environment variables...

REM Set up library paths
set "LIB=D:\Microsoft Visual Studio\18\Community\VC\Tools\MSVC\14.50.35717\lib\x64;C:\Program Files (x86)\Windows Kits\10\lib\10.0.26100.0\um\x64;C:\Program Files (x86)\Windows Kits\10\lib\10.0.26100.0\ucrt\x64;%LIB%"

REM Set up include paths
set "INCLUDE=D:\Microsoft Visual Studio\18\Community\VC\Tools\MSVC\14.50.35717\include;C:\Program Files (x86)\Windows Kits\10\include\10.0.26100.0\um;C:\Program Files (x86)\Windows Kits\10\include\10.0.26100.0\ucrt;C:\Program Files (x86)\Windows Kits\10\include\10.0.26100.0\shared;%INCLUDE%"

echo.
echo [2/2] Building release binary...
cargo build --release

if errorlevel 1 (
    echo ERROR: Build failed!
    exit /b 1
)

echo.
echo ==========================================
echo Build completed successfully!
echo ==========================================
echo.
echo Executable location: target\release\design-screenshot.exe
echo.
pause
