'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Save } from 'lucide-react';

export default function PreferencesPage() {
  const [preferences, setPreferences] = useState({
    // Invoice Settings
    invoicePrefix: 'INV',
    orderPrefix: 'AAY',
    quotationPrefix: 'QUO',
    defaultGstRate: '18',
    invoiceTerms: 'Payment due within 15 days.',
    // Notification Settings
    emailNotifications: true,
    smsNotifications: false,
    lowStockAlert: true,
    orderAlerts: true,
    paymentAlerts: true,
    // Display Settings
    currency: 'INR',
    dateFormat: 'DD/MM/YYYY',
    itemsPerPage: '20',
    // Print Settings
    printPaperSize: 'A4',
    printLogo: true,
    printTerms: true,
  });

  const [isSaving, setIsSaving] = useState(false);

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      alert('✅ Preferences saved successfully!');
    }, 1000);
  };

  const handleToggle = (key: keyof typeof preferences) => {
    setPreferences(prev => ({ ...prev, [key]: !prev[key] }));
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
            <h1 className="text-xl lg:text-page-title text-gray-900">Preferences</h1>
            <p className="text-sm text-gray-500">App settings & configurations</p>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">
        {/* Invoice Settings */}
        <div className="bg-white rounded-lg md:rounded-2xl p-3 md:p-4 border border-gray-100">
          <h2 className="text-section text-gray-900 mb-4">Invoice Settings</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2 md:gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Prefix</label>
                <input
                  type="text"
                  value={preferences.invoicePrefix}
                  onChange={(e) => setPreferences({ ...preferences, invoicePrefix: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Order Prefix</label>
                <input
                  type="text"
                  value={preferences.orderPrefix}
                  onChange={(e) => setPreferences({ ...preferences, orderPrefix: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quote Prefix</label>
                <input
                  type="text"
                  value={preferences.quotationPrefix}
                  onChange={(e) => setPreferences({ ...preferences, quotationPrefix: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Default GST Rate (%)</label>
              <select
                value={preferences.defaultGstRate}
                onChange={(e) => setPreferences({ ...preferences, defaultGstRate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl"
              >
                <option value="0">0%</option>
                <option value="5">5%</option>
                <option value="12">12%</option>
                <option value="18">18%</option>
                <option value="28">28%</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Terms</label>
              <textarea
                value={preferences.invoiceTerms}
                onChange={(e) => setPreferences({ ...preferences, invoiceTerms: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl"
                rows={3}
              />
            </div>
          </div>
        </div>

        {/* Notification Settings */}
        <div className="bg-white rounded-lg md:rounded-2xl p-3 md:p-4 border border-gray-100">
          <h2 className="text-section text-gray-900 mb-4">Notifications</h2>
          <div className="space-y-4">
            {[
              { key: 'emailNotifications', label: 'Email Notifications', desc: 'Receive emails for important updates' },
              { key: 'smsNotifications', label: 'SMS Notifications', desc: 'Receive SMS alerts' },
              { key: 'lowStockAlert', label: 'Low Stock Alerts', desc: 'Alert when stock falls below minimum' },
              { key: 'orderAlerts', label: 'Order Alerts', desc: 'Notifications for new orders' },
              { key: 'paymentAlerts', label: 'Payment Alerts', desc: 'Alert on payment received' },
            ].map(item => (
              <div key={item.key} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <div>
                  <p className="font-medium text-gray-900">{item.label}</p>
                  <p className="text-xs text-gray-500">{item.desc}</p>
                </div>
                <button
                  onClick={() => handleToggle(item.key as keyof typeof preferences)}
                  className={`w-12 h-6 rounded-full transition-colors ${
                    preferences[item.key as keyof typeof preferences] ? 'bg-white0' : 'bg-gray-300'
                  }`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    preferences[item.key as keyof typeof preferences] ? 'translate-x-6' : 'translate-x-0.5'
                  }`} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Display Settings */}
        <div className="bg-white rounded-lg md:rounded-2xl p-3 md:p-4 border border-gray-100">
          <h2 className="text-section text-gray-900 mb-4">Display Settings</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
              <select
                value={preferences.currency}
                onChange={(e) => setPreferences({ ...preferences, currency: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl"
              >
                <option value="INR">Indian Rupee (₹)</option>
                <option value="USD">US Dollar ($)</option>
                <option value="EUR">Euro (€)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date Format</label>
              <select
                value={preferences.dateFormat}
                onChange={(e) => setPreferences({ ...preferences, dateFormat: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl"
              >
                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Items Per Page</label>
              <select
                value={preferences.itemsPerPage}
                onChange={(e) => setPreferences({ ...preferences, itemsPerPage: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl"
              >
                <option value="10">10</option>
                <option value="20">20</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
            </div>
          </div>
        </div>

        {/* Print Settings */}
        <div className="bg-white rounded-lg md:rounded-2xl p-3 md:p-4 border border-gray-100">
          <h2 className="text-section text-gray-900 mb-4">Print Settings</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Paper Size</label>
              <select
                value={preferences.printPaperSize}
                onChange={(e) => setPreferences({ ...preferences, printPaperSize: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl"
              >
                <option value="A4">A4</option>
                <option value="A5">A5</option>
                <option value="Letter">Letter</option>
              </select>
            </div>
            
            {[
              { key: 'printLogo', label: 'Print Logo', desc: 'Include company logo on prints' },
              { key: 'printTerms', label: 'Print Terms', desc: 'Include terms & conditions' },
            ].map(item => (
              <div key={item.key} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <div>
                  <p className="font-medium text-gray-900">{item.label}</p>
                  <p className="text-xs text-gray-500">{item.desc}</p>
                </div>
                <button
                  onClick={() => handleToggle(item.key as keyof typeof preferences)}
                  className={`w-12 h-6 rounded-full transition-colors ${
                    preferences[item.key as keyof typeof preferences] ? 'bg-white0' : 'bg-gray-300'
                  }`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    preferences[item.key as keyof typeof preferences] ? 'translate-x-6' : 'translate-x-0.5'
                  }`} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
