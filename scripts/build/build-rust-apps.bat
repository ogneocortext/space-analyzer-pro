@echo off
setlocal enabledelayedexpansion

echo ========================================
echo    Building Rust Applications
echo ========================================

REM Store original directory
set "ORIGINAL_DIR=%CD%"

REM Get script directory for relative path resolution
set "SCRIPT_DIR=%~dp0"
set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"

REM Set up Visual Studio environment (auto-detect)
echo [+] Setting up build environment...
where vswhere >nul 2>&1
if %errorlevel% equ 0 (
    for /f "usebackq tokens=*" %%i in (`vswhere -latest -requires Microsoft.Component.MSBuild -find Common7\Tools\VsDevCmd.bat`) do (
        if exist "%%i" (
            call "%%i"
            echo     [OK] Visual Studio environment loaded
            goto :vs_done
        )
    )
)
echo     [!] Visual Studio environment not found, continuing with default environment
:vs_done

REM Find and set up GCC path (auto-detect)
echo.
echo [+] Looking for GCC installation...
set "GCC_FOUND="
for %%f in (
    "C:\msys64\mingw64\bin"
    "C:\Program Files\LLVM\bin"
    "%LOCALAPPDATA%\msys64\mingw64\bin"
    "%ProgramFiles%\msys64\mingw64\bin"
) do (
    if exist "%%f\gcc.exe" (
        echo     [OK] Found GCC at: %%f
        set "GCC_PATH=%%f"
        set "GCC_FOUND=1"
        goto :gcc_found
    )
)
if not defined GCC_FOUND (
    echo     [!] GCC not found in standard locations
    echo.
)
:gcc_found

REM Change to project root
cd /d "%SCRIPT_DIR%"

REM Try to build with MSVC first
echo.
echo [+] Building all workspace crates...
cargo build --release
if %errorlevel% equ 0 (
    echo     [OK] Workspace build successful!
    goto :build_success
) else (
    echo     [!] Workspace build failed, trying individual binaries...
)

REM Try main desktop app
echo     [+] Building main desktop application...
cargo build --release --bin space-analyzer-pro --bin space-analyzer-gui
if %errorlevel% equ 0 (
    echo     [OK] Main desktop app built successfully!
    echo     [OK] Executables: target\release\space-analyzer-pro.exe, target\release\space-analyzer-gui.exe
    goto :build_success
) else (
    echo     [X] Failed to build main desktop application
)

REM Try native GUI
echo     [+] Building native GUI...
cargo build --release -p space-analyzer-native
if %errorlevel% equ 0 (
    echo     [OK] Native GUI built successfully!
    echo     [OK] Executable: target\release\space-analyzer.exe
    goto :build_success
) else (
    echo     [X] Failed to build native GUI
)

REM Try native tools individually
echo     [+] Building native tools...
for %%d in (
    native\scanner
    native\file_monitor
    native\file_deduplicator
    native\archive_manager
    native\node_modules_cleaner
    native\storage_predictor
) do (
    if exist "%%d\Cargo.toml" (
        echo     [+] Building %%d...
        cd "%%d"
        cargo build --release
        if !errorlevel! equ 0 (
            echo     [OK] %%d built successfully!
        ) else (
            echo     [X] Failed to build %%d
        )
        cd ..\..
    ) else (
        echo     [!] %%d directory not found, skipping...
    )
)

echo.
echo ========================================
echo    Build Summary:
echo ========================================
:build_success
echo.
echo     Build process completed! Check the summary above for details.
echo.

REM Return to original directory
cd /d "%ORIGINAL_DIR%"
echo     [OK] Returned to original directory: %ORIGINAL_DIR%

pause
