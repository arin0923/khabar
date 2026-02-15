@echo off
echo.
echo  Nepal News Aggregator - Khabar
echo  --------------------------------
echo.

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo  Node.js is not installed.
    echo  Download from: https://nodejs.org
    pause
    exit /b 1
)

echo  Node.js found: 
node -v

if not exist "node_modules" (
    echo.
    echo  Installing dependencies...
    npm install
    if %errorlevel% neq 0 (
        echo  npm install failed. Check your internet connection.
        pause
        exit /b 1
    )
)

echo.
echo  Starting Khabar...
echo  Open: http://localhost:3000
echo  Press Ctrl+C to stop
echo.

node server.js
pause
