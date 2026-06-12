#!/bin/bash
# Aayam Office — Mac/Linux Launcher
# Double-click this file on Mac to start the server

cd "$(dirname "$0")/.."

while true; do
    echo ""
    echo " ============================================="
    echo "  Aayam Office - Local Network Server"
    echo " ============================================="
    echo ""

    # Build if .next doesn't exist
    if [ ! -d ".next" ]; then
        echo " [!] Building app for first time (2-3 min)..."
        npm run build
        if [ $? -ne 0 ]; then
            echo " [ERROR] Build failed."
            read -p "Press Enter to retry or Ctrl+C to quit..."
            continue
        fi
    fi

    # Install bonjour-service if not present
    node -e "require('bonjour-service')" 2>/dev/null
    if [ $? -ne 0 ]; then
        echo " Installing mDNS support (one time)..."
        npm install bonjour-service --save
    fi

    echo ""
    echo " Staff open: http://aayam.local:3000"
    echo " Press Ctrl+C to stop."
    echo ""

    node local/start.js
    EXIT_CODE=$?

    if [ $EXIT_CODE -eq 0 ]; then
        # Clean exit = auto-update finished, restart with new version
        echo ""
        echo " [Update] Restarting with new version in 3 seconds..."
        sleep 3
    else
        # Non-zero = manual stop or crash
        echo ""
        read -p " Server stopped. Press Enter to restart or Ctrl+C to quit..."
    fi
done
