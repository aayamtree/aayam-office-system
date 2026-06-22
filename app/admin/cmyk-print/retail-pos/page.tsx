'use client';

import { useState } from 'react';
import { toast } from '@/lib/toast';
import Link from 'next/link';
import {
  ArrowLeft, Plus, Minus, Trash2, ShoppingCart,
  Printer, CreditCard, Banknote, Smartphone, X, Search, Settings,
  Edit, Loader2, Download, Package, Clock, ChevronDown
} from 'lucide-react';
import { ReceiptData, printReceipt, downloadReceipt } from '@/components/receipt/ReceiptPDF';
import { useCompanySettings } from '@/lib/hooks/useCompanySettings';
import { usePOSSales, usePOSProducts, usePaperStock, useClients } from '@/lib/hooks';
import { useAuth } from '@/lib/auth-context';
import { POSProduct } from '@/types/database';
import { Input } from '@/components/ui/input';
import { useConfirm } from '@/components/ConfirmModal';

interface CartItem {
  id: string;
  name: string;
  price: number;
  qty: number;
  total: number;
}

const categoryColors = [
  'bg-muted text-foreground',
  'bg-gray-900 text-white',
  'bg-gray-100 text-gray-900',
  'bg-amber-100 text-amber-700',
  'bg-pink-100 text-pink-700',
  'bg-cyan-100 text-cyan-700',
  'bg-red-100 text-red-700',
  'bg-orange-100 text-orange-700',
  'bg-teal-100 text-teal-700',
  'bg-lime-100 text-lime-700',
  'bg-rose-100 text-rose-700',
  'bg-purple-100 text-purple-700',
];

export default function RetailPOSPage() {
  const { profile } = useAuth();
  const { settings: companySettings } = useCompanySettings();
  const { createPOSSale } = usePOSSales();
  const { stock: paperStock } = usePaperStock();
  const { clients } = useClients();
  const {
    categories, products, loading: productsLoading,
    createCategory, updateCategory, deleteCategory,
    createProduct, updateProduct, deleteProduct
  } = usePOSProducts();

  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'upi'>('cash');
  const [amountReceived, setAmountReceived] = useState('');
  const [discount, setDiscount] = useState(0);

  // GST (retail counter is always GST-billed), order type & artwork
  const [gstRate, setGstRate] = useState(18);
  const [gstin, setGstin] = useState('');
  const [orderType, setOrderType] = useState<'walkin' | 'pickup'>('walkin');
  const [artworkLink, setArtworkLink] = useState('');

  // Paper rows (multiple papers/sizes per bill) & Credit fields
  const [paperRows, setPaperRows] = useState<{ paperStockId: string; sheets: string }[]>([{ paperStockId: '', sheets: '' }]);
  const updatePaperRow = (i: number, field: 'paperStockId' | 'sheets', val: string) =>
    setPaperRows(rows => rows.map((r, idx) => idx === i ? { ...r, [field]: val } : r));
  const addPaperRow = () => setPaperRows(rows => [...rows, { paperStockId: '', sheets: '' }]);
  const removePaperRow = (i: number) => setPaperRows(rows => rows.length > 1 ? rows.filter((_, idx) => idx !== i) : rows);
  const [paymentType, setPaymentType] = useState<'paid' | 'advance' | 'credit'>('paid');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [creditDays, setCreditDays] = useState('30');
  const [notes, setNotes] = useState('');

  // Settings Modal State
  const [activeTab, setActiveTab] = useState<'products' | 'categories'>('products');
  const [isEditingProduct, setIsEditingProduct] = useState(false);
  const [productForm, setProductForm] = useState({ id: '', name: '', price: 0, category_id: '' });
  const [categoryForm, setCategoryForm] = useState({ id: '', name: '', color: categoryColors[0] });
  const confirm = useConfirm();

  const filteredProducts = products?.filter(p => {
    const matchesCategory = selectedCategory === 'all' || p.category_id === selectedCategory;
    const matchesSearch = (p.name || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  }) || [];

  const addToCart = (product: POSProduct) => {
    const existing = cart.find(item => item.id === product.id);
    if (existing) {
      setCart(cart.map(item =>
        item.id === product.id
          ? { ...item, qty: item.qty + 1, total: (item.qty + 1) * item.price }
          : item
      ));
    } else {
      setCart([...cart, { id: product.id, name: product.name, price: product.price, qty: 1, total: product.price }]);
    }
  };

  const updateQty = (id: string, delta: number) => {
    setCart(cart.map(item => {
      if (item.id === id) {
        const newQty = Math.max(1, item.qty + delta);
        return { ...item, qty: newQty, total: newQty * item.price };
      }
      return item;
    }));
  };

  const removeFromCart = (id: string) => setCart(cart.filter(item => item.id !== id));

  const subtotal = cart.reduce((sum, item) => sum + item.total, 0);
  const discountAmount = (subtotal * discount) / 100;
  const taxableAmount = subtotal - discountAmount;
  const gstAmount = (taxableAmount * gstRate) / 100;
  const cgstAmount = gstAmount / 2;
  const sgstAmount = gstAmount / 2;
  const grandTotal = taxableAmount + gstAmount;

  // Payment calculation
  const receivedAmt = parseFloat(amountReceived || '0');
  const changeAmount = paymentMethod === 'cash' ? receivedAmt - grandTotal : 0;

  // Paper rows → structured list (filters out blank rows)
  const paperList = paperRows
    .filter(r => r.paperStockId && r.sheets && parseInt(r.sheets) > 0)
    .map(r => {
      const p = paperStock.find(x => x.id === r.paperStockId);
      const sheets = parseInt(r.sheets) || 0;
      return { paper_stock_id: r.paperStockId, paper_name: p?.name, size: p?.size, sheets, cost: (p?.cost_per_unit || 0) * sheets };
    });

  // Credit logic
  const selectedClient = clients?.find(c => c.id === selectedClientId);

  const getDueDate = () => {
    if (paymentType !== 'credit') return undefined;
    const d = new Date();
    d.setDate(d.getDate() + parseInt(creditDays || '30'));
    return d.toISOString().split('T')[0];
  };

  const getPaymentStatus = (): 'paid' | 'pending' | 'partial' => {
    if (paymentType === 'credit') return 'pending';
    if (paymentType === 'advance') return 'partial';
    return 'paid';
  };

  const getBalanceDue = () => {
    if (paymentType === 'paid') return 0;
    if (paymentType === 'credit') return grandTotal;
    if (paymentType === 'advance') return Math.max(0, grandTotal - (parseFloat(amountReceived || '0')));
    return 0;
  };

  // CRUD Handlers
  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (categoryForm.id) {
      await updateCategory(categoryForm.id, { name: categoryForm.name, color: categoryForm.color });
    } else {
      await createCategory({ name: categoryForm.name, color: categoryForm.color, sort_order: (categories?.length || 0) + 1, is_active: true });
    }
    setCategoryForm({ id: '', name: '', color: categoryColors[0] });
  };

  const handleDeleteCategoryReq = async (id: string) => {
    const { confirmed } = await confirm({ title: 'Delete Category', message: 'Delete this category? Products in it may be affected.', variant: 'danger', confirmLabel: 'Delete' });
    if (confirmed) await deleteCategory(id);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (productForm.id) {
      await updateProduct(productForm.id, { name: productForm.name, price: productForm.price, category_id: productForm.category_id });
    } else {
      await createProduct({ name: productForm.name, price: productForm.price, category_id: productForm.category_id, is_active: true });
    }
    setProductForm({ id: '', name: '', price: 0, category_id: '' });
    setIsEditingProduct(false);
  };

  const handleDeleteProductReq = async (id: string) => {
    const { confirmed } = await confirm({ title: 'Delete Product', message: 'Delete this product?', variant: 'danger', confirmLabel: 'Delete' });
    if (confirmed) await deleteProduct(id);
  };

  const clearCart = () => {
    setCart([]);
    setCustomerName('');
    setCustomerPhone('');
    setDiscount(0);
    setGstin('');
    setOrderType('walkin');
    setArtworkLink('');
    setAmountReceived('');
    setPaperRows([{ paperStockId: '', sheets: '' }]);
    setPaymentType('paid');
    setSelectedClientId('');
    setCreditDays('30');
    setNotes('');
    setShowPaymentModal(false);
  };

  const [isProcessing, setIsProcessing] = useState(false);

  const saveSale = async () => {
    setIsProcessing(true);
    try {
      const paidAmount = paymentType === 'credit' ? 0 : paymentType === 'advance' ? parseFloat(amountReceived || '0') : (parseFloat(amountReceived || '0') || grandTotal);
      const saleData = {
        customer_name: customerName || undefined,
        customer_phone: customerPhone || undefined,
        client_id: selectedClientId || undefined,
        subtotal,
        discount_percent: discount,
        discount_amount: discountAmount,
        gst_rate: gstRate,
        gst_amount: gstAmount,
        cgst_amount: cgstAmount,
        sgst_amount: sgstAmount,
        gstin: gstin || undefined,
        order_type: orderType,
        pickup_status: orderType === 'pickup' ? 'pending' : undefined,
        artwork_link: artworkLink || undefined,
        total_amount: grandTotal,
        payment_mode: paymentMethod,
        amount_received: paidAmount,
        change_amount: changeAmount > 0 ? changeAmount : 0,
        payment_status: getPaymentStatus(),
        due_date: getDueDate(),
        balance_due: getBalanceDue(),
        credit_terms: paymentType === 'credit' ? `${creditDays} days` : undefined,
        paper_stock_id: paperList[0]?.paper_stock_id || undefined,
        sheets_used: paperList.reduce((sum, p) => sum + p.sheets, 0),
        papers: paperList.length > 0 ? paperList : undefined,
        notes: notes || undefined,
        sold_by: profile?.full_name || profile?.email?.split('@')[0] || 'CMYK',
      };

      const saleItems = cart.map(item => ({
        product_id: item.id,
        product_name: item.name,
        quantity: item.qty,
        price: item.price,
        total: item.total,
      }));

      const result = await createPOSSale(saleData as any, saleItems);
      if (result.error) {
        toast.error('Failed to save sale: ' + result.error);
        return null;
      }
      return result.data?.sale_number;
    } catch (e) {
      toast.error('Unexpected error during sale processing.');
      return null;
    }
  };

  const buildReceiptData = (saleNumber: string): ReceiptData => {
    const now = new Date();
    return {
      companyName: companySettings.companyName,
      companyAddress: `${companySettings.companyAddress}, ${companySettings.companyCity} ${companySettings.companyPincode}`,
      companyPhone: companySettings.companyPhone,
      receiptNumber: saleNumber,
      date: now.toLocaleDateString('en-IN'),
      time: now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      customerName: customerName || selectedClient?.company || selectedClient?.name || undefined,
      customerPhone: customerPhone || undefined,
      items: cart.map(item => ({ name: item.name, qty: item.qty, price: item.price, total: item.total })),
      subtotal,
      discountPercent: discount,
      discountAmount,
      gstRate,
      cgstAmount,
      sgstAmount,
      gstin: gstin || undefined,
      grandTotal,
      paymentMode: paymentMethod,
      amountReceived: parseFloat(amountReceived || '0') || grandTotal,
      change: changeAmount > 0 ? changeAmount : 0,
      cashier: profile?.full_name || profile?.email?.split('@')[0] || 'CMYK',
    };
  };

  const handlePrint = async () => {
    const saleNumber = await saveSale();
    if (!saleNumber) { setIsProcessing(false); return; }
    try {
      await printReceipt(buildReceiptData(saleNumber));
      clearCart();
    } catch {
      toast.error('Error printing receipt.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadReceipt = async () => {
    const saleNumber = await saveSale();
    if (!saleNumber) { setIsProcessing(false); return; }
    try {
      await downloadReceipt(buildReceiptData(saleNumber));
      clearCart();
    } catch {
      toast.error('Error downloading receipt.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCompleteWithoutReceipt = async () => {
    const saleNumber = await saveSale();
    if (saleNumber) {
      toast.success(`Sale ${saleNumber} recorded`);
      clearCart();
    }
    setIsProcessing(false);
  };

  const formatCurrency = (amount: number) => `₹${amount.toLocaleString('en-IN')}`;

  return (
    <div className="h-[calc(100vh-80px)] flex flex-col">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin/cmyk-print" className="p-2 hover:bg-gray-100 rounded-md">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-page-title text-gray-900">Retail POS</h1>
            <p className="text-sm text-gray-500">Quick billing system</p>
          </div>
        </div>
        <button onClick={() => setShowSettingsModal(true)}
          className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors">
          <Settings className="w-4 h-4" />
          <span className="hidden sm:inline">Manage Items</span>
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Products Section */}
        <div className="flex-1 flex flex-col p-4 overflow-hidden">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input type="text" placeholder="Search products..." value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
          </div>
          <div className="flex flex-wrap gap-2 mb-4">
            <button onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${selectedCategory === 'all' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
              All
            </button>
            {categories?.map(cat => (
              <button key={cat.id} onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${selectedCategory === cat.id ? 'bg-gray-900 text-white' : `${cat.color} hover:opacity-80`}`}>
                {cat.name}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto">
            {productsLoading ? (
              <div className="flex items-center justify-center h-full text-gray-500">
                <Loader2 className="animate-spin mr-2" /> Loading products...
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <p>No products found.</p>
                <button onClick={() => setShowSettingsModal(true)} className="mt-2 text-primary font-medium">Add Products</button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {filteredProducts.map(product => (
                  <button key={product.id} onClick={() => addToCart(product)}
                    className="p-3 bg-white border rounded-md hover:border-primary/30 transition-all text-left flex flex-col justify-between h-full">
                    <div>
                      <p className="font-medium text-gray-900 text-sm line-clamp-2">{product.name}</p>
                      <p className="text-xs text-gray-500 mt-1">{product.category?.name}</p>
                    </div>
                    <p className="text-primary font-bold mt-2">{formatCurrency(product.price)}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Cart Section */}
        <div className="w-full lg:w-[420px] shrink-0 border-t lg:border-t-0 lg:border-l bg-gray-50 flex flex-col lg:overflow-y-auto">
          <div className="p-4 border-b bg-white">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-primary" />
                <span className="font-semibold">Cart ({cart.length})</span>
              </div>
              {cart.length > 0 && (
                <button onClick={clearCart} className="text-red-600 text-sm hover:underline">Clear</button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input type="text" placeholder="Customer Name" value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
              <input type="tel" placeholder="Phone" value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
            </div>

            {/* GSTIN + Artwork link */}
            <div className="mt-2 grid grid-cols-2 gap-2">
              <input type="text" placeholder="GSTIN (optional)" value={gstin}
                onChange={(e) => setGstin(e.target.value.toUpperCase())}
                className="px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
              <input type="text" placeholder="Artwork link / note" value={artworkLink}
                onChange={(e) => setArtworkLink(e.target.value)}
                className="px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
            </div>

            {/* Order type: walk-in vs later pickup */}
            <div className="mt-2 grid grid-cols-2 gap-2 bg-gray-100 p-1 rounded-md">
              {[
                { id: 'walkin', label: 'Instant Walk-in' },
                { id: 'pickup', label: 'Later Pickup' },
              ].map(ot => (
                <button key={ot.id} type="button" onClick={() => setOrderType(ot.id as 'walkin' | 'pickup')}
                  className={`py-1.5 rounded-md text-sm font-medium transition-colors ${orderType === ot.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                  {ot.label}
                </button>
              ))}
            </div>

            {/* Paper used — multiple papers / sizes per bill */}
            <div className="mt-3">
              <p className="text-xs font-medium text-gray-500 mb-1">Paper used (optional)</p>
              <div className="space-y-2">
                {paperRows.map((row, i) => {
                  const p = paperStock.find(x => x.id === row.paperStockId);
                  const over = !!(p && row.sheets && parseInt(row.sheets) > p.quantity);
                  return (
                    <div key={i}>
                      <div className="flex gap-2">
                        <select value={row.paperStockId} onChange={e => updatePaperRow(i, 'paperStockId', e.target.value)}
                          className="flex-1 min-w-0 px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 bg-white">
                          <option value="">Select paper / size…</option>
                          {paperStock.map(ps => (
                            <option key={ps.id} value={ps.id}>
                              {ps.name}{ps.size ? ` (${ps.size})` : ''} — {ps.quantity} left
                            </option>
                          ))}
                        </select>
                        <input type="number" placeholder="Sheets" value={row.sheets} min="0"
                          onChange={e => updatePaperRow(i, 'sheets', e.target.value)}
                          disabled={!row.paperStockId}
                          className="w-20 px-2 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:opacity-50" />
                        {paperRows.length > 1 && (
                          <button type="button" onClick={() => removePaperRow(i)}
                            className="px-2 text-gray-400 hover:text-red-500 shrink-0" title="Remove">
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      {over && (
                        <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                          <Package className="w-3 h-3" /> Only {p?.quantity} sheets of {p?.name} in stock!
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
              <button type="button" onClick={addPaperRow}
                className="mt-2 text-xs text-primary font-medium hover:underline flex items-center gap-1">
                <Plus className="w-3 h-3" /> Add another paper
              </button>
            </div>
          </div>

          {/* Cart Items */}
          <div className="flex-1 p-4 space-y-2 min-h-[100px]">
            {cart.length === 0 ? (
              <div className="text-center py-6 text-gray-400 text-sm">
                Add products to start a bill
              </div>
            ) : (
              cart.map(item => (
                <div key={item.id} className="bg-white p-3 rounded-md border">
                  <div className="flex justify-between mb-2">
                    <span className="font-medium text-sm">{item.name}</span>
                    <button onClick={() => removeFromCart(item.id)} className="text-red-500"><Trash2 className="w-4 h-4" /></button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button onClick={() => updateQty(item.id, -1)} className="w-7 h-7 bg-gray-100 rounded flex items-center justify-center hover:bg-gray-200"><Minus className="w-4 h-4" /></button>
                      <span className="w-8 text-center font-medium">{item.qty}</span>
                      <button onClick={() => updateQty(item.id, 1)} className="w-7 h-7 bg-gray-100 rounded flex items-center justify-center hover:bg-gray-200"><Plus className="w-4 h-4" /></button>
                    </div>
                    <span className="font-bold text-primary">{formatCurrency(item.total)}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Totals & Payment */}
          <div className="p-4 border-t bg-white mt-auto">
            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-sm"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
              <div className="flex justify-between items-center text-sm">
                <span>Discount</span>
                <div className="flex items-center gap-2">
                  <input type="number" value={discount || ''} onChange={(e) => setDiscount(Math.min(100, parseFloat(e.target.value) || 0))}
                    className="w-16 px-2 py-1 border rounded text-right text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" /><span>%</span>
                </div>
              </div>
              {discount > 0 && <div className="flex justify-between text-sm text-gray-500"><span>Discount Amount</span><span>-{formatCurrency(discountAmount)}</span></div>}
              <div className="flex justify-between items-center text-sm pt-2 border-t">
                <span>Taxable Value</span><span>{formatCurrency(taxableAmount)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="flex items-center gap-1">
                  GST
                  <input type="number" value={gstRate || ''} min="0" max="28"
                    onChange={(e) => setGstRate(Math.min(28, parseFloat(e.target.value) || 0))}
                    className="w-12 px-1.5 py-0.5 border rounded text-right text-xs focus:outline-none focus:ring-2 focus:ring-gray-400" />%
                </span>
                <span>{formatCurrency(gstAmount)}</span>
              </div>
              <div className="flex justify-between text-xs text-gray-500"><span>CGST ({(gstRate / 2)}%)</span><span>{formatCurrency(cgstAmount)}</span></div>
              <div className="flex justify-between text-xs text-gray-500"><span>SGST ({(gstRate / 2)}%)</span><span>{formatCurrency(sgstAmount)}</span></div>
              <div className="flex justify-between text-section pt-2 border-t"><span>Grand Total</span><span className="text-primary">{formatCurrency(grandTotal)}</span></div>
            </div>
            <button onClick={() => setShowPaymentModal(true)} disabled={cart.length === 0}
              className="w-full py-3 bg-gray-900 text-white rounded-md font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-800 transition-colors shadow-sm">
              Pay {formatCurrency(grandTotal)}
            </button>
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-md w-full max-w-md animate-scale-in max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b flex items-center justify-between">
              <h2 className="text-page-title">Payment</h2>
              <button onClick={() => setShowPaymentModal(false)} className="p-2 hover:bg-gray-100 rounded-md"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="text-center bg-gray-50 rounded-md p-4 border">
                <p className="text-sm text-gray-500">Grand Total</p>
                <p className="text-2xl font-bold text-primary">{formatCurrency(grandTotal)}</p>
              </div>

              {/* Payment Type */}
              <div>
                <p className="text-sm font-medium mb-2">Payment Type</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'paid', label: 'Full Payment' },
                    { id: 'advance', label: 'Advance' },
                    { id: 'credit', label: 'Credit' },
                  ].map(pt => (
                    <button key={pt.id} onClick={() => { setPaymentType(pt.id as any); setAmountReceived(''); }}
                      className={`p-2.5 rounded-md border-2 text-sm font-medium transition-all ${paymentType === pt.id ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 hover:border-gray-300'}`}>
                      {pt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Credit Client Selector */}
              {(paymentType === 'credit' || paymentType === 'advance') && (
                <div>
                  <p className="text-sm font-medium mb-2">Client <span className="text-destructive">*</span></p>
                  <select value={selectedClientId} onChange={e => setSelectedClientId(e.target.value)}
                    className="w-full px-3 py-2.5 border rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400 bg-white text-sm">
                    <option value="">Select registered client...</option>
                    {(clients || []).map(c => (
                      <option key={c.id} value={c.id}>{c.company || c.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Credit Days */}
              {paymentType === 'credit' && (
                <div>
                  <p className="text-sm font-medium mb-2">Credit Days</p>
                  <div className="flex gap-2">
                    {['15', '30', '45', '60', '90'].map(d => (
                      <button key={d} onClick={() => setCreditDays(d)}
                        className={`flex-1 py-2 rounded-md border text-sm font-medium transition-all ${creditDays === d ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 hover:bg-gray-50'}`}>
                        {d}d
                      </button>
                    ))}
                  </div>
                  {creditDays && (
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Due: {getDueDate()}
                    </p>
                  )}
                </div>
              )}

              {/* Payment Method (for paid / advance) */}
              {paymentType !== 'credit' && (
                <div>
                  <p className="text-sm font-medium mb-2">Payment Method</p>
                  <div className="grid grid-cols-3 gap-2">
                    {[{ id: 'cash', label: 'Cash', icon: Banknote }, { id: 'card', label: 'Card', icon: CreditCard }, { id: 'upi', label: 'UPI', icon: Smartphone }].map(method => (
                      <button key={method.id} onClick={() => { setPaymentMethod(method.id as any); setAmountReceived(''); }}
                        className={`p-3 rounded-md border-2 flex flex-col items-center gap-1 transition-all ${paymentMethod === method.id ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-gray-300'}`}>
                        <method.icon className="w-5 h-5" /><span className="text-sm">{method.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Amount received (cash / advance) */}
              {paymentType !== 'credit' && paymentMethod === 'cash' && (
                <div>
                  <label className="text-sm font-medium">{paymentType === 'advance' ? 'Advance Amount' : 'Amount Received'}</label>
                  <input type="number" value={amountReceived || ''} onChange={(e) => setAmountReceived(e.target.value)}
                    className="w-full mt-1 px-4 py-2.5 border rounded-md text-lg focus:outline-none focus:ring-2 focus:ring-gray-400" placeholder="Enter amount" />
                  {paymentType === 'paid' && changeAmount >= 0 && amountReceived && (
                    <p className="mt-2 text-gray-900 font-medium">Change: {formatCurrency(changeAmount)}</p>
                  )}
                  {paymentType === 'advance' && amountReceived && (
                    <p className="mt-2 text-amber-600 font-medium">Balance due: {formatCurrency(getBalanceDue())}</p>
                  )}
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="text-sm font-medium">Notes (optional)</label>
                <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any remarks..."
                  className="w-full mt-1 px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
              </div>

              <div className="flex gap-3">
                <button onClick={handleDownloadReceipt} disabled={isProcessing}
                  className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-md font-semibold flex items-center justify-center gap-2 hover:bg-gray-200 disabled:opacity-50 transition-colors">
                  {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                  Download
                </button>
                <button onClick={handlePrint} disabled={isProcessing}
                  className="flex-1 py-3 bg-gray-900 text-white rounded-md font-semibold flex items-center justify-center gap-2 hover:bg-gray-800 disabled:opacity-50 transition-colors">
                  {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Printer className="w-5 h-5" />}
                  Print
                </button>
              </div>
              <button onClick={handleCompleteWithoutReceipt} disabled={isProcessing}
                className="w-full py-2.5 border border-gray-200 text-gray-600 rounded-md text-sm hover:bg-gray-50 disabled:opacity-50 transition-colors">
                Complete without receipt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal (CRUD) */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-md w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-scale-in">
            <div className="p-5 border-b bg-white flex items-center justify-between">
              <div className="flex items-center gap-2 md:gap-4">
                <h2 className="text-page-title">Manage Items</h2>
                <div className="flex bg-gray-100 p-1 rounded-md">
                  <button onClick={() => setActiveTab('products')} className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${activeTab === 'products' ? 'bg-white text-gray-900' : 'text-gray-500'}`}>Products</button>
                  <button onClick={() => setActiveTab('categories')} className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${activeTab === 'categories' ? 'bg-white text-gray-900' : 'text-gray-500'}`}>Categories</button>
                </div>
              </div>
              <button onClick={() => setShowSettingsModal(false)} className="p-2 hover:bg-gray-100 rounded-md"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
              {activeTab === 'products' ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div className="lg:col-span-2">
                    <div className="bg-white rounded-md border overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-gray-50 border-b">
                          <tr>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Product</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Category</th>
                            <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Price</th>
                            <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {products?.map(p => (
                            <tr key={p.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                              <td className="px-4 py-3 text-sm text-gray-500">{p.category?.name}</td>
                              <td className="px-4 py-3 text-right font-medium">{formatCurrency(p.price)}</td>
                              <td className="px-4 py-3 text-right">
                                <div className="flex justify-end gap-2">
                                  <button onClick={() => { setProductForm({ id: p.id, name: p.name, price: p.price, category_id: p.category_id }); setIsEditingProduct(true); }} className="p-1.5 hover:bg-gray-100 rounded"><Edit className="w-4 h-4" /></button>
                                  <button onClick={() => handleDeleteProductReq(p.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
                                </div>
                              </td>
                            </tr>
                          ))}
                          {!products?.length && <tr><td colSpan={4} className="text-center py-4 text-gray-500">No products yet</td></tr>}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div className="bg-white rounded-md border p-5 h-fit">
                    <h3 className="font-bold text-gray-900 mb-4">{isEditingProduct ? 'Edit Product' : 'Add Product'}</h3>
                    <form onSubmit={handleSaveProduct} className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                        <input type="text" required value={productForm.name} onChange={e => setProductForm({ ...productForm, name: e.target.value })} className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Price (₹)</label>
                        <input type="number" required min="0" value={productForm.price || ''} onChange={e => setProductForm({ ...productForm, price: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                        <select required value={productForm.category_id} onChange={e => setProductForm({ ...productForm, category_id: e.target.value })} className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400">
                          <option value="">Select Category</option>
                          {categories?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </div>
                      <div className="flex gap-2 pt-2">
                        {isEditingProduct && <button type="button" onClick={() => { setIsEditingProduct(false); setProductForm({ id: '', name: '', price: 0, category_id: '' }); }} className="flex-1 py-2 border rounded-md hover:bg-gray-50">Cancel</button>}
                        <button type="submit" className="flex-1 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800 font-semibold">{isEditingProduct ? 'Update' : 'Add'}</button>
                      </div>
                    </form>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div className="lg:col-span-2">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {categories?.map(c => (
                        <div key={c.id} className={`p-4 rounded-md border flex items-center justify-between ${c.color}`}>
                          <span className="font-semibold">{c.name}</span>
                          <button onClick={() => handleDeleteCategoryReq(c.id)} className="p-1.5 bg-white/50 rounded-md hover:bg-white text-red-600"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="bg-white rounded-md border p-5 h-fit">
                    <h3 className="font-bold text-gray-900 mb-4">Add Category</h3>
                    <form onSubmit={handleSaveCategory} className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                        <input type="text" required value={categoryForm.name} onChange={e => setCategoryForm({ ...categoryForm, name: e.target.value })} className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Color Theme</label>
                        <div className="grid grid-cols-6 gap-2">
                          {categoryColors.map((color, idx) => (
                            <button key={idx} type="button" onClick={() => setCategoryForm({ ...categoryForm, color })}
                              className={`w-8 h-8 rounded-full ${color.split(' ')[0]} border-2 ${categoryForm.color === color ? 'border-gray-900' : 'border-transparent'}`} />
                          ))}
                        </div>
                      </div>
                      <button type="submit" className="w-full py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800 font-semibold">Add Category</button>
                    </form>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
