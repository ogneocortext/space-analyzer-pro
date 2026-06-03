@echo off
REM ====================================================
REM Fix System PATH - Run this as Administrator
REM ====================================================
REM This fixes the missing C:\Windows\System32 from PATH
REM which causes "cmd.exe is not recognized" errors

REM Step 1: Add System32 to system PATH permanently
setx PATH "C:\Windows\System32;C:\Windows;C:\Windows\System32\Wbem;C:\Windows\System32\WindowsPowerShell\v1.0\;%PATH%" /M

REM Step 2: Also add it to the current session's PATH
set PATH=C:\Windows\System32;C:\Windows;C:\Windows\System32\Wbem;C:\Windows\System32\WindowsPowerShell\v1.0\;%PATH%

echo.
echo ==========================================
echo PATH fixed! 
echo Please RESTART Visual Studio Code now 
echo for changes to take full effect.
echo ==========================================
pause