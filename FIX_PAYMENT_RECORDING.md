# Payment Recording Bug Fix - Database Functions Missing

## Problem
When you try to record a payment, it fails silently because the database functions `record_payment_received` and `record_vendor_payment` don't exist in your Supabase database.

**Error in Console:**
```
404 - rpc/record_payment_received not found
```

## Solution
You need to create these database functions in Supabase.

## Steps to Fix

### 1. Open Supabase SQL Editor
1. Go to https://supabase.com
2. Select your **Aayam Office System** project
3. Click **SQL Editor** in the left menu

### 2. Run the SQL File
1. Copy the contents of `SCHEMA_PAYMENT_FUNCTIONS.sql`
2. Paste it into the SQL editor
3. Click **Run** or press `Ctrl/Cmd + Enter`

### 3. Verify Functions Were Created
Run this query to check:
```sql
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_name IN ('record_payment_received', 'record_vendor_payment');
```

You should see both functions listed.

### 4. Test Payment Recording
1. Go to your live app: https://aayam-office-system-a7nk.vercel.app
2. Navigate to **Sales & Finance → Payments**
3. Click **Record Payment**
4. Fill in the form and submit
5. The payment should now appear in the list! ✅

## What These Functions Do

### `record_payment_received()`
- Generates a unique payment number (e.g., `REC-101`)
- Creates a payment received record
- If linked to an invoice:
  - Updates `amount_received`
  - Calculates  new `balance_due`
  - Updates `payment_status` (pending → partial → paid)

### `record_vendor_payment()`
- Generates a unique payment number (e.g., `PAY-101`)
- Creates a vendor payment record  
- If linked to a purchase bill:
  - Updates `amount_paid`
  - Updates `payment_status`

## Alternative: Direct Insert (If Functions Don't Work)

If the functions cause issues, I can modify the code to use direct INSERT instead of RPC calls. Let me know if you need this approach.

## Files Modified
- ✅ `SCHEMA_PAYMENT_FUNCTIONS.sql` - New SQL file with functions
- ✅ `app/admin/finance/payments/page.tsx` - Already updated with refetch fix

## Next Steps
1. Run the SQL in Supabase
2. Test payment recording
3. If it still doesn't work, check the browser console for new errors and let me know
