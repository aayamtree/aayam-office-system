-- Create Purchase Bills Table
CREATE TABLE IF NOT EXISTS purchase_bills (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    bill_number text NOT NULL UNIQUE,
    vendor_bill_number text, -- External bill number from physical receipt
    
    vendor_id uuid REFERENCES vendors(id),
    job_id uuid REFERENCES jobs(id),
    
    product_type text,
    description text,
    quantity integer DEFAULT 0,
    rate numeric DEFAULT 0,
    
    subtotal numeric DEFAULT 0,
    gst_rate numeric DEFAULT 18,
    gst_amount numeric DEFAULT 0,
    total_amount numeric DEFAULT 0,
    
    payment_status text DEFAULT 'pending', -- pending, partial, paid
    amount_paid numeric DEFAULT 0,
    
    bill_date date DEFAULT CURRENT_DATE,
    due_date date,
    
    created_by uuid, -- No strict FK for Speed Mode compatibility
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Initialize Counter
INSERT INTO counters (id, current_number, prefix) 
VALUES ('purchase_bill', 100, 'PB-') 
ON CONFLICT (id) DO NOTHING;

-- Disable RLS
ALTER TABLE purchase_bills DISABLE ROW LEVEL SECURITY;
