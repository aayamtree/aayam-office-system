# Database Schema Update

To enable Manual Journal Entries, please run the following SQL code in your Supabase SQL Editor.

1. Go to your **Supabase Dashboard**.
2. Click on **SQL Editor** in the left sidebar.
3. Click **New Query**.
4. Paste the code below and click **Run**.

```sql
-- 1. Create Journal Entries Table
CREATE TABLE IF NOT EXISTS journal_entries (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  date date NOT NULL,
  reference text,
  notes text,
  total_amount numeric DEFAULT 0,
  created_by text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Create Journal Lines Table
CREATE TABLE IF NOT EXISTS journal_lines (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  journal_id uuid REFERENCES journal_entries(id) ON DELETE CASCADE,
  account text NOT NULL,
  description text,
  debit numeric DEFAULT 0,
  credit numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- 3. Enable RLS (Security)
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_lines ENABLE ROW LEVEL SECURITY;

-- 4. Create Policies (Allow all for authenticated users)
CREATE POLICY "Allow all access to journal_entries" ON journal_entries
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all access to journal_lines" ON journal_lines
  FOR ALL USING (auth.role() = 'authenticated');
```

## Verification
After running this, try saving a Journal Entry in the system. It should work immediately.
