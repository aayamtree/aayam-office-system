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
    return { package: pkg, packed, error: `${missed.length} job(s) were already packed by someone else and were skipped.` };
  }
  return { package: pkg, packed };
}
