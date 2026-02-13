-- =============================================
-- GET DASHBOARD STATS - Server-Side RPC Function
-- Replaces 10 client-side queries with 1 server-side call
-- Run this in Supabase SQL Editor
-- =============================================

CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result jsonb;
    today_str text := to_char(CURRENT_DATE, 'YYYY-MM-DD');
    start_of_year timestamptz := date_trunc('year', CURRENT_DATE);
    start_of_month timestamptz := date_trunc('month', CURRENT_DATE);
    
    v_total_clients int;
    v_active_jobs int;
    v_total_revenue numeric;
    v_pending_payments numeric;
    v_pending_dispatches int;
    v_leads_this_month int;
    v_orders_this_month int;
    v_overdue_payments int;
    v_follow_ups_due int;
    v_follow_ups_table int;
    v_low_stock int;
    v_jobs_completed_today int;
    v_payments_due_today int;
    v_jobs_due_today int;
    v_jobs_delayed int;
    v_feedback_pending int;
    v_payment_hold int;
    v_jobs_at_vendor int;
    v_vendor_due_today int;
    v_vendor_delayed int;
    v_pipeline jsonb;
    v_pipeline_overdue jsonb;
    v_sales_performance jsonb;
BEGIN
    -- 1. Total Clients
    SELECT count(*) INTO v_total_clients FROM clients;

    -- 2. Active Jobs (not delivered/cancelled)
    SELECT count(*) INTO v_active_jobs FROM jobs 
    WHERE current_stage NOT IN ('delivered', 'cancelled');

    -- 3. Pipeline counts (grouped by stage)
    SELECT COALESCE(jsonb_object_agg(stage, cnt), '{}'::jsonb)
    INTO v_pipeline
    FROM (
        SELECT current_stage AS stage, count(*) AS cnt
        FROM jobs
        WHERE current_stage NOT IN ('delivered', 'cancelled')
        GROUP BY current_stage
    ) sub;

    -- 4. Pipeline overdue (by stage, where deadline < today)
    SELECT COALESCE(jsonb_object_agg(stage, cnt), '{}'::jsonb)
    INTO v_pipeline_overdue
    FROM (
        SELECT current_stage AS stage, count(*) AS cnt
        FROM jobs
        WHERE current_stage NOT IN ('delivered', 'cancelled')
          AND client_deadline IS NOT NULL
          AND client_deadline::text < today_str
        GROUP BY current_stage
    ) sub;

    -- 5. Revenue (from invoices if exist, else from jobs)
    SELECT COALESCE(sum(total_amount), 0) INTO v_total_revenue
    FROM invoices WHERE created_at >= start_of_year;
    
    IF v_total_revenue = 0 THEN
        SELECT COALESCE(sum(total_amount), 0) INTO v_total_revenue
        FROM jobs WHERE created_at >= start_of_year AND current_stage != 'cancelled';
    END IF;

    -- 6. Pending Payments
    SELECT COALESCE(sum(balance_due), 0) INTO v_pending_payments
    FROM invoices WHERE payment_status != 'paid';
    
    IF v_pending_payments = 0 THEN
        SELECT COALESCE(sum(total_amount - COALESCE(amount_received, 0)), 0) INTO v_pending_payments
        FROM jobs WHERE payment_status != 'paid' AND current_stage != 'cancelled';
    END IF;

    -- 7. Pending Dispatches
    SELECT count(*) INTO v_pending_dispatches FROM dispatches 
    WHERE status IN ('pending', 'packed', 'ready');

    -- 8. Leads This Month
    SELECT count(*) INTO v_leads_this_month FROM leads 
    WHERE created_at >= start_of_month;

    -- 9. Orders This Month
    SELECT count(*) INTO v_orders_this_month FROM jobs 
    WHERE created_at >= start_of_month AND current_stage != 'cancelled';

    -- 10. Overdue Payments (invoices past due date)
    SELECT count(*) INTO v_overdue_payments FROM invoices 
    WHERE payment_status != 'paid' AND due_date IS NOT NULL AND due_date::text < today_str;

    -- 11. Follow-ups Due (leads + follow_ups table)
    SELECT count(*) INTO v_follow_ups_due FROM leads 
    WHERE next_follow_up IS NOT NULL AND next_follow_up::text <= today_str 
      AND status NOT IN ('won', 'lost');
    
    BEGIN
        SELECT count(*) INTO v_follow_ups_table FROM follow_ups 
        WHERE follow_up_date IS NOT NULL AND follow_up_date::text <= today_str;
    EXCEPTION WHEN undefined_table THEN
        v_follow_ups_table := 0;
    END;

    -- 12. Low Stock
    BEGIN
        SELECT count(*) INTO v_low_stock FROM paper_stock 
        WHERE quantity <= COALESCE(reorder_level, 0);
    EXCEPTION WHEN undefined_table THEN
        v_low_stock := 0;
    END;

    -- 13. Jobs Completed Today
    SELECT count(*) INTO v_jobs_completed_today FROM jobs 
    WHERE current_stage = 'delivered' AND updated_at::date = CURRENT_DATE;

    -- 14. Today's Focus
    SELECT count(*) INTO v_jobs_due_today FROM jobs
    WHERE current_stage NOT IN ('delivered', 'cancelled')
      AND client_deadline IS NOT NULL AND client_deadline::text = today_str;

    SELECT count(*) INTO v_jobs_delayed FROM jobs
    WHERE current_stage NOT IN ('delivered', 'cancelled')
      AND client_deadline IS NOT NULL AND client_deadline::text < today_str;

    SELECT count(*) INTO v_payments_due_today FROM invoices
    WHERE payment_status != 'paid' AND due_date IS NOT NULL AND due_date::text = today_str;

    -- 15. Blocked Jobs
    SELECT count(*) INTO v_feedback_pending FROM jobs WHERE current_stage = 'approval';
    
    SELECT count(*) INTO v_payment_hold FROM jobs j
    WHERE j.current_stage IN ('ready', 'packed')
      AND EXISTS (
          SELECT 1 FROM invoices i 
          WHERE i.job_id = j.id AND i.payment_status != 'paid'
      );

    -- 16. Vendor Stats
    SELECT count(*) INTO v_jobs_at_vendor FROM jobs 
    WHERE current_stage IN ('printing', 'finishing');

    SELECT count(*) INTO v_vendor_due_today FROM jobs
    WHERE current_stage IN ('printing', 'finishing')
      AND internal_deadline IS NOT NULL AND internal_deadline::text = today_str;

    SELECT count(*) INTO v_vendor_delayed FROM jobs
    WHERE current_stage IN ('printing', 'finishing')
      AND internal_deadline IS NOT NULL AND internal_deadline::text < today_str;

    -- 17. Sales Performance (monthly, last 6 months)
    SELECT COALESCE(jsonb_agg(row_to_json(sub)), '[]'::jsonb)
    INTO v_sales_performance
    FROM (
        SELECT 
            to_char(month_start, 'Mon') AS month,
            COALESCE(inv_total, job_total) AS value,
            (EXTRACT(MONTH FROM month_start) = EXTRACT(MONTH FROM CURRENT_DATE) 
             AND EXTRACT(YEAR FROM month_start) = EXTRACT(YEAR FROM CURRENT_DATE)) AS active
        FROM (
            SELECT generate_series(
                date_trunc('month', CURRENT_DATE - INTERVAL '5 months'),
                date_trunc('month', CURRENT_DATE),
                '1 month'::interval
            ) AS month_start
        ) months
        LEFT JOIN LATERAL (
            SELECT sum(total_amount) AS inv_total FROM invoices
            WHERE created_at >= month_start AND created_at < month_start + INTERVAL '1 month'
        ) inv ON true
        LEFT JOIN LATERAL (
            SELECT sum(total_amount) AS job_total FROM jobs
            WHERE created_at >= month_start AND created_at < month_start + INTERVAL '1 month'
              AND current_stage != 'cancelled'
        ) j ON true
        ORDER BY month_start
    ) sub;

    -- Build result JSON
    result := jsonb_build_object(
        'total_clients', v_total_clients,
        'active_jobs', v_active_jobs,
        'total_revenue', v_total_revenue,
        'pending_payments', v_pending_payments,
        'pending_dispatches', v_pending_dispatches,
        'leads_this_month', v_leads_this_month,
        'orders_this_month', v_orders_this_month,
        'pipeline', v_pipeline,
        'pipeline_overdue', v_pipeline_overdue,
        'alerts', jsonb_build_object(
            'overdue_payments', v_overdue_payments,
            'follow_ups_due', v_follow_ups_due + v_follow_ups_table,
            'low_stock', v_low_stock,
            'blocked_jobs', v_feedback_pending + v_payment_hold,
            'blocked_breakdown', jsonb_build_object(
                'feedback', v_feedback_pending,
                'payment', v_payment_hold
            )
        ),
        'todays_focus', jsonb_build_object(
            'jobs_due', v_jobs_due_today,
            'jobs_delayed', v_jobs_delayed,
            'jobs_completed', v_jobs_completed_today,
            'payments_due', v_payments_due_today
        ),
        'vendor_stats', jsonb_build_object(
            'jobs_at_vendor', v_jobs_at_vendor,
            'due_today', v_vendor_due_today,
            'delayed', v_vendor_delayed
        ),
        'sales_performance', v_sales_performance
    );

    RETURN result;
END;
$$;

-- Grant access
GRANT EXECUTE ON FUNCTION get_dashboard_stats() TO anon, authenticated, service_role;
