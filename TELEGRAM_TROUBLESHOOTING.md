# 🔧 TELEGRAM TROUBLESHOOTING CHECKLIST

## Use this to fix common issues

---

## ⚠️ ISSUE: Green Telegram button not visible

### **Check #1: Are you logged in as Admin or Finance?**
- Only Admin and Finance roles can see the button
- Check your role: Look at top-right corner of header
- If you're another role → Ask admin to change your role

**Fix:**
1. Go to: Settings → Users
2. Find your name
3. Change Role to: Admin or Finance
4. Logout and login again

---

### **Check #2: Are you on an admin page?**
- Button only shows inside `/admin/*` pages
- Won't show on login page or public pages

**Fix:**
- Navigate to: `/admin/dashboard`
- Look bottom-right corner

---

### **Check #3: Is Vercel deployment complete?**
- New code might still be deploying

**Fix:**
1. Go to: https://vercel.com/dashboard
2. Check deployment status
3. Wait for green checkmark ✅
4. Hard refresh browser (Ctrl+Shift+R)

---

### **Check #4: Browser console errors?**

**Fix:**
1. Press F12 (open developer tools)
2. Click "Console" tab
3. Look for red errors
4. Screenshot and share with me

---

## ⚠️ ISSUE: Telegram column not showing in Users page

### **Check #1: Is SQL migration applied?**

**Verify in Supabase:**
1. Go to: Supabase Dashboard → SQL Editor
2. Run this query:
   ```sql
   SELECT column_name 
   FROM information_schema.columns 
   WHERE table_name = 'profiles' 
   AND column_name LIKE 'telegram%';
   ```
3. Should show 3 rows:
   - telegram_chat_id
   - telegram_username
   - telegram_linked_at

**If empty:**
- Run: `supabase/STAFF_TELEGRAM_LINKING.sql` in SQL Editor
- Click "Run"
- Refresh page

---

### **Check #2: Is page cached?**

**Fix:**
1. Hard refresh: Ctrl+Shift+R (Windows) / Cmd+Shift+R (Mac)
2. Clear cache: Ctrl+Shift+Delete
3. Logout and login again

---

## ⚠️ ISSUE: "Get Link" button doesn't work

### **Check #1: Clipboard permission?**

**Fix:**
1. Browser might be blocking clipboard access
2. Try manually:
   - Open browser console (F12)
   - Type: `https://t.me/aayam_notify_bot?start=staff_YOUR_PROFILE_ID`
   - Replace YOUR_PROFILE_ID with actual ID from database

---

### **Check #2: Console errors?**

**Fix:**
1. Click "Get Link"
2. Open console (F12)
3. Look for errors
4. Screenshot and share

---

## ⚠️ ISSUE: Bot doesn't respond when staff taps START

### **Check #1: Is bot token set in Vercel?**

**Verify:**
1. Go to: Vercel Dashboard → Settings → Environment Variables
2. Look for: `NEXT_PUBLIC_TELEGRAM_BOT_TOKEN`
3. Value should be: `8352518034:AAHsiUcPAu3XEAF72bupxjpO1wCk0F9oHns`

**If missing:**
- Click "Add New"
- Name: `NEXT_PUBLIC_TELEGRAM_BOT_TOKEN`
- Value: `8352518034:AAHsiUcPAu3XEAF72bupxjpO1wCk0F9oHns`
- Environment: Production, Preview, Development (all 3)
- Save and Redeploy

---

### **Check #2: Is webhook working?**

**Test webhook:**
1. Open in browser: `https://your-app.vercel.app/api/telegram/webhook`
2. Should show: `{"status": "Telegram webhook active"}`

**If error:**
- Check Vercel deployment logs
- Check if route file exists: `app/api/telegram/webhook/route.ts`

---

### **Check #3: Is Supabase service role key set?**

**Verify in Vercel:**
1. Settings → Environment Variables
2. Look for: `SUPABASE_SERVICE_ROLE_KEY`
3. Should be a long string starting with `eyJ...`

**If missing:**
1. Go to: Supabase Dashboard → Settings → API
2. Copy: service_role key (secret)
3. Add to Vercel as `SUPABASE_SERVICE_ROLE_KEY`
4. Redeploy

---

### **Check #4: Did staff tap START button?**

**Common mistake:**
- Staff opens bot but doesn't tap START
- Bot shows a START button - they MUST tap it

**Fix:**
- Tell them: "Look for START button and tap it"
- Not just sending a message - must tap START first

---

## ⚠️ ISSUE: Link copied but staff says "link doesn't work"

### **Check #1: Is link complete?**

**Link looks like:**
```
https://t.me/aayam_notify_bot?start=staff_abc12345-6789-...
```

**Must include:**
- ✅ Full URL with https://
- ✅ `?start=staff_` part
- ✅ Complete UUID after staff_

**If broken:**
- Don't copy from screenshot
- Click "Get Link" again
- Paste directly into WhatsApp

---

### **Check #2: Is staff using correct Telegram app?**

**Requirements:**
- Must be official Telegram app
- Not Telegram X or Telegram Business
- Must be logged in

**Fix:**
- Ask them to install official Telegram
- Login with phone number
- Then try link again

---

### **Check #3: Is link expired?**

**Links don't expire** - but check:
- Was profile deleted from system?
- Was profile ID changed?

**Fix:**
- Generate new link from Users page
- Send again

---

## ⚠️ ISSUE: Staff linked but status shows "Get Link"

### **Check #1: Refresh page**

**Fix:**
- Wait 30 seconds
- Refresh page (F5)
- Should update automatically

---

### **Check #2: Check database**

**Verify in Supabase:**
1. Go to: Table Editor → profiles
2. Find staff member row
3. Check: telegram_chat_id column
4. Should have a number (e.g., "123456789")

**If empty:**
- Bot didn't save it
- Check webhook logs
- Try linking again

---

## ⚠️ ISSUE: Multiple people, same Telegram account

### **Problem:**
- Two profiles can't share one Telegram

**Fix:**
1. Find duplicate: 
   ```sql
   SELECT telegram_chat_id, COUNT(*) 
   FROM profiles 
   WHERE telegram_chat_id IS NOT NULL 
   GROUP BY telegram_chat_id 
   HAVING COUNT(*) > 1;
   ```
2. Unlink wrong profile:
   - Settings → Users → Click "unlink"
3. Link to correct profile

---

## ⚠️ ISSUE: Bell icon not showing

### **Check #1: Is notifications system deployed?**

**Verify SQL applied:**
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_name = 'notifications';
```

**If empty:**
- Run: `supabase/NOTIFICATIONS_SYSTEM.sql`
- Refresh page

---

### **Check #2: Check layout component**

**Verify:**
1. Bell icon is in header component
2. Header is imported in layout
3. No console errors

---

## ⚠️ ISSUE: Can't send messages from green button

### **Check #1: Are contacts linked?**

**Problem:**
- Clients/vendors need telegram_chat_id
- If not linked, won't appear in list

**Fix:**
1. Link clients first (same process as staff)
2. Or manually add telegram_chat_id in Supabase:
   - Table: clients
   - Column: telegram_chat_id
   - Value: Their Telegram chat ID

---

### **Check #2: Check console for errors**

**Fix:**
1. Open green Telegram panel
2. Open console (F12)
3. Look for API errors
4. Check network tab for failed requests

---

## 🆘 STILL STUCK?

### **Quick Diagnostic Test**

**Run all these in browser console (F12):**

```javascript
// Test 1: Check auth
console.log('Profile:', await (await fetch('/api/auth/profile')).json());

// Test 2: Check if button component exists
console.log('Telegram button:', document.querySelector('[aria-label*="Telegram"]'));

// Test 3: Check environment
console.log('Bot token exists:', !!process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN);

// Test 4: Check Supabase connection
console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
```

**Copy all output and share with me.**

---

## 📞 GET HELP

**If none of this works:**

1. **Screenshot these:**
   - Browser console (F12 → Console tab)
   - Network tab (F12 → Network)
   - What you see vs what you expect

2. **Tell me:**
   - Which test in TELEGRAM_QUICK_TEST.md failed?
   - What error message you see?
   - Your role (admin/finance/etc)
   - Browser name and version

3. **Share:**
   - Vercel deployment URL
   - Recent deployment logs from Vercel

**I'll help you fix it!** 🚀

---

## ✅ AFTER FIXING

Once everything works:

1. **Link 2-3 staff members** (test the process)
2. **Send test message** to linked client
3. **Generate links for rest of team**
4. **Tell me when ready** for Phase 2 (auto notifications)

**Phase 2 adds:**
- Auto job notifications
- Designer gets alerted when job assigned
- CMYK gets alerted when print ready
- Dispatch gets alerted when delivery ready

**Want Phase 2 now?** Let me know! 🎯
