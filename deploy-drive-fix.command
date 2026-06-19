#!/bin/bash
cd "/Users/satish/Desktop/01 PROJECT/OFFICE SYSTEM 2/aayam-office-2" || exit 1

# Clear any stale git locks left by the sandbox
rm -f .git/HEAD.lock .git/index.lock .git/*.del.* 2>/dev/null

echo "Staging Google Drive fix..."
git add \
  lib/google-drive-server.ts \
  app/api/drive/connect/route.ts \
  app/api/drive/token/route.ts \
  app/api/drive/refresh/route.ts \
  app/api/cron/refresh-drive-token/route.ts \
  components/settings/GoogleDriveSettings.tsx

git commit -m "fix(drive): durable org Drive connection — reliable refresh, robust status, no destructive reconnect

- lib/google-drive-server.ts: in-process Google token refresh (no self-fetch),
  defensive newest-active-credential lookup (no .single() false-negatives),
  invalid_grant handling
- token/refresh/cron routes use the shared helper
- status GET reads via service role and self-heals an expired access token
- Connect button no longer revokes+deletes credentials on every click
- prompt=consent only (no forced account picker)
- Pairs with DB migration enforcing a single active credential"

echo ""
echo "Pushing to GitHub main (this triggers the Vercel deploy)..."
git push origin main

echo ""
echo "Done. Vercel will build and deploy in about 1-2 minutes."
read -p "Press Enter to close this window..."
