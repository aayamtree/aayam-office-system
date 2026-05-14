'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useConfirm } from '@/components/ConfirmModal';
import { toast } from '@/lib/toast';
import { Plus, Trash2, Pencil, Loader2, X, Check, FlaskConical, ChevronDown, ChevronUp } from 'lucide-react';

interface LabelProduct {
  id: string;
  created_at: string;
  name_en: string;
  name_hi: string | null;
  name_gu: string | null;
  category: string | null;
  tagline_en: string | null;
  active_ingredients: { name: string; percentage: string; unit: string }[] | null;
  composition_en: string | null;
  directions_en: string | null;
  directions_hi: string | null;
  directions_gu: string | null;
  precautions_en: string | null;
  precautions_hi: string | null;
  precautions_gu: string | null;
  first_aid_en: string | null;
  first_aid_hi: string | null;
  first_aid_gu: string | null;
  symptoms_en: string | null;
  antidote_en: string | null;
  recommendations_en: string | null;
  recommendations_hi: string | null;
  recommendations_gu: string | null;
  poison_category: string | null;
  cir_regn_no: string | null;
  notes: string | null;
  is_active: boolean;
}

const CATEGORIES = ['Insecticide', 'Fungicide', 'Herbicide', 'Acaricide', 'Insecticide & Acaricide', 'Bio-pesticide', 'Plant Growth Regulator', 'Other'];

const EMPTY_FORM = {
  name_en: '', name_hi: '', name_gu: '',
  category: '', tagline_en: '',
  composition_en: '', composition_hi: '', composition_gu: '',
  directions_en: '', directions_hi: '', directions_gu: '',
  precautions_en: '', precautions_hi: '', precautions_gu: '',
  first_aid_en: '', first_aid_hi: '', first_aid_gu: '',
  symptoms_en: '', symptoms_hi: '', symptoms_gu: '',
  antidote_en: '', antidote_hi: '', antidote_gu: '',
  recommendations_en: '', recommendations_hi: '', recommendations_gu: '',
  poison_category: '', cir_regn_no: '', notes: '',
};

type FormState = typeof EMPTY_FORM;

interface Ingredient { name: string; percentage: string; unit: string; }

// Collapsible section for the form
function Section({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">{title}</span>
        {open ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
      </button>
      {open && <div className="px-4 py-4 space-y-3">{children}</div>}
    </div>
  );
}

function LangFields({ label, fields }: { label: string; fields: { lang: string; value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }[] }) {
  return (
    <div className="space-y-2">
      {fields.map(f => (
        <div key={f.lang}>
          <label className="text-xs text-gray-500 mb-0.5 block">{f.lang}</label>
          <textarea
            value={f.value}
            onChange={e => f.onChange(e.target.value)}
            rows={f.rows || 3}
            placeholder={f.placeholder || ''}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 resize-y"
          />
        </div>
      ))}
    </div>
  );
}

export default function ProductsManager() {
  const [products, setProducts] = useState<LabelProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [ingredients, setIngredients] = useState<Ingredient[]>([{ name: '', percentage: '', unit: '% w/w' }]);
  const [search, setSearch] = useState('');
  const confirm = useConfirm();

  const fetchProducts = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('label_products')
      .select('*')
      .order('name_en', { ascending: true });
    if (data) setProducts(data);
    setLoading(false);
  };

  useEffect(() => { fetchProducts(); }, []);

  const openAdd = () => {
    setEditId(null);
    setForm(EMPTY_FORM);
    setIngredients([{ name: '', percentage: '', unit: '% w/w' }]);
    setShowForm(true);
  };

  const openEdit = (p: LabelProduct) => {
    setEditId(p.id);
    setForm({
      name_en: p.name_en || '', name_hi: p.name_hi || '', name_gu: p.name_gu || '',
      category: p.category || '', tagline_en: p.tagline_en || '',
      composition_en: p.composition_en || '', composition_hi: '', composition_gu: '',
      directions_en: p.directions_en || '', directions_hi: p.directions_hi || '', directions_gu: p.directions_gu || '',
      precautions_en: p.precautions_en || '', precautions_hi: p.precautions_hi || '', precautions_gu: p.precautions_gu || '',
      first_aid_en: p.first_aid_en || '', first_aid_hi: p.first_aid_hi || '', first_aid_gu: p.first_aid_gu || '',
      symptoms_en: p.symptoms_en || '', symptoms_hi: '', symptoms_gu: '',
      antidote_en: p.antidote_en || '', antidote_hi: '', antidote_gu: '',
      recommendations_en: p.recommendations_en || '', recommendations_hi: p.recommendations_hi || '', recommendations_gu: p.recommendations_gu || '',
      poison_category: p.poison_category || '', cir_regn_no: p.cir_regn_no || '', notes: p.notes || '',
    });
    setIngredients(p.active_ingredients?.length ? p.active_ingredients : [{ name: '', percentage: '', unit: '% w/w' }]);
    setShowForm(true);
  };

  const closeForm = () => { setShowForm(false); setEditId(null); setForm(EMPTY_FORM); };

  const handleSave = async () => {
    if (!form.name_en.trim()) { toast.error('Product name (English) is required'); return; }
    setSaving(true);

    const validIngredients = ingredients.filter(i => i.name.trim());
    const payload = {
      name_en: form.name_en.trim(),
      name_hi: form.name_hi.trim() || null,
      name_gu: form.name_gu.trim() || null,
      category: form.category.trim() || null,
      tagline_en: form.tagline_en.trim() || null,
      active_ingredients: validIngredients.length ? validIngredients : null,
      composition_en: form.composition_en.trim() || null,
      directions_en: form.directions_en.trim() || null,
      directions_hi: form.directions_hi.trim() || null,
      directions_gu: form.directions_gu.trim() || null,
      precautions_en: form.precautions_en.trim() || null,
      precautions_hi: form.precautions_hi.trim() || null,
      precautions_gu: form.precautions_gu.trim() || null,
      first_aid_en: form.first_aid_en.trim() || null,
      first_aid_hi: form.first_aid_hi.trim() || null,
      first_aid_gu: form.first_aid_gu.trim() || null,
      symptoms_en: form.symptoms_en.trim() || null,
      antidote_en: form.antidote_en.trim() || null,
      recommendations_en: form.recommendations_en.trim() || null,
      recommendations_hi: form.recommendations_hi.trim() || null,
      recommendations_gu: form.recommendations_gu.trim() || null,
      poison_category: form.poison_category.trim() || null,
      cir_regn_no: form.cir_regn_no.trim() || null,
      notes: form.notes.trim() || null,
    };

    let error;
    if (editId) {
      ({ error } = await supabase.from('label_products').update(payload).eq('id', editId));
    } else {
      ({ error } = await supabase.from('label_products').insert(payload));
    }

    if (error) toast.error(error.message);
    else { toast.success(editId ? 'Product updated!' : 'Product added!'); closeForm(); fetchProducts(); }
    setSaving(false);
  };

  const handleDelete = async (p: LabelProduct) => {
    const { confirmed } = await confirm({
      title: 'Delete Product',
      message: `Delete "${p.name_en}"? This cannot be undone.`,
      variant: 'danger',
      confirmLabel: 'Delete',
    });
    if (!confirmed) return;
    const { error } = await supabase.from('label_products').delete().eq('id', p.id);
    if (error) toast.error(error.message);
    else { toast.success('Product deleted'); fetchProducts(); }
  };

  const handleToggle = async (p: LabelProduct) => {
    await supabase.from('label_products').update({ is_active: !p.is_active }).eq('id', p.id);
    fetchProducts();
  };

  const set = (field: keyof FormState, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  const filtered = products.filter(p =>
    p.name_en.toLowerCase().includes(search.toLowerCase()) ||
    (p.category || '').toLowerCase().includes(search.toLowerCase())
  );

  const updateIngredient = (i: number, field: keyof Ingredient, value: string) => {
    setIngredients(prev => prev.map((ing, idx) => idx === i ? { ...ing, [field]: value } : ing));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Product Database</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Master list of all products — technical content, composition, safety info stored once and reused.
          </p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-md text-sm font-medium hover:bg-gray-800 transition-colors">
          <Plus className="h-4 w-4" />Add Product
        </button>
      </div>

      {/* Search */}
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products..." className="w-full max-w-sm border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400" />

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-gray-200 rounded-lg">
          <FlaskConical className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">{search ? 'No products match your search.' : 'No products yet. Add your first product above.'}</p>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Product</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Category</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Active Ingredients</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Regulatory</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(p => (
                <tr key={p.id} className={`hover:bg-gray-50 transition-colors ${!p.is_active ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{p.name_en}</p>
                    {(p.name_hi || p.name_gu) && (
                      <p className="text-xs text-muted-foreground">{[p.name_hi, p.name_gu].filter(Boolean).join(' · ')}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {p.category && (
                      <span className="text-xs bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-full font-medium">{p.category}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {p.active_ingredients?.slice(0, 2).map((ai, i) => (
                      <div key={i}>{ai.name} {ai.percentage} {ai.unit}</div>
                    ))}
                    {(p.active_ingredients?.length || 0) > 2 && (
                      <div className="text-gray-400">+{(p.active_ingredients?.length || 0) - 2} more</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {p.cir_regn_no && <div>{p.cir_regn_no}</div>}
                    {p.poison_category && <div className="text-orange-600 font-medium">{p.poison_category}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleToggle(p)} className={`text-xs px-2 py-0.5 rounded-full border font-medium transition-colors ${p.is_active ? 'border-green-200 text-green-700 bg-green-50 hover:bg-green-100' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                      {p.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(p)} className="p-1.5 rounded-md text-muted-foreground hover:text-gray-900 hover:bg-gray-100 transition-colors" title="Edit"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => handleDelete(p)} className="p-1.5 rounded-md text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors" title="Delete"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit Form */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/40" onClick={closeForm} />
          <div className="relative ml-auto w-full max-w-2xl h-full bg-white shadow-2xl flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-base font-semibold text-gray-900">{editId ? 'Edit Product' : 'Add New Product'}</h2>
              <button onClick={closeForm} className="p-1.5 rounded-md hover:bg-gray-100 transition-colors"><X className="h-4 w-4" /></button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

              {/* Identity */}
              <Section title="Product Identity" defaultOpen>
                <div>
                  <label className="text-xs text-gray-500 mb-0.5 block">Product Name — English *</label>
                  <input value={form.name_en} onChange={e => set('name_en', e.target.value)} placeholder="e.g. Emamectin Benzoate 5% SG" className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-500 mb-0.5 block">Hindi Name</label>
                    <input value={form.name_hi} onChange={e => set('name_hi', e.target.value)} placeholder="हिंदी नाम" className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-0.5 block">Gujarati Name</label>
                    <input value={form.name_gu} onChange={e => set('name_gu', e.target.value)} placeholder="ગુજરાતી નામ" className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-500 mb-0.5 block">Category</label>
                    <select value={form.category} onChange={e => set('category', e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400">
                      <option value="">Select category...</option>
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-0.5 block">Tagline</label>
                    <input value={form.tagline_en} onChange={e => set('tagline_en', e.target.value)} placeholder="e.g. Insecticide" className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400" />
                  </div>
                </div>
              </Section>

              {/* Active Ingredients */}
              <Section title="Active Ingredients / Composition" defaultOpen>
                <div className="space-y-2">
                  {ingredients.map((ing, i) => (
                    <div key={i} className="flex gap-2 items-start">
                      <input value={ing.name} onChange={e => updateIngredient(i, 'name', e.target.value)} placeholder="Ingredient name" className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400" />
                      <input value={ing.percentage} onChange={e => updateIngredient(i, 'percentage', e.target.value)} placeholder="5.00" className="w-20 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400" />
                      <input value={ing.unit} onChange={e => updateIngredient(i, 'unit', e.target.value)} placeholder="% w/w" className="w-20 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400" />
                      {ingredients.length > 1 && (
                        <button onClick={() => setIngredients(prev => prev.filter((_, idx) => idx !== i))} className="p-2 text-muted-foreground hover:text-red-600 transition-colors"><X className="h-4 w-4" /></button>
                      )}
                    </div>
                  ))}
                  <button onClick={() => setIngredients(prev => [...prev, { name: '', percentage: '', unit: '% w/w' }])} className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors">
                    <Plus className="h-3.5 w-3.5" />Add ingredient
                  </button>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-0.5 block">Full composition text (English)</label>
                  <textarea value={form.composition_en} onChange={e => set('composition_en', e.target.value)} rows={3} placeholder="Full chemical composition as it appears on the label..." className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 resize-y" />
                </div>
              </Section>

              {/* Directions */}
              <Section title="Directions of Use">
                <LangFields label="Directions" fields={[
                  { lang: 'English', value: form.directions_en, onChange: v => set('directions_en', v), placeholder: 'How to use the product...' },
                  { lang: 'Hindi', value: form.directions_hi, onChange: v => set('directions_hi', v), placeholder: 'उपयोग की विधि...' },
                  { lang: 'Gujarati', value: form.directions_gu, onChange: v => set('directions_gu', v), placeholder: 'ઉપયોગ કઈ રીતે કરવો...' },
                ]} />
              </Section>

              {/* Safety */}
              <Section title="Safety — Precautions, First Aid, Symptoms">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Precautions</label>
                  <LangFields label="" fields={[
                    { lang: 'English', value: form.precautions_en, onChange: v => set('precautions_en', v), rows: 3 },
                    { lang: 'Hindi', value: form.precautions_hi, onChange: v => set('precautions_hi', v), rows: 2 },
                    { lang: 'Gujarati', value: form.precautions_gu, onChange: v => set('precautions_gu', v), rows: 2 },
                  ]} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">First Aid</label>
                  <LangFields label="" fields={[
                    { lang: 'English', value: form.first_aid_en, onChange: v => set('first_aid_en', v), rows: 3 },
                    { lang: 'Hindi', value: form.first_aid_hi, onChange: v => set('first_aid_hi', v), rows: 2 },
                    { lang: 'Gujarati', value: form.first_aid_gu, onChange: v => set('first_aid_gu', v), rows: 2 },
                  ]} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Symptoms of Poisoning (English)</label>
                  <textarea value={form.symptoms_en} onChange={e => set('symptoms_en', e.target.value)} rows={2} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 resize-y" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Antidote (English)</label>
                  <textarea value={form.antidote_en} onChange={e => set('antidote_en', e.target.value)} rows={2} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 resize-y" />
                </div>
              </Section>

              {/* Recommendations */}
              <Section title="Crop Recommendations">
                <LangFields label="Recommendations" fields={[
                  { lang: 'English', value: form.recommendations_en, onChange: v => set('recommendations_en', v), placeholder: 'Recommended for cotton, fruit borer on okra...' },
                  { lang: 'Hindi', value: form.recommendations_hi, onChange: v => set('recommendations_hi', v), rows: 2 },
                  { lang: 'Gujarati', value: form.recommendations_gu, onChange: v => set('recommendations_gu', v), rows: 2 },
                ]} />
              </Section>

              {/* Regulatory */}
              <Section title="Regulatory">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-500 mb-0.5 block">CIR / Regn. No.</label>
                    <input value={form.cir_regn_no} onChange={e => set('cir_regn_no', e.target.value)} placeholder="CIR-XXXX/XXXX-..." className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-0.5 block">Poison Category</label>
                    <input value={form.poison_category} onChange={e => set('poison_category', e.target.value)} placeholder="e.g. जहर POISON" className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400" />
                  </div>
                </div>
              </Section>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1">Notes</label>
                <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 resize-none" />
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-gray-200 px-6 py-4 flex items-center justify-end gap-3 bg-gray-50">
              <button onClick={closeForm} className="px-4 py-2 rounded-md text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-5 py-2 bg-gray-900 text-white rounded-md text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {editId ? 'Save Changes' : 'Add Product'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
