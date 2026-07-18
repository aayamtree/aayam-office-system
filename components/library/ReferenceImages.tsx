'use client';

// Reference images for a product — photos like the actual bottle/pack shot,
// separate from the print design file. Upload → Drive → stored on
// products.reference_images. Any image can be set as the product's main image.

import { useState } from 'react';
import { toast } from '@/lib/toast';
import { uploadToDrive, findOrCreateFolder, getDrivePreviewUrl } from '@/lib/google-drive-upload';
import { Image as ImageIcon, Upload, Loader2, X, Star } from 'lucide-react';

const SHARED_DRIVE_ID = process.env.NEXT_PUBLIC_GOOGLE_SHARED_DRIVE_ID || '0AFECdIXIxXjSUk9PVA';

export interface RefImage { url: string; name: string; thumb?: string; uploaded_at?: string }

interface Props {
  productId: string;
  productName: string;
  images: RefImage[];
  onChanged: () => void;
}

export default function ReferenceImages({ productId, productName, images, onChanged }: Props) {
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);

  const patch = async (reference_images: RefImage[], extra?: Record<string, any>) => {
    const res = await fetch('/api/products', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: productId, reference_images, ...(extra || {}) }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Save failed');
  };

  const onUpload = async (file: File | null) => {
    if (!file || uploading) return;
    if (!file.type.startsWith('image/')) { toast.error('Please choose an image (JPG/PNG)'); return; }
    setUploading(true);
    try {
      const tokenRes = await fetch('/api/drive/token');
      const tokenJson = await tokenRes.json();
      if (!tokenRes.ok || !tokenJson.accessToken) throw new Error(tokenJson.error || 'Drive not available');
      const root = await findOrCreateFolder(tokenJson.accessToken, 'Product Library', SHARED_DRIVE_ID);
      if (!root.folderId) throw new Error(root.error || 'Drive folder failed');
      const sub = await findOrCreateFolder(tokenJson.accessToken, productName.slice(0, 80), root.folderId);
      const up = await uploadToDrive(tokenJson.accessToken, file, sub.folderId || root.folderId, `ref - ${file.name}`, { uploadedTo: 'product_reference', resourceId: productId });
      if (!up.success) throw new Error(up.error || 'Upload failed');
      const img: RefImage = { url: up.webViewLink || '', name: file.name, thumb: up.fileId ? getDrivePreviewUrl(up.fileId) : undefined, uploaded_at: new Date().toISOString() };
      const next = [...images, img];
      // First reference image also becomes the product's main image if none set
      await patch(next, images.length === 0 && img.thumb ? { thumbnail_url: img.thumb } : undefined);
      toast.success('Reference image added');
      onChanged();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploading(false);
    }
  };

  const remove = async (idx: number) => {
    if (busy) return;
    setBusy(true);
    try {
      const next = images.filter((_, i) => i !== idx);
      await patch(next);
      toast.success('Removed');
      onChanged();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  const setMain = async (img: RefImage) => {
    if (busy || !img.thumb) return;
    setBusy(true);
    try {
      await patch(images, { thumbnail_url: img.thumb });
      toast.success('Set as main image');
      onChanged();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="bg-white border rounded-lg">
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <div className="font-semibold text-sm flex items-center gap-2">
          <ImageIcon className="w-4 h-4 text-indigo-500" /> Reference Images
          <span className="text-[10px] font-normal text-gray-400">e.g. bottle / pack photo</span>
        </div>
        <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer">
          {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
          {uploading ? 'Uploading…' : 'Upload Image'}
          <input type="file" className="hidden" accept="image/*" disabled={uploading} onChange={(e) => onUpload(e.target.files?.[0] || null)} />
        </label>
      </div>
      {images.length === 0 ? (
        <div className="p-6 text-center text-sm text-gray-400">No reference photos yet. Upload a bottle/pack shot for quick visual reference.</div>
      ) : (
        <div className="grid grid-cols-3 md:grid-cols-4 gap-3 p-3">
          {images.map((img, i) => (
            <div key={i} className="relative group border rounded-md overflow-hidden">
              <div className="aspect-square bg-gray-50 flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.thumb || img.url} alt={img.name} className="w-full h-full object-cover" />
              </div>
              <div className="absolute inset-x-0 bottom-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex justify-center gap-2 py-1">
                {img.thumb && <button onClick={() => setMain(img)} title="Set as main image" className="text-white hover:text-amber-300"><Star className="w-4 h-4" /></button>}
                <button onClick={() => remove(i)} title="Remove" className="text-white hover:text-red-300"><X className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
