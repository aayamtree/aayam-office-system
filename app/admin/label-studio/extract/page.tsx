'use client';

import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Upload, Loader2, CheckCircle2, ChevronDown, ChevronUp,
  Building2, FlaskConical, Sparkles, Save, RefreshCw, ImageIcon,
} from 'lucide-react';

type ExtractType = 'brand' | 'product';
type SaveMode = 'new' | 'update';

interface ExistingBrand { id: string; name_en: string }
interface ExistingProduct { id: string; name_en: string }

// ─── Field display helpers ────────────────────────────────────────────────────

function FieldRow({ label, value, onChange }: {
  label: string;
  value: string | null | undefined;
  onChange: (v: string) => void;
}) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className="flex flex-col gap-0.5">
      <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">{label}</label>
      <textarea
        rows={value.length > 100 ? 3 : 1}
        className="text-sm text-gray-900 bg-gray-50 border border-gray-200 rounded px-2 py-1 resize-y focus:outline-none focus:ring-1 focus:ring-blue-400"
        value={value}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  );
}

// ─── Brand review panel ───────────────────────────────────────────────────────

function BrandReview({ data, onChange }: { data: Record<string, any>; onChange: (d: Record<string, any>) => void }) {
  const set = (key: string, val: any) => onChange({ ...data, [key]: val });
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <FieldRow label="Brand Name (English)"  value={data.name_en}    onChange={v => set('name_en', v)} />
      <FieldRow label="Brand Name (Hindi)"    value={data.name_hi}    onChange={v => set('name_hi', v)} />
      <FieldRow label="Brand Name (Gujarati)" value={data.name_gu}    onChange={v => set('name_gu', v)} />
      <FieldRow label="Address (English)"     value={data.address_en} onChange={v => set('address_en', v)} />
      <FieldRow label="Address (Hindi)"       value={data.address_hi} onChange={v => set('address_hi', v)} />
      <FieldRow label="Address (Gujarati)"    value={data.address_gu} onChange={v => set('address_gu', v)} />
      <FieldRow label="Website"    value={data.website}    onChange={v => set('website', v)} />
      <FieldRow label="Email"      value={data.email}      onChange={v => set('email', v)} />
      <FieldRow label="Barcode"    value={data.barcode}    onChange={v => set('barcode', v)} />
      <FieldRow label="QR Data"    value={data.qr_data}    onChange={v => set('qr_data', v)} />
      <FieldRow label="Regn. No."  value={data.regn_no}    onChange={v => set('regn_no', v)} />
      <FieldRow label="Mfg. Lic."  value={data.mfg_lic_no} onChange={v => set('mfg_lic_no', v)} />
      {Array.isArray(data.phone) && data.phone.length > 0 && (
        <div className="flex flex-col gap-0.5 md:col-span-2">
          <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Phone Number(s)</label>
          <input
            className="text-sm text-gray-900 bg-gray-50 border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
            value={data.phone.join(', ')}
            onChange={e => set('phone', e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean))}
          />
          <span className="text-[11px] text-gray-400">Separate multiple numbers with commas</span>
        </div>
      )}
      {data.mrp != null && (
        <div className="flex flex-col gap-0.5">
          <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">MRP (₹)</label>
          <input
            type="number"
            className="text-sm text-gray-900 bg-gray-50 border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
            value={data.mrp}
            onChange={e => set('mrp', parseFloat(e.target.value) || null)}
          />
        </div>
      )}
    </div>
  );
}

// ─── Product review panel ─────────────────────────────────────────────────────

function ProductReview({ data, onChange }: { data: Record<string, any>; onChange: (d: Record<string, any>) => void }) {
  const set = (key: string, val: any) => onChange({ ...data, [key]: val });
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <FieldRow label="Product Name (English)"  value={data.name_en} onChange={v => set('name_en', v)} />
      <FieldRow label="Product Name (Hindi)"    value={data.name_hi} onChange={v => set('name_hi', v)} />
      <FieldRow label="Product Name (Gujarati)" value={data.name_gu} onChange={v => set('name_gu', v)} />
      <FieldRow label="Category / Type"         value={data.category} onChange={v => set('category', v)} />
      <FieldRow label="Chemical Composition"    value={data.composition_en} onChange={v => set('composition_en', v)} />
      <FieldRow label="CIR / Regn. No."         value={data.cir_regn_no} onChange={v => set('cir_regn_no', v)} />
      <FieldRow label="Poison Category"         value={data.poison_category} onChange={v => set('poison_category', v)} />
      <div className="md:col-span-2">
        <FieldRow label="Directions of Use"   value={data.directions_en} onChange={v => set('directions_en', v)} />
      </div>
      <div className="md:col-span-2">
        <FieldRow label="Precautions"         value={data.precautions_en} onChange={v => set('precautions_en', v)} />
      </div>
      <div className="md:col-span-2">
        <FieldRow label="First Aid"           value={data.first_aid_en} onChange={v => set('first_aid_en', v)} />
      </div>
      <div className="md:col-span-2">
        <FieldRow label="Crop Recommendations" value={data.recommendations_en} onChange={v => set('recommendations_en', v)} />
      </div>
      {Array.isArray(data.active_ingredients) && data.active_ingredients.length > 0 && (
        <div className="md:col-span-2">
          <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-1 block">Active Ingredients</label>
          <div className="space-y-1">
            {data.active_ingredients.map((ai: any, i: number) => (
              <div key={i} className="flex gap-2 text-sm bg-gray-50 border border-gray-200 rounded px-3 py-1.5">
                <input className="flex-1 bg-transparent outline-none" placeholder="Name" value={ai.name || ''} onChange={e => {
                  const arr = [...data.active_ingredients];
                  arr[i] = { ...arr[i], name: e.target.value };
                  set('active_ingredients', arr);
                }} />
                <input className="w-16 bg-transparent outline-none text-right" placeholder="%" value={ai.percentage || ''} onChange={e => {
                  const arr = [...data.active_ingredients];
                  arr[i] = { ...arr[i], percentage: e.target.value };
                  set('active_ingredients', arr);
                }} />
                <span className="text-gray-400">{ai.unit || '%'}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ExtractMasterPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [extractType, setExtractType] = useState<ExtractType>('brand');
  const [extracting, setExtracting] = useState(false);
  const [extracted, setExtracted] = useState<Record<string, any> | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Save mode
  const [saveMode, setSaveMode] = useState<SaveMode>('new');
  const [newName, setNewName] = useState('');
  const [existingBrands, setExistingBrands] = useState<ExistingBrand[]>([]);
  const [existingProducts, setExistingProducts] = useState<ExistingProduct[]>([]);
  const [selectedId, setSelectedId] = useState('');

  useEffect(() => {
    supabase.from('label_brands').select('id, name_en').order('name_en').then(({ data }) => {
      if (data) setExistingBrands(data);
    });
    supabase.from('label_products').select('id, name_en').order('name_en').then(({ data }) => {
      if (data) setExistingProducts(data);
    });
  }, []);

  const handleFile = (f: File) => {
    setFile(f);
    setExtracted(null);
    setSaved(false);
    setError(null);
    if (f.type.startsWith('image/')) {
      const url = URL.createObjectURL(f);
      setPreview(url);
    } else {
      setPreview(null);
    }
  };

  const handleExtract = async () => {
    if (!file) return;
    setExtracting(true);
    setExtracted(null);
    setError(null);
    setSaved(false);

    const fd = new FormData();
    fd.append('file', file);
    fd.append('extract_type', extractType);

    try {
      const res = await fetch('/api/label-extract', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Extraction failed');
      setExtracted(json.extracted);
      // Auto-fill new name
      if (json.extracted?.name_en && !newName) {
        setNewName(json.extracted.name_en);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setExtracting(false);
    }
  };

  const handleSave = async () => {
    if (!extracted) return;
    setSaving(true);
    setError(null);

    try {
      const table = extractType === 'brand' ? 'label_brands' : 'label_products';
      // Clean null values
      const payload: Record<string, any> = {};
      for (const [k, v] of Object.entries(extracted)) {
        if (v !== null && v !== undefined && v !== '') payload[k] = v;
      }

      if (saveMode === 'new') {
        if (!newName.trim()) throw new Error('Please enter a name for the new record');
        payload.name_en = newName.trim();
        const { error: err } = await supabase.from(table).insert(payload);
        if (err) throw new Error(err.message);
      } else {
        if (!selectedId) throw new Error('Please select an existing record to update');
        const { error: err } = await supabase.from(table).update(payload).eq('id', selectedId);
        if (err) throw new Error(err.message);
      }

      setSaved(true);
      // Refresh lists
      const { data: brands } = await supabase.from('label_brands').select('id, name_en').order('name_en');
      const { data: products } = await supabase.from('label_products').select('id, name_en').order('name_en');
      if (brands) setExistingBrands(brands);
      if (products) setExistingProducts(products);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setFile(null);
    setPreview(null);
    setExtracted(null);
    setSaved(false);
    setError(null);
    setNewName('');
    setSelectedId('');
    setSaveMode('new');
  };

  const existingList = extractType === 'brand' ? existingBrands : existingProducts;

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Extract Master from Packaging</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Upload any label or packaging — AI reads it and creates the master database record.
        </p>
      </div>

      {/* Step 1: Upload + Type */}
      <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Step 1 — Choose type &amp; upload packaging</p>

        {/* Type toggle */}
        <div className="flex gap-2">
          {(['brand', 'product'] as ExtractType[]).map(t => (
            <button
              key={t}
              onClick={() => { setExtractType(t); setExtracted(null); setSaved(false); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                extractType === t
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
              }`}
            >
              {t === 'brand' ? <Building2 className="h-4 w-4" /> : <FlaskConical className="h-4 w-4" />}
              {t === 'brand' ? 'Brand / Company Data' : 'Product Data'}
            </button>
          ))}
        </div>

        {/* Drop zone */}
        <div
          onClick={() => fileRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
          className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center cursor-pointer hover:border-gray-400 hover:bg-gray-50 transition-colors"
        >
          {preview ? (
            <img src={preview} alt="preview" className="max-h-48 mx-auto rounded-md object-contain" />
          ) : file ? (
            <div className="flex flex-col items-center gap-2 text-gray-600">
              <ImageIcon className="h-10 w-10 text-gray-400" />
              <span className="text-sm font-medium">{file.name}</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 text-gray-400">
              <Upload className="h-8 w-8" />
              <span className="text-sm">Drop packaging image/PDF here, or click to browse</span>
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
        </div>

        {file && (
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>{file.name} — {Math.round(file.size / 1024)} KB</span>
            <button onClick={() => { setFile(null); setPreview(null); setExtracted(null); }} className="text-red-500 hover:underline">Remove</button>
          </div>
        )}

        <button
          onClick={handleExtract}
          disabled={!file || extracting}
          className="w-full flex items-center justify-center gap-2 bg-gray-900 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {extracting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {extracting ? 'Reading packaging with AI…' : `Extract ${extractType === 'brand' ? 'Brand' : 'Product'} Data`}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {/* Step 2: Review extracted data */}
      {extracted && !saved && (
        <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Step 2 — Review &amp; edit extracted data</p>
            <span className="text-xs text-green-600 flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" /> Extraction complete
            </span>
          </div>

          {extractType === 'brand'
            ? <BrandReview data={extracted} onChange={setExtracted} />
            : <ProductReview data={extracted} onChange={setExtracted} />
          }
        </div>
      )}

      {/* Step 3: Save */}
      {extracted && !saved && (
        <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Step 3 — Save as master record</p>

          {/* Save mode tabs */}
          <div className="flex gap-2">
            {(['new', 'update'] as SaveMode[]).map(m => (
              <button
                key={m}
                onClick={() => setSaveMode(m)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                  saveMode === m
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                }`}
              >
                {m === 'new' ? '+ Create New Record' : 'Update Existing Record'}
              </button>
            ))}
          </div>

          {saveMode === 'new' ? (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">
                {extractType === 'brand' ? 'Brand' : 'Product'} Name (used as identifier in the DB)
              </label>
              <input
                type="text"
                placeholder={extractType === 'brand' ? 'e.g. Sunrise Agrotech' : 'e.g. Emamectin Benzoate 5% SG'}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                value={newName}
                onChange={e => setNewName(e.target.value)}
              />
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">
                Select existing {extractType === 'brand' ? 'brand' : 'product'} to update
              </label>
              <select
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                value={selectedId}
                onChange={e => setSelectedId(e.target.value)}
              >
                <option value="">— choose —</option>
                {existingList.map(item => (
                  <option key={item.id} value={item.id}>{item.name_en}</option>
                ))}
              </select>
              <p className="text-xs text-gray-400">This will merge the extracted data into the selected record (existing fields are overwritten).</p>
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={saving || (saveMode === 'new' && !newName.trim()) || (saveMode === 'update' && !selectedId)}
            className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? 'Saving…' : `Save as ${extractType === 'brand' ? 'Brand' : 'Product'} Master`}
          </button>
        </div>
      )}

      {/* Success */}
      {saved && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-5 flex items-start gap-4">
          <CheckCircle2 className="h-6 w-6 text-green-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-green-800">Master record saved successfully!</p>
            <p className="text-xs text-green-700 mt-1">
              The {extractType === 'brand' ? 'brand' : 'product'} data has been saved to the database.
              You can now use Label Check to compare any new packaging against this master.
            </p>
            <button
              onClick={reset}
              className="mt-3 flex items-center gap-1.5 text-xs text-green-700 hover:text-green-900 font-medium"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Extract another packaging
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
