@echo off
echo ============================================
echo Fixing ComSpec environment variable...
echo ============================================
echo.
echo Current ComSpec value:
reg query "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" /v ComSpec 2>nul || echo [Not found in registry]
echo.

REM Fix ComSpec to correct casing
setx ComSpec C:\Windows\System32\cmd.exe /M

echo.
echo Setting for current session...
set ComSpec=C:\Windows\System32\cmd.exe

echo.
echo ============================================
echo ✅ ComSpec has been set to:
echo    C:\Windows\System32\cmd.exe
echo.
echo ⚠️  IMPORTANT: Restart VS Code now!
echo ============================================
pause