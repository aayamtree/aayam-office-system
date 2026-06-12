@echo off
title Aayam Office Server
color 0A

:: Go to app folder (one level up from this script)
cd /d "%~dp0.."

:START
echo.
echo  =============================================
echo   Aayam Office - Local Network Server
echo  =============================================
echo.

:: Check if build exists
if not exist ".next" (
    echo  [!] Building app for first time — takes 2-3 minutes...
    echo.
    call npm run build
    if errorlevel 1 (
        echo.
        echo  [ERROR] Build failed. Check errors above.
        pause
        exit /b 1
    )
)

:: Install bonjour-service if not present
node -e "require('bonjour-service')" 2>nul
if errorlevel 1 (
    echo  Installing mDNS support (one time only)...
    call npm install bonjour-service --save
)

echo.
echo  Staff open:  http://aayam.local:3000
echo  Press Ctrl+C to stop the server.
echo.

node local/start.js

:: If the server exits with code 0 it means an auto-update finished
:: Restart automatically so the new version loads
if %errorlevel% == 0 (
    echo.
    echo  [Update] Restarting with new version...
    echo.
    timeout /t 3 /nobreak >nul
    goto START
)

:: Any other exit code = manual stop or error — pause so user can read it
echo.
echo  Server stopped. Press any key to restart, or close this window to quit.
pause >nul
goto START
