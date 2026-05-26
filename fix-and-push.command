#!/bin/bash
cd "/Users/satish/Desktop/01 PROJECT/OFFICE SYSTEM 2/aayam-office-2"
rm -f .git/HEAD.lock .git/index.lock
git add components/print-planner/CreatePrintRunForm.tsx
git commit -m "fix: paper unit toggle moved to full-width row — Sheets/KG no longer cut off"
git push origin main
echo ""
echo "✅ Done! Vercel will deploy in ~1 minute."
read -p "Press Enter to close..."
