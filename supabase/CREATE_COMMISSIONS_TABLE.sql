-- =============================================
-- COMMISSIONS TABLE
-- =============================================
-- User-configurable GST rates per order
-- Supports percentage OR fixed commission amounts
-- Tracks eligibility (quote accepted + full payment received)

CREATE TABLE IF NOT EXISTS commissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Links
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  quotation_id UUID REFERENCES quotations(id) ON DELETE SET NULL,
  order_id UUID, -- No foreign key - for future use if needed
  marketing_person_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Project Details
  project_name TEXT,
  project_total_amount DECIMAL(12, 2) NOT NULL, -- Total invoice amount (including GST)
  
  -- GST Calculation (USER INPUTS THIS)
  gst_percentage DECIMAL(5, 2) NOT NULL DEFAULT 18.00, -- User sets GST % (12%, 18%, 28%, etc.)
  gst_amount DECIMAL(12, 2), -- Calculated: (Total × GST%) / (100 + GST%)
  base_amount DECIMAL(12, 2), -- Calculated: Total - GST Amount
  
  -- Commission Setup
  commission_type TEXT CHECK (commission_type IN ('percentage', 'fixed')) DEFAULT 'percentage',
  commission_value DECIMAL(10, 2) NOT NULL DEFAULT 5.00, -- Either % or fixed ₹ amount
  commission_amount DECIMAL(12, 2), -- Final commission calculated
  
  -- Eligibility Rules
  is_eligible BOOLEAN DEFAULT FALSE,
  quote_status TEXT, -- 'accepted', 'rejected', 'pending'
  payment_status TEXT, -- 'full', 'partial', 'unpaid'
  payment_received_date DATE,
  
  -- Status Tracking
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'rejected')),
  
  -- Payment Tracking
  salary_month DATE, -- Which month's salary this belongs to
  paid_at TIMESTAMP,
  paid_by UUID REFERENCES profiles(id),
  payment_reference TEXT,
  
  -- Notes & Metadata
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- =============================================
-- INDEXES
-- =============================================
CREATE INDEX idx_commissions_marketing_person ON commissions(marketing_person_id);
CREATE INDEX idx_commissions_status ON commissions(status);
CREATE INDEX idx_commissions_salary_month ON commissions(salary_month);
CREATE INDEX idx_commissions_job ON commissions(job_id);
CREATE INDEX idx_commissions_quotation ON commissions(quotation_id);

-- =============================================
-- AUTO-UPDATE TIMESTAMP
-- =============================================
CREATE OR REPLACE FUNCTION update_commissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER commissions_updated_at
  BEFORE UPDATE ON commissions
  FOR EACH ROW
  EXECUTE FUNCTION update_commissions_updated_at();

-- =============================================
-- AUTOMATIC GST & COMMISSION CALCULATION
-- =============================================
-- This trigger auto-calculates GST amount, base amount, and commission
-- whenever project_total_amount, gst_percentage, or commission_value changes

CREATE OR REPLACE FUNCTION calculate_commission_amounts()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate GST Amount: (Total × GST%) / (100 + GST%)
  NEW.gst_amount := (NEW.project_total_amount * NEW.gst_percentage) / (100 + NEW.gst_percentage);
  
  -- Calculate Base Amount: Total - GST
  NEW.base_amount := NEW.project_total_amount - NEW.gst_amount;
  
  -- Calculate Commission based on type
  IF NEW.commission_type = 'percentage' THEN
    -- Commission = Base Amount × Commission %
    NEW.commission_amount := (NEW.base_amount * NEW.commission_value) / 100;
  ELSE
    -- Fixed commission
    NEW.commission_amount := NEW.commission_value;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_calculate_commission
  BEFORE INSERT OR UPDATE OF project_total_amount, gst_percentage, commission_value, commission_type
  ON commissions
  FOR EACH ROW
  EXECUTE FUNCTION calculate_commission_amounts();

-- =============================================
-- RLS POLICIES
-- =============================================
ALTER TABLE commissions ENABLE ROW LEVEL SECURITY;

-- Admin can see all commissions
CREATE POLICY "Admins can view all commissions"
  ON commissions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Marketing users can see only their own commissions
CREATE POLICY "Marketing users can view their own commissions"
  ON commissions FOR SELECT
  TO authenticated
  USING (marketing_person_id = auth.uid());

-- Admin can insert/update/delete
CREATE POLICY "Admins can manage commissions"
  ON commissions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- =============================================
-- EXAMPLE USAGE
-- =============================================
-- Example 1: Pouch project with 12% GST
-- Total: ₹56,000 (including GST)
-- GST: 12%
-- Base: ₹56,000 / 1.12 = ₹50,000
-- Commission (5%): ₹50,000 × 0.05 = ₹2,500

/*
INSERT INTO commissions (
  marketing_person_id,
  project_name,
  project_total_amount,
  gst_percentage,
  commission_type,
  commission_value,
  is_eligible,
  quote_status,
  payment_status
) VALUES (
  'user-uuid-here',
  'Pouch - ABC Company',
  56000.00,
  12.00,  -- User sets this
  'percentage',
  5.00,
  TRUE,
  'accepted',
  'full'
);
*/

-- Example 2: Box project with 18% GST
-- Total: ₹1,18,000 (including GST)
-- GST: 18%
-- Base: ₹1,18,000 / 1.18 = ₹1,00,000
-- Commission (5%): ₹1,00,000 × 0.05 = ₹5,000

/*
INSERT INTO commissions (
  marketing_person_id,
  project_name,
  project_total_amount,
  gst_percentage,
  commission_type,
  commission_value
) VALUES (
  'user-uuid-here',
  'Box Printing - XYZ Ltd',
  118000.00,
  18.00,  -- User sets this
  'percentage',
  5.00
);
*/
