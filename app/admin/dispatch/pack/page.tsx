'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { toast } from '@/lib/toast';
import { Package, Loader2, X, CheckCircle, ArrowRight, Pencil } from 'lucide-react';
import { useJobs } from '@/lib/hooks';
import { useAuth } from '@/lib/auth-context';
import { Job } from '@/types/database';
import { supabase } from '@/lib/supabase';
import { createPackage, updatePackageDetails, addJobsToPackage, removeJobsFromPackage, type PackageType } from '@/lib/packages';
import { getVerifiedQty } from '@/lib/packing-display';
import LoadError from '@/components/LoadError';
import ProductBadge from '@/components/shared/ProductBadge';

// Jobs land here the moment QC passes them — before anyone has decided
// which box they go in. Packing several small jobs of one client together
// (to save on transport) happens on THIS page, once, ahead of arranging a
// transporter; Dispatch then ships an already-packed box.
export default function PackPage() {
  const { profile } = useAuth();
  const { jobs, loading, error: jobsError, refetch: refetchJobs } = useJobs({
    select: 'id, job_number, project_name, client_id, priority, current_stage, product_category, client_deadline, quantity, packing_info, package_id, package:packages(id, consignment_no, package_type, package_count, approx_weight_kg, notes, created_at), client:clients(id, name, company)',
    filter: [{ column: 'current_stage', value: ['ready'], op: 'in' }],
    orderBy: { column: 'client_deadline', ascending: true },
    limit: 500,
  });

  // Auth-race guard: a cold load can run this query before the Supabase
  // session is hydrated, so it runs as `anon` and RLS returns 0 rows — the
  // same trap the Dispatch board and QC-check page both hit before.
  useEffect(() => {
    let done = false;
    supabase.auth.getSession().then(({ data }) => {
      if (data.session && !done) { done = true; refetchJobs?.(); }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION')) {
        refetchJobs?.();
      }
    });
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refetchJobs]);

  useEffect(() => {
    const onFocus = () => { refetchJobs?.(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [refetchJobs]);

  const unpacked = jobs.filter(j => !(j as any).package_id);
  const packedJobs = jobs.filter(j => (j as any).package_id);

  // One card per package — several jobs sharing one physical box show as one thing.
  const packedGroups = useMemo(() => {
    const order: string[] = [];
    const byKey = new Map<string, Job[]>();
    for (const j of packedJobs) {
      const key = (j as any).package_id as string;
      if (!byKey.has(key)) { order.push(key); byKey.set(key, []); }
      byKey.get(key)!.push(j);
    }
    // Newest package first.
    order.sort((a, b) => {
      const ta = new Date((byKey.get(a)![0] as any).package?.created_at || 0).getTime();
      const tb = new Date((byKey.get(b)![0] as any).package?.created_at || 0).getTime();
      return tb - ta;
    });
    return order.map(key => ({ key, jobs: byKey.get(key)! }));
  }, [packedJobs]);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Selection hygiene: a job can leave "Awaiting Packing" (packed by someone
  // else in another tab, or bounced back for rework) while its id sits here.
  useEffect(() => {
    setSelectedIds(prev => {
      const unpackedIds = new Set(jobs.filter(j => j.current_stage === 'ready' && !(j as any).package_id).map(j => j.id));
      const next = new Set(Array.from(prev).filter(id => unpackedIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [jobs]);

  const selectedJobs = unpacked.filter(j => selectedIds.has(j.id));
  const anchorClientId = selectedJobs[0]?.client_id;
  const anchorClientName = selectedJobs[0]?.client?.company || selectedJobs[0]?.client?.name || '';

  const toggleSelect = (job: Job) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(job.id)) next.delete(job.id); else next.add(job.id);
      return next;
    });
  };

  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    package_type: 'box' as PackageType,
    package_count: '1',
    approx_weight_kg: '',
    notes: '',
  });

  // Edit an existing package — box type/count/weight/notes, and which jobs
  // are in it. Nothing about a package is final once created: a late job
  // needs adding, one belongs in a different shipment, or the weight was
  // only a guess. Available to anyone who can reach this page (admin +
  // dispatch, per RouteGuard's /admin/dispatch rule).
  const [editing, setEditing] = useState<null | { key: string; pkg: any; jobs: Job[] }>(null);
  const [editForm, setEditForm] = useState({
    package_type: 'box' as PackageType,
    package_count: '1',
    approx_weight_kg: '',
    notes: '',
  });
  const [editRemoveIds, setEditRemoveIds] = useState<Set<string>>(new Set());
  const [editAddIds, setEditAddIds] = useState<Set<string>>(new Set());
  const [editSubmitting, setEditSubmitting] = useState(false);

  const openModal = () => {
    if (selectedJobs.length === 0) return;
    setForm({ package_type: 'box', package_count: '1', approx_weight_kg: '', notes: '' });
    setShowModal(true);
  };

  const handleCreatePackage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedJobs.length === 0 || !anchorClientId) return;
    // One package = one client — the checkbox already prevents ticking a
    // second client, but a stale selection is cheap to re-check here too.
    if (new Set(selectedJobs.map(j => j.client_id || '')).size > 1) {
      toast.error('These jobs belong to different clients — one package goes to one client. Clear the selection and pick again.');
      setSelectedIds(new Set());
      return;
    }
    const count = parseInt(form.package_count, 10);
    if (!Number.isFinite(count) || count < 1) {
      toast.error('Enter how many boxes/sacks this is (at least 1).');
      return;
    }
    setSubmitting(true);
    try {
      const result = await createPackage(
        {
          client_id: anchorClientId,
          package_type: form.package_type,
          package_count: count,
          approx_weight_kg: form.approx_weight_kg ? Number(form.approx_weight_kg) : null,
          notes: form.notes || null,
          created_by: profile?.id,
        },
        selectedJobs.map(j => j.id)
      );
      if (!result.package) throw new Error(result.error || 'Could not create the package');
      if (result.error) {
        // Partial: the package exists and some jobs made it in — say exactly
        // what happened rather than a flat failure, since work already saved.
        toast.error(`${result.package.consignment_no}: ${result.error}`);
      } else {
        toast.info(`Packed as ${result.package.consignment_no} — ${result.packed.length} job(s), ready to dispatch.`);
      }
      setShowModal(false);
      setSelectedIds(new Set());
      refetchJobs?.();
    } catch (err: any) {
      toast.error('Could not create package: ' + (err?.message || String(err)));
    } finally {
      setSubmitting(false);
    }
  };

  // Candidates to add to the package being edited: same client, still
  // unpacked. Recomputed from the live jobs list, so a job someone else
  // just packed elsewhere drops out of this list on its own.
  const addCandidates = useMemo(() => {
    if (!editing) return [];
    const clientId = editing.jobs[0]?.client_id;
    return unpacked.filter(j => j.client_id === clientId);
  }, [editing, unpacked]);

  const openEdit = (group: { key: string; jobs: Job[] }) => {
    const pkg = (group.jobs[0] as any).package;
    setEditing({ key: group.key, pkg, jobs: group.jobs });
    setEditForm({
      package_type: (pkg?.package_type as PackageType) || 'box',
      package_count: String(pkg?.package_count ?? 1),
      approx_weight_kg: pkg?.approx_weight_kg != null ? String(pkg.approx_weight_kg) : '',
      notes: pkg?.notes || '',
    });
    setEditRemoveIds(new Set());
    setEditAddIds(new Set());
  };

  const toggleEditRemove = (jobId: string) => {
    setEditRemoveIds(prev => {
      const next = new Set(prev);
      if (next.has(jobId)) next.delete(jobId); else next.add(jobId);
      return next;
    });
  };

  const toggleEditAdd = (jobId: string) => {
    setEditAddIds(prev => {
      const next = new Set(prev);
      if (next.has(jobId)) next.delete(jobId); else next.add(jobId);
      return next;
    });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;

    // A package that would end up with zero jobs isn't an edit, it's a
    // delete — not something this form does. Block it instead of silently
    // leaving an empty, undispatchable package row behind.
    const remainingCount = editing.jobs.length - editRemoveIds.size + editAddIds.size;
    if (remainingCount < 1) {
      toast.error('A package needs at least one job — untick a removal or add a job before saving.');
      return;
    }
    const count = parseInt(editForm.package_count, 10);
    if (!Number.isFinite(count) || count < 1) {
      toast.error('Enter how many boxes/sacks this is (at least 1).');
      return;
    }

    setEditSubmitting(true);
    try {
      const pkg = editing.pkg;
      const newWeight = editForm.approx_weight_kg ? Number(editForm.approx_weight_kg) : null;
      // package_count/approx_weight_kg come back from PostgREST as numeric
      // types that are NOT guaranteed to be JS numbers (approx_weight_kg is
      // a Postgres `numeric` column, serialized as a STRING to avoid float
      // precision loss) — compare through Number() on both sides so a
      // same-value edit never reads as "changed".
      const detailsChanged =
        editForm.package_type !== ((pkg?.package_type as PackageType) || 'box') ||
        count !== Number(pkg?.package_count ?? 1) ||
        newWeight !== (pkg?.approx_weight_kg != null ? Number(pkg.approx_weight_kg) : null) ||
        (editForm.notes || null) !== (pkg?.notes || null);

      const errors: string[] = [];

      if (detailsChanged) {
        const res = await updatePackageDetails(editing.key, {
          package_type: editForm.package_type,
          package_count: count,
          approx_weight_kg: newWeight,
          notes: editForm.notes || null,
        }, profile?.id);
        if (!res.ok) errors.push(res.error || 'Could not update package details.');
      }

      // Add BEFORE remove, and gate the removal on the ADD's ACTUAL result
      // (not the requested count) — a job someone else grabbed a moment ago
      // makes addJobsToPackage silently add fewer than asked, and removing
      // on the ORIGINAL plan in that case could leave the package with zero
      // jobs: an orphaned, invisible package row nothing here can recover.
      let addedCount = 0;
      if (editAddIds.size > 0) {
        const res = await addJobsToPackage(editing.key, Array.from(editAddIds), profile?.id);
        addedCount = res.added.length;
        if (res.error) errors.push(res.error);
      }

      if (editRemoveIds.size > 0) {
        const safeToRemove = editing.jobs.length + addedCount - editRemoveIds.size >= 1;
        if (!safeToRemove) {
          errors.push('Could not remove those jobs — doing so would leave the package empty (fewer jobs were added than expected). Reload and try again with fewer removals.');
        } else {
          const res = await removeJobsFromPackage(editing.key, Array.from(editRemoveIds), profile?.id);
          if (res.error) errors.push(res.error);
        }
      }

      if (errors.length > 0) {
        toast.error(errors.join(' '));
      } else {
        toast.info('Package updated.');
      }
      setEditing(null);
      refetchJobs?.();
    } catch (err: any) {
      toast.error('Could not update package: ' + (err?.message || String(err)));
    } finally {
      setEditSubmitting(false);
    }
  };

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-3 md:space-y-4 animate-fade-in px-2">
      {jobsError && (
        <LoadError variant="inline" what="the Pack list" error={jobsError} onRetry={() => refetchJobs?.()} />
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-page-title text-gray-900">Pack</h1>
          <p className="text-xs md:text-sm text-gray-500">Box QC-passed jobs together, before a transporter is arranged</p>
        </div>
        <Link
          href="/admin/dispatch"
          className="flex items-center gap-2 bg-gray-900 text-white px-3 md:px-4 py-2 md:py-2.5 rounded-md hover:bg-gray-800 transition-colors font-semibold text-sm"
        >
          <ArrowRight className="w-4 h-4" />
          <span>Go to Dispatch</span>
        </Link>
      </div>

      {selectedJobs.length > 0 && (
        <div className="sticky top-2 z-40 flex flex-wrap items-center gap-2 bg-gray-900 text-white rounded-md px-3 py-2.5 shadow-lg">
          <Package className="w-4 h-4 shrink-0" />
          <span className="text-sm font-medium">
            {selectedJobs.length} job{selectedJobs.length > 1 ? 's' : ''} · {anchorClientName}
          </span>
          <div className="ml-auto flex gap-2">
            <button
              onClick={() => setSelectedIds(new Set())}
              className="px-3 py-1.5 text-xs font-medium rounded border border-white/30 hover:bg-white/10 transition-colors"
            >
              Clear
            </button>
            <button
              onClick={openModal}
              className="px-3 py-1.5 text-xs font-semibold rounded bg-white text-gray-900 hover:bg-gray-100 transition-colors"
            >
              Create Package →
            </button>
          </div>
        </div>
      )}

      <div>
        <h2 className="text-section text-gray-900 font-semibold mb-2">Awaiting Packing ({unpacked.length})</h2>
        {unpacked.length === 0 ? (
          <div className="text-center py-10 text-gray-500 border border-dashed rounded-md">
            Nothing waiting to be packed — QC-passed jobs land here.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5">
            {unpacked.map(job => {
              const isSelected = selectedIds.has(job.id);
              const selectDisabled = !isSelected && !!anchorClientId && job.client_id !== anchorClientId;
              const isOverdue = job.client_deadline && new Date(job.client_deadline) < new Date();
              return (
                <div key={job.id} className={`bg-card rounded-md border border-border border-l-4 border-l-green-400 hover:shadow-sm transition-shadow ${isSelected ? 'ring-2 ring-gray-900' : isOverdue ? 'ring-1 ring-red-200' : ''}`}>
                  <div className="bg-green-50/60 px-3 py-2 flex items-center justify-between border-b border-border/50 rounded-tr-md">
                    <div className="flex items-center gap-2 min-w-0">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={selectDisabled}
                        onChange={() => toggleSelect(job)}
                        title={selectDisabled
                          ? `One package = one client — this job is for a different client than ${anchorClientName}`
                          : 'Select to pack together with other jobs of this client'}
                        className="w-4 h-4 rounded border-gray-300 accent-gray-900 disabled:opacity-30 shrink-0 cursor-pointer disabled:cursor-not-allowed"
                      />
                      <span className="text-[10px] font-mono text-muted-foreground truncate">#{job.job_number}</span>
                    </div>
                    {job.priority === 'urgent' && <span className="text-[9px] px-1.5 py-0.5 bg-red-100 text-red-600 rounded font-bold uppercase">Urgent</span>}
                  </div>
                  <div className="px-3 pt-2 pb-3 space-y-2">
                    <div>
                      <p className="text-[10px] text-muted-foreground truncate">{job.client?.company || job.client?.name}</p>
                      <h3 className="text-sm font-semibold text-foreground line-clamp-2 mt-0.5">{job.project_name}</h3>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <ProductBadge category={(job as any).product_category} />
                      {isOverdue && <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-50 text-red-600 border border-red-200">Overdue</span>}
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Qty: {getVerifiedQty(job as any) ?? job.quantity} &bull; Due: {job.client_deadline ? new Date(job.client_deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {packedGroups.length > 0 && (
        <div>
          <h2 className="text-section text-gray-900 font-semibold mb-2">Packed — Ready to Dispatch ({packedJobs.length})</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {packedGroups.map(({ key, jobs: groupJobs }) => {
              const pkg = (groupJobs[0] as any).package;
              return (
                <div key={key} className="bg-white rounded-md overflow-hidden border border-gray-200">
                  <div className="bg-gray-900 px-3 py-2 flex items-center justify-between">
                    <span className="text-white font-semibold text-sm">{pkg?.consignment_no}</span>
                    <span className="text-xs px-2 py-0.5 bg-white/20 rounded-md text-white font-medium flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> Packed
                    </span>
                  </div>
                  <div className="p-3 space-y-1">
                    <p className="text-gray-500 text-xs">{groupJobs[0].client?.company || groupJobs[0].client?.name}</p>
                    <p className="text-xs text-gray-700">
                      📦 {pkg?.package_count} {pkg?.package_type}(s){pkg?.approx_weight_kg ? ` · ~${pkg.approx_weight_kg}kg` : ''}
                    </p>
                    <p className="text-[11px] text-gray-500">
                      {groupJobs.length} job{groupJobs.length > 1 ? 's' : ''}: {groupJobs.map(j => j.job_number).join(', ')}
                    </p>
                    <button
                      onClick={() => openEdit({ key, jobs: groupJobs })}
                      className="mt-1 flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900 font-medium"
                    >
                      <Pencil className="w-3 h-3" /> Edit
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-md w-full max-w-md max-h-[90vh] overflow-y-auto animate-scale-in">
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <h2 className="text-section">Create Package</h2>
                <p className="text-sm text-gray-500">
                  {selectedJobs.length} job{selectedJobs.length > 1 ? 's' : ''} · {anchorClientName}
                </p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-md"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleCreatePackage} className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Package Type</label>
                  <select
                    value={form.package_type}
                    onChange={e => setForm(f => ({ ...f, package_type: e.target.value as PackageType }))}
                    className="w-full px-3 py-2 border rounded-md text-sm"
                  >
                    <option value="box">Box</option>
                    <option value="sack">Sack</option>
                    <option value="bundle">Bundle</option>
                    <option value="pallet">Pallet</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">No. of Packages</label>
                  <input
                    type="number" min={1}
                    value={form.package_count}
                    onChange={e => setForm(f => ({ ...f, package_count: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-md text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Approx Weight (kg)</label>
                <input
                  type="number" placeholder="Optional"
                  value={form.approx_weight_kg}
                  onChange={e => setForm(f => ({ ...f, approx_weight_kg: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-md text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Notes</label>
                <input
                  type="text" placeholder="e.g. Fragile, handle with care"
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-md text-sm"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 border rounded-md text-sm">Cancel</button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800 shadow-sm font-semibold text-sm disabled:opacity-40"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Create Package'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-md w-full max-w-md max-h-[90vh] overflow-y-auto animate-scale-in">
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <h2 className="text-section">Edit Package</h2>
                <p className="text-sm text-gray-500">{editing.pkg?.consignment_no}</p>
              </div>
              <button onClick={() => setEditing(null)} className="p-2 hover:bg-gray-100 rounded-md"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSaveEdit} className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Package Type</label>
                  <select
                    value={editForm.package_type}
                    onChange={e => setEditForm(f => ({ ...f, package_type: e.target.value as PackageType }))}
                    className="w-full px-3 py-2 border rounded-md text-sm"
                  >
                    <option value="box">Box</option>
                    <option value="sack">Sack</option>
                    <option value="bundle">Bundle</option>
                    <option value="pallet">Pallet</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">No. of Packages</label>
                  <input
                    type="number" min={1}
                    value={editForm.package_count}
                    onChange={e => setEditForm(f => ({ ...f, package_count: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-md text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Approx Weight (kg)</label>
                <input
                  type="number" placeholder="Optional"
                  value={editForm.approx_weight_kg}
                  onChange={e => setEditForm(f => ({ ...f, approx_weight_kg: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-md text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Notes</label>
                <input
                  type="text" placeholder="e.g. Fragile, handle with care"
                  value={editForm.notes}
                  onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-md text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Jobs in this package</label>
                <div className="space-y-1 max-h-40 overflow-y-auto border rounded-md p-2">
                  {editing.jobs.map(job => {
                    const marked = editRemoveIds.has(job.id);
                    return (
                      <label key={job.id} className={`flex items-center gap-2 text-xs px-1.5 py-1 rounded cursor-pointer ${marked ? 'opacity-50 line-through' : 'hover:bg-gray-50'}`}>
                        <input
                          type="checkbox"
                          checked={!marked}
                          onChange={() => toggleEditRemove(job.id)}
                          className="w-3.5 h-3.5 accent-gray-900 shrink-0"
                        />
                        <span className="font-mono text-muted-foreground shrink-0">#{job.job_number}</span>
                        <span className="truncate">{job.project_name}</span>
                      </label>
                    );
                  })}
                </div>
                <p className="text-[11px] text-gray-400 mt-1">Untick a job to move it back to Awaiting Packing.</p>
              </div>

              {addCandidates.length > 0 && (
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Add more jobs ({editing.jobs[0]?.client?.company || editing.jobs[0]?.client?.name})
                  </label>
                  <div className="space-y-1 max-h-40 overflow-y-auto border rounded-md p-2">
                    {addCandidates.map(job => (
                      <label key={job.id} className="flex items-center gap-2 text-xs px-1.5 py-1 rounded cursor-pointer hover:bg-gray-50">
                        <input
                          type="checkbox"
                          checked={editAddIds.has(job.id)}
                          onChange={() => toggleEditAdd(job.id)}
                          className="w-3.5 h-3.5 accent-gray-900 shrink-0"
                        />
                        <span className="font-mono text-muted-foreground shrink-0">#{job.job_number}</span>
                        <span className="truncate">{job.project_name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setEditing(null)} className="flex-1 px-4 py-2 border rounded-md text-sm">Cancel</button>
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="flex-1 px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800 shadow-sm font-semibold text-sm disabled:opacity-40"
                >
                  {editSubmitting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
