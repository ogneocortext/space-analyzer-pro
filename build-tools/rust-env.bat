@echo off
REM Minimal environment setup for debugging

set "VS_PATH=C:\Program Files (x86)\Microsoft Visual Studio\18\BuildTools"
if not exist "%VS_PATH%" set "VS_PATH=D:\Microsoft Visual Studio\18\Community"

echo [DEBUG] Using VS_PATH: %VS_PATH%

call "%VS_PATH%\VC\Auxiliary\Build\vcvarsall.bat" x64
if errorlevel 1 (
    echo [DEBUG] vcvarsall.bat failed
    exit /b 1
)

echo [DEBUG] vcvarsall.bat succeeded

REM Try to find MSVC version without a complex for loop first
set "MSVC_VERSION=14.50.35717"
set "VS_BIN_PATH=%VS_PATH%\VC\Tools\MSVC\%MSVC_VERSION%\bin\Hostx64\x64"

echo [DEBUG] VS_BIN_PATH: %VS_BIN_PATH%

set "PATH=%VS_BIN_PATH%;%USERPROFILE%\.cargo\bin;%PATH%"
set "RUSTUP_TOOLCHAIN=stable-x86_64-pc-windows-msvc"

echo [DEBUG] Environment setup complete
