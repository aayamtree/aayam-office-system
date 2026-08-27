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
  jobIds: string[]
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
    .eq('current_stage', 'ready')
    .select('id');
  if (updErr) return { package: pkg, packed: [], error: updErr.message };

  const packed = (updated || []).map((j: any) => j.id as string);
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
