-- Blue / Red split of an order, plus order-level receivables.
--   Blue (invoice_*)     = invoiced now, 18% GST added on the Blue amount only.
--   Red (pending_amount) = pending, NOT invoiced.
-- Payments are recorded per CLIENT and per COLOUR and applied FIFO (oldest order first)
-- in the app; allocations are not stored. Old orders keep all-zero split columns and the
-- app treats them as "all Blue = total_amount".

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS invoice_amount     numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS invoice_gst_rate   numeric(5,2)  NOT NULL DEFAULT 18,
  ADD COLUMN IF NOT EXISTS invoice_gst_amount numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS invoice_total      numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pending_amount     numeric(12,2) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS payment_methods (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL UNIQUE,
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO payment_methods (name) VALUES ('Cash'), ('UPI'), ('Bank Transfer'), ('Cheque'), ('Card')
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS receivables_payments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id     uuid NOT NULL REFERENCES clients(id),
  amount_blue   numeric(12,2) NOT NULL DEFAULT 0 CHECK (amount_blue >= 0),
  amount_red    numeric(12,2) NOT NULL DEFAULT 0 CHECK (amount_red >= 0),
  method_blue   uuid REFERENCES payment_methods(id),
  method_red    uuid REFERENCES payment_methods(id),
  notes         text,
  received_at   date NOT NULL DEFAULT current_date,
  created_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid REFERENCES auth.users(id) DEFAULT auth.uid(),
  -- void instead of edit/delete: the app ignores rows where voided_at is set
  voided_at     timestamptz,
  voided_by     uuid REFERENCES auth.users(id),
  void_reason   text,
  CONSTRAINT rp_has_amount CHECK (amount_blue > 0 OR amount_red > 0),
  CONSTRAINT rp_blue_needs_method CHECK (amount_blue = 0 OR method_blue IS NOT NULL),
  CONSTRAINT rp_red_needs_method  CHECK (amount_red  = 0 OR method_red  IS NOT NULL),
  CONSTRAINT rp_void_needs_reason CHECK (voided_at IS NULL OR length(btrim(coalesce(void_reason, ''))) > 0)
);
CREATE INDEX IF NOT EXISTS receivables_payments_client_idx ON receivables_payments (client_id);
CREATE INDEX IF NOT EXISTS receivables_payments_received_idx ON receivables_payments (received_at);

ALTER TABLE payment_methods      ENABLE ROW LEVEL SECURITY;
ALTER TABLE receivables_payments ENABLE ROW LEVEL SECURITY;

-- admin + finance can read and add; nobody else (marketing included) can see either table.
DROP POLICY IF EXISTS pm_select ON payment_methods;
CREATE POLICY pm_select ON payment_methods FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','finance')));
DROP POLICY IF EXISTS pm_insert ON payment_methods;
CREATE POLICY pm_insert ON payment_methods FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','finance')));

DROP POLICY IF EXISTS rp_select ON receivables_payments;
CREATE POLICY rp_select ON receivables_payments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','finance')));
DROP POLICY IF EXISTS rp_insert ON receivables_payments;
CREATE POLICY rp_insert ON receivables_payments FOR INSERT TO authenticated
  WITH CHECK (voided_at IS NULL AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','finance')));
-- Only admins may void (update). No DELETE policy: rows are never removed.
DROP POLICY IF EXISTS rp_void ON receivables_payments;
CREATE POLICY rp_void ON receivables_payments FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- An update may ONLY void a live payment. Amounts, party, dates and methods can never change.
CREATE OR REPLACE FUNCTION rp_only_void() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.client_id, NEW.amount_blue, NEW.amount_red, NEW.method_blue, NEW.method_red, NEW.notes, NEW.received_at, NEW.created_at, NEW.created_by)
     IS DISTINCT FROM
     (OLD.client_id, OLD.amount_blue, OLD.amount_red, OLD.method_blue, OLD.method_red, OLD.notes, OLD.received_at, OLD.created_at, OLD.created_by) THEN
    RAISE EXCEPTION 'A payment cannot be edited. Void it and record a new one.';
  END IF;
  IF OLD.voided_at IS NOT NULL THEN RAISE EXCEPTION 'This payment is already voided.'; END IF;
  IF NEW.voided_at IS NULL THEN RAISE EXCEPTION 'Only voiding is allowed on a payment.'; END IF;
  NEW.voided_by := auth.uid();
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS rp_only_void_trg ON receivables_payments;
CREATE TRIGGER rp_only_void_trg BEFORE UPDATE ON receivables_payments FOR EACH ROW EXECUTE FUNCTION rp_only_void();
