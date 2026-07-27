# Credential Rotation Runbook — 26 July 2026

## What happened

The file `local/env-for-accountant-pc.txt` was committed to the Git repository with **real, working credentials** inside it. It has been in the repo's history since it was first added, which means:

- Every clone of the repo contains these keys — including the accountant's PC.
- Deleting the file today does **not** remove it from history. Anyone with the repo can still recover it.
- The repository appears to be **private**, which limits exposure to people with access. That reduces the urgency but does not remove the need to rotate.

The five keys below must be treated as compromised and replaced.

| # | Key | What it can do if abused | Priority |
|---|-----|--------------------------|----------|
| 1 | `ANTHROPIC_API_KEY` | Spend money on your Anthropic account | **Do first** |
| 2 | `TELEGRAM_BOT_TOKEN` | Full control of your bot: read and send messages to every staff group | **Do first** |
| 3 | `GOOGLE_CLIENT_SECRET` | Impersonate your app in Google OAuth flows | High |
| 4 | `VAPID_PRIVATE_KEY` | Send fake push notifications to staff phones | Medium |
| 5 | `NEXTAUTH_SECRET` | Forge session tokens (only matters if NextAuth is still in use) | Medium |

A sixth item, the **GitHub personal access token**, is stored in plaintext in your local `.git/config` on this Mac. It is not in the repo, but it grants full push access and should also be replaced. See step 6.

---

## Before you start

Keep two browser tabs open the whole time:

- **Vercel → your project → Settings → Environment Variables**
- Whichever provider console you're on for the current step

The pattern for every key is the same: **generate the new value → paste it into Vercel → redeploy → then revoke the old one.** Revoking first will cause a short outage.

---

## Step 1 — Anthropic API key

1. Go to <https://console.anthropic.com/settings/keys>.
2. Click **Create Key**, name it something like `aayam-office-jul2026`, and copy the value. You only get to see it once.
3. In Vercel, edit `ANTHROPIC_API_KEY` and paste the new value. Save.
4. Back in the Anthropic console, **delete** the old key.
5. While you're there, check **Usage** for any spending you don't recognise.

---

## Step 2 — Telegram bot token

1. Open Telegram and message **@BotFather**.
2. Send `/mybots`, choose your Aayam bot.
3. Choose **API Token → Revoke current token**. BotFather immediately gives you a new one.
4. Copy the new token into Vercel. It appears in **two** variables — update both:
   - `TELEGRAM_BOT_TOKEN`
   - `NEXT_PUBLIC_TELEGRAM_BOT_TOKEN`
5. Redeploy, then send a test message from the app to confirm alerts still arrive.

> **Note:** `NEXT_PUBLIC_` variables are bundled into the browser JavaScript and are readable by anyone who opens your site. A bot token should not be one of them. I'd suggest we remove the `NEXT_PUBLIC_` copy entirely and route all Telegram calls through the server — say the word and I'll do it.

---

## Step 3 — Google OAuth client secret

1. Go to <https://console.cloud.google.com/apis/credentials> and select the Aayam project.
2. Open the OAuth 2.0 Client ID your app uses.
3. Click **Add Secret** to create a second secret, then paste it into Vercel as `GOOGLE_CLIENT_SECRET`.
4. Redeploy. Test the Google Drive connect flow.
5. Once it works, come back and **delete the old secret**.

Adding before deleting means no downtime if something goes wrong.

---

## Step 4 — VAPID keys (push notifications)

These are a matched pair, so both change together.

1. In a terminal, run: `npx web-push generate-vapid-keys`
2. Update **both** in Vercel:
   - `VAPID_PRIVATE_KEY` → the new private key
   - `NEXT_PUBLIC_VAPID_PUBLIC_KEY` → the new public key
3. Redeploy.

> Rotating VAPID keys **invalidates every existing push subscription**. Staff will need to re-enable notifications once. Expect the `push_subscriptions` table to fill with dead rows — tell me when you've done this and I'll write the cleanup.

---

## Step 5 — NextAuth secret

1. Generate one: `openssl rand -base64 32`
2. Paste into Vercel as `NEXTAUTH_SECRET`. Redeploy.

This logs out any active NextAuth sessions. Your app authenticates through Supabase, so this is likely harmless — but do it at a quiet time to be safe.

---

## Step 6 — GitHub personal access token

Your local `.git/config` has a token embedded in the remote URL, in plaintext.

1. Go to <https://github.com/settings/tokens> and **delete** the token beginning `ghp_EU79...`.
2. Create a replacement, or better, switch to SSH keys so no token is stored on disk.
3. Update the remote so the token isn't sitting in a config file:

```bash
cd "/Users/satish/Desktop/01 PROJECT/OFFICE SYSTEM 2/aayam-office-2"
git remote set-url origin https://github.com/aayamtree/aayam-office-system.git
```

Git will then ask for credentials via the macOS keychain instead of keeping them in a file.

---

## Step 7 — Purge the file from Git history

The file is deleted going forward, but still recoverable from old commits. To scrub it properly:

```bash
# from a fresh clone, not your working folder
brew install git-filter-repo
git clone https://github.com/aayamtree/aayam-office-system.git scrub && cd scrub
git filter-repo --path local/env-for-accountant-pc.txt --invert-paths
git push origin --force --all
```

**Read this before running it:** a force-push rewrites history. Every existing clone (yours, the accountant's PC, any other machine) becomes incompatible and must be re-cloned. Nothing is lost, but anyone mid-work will be disrupted.

If that sounds risky, it's reasonable to skip it — **as long as you complete steps 1–6.** Once every key in the file is dead, the file is just a list of expired strings and the history is harmless.

---

## Step 8 — Set up the accountant PC properly

The reason this file existed was to hand env vars to another machine. Better options, in order of preference:

1. **Don't run a second copy.** Have the accountant use the hosted Vercel app in a browser.
2. If a local copy is genuinely needed, put the values in a `.env.local` file created **by hand on that machine**, sent over a password manager or Signal — never through the repo.

`.env*` and `*.env` are now in `.gitignore`, so this can't recur by accident.

---

## Checklist

- [ ] Anthropic key rotated, old one deleted, usage reviewed
- [ ] Telegram token revoked via BotFather, both Vercel vars updated, alerts tested
- [ ] Google client secret rotated, Drive connect tested, old secret deleted
- [ ] VAPID pair regenerated, staff told to re-enable notifications
- [ ] NextAuth secret replaced
- [ ] GitHub token deleted, remote URL cleaned
- [ ] (Optional) History purged with git-filter-repo
- [ ] Accountant PC moved off the committed env file
