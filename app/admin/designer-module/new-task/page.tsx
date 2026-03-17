'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import DesignerAvailabilityDropdown from '@/components/designer-module/DesignerAvailabilityDropdown';
import {
  ArrowLeft, Loader2, Save, Send, AlertCircle, RefreshCcw, Clock
} from 'lucide-react';

interface Client { id: string; name: string; company?: string; }
interface ProductType { id: string; name: string; category: string; is_active?: boolean; }

const DRAFT_KEY = 'designer_task_draft';

const PRODUCT_CATEGORIES = ['packaging', 'print', 'digital', 'other'];

export default function NewTaskPage() {
  const router = useRouter();
  const { profile, isAdmin } = useAuth();

  // Form state
  const [clientId, setClientId] = useState('');
  const [productTypeId, setProductTypeId] = useState('');
  const [description, setDescription] = useState('');
  const [dimensions, setDimensions] = useState('');
  const [deadline, setDeadline] = useState('');
  const [priority, setPriority] = useState('normal');
  const [assignedTo, setAssignedTo] = useState(profile?.id || '');
  const [isDraft, setIsDraft] = useState(false);

  // Data
  const [clients, setClients] = useState<Client[]>([]);
  const [productTypes, setProductTypes] = useState<ProductType[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [draftRestored, setDraftRestored] = useState(false);
  const [newProductTypeName, setNewProductTypeName] = useState('');
  const [showNewProductTypeModal, setShowNewProductTypeModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const clientRef = useRef<HTMLDivElement>(null);

  // Set default assigned_to when profile loads
  useEffect(() => {
    if (profile?.id && !assignedTo) setAssignedTo(profile.id);
  }, [profile]);

  // Load clients and product types
  useEffect(() => {
    const load = async () => {
      const [clientRes, ptRes] = await Promise.all([
        fetch('/api/crm/clients?limit=200'),
        fetch('/api/design-tasks/product-types'),
      ]);

      if (clientRes.ok) {
        const j = await clientRes.json();
        setClients(j.data || []);
      }
      if (ptRes.ok) {
        const j = await ptRes.json();
        setProductTypes(j.data || []);
      }
      setDataLoading(false);
    };
    load();
  }, []);

  // Draft restore on mount
  useEffect(() => {
    const draft = localStorage.getItem(DRAFT_KEY);
    if (draft) {
      try {
        const d = JSON.parse(draft);
        setClientId(d.clientId || '');
        setProductTypeId(d.productTypeId || '');
        setDescription(d.description || '');
        setDimensions(d.dimensions || '');
        setDeadline(d.deadline || '');
        setPriority(d.priority || 'normal');
        setAssignedTo(d.assignedTo || profile?.id || '');
        setDraftRestored(true);
      } catch { }
    }
  }, []);

  // Auto-save draft every 30s
  useEffect(() => {
    const interval = setInterval(() => {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({
        clientId, productTypeId, description, dimensions, deadline, priority, assignedTo
      }));
    }, 30000);
    return () => clearInterval(interval);
  }, [clientId, productTypeId, description, dimensions, deadline, priority, assignedTo]);

  // Close client dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (clientRef.current && !clientRef.current.contains(e.target as Node)) {
        setShowClientDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectedClient = clients.find(c => c.id === clientId);
  const filteredClients = clients.filter(c => {
    const q = clientSearch.toLowerCase();
    return (c.company || c.name || '').toLowerCase().includes(q);
  });

  const groupedProductTypes = PRODUCT_CATEGORIES.reduce((acc, cat) => {
    acc[cat] = productTypes.filter(pt => pt.category === cat && pt.is_active !== false);
    return acc;
  }, {} as Record<string, ProductType[]>);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!clientId) newErrors.client = 'Client is required';
    if (!productTypeId) newErrors.productType = 'Product type is required';
    if (!description.trim()) newErrors.description = 'Description is required';
    if (description.length > 300) newErrors.description = 'Max 300 characters';
    if (!assignedTo) newErrors.assignedTo = 'Assign to a designer';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (draft = false) => {
    if (!draft && !validate()) return;
    setSubmitting(true);

    try {
      const res = await fetch('/api/design-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          product_type_id: productTypeId,
          description,
          dimensions: dimensions || null,
          deadline: deadline || null,
          priority,
          assigned_to: assignedTo,
          is_draft: draft,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to create task');

      // Clear draft
      localStorage.removeItem(DRAFT_KEY);

      router.push(`/admin/designer-module/tasks/${json.data.id}`);
    } catch (err: any) {
      setErrors({ submit: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateProductType = async () => {
    if (!newProductTypeName.trim()) return;
    try {
      const res = await fetch('/api/design-tasks/product-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newProductTypeName.trim(), category: 'other', is_active: false }),
      });
      const json = await res.json();
      if (res.ok) {
        setProductTypes(prev => [...prev, json.data]);
        setProductTypeId(json.data.id);
        setShowNewProductTypeModal(false);
        setNewProductTypeName('');
      }
    } catch { }
  };

  if (dataLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="animate-spin text-gray-400" size={24} />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">New Design Task</h1>
          <p className="text-sm text-gray-500">Fill in the details below</p>
        </div>
      </div>

      {/* Draft restored banner */}
      {draftRestored && (
        <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg p-3 mb-5 text-sm">
          <span className="text-blue-700 flex items-center gap-2"><RefreshCcw size={14} /> Draft restored</span>
          <button
            onClick={() => { localStorage.removeItem(DRAFT_KEY); setDraftRestored(false); setClientId(''); setDescription(''); setProductTypeId(''); setDimensions(''); setDeadline(''); setPriority('normal'); }}
            className="text-blue-500 hover:text-blue-700 underline text-xs"
          >
            Clear draft
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
        {/* 1. Client */}
        <div ref={clientRef} className="relative">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Client <span className="text-red-500">*</span>
          </label>
          <div
            onClick={() => setShowClientDropdown(true)}
            className={`w-full px-3 py-2 border rounded-lg text-sm cursor-pointer flex items-center justify-between
              ${errors.client ? 'border-red-400' : 'border-gray-200'}`}
          >
            {selectedClient
              ? <span className="font-medium">{selectedClient.company || selectedClient.name}</span>
              : <span className="text-gray-400">Search client...</span>
            }
          </div>
          {showClientDropdown && (
            <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-auto">
              <div className="sticky top-0 bg-white p-2 border-b border-gray-100">
                <input
                  autoFocus
                  value={clientSearch}
                  onChange={e => setClientSearch(e.target.value)}
                  placeholder="Type to search..."
                  className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-md outline-none focus:ring-1 focus:ring-primary/30"
                />
              </div>
              {filteredClients.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => { setClientId(c.id); setShowClientDropdown(false); setClientSearch(''); }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex flex-col"
                >
                  <span className="font-medium">{c.company || c.name}</span>
                  <span className="text-xs text-gray-400">{c.name}</span>
                </button>
              ))}
              {filteredClients.length === 0 && (
                <div className="p-3 text-sm text-gray-400 text-center">No clients found</div>
              )}
            </div>
          )}
          {errors.client && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle size={11} />{errors.client}</p>}
        </div>

        {/* 2. Product Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Product Type <span className="text-red-500">*</span>
          </label>
          <select
            value={productTypeId}
            onChange={e => {
              if (e.target.value === '__new__') { setShowNewProductTypeModal(true); }
              else setProductTypeId(e.target.value);
            }}
            className={`w-full px-3 py-2 border rounded-lg text-sm bg-white
              ${errors.productType ? 'border-red-400' : 'border-gray-200'}`}
          >
            <option value="">Select product type...</option>
            {PRODUCT_CATEGORIES.map(cat => (
              groupedProductTypes[cat]?.length > 0 && (
                <optgroup key={cat} label={cat.charAt(0).toUpperCase() + cat.slice(1)}>
                  {groupedProductTypes[cat].map(pt => (
                    <option key={pt.id} value={pt.id}>{pt.name}</option>
                  ))}
                </optgroup>
              )
            ))}
            <option value="__new__">+ Create New Product Type</option>
          </select>
          {errors.productType && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle size={11} />{errors.productType}</p>}
        </div>

        {/* 3. Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description <span className="text-red-500">*</span>
          </label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="e.g. Stand-up pouch, matt finish, 500g"
            rows={3}
            maxLength={300}
            className={`w-full px-3 py-2 border rounded-lg text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary/30
              ${errors.description ? 'border-red-400' : 'border-gray-200'}`}
          />
          <div className="flex items-center justify-between mt-1">
            {errors.description
              ? <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle size={11} />{errors.description}</p>
              : <div />
            }
            <span className={`text-xs ${description.length > 280 ? 'text-orange-500' : 'text-gray-400'}`}>
              {description.length}/300
            </span>
          </div>
        </div>

        {/* 4. Dimensions */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Dimensions <span className="text-xs text-gray-400">(optional)</span>
          </label>
          <input
            value={dimensions}
            onChange={e => setDimensions(e.target.value)}
            placeholder="e.g. 10x15 cm, A4, 1080x1080px"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary/30"
          />
        </div>

        {/* 5. Deadline */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Deadline <span className="text-xs text-gray-400">(optional)</span>
          </label>
          <input
            type="date"
            value={deadline}
            onChange={e => setDeadline(e.target.value)}
            min={new Date().toISOString().split('T')[0]}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary/30"
          />
        </div>

        {/* 6. Priority */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
          <div className="flex gap-3">
            {['normal', 'urgent', 'critical'].map(p => (
              <button
                key={p}
                type="button"
                onClick={() => setPriority(p)}
                className={`flex-1 py-2 text-sm rounded-lg border capitalize font-medium transition-colors
                  ${priority === p
                    ? p === 'normal' ? 'bg-gray-900 text-white border-gray-900'
                      : p === 'urgent' ? 'bg-orange-500 text-white border-orange-500'
                      : 'bg-red-600 text-white border-red-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* 7. Assign To */}
        <div>
          <DesignerAvailabilityDropdown
            value={assignedTo}
            onChange={setAssignedTo}
            isAdmin={isAdmin}
            label="Assigned To"
          />
          {errors.assignedTo && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle size={11} />{errors.assignedTo}</p>}
        </div>

        {/* Draft info */}
        <div className="flex items-center gap-1.5 text-xs text-gray-400 bg-gray-50 rounded-lg p-2">
          <Clock size={12} />
          Draft auto-saved every 30 seconds to your browser
        </div>

        {/* Submit error */}
        {errors.submit && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600 flex items-center gap-2">
            <AlertCircle size={14} /> {errors.submit}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => handleSubmit(true)}
            disabled={submitting}
            className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-50 flex items-center gap-2"
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save Draft
          </button>
          <button
            type="button"
            onClick={() => handleSubmit(false)}
            disabled={submitting}
            className="flex-1 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 flex items-center justify-center gap-2 font-semibold"
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            Create Task
          </button>
        </div>
      </div>

      {/* New Product Type Modal */}
      {showNewProductTypeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="font-bold text-gray-900 mb-4">Create New Product Type</h3>
            <p className="text-xs text-gray-500 mb-4 bg-yellow-50 border border-yellow-200 rounded p-2">
              New product types will be pending admin approval before appearing in the main list.
            </p>
            <input
              autoFocus
              value={newProductTypeName}
              onChange={e => setNewProductTypeName(e.target.value)}
              placeholder="Product type name..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm mb-4 focus:outline-none focus:ring-1 focus:ring-primary/30"
            />
            <div className="flex gap-3">
              <button
                onClick={() => { setShowNewProductTypeModal(false); setNewProductTypeName(''); }}
                className="flex-1 px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateProductType}
                className="flex-1 px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-700"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
