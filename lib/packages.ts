// ─────────────────────────────────────────────────────────────
// Packages: the Pack step. One or more QC-passed jobs of ONE client are
// boxed together here, before a transporter is ever chosen. Dispatch later
// ships an already-packed package rather than re-deciding what's in the box.
// ─────────────────────────────────────────────────────────────

import { supabase } from './supabase';
import { logActivity } from './logger';

export type PackageType = 'box' | 'sack' | 'bundle' | 'pallet' | 'other';

export interface CreatePackageInput {
  client_id: string;
  package_type: PackageType;
  package_count: number;
  approx_weight_kg?: number | null;
  notes?: string | null;
  created_by?: string;
}

export interface CreatePackageResult {
  package: { id: string; consignment_no: string } | null;
  packed: string[];
  error?: string;
}

/**
 * Create a package and box the given jobs into it in one call.
 *
 * jobs.package_id is only ever set from NULL (see check_job_repack — the DB
 * refuses a second write), so this filters `.is('package_id', null)` too:
 * without it, a job packed by someone else a moment ago would silently drop
 * out of the update (Postgres WHERE just matches nothing) while still being
 * reported back as "packed" here.
 */
export async function createPackage(
  input: CreatePackageInput,
  jobIds: string[],
  opts?: {
    /** Stages a job may be in to be boxed. Default: only 'ready' (QC passed).
     *  Printer → Client jobs ship straight from the printer, so they are still
     *  at 'material_received' — warehouse QC is skipped by design. */
    allowedStages?: string[];
  }
): Promise<CreatePackageResult> {
  if (jobIds.length === 0) return { package: null, packed: [], error: 'No jobs selected' };

  const { data: cn, error: cnErr } = await supabase.rpc('fn_next_consignment_no');
  if (cnErr) return { package: null, packed: [], error: 'Could not generate a consignment number: ' + cnErr.message };
  const consignment_no = (cn as string) || `CN-${Date.now()}`;

  const { data: pkg, error: pkgErr } = await supabase
    .from('packages')
    .insert([{ ...input, consignment_no }])
    .select('id, consignment_no')
    .single();
  if (pkgErr || !pkg) return { package: null, packed: [], error: pkgErr?.message || 'Could not create the package' };

  const { data: updated, error: updErr } = await supabase
    .from('jobs')
    .update({ package_id: pkg.id })
    .in('id', jobIds)
    .is('package_id', null)
    .in('current_stage', opts?.allowedStages?.length ? opts.allowedStages : ['ready'])
    .select('id');
  if (updErr) return { package: pkg, packed: [], error: updErr.message };

  const packed = (updated || []).map((j: any) => j.id as string);
  // Nothing got boxed: don't leave an empty package (and a used consignment
  // number) lying around. Best-effort — the Pack page also sweeps empties.
  if (packed.length === 0) {
    await supabase.from('packages').delete().eq('id', pkg.id);
  }
  logActivity(
    'Created Package',
    'Package',
    pkg.id,
    `Packed ${packed.length} job(s) as ${consignment_no} (${input.package_count} ${input.package_type}(s))`,
    undefined,
    input.created_by
  );

  if (packed.length < jobIds.length) {
    const missed = jobIds.filter(id => !packed.includes(id));
    return { package: pkg, packed, error: `${missed.length} job(s) could not be packed — already packed elsewhere, or sent back for rework, in the meantime.` };
  }
  return { package: pkg, packed };
}

// ─────────────────────────────────────────────────────────────
// Editing an existing package — a box is rarely final: a job gets added
// late, one turns out to belong in a different shipment, or the weight was
// only a guess at Pack time. These three operations are used together by
// the Pack page's Edit modal, each independently so a partial failure (e.g.
// one job already claimed by someone else) doesn't undo the rest.
// ─────────────────────────────────────────────────────────────

export interface UpdatePackageDetailsInput {
  package_type?: PackageType;
  package_count?: number;
  approx_weight_kg?: number | null;
  notes?: string | null;
}

/** Change box type/count/weight/notes on an existing package. Does not touch which jobs are in it. */
export async function updatePackageDetails(
  packageId: string,
  updates: UpdatePackageDetailsInput,
  updatedBy?: string
): Promise<{ ok: boolean; error?: string }> {
  if (Object.keys(updates).length === 0) return { ok: true };
  const { error } = await supabase.from('packages').update(updates).eq('id', packageId);
  if (error) return { ok: false, error: error.message };
  logActivity('Updated Package', 'Package', packageId, `Changed ${Object.keys(updates).join(', ')}`, undefined, updatedBy);
  return { ok: true };
}

/**
 * Add already-QC'd, not-yet-packed jobs into an existing package.
 * Same `.is('package_id', null)` race guard as createPackage — a job packed
 * by someone else a moment ago is silently skipped, not force-moved (the DB
 * trigger check_job_repack refuses a non-null → non-null write anyway).
 */
export async function addJobsToPackage(
  packageId: string,
  jobIds: string[],
  addedBy?: string
): Promise<{ added: string[]; error?: string }> {
  if (jobIds.length === 0) return { added: [] };
  const { data, error } = await supabase
    .from('jobs')
    .update({ package_id: packageId })
    .in('id', jobIds)
    .is('package_id', null)
    .eq('current_stage', 'ready')
    .select('id');
  if (error) return { added: [], error: error.message };
  const added = (data || []).map((j: any) => j.id as string);
  if (added.length > 0) {
    logActivity('Added Jobs to Package', 'Package', packageId, `Added ${added.length} job(s)`, undefined, addedBy);
  }
  if (added.length < jobIds.length) {
    const missed = jobIds.filter(id => !added.includes(id));
    return { added, error: `${missed.length} job(s) could not be added — already packed elsewhere, or sent back for rework, in the meantime.` };
  }
  return { added };
}

/**
 * Move jobs back out of a package to "Awaiting Packing" (package_id → NULL).
 * `.eq('package_id', packageId)` only ever touches jobs actually in THIS
 * package. The DB trigger (check_job_repack) is the real gate: it refuses
 * the unpack once the job has fully shipped, so a job dispatched a moment
 * ago by someone else surfaces as an error here rather than silently
 * detaching from a consignment that's already left.
 */
export async function removeJobsFromPackage(
  packageId: string,
  jobIds: string[],
  removedBy?: string
): Promise<{ removed: string[]; error?: string }> {
  if (jobIds.length === 0) return { removed: [] };
  const { data, error } = await supabase
    .from('jobs')
    .update({ package_id: null })
    .in('id', jobIds)
    .eq('package_id', packageId)
    .select('id');
  if (error) return { removed: [], error: error.message };
  const removed = (data || []).map((j: any) => j.id as string);
  if (removed.length > 0) {
    logActivity('Removed Jobs from Package', 'Package', packageId, `Removed ${removed.length} job(s)`, undefined, removedBy);
  }
  if (removed.length < jobIds.length) {
    const missed = jobIds.filter(id => !removed.includes(id));
    return { removed, error: `${missed.length} job(s) could not be removed (already dispatched, or moved elsewhere in the meantime).` };
  }
  return { removed };
}

// ─────────────────────────────────────────────────────────────
// Rollback and moving between packages.
//
// The DB trigger check_job_repack refuses package A -> package B in one
// write (and refuses any unpack once the job has shipped). So a "move" is
// two writes: take the job out, then put it in the target. If the second
// write fails, the job is put back where it was — a move never leaves a
// job unpacked by accident.
// ─────────────────────────────────────────────────────────────

/** Delete a package row only if no job points at it any more. Best-effort: an empty row is harmless (the Pack page groups by jobs). */
async function deletePackageIfEmpty(packageId: string): Promise<boolean> {
  const { count, error } = await supabase
    .from('jobs')
    .select('id', { count: 'exact', head: true })
    .eq('package_id', packageId);
  if (error || (count ?? 1) > 0) return false;
  const { error: delErr } = await supabase.from('packages').delete().eq('id', packageId);
  return !delErr;
}

/**
 * Roll back a whole package: every job goes back to Awaiting Packing and the
 * empty package is removed. Refused by the DB for any job already dispatched.
 */
export async function unpackPackage(
  packageId: string,
  consignmentNo: string,
  by?: string
): Promise<{ ok: boolean; removed: number; error?: string }> {
  const { data: rows, error: readErr } = await supabase.from('jobs').select('id').eq('package_id', packageId);
  if (readErr) return { ok: false, removed: 0, error: readErr.message };
  const ids = (rows || []).map((r: any) => r.id as string);
  if (ids.length === 0) {
    await deletePackageIfEmpty(packageId);
    return { ok: true, removed: 0 };
  }
  const res = await removeJobsFromPackage(packageId, ids, by);
  if (res.error) return { ok: false, removed: res.removed.length, error: res.error };
  await deletePackageIfEmpty(packageId);
  logActivity('Unpacked Package', 'Package', packageId, `${consignmentNo} unpacked — ${res.removed.length} job(s) back to Awaiting Packing`, undefined, by);
  return { ok: true, removed: res.removed.length };
}

/**
 * Move jobs from one package into another package of the same client.
 * Source package is removed if it ends up empty.
 */
export async function moveJobsBetweenPackages(
  fromPackageId: string,
  toPackageId: string,
  jobIds: string[],
  labels: { from: string; to: string },
  by?: string
): Promise<{ moved: string[]; error?: string }> {
  if (jobIds.length === 0 || fromPackageId === toPackageId) return { moved: [] };

  const out = await removeJobsFromPackage(fromPackageId, jobIds, by);
  if (out.removed.length === 0) {
    return { moved: [], error: out.error || 'Could not take the job(s) out of the old package.' };
  }

  const inn = await addJobsToPackage(toPackageId, out.removed, by);
  // Anything that did not make it into the target goes back to where it was.
  const stranded = out.removed.filter(id => !inn.added.includes(id));
  let restoreFailed = false;
  if (stranded.length > 0) {
    const back = await addJobsToPackage(fromPackageId, stranded, by);
    restoreFailed = back.added.length < stranded.length;
  }

  if (inn.added.length > 0) {
    logActivity('Moved Jobs Between Packages', 'Package', toPackageId, `Moved ${inn.added.length} job(s) from ${labels.from} to ${labels.to}`, undefined, by);
    await deletePackageIfEmpty(fromPackageId);
  }

  const problems: string[] = [];
  if (out.error) problems.push(out.error);
  if (stranded.length > 0) {
    problems.push(restoreFailed
      ? `${stranded.length} job(s) could not be moved and are now in Awaiting Packing — pack them again.`
      : `${stranded.length} job(s) could not be moved and stayed in ${labels.from}.`);
  }
  return { moved: inn.added, error: problems.length ? problems.join(' ') : undefined };
}
