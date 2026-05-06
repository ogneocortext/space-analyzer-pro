@echo off
echo ============================================
echo Fixing ComSpec and System PATH...
echo ============================================
echo.

REM Fix ComSpec - tells Windows where cmd.exe is
setx ComSpec C:\Windows\System32\cmd.exe /M
echo [OK] ComSpec set to C:\Windows\System32\cmd.exe

REM Ensure System32 is in system PATH
setx PATH "C:\Windows\System32;C:\Windows;%PATH%" /M
echo [OK] System32 added to system PATH

REM Set for current session too
set ComSpec=C:\Windows\System32\cmd.exe
set PATH=C:\Windows\System32;C:\Windows;%PATH%

echo.
echo ============================================
echo All fixes applied!
echo IMPORTANT: Restart Visual Studio Code now
echo ============================================
pause