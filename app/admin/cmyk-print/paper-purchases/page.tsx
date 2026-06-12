'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus, X, Loader2, ShoppingBag, CheckCircle, AlertCircle, ChevronDown } from 'lucide-react';
import { useCMYKPaperPurchases, usePaperStock, useVendors } from '@/lib/hooks';
import { useAuth } from '@/lib/auth-context';
import { toast } from '@/lib/toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

const PAPER_CATEGORIES = ['Sticker','Opaque','Texture','Standard','Photo Paper','Matt','Glossy','Lamination Film','Card Stock','Craft Paper','Other'];
const SIZE_PRESETS = [
  { label: '13×19"', value: '13×19' }, { label: '12×18"', value: '12×18' },
  { label: '12×36"', value: '12×36' }, { label: '19×25"', value: '19×25' },
  { label: 'A4', value: 'A4' }, { label: 'A3', value: 'A3' }, { label: 'Custom', value: 'custom' },
];

const today = () => new Date().toISOString().split('T')[0];

export default function PaperPurchasesPage() {
  const { profile } = useAuth();
  const { purchases, loading, recordPurchase, updatePayment } = useCMYKPaperPurchases();
  const { stock, createStockItem, refetch: refetchStock } = usePaperStock();
  const { vendors } = useVendors();

  const [showModal, setShowModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [payAmount, setPayAmount] = useState('');

  // New paper inline creation state
  const [addingNewPaper, setAddingNewPaper] = useState(false);
  const [newPaper, setNewPaper] = useState({ name: '', category: '', size: '', customSize: '', gsm: '' });

  const [form, setForm] = useState({
    purchase_date: today(),
    vendor_id: '',
    paper_stock_id: '',
    quantity: '',
    rate: '',
    gst_percent: '0',
    invoice_number: '',
    notes: '',
  });

  // Handle creating a new paper type inline, then auto-select it
  const handleCreateNewPaper = async () => {
    if (!newPaper.name.trim()) { toast.error('Enter paper name'); return; }
    setSubmitting(true);
    try {
      const finalSize = newPaper.size === 'custom' ? newPaper.customSize : newPaper.size;
      const result = await createStockItem({
        name: newPaper.name.trim(),
        category: newPaper.category || undefined,
        size: finalSize || undefined,
        gsm: newPaper.gsm ? parseInt(newPaper.gsm) : undefined,
        quantity: 0,
        reorder_level: 100,
        unit: 'sheets',
        cost_per_unit: parseFloat(form.rate || '0') || 0,
        supplier: undefined,
      } as any);
      if (result.error) { toast.error('Failed to create paper: ' + result.error); return; }
      await refetchStock();
      // Auto-select the new paper
      setForm(f => ({ ...f, paper_stock_id: result.data?.id || '' }));
      setAddingNewPaper(false);
      setNewPaper({ name: '', category: '', size: '', customSize: '', gsm: '' });
      toast.success(`"${newPaper.name}" added — now select it and complete the purchase`);
    } catch { toast.error('Unexpected error'); }
    finally { setSubmitting(false); }
  };

  const selectedPaper = stock.find(p => p.id === form.paper_stock_id);
  const subtotal = (parseFloat(form.quantity || '0') * parseFloat(form.rate || '0'));
  const gstAmt = subtotal * parseFloat(form.gst_percent || '0') / 100;
  const grandTotal = subtotal + gstAmt;

  const formatCurrency = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

  const totalPending = purchases.filter(p => p.payment_status !== 'paid').reduce((s, p) => s + (p.grand_total - p.amount_paid), 0);
  const totalPaid = purchases.filter(p => p.payment_status === 'paid').reduce((s, p) => s + p.grand_total, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.paper_stock_id || !form.quantity || !form.rate) { toast.error('Fill in paper, quantity and rate'); return; }
    setSubmitting(true);
    try {
      const selectedVendor = vendors?.find(v => v.id === form.vendor_id);
      const result = await recordPurchase({
        purchase_date: form.purchase_date,
        vendor_id: form.vendor_id || undefined,
        vendor_name: selectedVendor?.name || form.vendor_id || undefined,
        paper_stock_id: form.paper_stock_id,
        quantity: parseInt(form.quantity),
        rate: parseFloat(form.rate),
        gst_percent: parseFloat(form.gst_percent || '0'),
        invoice_number: form.invoice_number || undefined,
        notes: form.notes || undefined,
        created_by: profile?.id,
      });
      if (result.error) { toast.error('Failed: ' + result.error); return; }
      toast.success(`Purchase recorded — ${form.quantity} ${selectedPaper?.unit || 'units'} of ${selectedPaper?.name} added to stock`);
      setShowModal(false);
      setForm({ purchase_date: today(), vendor_id: '', paper_stock_id: '', quantity: '', rate: '', gst_percent: '0', invoice_number: '', notes: '' });
    } catch { toast.error('Unexpected error'); }
    finally { setSubmitting(false); }
  };

  const handlePayment = async () => {
    if (!selectedPurchase || !payAmount) return;
    setSubmitting(true);
    try {
      const newPaid = selectedPurchase.amount_paid + parseFloat(payAmount);
      await updatePayment(selectedPurchase.id, Math.min(newPaid, selectedPurchase.grand_total), selectedPurchase.grand_total);
      toast.success('Payment recorded');
      setShowPayModal(false);
      setPayAmount('');
    } catch { toast.error('Failed to record payment'); }
    finally { setSubmitting(false); }
  };

  const statusBadge = (p: any) => {
    if (p.payment_status === 'paid') return <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">Paid</Badge>;
    if (p.payment_status === 'partial') return <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs">Partial</Badge>;
    return <Badge className="bg-red-100 text-red-700 border-red-200 text-xs">Pending</Badge>;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <Link href="/admin/cmyk-print" className="p-2 hover:bg-muted rounded-md border border-border">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Paper Purchases</h1>
            <p className="text-sm text-muted-foreground">Buy paper & consumables from suppliers</p>
          </div>
        </div>
        <Button onClick={() => setShowModal(true)} size="sm">
          <Plus className="w-4 h-4 mr-1" /> Record Purchase
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Supplier Dues</CardTitle>
            <AlertCircle className="w-4 h-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{formatCurrency(totalPending)}</div>
            <p className="text-xs text-muted-foreground mt-1">Outstanding</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Total Purchases</CardTitle>
            <ShoppingBag className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{purchases.length}</div>
            <p className="text-xs text-muted-foreground mt-1">All time</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Total Paid</CardTitle>
            <CheckCircle className="w-4 h-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700">{formatCurrency(totalPaid)}</div>
            <p className="text-xs text-muted-foreground mt-1">To suppliers</p>
          </CardContent>
        </Card>
      </div>

      {/* Purchase List */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading...
            </div>
          ) : purchases.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ShoppingBag className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No purchases yet.</p>
              <Button variant="ghost" size="sm" className="mt-2" onClick={() => setShowModal(true)}>Record first purchase</Button>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {purchases.map(p => (
                <div key={p.id} className="p-4 hover:bg-muted/30 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold">{p.paper_name}</span>
                        {statusBadge(p)}
                        {p.invoice_number && <span className="text-xs text-muted-foreground">#{p.invoice_number}</span>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {p.vendor_name || 'Unknown supplier'} · {new Date(p.purchase_date + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {p.quantity} {p.unit} × ₹{p.rate} = {formatCurrency(p.total_amount)}
                        {p.gst_amount > 0 && ` + GST ₹${p.gst_amount.toFixed(0)}`}
                      </p>
                      {p.payment_status === 'partial' && (
                        <p className="text-xs text-amber-600 mt-0.5">Paid: {formatCurrency(p.amount_paid)} · Due: {formatCurrency(p.grand_total - p.amount_paid)}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className="text-sm font-bold">{formatCurrency(p.grand_total)}</span>
                      {p.payment_status !== 'paid' && (
                        <Button size="sm" variant="outline" className="h-7 text-xs"
                          onClick={() => { setSelectedPurchase(p); setPayAmount(''); setShowPayModal(true); }}>
                          Pay
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Purchase Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-md w-full max-w-md border border-border shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="text-sm font-semibold">Record Paper Purchase</h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 hover:bg-muted rounded-md"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Purchase Date *</label>
                  <input type="date" required value={form.purchase_date} onChange={e => setForm({ ...form, purchase_date: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Invoice No.</label>
                  <input type="text" placeholder="INV-001" value={form.invoice_number} onChange={e => setForm({ ...form, invoice_number: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Supplier (Vendor)</label>
                <select value={form.vendor_id} onChange={e => setForm({ ...form, vendor_id: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring">
                  <option value="">Select supplier...</option>
                  {(vendors || []).map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>

              {/* Paper selector with inline new paper creation */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-muted-foreground">Paper / Item *</label>
                  <button type="button" onClick={() => setAddingNewPaper(!addingNewPaper)}
                    className="text-xs text-primary font-medium hover:underline flex items-center gap-1">
                    <Plus className="w-3 h-3" /> {addingNewPaper ? 'Cancel new' : 'New paper type'}
                  </button>
                </div>

                {/* Existing paper dropdown */}
                {!addingNewPaper && (
                  <>
                    {stock.length === 0 ? (
                      <div className="px-3 py-3 border border-dashed border-border rounded-md text-xs text-muted-foreground text-center">
                        No paper types yet. Click <strong>&ldquo;New paper type&rdquo;</strong> above to add one first.
                      </div>
                    ) : (
                      <select value={form.paper_stock_id} onChange={e => setForm({ ...form, paper_stock_id: e.target.value })}
                        className="w-full px-3 py-2 border border-border rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring">
                        <option value="">Select paper...</option>
                        {stock.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.name}{p.category ? ` [${p.category}]` : ''}{p.size ? ` (${p.size})` : ''}{p.gsm ? ` ${p.gsm}gsm` : ''} — {p.quantity} sheets
                          </option>
                        ))}
                      </select>
                    )}
                  </>
                )}

                {/* Inline new paper creation */}
                {addingNewPaper && (
                  <div className="border border-primary/30 bg-primary/5 rounded-md p-3 space-y-3">
                    <p className="text-xs font-semibold text-primary">Add New Paper Type</p>
                    <input type="text" placeholder="Paper name e.g. Glossy Sticker Paper" value={newPaper.name}
                      onChange={e => setNewPaper({ ...newPaper, name: e.target.value })}
                      className="w-full px-3 py-2 border border-border rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Category</p>
                      <div className="flex flex-wrap gap-1.5">
                        {PAPER_CATEGORIES.map(cat => (
                          <button key={cat} type="button" onClick={() => setNewPaper({ ...newPaper, category: newPaper.category === cat ? '' : cat })}
                            className={`px-2 py-1 rounded text-xs font-medium border transition-all
                              ${newPaper.category === cat ? 'bg-gray-900 text-white border-gray-900' : 'border-border text-muted-foreground hover:bg-muted'}`}>
                            {cat}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Size</p>
                      <div className="flex flex-wrap gap-1.5">
                        {SIZE_PRESETS.map(s => (
                          <button key={s.value} type="button" onClick={() => setNewPaper({ ...newPaper, size: s.value })}
                            className={`px-2 py-1 rounded text-xs font-medium border transition-all
                              ${newPaper.size === s.value ? 'bg-gray-900 text-white border-gray-900' : 'border-border text-muted-foreground hover:bg-muted'}`}>
                            {s.label}
                          </button>
                        ))}
                      </div>
                      {newPaper.size === 'custom' && (
                        <input type="text" placeholder='e.g. 14×20"' value={newPaper.customSize}
                          onChange={e => setNewPaper({ ...newPaper, customSize: e.target.value })}
                          className="mt-2 w-full px-3 py-2 border border-border rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
                      )}
                    </div>
                    <div className="flex gap-2 items-end">
                      <div className="flex-1">
                        <p className="text-xs text-muted-foreground mb-1">GSM</p>
                        <input type="number" placeholder="e.g. 320" value={newPaper.gsm}
                          onChange={e => setNewPaper({ ...newPaper, gsm: e.target.value })}
                          className="w-full px-3 py-2 border border-border rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
                      </div>
                      <button type="button" disabled={submitting || !newPaper.name.trim()} onClick={handleCreateNewPaper}
                        className="px-4 py-2 bg-gray-900 text-white rounded-md text-sm font-semibold disabled:opacity-50 flex items-center gap-1 whitespace-nowrap">
                        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                        Add &amp; Select
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Quantity (sheets) *</label>
                  <input type="number" required min="1" placeholder="500" value={form.quantity || ''} onChange={e => setForm({ ...form, quantity: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Rate (₹/unit) *</label>
                  <input type="number" required min="0" step="0.01" placeholder="15.00" value={form.rate || ''} onChange={e => setForm({ ...form, rate: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">GST %</label>
                <div className="flex gap-2">
                  {['0', '5', '12', '18'].map(g => (
                    <button key={g} type="button" onClick={() => setForm({ ...form, gst_percent: g })}
                      className={`flex-1 py-1.5 rounded-md border text-xs font-medium ${form.gst_percent === g ? 'bg-foreground text-background border-foreground' : 'border-border hover:bg-muted'}`}>
                      {g}%
                    </button>
                  ))}
                </div>
              </div>

              {/* Live calculation */}
              {subtotal > 0 && (
                <div className="bg-muted rounded-md p-3 space-y-1 text-xs">
                  <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
                  {gstAmt > 0 && <div className="flex justify-between"><span className="text-muted-foreground">GST ({form.gst_percent}%)</span><span>{formatCurrency(gstAmt)}</span></div>}
                  <div className="flex justify-between font-semibold border-t border-border pt-1 mt-1"><span>Grand Total</span><span>{formatCurrency(grandTotal)}</span></div>
                  {selectedPaper && <p className="text-muted-foreground pt-1">Stock after purchase: <strong className="text-foreground">{selectedPaper.quantity + parseInt(form.quantity || '0')} sheets</strong></p>}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Notes</label>
                <input type="text" placeholder="Any notes..." value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>

              <div className="flex gap-3 pt-1">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowModal(false)}>Cancel</Button>
                <Button type="submit" className="flex-1" disabled={submitting}>
                  {submitting && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                  Record Purchase
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pay Supplier Modal */}
      {showPayModal && selectedPurchase && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-md w-full max-w-sm border border-border shadow-xl">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="text-sm font-semibold">Record Payment</h2>
              <button onClick={() => setShowPayModal(false)} className="p-1.5 hover:bg-muted rounded-md"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-4 space-y-4">
              <div className="bg-muted rounded-md p-3 text-xs space-y-1">
                <p className="font-medium">{selectedPurchase.paper_name}</p>
                <p className="text-muted-foreground">{selectedPurchase.vendor_name}</p>
                <p>Total: {formatCurrency(selectedPurchase.grand_total)} · Paid: {formatCurrency(selectedPurchase.amount_paid)}</p>
                <p className="font-semibold text-destructive">Balance: {formatCurrency(selectedPurchase.grand_total - selectedPurchase.amount_paid)}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Amount Paying Now (₹)</label>
                <input type="number" min="1" max={selectedPurchase.grand_total - selectedPurchase.amount_paid}
                  placeholder={String(selectedPurchase.grand_total - selectedPurchase.amount_paid)}
                  value={payAmount || ''} onChange={e => setPayAmount(e.target.value)}
                  className="w-full px-3 py-2.5 border border-border rounded-md text-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setShowPayModal(false)}>Cancel</Button>
                <Button className="flex-1" disabled={submitting || !payAmount} onClick={handlePayment}>
                  {submitting && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                  Record Payment
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
