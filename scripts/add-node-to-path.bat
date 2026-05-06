@echo off

set NODE_DIR=C:\nvm4w\nodejs

echo.
echo ====================================
echo Space Analyzer - Add Node.js to PATH
echo ====================================
echo.

REM Check if node exists
if exist "%NODE_DIR%\node.exe" (
    echo Found Node.js at: %NODE_DIR%
) else (
    echo ERROR: Node.js not found at %NODE_DIR%
    pause
    exit /b 1
)

REM Get current user PATH
for /f "tokens=2*" %%a in ('reg query "HKCU\Environment" /v Path 2^>nul') do set USER_PATH=%%b

echo Current PATH:
echo %USER_PATH%
echo.

REM Check if already in PATH - use findstr with quoting
echo %USER_PATH% | findstr /I /C:"C:\nvm4w\nodejs" >nul
if %errorlevel% equ 0 (
    echo Node.js is already in your PATH.
    echo No changes needed.
) else (
    echo Adding Node.js to PATH...
    setx PATH "%USER_PATH%;%NODE_DIR%"
    echo.
    echo SUCCESS: Added %NODE_DIR% to your PATH
    echo.
    echo IMPORTANT: Please restart your terminal/IDE
    echo then run: npm run server:dev
)

echo.
echo Testing Node.js...
"%NODE_DIR%\node.exe" --version
echo.

pause