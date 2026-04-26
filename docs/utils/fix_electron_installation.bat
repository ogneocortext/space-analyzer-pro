ix_electron_installation.bat</path>
<content">@echo off
echo ============================================
echo Space Analyzer - Electron Installation Fix
echo ============================================
echo.

echo [STEP 1/6] Checking current directory...
if not exist "space_analyzer_electron" (
    echo ERROR: space_analyzer_electron directory not found
    echo Please run this script from the project root directory
    pause
    exit /b 1
)

cd space_analyzer_electron
echo Current directory: %CD%
echo.

echo [STEP 2/6] Killing any running Electron processes...
taskkill /f /im electron.exe 2>nul
taskkill /f /im node.exe 2>nul
timeout /t 2 >nul
echo Processes cleaned.
echo.

echo [STEP 3/6] Removing node_modules and package-lock.json...
if exist node_modules (
    echo Removing node_modules directory...
    rmdir /s /q node_modules 2>nul
)

if exist package-lock.json (
    echo Removing package-lock.json...
    del package-lock.json 2>nul
)

echo Cleaning any temporary Electron files...
if exist node_modules\.electron-* (
    echo Removing temporary Electron directories...
    rmdir /s /q node_modules\.electron-* 2>nul
)

echo.
echo [STEP 4/6] Clearing npm cache...
npm cache clean --force
if %ERRORLEVEL% NEQ 0 (
    echo WARNING: npm cache clean had issues, continuing anyway...
)

echo.
echo [STEP 5/6] Installing dependencies...
npm install
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: npm install failed
    echo Trying with legacy peer deps...
    npm install --legacy-peer-deps
)

echo.
echo [STEP 6/6] Installing Electron...
echo Installing Electron with legacy peer deps...
npm install electron --save-dev --legacy-peer-deps --force
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: Electron installation failed
    echo.
    echo Alternative solutions:
    echo 1. Disable antivirus real-time scanning temporarily
    echo 2. Run as administrator
    echo 3. Use: npm install electron --save-dev --force
    echo 4. Try: npm install electron@latest --save-dev
    echo.
    pause
    exit /b 1
)

echo.
echo [VERIFICATION] Testing Electron installation...
echo Testing if Electron can load...
node -e "try { const electron = require('electron'); console.log('✅ Electron loaded successfully'); console.log('✅ Electron version:', electron.version || 'Available'); } catch(e) { console.log('❌ Electron failed to load:', e.message); process.exit(1); }"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ============================================
    echo ✅ ELECTRON INSTALLATION SUCCESSFUL!
    echo ============================================
    echo.
    echo You can now run the application with:
    echo   cd space_analyzer_electron
    echo   npm start
    echo.
    echo For development with debugging:
    echo   npm run dev
    echo.
) else (
    echo.
    echo ============================================
    echo ⚠️  ELECTRON INSTALLATION INCOMPLETE
    echo ============================================
    echo.
    echo The Electron package was installed but may not be fully functional.
    echo Try the manual steps in COMPREHENSIVE_TESTING_REPORT_2025.md
    echo.
)

pause