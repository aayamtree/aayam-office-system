// Single source of truth for "does this job have an invoice attached?"
// The accountant can attach an invoice in THREE ways, and dispatch must
// recognise all of them (previously it only checked an embedded invoices
// relation, so uploaded PDFs / typed references were ignored):
//   1. Typed an Invoice Reference No.        -> jobs.invoice_reference
//   2. Uploaded an "Invoice" PDF             -> a jobs.files[] entry named "Invoice: ..."
//   3. Created an invoice record             -> a row in invoices(job_id)
//
// Keep this in sync everywhere by importing hasInvoiceAttached / hasInvoiceFile.

export interface JobFileLike {
  name?: string | null;
  url?: string | null;
  type?: string | null;
}

export interface InvoiceStatusJob {
  invoice_reference?: string | null;
  files?: JobFileLike[] | null;
  invoices?: { id: string }[] | null;
}

/** True if the job has at least one uploaded file labelled as an Invoice. */
export function hasInvoiceFile(files?: JobFileLike[] | null): boolean {
  if (!Array.isArray(files)) return false;
  return files.some((f) => typeof f?.name === 'string' && /^\s*invoice\b/i.test(f.name));
}

/** True if an invoice is attached by any of the three supported means. */
export function hasInvoiceAttached(job?: InvoiceStatusJob | null): boolean {
  if (!job) return false;
  return (
    !!(job.invoice_reference && String(job.invoice_reference).trim()) ||
    (Array.isArray(job.invoices) && job.invoices.length > 0) ||
    hasInvoiceFile(job.files)
  );
}
