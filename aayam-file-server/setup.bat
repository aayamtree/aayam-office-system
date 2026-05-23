@echo off
title Aayam File Server - Setup
color 0A

echo.
echo =============================================
echo     Aayam File Server - First Time Setup
echo =============================================
echo.

:: Check if running as Administrator
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: Please right-click setup.bat and choose
    echo        "Run as Administrator"
    echo.
    pause
    exit /b 1
)

:: Check Node.js
echo [1/4] Checking Node.js...
node --version >nul 2>&1
if %errorLevel% neq 0 (
    echo Node.js not found. Downloading installer...
    echo.
    echo Please install Node.js from: https://nodejs.org
    echo Download the LTS version, install it, then run this setup again.
    echo.
    start https://nodejs.org
    pause
    exit /b 1
)
echo       Node.js found: OK
node --version

:: Create files directory
echo.
echo [2/4] Creating C:\AayamFiles folder...
if not exist "C:\AayamFiles" (
    mkdir "C:\AayamFiles"
    echo       Folder created: C:\AayamFiles
) else (
    echo       Folder already exists: OK
)

:: Install dependencies
echo.
echo [3/4] Installing server dependencies...
cd /d "%~dp0"
call npm install
if %errorLevel% neq 0 (
    echo ERROR: npm install failed. Check your internet connection.
    pause
    exit /b 1
)
echo       Dependencies installed: OK

:: Set up auto-start via Task Scheduler
echo.
echo [4/4] Setting up auto-start on Windows boot...
set SCRIPT_PATH=%~dp0start-server.bat
schtasks /delete /tn "AayamFileServer" /f >nul 2>&1
schtasks /create /tn "AayamFileServer" /tr "\"%SCRIPT_PATH%\"" /sc onstart /ru SYSTEM /rl HIGHEST /f >nul 2>&1
if %errorLevel% equ 0 (
    echo       Auto-start configured: OK
) else (
    echo       Auto-start setup skipped (will need manual start)
)

:: Start the server now
echo.
echo =============================================
echo     Setup Complete! Starting server...
echo =============================================
echo.
echo Server will run at: http://192.168.1.200:3001
echo Files will be saved to: C:\AayamFiles\
echo.
echo Starting now...
echo.
start "Aayam File Server" cmd /k "cd /d "%~dp0" && node server.js"

echo.
echo =============================================
echo  Done! The file server is now running.
echo  Keep the server window open at all times.
echo  It will auto-start next time Windows boots.
echo =============================================
echo.
pause
