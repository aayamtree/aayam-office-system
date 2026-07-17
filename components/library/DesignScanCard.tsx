'use client';

// DesignScanCard — the AI-read "document" of a design file.
// Shows what is actually written on the design (brand, product, net qty,
// MRP, regn numbers, full text) so products can be matched brand-wise /
// product-wise at a glance, and re-scanned any time.

import { useState } from 'react';
import { toast } from '@/lib/toast';
import {
  ScanLine, Loader2, ChevronDown, ChevronUp, Sparkles, Upload,
} from 'lucide-react';

interface Props {
  productId: string;
  scanData: any | null;
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

export default function DesignScanCard({ productId, scanData, latestVersionId, hasFile, onScanned, onRequestUpload }: Props) {
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
      toast.success('Design scanned — contents saved');
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
            <Sparkles className="w-3 h-3" /> AI scan
          </span>
        </div>
        {hasFile && (
          <button
            onClick={runScan}
            disabled={scanning || !latestVersionId}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-indigo-200 text-indigo-700 hover:bg-indigo-50 disabled:opacity-40"
          >
            {scanning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ScanLine className="w-3.5 h-3.5" />}
            {scanning ? 'Reading design…' : scanData ? 'Re-scan' : 'Scan design'}
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
