'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Save, Upload, Building2 } from 'lucide-react';

export default function CompanyPage() {
  const [formData, setFormData] = useState({
    companyName: 'Aayam Graphics',
    tagline: 'Print & Design Solutions',
    email: 'info@aayamgraphics.com',
    phone: '9876543210',
    altPhone: '9876543211',
    gstNumber: '24AABCU9603R1ZM',
    panNumber: 'AABCU9603R',
    address: '123 Print Street, Industrial Area',
    city: 'Rajkot',
    state: 'Gujarat',
    pincode: '360001',
    website: 'www.aayamgraphics.com',
    bankName: 'State Bank of India',
    accountNumber: '1234567890',
    ifscCode: 'SBIN0001234',
    accountType: 'Current',
  });

  const [logo, setLogo] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setLogo(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      alert('✅ Company settings saved successfully!');
    }, 1000);
  };

  return (
    <div className="space-y-2 md:space-y-4 lg:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 md:gap-4">
        <div className="flex items-center gap-3">
          <Link href="/admin/settings" className="p-2 hover:bg-gray-100 rounded-lg lg:hidden">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-xl lg:text-page-title text-gray-900">Company Settings</h1>
            <p className="text-sm text-gray-500">Manage your business details</p>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center justify-center gap-2 bg-oms-blue text-white px-4 py-2.5 rounded-xl hover:bg-blue-600 disabled:bg-gray-400"
        >
          <Save size={18} />
          <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-6">
        {/* Logo Section */}
        <div className="bg-white rounded-lg md:rounded-2xl p-3 md:p-6 border border-gray-100">
          <h2 className="text-section text-gray-900 mb-4">Company Logo</h2>
          <div className="flex flex-col items-center">
            <label className="w-32 h-32 rounded-2xl border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:bg-gray-50 overflow-hidden">
              {logo ? (
                <img src={logo} alt="Logo" className="w-full h-full object-contain" />
              ) : (
                <div className="text-center text-gray-400">
                  <Upload size={32} className="mx-auto mb-2" />
                  <span className="text-sm">Upload Logo</span>
                </div>
              )}
              <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
            </label>
            <p className="text-xs text-gray-500 mt-3 text-center">
              Recommended: 200x200px, PNG or JPG
            </p>
          </div>
        </div>

        {/* Basic Info */}
        <div className="lg:col-span-2 bg-white rounded-lg md:rounded-2xl p-3 md:p-6 border border-gray-100">
          <h2 className="text-section text-gray-900 mb-4">Basic Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Company Name *</label>
              <input
                type="text"
                value={formData.companyName}
                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tagline</label>
              <input
                type="text"
                value={formData.tagline}
                onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
              <input
                type="text"
                value={formData.website}
                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Alt Phone</label>
              <input
                type="tel"
                value={formData.altPhone}
                onChange={(e) => setFormData({ ...formData, altPhone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl"
              />
            </div>
          </div>
        </div>

        {/* Tax Info */}
        <div className="bg-white rounded-lg md:rounded-2xl p-3 md:p-6 border border-gray-100">
          <h2 className="text-section text-gray-900 mb-4">Tax Information</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">GST Number</label>
              <input
                type="text"
                value={formData.gstNumber}
                onChange={(e) => setFormData({ ...formData, gstNumber: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl"
                placeholder="22AAAAA0000A1Z5"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">PAN Number</label>
              <input
                type="text"
                value={formData.panNumber}
                onChange={(e) => setFormData({ ...formData, panNumber: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl"
                placeholder="AAAAA0000A"
              />
            </div>
          </div>
        </div>

        {/* Address */}
        <div className="lg:col-span-2 bg-white rounded-lg md:rounded-2xl p-3 md:p-6 border border-gray-100">
          <h2 className="text-section text-gray-900 mb-4">Address</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Street Address *</label>
              <textarea
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl"
                rows={2}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">State *</label>
              <input
                type="text"
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pincode</label>
              <input
                type="text"
                value={formData.pincode}
                onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl"
              />
            </div>
          </div>
        </div>

        {/* Bank Details */}
        <div className="lg:col-span-3 bg-white rounded-lg md:rounded-2xl p-3 md:p-6 border border-gray-100">
          <h2 className="text-section text-gray-900 mb-4">Bank Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2 md:gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bank Name</label>
              <input
                type="text"
                value={formData.bankName}
                onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Account Number</label>
              <input
                type="text"
                value={formData.accountNumber}
                onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">IFSC Code</label>
              <input
                type="text"
                value={formData.ifscCode}
                onChange={(e) => setFormData({ ...formData, ifscCode: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Account Type</label>
              <select
                value={formData.accountType}
                onChange={(e) => setFormData({ ...formData, accountType: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl"
              >
                <option value="Current">Current</option>
                <option value="Savings">Savings</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
