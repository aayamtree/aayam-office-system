// ─────────────────────────────────────────────────────────────
// Dispatch paperwork — one place that answers "what did accounts
// actually attach to this job, and can dispatch see it?"
//
// The problem this solves: accounts uploads the Invoice PDF and the
// E-Way Bill on the job page, but the dispatcher's Create Dispatch
// modal never showed them. Dispatch was being asked to verify
// documents it could not open.
//
// Files live in jobs.files[] with a "Label: filename.pdf" naming
// convention set by the upload handler on the job detail page.
// ─────────────────────────────────────────────────────────────

import type { FileAttachment } from '@/types/database';

export type DocKind = 'invoice' | 'eway';

export interface JobDoc {
  kind: DocKind;
  /** Filename with the "Invoice: " / "E-Way Bill: " label stripped off. */
  name: string;
  url: string;
  size?: number;
  uploaded_at?: string;
}

export interface DispatchDocsJob {
  files?: FileAttachment[] | null;
  invoice_reference?: string | null;
  eway_bill_number?: string | null;
}

const LABEL_PATTERNS: Record<DocKind, RegExp> = {
  // "Invoice: INVOICE_20250618.pdf"
  invoice: /^\s*invoice\b\s*:?\s*/i,
  // "E-Way Bill: ...", "eway bill: ...", "e way bill: ..."
  eway: /^\s*e[\s_-]*way[\s_-]*bill\b\s*:?\s*/i,
};

function matches(kind: DocKind, name: string): boolean {
  // E-Way must be tested first: "E-Way Bill: invoice_123.pdf" would
  // otherwise never reach the eway branch if invoice matched loosely.
  return LABEL_PATTERNS[kind].test(name);
}

/**
 * Pull the documents of one kind off a job, newest first, with exact
 * duplicates removed.
 *
 * Duplicates are real: the same PDF showed up twice on PO-2407001
 * because the upload handler appends to jobs.files[] with no identity
 * check, so a double-tap or a re-upload of the same file leaves two
 * rows pointing at the same object. We de-dupe on URL for display —
 * two genuinely different revisions have different storage paths and
 * are both kept.
 */
export function getJobDocs(job: DispatchDocsJob | null | undefined, kind: DocKind): JobDoc[] {
  const files = job?.files;
  if (!Array.isArray(files)) return [];

  const out: JobDoc[] = [];
  const seen = new Set<string>();

  for (const f of files) {
    const rawName = typeof f?.name === 'string' ? f.name : '';
    const url = typeof f?.url === 'string' ? f.url : '';
    if (!rawName || !url) continue;

    // E-Way is checked first so an e-way bill whose filename happens to
    // contain "invoice" is not misfiled as an invoice.
    const isEway = matches('eway', rawName);
    const isInvoice = !isEway && matches('invoice', rawName);
    const thisKind: DocKind | null = isEway ? 'eway' : isInvoice ? 'invoice' : null;
    if (thisKind !== kind) continue;

    if (seen.has(url)) continue;
    seen.add(url);

    out.push({
      kind,
      name: rawName.replace(LABEL_PATTERNS[kind], '').trim() || rawName,
      url,
      size: typeof f?.size === 'number' ? f.size : undefined,
      uploaded_at: typeof f?.uploaded_at === 'string' ? f.uploaded_at : undefined,
    });
  }

  return out.sort((a, b) => String(b.uploaded_at || '').localeCompare(String(a.uploaded_at || '')));
}

export interface DispatchPaperwork {
  invoices: JobDoc[];
  ewayBills: JobDoc[];
  invoiceRef: string | null;
  ewayNumber: string | null;
  /** A number was typed OR a file was uploaded. */
  hasInvoice: boolean;
  hasEway: boolean;
  /** Nothing at all — dispatch has nothing to verify. */
  isEmpty: boolean;
}

/** Everything the dispatcher needs to see before letting goods leave. */
export function getDispatchPaperwork(job: DispatchDocsJob | null | undefined): DispatchPaperwork {
  const invoices = getJobDocs(job, 'invoice');
  const ewayBills = getJobDocs(job, 'eway');
  const invoiceRef = job?.invoice_reference?.trim() || null;
  const ewayNumber = job?.eway_bill_number?.trim() || null;

  const hasInvoice = invoices.length > 0 || !!invoiceRef;
  const hasEway = ewayBills.length > 0 || !!ewayNumber;

  return {
    invoices,
    ewayBills,
    invoiceRef,
    ewayNumber,
    hasInvoice,
    hasEway,
    isEmpty: !hasInvoice && !hasEway,
  };
}

/** Human size for the file rows. */
export function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
