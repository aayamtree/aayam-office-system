# AAYAM OFFICE - SETUP GUIDE

## Step 1: Create Supabase Project

1. Go to https://supabase.com
2. Click **New Project**
3. Name: `aayam-office`
4. Region: `South Asia (Mumbai)`
5. Save your **Database Password**
6. Wait 2 minutes for project creation

---

## Step 2: Get Your Credentials

1. Go to **Settings** → **API**
2. Copy these values:
   - **Project URL** (looks like `https://xxxxx.supabase.co`)
   - **anon public** key (long string starting with `eyJ...`)

---

## Step 3: Update .env.local

Open `.env.local` file and replace with your values:

```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY_HERE
```

---

## Step 4: Create Database Tables

1. Go to Supabase → **SQL Editor**
2. Open file `supabase/SETUP.sql` from this project
3. Copy ALL contents
4. Paste in SQL Editor
5. Click **Run**

---

## Step 5: Create Login User

1. Go to Supabase → **Authentication** → **Users**
2. Click **Add user** → **Create new user**
3. Enter:
   - Email: `info@aayam.com`
   - Password: `aayam@123`
   - ✅ Check **Auto Confirm User**
4. Click **Create user**
5. **Copy the User ID** (UUID in first column)

---

## Step 6: Create Profile

Go to **SQL Editor** and run:

```sql
INSERT INTO profiles (id, email, full_name, role)
VALUES ('PASTE_USER_ID_HERE', 'info@aayam.com', 'Admin', 'admin');
```

Replace `PASTE_USER_ID_HERE` with the UUID you copied.

---

## Step 7: Run the App

```bash
cd aayam-office-2
npm install
npm run dev -- -H 0.0.0.0
```

Open: http://localhost:3000

Login: `info@aayam.com` / `aayam@123`

---

## Done! 🎉
