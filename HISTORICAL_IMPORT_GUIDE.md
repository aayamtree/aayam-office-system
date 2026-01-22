# Historical Bank Data Import Guide

## Overview
Import your entire current Financial Year (April 2025 - March 2026) bank statements to test the system before going live with the new FY on April 1, 2026.

## Step-by-Step Process

### 1. Export Bank Statements from HDFC

1. Login to **HDFC NetBanking**
2. Go to **Statements → Account Statements**
3. Select date range: **01-04-2025 to 31-03-2026** (or current date)
4. Download as **Excel** (.xls or .xlsx)
5. Open in Excel

### 2. Prepare Data for Import

Your Excel should have columns like:
```
Date | Narration/Description | Chq./Ref.No | Value Date | Withdrawal(Dr) | Deposit(Cr) | Balance
```

**Important:**
- Keep header row
- Date format: DD/MM/YY or DD/MM/YYYY
- Amount columns should have numbers (commas OK, system removes them)

### 3. Import to Aayam System

1. **Navigate:** Finance → Reconciliation (`/admin/finance/banking`)
2. **Select Account:** Choose your HDFC account from dropdown
3. **Click:** "Import Statement" button
4. **Copy Data:**
   - In Excel, select ALL transaction rows (including headers)
   - Copy (Ctrl+C / Cmd+C)
5. **Paste:**
   - Click "Paste from Clipboard" OR
   - Press Ctrl+V / Cmd+V directly in the text area
6. **Process:** Click "Process & Import"

### 4. Review Imported Transactions

System will show:

- ✅ **Green (Matched)** - Transaction matches a payment you've already recorded
- ❌ **Red (Missing)** - Transaction exists in bank but NOT in system
- 👁️ **Gray (Ignored)** - Transactions you've marked to ignore

### 5. Handle Missing Transactions

For **RED (Missing)** transactions, you have options:

**Option A: Ignore It** (for non-business transactions)
- Click the 👁️ Eye-Off icon
- Use for: SMS charges, personal transfers, bank fees, etc.

**Option B: Record The Payment** (for business transactions)
1. Note the amount, date, and description
2. Go to Finance → Payments
3. Record the payment properly
4. Return to reconciliation - it should now be GREEN

**Option C: Quick Expense** (for expenses)
1. Use the new Quick Expense Entry feature
2. Select appropriate category
3. System automatically links it

## Best Practices

### Import in Batches
Instead of 10 months at once, import month by month:
1. April 2025
2. May 2025
3. June 2025
... and so on

This makes it easier to reconcile and fix issues.

### Set Opening Balance First
1. Go to Finance → Opening Balance
2. Enter your bank balance as of **April 1, 2025**
3. This ensures calculations are correct

### Record Major Payments First
Before importing bank statement:
1. Record all major client payments (invoices)
2. Record all major vendor payments
3. Then import bank statement
4. System will auto-match most transactions

## Sample Import Format

Here's what your pasted data should look like:

```
17/10/25	Payment received from CLIENT NAME	TRN0001	17/10/25	0	30,356.00	188,201.00
18/10/25	Vendor payment - SUPPLIES	CHQ123	18/10/25	15,000.00	0	173,201.00
19/10/25	UPI-CLIENT2 LTD	UPI8765	19/10/25	0	45,000.00	218,201.00
```

## Troubleshooting

### "Could not parse any transactions"
- Check date format (should be DD/MM/YY or DD/MM/YYYY)
- Ensure columns are tab or comma separated
- Verify you have Debit and Credit columns

### Dates importing incorrectly
- System expects DD/MM/YY format
- If your bank uses different format, adjust in Excel first
- Format cells as Text before copying

### Amounts not correct
- Remove currency symbols (₹)
- Commas in amounts are OK (system removes them)
- Use proper Debit/Credit columns (Withdrawal/Deposit)

## Timeline Strategy

### January 2026 (Now)
- Import April-Dec 2025 statements
- Reconcile major transactions
- Ignore irrelevant entries

### February 2026
- Import January 2026 statement
- Continue daily recording of new transactions
- Train all staff on system

### March 2026
- Import February-March statements
- Final testing
- Fix any remaining issues
- Prepare for FY transition

### April 1, 2026
- **GO LIVE** with new Financial Year
- Fresh start with all staff trained
- System tested with 10+ months of real data

## Benefits of This Approach

✅ **Test with Real Data** - Not dummy/sample data  
✅ **Train Staff** - 2 months to get comfortable  
✅ **Find Issues** - Fix problems before new FY  
✅ **Verify Calculations** - Ensure balances match bank  
✅ **Build Confidence** - Staff trusts the system  
✅ **Clean Start** - April 1 begins perfectly  

## Support

If you encounter issues:
1. Check transaction format matches expected columns
2. Verify bank account is selected
3. Ensure dates are in DD/MM/YY format
4. Try smaller batches (1 month at a time)

---

**Pro Tip:** Import your most recent month first (January 2026). If it works smoothly, then import older months. This validates your format is correct before doing bulk import.
