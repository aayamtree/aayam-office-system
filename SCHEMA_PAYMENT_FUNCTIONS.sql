-- =============================================
-- PAYMENT RECORDING FUNCTIONS
-- These functions handle payment recording with automatic number generation
-- and invoice/purchase bill updates
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

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION record_payment_received TO authenticated;
GRANT EXECUTE ON FUNCTION record_vendor_payment TO authenticated;
