@echo off
REM Space Analyzer C++ Build Script for Windows
REM Cross-platform build script for C++ components

setlocal enabledelayedexpansion

REM Configuration
set BUILD_TYPE=Release
set BUILD_DIR=build
set INSTALL_PREFIX=C:\Program Files\SpaceAnalyzer

echo.
echo ========================================
echo   Space Analyzer C++ Build Script
echo ========================================
echo.

REM Check if we're in the right directory
if not exist "CMakeLists.txt" (
    echo [ERROR] CMakeLists.txt not found. Please run this script from the src\cpp directory.
    exit /b 1
)

echo [INFO] Detected platform: Windows

REM Check dependencies
echo [INFO] Checking build dependencies...

where cmake >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] CMake is required but not found. Please install CMake 3.20 or later.
    exit /b 1
)

for /f "tokens=3" %%i in ('cmake --version ^| findstr /r "cmake version"') do set CMAKE_VERSION=%%i
echo [INFO] CMake found: %CMAKE_VERSION%

where cl >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Visual Studio C++ compiler not found. Please run this from a Visual Studio Developer Command Prompt.
    exit /b 1
)

echo [INFO] Visual Studio compiler found

REM Create build directory
echo [INFO] Creating build directory...
if not exist "%BUILD_DIR%" mkdir "%BUILD_DIR%"
cd "%BUILD_DIR%"

REM Configure with CMake
echo [INFO] Configuring project with CMake...
cmake .. -G "Visual Studio 17 2022" -A x64 ^
    -DCMAKE_BUILD_TYPE=%BUILD_TYPE% ^
    -DCMAKE_INSTALL_PREFIX="%INSTALL_PREFIX%" ^
    -DCMAKE_EXPORT_COMPILE_COMMANDS=ON

if %errorlevel% neq 0 (
    echo [ERROR] CMake configuration failed
    exit /b 1
)

REM Build the project
echo [INFO] Building project...
cmake --build . --config %BUILD_TYPE% --parallel

if %errorlevel% neq 0 (
    echo [ERROR] Build failed
    exit /b 1
)

REM Run tests if they exist
if exist "bin\%BUILD_TYPE%\space-analyzer-cli.exe" (
    echo [INFO] Running basic test...
    bin\%BUILD_TYPE%\space-analyzer-cli.exe --help >nul 2>&1
    
    if !errorlevel! equ 0 (
        echo [INFO] Basic test passed
    ) else (
        echo [WARN] Basic test failed
    )
)

REM Install if requested
if "%1"=="install" (
    echo [INFO] Installing to %INSTALL_PREFIX%...
    
    REM Check for admin rights
    net session >nul 2>&1
    if !errorlevel! neq 0 (
        echo [WARN] Not running as administrator. You may need admin rights for installation.
    )
    
    cmake --install . --config %BUILD_TYPE%
    
    if !errorlevel! equ 0 (
        echo [INFO] Installation completed
    ) else (
        echo [ERROR] Installation failed
        exit /b 1
    )
)

REM Create package if requested
if "%1"=="package" (
    echo [INFO] Creating package...
    cpack -G NSIS
    
    if !errorlevel! equ 0 (
        echo [INFO] Package created successfully
        echo [INFO] Package files:
        dir *.exe 2>nul
    ) else (
        echo [ERROR] Package creation failed
        exit /b 1
    )
)

REM Print summary
echo.
echo [INFO] Build completed successfully!
echo.
echo [INFO] Build Summary:
echo   - Platform: Windows
echo   - Build Type: %BUILD_TYPE%
echo   - Output Directory: %cd%\bin\%BUILD_TYPE%
echo   - Executable: bin\%BUILD_TYPE%\space-analyzer-cli.exe
echo.

if exist "bin\%BUILD_TYPE%\space-analyzer-cli.exe" (
    echo [INFO] Usage examples:
    echo   bin\%BUILD_TYPE%\space-analyzer-cli.exe --help
    echo   bin\%BUILD_TYPE%\space-analyzer-cli.exe C:\path\to\directory
    echo   bin\%BUILD_TYPE%\space-analyzer-cli.exe C:\path\to\directory --parallel
    echo   bin\%BUILD_TYPE%\space-analyzer-cli.exe C:\path\to\directory --json output.json
    echo.
)

echo [INFO] To install system-wide: build.bat install
echo [INFO] To create package: build.bat package

endlocal