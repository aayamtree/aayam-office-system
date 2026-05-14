'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useConfirm } from '@/components/ConfirmModal';
import { toast } from '@/lib/toast';
import {
  Plus, Trash2, Pencil, Loader2, X, Check, Building2,
  Phone, Globe, MapPin, QrCode, Barcode, FileText, Upload,
} from 'lucide-react';

interface LabelBrand {
  id: string;
  created_at: string;
  name_en: string;
  name_hi: string | null;
  name_gu: string | null;
  logo_url: string | null;
  address_en: string | null;
  address_hi: string | null;
  address_gu: string | null;
  phone: string[] | null;
  email: string | null;
  website: string | null;
  qr_data: string | null;
  barcode: string | null;
  regn_no: string | null;
  mfg_lic_no: string | null;
  mrp: number | null;
  notes: string | null;
  is_active: boolean;
}

const EMPTY_FORM = {
  name_en: '', name_hi: '', name_gu: '',
  address_en: '', address_hi: '', address_gu: '',
  phone: '', email: '', website: '',
  qr_data: '', barcode: '', regn_no: '', mfg_lic_no: '',
  mrp: '', notes: '',
};

type FormState = typeof EMPTY_FORM;

export default function BrandsManager() {
  const [brands, setBrands] = useState<LabelBrand[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [search, setSearch] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const confirm = useConfirm();

  const fetchBrands = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('label_brands')
      .select('*')
      .order('name_en', { ascending: true });
    if (data) setBrands(data);
    setLoading(false);
  };

  useEffect(() => { fetchBrands(); }, []);

  const openAdd = () => {
    setEditId(null);
    setForm(EMPTY_FORM);
    setLogoFile(null);
    setLogoPreview(null);
    setShowForm(true);
  };

  const openEdit = (b: LabelBrand) => {
    setEditId(b.id);
    setForm({
      name_en: b.name_en || '',
      name_hi: b.name_hi || '',
      name_gu: b.name_gu || '',
      address_en: b.address_en || '',
      address_hi: b.address_hi || '',
      address_gu: b.address_gu || '',
      phone: (b.phone || []).join(', '),
      email: b.email || '',
      website: b.website || '',
      qr_data: b.qr_data || '',
      barcode: b.barcode || '',
      regn_no: b.regn_no || '',
      mfg_lic_no: b.mfg_lic_no || '',
      mrp: b.mrp != null ? String(b.mrp) : '',
      notes: b.notes || '',
    });
    setLogoPreview(b.logo_url || null);
    setLogoFile(null);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditId(null);
    setForm(EMPTY_FORM);
    setLogoFile(null);
    setLogoPreview(null);
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const uploadLogo = async (): Promise<string | null> => {
    if (!logoFile) return null;
    setUploadingLogo(true);
    const ext = logoFile.name.split('.').pop();
    const path = `label-brands/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('uploads').upload(path, logoFile, { upsert: true });
    setUploadingLogo(false);
    if (error) { toast.error('Logo upload failed: ' + error.message); return null; }
    const { data } = supabase.storage.from('uploads').getPublicUrl(path);
    return data.publicUrl;
  };

  const handleSave = async () => {
    if (!form.name_en.trim()) { toast.error('Brand name (English) is required'); return; }
    setSaving(true);

    let logo_url: string | null = null;
    if (logoFile) {
      logo_url = await uploadLogo();
      if (!logo_url) { setSaving(false); return; }
    }

    const phones = form.phone.split(',').map(p => p.trim()).filter(Boolean);
    const payload: Partial<LabelBrand> & { logo_url?: string | null } = {
      name_en: form.name_en.trim(),
      name_hi: form.name_hi.trim() || null,
      name_gu: form.name_gu.trim() || null,
      address_en: form.address_en.trim() || null,
      address_hi: form.address_hi.trim() || null,
      address_gu: form.address_gu.trim() || null,
      phone: phones.length ? phones : null,
      email: form.email.trim() || null,
      website: form.website.trim() || null,
      qr_data: form.qr_data.trim() || null,
      barcode: form.barcode.trim() || null,
      regn_no: form.regn_no.trim() || null,
      mfg_lic_no: form.mfg_lic_no.trim() || null,
      mrp: form.mrp ? parseFloat(form.mrp) : null,
      notes: form.notes.trim() || null,
    };
    if (logo_url) payload.logo_url = logo_url;

    let error;
    if (editId) {
      ({ error } = await supabase.from('label_brands').update(payload).eq('id', editId));
    } else {
      ({ error } = await supabase.from('label_brands').insert(payload));
    }

    if (error) toast.error(error.message);
    else {
      toast.success(editId ? 'Brand updated!' : 'Brand added!');
      closeForm();
      fetchBrands();
    }
    setSaving(false);
  };

  const handleDelete = async (b: LabelBrand) => {
    const { confirmed } = await confirm({
      title: 'Delete Brand',
      message: `Delete "${b.name_en}"? This cannot be undone.`,
      variant: 'danger',
      confirmLabel: 'Delete',
    });
    if (!confirmed) return;
    const { error } = await supabase.from('label_brands').delete().eq('id', b.id);
    if (error) toast.error(error.message);
    else { toast.success('Brand deleted'); fetchBrands(); }
  };

  const handleToggle = async (b: LabelBrand) => {
    await supabase.from('label_brands').update({ is_active: !b.is_active }).eq('id', b.id);
    fetchBrands();
  };

  const filtered = brands.filter(b =>
    b.name_en.toLowerCase().includes(search.toLowerCase()) ||
    (b.name_hi || '').includes(search) ||
    (b.name_gu || '').includes(search)
  );

  const set = (field: keyof FormState, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Brand Database</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Master list of all client brands — company info, logos, contacts, regulatory details.
          </p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-md text-sm font-medium hover:bg-gray-800 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Brand
        </button>
      </div>

      {/* Search */}
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search brands..."
        className="w-full max-w-sm border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
      />

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-gray-200 rounded-lg">
          <Building2 className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {search ? 'No brands match your search.' : 'No brands yet. Add your first brand above.'}
          </p>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Brand</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Contact</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Regulatory</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(b => (
                <tr key={b.id} className={`hover:bg-gray-50 transition-colors ${!b.is_active ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {b.logo_url ? (
                        <img src={b.logo_url} alt={b.name_en} className="h-9 w-9 rounded-md object-contain border border-gray-100 bg-white" />
                      ) : (
                        <div className="h-9 w-9 rounded-md bg-gray-100 flex items-center justify-center text-gray-400">
                          <Building2 className="h-4 w-4" />
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-gray-900">{b.name_en}</p>
                        <p className="text-xs text-muted-foreground">
                          {[b.name_hi, b.name_gu].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    <div className="space-y-0.5 text-xs">
                      {b.phone?.length ? <div className="flex items-center gap-1"><Phone className="h-3 w-3" />{b.phone.join(', ')}</div> : null}
                      {b.website ? <div className="flex items-center gap-1"><Globe className="h-3 w-3" />{b.website}</div> : null}
                      {b.address_en ? <div className="flex items-center gap-1"><MapPin className="h-3 w-3" /><span className="truncate max-w-[180px]">{b.address_en}</span></div> : null}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    <div className="space-y-0.5 text-xs">
                      {b.regn_no ? <div>Regn: {b.regn_no}</div> : null}
                      {b.mfg_lic_no ? <div>Lic: {b.mfg_lic_no}</div> : null}
                      {b.mrp ? <div>MRP: ₹{b.mrp}</div> : null}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleToggle(b)}
                      className={`text-xs px-2 py-0.5 rounded-full border font-medium transition-colors ${
                        b.is_active
                          ? 'border-green-200 text-green-700 bg-green-50 hover:bg-green-100'
                          : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      {b.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEdit(b)}
                        className="p-1.5 rounded-md text-muted-foreground hover:text-gray-900 hover:bg-gray-100 transition-colors"
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(b)}
                        className="p-1.5 rounded-md text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit Form — slide-in panel */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/40" onClick={closeForm} />
          <div className="relative ml-auto w-full max-w-2xl h-full bg-white shadow-2xl flex flex-col overflow-hidden">
            {/* Panel header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-base font-semibold text-gray-900">
                {editId ? 'Edit Brand' : 'Add New Brand'}
              </h2>
              <button onClick={closeForm} className="p-1.5 rounded-md hover:bg-gray-100 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

              {/* Logo */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Logo</label>
                <div className="flex items-center gap-4">
                  {logoPreview ? (
                    <img src={logoPreview} alt="logo preview" className="h-16 w-16 rounded-lg object-contain border border-gray-200 bg-white" />
                  ) : (
                    <div className="h-16 w-16 rounded-lg bg-gray-100 flex items-center justify-center text-gray-300">
                      <Building2 className="h-6 w-6" />
                    </div>
                  )}
                  <div>
                    <button
                      onClick={() => fileRef.current?.click()}
                      className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded-md text-sm hover:bg-gray-50 transition-colors"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      {logoPreview ? 'Change Logo' : 'Upload Logo'}
                    </button>
                    <p className="text-xs text-muted-foreground mt-1">PNG, JPG recommended. Max 2MB.</p>
                  </div>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
                </div>
              </div>

              {/* Brand Name */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Brand Name</label>
                <div className="grid grid-cols-1 gap-2">
                  <div>
                    <label className="text-xs text-gray-500 mb-0.5 block">English *</label>
                    <input value={form.name_en} onChange={e => set('name_en', e.target.value)} placeholder="e.g. Sunrise Agrotech" className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-gray-500 mb-0.5 block">Hindi</label>
                      <input value={form.name_hi} onChange={e => set('name_hi', e.target.value)} placeholder="हिंदी नाम" className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-0.5 block">Gujarati</label>
                      <input value={form.name_gu} onChange={e => set('name_gu', e.target.value)} placeholder="ગુજરાતી નામ" className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Address */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Address</label>
                <div className="space-y-2">
                  <div>
                    <label className="text-xs text-gray-500 mb-0.5 block">English</label>
                    <textarea value={form.address_en} onChange={e => set('address_en', e.target.value)} rows={2} placeholder="Full address in English" className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 resize-none" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-gray-500 mb-0.5 block">Hindi</label>
                      <textarea value={form.address_hi} onChange={e => set('address_hi', e.target.value)} rows={2} placeholder="हिंदी पता" className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 resize-none" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-0.5 block">Gujarati</label>
                      <textarea value={form.address_gu} onChange={e => set('address_gu', e.target.value)} rows={2} placeholder="ગુજરાતી સરનામું" className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 resize-none" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Contact */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Contact</label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-500 mb-0.5 block">Phone(s)</label>
                    <input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="Comma-separated numbers" className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-0.5 block">Email</label>
                    <input value={form.email} onChange={e => set('email', e.target.value)} placeholder="contact@brand.com" className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400" />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-gray-500 mb-0.5 block">Website</label>
                    <input value={form.website} onChange={e => set('website', e.target.value)} placeholder="www.brand.com" className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400" />
                  </div>
                </div>
              </div>

              {/* Print Details */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Print Details</label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-500 mb-0.5 flex items-center gap-1"><QrCode className="h-3 w-3" />QR Code Data / URL</label>
                    <input value={form.qr_data} onChange={e => set('qr_data', e.target.value)} placeholder="QR content or URL" className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-0.5 flex items-center gap-1"><Barcode className="h-3 w-3" />Barcode Number</label>
                    <input value={form.barcode} onChange={e => set('barcode', e.target.value)} placeholder="Barcode" className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-0.5 block">MRP (₹)</label>
                    <input type="number" value={form.mrp} onChange={e => set('mrp', e.target.value)} placeholder="0.00" className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400" />
                  </div>
                </div>
              </div>

              {/* Regulatory */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Regulatory</label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-500 mb-0.5 block">Registration No.</label>
                    <input value={form.regn_no} onChange={e => set('regn_no', e.target.value)} placeholder="CIR-XXXX/XXXX" className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-0.5 block">Mfg. Licence No.</label>
                    <input value={form.mfg_lic_no} onChange={e => set('mfg_lic_no', e.target.value)} placeholder="GJ-RAJ-XXXXX" className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400" />
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Notes</label>
                <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} placeholder="Any additional notes..." className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 resize-none" />
              </div>
            </div>

            {/* Panel footer */}
            <div className="border-t border-gray-200 px-6 py-4 flex items-center justify-end gap-3 bg-gray-50">
              <button onClick={closeForm} className="px-4 py-2 rounded-md text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors">Cancel</button>
              <button
                onClick={handleSave}
                disabled={saving || uploadingLogo}
                className="flex items-center gap-2 px-5 py-2 bg-gray-900 text-white rounded-md text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors"
              >
                {saving || uploadingLogo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {editId ? 'Save Changes' : 'Add Brand'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
