#!/bin/bash
# Double-click this file to deploy the Product Library duplicate-file fix.
# It commits the changed files and pushes to main; Vercel builds automatically.
#
# NOTE: the commit author email MUST be info@aayam.com or Vercel blocks the build.

cd "$(dirname "$0")" || exit 1

echo "==> Aayam Office System — deploying Product Library de-duplication"
echo

# A crashed git process left a stale lock behind; clear it if nothing is running.
if [ -f .git/index.lock ] && ! pgrep -x git > /dev/null; then
  echo "==> Clearing stale .git/index.lock"
  rm -f .git/index.lock
fi

git config user.email "info@aayam.com"
git config user.name "Satish"

git add \
  lib/file-hash.ts \
  lib/product-dedupe.ts \
  lib/product-library.ts \
  app/api/products/sheet-lookup/route.ts \
  app/api/products/scan-sheet/route.ts \
  app/api/products/import-sheet/route.ts \
  "app/api/products/[id]/versions/route.ts" \
  "app/admin/library/[id]/page.tsx" \
  components/library/ImportSheetModal.tsx \
  PRODUCT_LIBRARY_DEDUPE.md

git commit -m "feat(library): stop re-processing the same file and creating duplicate products

- SHA-256 content hash of every uploaded sheet/design, checked BEFORE upload
- library_sheets caches the AI scan per hash: a repeat upload costs no Claude call
- Import modal warns 'already imported', shows the products it created, and
  offers re-use saved scan vs scan again
- Jobs that match an existing product (brand+name+category+client) are saved as
  a NEW VERSION instead of a second product
- Identical file already on a product is skipped instead of duplicated"

echo
echo "==> Pushing to GitHub main…"
git push origin main
PUSH_STATUS=$?

echo
echo "======================================================"
git log --oneline -1
echo "push exit code: $PUSH_STATUS  (0 = success)"
echo "======================================================"
echo "Watch the build at https://vercel.com/dashboard"
echo
echo "Leave this window open — do not press any key."
