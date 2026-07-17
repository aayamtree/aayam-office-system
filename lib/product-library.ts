// Product Library — shared types & helpers.

export const PACKAGING_TYPES = ['Box', 'Label', 'Pouch', 'Carton', 'Sticker', 'Bag', 'Other'] as const;

export interface Product {
  id: string;
  client_id: string | null;
  brand_id: string | null;
  brand_name: string | null;
  name: string;
  category: string;
  size_w: number | null;
  size_h: number | null;
  size_d: number | null;
  size_unit: string | null;
  size_text: string | null;
  current_version_no: number;
  thumbnail_url: string | null;
  file_url: string | null;
  last_printed_at: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  clients?: { name: string; company: string | null } | null;
}

export interface ProductVersion {
  id: string;
  product_id: string;
  version_no: number;
  file_url: string | null;
  file_name: string | null;
  size_w: number | null;
  size_h: number | null;
  size_d: number | null;
  size_unit: string | null;
  size_text: string | null;
  size_check_status: string | null;
  size_check_note: string | null;
  designer_id: string | null;
  job_id: string | null;
  job_number: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  profiles?: { full_name: string | null } | null;
}

export interface ProductActivityRow {
  id: string;
  event_type: string;
  detail: string | null;
  actor_name: string | null;
  created_at: string;
}

/** Human-readable size: "100 × 150 × 40 mm" (or size_text fallback). */
export function formatSize(p: { size_w?: number | null; size_h?: number | null; size_d?: number | null; size_unit?: string | null; size_text?: string | null }): string {
  if (p.size_w && p.size_h) {
    const dims = [p.size_w, p.size_h, ...(p.size_d ? [p.size_d] : [])].join(' × ');
    return `${dims} ${p.size_unit || 'mm'}`;
  }
  return p.size_text || '—';
}

/** Client display — always prefer company name over contact person. */
export function clientLabel(c?: { name: string; company: string | null } | null): string {
  if (!c) return '—';
  return c.company || c.name;
}

const PT_TO_MM = 25.4 / 72;

/**
 * Lightweight PDF trim/media box reader — no external libs.
 * Reads the raw bytes and extracts the first TrimBox (preferred) or MediaBox.
 * Returns { w, h } in mm, or null if not found / not a PDF.
 */
export async function readPdfSizeMm(file: File): Promise<{ w: number; h: number; box: string } | null> {
  try {
    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') return null;
    // Boxes are almost always in the first or last 2 MB of the file.
    const chunks: string[] = [];
    const head = await file.slice(0, 2 * 1024 * 1024).arrayBuffer();
    chunks.push(new TextDecoder('latin1').decode(head));
    if (file.size > 2 * 1024 * 1024) {
      const tail = await file.slice(-2 * 1024 * 1024).arrayBuffer();
      chunks.push(new TextDecoder('latin1').decode(tail));
    }
    const text = chunks.join('\n');
    for (const box of ['TrimBox', 'MediaBox']) {
      const m = text.match(new RegExp(`\\/${box}\\s*\\[\\s*([\\d.-]+)\\s+([\\d.-]+)\\s+([\\d.-]+)\\s+([\\d.-]+)`));
      if (m) {
        const [x0, y0, x1, y1] = [+m[1], +m[2], +m[3], +m[4]];
        const w = Math.abs(x1 - x0) * PT_TO_MM;
        const h = Math.abs(y1 - y0) * PT_TO_MM;
        if (w > 1 && h > 1) return { w: Math.round(w * 10) / 10, h: Math.round(h * 10) / 10, box };
      }
    }
    return null;
  } catch {
    return null;
  }
}

/** Convert an entered dimension to mm for comparison. */
export function toMm(value: number, unit: string | null): number {
  if (unit === 'in') return value * 25.4;
  if (unit === 'cm') return value * 10;
  return value; // mm
}

/**
 * Compare entered size vs actual PDF size (tolerance 2 mm, orientation-agnostic).
 * Returns 'pass' | 'fail' with a note; 'skipped' when no comparison possible.
 */
export function checkSize(
  enteredW: number | null, enteredH: number | null, unit: string | null,
  pdf: { w: number; h: number; box: string } | null
): { status: 'pass' | 'fail' | 'skipped'; note: string } {
  if (!pdf) return { status: 'skipped', note: 'Could not read size from file' };
  if (!enteredW || !enteredH) return { status: 'skipped', note: `File is ${pdf.w} × ${pdf.h} mm (${pdf.box}); no entered size to compare` };
  const ew = toMm(enteredW, unit);
  const eh = toMm(enteredH, unit);
  const tol = 2;
  const direct = Math.abs(ew - pdf.w) <= tol && Math.abs(eh - pdf.h) <= tol;
  const rotated = Math.abs(ew - pdf.h) <= tol && Math.abs(eh - pdf.w) <= tol;
  if (direct || rotated) {
    return { status: 'pass', note: `File ${pdf.box} ${pdf.w} × ${pdf.h} mm matches entered size` };
  }
  return {
    status: 'fail',
    note: `MISMATCH: entered ${Math.round(ew * 10) / 10} × ${Math.round(eh * 10) / 10} mm but file ${pdf.box} is ${pdf.w} × ${pdf.h} mm`,
  };
}
