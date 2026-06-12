# Aayam Office — Local Network Setup Guide

## What This Does

Runs the Aayam Office app entirely on your office LAN.  
**No static IP. No Vercel. No internet needed for the app to load.**

Staff open: **http://aayam.local:3000**  
Files server: **http://aayam-files.local:3001**

These names work on any device (PC, laptop, phone) connected to the same WiFi/network.

---

## One-Time Setup (Do This Once on the Office Server PC)

### Step 1 — Install Node.js (if not already)
Download from: https://nodejs.org  
Choose the LTS version.

### Step 2 — Install Docker (for local Supabase — optional but recommended)
Download from: https://docker.com/products/docker-desktop  
This lets the database run locally too.

### Step 3 — Get the App Files
Copy the entire `aayam-office-2` folder to the server PC.  
Put it somewhere permanent, e.g. `C:\AayamOffice\`

### Step 4 — Configure Environment
In the app folder, create a file called `.env.local` with:

```env
# If using Supabase cloud (internet needed for DB only):
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-key

# If using local Supabase (see Step 6 below — full offline):
# NEXT_PUBLIC_SUPABASE_URL=http://aayam.local:8000
# NEXT_PUBLIC_SUPABASE_ANON_KEY=your-local-anon-key
# SUPABASE_SERVICE_ROLE_KEY=your-local-service-key

# Keep Telegram for notifications (optional)
TELEGRAM_BOT_TOKEN=your-token

# Local app settings
NEXTAUTH_SECRET=any-random-32-char-string
NEXTAUTH_URL=http://aayam.local:3000
```

### Step 5 — First Build & Start

**On Windows:** Double-click `local/START-WINDOWS.bat`

**On Mac:** Double-click `local/START-MAC.command`

First run builds the app (takes 2-3 minutes). After that, starts in seconds.

### Step 6 — Start the File Server (separate window)
```
cd aayam-file-server
npm install
npm start
```

---

## Daily Use

**To start the office server every morning:**  
Double-click `local/START-WINDOWS.bat` (or START-MAC.command)

That's it. Keep the window open while office is running.

**Staff on any PC/phone on same WiFi:**  
Open browser → type `aayam.local:3000` → done.

---

## Optional: Full Offline (Local Supabase Database)

This removes ALL internet dependency. Database runs on your office PC.

### Install Local Supabase

```bash
# In the app folder:
npm install -g supabase
supabase init
supabase start
```

Supabase will print local URLs like:
```
API URL: http://localhost:54321
anon key: eyJh...
service_role key: eyJh...
```

### Migrate Data from Cloud to Local

```bash
# Export from cloud
supabase db dump --db-url "postgres://postgres:[password]@db.[project].supabase.co:5432/postgres" > backup.sql

# Import to local
supabase db push --local
psql postgresql://postgres:postgres@localhost:54322/postgres < backup.sql
```

### Update .env.local

Change URLs to local:
```env
NEXT_PUBLIC_SUPABASE_URL=http://aayam.local:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=[local anon key from above]
SUPABASE_SERVICE_ROLE_KEY=[local service key from above]
```

Rebuild the app: `npm run build`

**After this — zero internet needed for any office operation.**

---

## What Still Needs Internet (After Full Setup)

| Feature | Internet? | Notes |
|---|---|---|
| App loading | No | Runs local |
| All data (jobs, clients, invoices) | No | Local DB |
| Login / auth | No | Local auth |
| File uploads | No | aayam-files.local |
| Team chat | No | Local realtime |
| **Telegram notifications** | Yes | Optional, fails silently |
| **Google Drive backup** | Yes | Optional |
| **AI print analysis** | Yes | Optional |

---

## Troubleshooting

**"aayam.local" not working on a staff PC:**
- Make sure that PC is on the same WiFi/network as the server
- Try the direct IP instead: ask the server PC's IP from `ipconfig` (Windows) or `ifconfig` (Mac)
- Windows: Install Bonjour from Apple (comes with iTunes)

**App won't start:**
- Make sure you ran `npm run build` first
- Check `.env.local` exists and has the Supabase keys

**File server not accessible:**
- Make sure `aayam-file-server` is running (separate window)
- Check Windows Firewall allows port 3001

**Database connection errors:**
- With cloud Supabase: check internet connection
- With local Supabase: check `supabase status` shows it running
