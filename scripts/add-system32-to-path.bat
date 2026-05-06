@echo off
echo Adding C:\Windows\System32 to system PATH...
setx PATH "%PATH%;C:\Windows\System32" /M
echo Done! Restart your terminal.
pause