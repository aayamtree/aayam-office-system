# 📱 Telegram Work Hub - Complete User Guide
## Aayam Creative Internal Communication System

---

## 🚀 QUICK START - 3 Steps to Get Running

### Step 1: Link Staff Accounts (Admin Does This)
### Step 2: Test Sending Messages
### Step 3: Train Your Team

---

## 📋 STEP 1: LINK STAFF ACCOUNTS

### **A. Open Team Management Page**

1. Login to admin panel: https://your-app.vercel.app/admin
2. Click: **Settings** (in sidebar)
3. Click: **Users** (in settings menu)
4. You'll see: Team Management page with all staff

---

### **B. Generate Telegram Link for Staff Member**

**What you'll see:**

```
┌─────────────────────────────────────────────────────────────────┐
│ Team Management                                                  │
├─────────────────────────────────────────────────────────────────┤
│ User              Role      Can Design   Telegram        Status │
├─────────────────────────────────────────────────────────────────┤
│ 👤 Satish        Admin      [toggle]     [Get Link]      Active │
│    satish@...                                                    │
├─────────────────────────────────────────────────────────────────┤
│ 👤 Pradeep       CMYK       [toggle]     [Get Link]      Active │
│    pradeep@...                                                   │
└─────────────────────────────────────────────────────────────────┘
```

**What to do:**

1. Find the staff member (e.g., Pradeep)
2. Click blue **"Get Link"** button in Telegram column
3. Toast appears: "Telegram link copied for Pradeep! Send via WhatsApp."
4. Link is now in your clipboard

---

### **C. Send Link to Staff Member**

**Option 1: WhatsApp (Recommended)**
1. Open WhatsApp
2. Find staff member's chat
3. Paste the link (Ctrl+V / Cmd+V)
4. Add message: "Hi! Tap this link to connect your Telegram for job notifications"
5. Send

**Option 2: SMS**
1. Open Messages app
2. Paste link
3. Send

**Option 3: In Person**
1. Show them the link on your phone
2. They can type it in their browser
3. It will redirect to Telegram

---

### **D. Staff Member Links Their Account**

**What staff member does:**

1. **Receives link** (looks like):
   ```
   https://t.me/aayam_notify_bot?start=staff_abc123...
   ```

2. **Taps the link** on phone
   - Phone asks: "Open in Telegram?"
   - Tap: "Open"

3. **Telegram opens** showing:
   ```
   ┌────────────────────────────┐
   │  Aayam Notify Bot          │
   ├────────────────────────────┤
   │                            │
   │  [START]  ← Tap this       │
   │                            │
   └────────────────────────────┘
   ```

4. **Staff taps START button**

5. **Bot replies immediately:**
   ```
   ✅ Linked! You are now connected as Pradeep

   Role: cmyk

   You'll receive job notifications, assignments, 
   and updates here. 🚀
   ```

6. **Done!** They're linked.

---

### **E. Verify Link on Admin Panel**

**Go back to Team Management page:**

```
┌─────────────────────────────────────────────────────────────────┐
│ User              Role      Can Design   Telegram        Status │
├─────────────────────────────────────────────────────────────────┤
│ 👤 Satish        Admin      [toggle]     [Get Link]      Active │
├─────────────────────────────────────────────────────────────────┤
│ 👤 Pradeep       CMYK       [toggle]     ✓ Linked        Active │
│    pradeep@...                            @pradeep               │
│                                           unlink                 │
└─────────────────────────────────────────────────────────────────┘
```

**Now shows:**
- ✓ Green checkmark "Linked"
- Their Telegram username "@pradeep"
- "unlink" option if you need to remove it

---

## 📤 STEP 2: SEND MESSAGES TO CLIENTS/VENDORS

### **A. Find the Green Telegram Button**

**Where is it?**
- Look at **bottom-right corner** of any page
- You'll see: **Green button with "Telegram" text**
- It floats over the page (always visible)

```
                                          ┌──────────────┐
                                          │  Telegram    │
                                          │     📱       │
                                          └──────────────┘
                                                ↑
                                          Bottom-right
                                          corner
```

---

### **B. Open Telegram Panel**

**Click the green button**

Panel slides in from right:

```
┌─────────────────────────────────────────┐
│  Send Telegram Message            [X]   │
├─────────────────────────────────────────┤
│  🔍 Search contacts...                  │
├─────────────────────────────────────────┤
│  📋 Quick Templates:                    │
│  ○ Order Ready                          │
│  ○ Payment Received                     │
│  ○ Payment Reminder                     │
│  ○ Delivery Update                      │
│  ○ Custom Message                       │
├─────────────────────────────────────────┤
│  📇 Contact List:                       │
│                                         │
│  👤 ABC Foods (Client)                  │
│     Linked ✓                            │
│                                         │
│  👤 Ramesh Traders (Client)             │
│     Not linked                          │
│                                         │
│  👤 Paper Supplier (Vendor)             │
│     Linked ✓                            │
└─────────────────────────────────────────┘
```

---

### **C. Search for Client/Vendor**

**In the search box:**
1. Type: Client name (e.g., "ABC")
2. List filters automatically
3. Only shows linked contacts
4. Click on the contact

---

### **D. Choose Template or Write Custom**

**Option 1: Use Quick Template**

Select template radio button:
- 📦 **Order Ready** - "Your order is ready for pickup"
- 💰 **Payment Received** - "Payment of ₹X received. Thank you!"
- ⚠️ **Payment Reminder** - "Gentle reminder: Payment pending"
- 🚚 **Delivery Update** - "Your order will be delivered today"

**Option 2: Custom Message**

1. Select: ✏️ **Custom Message**
2. Text area appears
3. Type your message
4. Click: **Send Message** button

---

### **E. Send Message**

**After clicking Send:**
1. Loading spinner shows
2. Toast appears: "Message sent to ABC Foods!"
3. Panel closes automatically

**Client receives:**
```
┌────────────────────────────────┐
│  Aayam Notify Bot              │
├────────────────────────────────┤
│  💰 Payment Received           │
│                                │
│  Dear Customer,                │
│                                │
│  We have received your         │
│  payment of ₹5,000.            │
│                                │
│  Thank you for your business!  │
│                                │
│  - Aayam Creative              │
└────────────────────────────────┘
```

---

## 🔔 STEP 3: IN-APP NOTIFICATIONS (Bell Icon)

### **A. Where is the Bell Icon?**

**Location:** Top-right corner of header (next to user profile)

```
┌──────────────────────────────────────────────────────┐
│  Aayam Office System              🔔(2)  👤 Satish  │
│                                     ↑                │
│                                  Bell with           │
│                                  red badge           │
└──────────────────────────────────────────────────────┘
```

**Red badge = Unread count**

---

### **B. Click Bell to See Notifications**

**Dropdown opens:**

```
┌─────────────────────────────────────────┐
│  Notifications                 Mark all │
│                                as read  │
├─────────────────────────────────────────┤
│  🎨 New job assigned to you             │
│     Job #1042 - ABC Foods               │
│     2 minutes ago                       │
├─────────────────────────────────────────┤
│  💰 Payment received                    │
│     ₹5,000 from Ramesh Traders          │
│     1 hour ago                          │
├─────────────────────────────────────────┤
│  ⏰ Deadline approaching                │
│     Job #1038 due tomorrow              │
│     5 hours ago                         │
└─────────────────────────────────────────┘
```

---

### **C. Notification Actions**

**Click on notification:**
- Takes you to relevant page (job detail, payment, etc.)
- Marks as read automatically

**Mark all as read:**
- Click "Mark all as read" at top
- Badge disappears

---

## 🎯 WHO SEES WHAT?

### **Green Telegram Button (External Messaging)**
**Who can see:** Admin, Finance only  
**Purpose:** Message clients/vendors  
**Where:** Bottom-right corner (all pages)

### **Bell Icon (Internal Notifications)**
**Who can see:** All staff  
**Purpose:** Personal job alerts  
**Where:** Header (top-right)

---

## ❓ COMMON QUESTIONS

### **Q: Why can't I see any contacts in Telegram button?**
**A:** Contacts need to be linked first:
1. Go to Clients page → Click client → Edit
2. Look for "Telegram Chat ID" field
3. Follow linking process (same as staff linking)

OR wait for Phase 2 implementation (client linking UI)

---

### **Q: Staff member says link doesn't work**
**A:** Check these:
1. Did they tap START button in Telegram?
2. Is their phone number registered in Telegram?
3. Did you copy the full link (it's very long)?
4. Try generating link again

---

### **Q: How do I unlink someone?**
**A:** 
1. Go to: Settings → Users
2. Find staff member with "Linked" status
3. Click "unlink" next to their name
4. Confirm

---

### **Q: Can staff reply to bot messages?**
**A:** Not yet! Coming in Phase 3:
- Staff will be able to reply "done 1042" to mark job complete
- Reply "queue" to see pending jobs
- Reply "status 1042" to check job status

---

### **Q: Do we need to link vendors/suppliers?**
**A:** Yes, same process:
1. Get their Telegram number
2. Generate link from vendor page (coming soon)
3. Send via WhatsApp
4. They tap and START

---

### **Q: What if someone doesn't have Telegram?**
**A:** 
1. Ask them to install Telegram app (free)
2. They create account with phone number
3. Then follow linking process

Telegram is very popular in India - most people already have it!

---

## 🚨 TROUBLESHOOTING

### **Problem: "Get Link" button not showing**

**Solution:**
1. Check if you're logged in as Admin
2. Clear browser cache (Ctrl+Shift+Delete)
3. Hard refresh page (Ctrl+Shift+R)
4. Check if SQL migration was run in Supabase

---

### **Problem: Green Telegram button missing**

**Solution:**
1. Check your role (only Admin/Finance see it)
2. Check if you're on an admin page
3. Check browser console for errors (F12)
4. Verify environment variable in Vercel

---

### **Problem: Bot doesn't reply when staff taps START**

**Solution:**
1. Check Telegram webhook is registered:
   - Open: https://your-app.vercel.app/api/telegram/webhook
   - Should show: `{"status": "Telegram webhook active"}`
2. Check Vercel deployment logs
3. Verify bot token in environment variables
4. Test bot manually: Open @aayam_notify_bot and send any message

---

### **Problem: Staff linked but doesn't receive notifications**

**Solution:**
1. Verify they're linked: Settings → Users → Check green checkmark
2. Check notification is being triggered (Phase 2 needed)
3. Check bot isn't blocked by user
4. Check user hasn't muted bot

---

## 📞 SUPPORT

**If you're stuck:**
1. Check this guide again
2. Check browser console (F12 → Console tab)
3. Check Vercel deployment logs
4. Ask me! I'm here to help.

---

## 🎉 NEXT FEATURES (Coming Soon)

**Phase 2: Auto Notifications** (Ready to build)
- Designer gets alert when job assigned
- CMYK gets alert when job ready to print
- QC gets alert when print done
- Dispatch gets alert when job ready

**Phase 3: Bot Commands** (Ready to build)
- Staff replies to bot to update status
- Check pending work list
- Mark jobs complete from phone

**Phase 5: Morning Briefing** (Ready to build)
- Everyone gets day's work at 8:30 AM
- Personalized by role
- No more "what do I do today?" questions

---

**Want me to build Phase 2 now?** Let me know! 🚀
