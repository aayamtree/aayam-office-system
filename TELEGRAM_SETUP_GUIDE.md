# 📱 Telegram Notification Setup Guide

## Overview

Your Aayam Office System now sends **dual notifications**:
- 📱 **Telegram** (instant, on your phone)
- 💻 **In-App** (bell icon in header)

---

## 🔧 Setup Instructions

### **Step 1: Link Your Telegram Account**

**For Each Staff Member:**

1. **Open Telegram** on your phone
2. **Search for:** `@aayam_notify_bot`
3. **Click "Start"** button
4. Bot will send: "Welcome! Send /connect to link your account"
5. **Type:** `/connect`
6. Bot will give you a **6-digit code**

7. **In Office System:**
   - Go to **Settings** → **Profile**
   - Find "Telegram Integration"
   - Enter the 6-digit code
   - Click "Connect"
   - ✅ You're connected!

---

## 🔔 What Notifications You'll Get

### **Designers**
- 🎨 New job assigned
- ⏰ Deadline reminders
- ✅ Design approved
- ❌ Revisions requested

### **Dispatch Team**
- 📦 QC ready for jobs
- 🚚 Delivery reminders
- ✅ QC passed/failed updates

### **Finance Team**
- 💰 Payment received
- 📄 Invoice generated
- ⚠️ Payment overdue

### **Marketing Team**
- 📞 Follow-up reminders
- 🆕 New lead assigned
- ✅ Lead converted

### **Admin**
- 📊 All notifications
- ⚠️ System alerts
- 📈 Daily summaries

---

## 💬 How to Use

### **In-App (Desktop/Laptop)**
- Bell icon in header shows notification count
- Click bell to see all notifications
- Click notification to go to relevant page
- Mark as read or mark all read

### **Telegram (Mobile)**
- Instant notifications on your phone
- Works even when app is closed
- No need to check the app constantly
- Two-way: can reply to some notifications

---

## 🔧 Troubleshooting

### **Not Receiving Notifications?**

1. **Check if connected:**
   - Settings → Profile → Telegram Integration
   - Should show "Connected" with your Telegram username

2. **Relink account:**
   - In Telegram, type: `/disconnect`
   - Then type: `/connect` again
   - Enter new code in Settings

3. **Check Telegram settings:**
   - Open Telegram
   - Settings → Notifications
   - Ensure notifications are enabled for Aayam Bot

### **Getting Too Many Notifications?**

You can customize in Settings:
- Turn off specific notification types
- Change priority filters
- Set quiet hours

---

## 🚀 Admin Setup (Already Done)

✅ Telegram Bot created (@aayam_notify_bot)  
✅ Bot token configured  
✅ Database tables created  
✅ Notification service integrated  
✅ In-app bell component added  

---

## 📋 For Admins: Manual Telegram Linking

If automatic linking doesn't work, you can manually link users:

1. **Get user's Telegram Chat ID:**
   - Ask them to message the bot
   - Check bot logs or use /getid command

2. **In Supabase:**
   ```sql
   INSERT INTO user_telegram (user_id, telegram_chat_id, telegram_username, is_active)
   VALUES (
     'user-uuid-here',
     '123456789',
     '@username',
     TRUE
   );
   ```

---

## 🔐 Security & Privacy

- ✅ Notifications are **user-specific** (no one else sees them)
- ✅ Telegram chat IDs are **encrypted**
- ✅ Can disconnect anytime
- ✅ No sensitive data sent via Telegram (only summaries)
- ✅ Full details only in app

---

## 📞 Support

**Issues with notifications?**
- Contact: IT Admin
- Or check: Settings → Help & Support

**Want to disable Telegram?**
- Settings → Profile → Telegram Integration → Disconnect

---

## 🎯 Benefits

✅ **Never miss important updates**  
✅ **Faster response times**  
✅ **Work from anywhere**  
✅ **Less time checking app**  
✅ **Mobile-friendly for dispatch staff**  
✅ **Free (no SMS costs)**  

---

**Enjoy your new notification system!** 🎉
