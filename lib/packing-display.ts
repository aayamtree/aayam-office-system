// ─────────────────────────────────────────────────────────────
// Packaging (box/sack type, count, weight) now lives on a shared
// `packages` row — one box, many jobs, created at the Pack step. Jobs
// QC'd before that step existed still carry the full shape in
// jobs.packing_info; that data is frozen (never written again) and
// read here ONLY as a fallback for those historical jobs.
//
// jobs.packing_info keeps exactly ONE live field going forward:
// verified_qty, set at QC pass — a per-job fact independent of which
// box it ends up in.
// ─────────────────────────────────────────────────────────────

export interface PackagingDisplay {
  packageType?: string;
  packageCount?: number;
  approxWeightKg?: number;
  notes?: string;
  consignmentNo?: string;
}

export function getPackagingDisplay(job: {
  package?: {
    package_type?: string;
    package_count?: number;
    approx_weight_kg?: number;
    notes?: string;
    consignment_no?: string;
  } | null;
  packing_info?: {
    package_type?: string;
    package_count?: number;
    approx_weight_kg?: number;
    packing_notes?: string;
  } | null;
}): PackagingDisplay | null {
  if (job.package) {
    return {
      packageType: job.package.package_type,
      packageCount: job.package.package_count,
      approxWeightKg: job.package.approx_weight_kg,
      notes: job.package.notes,
      consignmentNo: job.package.consignment_no,
    };
  }
  // Legacy: a job QC'd before the Pack step existed, whose packing_info
  // still carries the fuller (pre-2026-08-27) shape.
  if (job.packing_info?.package_type) {
    return {
      packageType: job.packing_info.package_type,
      packageCount: job.packing_info.package_count,
      approxWeightKg: job.packing_info.approx_weight_kg,
      notes: job.packing_info.packing_notes,
    };
  }
  return null;
}

export function getVerifiedQty(job: {
  packing_info?: { verified_qty?: number } | null;
  quantity?: number;
}): number | undefined {
  return job.packing_info?.verified_qty ?? job.quantity;
}
