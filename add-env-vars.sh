#!/bin/bash

# Add Telegram Bot Token to Vercel
# Run this script to automatically add environment variables

echo "🚀 Adding Telegram Bot Token to Vercel..."
echo ""

# Check if vercel CLI is installed
if ! command -v vercel &> /dev/null
then
    echo "📦 Installing Vercel CLI..."
    npm i -g vercel
fi

# Add environment variables
echo "🔑 Adding environment variable..."
echo ""
echo "When prompted:"
echo "1. For 'value', paste: 8352518034:AAHsiUcPAu3XEAF72bupxjpO1wCk0F9oHns"
echo "2. For 'environment', press 'a' (for all)"
echo ""

vercel env add NEXT_PUBLIC_TELEGRAM_BOT_TOKEN

echo ""
echo "✅ Done! Now redeploy:"
echo "   vercel --prod"
