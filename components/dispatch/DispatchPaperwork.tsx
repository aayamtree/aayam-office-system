'use client';

// ─────────────────────────────────────────────────────────────
// The documents panel inside Create Dispatch.
//
// Accounts uploads the Invoice PDF and the E-Way Bill on the job
// page. Until now the dispatcher's modal showed none of it — they
// were asked to verify paperwork they could not open. This panel
// shows both documents, lets them be opened, and requires an
// explicit tick before goods can leave.
// ─────────────────────────────────────────────────────────────

import { FileText, ScrollText, ExternalLink, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { getDispatchPaperwork, formatFileSize, type DispatchDocsJob, type JobDoc } from '@/lib/job-documents';

interface Props {
  job: DispatchDocsJob | null | undefined;
  verified: boolean;
  onVerifiedChange: (v: boolean) => void;
}

function DocRow({ doc }: { doc: JobDoc }) {
  const meta = [formatFileSize(doc.size), doc.uploaded_at ? new Date(doc.uploaded_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '']
    .filter(Boolean)
    .join(' · ');

  return (
    <a
      href={doc.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 px-2.5 py-2 rounded-md border border-border bg-card hover:border-foreground/30 hover:bg-muted/40 transition-colors group"
    >
      <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
      <span className="flex-1 min-w-0">
        <span className="block text-xs font-medium text-foreground truncate">{doc.name}</span>
        {meta && <span className="block text-[10px] text-muted-foreground">{meta}</span>}
      </span>
      <ExternalLink className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground shrink-0" />
    </a>
  );
}

export default function DispatchPaperwork({ job, verified, onVerifiedChange }: Props) {
  const paper = getDispatchPaperwork(job);

  return (
    <div className="rounded-md border border-border bg-muted/30 p-3 space-y-3">
      <div className="flex items-center gap-2">
        <ScrollText className="w-4 h-4 text-foreground" />
        <h3 className="text-sm font-semibold text-foreground">Paperwork from Accounts</h3>
        {paper.hasInvoice && paper.hasEway && (
          <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-green-100 text-green-700">
            <CheckCircle2 className="w-3 h-3" /> Received
          </span>
        )}
      </div>

      {paper.isEmpty ? (
        <div className="flex gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
          <span>
            Nothing attached yet. Ask accounts for the invoice and e-way bill before dispatching —
            use <strong>Request Invoice</strong> on the job card.
          </span>
        </div>
      ) : null}

      {/* Nothing attached: the dispatcher can still go ahead (client collect,
          paperwork to follow, etc.) but must say so explicitly. Without this
          tick the Create Dispatch button could never be enabled. */}
      {paper.isEmpty ? (
        <label className="flex items-start gap-2 cursor-pointer select-none pt-1 border-t border-border/60">
          <input
            type="checkbox"
            checked={verified}
            onChange={(e) => onVerifiedChange(e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded border-gray-300 accent-gray-900 shrink-0"
          />
          <span className="text-xs text-foreground">
            I am dispatching this job without invoice / e-way bill paperwork.
            <span className="block text-[10px] text-muted-foreground mt-0.5">
              Recorded against this dispatch with your name and the time.
            </span>
          </span>
        </label>
      ) : (
        <div className="space-y-3">
          {/* ── Invoice ── */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Invoice</span>
              {paper.invoiceRef ? (
                <span className="text-[11px] font-mono text-foreground">{paper.invoiceRef}</span>
              ) : (
                <span className="text-[11px] text-muted-foreground italic">no reference no.</span>
              )}
            </div>
            {paper.invoices.length > 0 ? (
              paper.invoices.map((d) => <DocRow key={d.url} doc={d} />)
            ) : (
              <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
                No invoice PDF attached.
              </p>
            )}
          </div>

          {/* ── E-Way Bill ── */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">E-Way Bill</span>
              {paper.ewayNumber ? (
                <span className="text-[11px] font-mono text-foreground">{paper.ewayNumber}</span>
              ) : (
                <span className="text-[11px] text-muted-foreground italic">no bill no.</span>
              )}
            </div>
            {paper.ewayBills.length > 0 ? (
              paper.ewayBills.map((d) => <DocRow key={d.url} doc={d} />)
            ) : (
              <p className="text-[11px] text-muted-foreground bg-card border border-border rounded px-2 py-1.5">
                No e-way bill attached. Not every consignment needs one.
              </p>
            )}
          </div>

          {/* ── Verification ── the whole point of showing this here */}
          <label className="flex items-start gap-2 cursor-pointer select-none pt-1 border-t border-border/60">
            <input
              type="checkbox"
              checked={verified}
              onChange={(e) => onVerifiedChange(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-gray-300 accent-gray-900 shrink-0"
            />
            <span className="text-xs text-foreground">
              I have opened and checked the paperwork above against the goods.
              <span className="block text-[10px] text-muted-foreground mt-0.5">
                Recorded against this dispatch with your name and the time.
              </span>
            </span>
          </label>
        </div>
      )}
    </div>
  );
}
