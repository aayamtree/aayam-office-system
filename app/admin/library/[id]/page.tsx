'use client';

// Product Library — product detail: current design, full version history
// and activity log (who did what, when last printed).

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { toast } from '@/lib/toast';
import { uploadToDrive, findOrCreateFolder, getDrivePreviewUrl } from '@/lib/google-drive-upload';
import {
  ArrowLeft, Loader2, X, Plus, Pencil, ExternalLink, FileText,
  CheckCircle2, XCircle, MinusCircle, Printer, Clock, User as UserIcon,
  Package, Upload, History, Ruler, Trash2,
} from 'lucide-react';
import {
  PACKAGING_TYPES, Product, ProductVersion, ProductActivityRow,
  formatSize, clientLabel, readPdfSizeMm, checkSize,
} from '@/lib/product-library';
import DesignScanCard from '@/components/library/DesignScanCard';

const SHARED_DRIVE_ID = process.env.NEXT_PUBLIC_GOOGLE_SHARED_DRIVE_ID || '0AFECdIXIxXjSUk9PVA';

const EVENT_LABEL: Record<string, string> = {
  created: 'Created',
  updated: 'Updated',
  version_added: 'New version',
  size_changed: 'Size changed',
  printed: 'Printed',
  linked_job: 'Linked to job',
  skipped: 'Skipped',
};

function CheckBadge({ status, note }: { status: string | null; note?: string | null }) {
  if (!status) return null;
  if (status === 'pass') return (
    <span title={note || ''} className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full text-[11px] font-medium">
      <CheckCircle2 className="w-3 h-3" /> Size verified
    </span>
  );
  if (status === 'fail') return (
    <span title={note || ''} className="inline-flex items-center gap-1 text-red-700 bg-red-50 px-2 py-0.5 rounded-full text-[11px] font-medium">
      <XCircle className="w-3 h-3" /> Size mismatch
    </span>
  );
  return (
    <span title={note || ''} className="inline-flex items-center gap-1 text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full text-[11px] font-medium">
      <MinusCircle className="w-3 h-3" /> Not checked
    </span>
  );
}

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { profile } = useAuth();
  const [showDelete, setShowDelete] = useState(false);
  const [deleteText, setDeleteText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const id = params?.id as string;

  const [product, setProduct] = useState<Product | null>(null);
  const [versions, setVersions] = useState<ProductVersion[]>([]);
  const [activity, setActivity] = useState<ProductActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // edit modal
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState<any>({});

  // new version modal
  const [showVersion, setShowVersion] = useState(false);
  const [vFile, setVFile] = useState<File | null>(null);
  const [vForm, setVForm] = useState({ size_w: '', size_h: '', size_d: '', size_unit: 'mm', notes: '' });
  const [vCheck, setVCheck] = useState<{ status: string; note: string } | null>(null);
  const [uploading, setUploading] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [pRes, vRes, aRes] = await Promise.all([
      supabase.from('products').select('*, clients(name, company)').eq('id', id).single(),
      supabase.from('product_versions').select('*, profiles:designer_id(full_name)').eq('product_id', id).order('version_no', { ascending: false }),
      supabase.from('product_activity').select('id, event_type, detail, actor_name, created_at').eq('product_id', id).order('created_at', { ascending: false }).limit(100),
    ]);
    if (pRes.error) { toast.error(pRes.error.message); setLoading(false); return; }
    setProduct(pRes.data as Product);
    setVersions((vRes.data as ProductVersion[]) || []);
    setActivity((aRes.data as ProductActivityRow[]) || []);
    setLoading(false);
  }, [id]);

  useEffect(() => { if (id) fetchAll(); }, [id, fetchAll]);

  const confirmDelete = async () => {
    if (!product || deleting || deleteText.trim().toUpperCase() !== 'DELETE') return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/products?id=${product.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Delete failed');
      toast.success('Product deleted (logged in Activity Log)');
      router.push('/admin/library');
    } catch (e: any) {
      toast.error(e.message);
      setDeleting(false);
    }
  };

  const openEdit = () => {
    if (!product) return;
    setEditForm({
      name: product.name,
      brand_name: product.brand_name || '',
      category: product.category,
      size_w: product.size_w ?? '',
      size_h: product.size_h ?? '',
      size_d: product.size_d ?? '',
      size_unit: product.size_unit || 'mm',
      size_text: product.size_text || '',
      notes: product.notes || '',
    });
    setShowEdit(true);
  };

  const handleEditSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch('/api/products', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          ...editForm,
          size_w: editForm.size_w ? parseFloat(editForm.size_w) : null,
          size_h: editForm.size_h ? parseFloat(editForm.size_h) : null,
          size_d: editForm.size_d ? parseFloat(editForm.size_d) : null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to update');
      toast.success('Product updated');
      setShowEdit(false);
      fetchAll();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  // When a file is chosen, immediately read its real PDF size and compare
  // (category-aware: box dielines & master print sheets are info, not mismatch)
  const onVersionFile = async (file: File | null) => {
    setVFile(file);
    setVCheck(null);
    if (!file) return;
    const pdfSize = await readPdfSizeMm(file);
    const enteredL = vForm.size_w ? parseFloat(vForm.size_w) : (product?.size_w ?? null);
    const enteredW = vForm.size_h ? parseFloat(vForm.size_h) : (product?.size_h ?? null);
    setVCheck(checkSize(enteredL, enteredW, vForm.size_unit, pdfSize, product?.category));
  };

  // Re-run the check when entered sizes change and a file is selected
  const rerunCheck = async (l: string, w: string, unit: string) => {
    if (!vFile) return;
    const pdfSize = await readPdfSizeMm(vFile);
    setVCheck(checkSize(l ? parseFloat(l) : null, w ? parseFloat(w) : null, unit, pdfSize, product?.category));
  };

  const handleVersionSave = async () => {
    if (!product || uploading) return;
    if (!vFile) { toast.error('Please choose the final design file'); return; }
    if (vCheck?.status === 'fail') {
      if (!window.confirm('⚠️ SIZE MISMATCH detected!\n\n' + vCheck.note + '\n\nSave anyway?')) return;
    }
    setUploading(true);
    try {
      // 1. Get org Drive token
      const tokenRes = await fetch('/api/drive/token');
      const tokenJson = await tokenRes.json();
      if (!tokenRes.ok || !tokenJson.accessToken) throw new Error(tokenJson.error || 'Drive not available');

      // 2. Product Library / <product> folder
      const root = await findOrCreateFolder(tokenJson.accessToken, 'Product Library', SHARED_DRIVE_ID);
      if (!root.folderId) throw new Error(root.error || 'Could not open Product Library folder');
      const sub = await findOrCreateFolder(tokenJson.accessToken, product.name.slice(0, 80), root.folderId);
      const folderId = sub.folderId || root.folderId;

      // 3. Upload
      const nextV = (product.current_version_no || 0) + 1;
      const upload = await uploadToDrive(
        tokenJson.accessToken, vFile, folderId,
        `v${nextV} - ${vFile.name}`,
        { uploadedTo: 'product_library', resourceId: product.id }
      );
      if (!upload.success) throw new Error(upload.error || 'Upload failed');

      // 4. Save the version (DB triggers do numbering, roll-forward, logging)
      const res = await fetch(`/api/products/${product.id}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_url: upload.webViewLink,
          file_name: vFile.name,
          thumbnail_url: upload.fileId ? getDrivePreviewUrl(upload.fileId) : null,
          size_w: vForm.size_w ? parseFloat(vForm.size_w) : null,
          size_h: vForm.size_h ? parseFloat(vForm.size_h) : null,
          size_d: vForm.size_d ? parseFloat(vForm.size_d) : null,
          size_unit: vForm.size_unit,
          size_check_status: vCheck?.status || 'skipped',
          size_check_note: vCheck?.note || null,
          notes: vForm.notes,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to save version');

      toast.success(`Version v${json.version?.version_no ?? nextV} saved`);

      // Auto-scan the design contents in the background (server reads the
      // freshly-uploaded file from Drive — avoids the serverless body limit).
      if (json.version?.id) {
        fetch(`/api/products/${product.id}/scan`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ version_id: json.version.id }),
        })
          .then(async (r) => {
            if (r.ok) { toast.success('Design contents scanned automatically'); fetchAll(); }
          })
          .catch(() => {});
      }
      setShowVersion(false);
      setVFile(null);
      setVForm({ size_w: '', size_h: '', size_d: '', size_unit: 'mm', notes: '' });
      setVCheck(null);
      fetchAll();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploading(false);
    }
  };

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;
  if (!product) return (
    <div className="bg-white border rounded-md p-12 text-center text-gray-500">
      Product not found.
      <div className="mt-3"><Link href="/admin/library" className="text-indigo-600 text-sm">← Back to library</Link></div>
    </div>
  );

  return (
    <div className="space-y-4 max-w-5xl">
      <button onClick={() => router.push('/admin/library')} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="w-4 h-4" /> Product Library
      </button>

      {/* Header card */}
      <div className="bg-white border rounded-lg p-5">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="flex gap-4">
            <div className="w-24 h-24 rounded-md bg-gray-50 border flex items-center justify-center overflow-hidden shrink-0">
              {product.thumbnail_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={product.thumbnail_url} alt={product.name} className="w-full h-full object-cover" />
              ) : (
                <Package className="w-10 h-10 text-gray-300" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold">{product.name}</h1>
                <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold">{product.category}</span>
                {product.current_version_no > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs font-medium">v{product.current_version_no}</span>
                )}
              </div>
              <div className="text-sm text-gray-500 mt-1">
                {clientLabel(product.clients)}{product.brand_name ? ` · Brand: ${product.brand_name}` : ''}
              </div>
              <div className="flex items-center gap-2 mt-2 text-lg font-mono font-semibold text-gray-800">
                <Ruler className="w-4 h-4 text-gray-400" /> {formatSize(product)}
              </div>
              {product.last_printed_at && (
                <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                  <Printer className="w-3 h-3" /> Last printed {new Date(product.last_printed_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
              )}
              {product.notes && <p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap">{product.notes}</p>}
              {(() => {
                const sheetVersion = versions.find((v) => v.file_url && /job sheet|One job on|\.pdf/i.test((v.notes || '') + ' ' + (v.file_name || '')));
                const sheetFromNotes = (product.notes || '').startsWith('Imported from');
                const v = (sheetFromNotes ? versions.find((x) => x.file_url) : null) || (sheetFromNotes ? sheetVersion : null);
                if (!v?.file_url) return null;
                return (
                  <a href={v.file_url} target="_blank" rel="noopener noreferrer"
                     className="inline-flex items-center gap-1.5 mt-2 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1.5 rounded-md">
                    <FileText className="w-3.5 h-3.5" /> Open full job sheet (complete file)
                  </a>
                );
              })()}
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <button onClick={openEdit} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border rounded-md hover:bg-gray-50">
              <Pencil className="w-4 h-4" /> Edit
            </button>
            <button onClick={() => setShowVersion(true)} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-md">
              <Upload className="w-4 h-4" /> Upload Design
            </button>
            {profile?.role === 'admin' && (
              <button onClick={() => { setDeleteText(''); setShowDelete(true); }} title="Delete product" className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-red-200 text-red-600 hover:bg-red-50 rounded-md">
                <Trash2 className="w-4 h-4" /> Delete
              </button>
            )}
          </div>
        </div>
      </div>

      <DesignScanCard
        productId={product.id}
        scanData={(product as any).scan_data || null}
        checkResults={(product as any).check_results || null}
        latestVersionId={versions.find((v) => v.file_url)?.id || null}
        productName={product.name}
        brandName={product.brand_name || null}
        hasFile={versions.some((v) => !!v.file_url)}
        onScanned={fetchAll}
        onRequestUpload={() => setShowVersion(true)}
      />

      <div className="grid md:grid-cols-2 gap-4">
        {/* Versions */}
        <div className="bg-white border rounded-lg">
          <div className="px-4 py-3 border-b font-semibold text-sm flex items-center gap-2">
            <FileText className="w-4 h-4 text-gray-400" /> Design Versions ({versions.length})
          </div>
          {versions.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-400">
              No design files yet.
              <button onClick={() => setShowVersion(true)} className="ml-2 text-indigo-600 hover:underline inline-flex items-center gap-1">
                <Upload className="w-3.5 h-3.5" /> Upload the first design
              </button>
            </div>
          ) : (
            <ul className="divide-y">
              {versions.map((v) => (
                <li key={v.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${v.status === 'approved' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-500'}`}>
                        v{v.version_no}
                      </span>
                      <CheckBadge status={v.size_check_status} note={v.size_check_note} />
                      {v.job_number && <span className="text-xs text-gray-500">Job {v.job_number}</span>}
                    </div>
                    {v.file_url && (
                      <a href={v.file_url} target="_blank" rel="noopener noreferrer" title={v.file_name || 'Open file'} className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline shrink-0">
                        Open file <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {formatSize(v)} · {v.profiles?.full_name || 'Unknown'} · {new Date(v.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                  {v.notes && <div className="text-xs text-gray-600 mt-1">{v.notes}</div>}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Activity log */}
        <div className="bg-white border rounded-lg">
          <div className="px-4 py-3 border-b font-semibold text-sm flex items-center gap-2">
            <History className="w-4 h-4 text-gray-400" /> Activity Log
          </div>
          {activity.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-400">No activity yet.</div>
          ) : (
            <ul className="divide-y max-h-[28rem] overflow-y-auto">
              {activity.map((a) => (
                <li key={a.id} className="px-4 py-2.5 flex gap-3">
                  <div className="mt-0.5 shrink-0">
                    {a.event_type === 'printed' ? <Printer className="w-4 h-4 text-blue-500" />
                      : a.event_type === 'version_added' ? <FileText className="w-4 h-4 text-emerald-500" />
                      : a.event_type === 'size_changed' ? <Ruler className="w-4 h-4 text-amber-500" />
                      : <Clock className="w-4 h-4 text-gray-400" />}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm">
                      <span className="font-medium">{EVENT_LABEL[a.event_type] || a.event_type}</span>
                      {a.detail && <span className="text-gray-600"> — {a.detail}</span>}
                    </div>
                    <div className="text-[11px] text-gray-400 flex items-center gap-2">
                      {a.actor_name && <span className="inline-flex items-center gap-1"><UserIcon className="w-3 h-3" />{a.actor_name}</span>}
                      <span>{new Date(a.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Edit modal */}
      {showEdit && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => !saving && setShowEdit(false)}>
          <div className="bg-white rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b">
              <h2 className="font-semibold">Edit Product</h2>
              <button onClick={() => setShowEdit(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Product name *</label>
                <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Brand</label>
                  <input value={editForm.brand_name} onChange={(e) => setEditForm({ ...editForm, brand_name: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Packaging type</label>
                  <select value={editForm.category} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm">
                    {PACKAGING_TYPES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Packaging size (L × W × H)</label>
                <div className="flex gap-2 items-center">
                  <input value={editForm.size_w} onChange={(e) => setEditForm({ ...editForm, size_w: e.target.value })} placeholder="L" type="number" className="w-20 border rounded-md px-2 py-2 text-sm" />
                  <span className="text-gray-400">×</span>
                  <input value={editForm.size_h} onChange={(e) => setEditForm({ ...editForm, size_h: e.target.value })} placeholder="W" type="number" className="w-20 border rounded-md px-2 py-2 text-sm" />
                  <span className="text-gray-400">×</span>
                  <input value={editForm.size_d} onChange={(e) => setEditForm({ ...editForm, size_d: e.target.value })} placeholder="H" type="number" className="w-20 border rounded-md px-2 py-2 text-sm" />
                  <select value={editForm.size_unit} onChange={(e) => setEditForm({ ...editForm, size_unit: e.target.value })} className="border rounded-md px-2 py-2 text-sm">
                    <option value="mm">mm</option><option value="cm">cm</option><option value="in">in</option>
                  </select>
                </div>
                <input value={editForm.size_text} onChange={(e) => setEditForm({ ...editForm, size_text: e.target.value })} placeholder="Or freeform size" className="w-full border rounded-md px-3 py-2 text-sm mt-2" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                <textarea value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} rows={2} className="w-full border rounded-md px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-3 border-t">
              <button onClick={() => setShowEdit(false)} disabled={saving} className="px-4 py-2 text-sm border rounded-md hover:bg-gray-50">Cancel</button>
              <button onClick={handleEditSave} disabled={saving} className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-md inline-flex items-center gap-2">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />} Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation — must type DELETE */}
      {showDelete && product && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4" onClick={() => !deleting && setShowDelete(false)}>
          <div className="bg-white rounded-lg w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-3 border-b flex items-center gap-2 text-red-700">
              <Trash2 className="w-5 h-5" /> <h2 className="font-semibold">Delete product</h2>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-sm text-gray-700">
                You are about to permanently delete <b>{product.name}</b>{product.brand_name ? ` (brand ${product.brand_name})` : ''} and all its {versions.length} design version record(s) from the database.
              </p>
              <p className="text-xs text-gray-500">
                The design files stay safe in Google Drive. This action is recorded in the Activity Log with your name. It cannot be undone.
              </p>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Type <b>DELETE</b> to confirm</label>
                <input
                  autoFocus
                  value={deleteText}
                  onChange={(e) => setDeleteText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') confirmDelete(); }}
                  placeholder="DELETE"
                  className="w-full border rounded-md px-3 py-2 text-sm uppercase tracking-wide"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-3 border-t">
              <button onClick={() => setShowDelete(false)} disabled={deleting} className="px-4 py-2 text-sm border rounded-md hover:bg-gray-50">Cancel</button>
              <button
                onClick={confirmDelete}
                disabled={deleting || deleteText.trim().toUpperCase() !== 'DELETE'}
                className="px-4 py-2 text-sm rounded-md text-white bg-red-600 hover:bg-red-700 disabled:opacity-40 inline-flex items-center gap-2"
              >
                {deleting && <Loader2 className="w-4 h-4 animate-spin" />} Delete permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New version modal */}
      {showVersion && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => !uploading && setShowVersion(false)}>
          <div className="bg-white rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b">
              <h2 className="font-semibold">New Design Version</h2>
              <button onClick={() => setShowVersion(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Final design file (PDF recommended) *</label>
                <label className="flex items-center justify-center gap-2 border-2 border-dashed rounded-md px-4 py-6 text-sm text-gray-500 cursor-pointer hover:border-indigo-300 hover:text-indigo-600">
                  <Upload className="w-4 h-4" />
                  {vFile ? vFile.name : 'Choose file…'}
                  <input type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg,.jfif,.webp,.gif,.tif,.tiff,.ai" onChange={(e) => onVersionFile(e.target.files?.[0] || null)} />
                </label>
                <p className="text-[11px] text-gray-400 mt-1">For PDF files the packaging size is verified automatically against the entered size.</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Packaging size for this version (L × W × H)</label>
                <div className="flex gap-2 items-center">
                  <input value={vForm.size_w} onChange={(e) => { setVForm({ ...vForm, size_w: e.target.value }); rerunCheck(e.target.value, vForm.size_h, vForm.size_unit); }} placeholder="L" type="number" className="w-20 border rounded-md px-2 py-2 text-sm" />
                  <span className="text-gray-400">×</span>
                  <input value={vForm.size_h} onChange={(e) => { setVForm({ ...vForm, size_h: e.target.value }); rerunCheck(vForm.size_w, e.target.value, vForm.size_unit); }} placeholder="W" type="number" className="w-20 border rounded-md px-2 py-2 text-sm" />
                  <span className="text-gray-400">×</span>
                  <input value={vForm.size_d} onChange={(e) => setVForm({ ...vForm, size_d: e.target.value })} placeholder="H" type="number" className="w-20 border rounded-md px-2 py-2 text-sm" />
                  <select value={vForm.size_unit} onChange={(e) => { setVForm({ ...vForm, size_unit: e.target.value }); rerunCheck(vForm.size_w, vForm.size_h, e.target.value); }} className="border rounded-md px-2 py-2 text-sm">
                    <option value="mm">mm</option><option value="cm">cm</option><option value="in">in</option>
                  </select>
                </div>
              </div>
              {vCheck && (
                <div className={`rounded-md px-3 py-2 text-sm flex items-start gap-2 ${
                  vCheck.status === 'pass' ? 'bg-emerald-50 text-emerald-800'
                  : vCheck.status === 'fail' ? 'bg-red-50 text-red-800'
                  : 'bg-gray-50 text-gray-600'
                }`}>
                  {vCheck.status === 'pass' ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> : vCheck.status === 'fail' ? <XCircle className="w-4 h-4 mt-0.5 shrink-0" /> : <MinusCircle className="w-4 h-4 mt-0.5 shrink-0" />}
                  <span>{vCheck.note}</span>
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                <textarea value={vForm.notes} onChange={(e) => setVForm({ ...vForm, notes: e.target.value })} rows={2} className="w-full border rounded-md px-3 py-2 text-sm" placeholder="What changed in this version?" />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-3 border-t">
              <button onClick={() => setShowVersion(false)} disabled={uploading} className="px-4 py-2 text-sm border rounded-md hover:bg-gray-50">Cancel</button>
              <button onClick={handleVersionSave} disabled={uploading} className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-md inline-flex items-center gap-2">
                {uploading && <Loader2 className="w-4 h-4 animate-spin" />} {uploading ? 'Uploading…' : 'Save Version'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
