-- Migration: Add paper supply fields to print_runs table
-- These fields track when paper is sent from a separate paper vendor to the printer

-- Add vendor_id column if not exists (for print vendor)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'print_runs' AND column_name = 'vendor_id') THEN
        ALTER TABLE print_runs ADD COLUMN vendor_id uuid REFERENCES vendors(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'print_runs' AND column_name = 'total_amount') THEN
        ALTER TABLE print_runs ADD COLUMN total_amount numeric;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'print_runs' AND column_name = 'deadline') THEN
        ALTER TABLE print_runs ADD COLUMN deadline date;
    END IF;
END $$;

-- Add new paper supply columns
ALTER TABLE print_runs
ADD COLUMN IF NOT EXISTS sheet_size_label text,
ADD COLUMN IF NOT EXISTS pulling_multiple integer,
ADD COLUMN IF NOT EXISTS paper_vendor_id uuid REFERENCES vendors(id),
ADD COLUMN IF NOT EXISTS paper_qty integer,
ADD COLUMN IF NOT EXISTS paper_rate numeric,
ADD COLUMN IF NOT EXISTS paper_gst_percent integer DEFAULT 18,
ADD COLUMN IF NOT EXISTS paper_total numeric,
ADD COLUMN IF NOT EXISTS paper_payment_status text DEFAULT 'pending' CHECK (paper_payment_status IN ('paid', 'pending'));

-- Add comment for documentation
COMMENT ON COLUMN print_runs.sheet_size_label IS 'Sheet size label carried from Step 2 config';
COMMENT ON COLUMN print_runs.pulling_multiple IS 'Pulling multiple (sheets/pull) from Step 2';
COMMENT ON COLUMN print_runs.paper_vendor_id IS 'Paper vendor when sending paper separately';
COMMENT ON COLUMN print_runs.paper_qty IS 'Number of paper sheets being sent';
COMMENT ON COLUMN print_runs.paper_rate IS 'Rate per sheet from paper vendor';
COMMENT ON COLUMN print_runs.paper_gst_percent IS 'GST percentage on paper';
COMMENT ON COLUMN print_runs.paper_total IS 'Total paper cost including GST';
COMMENT ON COLUMN print_runs.paper_payment_status IS 'Payment status: paid or pending';
