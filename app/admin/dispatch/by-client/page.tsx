'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { toast } from '@/lib/toast';
import { Package, Loader2, ArrowRight, Copy, FileText, Search, CheckCircle } from 'lucide-react';
import { useJobs } from '@/lib/hooks';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { createPackage, type PackageType } from '@/lib/packages';
import LoadError from '@/components/LoadError';
import JobThumb from '@/components/shared/JobThumb';
import ProductBadge from '@/components/shared/ProductBadge';

// Dispatch by client.
// Start from the CLIENT: pick one, see everything of theirs that is ready to
// go, tick what travels together, say how it is packed (box / sack ...), and
// ask accounts for ONE invoice + e-way bill that lists every item in it.
// It sits on top of the existing Pack step: it creates the same package
// (consignment number and all) that Dispatch then ships.

const PACK_TYPES: { value: PackageType; label: string }[] = [
  { value: 'box', label: 'Box' },
  { value: 'sack', label: 'Katta' },
  { value: 'bundle', label: 'Bundle' },
  { value: 'pallet', label: 'Pallet' },
  { value: 'other', label: 'Other' },
];

export default function DispatchByClientPage() {
  const { profile } = useAuth();
  const { jobs, loading, error: jobsError, refetch: refetchJobs } = useJobs({
    select: 'id, job_number, project_name, client_id, priority, current_stage, product_category, client_deadline, quantity, thumbnail_url, files, package_id, client:clients(id, name, company)',
    filter: [{ column: 'current_stage', value: ['ready'], op: 'in' }],
    orderBy: { column: 'client_deadline', ascending: true },
    limit: 500,
  });

  // Same cold-load auth guard the Pack and Dispatch pages use.
  useEffect(() => {
    let done = false;
    supabase.auth.getSession().then(({ data }) => {
      if (data.session && !done) { done = true; refetchJobs?.(); }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION')) refetchJobs?.();
    });
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refetchJobs]);

  const unpacked = useMemo(() => jobs.filter(j => !(j as any).package_id), [jobs]);

  // Clients that have something ready, with a count.
  const clients = useMemo(() => {
    const m = new Map<string, { id: string; name: string; count: number }>();
    for (const j of unpacked) {
      if (!j.client_id) continue;
      const name = (j as any).client?.company || (j as any).client?.name || 'Unnamed client';
      const cur = m.get(j.client_id);
      if (cur) cur.count++; else m.set(j.client_id, { id: j.client_id, name, count: 1 });
    }
    return Array.from(m.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [unpacked]);

  const [clientSearch, setClientSearch] = useState('');
  const [clientId, setClientId] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [form, setForm] = useState({ package_type: 'box' as PackageType, package_count: '1', approx_weight_kg: '', notes: '' });
  const [typeTouched, setTypeTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const visibleClients = clients.filter(c => c.name.toLowerCase().includes(clientSearch.trim().toLowerCase()));
  const clientJobs = useMemo(() => unpacked.filter(j => j.client_id === clientId), [unpacked, clientId]);
  const selectedJobs = clientJobs.filter(j => selectedIds.has(j.id));

  // A job can be packed by someone else while this screen is open — drop it
  // from the selection instead of trying to pack it twice.
  useEffect(() => {
    setSelectedIds(prev => {
      const live = new Set(clientJobs.map(j => j.id));
      const next = new Set(Array.from(prev).filter(id => live.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [clientJobs]);

  const chooseClient = (id: string) => {
    setClientId(id);
    setSelectedIds(new Set());
    setTypeTouched(false);
    setForm({ package_type: 'box', package_count: '1', approx_weight_kg: '', notes: '' });
  };

  const toggle = (id: string) => setSelectedIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const allSelected = clientJobs.length > 0 && selectedJobs.length === clientJobs.length;
  const toggleAll = () => setSelectedIds(allSelected ? new Set() : new Set(clientJobs.map(j => j.id)));

  // Suggest a pack type from what is ticked — only a starting point, until the
  // dispatcher picks one themselves.
  const suggestedType: PackageType = selectedJobs.some(j => /box/i.test(String((j as any).product_category || ''))) ? 'box' : 'sack';
  useEffect(() => {
    if (!typeTouched && selectedJobs.length > 0) setForm(f => (f.package_type === suggestedType ? f : { ...f, package_type: suggestedType }));
  }, [suggestedType, selectedJobs.length, typeTouched]);

  const clientName = clients.find(c => c.id === clientId)?.name || '';
  const typeLabel = PACK_TYPES.find(t => t.value === form.package_type)?.label || 'Package';
  const count = parseInt(form.package_count, 10);

  // The text accounts needs for the invoice / e-way bill.
  const packingList = useMemo(() => {
    if (selectedJobs.length === 0) return '';
    const lines = selectedJobs.map((j, i) =>
      `${i + 1}. ${j.project_name || j.job_number}${j.quantity ? ` — ${j.quantity} pcs` : ''} (${(j as any).product_category || 'item'}, #${j.job_number})`
    );
    return `${clientName}\nPacked as: ${Number.isFinite(count) && count > 0 ? count : 1} ${typeLabel}(s)${form.approx_weight_kg ? ` · ~${form.approx_weight_kg} kg` : ''}\n\n${lines.join('\n')}`;
  }, [selectedJobs, clientName, count, typeLabel, form.approx_weight_kg]);

  const copyList = async () => {
    try {
      await navigator.clipboard.writeText(packingList);
      toast.info('Packing list copied — paste it into the invoice / e-way bill.');
    } catch {
      toast.error('Could not copy. Select the text and copy it manually.');
    }
  };

  const pack = async (alsoRequestInvoice: boolean) => {
    if (selectedJobs.length === 0 || !clientId) return;
    if (!Number.isFinite(count) || count < 1) {
      toast.error('Enter how many boxes / katta this is (at least 1).');
      return;
    }
    setSubmitting(true);
    try {
      const result = await createPackage(
        {
          client_id: clientId,
          package_type: form.package_type,
          package_count: count,
          approx_weight_kg: form.approx_weight_kg ? Number(form.approx_weight_kg) : null,
          notes: form.notes || null,
          created_by: profile?.id,
        },
        selectedJobs.map(j => j.id)
      );
      if (!result.package) throw new Error(result.error || 'Could not create the package');
      if (result.error) toast.error(`${result.package.consignment_no}: ${result.error}`);

      if (alsoRequestInvoice && result.packed.length > 0) {
        const res = await fetch(`/api/packages/${result.package.id}/request-invoice`, { method: 'POST' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          toast.error(`Packed as ${result.package.consignment_no}, but the invoice request failed: ${data.error || 'try "Request single invoice" on the Dispatch board'}`);
        } else {
          toast.info(`Packed as ${result.package.consignment_no} — one invoice requested from accounts ✓`);
        }
      } else if (!result.error) {
        toast.info(`Packed as ${result.package.consignment_no} — ${result.packed.length} job(s), ready to dispatch.`);
      }
      setSelectedIds(new Set());
      setTypeTouched(false);
      setForm({ package_type: 'box', package_count: '1', approx_weight_kg: '', notes: '' });
      refetchJobs?.();
    } catch (err: any) {
      toast.error('Could not create package: ' + (err?.message || String(err)));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-3 md:space-y-4 animate-fade-in px-2">
      {jobsError && <LoadError variant="inline" what="the ready jobs" error={jobsError} onRetry={() => refetchJobs?.()} />}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-page-title text-gray-900">Dispatch by client</h1>
          <p className="text-xs md:text-sm text-gray-500">Pick a client, tick what travels together, pack it, and ask accounts for one invoice</p>
        </div>
        <Link href="/admin/dispatch" className="flex items-center gap-2 bg-gray-900 text-white px-3 md:px-4 py-2 md:py-2.5 rounded-md hover:bg-gray-800 transition-colors font-semibold text-sm">
          <ArrowRight className="w-4 h-4" />
          <span>Go to Dispatch</span>
        </Link>
      </div>

      {/* 1 — client */}
      <div className="bg-card border border-border rounded-md p-3 space-y-2">
        <label className="text-sm font-semibold text-foreground">1. Client</label>
        {clients.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing is waiting to be packed right now.</p>
        ) : (
          <>
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-2.5" />
              <input
                value={clientSearch}
                onChange={e => setClientSearch(e.target.value)}
                placeholder="Search client…"
                className="w-full pl-8 pr-3 py-2 border rounded-md text-sm"
              />
            </div>
            <select
              value={clientId}
              onChange={e => chooseClient(e.target.value)}
              className="w-full px-3 py-2 border rounded-md text-sm bg-white"
            >
              <option value="">Select a client…</option>
              {visibleClients.map(c => (
                <option key={c.id} value={c.id}>{c.name} — {c.count} ready</option>
              ))}
            </select>
          </>
        )}
      </div>

      {/* 2 — jobs */}
      {clientId && (
        <div className="bg-card border border-border rounded-md p-3 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold text-foreground">2. Ready to dispatch ({clientJobs.length})</label>
            <button onClick={toggleAll} className="text-xs text-gray-600 hover:text-gray-900 underline">
              {allSelected ? 'Clear all' : 'Select all'}
            </button>
          </div>
          {clientJobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing left to pack for this client.</p>
          ) : (
            <ul className="divide-y divide-border">
              {clientJobs.map(j => {
                const on = selectedIds.has(j.id);
                return (
                  <li key={j.id}>
                    <label className={`flex items-start gap-3 py-2 px-1 cursor-pointer rounded ${on ? 'bg-green-50/60' : 'hover:bg-muted/40'}`}>
                      <input type="checkbox" checked={on} onChange={() => toggle(j.id)} className="mt-1 w-4 h-4 accent-gray-900 shrink-0" />
                      <JobThumb job={j as any} size={44} />
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-medium text-foreground truncate">{j.project_name}</span>
                        <span className="flex flex-wrap items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                          <span className="font-mono">#{j.job_number}</span>
                          <ProductBadge category={(j as any).product_category} />
                          {j.quantity ? <span>Qty {j.quantity}</span> : null}
                          {j.client_deadline ? <span>Due {new Date(j.client_deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span> : null}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* 3 — packing */}
      {selectedJobs.length > 0 && (
        <div className="bg-card border border-border rounded-md p-3 space-y-3">
          <label className="text-sm font-semibold text-foreground">3. How will it be packed?</label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <span className="block text-xs text-muted-foreground mb-1">Type {!typeTouched && <em className="not-italic text-[10px]">(suggested)</em>}</span>
              <select
                value={form.package_type}
                onChange={e => { setTypeTouched(true); setForm(f => ({ ...f, package_type: e.target.value as PackageType })); }}
                className="w-full px-3 py-2 border rounded-md text-sm bg-white"
              >
                {PACK_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <span className="block text-xs text-muted-foreground mb-1">How many</span>
              <input type="number" min={1} value={form.package_count} onChange={e => setForm(f => ({ ...f, package_count: e.target.value }))} className="w-full px-3 py-2 border rounded-md text-sm" />
            </div>
            <div>
              <span className="block text-xs text-muted-foreground mb-1">Approx. weight (kg)</span>
              <input type="number" min={0} value={form.approx_weight_kg} onChange={e => setForm(f => ({ ...f, approx_weight_kg: e.target.value }))} className="w-full px-3 py-2 border rounded-md text-sm" />
            </div>
            <div>
              <span className="block text-xs text-muted-foreground mb-1">Notes</span>
              <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="w-full px-3 py-2 border rounded-md text-sm" />
            </div>
          </div>

          {/* packing summary */}
          <div className="rounded-md border border-border bg-muted/30 p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Packing list for the invoice / e-way bill</span>
              <button onClick={copyList} className="inline-flex items-center gap-1 text-xs text-gray-700 hover:text-gray-900">
                <Copy className="w-3 h-3" /> Copy
              </button>
            </div>
            <pre className="text-xs text-foreground whitespace-pre-wrap font-sans">{packingList}</pre>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <button
              onClick={() => pack(true)}
              disabled={submitting}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-900 text-white rounded-md hover:bg-gray-800 font-semibold text-sm disabled:opacity-50"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              Pack &amp; request single invoice
            </button>
            <button
              onClick={() => pack(false)}
              disabled={submitting}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 border rounded-md hover:bg-muted/40 font-medium text-sm disabled:opacity-50"
            >
              <Package className="w-4 h-4" /> Pack only
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
            <CheckCircle className="w-3 h-3" /> Accounts attaches the invoice to any one of these jobs; it then applies to the whole package on the Dispatch board.
          </p>
        </div>
      )}
    </div>
  );
}
