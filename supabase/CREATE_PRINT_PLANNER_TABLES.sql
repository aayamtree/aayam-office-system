-- ============================================
-- CREATE ALL PRINT PLANNER TABLES FROM SCRATCH
-- ============================================
-- This creates everything needed for the print planner

-- 1. MACHINES TABLE
CREATE TABLE IF NOT EXISTS machines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. SHEET SIZES TABLE
CREATE TABLE IF NOT EXISTS sheet_sizes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    size TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. MATERIALS TABLE
CREATE TABLE IF NOT EXISTS materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. PRINT RUNS TABLE
CREATE TABLE IF NOT EXISTS print_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    print_run_number TEXT UNIQUE,
    machine_id UUID REFERENCES machines(id),
    sheet_size_id UUID REFERENCES sheet_sizes(id),
    material_id UUID REFERENCES materials(id),
    status TEXT DEFAULT 'planned' CHECK (status IN ('planned', 'printed', 'delivered')),
    notes TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. PRINT RUN JOBS TABLE
CREATE TABLE IF NOT EXISTS print_run_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    print_run_id UUID REFERENCES print_runs(id) ON DELETE CASCADE,
    job_id UUID REFERENCES jobs(id),
    client_name TEXT,
    item_name TEXT,
    file_version TEXT,
    quantity_needed INTEGER DEFAULT 0,
    ups_in_sheet INTEGER DEFAULT 1,
    notes TEXT,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- DISABLE RLS ON ALL TABLES
ALTER TABLE machines DISABLE ROW LEVEL SECURITY;
ALTER TABLE sheet_sizes DISABLE ROW LEVEL SECURITY;
ALTER TABLE materials DISABLE ROW LEVEL SECURITY;
ALTER TABLE print_runs DISABLE ROW LEVEL SECURITY;
ALTER TABLE print_run_jobs DISABLE ROW LEVEL SECURITY;

-- GRANT PERMISSIONS
GRANT ALL ON machines TO authenticated, anon;
GRANT ALL ON sheet_sizes TO authenticated, anon;
GRANT ALL ON materials TO authenticated, anon;
GRANT ALL ON print_runs TO authenticated, anon;
GRANT ALL ON print_run_jobs TO authenticated, anon;

-- CREATE PRINT RUN NUMBER SEQUENCE
CREATE OR REPLACE FUNCTION generate_print_run_number()
RETURNS TEXT AS $$
DECLARE
    next_num INTEGER;
    new_number TEXT;
BEGIN
    -- Get the next number
    SELECT COALESCE(MAX(CAST(SUBSTRING(print_run_number FROM 4) AS INTEGER)), 0) + 1
    INTO next_num
    FROM print_runs
    WHERE print_run_number LIKE 'PP-%';
    
    -- Format as PP-00001
    new_number := 'PP-' || LPAD(next_num::TEXT, 5, '0');
    RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- CREATE TRIGGER TO AUTO-GENERATE PRINT RUN NUMBER
CREATE OR REPLACE FUNCTION set_print_run_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.print_run_number IS NULL THEN
        NEW.print_run_number := generate_print_run_number();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_print_run_number ON print_runs;
CREATE TRIGGER trigger_set_print_run_number
    BEFORE INSERT ON print_runs
    FOR EACH ROW
    EXECUTE FUNCTION set_print_run_number();

-- SUCCESS MESSAGE
DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ ALL PRINT PLANNER TABLES CREATED!';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Tables:';
    RAISE NOTICE '  - machines';
    RAISE NOTICE '  - sheet_sizes';
    RAISE NOTICE '  - materials';
    RAISE NOTICE '  - print_runs';
    RAISE NOTICE '  - print_run_jobs';
    RAISE NOTICE '';
    RAISE NOTICE '✅ RLS DISABLED on all tables';
    RAISE NOTICE '✅ Permissions GRANTED';
    RAISE NOTICE '✅ Auto-numbering CONFIGURED (PP-00001)';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Ready to use!';
    RAISE NOTICE '========================================';
END $$;
