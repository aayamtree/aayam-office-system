'use client';

/**
 * Trial: Test copy. The Trial screens run on a copy of the live data (schema "trial", same project).
 * This page refreshes that copy from the live tables. It runs on the LIVE data (it is not a Trial route),
 * and it only ever writes into the copy.
 */

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from '@/lib/toast';
import { supabase } from '@/lib/supabase';
import AdminOnlyGate from '@/components/finance/AdminOnlyGate';

function Inner() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState('');
  const refresh = async () => {
    if (!confirm('Replace the test copy with a fresh copy of the live data? Anything you tested on the copy will be erased. Your live books are not touched.')) return;
    setBusy(true);
    const { data, error } = await supabase.rpc('fn_refresh_trial_copy');
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setResult(String(data)); toast.success('Test copy refreshed');
  };
  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-4">
      <h1 className="text-xl font-bold">Test copy</h1>
      <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-2 text-sm">
        <p>The Trial screens (Receive money, Invoices (new), Sales (new), Purchases (new), Banking (new), Accounts (new), Reports (new)) work on a <b>copy</b> of your live data. You can void, pay, import and reconcile there without touching your real books.</p>
        <p>Your live screens always use the live data. A red strip at the top of every Trial screen reminds you that you are on the copy.</p>
        <p>The copy does not update by itself. Refresh it whenever you want the latest live data. A refresh erases whatever you tested on the copy.</p>
      </div>
      <button onClick={refresh} disabled={busy} className="px-4 py-2 bg-gray-900 text-white rounded-md text-sm font-semibold disabled:opacity-50 inline-flex items-center gap-2">
        {busy && <Loader2 size={14} className="animate-spin" />}Refresh copy from live data
      </button>
      {result && <p className="text-sm text-green-700">{result}</p>}
    </div>
  );
}

export default function TestCopyPage() { return (<AdminOnlyGate noBanner><Inner /></AdminOnlyGate>); }
