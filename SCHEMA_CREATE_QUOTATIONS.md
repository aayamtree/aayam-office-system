-- Create Quotations Module Tables

CREATE TABLE IF NOT EXISTS quotations (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    quote_number text NOT NULL UNIQUE,
    client_id uuid REFERENCES clients(id),
    created_by uuid, -- We skip strict FK reference to profiles(id) for easier Speed Mode usage
    valid_until date,
    subtotal numeric DEFAULT 0,
    gst_amount numeric DEFAULT 0,
    discount_amount numeric DEFAULT 0,
    total_amount numeric DEFAULT 0,
    status text DEFAULT 'draft', -- draft, sent, accepted, rejected, expired, viewed
    notes text,
    terms text,
    converted_to_job_id uuid, -- Link to job if accepted (can be REFERENCES jobs(id))
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS quotation_items (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    quotation_id uuid REFERENCES quotations(id) ON DELETE CASCADE,
    description text NOT NULL,
    quantity integer DEFAULT 1,
    rate numeric DEFAULT 0,
    gst_rate numeric DEFAULT 18,
    amount numeric DEFAULT 0,
    created_at timestamptz DEFAULT now()
);

-- Initialize Counter
INSERT INTO counters (id, current_number, prefix) VALUES ('quotation', 1000, 'QT-') ON CONFLICT (id) DO NOTHING;

-- Disable RLS
ALTER TABLE quotations DISABLE ROW LEVEL SECURITY;
ALTER TABLE quotation_items DISABLE ROW LEVEL SECURITY;
