@echo off
REM Build script using Visual Studio 2022 on D drive

echo ==========================================
echo Building Space Analyzer Rust CLI
echo Using VS 2022 from D:\Microsoft Visual Studio
echo ==========================================

REM Set Visual Studio environment for x64
set "VSCMD_SKIP_SENDTELEMETRY=1"
call "D:\Microsoft Visual Studio\18\Community\VC\Auxiliary\Build\vcvarsall.bat" x64

if errorlevel 1 (
    echo ERROR: Failed to set up Visual Studio environment
    exit /b 1
)

echo.
echo [1/3] Cleaning previous build...
cargo clean

echo.
echo [2/3] Building release binary...
cargo build --release --verbose

if errorlevel 1 (
    echo ERROR: Build failed!
    exit /b 1
)

echo.
echo [3/3] Checking for bin directory...
if not exist "..\..\bin" (
    echo Creating bin directory...
    mkdir "..\..\bin"
)

echo.
echo Copying executable to project bin...
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
"..\..\bin\space-analyzer.exe" --version 2>nul || echo Version check skipped
echo.
pause
