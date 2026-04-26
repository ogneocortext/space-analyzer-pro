@echo off
echo 🧹 Cleaning up for fresh install...

taskkill /F /IM node.exe
timeout /t 2 >nul

echo Removing node_modules...
rmdir /s /q node_modules
echo ✅ node_modules removed

echo Clearing npm cache...
npm cache clean --force
echo ✅ npm cache cleared

echo Installing fresh dependencies...
npm install
echo ✅ Installation complete!

pause
