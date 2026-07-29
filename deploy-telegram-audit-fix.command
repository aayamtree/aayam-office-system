#!/bin/bash
# Commits the Telegram audit fixes. Push with GitHub Desktop afterwards.

cd "$(dirname "$0")" || exit 1

echo "==> Aayam Office System — Telegram audit fixes"
echo

if [ -f .git/index.lock ] && ! pgrep -x git > /dev/null; then
  echo "==> Clearing stale .git/index.lock"
  rm -f .git/index.lock
fi

git config user.email "info@aayam.com"
git config user.name "Satish"

git add \
  lib/telegram-groups.ts \
  app/api/telegram/notify-stage/route.ts \
  app/api/health/route.ts \
  deploy-library-dedupe.command \
  deploy-telegram-audit-fix.command

git commit -m "fix(telegram): record real delivery instead of assuming it

telegram_stage_alerts logged a row whenever Telegram OR the in-app chat
mirror succeeded, and stored neither result. The mirror nearly always
succeeds, so a completely broken Telegram left behind a log identical to
a healthy one — and the dedupe check then treated the failed alert as
already announced, so it was never retried.

- sendToChatResult() returns Telegram's own error description ('chat not
  found', 'bot was kicked', a supergroup migration) and logs it. The
  boolean sendToChat() now wraps it, so every existing caller — EOD
  report, weekly scorecard, daily digest — gets the logging for free.
- telegram_stage_alerts stores groups_targeted, telegram_sent, mirrored
  and last_error. 'reached nobody' is now a queryable fact.
- Dedupe retries once when the previous attempt targeted groups and none
  of them accepted it.
- A department with no group mapped is logged as such rather than passing
  silently.
- /api/health (admin) reports 7-day delivery: delivered / failed /
  unrouted plus the last error.
- awaiting_admin now routes to the admin group; it was in no department
  map at all, so 5 jobs sat there with nobody told."

echo
echo "======================================================"
git log --oneline -1
echo "Committed. Now open GitHub Desktop and click 'Push origin'."
echo "======================================================"
echo
echo "Leave this window open — do not press any key."
