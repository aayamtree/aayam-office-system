'use client';

import { useState, useEffect } from 'react';
import { toast } from '@/lib/toast';
import Link from 'next/link';
import { ArrowLeft, Save, Upload, Building2, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const DEFAULT_COMPANY = {
  companyName: '',
  tagline: '',
  email: '',
  phone: '',
  altPhone: '',
  gstNumber: '',
  panNumber: '',
  address: '',
  city: '',
  state: '',
  pincode: '',
  website: '',
};

export default function CompanyPage() {
  const [formData, setFormData] = useState(DEFAULT_COMPANY);
  const [logo, setLogo] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Load from Supabase on mount
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'company_info')
        .single();

      if (!error && data?.value) {
        try {
          const parsed = JSON.parse(data.value);
          setFormData({ ...DEFAULT_COMPANY, ...parsed });
          if (parsed.logo) setLogo(parsed.logo);
        } catch { /* ignore parse error */ }
      }
      setLoading(false);
    };
    load();
  }, []);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setLogo(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    const payload = JSON.stringify({ ...formData, logo });

    const { error } = await supabase
      .from('app_settings')
      .upsert({ key: 'company_info', value: payload }, { onConflict: 'key' });

    if (error) {
      toast.error('Failed to save: ' + error.message);
    } else {
      toast.success('Company settings saved!');
    }
    setIsSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] gap-2 text-gray-400">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">Loading company info…</span>
      </div>
    );
  }

  return (
    <div className="space-y-2 md:space-y-4 lg:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 md:gap-4">
        <div className="flex items-center gap-3">
          <Link href="/admin/settings" className="p-2 hover:bg-gray-100 rounded-md lg:hidden">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl lg:text-page-title text-gray-900">Company Settings</h1>
            <p className="text-sm text-gray-500">Manage your business details</p>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center justify-center gap-2 bg-gray-900 text-white px-4 py-2.5 rounded-md hover:bg-gray-800 disabled:bg-gray-400 shadow-sm font-semibold"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          <span>{isSaving ? 'Saving…' : 'Save Changes'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-4">
        {/* Logo Section */}
        <div className="bg-white rounded-md p-3 md:p-4 border border-gray-100">
          <h2 className="text-section text-gray-900 mb-4">Company Logo</h2>
          <div className="flex flex-col items-center">
            <label className="w-32 h-32 rounded-md border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:bg-gray-50 overflow-hidden">
              {logo ? (
                <img src={logo} alt="Company Logo" className="w-full h-full object-contain" />
              ) : (
                <div className="text-center text-gray-400">
                  <Upload className="w-8 h-8 mx-auto mb-2" />
                  <span className="text-sm">Upload Logo</span>
                </div>
              )}
              <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
            </label>
            <p className="text-xs text-gray-500 mt-3 text-center">Recommended: 200x200px, PNG or JPG</p>
          </div>
        </div>

        {/* Basic Info */}
        <div className="lg:col-span-2 bg-white rounded-md p-3 md:p-4 border border-gray-100">
          <h2 className="text-section text-gray-900 mb-4">Basic Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Company Name *</label>
              <input type="text" value={formData.companyName} onChange={(e) => setFormData({ ...formData, companyName: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-md" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tagline</label>
              <input type="text" value={formData.tagline} onChange={(e) => setFormData({ ...formData, tagline: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-md" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
              <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-md" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
              <input type="text" value={formData.website} onChange={(e) => setFormData({ ...formData, website: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-md" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
              <input type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-md" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Alt Phone</label>
              <input type="tel" value={formData.altPhone} onChange={(e) => setFormData({ ...formData, altPhone: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-md" />
            </div>
          </div>
        </div>

        {/* Tax Info */}
        <div className="bg-white rounded-md p-3 md:p-4 border border-gray-100">
          <h2 className="text-section text-gray-900 mb-4">Tax Information</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">GST Number</label>
              <input type="text" value={formData.gstNumber} onChange={(e) => setFormData({ ...formData, gstNumber: e.target.value.toUpperCase() })} className="w-full px-3 py-2 border border-gray-200 rounded-md" placeholder="22AAAAA0000A1Z5" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">PAN Number</label>
              <input type="text" value={formData.panNumber} onChange={(e) => setFormData({ ...formData, panNumber: e.target.value.toUpperCase() })} className="w-full px-3 py-2 border border-gray-200 rounded-md" placeholder="AAAAA0000A" />
            </div>
          </div>
        </div>

        {/* Address */}
        <div className="lg:col-span-2 bg-white rounded-md p-3 md:p-4 border border-gray-100">
          <h2 className="text-section text-gray-900 mb-4">Address</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Street Address *</label>
              <textarea value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-md" rows={2} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
              <input type="text" value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-md" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">State *</label>
              <input type="text" value={formData.state} onChange={(e) => setFormData({ ...formData, state: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-md" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pincode</label>
              <input type="text" value={formData.pincode} onChange={(e) => setFormData({ ...formData, pincode: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-md" />
            </div>
          </div>
        </div>

        {/* Bank Accounts — managed from Banking page */}
        <div className="lg:col-span-3 bg-white rounded-md p-3 md:p-4 border border-gray-100">
          <h2 className="text-section text-gray-900 mb-2">Bank Accounts</h2>
          <p className="text-sm text-gray-500 mb-3">Bank accounts are managed from the Banking page — you can add multiple accounts, set a default, and import statements there.</p>
          <Link href="/admin/finance/banking" className="inline-flex items-center gap-1.5 text-sm font-medium text-[#B8860B] hover:underline">
            <Building2 className="w-4 h-4" />
            Go to Banking → Manage Accounts
          </Link>
        </div>
      </div>
    </div>
  );
}
