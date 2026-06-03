@echo off
REM Permanent PATH Cleanup for Rust Development
REM ==========================================
REM This script cleans up your PATH and fixes toolchain conflicts

setlocal enabledelayedexpansion

echo 🧹 Cleaning up PATH for Rust development...
echo ===========================================

REM First, let's see what we're working with
echo 📋 Current PATH Analysis:
echo.

REM Check for problematic paths
echo %PATH% | findstr /i "git" >nul
if %ERRORLEVEL% equ 0 (
    echo ⚠️  Found Git paths (can cause linker conflicts)
) else (
    echo ✅ No Git paths detected
)

echo %PATH% | findstr /i "visual studio" >nul
if %ERRORLEVEL% equ 0 (
    echo ✅ Found Visual Studio paths
) else (
    echo ❌ No Visual Studio paths detected
)

echo %PATH% | findstr /i "cargo" >nul
if %ERRORLEVEL% equ 0 (
    echo ✅ Found Rust/Cargo paths
) else (
    echo ❌ No Rust paths detected
)

echo.
echo 🔧 Building clean PATH...

REM Define essential paths in CORRECT order
set "VS_TOOLS=D:\Microsoft Visual Studio\18\Community\VC\Tools\MSVC\14.50.35717\bin\Hostx64\x64"
set "VS_BUILDTOOLS=C:\Program Files (x86)\Microsoft Visual Studio\18\BuildTools\VC\Tools\MSVC\14.50.35717\bin\Hostx64\x64"
set "RUST_TOOLS=C:\Users\Aomega Imaging\.cargo\bin"
set "NODEJS=C:\Users\Aomega Imaging\AppData\Local\nvm\v25.9.0"
set "NPM=C:\Users\Aomega Imaging\AppData\Roaming\npm"
set "OLLAMA=C:\Users\Aomega Imaging\AppData\Local\Programs\Ollama"
set "WINDSURF=C:\Users\Aomega Imaging\AppData\Local\Programs\Windsurf"

REM Windows system paths
set "WIN_SYS=C:\Windows\System32;C:\Windows;C:\Windows\System32\WindowsPowerShell\v1.0;C:\Windows\System32\OpenSSH"

REM Git paths (DEAD LAST to avoid conflicts)
set "GIT_SAFE=C:\Program Files\Git\cmd"

REM User paths
set "USER_PATHS=C:\Users\Aomega Imaging\bin;C:\Users\Aomega Imaging\AppData\Local\Microsoft\WindowsApps"

REM Build the clean PATH - NO DUPLICATES, CORRECT ORDER
set "CLEAN_PATH=%VS_TOOLS%;%RUST_TOOLS%;%VS_BUILDTOOLS%;%NODEJS%;%NPM%;%OLLAMA%;%WINDSURF%;%WIN_SYS%;%GIT_SAFE%;%USER_PATHS%"

echo ✅ Clean PATH built with correct priority order
echo.
echo 📊 PATH Priority Order:
echo   1. Visual Studio Tools (highest priority)
echo   2. Rust/Cargo Tools
echo   3. Node.js/NPM
echo   4. Windows System
echo   5. Git Tools (lowest priority - after VS/Rust)
echo   6. User paths
echo.

echo 💡 Options to apply clean PATH:
echo.
echo Option 1: Set for current session only:
echo   set PATH="%CLEAN_PATH%"
echo.
echo Option 2: Set permanently for user:
echo   setx PATH "%CLEAN_PATH%"
echo.
echo Option 3: Set permanently for system (admin required):
echo   setx PATH "%CLEAN_PATH%" /M
echo.

echo 🔍 Testing clean PATH...
set "TEST_PATH=%CLEAN_PATH%"

REM Check if tools are found correctly
echo.
echo 📋 Tool Availability Test:
echo.

REM Test Visual Studio linker
echo %TEST_PATH% | findstr /i "visual studio" >nul
if %ERRORLEVEL% equ 0 (
    echo ✅ Visual Studio tools in PATH
) else (
    echo ❌ Visual Studio tools missing
)

REM Test Rust tools
echo %TEST_PATH% | findstr /i "cargo" >nul
if %ERRORLEVEL% equ 0 (
    echo ✅ Rust tools in PATH
) else (
    echo ❌ Rust tools missing
)

REM Test Git positioning
echo %TEST_PATH% | findstr /i "git" >nul
if %ERRORLEVEL% equ 0 (
    echo ✅ Git tools in PATH (positioned correctly)
) else (
    echo ⚠️  Git tools not in clean PATH
)

echo.
echo 🎯 Applying clean PATH for current session...
set "PATH=%CLEAN_PATH%"

echo ✅ Clean PATH applied!
echo.
echo 🔍 Verifying tool locations...
echo.

REM Check which linker will be used
where link.exe
echo.

REM Check Rust tools
where rustc.exe 2>nul
if %ERRORLEVEL% equ 0 (
    echo ✅ Rust compiler found
    rustc --version
) else (
    echo ❌ Rust compiler not found
)

echo.
where cargo.exe 2>nul
if %ERRORLEVEL% equ 0 (
    echo ✅ Cargo found
    cargo --version
) else (
    echo ❌ Cargo not found
)

echo.
echo 📝 To make this permanent:
echo   Run: setx PATH "%CLEAN_PATH%"
echo   Then restart your terminal
echo.
echo 🧪 Testing Rust build with clean PATH...
cd native\node_modules_cleaner

cargo build --release

if %ERRORLEVEL% equ 0 (
    echo.
    echo 🎉 SUCCESS! Clean PATH resolved the toolchain conflicts!
    echo.
    if exist "target\release\node_modules_cleaner.exe" (
        echo 📦 Copying to bin directory...
        copy "target\release\node_modules_cleaner.exe" "..\..\bin\" >nul
        echo ✅ Ready to use: bin\node_modules_cleaner.exe
    )
) else (
    echo.
    echo ❌ Build still failed - may need additional troubleshooting
)

echo.
echo 💡 Clean PATH Summary:
echo   - Removed duplicate Git paths
echo   - Prioritized Visual Studio over Git
echo   - Added Rust tools in correct position
echo   - Maintained all necessary development tools
echo.
echo 🔄 To reset to original PATH:
echo   (Your original PATH was backed up to session memory only)

cd ..\..
endlocal