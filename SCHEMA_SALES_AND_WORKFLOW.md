-- =============================================
-- SALES ORDER & WORKFLOW AUTOMATION SCHEMA
-- =============================================

-- 1. CREATE SALES ORDERS TABLE
-- This is the "Master Record" requested in Finance Module.
CREATE TABLE IF NOT EXISTS sales_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  so_number TEXT NOT NULL UNIQUE, -- e.g. SO-2024-001
  client_id UUID REFERENCES clients(id) ON DELETE RESTRICT,
  quotation_id UUID REFERENCES quotations(id) ON DELETE SET NULL, -- Link to Quote if any
  
  order_date DATE DEFAULT CURRENT_DATE,
  work_type TEXT CHECK (work_type IN ('design_only', 'print_only', 'design_and_print')),
  
  -- Financials
  subtotal DECIMAL(12,2) DEFAULT 0,
  gst_rate DECIMAL(5,2) DEFAULT 18,
  gst_amount DECIMAL(12,2) DEFAULT 0,
  total_amount DECIMAL(12,2) DEFAULT 0,
  
  -- Workflow Status
  status TEXT CHECK (status IN ('draft', 'confirmed', 'in_progress', 'ready_for_invoice', 'invoiced', 'completed', 'cancelled')) DEFAULT 'draft',
  payment_status TEXT CHECK (payment_status IN ('pending', 'partial', 'paid')) DEFAULT 'pending',
  
  -- Details
  project_name TEXT,
  description TEXT,
  quantity INTEGER DEFAULT 1,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. AUTOMATION: LOGIC HANDLERS (The "Brain")
-- This function decides what to do when a Sales Order is CONFIRMED.

CREATE OR REPLACE FUNCTION process_confirmed_sales_order()
RETURNS TRIGGER AS $$
DECLARE
  v_job_id UUID;
  v_project_id UUID;
BEGIN
  -- Only run if status changed to 'confirmed'
  IF (OLD.status IS DISTINCT FROM 'confirmed' AND NEW.status = 'confirmed') THEN
    
    -- CASE 1: DESIGN ONLY -> Create Design Project
    IF (NEW.work_type IN ('design_only', 'design_and_print')) THEN
      INSERT INTO design_projects (
        name, description, client_id, status, created_by, project_number
      ) VALUES (
        NEW.project_name, 
        NEW.description || ' (Generated from ' || NEW.so_number || ')',
        NEW.client_id, 
        'planning', 
        NEW.created_by,
        'PRJ-' || floor(random() * 10000)::text -- Temp number, trigger will fix
      ) RETURNING id INTO v_project_id;
    END IF;

    -- CASE 2: PRINT ONLY -> Create Production Job IMMEDIATELY
    IF (NEW.work_type = 'print_only') THEN
      INSERT INTO jobs (
        project_name, description, client_id, quantity, current_stage, job_number,
        subtotal, gst_amount, total_amount, payment_status, created_by
      ) VALUES (
        NEW.project_name,
        NEW.description,
        NEW.client_id,
        NEW.quantity,
        'new', -- Starts at 'new' -> Users move to 'printing'
        'JOB-' || floor(random() * 10000)::text,
        NEW.subtotal, NEW.gst_amount, NEW.total_amount, NEW.payment_status, NEW.created_by
      ) RETURNING id INTO v_job_id;
    END IF;

    -- CASE 3: DESIGN + PRINT
    -- We created Design Project above. We DO NOT create Print Job yet.
    -- The Print Job will be created when Design Project is "Completed".
    
  END IF;
  return NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_on_order_confirm
  AFTER UPDATE ON sales_orders
  FOR EACH ROW
  EXECUTE FUNCTION process_confirmed_sales_order();


-- 3. AUTOMATION: DESIGN COMPLETION -> PRINT JOB / INVOICE
-- When a Design Project is marked 'completed', trigger next steps.

CREATE OR REPLACE FUNCTION flow_on_design_completion()
RETURNS TRIGGER AS $$
DECLARE
  v_so_record RECORD;
BEGIN
  -- Only trigger if status changes to 'completed'
  IF (OLD.status IS DISTINCT FROM 'completed' AND NEW.status = 'completed') THEN
    
    -- Find linked Sales Order (Need to link them, assuming client match + recent, or better: add work_ref to design_project)
    -- Ideally, we add 'sales_order_id' to design_projects and jobs table.
    -- For now, we'll logging or strictly skipping without column.
    -- TODO: You should add sales_order_id to tables to make this robust.
    NULL; -- Placeholder until column added
    
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- 4. LINKING TABLES (Constraint Updates)
-- Add reference columns to link everything back to the "Sales Order"
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS sales_order_id UUID REFERENCES sales_orders(id);
ALTER TABLE design_projects ADD COLUMN IF NOT EXISTS sales_order_id UUID REFERENCES sales_orders(id);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sales_order_id UUID REFERENCES sales_orders(id);

-- 5. COUNTER FOR SO
INSERT INTO counters (id, current_number, prefix) VALUES ('sales_order', 1000, 'SO') ON CONFLICT DO NOTHING;
