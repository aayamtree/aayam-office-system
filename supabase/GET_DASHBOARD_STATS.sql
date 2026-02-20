-- =============================================
-- GET DASHBOARD STATS - Server-Side RPC Function (v2 — robust)
-- All table queries wrapped in exception handlers so missing tables don't crash the RPC
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
    
    v_total_clients int := 0;
    v_active_jobs int := 0;
    v_total_revenue numeric := 0;
    v_pending_payments numeric := 0;
    v_pending_dispatches int := 0;
    v_leads_this_month int := 0;
    v_orders_this_month int := 0;
    v_overdue_payments int := 0;
    v_follow_ups_due int := 0;
    v_follow_ups_table int := 0;
    v_low_stock int := 0;
    v_jobs_completed_today int := 0;
    v_payments_due_today int := 0;
    v_jobs_due_today int := 0;
    v_jobs_delayed int := 0;
    v_feedback_pending int := 0;
    v_payment_hold int := 0;
    v_jobs_at_vendor int := 0;
    v_vendor_due_today int := 0;
    v_vendor_delayed int := 0;
    v_pipeline jsonb := '{}'::jsonb;
    v_pipeline_overdue jsonb := '{}'::jsonb;
    v_sales_performance jsonb := '[]'::jsonb;
BEGIN
    -- 1. Total Clients
    BEGIN
        SELECT count(*) INTO v_total_clients FROM clients;
    EXCEPTION WHEN undefined_table THEN v_total_clients := 0;
    END;

    -- 2. Active Jobs (not delivered/cancelled)
    BEGIN
        SELECT count(*) INTO v_active_jobs FROM jobs 
        WHERE current_stage NOT IN ('delivered', 'cancelled');
    EXCEPTION WHEN undefined_table THEN v_active_jobs := 0;
    END;

    -- 3. Pipeline counts (grouped by stage)
    BEGIN
        SELECT COALESCE(jsonb_object_agg(stage, cnt), '{}'::jsonb)
        INTO v_pipeline
        FROM (
            SELECT current_stage AS stage, count(*) AS cnt
            FROM jobs
            WHERE current_stage NOT IN ('delivered', 'cancelled')
            GROUP BY current_stage
        ) sub;
    EXCEPTION WHEN undefined_table THEN v_pipeline := '{}'::jsonb;
    END;

    -- 4. Pipeline overdue (by stage, where deadline < today)
    BEGIN
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
    EXCEPTION WHEN undefined_table THEN v_pipeline_overdue := '{}'::jsonb;
    END;

    -- 5. Revenue (from invoices if exist, else from jobs)
    BEGIN
        SELECT COALESCE(sum(total_amount), 0) INTO v_total_revenue
        FROM invoices WHERE created_at >= start_of_year;
    EXCEPTION WHEN undefined_table THEN v_total_revenue := 0;
    END;
    
    IF v_total_revenue = 0 THEN
        BEGIN
            SELECT COALESCE(sum(total_amount), 0) INTO v_total_revenue
            FROM jobs WHERE created_at >= start_of_year AND current_stage != 'cancelled';
        EXCEPTION WHEN undefined_table THEN v_total_revenue := 0;
        END;
    END IF;

    -- 6. Pending Payments
    BEGIN
        SELECT COALESCE(sum(balance_due), 0) INTO v_pending_payments
        FROM invoices WHERE payment_status != 'paid';
    EXCEPTION WHEN undefined_table THEN v_pending_payments := 0;
    END;
    
    IF v_pending_payments = 0 THEN
        BEGIN
            SELECT COALESCE(sum(total_amount - COALESCE(amount_received, 0)), 0) INTO v_pending_payments
            FROM jobs WHERE payment_status != 'paid' AND current_stage != 'cancelled';
        EXCEPTION WHEN undefined_table THEN v_pending_payments := 0;
        END;
    END IF;

    -- 7. Pending Dispatches
    BEGIN
        SELECT count(*) INTO v_pending_dispatches FROM dispatches 
        WHERE status IN ('pending', 'packed', 'ready');
    EXCEPTION WHEN undefined_table THEN v_pending_dispatches := 0;
    END;

    -- 8. Leads This Month
    BEGIN
        SELECT count(*) INTO v_leads_this_month FROM leads 
        WHERE created_at >= start_of_month;
    EXCEPTION WHEN undefined_table THEN v_leads_this_month := 0;
    END;

    -- 9. Orders This Month
    BEGIN
        SELECT count(*) INTO v_orders_this_month FROM jobs 
        WHERE created_at >= start_of_month AND current_stage != 'cancelled';
    EXCEPTION WHEN undefined_table THEN v_orders_this_month := 0;
    END;

    -- 10. Overdue Payments (invoices past due date)
    BEGIN
        SELECT count(*) INTO v_overdue_payments FROM invoices 
        WHERE payment_status != 'paid' AND due_date IS NOT NULL AND due_date::text < today_str;
    EXCEPTION WHEN undefined_table THEN v_overdue_payments := 0;
    END;

    -- 11. Follow-ups Due (leads + follow_ups table)
    BEGIN
        SELECT count(*) INTO v_follow_ups_due FROM leads 
        WHERE next_follow_up IS NOT NULL AND next_follow_up::text <= today_str 
          AND status NOT IN ('won', 'lost');
    EXCEPTION WHEN undefined_table THEN v_follow_ups_due := 0;
    END;
    
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
    BEGIN
        SELECT count(*) INTO v_jobs_completed_today FROM jobs 
        WHERE current_stage = 'delivered' AND updated_at::date = CURRENT_DATE;
    EXCEPTION WHEN undefined_table THEN v_jobs_completed_today := 0;
    END;

    -- 14. Today's Focus
    BEGIN
        SELECT count(*) INTO v_jobs_due_today FROM jobs
        WHERE current_stage NOT IN ('delivered', 'cancelled')
          AND client_deadline IS NOT NULL AND client_deadline::text = today_str;
    EXCEPTION WHEN undefined_table THEN v_jobs_due_today := 0;
    END;

    BEGIN
        SELECT count(*) INTO v_jobs_delayed FROM jobs
        WHERE current_stage NOT IN ('delivered', 'cancelled')
          AND client_deadline IS NOT NULL AND client_deadline::text < today_str;
    EXCEPTION WHEN undefined_table THEN v_jobs_delayed := 0;
    END;

    BEGIN
        SELECT count(*) INTO v_payments_due_today FROM invoices
        WHERE payment_status != 'paid' AND due_date IS NOT NULL AND due_date::text = today_str;
    EXCEPTION WHEN undefined_table THEN v_payments_due_today := 0;
    END;

    -- 15. Blocked Jobs
    BEGIN
        SELECT count(*) INTO v_feedback_pending FROM jobs WHERE current_stage = 'approval';
    EXCEPTION WHEN undefined_table THEN v_feedback_pending := 0;
    END;
    
    BEGIN
        SELECT count(*) INTO v_payment_hold FROM jobs j
        WHERE j.current_stage IN ('ready', 'packed')
          AND EXISTS (
              SELECT 1 FROM invoices i 
              WHERE i.job_id = j.id AND i.payment_status != 'paid'
          );
    EXCEPTION WHEN undefined_table THEN v_payment_hold := 0;
    END;

    -- 16. Vendor Stats
    BEGIN
        SELECT count(*) INTO v_jobs_at_vendor FROM jobs 
        WHERE current_stage IN ('printing', 'finishing');
    EXCEPTION WHEN undefined_table THEN v_jobs_at_vendor := 0;
    END;

    BEGIN
        SELECT count(*) INTO v_vendor_due_today FROM jobs
        WHERE current_stage IN ('printing', 'finishing')
          AND internal_deadline IS NOT NULL AND internal_deadline::text = today_str;
    EXCEPTION WHEN undefined_table THEN v_vendor_due_today := 0;
    END;

    BEGIN
        SELECT count(*) INTO v_vendor_delayed FROM jobs
        WHERE current_stage IN ('printing', 'finishing')
          AND internal_deadline IS NOT NULL AND internal_deadline::text < today_str;
    EXCEPTION WHEN undefined_table THEN v_vendor_delayed := 0;
    END;

    -- 17. Sales Performance (monthly, last 6 months)
    BEGIN
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
    EXCEPTION WHEN undefined_table THEN v_sales_performance := '[]'::jsonb;
    END;

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
