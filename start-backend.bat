@echo off
cd /d "E:\Self Built Web and Mobile Apps\Space Analyzer\server"
start /b node backend-server.js > server.log 2>&1
echo Backend started on port 8083
echo Waiting for server...
timeout /t 10 /nobreak >nul
echo Testing health endpoint...
curl -s http://localhost:8083/api/health
echo.
echo Done!