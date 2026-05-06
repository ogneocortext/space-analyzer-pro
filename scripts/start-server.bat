@echo off
setlocal

set NODE_DIR=C:\nvm4w\nodejs
set SERVER_DIR=E:\Self Built Web and Mobile Apps\Space Analyzer\server

echo.
echo ====================================
echo Space Analyzer - Backend Server
echo ====================================
echo.

cd /d "%SERVER_DIR%"

echo Starting server on port 8080...
echo.

"%NODE_DIR%\node.exe" server.js

pause