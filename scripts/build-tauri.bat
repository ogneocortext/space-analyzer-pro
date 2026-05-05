@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion

echo === Tauri Windows Build ===
echo.

REM Set up Visual Studio environment
call "D:\Microsoft Visual Studio\18\Community\VC\Auxiliary\Build\vcvars64.bat"
if %errorlevel% neq 0 (
    echo ERROR: Failed to set up Visual Studio environment
    exit /b 1
)

echo Visual Studio environment loaded.
echo.

REM Navigate to project
E:
cd "E:\Self Built Web and Mobile Apps\Space Analyzer\src-tauri"

REM Clean previous build
echo Cleaning previous build...
if exist "target" (
    rmdir /s /q "target" 2>nul
)
echo Clean complete.
echo.

REM Build
echo Starting build...
cargo build
if %errorlevel% neq 0 (
    echo.
    echo BUILD FAILED
    exit /b 1
)

echo.
echo BUILD SUCCESS
echo.
pause
