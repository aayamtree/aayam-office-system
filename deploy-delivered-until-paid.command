#!/bin/bash
# Double-click this file to put both fixes on the live site:
#   1. Delivered jobs stay until they are paid
#   2. Empty board columns collapse, cards narrowed
# The change is already committed — this only pushes it to GitHub, which starts
# the Vercel deploy automatically.

cd "/Users/satish/Desktop/01 PROJECT/OFFICE SYSTEM 2/aayam-office-2" || {
  echo "Could not find the project folder."; read -r; exit 1; }

echo "Clearing stale git locks..."
rm -f .git/index.lock .git/HEAD.lock 2>/dev/null
rm -f .git/objects/*/tmp_obj_* 2>/dev/null

echo "Pushing to GitHub..."
if git push origin main; then
  echo ""
  echo "Done. Vercel is building now — the live site updates in about a minute."
  echo "Then open the Jobs board: the Delivered column should show 75 cards,"
  echo "each one a job with money still outstanding, and the empty columns"
  echo "should be thin strips instead of full-width empty boxes."
else
  echo ""
  echo "Push failed. If it asked for a username or password, sign in to GitHub"
  echo "in your terminal once and double-click this file again."
fi
echo ""
read -p "Press Enter to close..."
