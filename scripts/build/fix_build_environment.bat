@echo off
echo ========================================
echo Fixing Space Analyzer Pro Build Environment
echo ========================================

echo Current linker (PROBLEM): 
where link.exe

echo.
echo Setting up Visual Studio environment...
call "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvarsall.bat" x64

echo.
echo Setting up Rust environment...
set PATH=C:\Users\Aomega Imaging\.cargo\bin;%PATH%

echo.
echo New linker (FIXED):
where link.exe

echo.
echo Testing build...
cd src-tauri
cargo check --lib --message-format=short

if %ERRORLEVEL% equ 0 (
    echo.
    echo ✅ SUCCESS! Build environment fixed!
    echo.
    echo 🎯 Ready to build Space Analyzer Pro!
    echo.
    echo 💡 Next commands:
    echo   cargo tauri dev     # Development mode
    echo   cargo tauri build   # Production build
    echo.
) else (
    echo.
    echo ❌ Build still failing. Running verbose check...
    cargo check --lib --verbose > build_verbose.txt 2>&1
    echo.
    echo 🔍 Check build_verbose.txt for detailed error information
    echo.
)

pause