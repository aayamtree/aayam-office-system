#!/bin/bash
# Double-click this file to clear stale git locks and deploy the
# Quote Source + Team Performance changes to the live site.

cd "/Users/satish/Desktop/01 PROJECT/OFFICE SYSTEM 2/aayam-office-2" || {
  echo "❌ Could not find the project folder."; read -r; exit 1; }

echo "🧹 Clearing stale git lock files..."
rm -f .git/index.lock .git/HEAD.lock .git/next-index-7.lock .git/objects/maintenance.lock 2>/dev/null
rm -f .git/objects/*/tmp_obj_* 2>/dev/null

echo "📦 Staging any remaining changes..."
git add -A

echo "📝 Committing (if there is anything new to commit)..."
git commit -m "chore: finalize quote source + team performance work" 2>/dev/null \
  && echo "   committed." || echo "   nothing new to commit (already committed)."

echo "🔄 Pulling latest from GitHub and replaying your commits on top..."
if ! git pull --rebase origin main; then
  echo ""
  echo "⚠️  The pull hit a conflict and stopped. Nothing was pushed."
  echo "    Send Claude this whole window and it will guide you through it."
  echo ""
  read -r -p "Press Enter to close..."
  exit 1
fi

echo "🚀 Pushing to GitHub (this triggers the Vercel deploy)..."
if git push origin main; then
  echo ""
  echo "✅ Done! Vercel will rebuild and the live site updates in ~1–2 minutes."
  echo "   Check: Quotations page (Source/Marketing column) and"
  echo "          Reports → Team Performance."
else
  echo ""
  echo "❌ Push failed. Copy this window and send it to Claude."
fi

echo ""
read -r -p "Press Enter to close this window..."
