-- Create Vendor Payments (Outgoing)
CREATE TABLE IF NOT EXISTS vendor_payments (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    payment_number text NOT NULL UNIQUE,
    vendor_id uuid REFERENCES vendors(id),
    purchase_bill_id uuid REFERENCES purchase_bills(id),
    amount numeric DEFAULT 0,
    payment_mode text CHECK (payment_mode IN ('cash', 'cheque', 'bank_transfer', 'upi', 'card', 'neft', 'rtgs')),
    payment_date date DEFAULT CURRENT_DATE,
    bank_account_id uuid REFERENCES bank_accounts(id),
    reference_number text,
    notes text,
    paid_by uuid,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Create Payments Received (Incoming)
CREATE TABLE IF NOT EXISTS payments_received (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    payment_number text NOT NULL UNIQUE,
    client_id uuid REFERENCES clients(id),
    invoice_id uuid REFERENCES invoices(id), 
    job_id uuid REFERENCES jobs(id), 
    amount numeric DEFAULT 0,
    payment_mode text CHECK (payment_mode IN ('cash', 'cheque', 'bank_transfer', 'upi', 'card', 'neft', 'rtgs')),
    payment_date date DEFAULT CURRENT_DATE,
    bank_account_id uuid REFERENCES bank_accounts(id),
    reference_number text,
    notes text,
    received_by uuid,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Counters
INSERT INTO counters (id, current_number, prefix) VALUES ('vendor_payment', 100, 'PAY-') ON CONFLICT (id) DO NOTHING;
INSERT INTO counters (id, current_number, prefix) VALUES ('payment_received', 100, 'REC-') ON CONFLICT (id) DO NOTHING;

-- RLS
ALTER TABLE vendor_payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE payments_received DISABLE ROW LEVEL SECURITY;
