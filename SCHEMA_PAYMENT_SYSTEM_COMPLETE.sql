-- =============================================
-- COMPLETE PAYMENT SYSTEM SETUP
-- Run this ONCE to set up the entire payment recording system
-- =============================================

-- Step 1: Create Payment Tables
-- =============================================
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
    attachment_url text,
    paid_by uuid,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

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
    attachment_url text,
    received_by uuid,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Step 2: Add Counters
-- =============================================
INSERT INTO counters (id, current_number, prefix) 
VALUES ('vendor_payment', 100, 'PAY-') 
ON CONFLICT (id) DO NOTHING;

INSERT INTO counters (id, current_number, prefix) 
VALUES ('payment_received', 100, 'REC-') 
ON CONFLICT (id) DO NOTHING;

-- Step 3: Disable RLS (for now, enable later if needed)
-- =============================================
ALTER TABLE vendor_payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE payments_received DISABLE ROW LEVEL SECURITY;

-- Step 4: Create Recording Functions
-- =============================================

-- Function: Record Payment Received (from clients)
CREATE OR REPLACE FUNCTION record_payment_received(
  p_client_id uuid,
  p_amount numeric,
  p_payment_mode text,
  p_payment_date date,
  p_bank_account_id uuid DEFAULT NULL,
  p_reference text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_invoice_id uuid DEFAULT NULL,
  p_attachment_url text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_payment_number text;
  v_new_payment payments_received;
BEGIN
  -- Get next payment number
  SELECT get_next_number('payment_received') INTO v_payment_number;
  
  -- Insert payment record
  INSERT INTO payments_received (
    payment_number,
    client_id,
    invoice_id,
    amount,
    payment_mode,
    payment_date,
    bank_account_id,
    reference_number,
    notes,
    attachment_url,
    received_by
  ) VALUES (
    v_payment_number,
    p_client_id,
    p_invoice_id,
    p_amount,
    p_payment_mode,
    p_payment_date,
    p_bank_account_id,
    p_reference,
    p_notes,
    p_attachment_url,
    auth.uid()
  )
  RETURNING * INTO v_new_payment;
  
  -- Update invoice if linked
  IF p_invoice_id IS NOT NULL THEN
    UPDATE invoices
    SET 
      amount_received = COALESCE(amount_received, 0) + p_amount,
      balance_due = total_amount - (COALESCE(amount_received, 0) + p_amount),
      payment_status = CASE
        WHEN (total_amount - (COALESCE(amount_received, 0) + p_amount)) <= 0 THEN 'paid'
        WHEN (COALESCE(amount_received, 0) + p_amount) > 0 THEN 'partial'
        ELSE 'pending'
      END,
      updated_at = now()
    WHERE id = p_invoice_id;
  END IF;
  
  RETURN row_to_json(v_new_payment);
END;
$$;

-- Function: Record Vendor Payment (to vendors)
CREATE OR REPLACE FUNCTION record_vendor_payment(
  p_vendor_id uuid,
  p_amount numeric,
  p_payment_mode text,
  p_payment_date date,
  p_bank_account_id uuid DEFAULT NULL,
  p_reference text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_purchase_bill_id uuid DEFAULT NULL,
  p_attachment_url text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_payment_number text;
  v_new_payment vendor_payments;
BEGIN
  -- Get next payment number
  SELECT get_next_number('vendor_payment') INTO v_payment_number;
  
  -- Insert payment record
  INSERT INTO vendor_payments (
    payment_number,
    vendor_id,
    purchase_bill_id,
    amount,
    payment_mode,
    payment_date,
    bank_account_id,
    reference_number,
    notes,
    attachment_url,
    paid_by
 ) VALUES (
    v_payment_number,
    p_vendor_id,
    p_purchase_bill_id,
    p_amount,
    p_payment_mode,
    p_payment_date,
    p_bank_account_id,
    p_reference,
    p_notes,
    p_attachment_url,
    auth.uid()
  )
  RETURNING * INTO v_new_payment;
  
  -- Update purchase bill if linked
  IF p_purchase_bill_id IS NOT NULL THEN
    UPDATE purchase_bills
    SET 
      amount_paid = COALESCE(amount_paid, 0) + p_amount,
      payment_status = CASE
        WHEN (COALESCE(amount_paid, 0) + p_amount) >= total_amount THEN 'paid'
        WHEN (COALESCE(amount_paid, 0) + p_amount) > 0 THEN 'partial'
        ELSE 'pending'
      END,
      updated_at = now()
    WHERE id = p_purchase_bill_id;
  END IF;
  
  RETURN row_to_json(v_new_payment);
END;
$$;

-- Step 5: Grant Permissions
-- =============================================
GRANT EXECUTE ON FUNCTION record_payment_received TO authenticated;
GRANT EXECUTE ON FUNCTION record_vendor_payment TO authenticated;

-- Step 6: Create Storage Bucket for Payment Proofs
-- =============================================
INSERT INTO storage.buckets (id, name, public) 
VALUES ('payment-proofs', 'payment-proofs', true) 
ON CONFLICT (id) DO NOTHING;

-- Storage Policies (Public Read, Auth Write)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Public Access payment-proofs'
  ) THEN
    CREATE POLICY "Public Access payment-proofs" ON storage.objects 
    FOR SELECT USING ( bucket_id = 'payment-proofs' );
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Auth Upload payment-proofs'
  ) THEN
    CREATE POLICY "Auth Upload payment-proofs" ON storage.objects 
    FOR INSERT WITH CHECK ( bucket_id = 'payment-proofs' AND auth.uid() IS NOT NULL );
  END IF;
END $$;

-- =============================================
-- VERIFICATION QUERIES (Optional - comment out if you want)
-- =============================================
-- SELECT 'Tables Created:' as message;
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_schema = 'public' AND table_name IN ('payments_received', 'vendor_payments');

-- SELECT 'Functions Created:' as message;
-- SELECT routine_name FROM information_schema.routines
-- WHERE routine_schema = 'public' AND routine_name IN ('record_payment_received', 'record_vendor_payment');

-- SELECT 'Counters Ready:' as message;
-- SELECT * FROM counters WHERE id IN ('payment_received', 'vendor_payment');

-- Done!
SELECT 'Payment System Setup Complete!' as status;
