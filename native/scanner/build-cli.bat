@echo off
REM Build script for Space Analyzer Rust CLI (Windows)

echo ==========================================
echo Building Space Analyzer Rust CLI
echo ==========================================

REM Check if cargo is installed
cargo --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Rust/Cargo not found. Please install Rust from https://rustup.rs/
    exit /b 1
)

echo.
echo [1/4] Updating dependencies...
cargo update

echo.
echo [2/4] Building release binary...
cargo build --release

if errorlevel 1 (
    echo ERROR: Build failed!
    exit /b 1
)

echo.
echo [3/4] Checking for bin directory...
if not exist "..\..\bin" (
    echo Creating bin directory...
    mkdir "..\..\bin"
)

echo.
echo [4/4] Copying executable to project bin...
copy /Y "target\release\space-analyzer.exe" "..\..\bin\space-analyzer.exe"

if errorlevel 1 (
    echo ERROR: Failed to copy executable!
    exit /b 1
)

echo.
echo ==========================================
echo Build completed successfully!
echo ==========================================
echo.
echo Executable location: ..\..\bin\space-analyzer.exe
echo.
echo Test with:
echo   space-analyzer.exe "C:\Users\%%USERNAME%%\Documents" --progress --parallel
echo.
pause
