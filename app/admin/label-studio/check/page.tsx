'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/lib/toast';
import {
  Upload, ScanLine, CheckCircle2, XCircle, AlertTriangle,
  AlertCircle, Loader2, FileImage, X, Building2, FlaskConical,
  ChevronDown, ChevronUp, Plus, Ban, Sparkles,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CheckItem {
  field: string;
  label: string;
  expected: string;
  found: string | null;
  status: 'pass' | 'fail' | 'missing' | 'warning';
  note?: string;
}

interface Discovery {
  field_name: string;
  field_label: string;
  found_value: string;
  db_table: 'label_brands' | 'label_products';
  // from DB after save
  id?: string;
  action?: string | null;
}

interface CheckReport {
  summary: { pass: number; fail: number; missing: number; warning: number };
  brand_checks: CheckItem[];
  product_checks: CheckItem[];
  discoveries: Discovery[];
  raw_text_extracted: string;
}

interface Brand  { id: string; name_en: string; logo_url: string | null; }
interface Product { id: string; name_en: string; category: string | null; }

// ─── Small components ─────────────────────────────────────────────────────────

function StatusIcon({ status }: { status: CheckItem['status'] }) {
  if (status === 'pass')    return <CheckCircle2  className="h-4 w-4 text-green-500 shrink-0" />;
  if (status === 'fail')    return <XCircle       className="h-4 w-4 text-red-500 shrink-0" />;
  if (status === 'missing') return <AlertCircle   className="h-4 w-4 text-orange-500 shrink-0" />;
  return                           <AlertTriangle  className="h-4 w-4 text-yellow-500 shrink-0" />;
}

function StatusBadge({ status }: { status: CheckItem['status'] }) {
  const map = {
    pass:    'bg-green-50  text-green-700  border-green-200',
    fail:    'bg-red-50    text-red-700    border-red-200',
    missing: 'bg-orange-50 text-orange-700 border-orange-200',
    warning: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${map[status]}`}>
      {status.toUpperCase()}
    </span>
  );
}

function CheckSection({ title, items }: { title: string; items: CheckItem[] }) {
  const [open, setOpen] = useState(true);
  const fails = items.filter(i => i.status !== 'pass').length;
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-800">{title}</span>
          {fails > 0 && (
            <span className="text-xs bg-red-100 text-red-700 border border-red-200 px-2 py-0.5 rounded-full font-medium">
              {fails} issue{fails > 1 ? 's' : ''}
            </span>
          )}
          {fails === 0 && (
            <span className="text-xs bg-green-100 text-green-700 border border-green-200 px-2 py-0.5 rounded-full font-medium">
              All clear
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
      </button>
      {open && (
        <div className="divide-y divide-gray-100">
          {items.map((item, i) => (
            <div key={i} className={`px-4 py-3 flex items-start gap-3 ${item.status !== 'pass' ? 'bg-red-50/30' : ''}`}>
              <StatusIcon status={item.status} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-gray-800">{item.label}</span>
                  <StatusBadge status={item.status} />
                </div>
                {item.status !== 'pass' && (
                  <div className="mt-1.5 space-y-1 text-xs">
                    <div className="flex gap-1">
                      <span className="text-gray-400 shrink-0">Expected:</span>
                      <span className="text-gray-700 font-medium">{item.expected}</span>
                    </div>
                    {item.found && (
                      <div className="flex gap-1">
                        <span className="text-gray-400 shrink-0">Found:</span>
                        <span className="text-red-600 font-medium">{item.found}</span>
                      </div>
                    )}
                    {item.note && (
                      <div className="text-muted-foreground italic">{item.note}</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function LabelCheckPage() {
  const [brands, setBrands]     = useState<Brand[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [brandId, setBrandId]   = useState('');
  const [productId, setProductId] = useState('');
  const [file, setFile]         = useState<File | null>(null);
  const [preview, setPreview]   = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [report, setReport]     = useState<CheckReport | null>(null);
  const [checkId, setCheckId]   = useState<string | null>(null);
  const [checkStatus, setCheckStatus] = useState<'passed' | 'failed' | null>(null);
  const [discoveries, setDiscoveries] = useState<Discovery[]>([]);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([
      supabase.from('label_brands').select('id, name_en, logo_url').eq('is_active', true).order('name_en'),
      supabase.from('label_products').select('id, name_en, category').eq('is_active', true).order('name_en'),
    ]).then(([{ data: b }, { data: p }]) => {
      if (b) setBrands(b);
      if (p) setProducts(p);
    });
  }, []);

  // Re-fetch discoveries from DB after scan (to get IDs for confirming)
  const fetchDiscoveries = async (cId: string) => {
    const { data } = await supabase
      .from('label_discoveries')
      .select('*')
      .eq('check_id', cId)
      .is('action', null);
    if (data) setDiscoveries(data);
  };

  const handleFileChange = (f: File) => {
    setFile(f);
    setReport(null);
    setCheckId(null);
    if (f.type.startsWith('image/')) {
      setPreview(URL.createObjectURL(f));
    } else {
      setPreview(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) handleFileChange(f);
  };

  const handleScan = async () => {
    if (!file || !brandId || !productId) {
      toast.error('Please select brand, product, and upload a file first.');
      return;
    }
    setScanning(true);
    setReport(null);

    const fd = new FormData();
    fd.append('file', file);
    fd.append('brand_id', brandId);
    fd.append('product_id', productId);

    try {
      const res = await fetch('/api/label-check', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Scan failed'); return; }
      setReport(data.report);
      setCheckId(data.check_id);
      setCheckStatus(data.status);
      if (data.check_id) await fetchDiscoveries(data.check_id);
    } catch (err: any) {
      toast.error('Network error: ' + err.message);
    } finally {
      setScanning(false);
    }
  };

  const handleDiscoveryAction = async (disc: Discovery, action: 'added' | 'ignored') => {
    if (!disc.id) return;
    setConfirmingId(disc.id);

    if (action === 'added') {
      // Add the discovered value to the appropriate DB table and field
      const table = disc.db_table;
      const recordId = table === 'label_brands' ? brandId : productId;
      const updatePayload: Record<string, string> = { [disc.field_name]: disc.found_value };
      await supabase.from(table).update(updatePayload).eq('id', recordId);
      toast.success(`"${disc.field_label}" added to ${table === 'label_brands' ? 'Brand' : 'Product'} DB`);
    } else {
      toast.success('Ignored — not added to DB');
    }

    // Mark discovery as actioned
    await supabase.from('label_discoveries').update({
      action,
      confirmed_at: new Date().toISOString(),
    }).eq('id', disc.id);

    setDiscoveries(prev => prev.filter(d => d.id !== disc.id));
    setConfirmingId(null);
  };

  const resetForm = () => {
    setFile(null);
    setPreview(null);
    setReport(null);
    setCheckId(null);
    setCheckStatus(null);
    setDiscoveries([]);
  };

  const { pass = 0, fail = 0, missing = 0, warning = 0 } = report?.summary || {};
  const total = pass + fail + missing + warning;

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Label Check</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Upload a label design — the system will verify brand and product content against the master database.
        </p>
      </div>

      {/* Setup row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Brand selector */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
            <Building2 className="inline h-3.5 w-3.5 mr-1" />Brand
          </label>
          <select
            value={brandId}
            onChange={e => setBrandId(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
          >
            <option value="">Select brand...</option>
            {brands.map(b => (
              <option key={b.id} value={b.id}>{b.name_en}</option>
            ))}
          </select>
        </div>

        {/* Product selector */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
            <FlaskConical className="inline h-3.5 w-3.5 mr-1" />Product
          </label>
          <select
            value={productId}
            onChange={e => setProductId(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
          >
            <option value="">Select product...</option>
            {products.map(p => (
              <option key={p.id} value={p.id}>{p.name_en}{p.category ? ` — ${p.category}` : ''}</option>
            ))}
          </select>
        </div>
      </div>

      {/* File upload */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3">
          <Upload className="inline h-3.5 w-3.5 mr-1" />Label File
        </label>

        {!file ? (
          <div
            ref={dropRef}
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center cursor-pointer hover:border-gray-400 hover:bg-gray-50 transition-colors"
          >
            <FileImage className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-600">Drop your label file here</p>
            <p className="text-xs text-muted-foreground mt-1">PNG, JPG, PDF accepted — up to 20MB</p>
            <button className="mt-3 px-4 py-1.5 bg-gray-900 text-white rounded-md text-sm font-medium hover:bg-gray-800 transition-colors">
              Browse File
            </button>
          </div>
        ) : (
          <div className="flex items-start gap-4">
            {preview ? (
              <img src={preview} alt="label preview" className="h-32 rounded-lg border border-gray-200 object-contain bg-gray-50" />
            ) : (
              <div className="h-32 w-24 rounded-lg border border-gray-200 bg-gray-50 flex flex-col items-center justify-center gap-1">
                <FileImage className="h-8 w-8 text-gray-400" />
                <span className="text-xs text-gray-400">PDF</span>
              </div>
            )}
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">{file.name}</p>
              <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</p>
              <button
                onClick={resetForm}
                className="mt-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-red-600 transition-colors"
              >
                <X className="h-3.5 w-3.5" />Remove
              </button>
            </div>
          </div>
        )}
        <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFileChange(f); }} />
      </div>

      {/* Run Check button */}
      <button
        onClick={handleScan}
        disabled={scanning || !file || !brandId || !productId}
        className="flex items-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:bg-gray-800 disabled:opacity-40 transition-colors w-full justify-center"
      >
        {scanning
          ? <><Loader2 className="h-4 w-4 animate-spin" />Scanning label with AI...</>
          : <><ScanLine className="h-4 w-4" />Run Label Check</>
        }
      </button>

      {/* ── RESULTS ─────────────────────────────────────────────────────────── */}
      {report && (
        <div className="space-y-5">

          {/* Summary bar */}
          <div className={`rounded-lg border-2 p-5 ${checkStatus === 'passed' ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'}`}>
            <div className="flex items-center gap-3 mb-3">
              {checkStatus === 'passed'
                ? <CheckCircle2 className="h-6 w-6 text-green-600" />
                : <XCircle      className="h-6 w-6 text-red-600" />
              }
              <h2 className={`text-base font-bold ${checkStatus === 'passed' ? 'text-green-800' : 'text-red-800'}`}>
                {checkStatus === 'passed' ? '✅ Label Passed — Ready for QC Approval' : '❌ Issues Found — Corrections Needed'}
              </h2>
            </div>
            <div className="flex gap-4 text-sm flex-wrap">
              <span className="flex items-center gap-1.5 text-green-700 font-semibold"><CheckCircle2 className="h-4 w-4" />{pass} Passed</span>
              {fail > 0    && <span className="flex items-center gap-1.5 text-red-700 font-semibold"><XCircle className="h-4 w-4" />{fail} Failed</span>}
              {missing > 0 && <span className="flex items-center gap-1.5 text-orange-700 font-semibold"><AlertCircle className="h-4 w-4" />{missing} Missing</span>}
              {warning > 0 && <span className="flex items-center gap-1.5 text-yellow-700 font-semibold"><AlertTriangle className="h-4 w-4" />{warning} Warning</span>}
              <span className="text-gray-500 ml-auto">{total} fields checked</span>
            </div>
          </div>

          {/* Auto-discovery panel */}
          {discoveries.length > 0 && (
            <div className="border-2 border-blue-200 bg-blue-50 rounded-lg p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-blue-600" />
                <h3 className="text-sm font-bold text-blue-800">New Data Found — Not in Database</h3>
              </div>
              <p className="text-xs text-blue-700">
                The scan found the following data in this label that isn't currently stored in our database.
                Confirm each one to add it, or ignore to skip.
              </p>
              <div className="space-y-3">
                {discoveries.map(disc => (
                  <div key={disc.id} className="bg-white rounded-lg border border-blue-200 p-4 flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold text-gray-700">{disc.field_label}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${disc.db_table === 'label_brands' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-teal-50 text-teal-700 border-teal-200'}`}>
                          {disc.db_table === 'label_brands' ? 'Brand DB' : 'Product DB'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-900 font-medium">{disc.found_value}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleDiscoveryAction(disc, 'added')}
                        disabled={confirmingId === disc.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-md text-xs font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                      >
                        {confirmingId === disc.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                        Add to DB
                      </button>
                      <button
                        onClick={() => handleDiscoveryAction(disc, 'ignored')}
                        disabled={confirmingId === disc.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-gray-600 rounded-md text-xs font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors"
                      >
                        <Ban className="h-3 w-3" />Ignore
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Brand checks */}
          <CheckSection title="Brand / Company Details" items={report.brand_checks} />

          {/* Product checks */}
          <CheckSection title="Product Technical Content" items={report.product_checks} />

          {/* Re-check button */}
          <div className="flex gap-3">
            <button
              onClick={resetForm}
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Upload New File
            </button>
            {checkStatus === 'failed' && (
              <button
                onClick={handleScan}
                disabled={scanning}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors"
              >
                {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanLine className="h-4 w-4" />}
                Re-scan After Corrections
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
