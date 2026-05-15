@echo off
echo Building Space Analyzer Native GUI...

REM Check if Rust is installed
rustc --version >nul 2>&1
if errorlevel 1 (
    echo Error: Rust is not installed or not in PATH
    echo Please install Rust from https://rustup.rs/
    pause
    exit /b 1
)

REM Clean previous builds
echo Cleaning previous builds...
if exist "target" rmdir /s /q "target"
if exist "build" rmdir /s /q "build"

REM Build in release mode
echo Building in release mode...
cargo build --release --target x86_64-pc-windows-msvc

if errorlevel 1 (
    echo Error: Build failed
    pause
    exit /b 1
)

REM Create build directory
if not exist "build" mkdir "build"
if not exist "build\release" mkdir "build\release"

REM Copy executable to build directory
echo Copying executable...
copy "target\x86_64-pc-windows-msvc\release\space-analyzer-gui.exe" "build\release\"

REM Copy assets if they exist
if exist "assets" (
    echo Copying assets...
    xcopy "assets" "build\release\assets" /E /I /Y
)

REM Copy required DLLs
echo Copying required DLLs...
copy "target\x86_64-pc-windows-msvc\release\*.dll" "build\release\" 2>nul

echo.
echo Build completed successfully!
echo Executable: build\release\space-analyzer-gui.exe
echo.
pause