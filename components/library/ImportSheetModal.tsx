'use client';

// ImportSheetModal — upload a multi-job print/gang sheet, let the AI find
// every unique job on it, review the list, and save each as its own product
// (with brand + product master cross-check). One sheet → many products.

import { useState } from 'react';
import { toast } from '@/lib/toast';
import { uploadToDrive, findOrCreateFolder, getDrivePreviewUrl } from '@/lib/google-drive-upload';
import { SheetRenderer } from '@/lib/pdf-crop';
import {
  X, Loader2, Upload, ScanLine, CheckCircle2, Package, Layers,
} from 'lucide-react';

const SHARED_DRIVE_ID = process.env.NEXT_PUBLIC_GOOGLE_SHARED_DRIVE_ID || '0AFECdIXIxXjSUk9PVA';

interface ClientOption { id: string; name: string; company: string | null }

interface Props {
  clients: ClientOption[];
  onClose: () => void;
  onImported: () => void;
}

type Stage = 'pick' | 'detecting' | 'cropping' | 'review' | 'saving' | 'done';

export default function ImportSheetModal({ clients, onClose, onImported }: Props) {
  const [stage, setStage] = useState<Stage>('pick');
  const [file, setFile] = useState<File | null>(null);
  const [clientId, setClientId] = useState('');
  const [jobs, setJobs] = useState<any[]>([]);
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [sheetMeta, setSheetMeta] = useState<{ file_url?: string; file_name?: string; thumbnail_url?: string }>({});
  const [results, setResults] = useState<any[]>([]);

  const busy = stage === 'detecting' || stage === 'saving';

  const detect = async () => {
    if (!file) { toast.error('Choose the job sheet PDF first'); return; }
    setStage('detecting');
    try {
      // 1. Upload the sheet to Drive once (reused by every product's version)
      const tokenRes = await fetch('/api/drive/token');
      const tokenJson = await tokenRes.json();
      if (!tokenRes.ok || !tokenJson.accessToken) throw new Error(tokenJson.error || 'Drive not available');
      const root = await findOrCreateFolder(tokenJson.accessToken, 'Product Library', SHARED_DRIVE_ID);
      if (!root.folderId) throw new Error(root.error || 'Drive folder failed');
      const sub = await findOrCreateFolder(tokenJson.accessToken, 'Job Sheets', root.folderId);
      const up = await uploadToDrive(tokenJson.accessToken, file, sub.folderId || root.folderId, file.name, { uploadedTo: 'product_library_sheet' });
      if (!up.success) throw new Error(up.error || 'Upload failed');
      const meta = { file_url: up.webViewLink, file_name: file.name, thumbnail_url: up.fileId ? getDrivePreviewUrl(up.fileId) : undefined };
      setSheetMeta(meta);

      // 2. Detect unique jobs — server reads the file from Drive (avoids the
      //    serverless request-body size limit on big sheets).
      const res = await fetch('/api/products/scan-sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_url: meta.file_url, file_name: meta.file_name }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Detection failed');
      let found = json.jobs || [];
      if (found.length === 0) { toast.error('No jobs detected on this sheet'); setStage('pick'); return; }

      // 3. Crop each job's region from the sheet → its own image thumbnail
      setStage('cropping');
      try {
        const renderer = new SheetRenderer(file);
        await renderer.init();
        for (let i = 0; i < found.length; i++) {
          const j = found[i];
          if (!j.bbox) continue;
          const cropFile = await renderer.crop(j.bbox, j.product_name || j.brand_name || `job_${i + 1}`);
          if (!cropFile) continue;
          // preview immediately (local), then upload to Drive for permanent thumbnail
          j.__local_preview = URL.createObjectURL(cropFile);
          try {
            const cropUp = await uploadToDrive(tokenJson.accessToken, cropFile, sub.folderId || root.folderId, cropFile.name, { uploadedTo: 'product_library_crop' });
            if (cropUp.success && cropUp.fileId) j.thumbnail_url = getDrivePreviewUrl(cropUp.fileId);
          } catch { /* keep local preview only */ }
        }
      } catch (err) {
        // cropping is best-effort; fall back to sheet thumbnail
        console.warn('crop failed', err);
      }

      setJobs(found);
      const sel: Record<number, boolean> = {};
      found.forEach((_: any, i: number) => (sel[i] = true));
      setSelected(sel);
      setStage('review');
    } catch (e: any) {
      toast.error(e.message);
      setStage('pick');
    }
  };

  const save = async () => {
    const chosen = jobs.filter((_, i) => selected[i]);
    if (chosen.length === 0) { toast.error('Select at least one job'); return; }
    setStage('saving');
    try {
      const res = await fetch('/api/products/import-sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobs: chosen, sheet: { ...sheetMeta, client_id: clientId || null, sheet_name: file?.name } }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Import failed');
      setResults(json.results || []);
      setStage('done');
      toast.success(`${json.imported} product(s) added from the sheet`);
      onImported();
    } catch (e: any) {
      toast.error(e.message);
      setStage('review');
    }
  };

  const setJobName = (i: number, v: string) => setJobs((arr) => arr.map((j, idx) => (idx === i ? { ...j, product_name: v } : j)));

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => !busy && onClose()}>
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <h2 className="font-semibold flex items-center gap-2"><Layers className="w-5 h-5 text-indigo-600" /> Import Job Sheet (multiple jobs)</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        {/* PICK */}
        {stage === 'pick' && (
          <div className="p-5 space-y-3">
            <p className="text-sm text-gray-500">Upload a print/gang sheet that has several jobs on it. The system finds each unique job, reads its brand &amp; product, and saves each as its own library product.</p>
            <label className="flex items-center justify-center gap-2 border-2 border-dashed rounded-md px-4 py-8 text-sm text-gray-500 cursor-pointer hover:border-indigo-300 hover:text-indigo-600">
              <Upload className="w-4 h-4" />
              {file ? file.name : 'Choose job sheet (PDF or image)…'}
              <input type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg,.webp" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            </label>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Client (optional — applies to all jobs)</label>
              <select value={clientId} onChange={(e) => setClientId(e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm">
                <option value="">— No client —</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.company || c.name}</option>)}
              </select>
            </div>
            <div className="flex justify-end">
              <button onClick={detect} disabled={!file} className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-md inline-flex items-center gap-2 disabled:opacity-40">
                <ScanLine className="w-4 h-4" /> Detect jobs
              </button>
            </div>
          </div>
        )}

        {/* DETECTING */}
        {stage === 'detecting' && (
          <div className="p-10 text-center space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mx-auto" />
            <p className="text-sm text-gray-500">Uploading sheet and reading every job… this can take up to a minute for a busy sheet.</p>
          </div>
        )}

        {/* CROPPING */}
        {stage === 'cropping' && (
          <div className="p-10 text-center space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mx-auto" />
            <p className="text-sm text-gray-500">Cutting each job out of the sheet into its own image…</p>
          </div>
        )}

        {/* REVIEW */}
        {stage === 'review' && (
          <div className="p-5 space-y-3">
            <p className="text-sm text-gray-600"><b>{jobs.length}</b> unique job(s) found. Untick anything you don&apos;t want, fix names if needed, then save.</p>
            <div className="space-y-2 max-h-[46vh] overflow-y-auto">
              {jobs.map((j, i) => (
                <div key={i} className={`border rounded-md p-3 flex gap-3 ${selected[i] ? 'border-indigo-200 bg-indigo-50/40' : 'opacity-60'}`}>
                  <input type="checkbox" checked={!!selected[i]} onChange={(e) => setSelected({ ...selected, [i]: e.target.checked })} className="mt-1" />
                  <div className="w-16 h-16 rounded border bg-gray-50 overflow-hidden shrink-0 flex items-center justify-center">
                    {(j.__local_preview || j.thumbnail_url) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={j.__local_preview || j.thumbnail_url} alt={j.product_name || 'job'} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[9px] text-gray-300 text-center px-1">no crop</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <input value={j.product_name || ''} onChange={(e) => setJobName(i, e.target.value)} className="w-full font-medium text-sm border rounded px-2 py-1 mb-1" placeholder="Product name" />
                    <div className="text-xs text-gray-500 flex flex-wrap gap-x-3 gap-y-0.5">
                      {j.brand_name && <span>Brand: <b>{j.brand_name}</b></span>}
                      {j.category && <span>{j.category}</span>}
                      {j.net_qty && <span>{j.net_qty}</span>}
                      {j.mrp != null && <span>₹{j.mrp}</span>}
                      {j.copies_on_sheet != null && <span>{j.copies_on_sheet} up</span>}
                    </div>
                    {j.summary_text && <div className="text-[11px] text-gray-400 mt-1 line-clamp-2">{j.summary_text}</div>}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-between gap-2 pt-1">
              <button onClick={() => setStage('pick')} className="px-4 py-2 text-sm border rounded-md hover:bg-gray-50">Back</button>
              <button onClick={save} className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-md inline-flex items-center gap-2">
                <Package className="w-4 h-4" /> Save {Object.values(selected).filter(Boolean).length} product(s)
              </button>
            </div>
          </div>
        )}

        {/* SAVING */}
        {stage === 'saving' && (
          <div className="p-10 text-center space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mx-auto" />
            <p className="text-sm text-gray-500">Saving products and checking each against brand &amp; product masters…</p>
          </div>
        )}

        {/* DONE */}
        {stage === 'done' && (
          <div className="p-5 space-y-3">
            <div className="flex items-center gap-2 text-emerald-700 font-medium"><CheckCircle2 className="w-5 h-5" /> Imported {results.filter((r) => r.ok).length} product(s)</div>
            <ul className="divide-y border rounded-md">
              {results.map((r, i) => (
                <li key={i} className="px-3 py-2 text-sm flex items-center justify-between gap-2">
                  <span className="truncate">{r.name}</span>
                  {r.ok ? (
                    <span className="text-xs flex items-center gap-2 shrink-0">
                      <span className={r.brand_check === 'mismatch' ? 'text-red-600' : 'text-emerald-600'}>brand: {r.brand_check?.replace(/_/g, ' ')}</span>
                      <span className={r.product_check === 'mismatch' ? 'text-red-600' : 'text-emerald-600'}>product: {r.product_check?.replace(/_/g, ' ')}</span>
                    </span>
                  ) : (
                    <span className="text-xs text-red-600 shrink-0">{r.error}</span>
                  )}
                </li>
              ))}
            </ul>
            <div className="flex justify-end">
              <button onClick={onClose} className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-md">Done</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
