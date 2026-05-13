# Aayam Office System - Finance Module Guide

## 1. Recording Revenue (Job Payments)
When you receive a payment for a job, you can now record the specific **Mode** of payment.

1. Go to **Projects & Jobs**.
2. Click **Record Payment** (Green Button) on a Job Card.
3. Enter the **Amount**.
4. Select **Payment Mode**:
   - Cash
   - UPI / GPay
   - Bank Transfer
   - Cheque
5. Click **Confirm**.

> **Note:** This creates a permanent record in the `payments_received` table, which is used for the Client Statement.

---

## 2. Generating Client Statements
You can now generate a professional Statement of Account (Ledger) for any client.

1. Go to **Finance** > **Reports**.
2. Scroll down to **Generate Client Statement**.
3. Select the **Client**.
4. (Optional) Select a Date Range.
5. Click **Generate Statement**.
6. A printable view will appear showing all Invoices (Debits), Payments (Credits), and the Running Balance.
7. Press **Cmd + P** (or Ctrl + P) to save as PDF or Print.

---

## 3. Bank Reconciliation (Sync with HDFC)
This tool allows you to compare your System Records against your actual Bank Statement to find missing payments or errors.

### Step 1: Export from Bank
1. Login to HDFC Netbanking.
2. Download your statement as **Excel** or **CSV** (or just copy the text from the browser/Excel).
3. Ensure you have columns for `Date`, `Description`, `Ref/Chq No`, `Debit`, `Credit`.

### Step 2: Import to System
1. Go to **Finance** > **Reconciliation**.
2. Your HDFC account should be auto-selected.
3. Click **Import Statement**.
4. **Paste** the content from your Excel file into the text box.
5. Click **Process**.

### Step 3: Match & Review
The system will list all bank transactions:
- **Green (Matched):** The system found a Payment with the SAME Amount (+/- 1) within 3 days of the bank date. No action needed.
- **Red (Missing):** This transaction exists in the Bank but NOT in your System. You likely forgot to record a payment or expense.
- **Action Column:**
  - **Eye Off Icon (Ignore):** Click this for irrelevant transactions (e.g., "SMS Charges", "Personal Transfer", "Contra"). It will turn grey and stop warning you.
  - **Trash Icon:** Delete the line from the reconciliation view (only deletes the imported bank record, not system data).
