-- =============================================
-- SYSTEM MAINTENANCE RPC
-- Run this in Supabase SQL Editor to create the function.
-- Then call it anytime from the System Health page.
-- =============================================

CREATE OR REPLACE FUNCTION run_system_maintenance()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
  start_time timestamptz := clock_timestamp();
  v_jobs_count bigint;
  v_leads_count bigint;
  v_invoices_count bigint;
  v_clients_count bigint;
  v_design_tasks_count bigint;
BEGIN
  -- 1. Update table statistics for the query planner
  ANALYZE jobs;
  ANALYZE leads;
  ANALYZE invoices;
  ANALYZE clients;
  ANALYZE follow_ups;
  ANALYZE dispatches;
  ANALYZE design_tasks;
  ANALYZE quotations;
  ANALYZE sales_orders;
  ANALYZE payments_received;
  ANALYZE activity_logs;
  ANALYZE commissions;
  ANALYZE user_calendar_events;
  ANALYZE eod_reports;

  -- 2. Get table counts for diagnostics
  SELECT count(*) INTO v_jobs_count FROM jobs;
  SELECT count(*) INTO v_leads_count FROM leads;
  SELECT count(*) INTO v_invoices_count FROM invoices;
  SELECT count(*) INTO v_clients_count FROM clients;

  BEGIN
    SELECT count(*) INTO v_design_tasks_count FROM design_tasks;
  EXCEPTION WHEN undefined_table THEN
    v_design_tasks_count := 0;
  END;

  -- 3. Build result
  result := jsonb_build_object(
    'status', 'completed',
    'timestamp', now(),
    'duration_ms', EXTRACT(MILLISECONDS FROM clock_timestamp() - start_time)::int,
    'tables_analyzed', 14,
    'table_counts', jsonb_build_object(
      'jobs', v_jobs_count,
      'leads', v_leads_count,
      'invoices', v_invoices_count,
      'clients', v_clients_count,
      'design_tasks', v_design_tasks_count
    ),
    'message', 'Database statistics updated and query planner optimized'
  );

  RETURN result;
END;
$$;

-- Grant access
GRANT EXECUTE ON FUNCTION run_system_maintenance() TO authenticated;

-- =============================================
-- SYSTEM HEALTH CHECK RPC
-- Returns database health diagnostics
-- =============================================

CREATE OR REPLACE FUNCTION get_system_health()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
  start_time timestamptz := clock_timestamp();
  v_db_size text;
  v_tables jsonb;
  v_indexes_count int;
  v_active_connections int;
BEGIN
  -- 1. Database size
  SELECT pg_size_pretty(pg_database_size(current_database())) INTO v_db_size;

  -- 2. Table stats
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  INTO v_tables
  FROM (
    SELECT
      relname AS table_name,
      n_live_tup AS row_count,
      pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
      last_analyze,
      last_autoanalyze
    FROM pg_stat_user_tables
    WHERE schemaname = 'public'
    ORDER BY n_live_tup DESC
    LIMIT 20
  ) t;

  -- 3. Index count
  SELECT count(*) INTO v_indexes_count
  FROM pg_indexes WHERE schemaname = 'public';

  -- 4. Active connections
  SELECT count(*) INTO v_active_connections
  FROM pg_stat_activity
  WHERE state = 'active';

  result := jsonb_build_object(
    'status', 'healthy',
    'timestamp', now(),
    'response_time_ms', EXTRACT(MILLISECONDS FROM clock_timestamp() - start_time)::int,
    'database_size', v_db_size,
    'total_indexes', v_indexes_count,
    'active_connections', v_active_connections,
    'tables', v_tables
  );

  RETURN result;
END;
$$;

-- Grant access
GRANT EXECUTE ON FUNCTION get_system_health() TO authenticated;
