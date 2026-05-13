# Running Database Migration for Enhanced Lead Cards

## Quick Steps to Apply Migration

### Option 1: Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Click on **SQL Editor** in the left sidebar
3. Click **New Query**
4. Copy and paste the contents of `supabase/ADD_LEAD_PROJECT_FIELDS.sql`
5. Click **Run** or press `Ctrl+Enter`

### Option 2: Copy-Paste Ready SQL

Copy this entire block and run it in Supabase SQL Editor:

```sql
-- Add project fields to leads table for enhanced lead cards
ALTER TABLE leads 
  ADD COLUMN IF NOT EXISTS project_type TEXT CHECK (project_type IN ('print', 'design', 'design_print')),
  ADD COLUMN IF NOT EXISTS quantity INTEGER,
  ADD COLUMN IF NOT EXISTS estimated_amount DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS deadline DATE;

-- Add comments for documentation
COMMENT ON COLUMN leads.project_type IS 'Type of project: print (client provides design), design (design only), or design_print (full service)';
COMMENT ON COLUMN leads.quantity IS 'Estimated quantity for the project';
COMMENT ON COLUMN leads.estimated_amount IS 'Estimated project amount (excluding GST)';
COMMENT ON COLUMN leads.deadline IS 'Expected or requested deadline for the project';

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_leads_project_type ON leads(project_type);
CREATE INDEX IF NOT EXISTS idx_leads_deadline ON leads(deadline) WHERE deadline IS NOT NULL;
```

---

## After Running Migration

### 1. Verify Migration Success

Run this query to check if columns exist:

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'leads' 
  AND column_name IN ('project_type', 'quantity', 'estimated_amount', 'deadline');
```

You should see 4 rows returned.

### 2. Test with Sample Data

Update an existing lead to see the enhanced card:

```sql
UPDATE leads 
SET 
  project_type = 'design_print',
  quantity = 5000,
  estimated_amount = 50000.00,
  deadline = '2026-02-01'
WHERE lead_number = 'LD-33';  -- Replace with your lead number
```

### 3. Refresh Your Browser

- Go to Marketing > Leads
- You should now see:
  - Project type badge (✨ Design + Print)
  - Summary panel with Qty, Amount, Deadline
  - Owner tag (if logged in as admin)

---

## What Will Show Up

### Admin View:
- 👤 **Owner tag** - Shows which marketing person owns the lead
- 🎨 **Project type badge** - Color-coded (Print/Design/Design+Print)
- 📊 **Summary panel** - Qty | Amount | Deadline

### Marketing User View:
- Everything except the owner tag (they know it's theirs)

---

## Troubleshooting

**Migration fails?**
- Check if you have admin access to Supabase
- Verify you're connected to the correct project

**Don't see changes?**
- Hard refresh browser (Ctrl+Shift+R / Cmd+Shift+R)
- Check browser console for errors
- Verify leads have assigned_user data (run: `SELECT * FROM leads LIMIT 1;`)

**Owner tag not showing?**
- Make sure you're logged in as admin
- Check if `assigned_user` is populated (needs join in query)

---

Need help running the migration? Let me know!
