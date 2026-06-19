#!/bin/bash
cd "/Users/satish/Desktop/01 PROJECT/OFFICE SYSTEM 2/aayam-office-2" || exit 1
rm -f .git/HEAD.lock .git/index.lock .git/*.del.* 2>/dev/null

echo "Staging client-add fix..."
git add \
  app/api/crm/clients/route.ts \
  lib/hooks.ts \
  components/forms/ClientQuickAdd.tsx

git commit -m "fix(clients): create clients via server service-role endpoint

The Quick Add Client modal inserted directly from the browser, which failed
with 'new row violates row-level security policy for table clients' whenever
the browser Supabase session had lapsed (token expiry / daily reset / cached
fallback profile) — every clients RLS policy only grants the authenticated
role, so a lapsed session writes as anon and is rejected.

- Add POST /api/crm/clients: authenticates via the SSR cookie session, then
  inserts with the service role (whitelisted columns, stamps created_by/
  assigned_to). Returns a clear 401 if the session is truly gone.
- lib/hooks.ts createClient and ClientQuickAdd now POST to this endpoint."

echo ""
echo "Pushing to GitHub main (triggers the Vercel deploy)..."
git push origin main

echo ""
echo "Done. Vercel will build and deploy in about 1-2 minutes."
read -p "Press Enter to close this window..."
