-- Migration: QC Records Table
-- Creates qc_records for full audit trail of all quality checks

CREATE TABLE IF NOT EXISTS qc_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- What was QC'd (one of these will be set)
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  print_run_id UUID REFERENCES print_runs(id) ON DELETE SET NULL,

  -- QC details
  qc_type TEXT NOT NULL CHECK (qc_type IN ('pre_print', 'post_print', 'print_run', 'remote')),
  checklist JSONB DEFAULT '{}',
  result TEXT NOT NULL CHECK (result IN ('passed', 'failed', 'rework')),
  notes TEXT,
  received_qty INTEGER,

  -- Photos for remote QC (direct-to-client)
  photos JSONB DEFAULT '[]',
  skip_reason TEXT,

  -- Audit trail
  performed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  performed_by_name TEXT,
  performed_at TIMESTAMPTZ DEFAULT now(),

  -- Design reference (snapshot URL at QC time)
  design_file_url TEXT,

  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for lookups
CREATE INDEX IF NOT EXISTS idx_qc_records_job ON qc_records(job_id);
CREATE INDEX IF NOT EXISTS idx_qc_records_print_run ON qc_records(print_run_id);
CREATE INDEX IF NOT EXISTS idx_qc_records_performed_at ON qc_records(performed_at DESC);

-- RLS
ALTER TABLE qc_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qc_records_all" ON qc_records
  FOR ALL USING (true) WITH CHECK (true);

COMMENT ON TABLE qc_records IS 'Permanent audit trail of all QC checks — who, when, what, result';
COMMENT ON COLUMN qc_records.qc_type IS 'pre_print = design QC, post_print = physical QC, print_run = batch QC, remote = photo-based for direct dispatch';
COMMENT ON COLUMN qc_records.photos IS 'JSON array of photo URLs for remote QC verification';
COMMENT ON COLUMN qc_records.skip_reason IS 'Why QC was skipped (for direct-to-client dispatches)';
