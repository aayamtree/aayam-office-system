'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus, X, Loader2, ShoppingBag, CheckCircle, Clock, AlertCircle, IndianRupee } from 'lucide-react';
import { useCMYKPaperPurchases, usePaperStock, useVendors } from '@/lib/hooks';
import { useAuth } from '@/lib/auth-context';
import { useConfirm } from '@/components/ConfirmModal';
import { toast } from '@/lib/toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

const today = () => new Date().toISOString().split('T')[0];

export default function PaperPurchasesPage() {
  const { profile } = useAuth();
  const { purchases, loading, recordPurchase, updatePayment } = useCMYKPaperPurchases();
  const { stock } = usePaperStock();
  const { vendors } = useVendors();
  const confirm = useConfirm();

  const [showModal, setShowModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [payAmount, setPayAmount] = useState('');

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

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Paper / Item *</label>
                <select required value={form.paper_stock_id} onChange={e => setForm({ ...form, paper_stock_id: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring">
                  <option value="">Select paper from stock...</option>
                  {stock.map(p => <option key={p.id} value={p.id}>{p.name}{p.size ? ` (${p.size})` : ''} — current: {p.quantity} {p.unit}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Quantity ({selectedPaper?.unit || 'units'}) *</label>
                  <input type="number" required min="1" placeholder="500" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Rate (₹/unit) *</label>
                  <input type="number" required min="0" step="0.01" placeholder="15.00" value={form.rate} onChange={e => setForm({ ...form, rate: e.target.value })}
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
                  {selectedPaper && <p className="text-muted-foreground pt-1">Stock after purchase: {selectedPaper.quantity + parseInt(form.quantity || '0')} {selectedPaper.unit}</p>}
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
                  value={payAmount} onChange={e => setPayAmount(e.target.value)}
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
