'use client';

// DesignScanCard — AI-read "document" of a design file + master cross-checks.
// Shows what is written on the design AND whether it matches the saved
// BRAND MASTER (address, phone, regn nos…) and PRODUCT MASTER (composition,
// usage, warnings). Mismatch → red alert with a one-click "update master"
// action when the design carries the new correct details.

import { useState } from 'react';
import { toast } from '@/lib/toast';
import {
  ScanLine, Loader2, ChevronDown, ChevronUp, Sparkles, Upload,
  CheckCircle2, AlertTriangle, BadgeCheck, Building2, FlaskConical,
} from 'lucide-react';

interface Props {
  productId: string;
  scanData: any | null;
  checkResults: any | null;
  latestVersionId: string | null;
  hasFile: boolean;
  onScanned: () => void;
  onRequestUpload?: () => void;
}

function Field({ label, value }: { label: string; value: any }) {
  if (value == null || value === '' || (Array.isArray(value) && value.length === 0)) return null;
  const text = Array.isArray(value) ? value.join(', ') : String(value);
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-wide text-gray-400">{label}</div>
      <div className="text-sm text-gray-800 break-words">{text}</div>
    </div>
  );
}

const FIELD_LABEL: Record<string, string> = {
  manufactured_by: 'Manufactured by', marketed_by: 'Marketed by', address: 'Address',
  phone: 'Phone', email: 'Email', website: 'Website', fssai_no: 'FSSAI',
  other_regn_nos: 'Regn Nos', category: 'Category',
  ingredients_or_composition: 'Composition', usage_instructions: 'Usage', warnings: 'Warnings',
};

function fmt(v: any): string {
  if (v == null) return '—';
  return Array.isArray(v) ? v.join(', ') : String(v);
}

function MasterCheck({ type, check, productId, onUpdated }: { type: 'brand' | 'product'; check: any; productId: string; onUpdated: () => void }) {
  const [updating, setUpdating] = useState(false);
  if (!check) return null;

  const Icon = type === 'brand' ? Building2 : FlaskConical;
  const title = type === 'brand' ? 'Brand Master' : 'Product Master';
  const name = check.brand_name || check.master_name || '';

  const applyUpdate = async () => {
    if (updating || !check.mismatches?.length) return;
    setUpdating(true);
    try {
      const fields: Record<string, any> = {};
      for (const m of check.mismatches) fields[m.field] = m.found;
      const res = await fetch('/api/products/master-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, id: check.brand_id || check.master_id, product_id: productId, fields }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Update failed');
      toast.success(`${title} updated with new details`);
      onUpdated();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUpdating(false);
    }
  };

  if (check.status === 'no_brand_on_design' || check.status === 'no_product_on_design') {
    return (
      <div className="rounded-md border px-3 py-2 text-xs text-gray-400 flex items-center gap-2">
        <Icon className="w-4 h-4" /> {title}: nothing detected on this design
      </div>
    );
  }
  if (check.status === 'new_master_created') {
    return (
      <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 flex items-center gap-2">
        <BadgeCheck className="w-4 h-4 shrink-0" /> {title}: new master created for “{name}” from this design
      </div>
    );
  }
  if (check.status === 'master_filled') {
    return (
      <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 flex items-center gap-2">
        <BadgeCheck className="w-4 h-4 shrink-0" /> {title}: “{name}” master filled from this design
      </div>
    );
  }
  if (check.status === 'match') {
    return (
      <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 flex items-center gap-2">
        <CheckCircle2 className="w-4 h-4 shrink-0" /> {title}: all details match “{name}” ✓{check.updated_by_user ? ' (master updated)' : ''}
      </div>
    );
  }
  // mismatch
  return (
    <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 space-y-2">
      <div className="flex items-center gap-2 font-semibold">
        <AlertTriangle className="w-4 h-4 shrink-0" /> {title}: MISMATCH with “{name}” — check before printing!
      </div>
      <table className="w-full text-[11px]">
        <thead>
          <tr className="text-red-500">
            <th className="text-left font-medium pr-2">Field</th>
            <th className="text-left font-medium pr-2">Master says</th>
            <th className="text-left font-medium">On this design</th>
          </tr>
        </thead>
        <tbody>
          {check.mismatches?.map((m: any) => (
            <tr key={m.field} className="align-top">
              <td className="pr-2 py-0.5 font-medium">{FIELD_LABEL[m.field] || m.field}</td>
              <td className="pr-2 py-0.5">{fmt(m.master)}</td>
              <td className="py-0.5">{fmt(m.found)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <button
        onClick={applyUpdate}
        disabled={updating}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white border border-red-300 text-red-700 hover:bg-red-100 text-[11px] font-medium"
      >
        {updating && <Loader2 className="w-3 h-3 animate-spin" />}
        Design is correct — update master with these details
      </button>
    </div>
  );
}

export default function DesignScanCard({ productId, scanData, checkResults, latestVersionId, hasFile, onScanned, onRequestUpload }: Props) {
  const [scanning, setScanning] = useState(false);
  const [showFullText, setShowFullText] = useState(false);

  const runScan = async () => {
    if (!latestVersionId || scanning) return;
    setScanning(true);
    try {
      const res = await fetch(`/api/products/${productId}/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version_id: latestVersionId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Scan failed');
      toast.success('Design scanned & checked against masters');
      onScanned();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="bg-white border rounded-lg">
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <div className="font-semibold text-sm flex items-center gap-2">
          <ScanLine className="w-4 h-4 text-indigo-500" /> Design Contents
          <span className="text-[10px] font-normal text-gray-400 flex items-center gap-0.5">
            <Sparkles className="w-3 h-3" /> AI scan + master check
          </span>
        </div>
        {hasFile && (
          <button
            onClick={runScan}
            disabled={scanning || !latestVersionId}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-indigo-200 text-indigo-700 hover:bg-indigo-50 disabled:opacity-40"
          >
            {scanning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ScanLine className="w-3.5 h-3.5" />}
            {scanning ? 'Reading design…' : scanData ? 'Re-scan & check' : 'Scan design'}
          </button>
        )}
      </div>

      {!scanData ? (
        <div className="p-6 text-center text-sm text-gray-400 space-y-3">
          <div>
            {hasFile
              ? 'Not scanned yet — click "Scan design" to read everything written on the design file.'
              : 'No design file yet. Upload the final design to scan its contents.'}
          </div>
          {!hasFile && onRequestUpload && (
            <button
              onClick={onRequestUpload}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-md bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              <Upload className="w-4 h-4" /> Upload Design File
            </button>
          )}
        </div>
      ) : (
        <div className="p-4 space-y-3">
          {/* Master cross-checks first — this is the error-catcher */}
          {checkResults && (
            <div className="space-y-2">
              <MasterCheck type="brand" check={checkResults.brand} productId={productId} onUpdated={onScanned} />
              <MasterCheck type="product" check={checkResults.product} productId={productId} onUpdated={onScanned} />
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-3">
            <Field label="Brand" value={scanData.brand_name} />
            <Field label="Product" value={scanData.product_name} />
            <Field label="Variant" value={scanData.variant} />
            <Field label="Net Qty" value={scanData.net_qty} />
            <Field label="MRP" value={scanData.mrp != null ? `₹${scanData.mrp}` : null} />
            <Field label="Size on design" value={scanData.dimensions_text} />
            <Field label="Languages" value={scanData.languages} />
            <Field label="Barcode" value={scanData.barcode} />
            <Field label="FSSAI" value={scanData.fssai_no} />
            <Field label="Regn Nos" value={scanData.other_regn_nos} />
            <Field label="Mfd by" value={scanData.manufactured_by} />
            <Field label="Mktd by" value={scanData.marketed_by} />
            <Field label="Phone" value={scanData.phone} />
            <Field label="Email" value={scanData.email} />
            <Field label="Website" value={scanData.website} />
            <Field label="Claims" value={scanData.key_claims} />
          </div>
          {scanData.ingredients_or_composition && (
            <div>
              <div className="text-[10px] uppercase tracking-wide text-gray-400">Ingredients / Composition</div>
              <div className="text-sm text-gray-700 whitespace-pre-wrap">{scanData.ingredients_or_composition}</div>
            </div>
          )}
          {scanData.warnings && (
            <div>
              <div className="text-[10px] uppercase tracking-wide text-gray-400">Warnings</div>
              <div className="text-sm text-gray-700 whitespace-pre-wrap">{scanData.warnings}</div>
            </div>
          )}
          {scanData.full_text && (
            <div className="border-t pt-2">
              <button
                onClick={() => setShowFullText(!showFullText)}
                className="text-xs text-indigo-600 inline-flex items-center gap-1"
              >
                {showFullText ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                {showFullText ? 'Hide full text' : 'Show full text on design'}
              </button>
              {showFullText && (
                <pre className="mt-2 text-xs text-gray-600 whitespace-pre-wrap font-sans bg-gray-50 rounded-md p-3 max-h-72 overflow-y-auto">{scanData.full_text}</pre>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
