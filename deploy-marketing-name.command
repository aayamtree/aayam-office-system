#!/bin/bash
# One-click deploy. Pushes 3 fixes to GitHub so Vercel redeploys:
#   1. Quotations list shows the marketing person's name (Source / Marketing column)
#   2. Job cards no longer repeat the PO/DO/DP type badge (it's already in the number)
#   3. Quote numbers always stay short (QT-YY-NNN), never a long timestamp
# Safe: keeps everything already on the server, just adds these changes.

cd "$(dirname "$0")" || exit 1
set -e

MARKETING_COMMIT="60e99bb066cad68bed1c6519afac65672c2b423e"

echo "==> Fetching latest from GitHub..."
git fetch origin

echo "==> Resetting local branch to match the server cleanly..."
git checkout -B main origin/main

echo "==> 1/2 Adding the marketing-name column..."
git cherry-pick "$MARKETING_COMMIT"

echo "==> 2/2 Applying job-card + quote-number fixes..."
git apply aayam-ui-fixes.patch
git add app/admin/jobs/page.tsx app/api/quotations/route.ts
git commit -m "fix(jobs): remove redundant type badge; fix(quotations): short number fallback"

echo "==> Pushing (Vercel will redeploy in about a minute)..."
git push origin main

echo ""
echo "Done. Wait ~1 minute, then refresh the app:"
echo "  - Quotations page: 'Source / Marketing' column shows the marketing person"
echo "  - Jobs board: each card shows the PO/DO/DP type only once (in the number)"
echo ""
read -n 1 -s -r -p "Press any key to close this window."
