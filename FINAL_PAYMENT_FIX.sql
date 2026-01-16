-- COMPLETE FINAL FIX FOR PAYMENTS
-- This creates helper functions to bypass PostgREST issues

-- 1. Function to get all payments (bypasses PostgREST)
CREATE OR REPLACE FUNCTION get_all_payments_received()
RETURNS TABLE (
  id uuid,
  payment_number text,
  client_id uuid,
  client_name text,
  client_company text,
  amount numeric,
  payment_mode text,
  payment_date date,
  reference_number text,
  notes text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pr.id,
    pr.payment_number,
    pr.client_id,
    c.name as client_name,
    c.company as client_company,
    pr.amount,
    pr.payment_mode,
    pr.payment_date,
    pr.reference_number,
    pr.notes,
    pr.created_at
  FROM payments_received pr
  LEFT JOIN clients c ON pr.client_id = c.id
  ORDER BY pr.payment_date DESC;
END;
$$;

-- 2. Function to get vendor payments
CREATE OR REPLACE FUNCTION get_all_vendor_payments()
RETURNS TABLE (
  id uuid,
  payment_number text,
  vendor_id uuid,
  vendor_name text,
  vendor_company text,
  amount numeric,
  payment_mode text,
  payment_date date,
  reference_number text,
  notes text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    vp.id,
    vp.payment_number,
    vp.vendor_id,
    v.name as vendor_name,
    v.company as vendor_company,
    vp.amount,
    vp.payment_mode,
    vp.payment_date,
    vp.reference_number,
    vp.notes,
    vp.created_at
  FROM vendor_payments vp
  LEFT JOIN vendors v ON vp.vendor_id = v.id
  ORDER BY vp.payment_date DESC;
END;
$$;

-- 3. Grant permissions
GRANT EXECUTE ON FUNCTION get_all_payments_received TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_vendor_payments TO authenticated;
GRANT EXECUTE ON FUNCTION record_payment_received TO authenticated;
GRANT EXECUTE ON FUNCTION record_vendor_payment TO authenticated;

-- Test it
SELECT * FROM get_all_payments_received();
