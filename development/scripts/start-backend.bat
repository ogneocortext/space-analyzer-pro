@echo off
set PORT=8081
cd /d "%~dp0\server"
node backend-server.js
pause
