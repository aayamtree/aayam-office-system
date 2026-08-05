# Connecting Zoho Books to the office app

Three steps, about five minutes. Do these yourself — they involve a secret that
should not pass through a chat window or sit in a transcript.

---

## Step 1 — Copy the two credentials from Zoho

The API client is already created for you. It's called **Aayam Office System**.

1. Go to **https://api-console.zoho.com**
2. Click **Aayam Office System** → the **Client Secret** tab
3. You'll see two values: **Client ID** and **Client Secret**

Leave this tab open for step 2.

---

## Step 2 — Put them into Vercel

1. Go to **https://vercel.com** → project **aayam-office-system**
2. **Settings** → **Environment Variables**
3. Add these two, for **Production**:

   | Name | Value |
   |---|---|
   | `ZOHO_CLIENT_ID` | the Client ID from step 1 |
   | `ZOHO_CLIENT_SECRET` | the Client Secret from step 1 |

4. Click **Save**
5. Go to the **Deployments** tab → newest deployment → **⋯** → **Redeploy**

   (Environment variables are only picked up on a fresh build. Skipping this
   makes step 3 fail with "not configured".)

---

## Step 3 — Connect

Once the redeploy finishes:

1. Sign in to the app as admin
2. Visit **https://aayam-office-system.vercel.app/api/zoho/oauth/start**
3. Zoho shows a consent screen — it will ask to allow **read-only** access to
   banking, invoices, estimates and settings. Click **Accept**.
4. You'll land back on the **Zoho Books** page with "Zoho Books connected."

That's it. From then on:

- Bank transactions sync automatically at **10:00 AM and 6:00 PM** every day
- You can force a sync anytime by visiting
  `/api/cron/zoho-bank-sync?debug=1` while signed in as admin

---

## What this does and does not do

**Does:** pulls the last 60 days of HDFC transactions from Zoho into the app,
carrying the category you assigned in Zoho. Re-running is safe — lines update
in place, they never duplicate.

**Does not:** change anything in Zoho. The access is read-only by design, so
even if this connection leaked, nobody could alter your books through it.

**Where to categorise:** still in Zoho, as you do now. The app shows the result.
Anything you have not categorised yet appears with an amber "uncategorised" tag
so you can see what is outstanding.

---

## If something goes wrong

The Bank Feed tab shows the last sync time at the bottom right, and says
**FAILED** with the reason if the last run did not work. That line is the first
place to look — a sync that quietly stopped is meant to be visible, not silent.
