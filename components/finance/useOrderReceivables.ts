'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { computeFifo } from '@/lib/order-receivables';
import { fetchAll, JOB_COLS, CLIENT_COLS } from '@/lib/fetch-all';

type Row = Record<string, any>;

// Only admin and finance may see or record payments (enforced by RLS too).
export function useOrderReceivables() {
    const { profile } = useAuth();
    const allowed = profile?.role === 'admin' || profile?.role === 'finance';
    const [jobs, setJobs] = useState<Row[]>([]);
    const [clients, setClients] = useState<Row[]>([]);
    const [payments, setPayments] = useState<Row[]>([]);   // includes voided rows (for the log)
    const [methods, setMethods] = useState<Row[]>([]);
    const [loading, setLoading] = useState(true);

    const reload = useCallback(async () => {
        if (!allowed) { setLoading(false); return; }
        const db = supabase as any;
        try {
            const [j, c, p, m] = await Promise.all([
                fetchAll(db, 'jobs', JOB_COLS),
                fetchAll(db, 'clients', CLIENT_COLS),
                fetchAll(db, 'receivables_payments', '*', 'created_at'),
                db.from('payment_methods').select('*').order('name', { ascending: true }),
            ]);
            setJobs(j); setClients(c); setPayments(p); setMethods(Array.isArray(m.data) ? m.data : []);
        } catch (e) {
            console.error('Receivables load failed', e);
        }
        setLoading(false);
    }, [allowed]);

    useEffect(() => { reload(); }, [reload]);

    // computeFifo ignores voided payments.
    const fifo = useMemo(() => computeFifo(jobs, payments), [jobs, payments]);
    const jobById = useMemo(() => new Map(jobs.map(j => [j.id, j])), [jobs]);
    const clientById = useMemo(() => new Map(clients.map(c => [c.id, c])), [clients]);
    const methodName = useMemo(() => new Map(methods.map(m => [m.id, m.name as string])), [methods]);

    const totals = useMemo(() => {
        let blue = 0, red = 0, orders = 0;
        fifo.byJob.forEach(o => { blue += o.blueDue; red += o.redDue; if (o.blueDue + o.redDue > 0) orders++; });
        return { blue, red, orders };
    }, [fifo]);

    return { allowed, loading, reload, jobs, clients, payments, methods, setMethods, fifo, jobById, clientById, methodName, totals };
}

export type OrderReceivables = ReturnType<typeof useOrderReceivables>;
