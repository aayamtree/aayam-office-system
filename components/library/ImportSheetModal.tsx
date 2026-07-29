'use client';

// ImportSheetModal — upload a multi-job print/gang sheet, let the AI find
// every unique job on it, review the list, and save each as its own product
// (with brand + product master cross-check). One sheet → many products.

import { useState, useRef } from 'react';
import { toast } from '@/lib/toast';
import { uploadToDrive, findOrCreateFolder, getDrivePreviewUrl } from '@/lib/google-drive-upload';
import { SheetRenderer } from '@/lib/pdf-crop';
import { hashFile } from '@/lib/file-hash';
import {
  X, Loader2, Upload, ScanLine, CheckCircle2, Package, Layers,
  AlertTriangle, RefreshCw, Copy,
} from 'lucide-react';

const SHARED_DRIVE_ID = process.env.NEXT_PUBLIC_GOOGLE_SHARED_DRIVE_ID || '0AFECdIXIxXjSUk9PVA';

interface ClientOption { id: string; name: string; company: string | null }

interface Props {
  clients: ClientOption[];
  onClose: () => void;
  onImported: () => void;
}

type Stage = 'pick' | 'checking' | 'duplicate' | 'detecting' | 'cropping' | 'review' | 'saving' | 'reading' | 'done';

interface KnownSheet {
  file_name: string | null;
  scanned_at: string | null;
  scanned_by_name: string | null;
  job_count: number | null;
  times_seen: number | null;
}

export default function ImportSheetModal({ clients, onClose, onImported }: Props) {
  const [stage, setStage] = useState<Stage>('pick');
  const [file, setFile] = useState<File | null>(null);
  const [fileHash, setFileHash] = useState<string | null>(null);
  const [clientId, setClientId] = useState('');
  const [jobs, setJobs] = useState<any[]>([]);
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [sheetMeta, setSheetMeta] = useState<{ file_url?: string; file_name?: string; thumbnail_url?: string; file_hash?: string }>({});
  const [results, setResults] = useState<any[]>([]);
  const [known, setKnown] = useState<KnownSheet | null>(null);
  const [knownProducts, setKnownProducts] = useState<any[]>([]);

  const cropFilesRef = useRef<Record<number, File>>({});
  const busy = stage === 'checking' || stage === 'detecting' || stage === 'saving' || stage === 'reading';

  const pickFile = (f: File | null) => { setFile(f); setFileHash(null); setKnown(null); setKnownProducts([]); };

  // Step 0 — fingerprint the file locally and ask the server whether we have
  // seen it before. Costs nothing and happens before any upload or AI call.
  const checkThenDetect = async () => {
    if (!file) { toast.error('Choose the job sheet PDF first'); return; }
    setStage('checking');
    try {
      const hash = await hashFile(file);
      setFileHash(hash);
      const res = await fetch('/api/products/sheet-lookup', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_hash: hash }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.known) {
        setKnown(json.sheet);
        setKnownProducts(json.products || []);
        setStage('duplicate');
        return;
      }
    } catch {
      // hashing/lookup is best-effort — never block a genuine import
    }
    detect();
  };

  const detect = async (force = false) => {
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
      const hash = fileHash || (await hashFile(file).catch(() => null));
      const meta = { file_url: up.webViewLink, file_name: file.name, thumbnail_url: up.fileId ? getDrivePreviewUrl(up.fileId) : undefined, file_hash: hash || undefined };
      setSheetMeta(meta);

      // 2. Detect unique jobs — server reads the file from Drive (avoids the
      //    serverless request-body size limit on big sheets). The hash lets
      //    the server return a cached scan instead of paying for another one.
      const res = await fetch('/api/products/scan-sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_url: meta.file_url, file_name: meta.file_name, file_hash: hash, force }),
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
          // preview immediately (local), keep the File for a high-res detail re-scan
          j.__local_preview = URL.createObjectURL(cropFile);
          cropFilesRef.current[i] = cropFile;
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
    const chosenEntries = jobs.map((j, i) => ({ j, i })).filter(({ i }) => selected[i]);
    if (chosenEntries.length === 0) { toast.error('Select at least one job'); return; }
    setStage('saving');
    try {
      // strip transient client-only fields before sending
      const cleanJobs = chosenEntries.map(({ j }) => {
        const { __local_preview, __crop_file, ...clean } = j;
        return clean;
      });
      const res = await fetch('/api/products/import-sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobs: cleanJobs, sheet: { ...sheetMeta, client_id: clientId || null, sheet_name: file?.name } }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Import failed');
      const importResults: any[] = json.results || [];
      setResults(importResults);
      if (json.reused > 0) toast.success(`${json.reused} job(s) matched products you already had — saved as new versions, not duplicates`);

      // Re-scan each product from its OWN high-res crop so small print (brand
      // address, phone, composition) is read properly and masters fill fully.
      // Crops are small JPEGs → multipart is safe (well under the body limit).
      setStage('reading');
      for (let k = 0; k < importResults.length; k++) {
        const r = importResults[k];
        if (!r?.ok || !r.product_id) continue;
        const origIndex = chosenEntries[k]?.i;
        const crop = origIndex != null ? cropFilesRef.current[origIndex] : undefined;
        try {
          let rr: Response;
          if (crop) {
            // Prefer the per-job CROP: small JPEG (no size limit) that now
            // includes the label's bottom manufacturer/address print.
            const fd = new FormData();
            fd.append('file', crop);
            fd.append('focus_name', r.name || '');
            if (r.brand_name) fd.append('focus_brand', r.brand_name);
            rr = await fetch(`/api/products/${r.product_id}/scan`, { method: 'POST', body: fd });
          } else if (r.version_id) {
            // Fallback: focused scan of the full sheet.
            rr = await fetch(`/api/products/${r.product_id}/scan`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ version_id: r.version_id, focus: { name: r.name, brand: r.brand_name } }),
            });
          } else continue;
          const rj = await rr.json().catch(() => ({}));
          if (rr.ok && rj.check_results) {
            r.brand_check = rj.check_results.brand?.status ?? r.brand_check;
            r.product_check = rj.check_results.product?.status ?? r.product_check;
          }
        } catch { /* per-job detail scan is best-effort */ }
      }
      setResults([...importResults]);
      setStage('done');
      toast.success(`${json.imported} product(s) added & read from the sheet`);
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
              <input type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg,.webp" onChange={(e) => pickFile(e.target.files?.[0] || null)} />
            </label>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Client (optional — applies to all jobs)</label>
              <select value={clientId} onChange={(e) => setClientId(e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm">
                <option value="">— No client —</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.company || c.name}</option>)}
              </select>
            </div>
            <div className="flex justify-end">
              <button onClick={() => checkThenDetect()} disabled={!file} className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-md inline-flex items-center gap-2 disabled:opacity-40">
                <ScanLine className="w-4 h-4" /> Detect jobs
              </button>
            </div>
          </div>
        )}

        {/* CHECKING — local fingerprint + "seen before?" lookup */}
        {stage === 'checking' && (
          <div className="p-10 text-center space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mx-auto" />
            <p className="text-sm text-gray-500">Checking whether this exact file has been imported before…</p>
          </div>
        )}

        {/* DUPLICATE — this exact file was already scanned */}
        {stage === 'duplicate' && known && (
          <div className="p-5 space-y-4">
            <div className="flex gap-3 rounded-md border border-amber-200 bg-amber-50 p-4">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold text-amber-900">This file has already been imported.</p>
                <p className="text-amber-800 mt-1">
                  <b>{known.file_name || file?.name}</b> was scanned
                  {known.scanned_at ? ` on ${new Date(known.scanned_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}
                  {known.scanned_by_name ? ` by ${known.scanned_by_name}` : ''}
                  {known.job_count ? ` — ${known.job_count} job(s) found.` : '.'}
                </p>
                {(known.times_seen || 0) > 2 && (
                  <p className="text-amber-700 text-xs mt-1">Uploaded {known.times_seen} times now.</p>
                )}
              </div>
            </div>

            {knownProducts.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-600 mb-1.5">Products it already created:</p>
                <ul className="divide-y border rounded-md max-h-52 overflow-y-auto">
                  {knownProducts.map((p) => (
                    <li key={p.id} className="px-3 py-2 flex items-center gap-3">
                      <div className="w-9 h-9 rounded border bg-gray-50 overflow-hidden shrink-0">
                        {p.thumbnail_url && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.thumbnail_url} alt={p.name} className="w-full h-full object-cover" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <a href={`/admin/library/${p.id}`} className="text-sm font-medium text-indigo-600 hover:underline truncate block">{p.name}</a>
                        <div className="text-xs text-gray-500">{[p.brand_name, p.category, p.current_version_no ? `v${p.current_version_no}` : null].filter(Boolean).join(' · ')}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <p className="text-xs text-gray-500">
              Importing it again will not create duplicates — jobs that match an existing product are saved as a new
              version instead. Re-scan only if the artwork inside the file actually changed.
            </p>

            <div className="flex flex-wrap justify-between gap-2">
              <button onClick={() => { setStage('pick'); pickFile(null); }} className="px-4 py-2 text-sm border rounded-md hover:bg-gray-50">
                Choose a different file
              </button>
              <div className="flex gap-2">
                <button onClick={() => detect(false)} className="px-4 py-2 text-sm border border-indigo-200 text-indigo-700 rounded-md hover:bg-indigo-50 inline-flex items-center gap-2">
                  <Copy className="w-4 h-4" /> Re-use saved scan
                </button>
                <button onClick={() => detect(true)} className="px-4 py-2 text-sm bg-amber-600 hover:bg-amber-700 text-white rounded-md inline-flex items-center gap-2">
                  <RefreshCw className="w-4 h-4" /> Scan again anyway
                </button>
              </div>
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

        {/* READING (per-crop detail scan) */}
        {stage === 'reading' && (
          <div className="p-10 text-center space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mx-auto" />
            <p className="text-sm text-gray-500">Reading each job&apos;s details from its own image (brand address, phone, composition)…</p>
          </div>
        )}

        {/* DONE */}
        {stage === 'done' && (
          <div className="p-5 space-y-3">
            <div className="flex items-center gap-2 text-emerald-700 font-medium">
              <CheckCircle2 className="w-5 h-5" />
              {results.filter((r) => r.ok && !r.matched).length} new product(s)
              {results.some((r) => r.matched) ? `, ${results.filter((r) => r.matched).length} matched existing` : ''}
            </div>
            <ul className="divide-y border rounded-md">
              {results.map((r, i) => (
                <li key={i} className="px-3 py-2 text-sm flex items-center justify-between gap-2">
                  <span className="truncate flex items-center gap-2 min-w-0">
                    <span className="truncate">{r.name}</span>
                    {r.matched && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 shrink-0">existing · new version</span>}
                    {r.version_skipped && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 shrink-0">same file · skipped</span>}
                  </span>
                  {r.ok ? (
                    <span className="text-xs flex items-center gap-2 shrink-0">
                      <span className={r.brand_check === 'mismatch' ? 'text-red-600' : r.brand_check === 'review' ? 'text-amber-600' : 'text-emerald-600'}>brand: {(r.brand_check || '').replace(/_/g, ' ')}</span>
                      <span className={r.product_check === 'mismatch' ? 'text-red-600' : r.product_check === 'review' ? 'text-amber-600' : 'text-emerald-600'}>product: {(r.product_check || '').replace(/_/g, ' ')}</span>
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
