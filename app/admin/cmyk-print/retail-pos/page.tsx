'use client';

import { useState, useMemo, useEffect } from 'react';
import { toast } from '@/lib/toast';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Plus, Trash2, ShoppingCart,
  Printer, Banknote, Smartphone, X, Search, Settings,
  Edit, Loader2, Download, Package, Clock, Tag, FileText, Copy, Save, Pencil
} from 'lucide-react';
import type { ReceiptData } from '@/components/receipt/ReceiptPDF';
// Lazy PDF: @react-pdf/renderer (~500KB) loads only when printing/downloading a receipt
const printReceipt = async (d: ReceiptData) =>
  (await import('@/components/receipt/ReceiptPDF')).printReceipt(d);
const downloadReceipt = async (d: ReceiptData) =>
  (await import('@/components/receipt/ReceiptPDF')).downloadReceipt(d);
import { useCompanySettings } from '@/lib/hooks/useCompanySettings';
import { usePOSSales, usePOSProducts, usePaperStock, useCMYKClients, useCMYKAccounts } from '@/lib/hooks';
import { useAuth } from '@/lib/auth-context';
import { POSProduct } from '@/types/database';
import { Input } from '@/components/ui/input';
import { useConfirm } from '@/components/ConfirmModal';

interface CartItem {
  id: string;
  name: string;
  price: number;     // rate per print
  qty: number;
  kind?: 'product' | 'charge' | 'item';
  details?: string;             // design / matter description (what is being printed)
  sides?: 'one' | 'two' | null; // print one side or two side
  prints?: string;              // manual print-count override for 2 Side (blank = auto qty × 2)
  paperStockId?: string;        // paper used for THIS item (spec + stock deduction; billed via the item rate)
  sheetsUsed?: string;          // sheets of that paper consumed by this item
}

// 2 Side print count: auto-suggests qty × 2 but the operator can type any number
// (2-side pricing is not always exactly double). Rate is per print, also editable.
// (Bill-level discount lives below Subtotal — no per-line discount.)
const printCount = (i: CartItem) => {
  if (i.sides !== 'two') return i.qty;
  const manual = parseInt(i.prints || '') || 0;
  return manual > 0 ? manual : i.qty * 2;
};
const lineTotal = (i: CartItem) => Math.max(0, printCount(i) * i.price);

// Quick-add services for a print shop (besides catalog products)
const CHARGE_PRESETS = ['Print', 'Die Cut', 'Handling', 'Delivery', 'Lamination', 'Design', 'Binding'];
// Pure services — no printing happens on these lines, so no sides toggle and no paper
const NON_PRINT_SERVICES = ['Die Cut', 'Handling', 'Delivery', 'Lamination', 'Design', 'Binding'];
// Print-type line = anything except a pure-service charge (products & custom items are print jobs)
const isPrintLine = (i: CartItem) => !(i.kind === 'charge' && NON_PRINT_SERVICES.includes(i.name));

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

// Roles allowed to correct an existing bill. Mirrors the server-side check in
// /api/cmyk-print/sales/[id] — this only hides the UI, the API is the real lock.
const CAN_EDIT_ROLES = ['admin', 'cmyk'];

// Date helpers for the bill date. Everything here is LOCAL time: a bill dated 1 Aug
// must read 1 Aug to the shop, whatever the server's timezone thinks.
const localYmd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * Turn the picked day into a full timestamp, keeping the time of day from `base`
 * (the bill's original time when editing, or right now for a new bill). Moving a bill
 * to another date shouldn't also move it to midnight.
 */
const withDate = (ymd: string, base?: string | null): string | undefined => {
  if (!ymd) return undefined;
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return undefined;
  const out = base ? new Date(base) : new Date();
  if (isNaN(out.getTime())) return undefined;
  out.setFullYear(y, m - 1, d);
  return out.toISOString();
};

export default function RetailPOSPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const { settings: companySettings } = useCompanySettings();
  const { sales, loading: salesLoading, createPOSSale, refetch: refetchSales } = usePOSSales();
  const { stock: paperStock } = usePaperStock();
  const { cmykClients } = useCMYKClients();
  const { cmykAccounts } = useCMYKAccounts();
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
  const [cmykClientId, setCmykClientId] = useState(''); // separate CMYK print client (for monthly billing)
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'upi'>('cash');
  // Which real account the money went into ("cash:<id>" / "bank:<id>")
  const [payAccount, setPayAccount] = useState('');
  const [amountReceived, setAmountReceived] = useState('');
  // Counter sales are collected on the spot, so "paid in full" is the default and CREDIT is
  // the deliberate choice. Before this, a blank amount box silently saved every bill as
  // pending while the receipt still printed "Payment: Cash" — money vanished from Accounts.
  const [isCredit, setIsCredit] = useState(false);
  const [discount, setDiscount] = useState(0);

  // Order type & artwork (no GST — this CMYK counter issues estimates, not GST invoices)
  const [orderType, setOrderType] = useState<'walkin' | 'pickup'>('walkin');
  const [artworkLink, setArtworkLink] = useState('');

  // CMYK's own accounts (separate from master banking) for the "received in" picker.
  const accountOptions = useMemo(() =>
    (cmykAccounts || [])
      .filter((a: any) => a.is_active !== false)
      .map((a: any) => ({ value: a.id, label: a.name, type: a.type as 'cash' | 'upi' | 'bank' })),
  [cmykAccounts]);

  useEffect(() => {
    // Don't re-arm a default account in credit mode — the empty account IS the choice there.
    if (!isCredit && !payAccount && accountOptions.length > 0) setPayAccount(accountOptions[0].value);
  }, [accountOptions, payAccount, isCredit]);

  const [notes, setNotes] = useState('');

  // ── BILL DATE ─────────────────────────────────────────────────────────────
  // Counter bills normally carry today's date, but yesterday's work is often entered
  // the next morning — so the date is editable on both a new bill and an existing one.
  // Only the DAY moves; the time of day is kept, so bills stay in sensible order within
  // a date and the bill number (GEN-26-NNN, no date in it) is unaffected.
  const [billDate, setBillDate] = useState<string>(() => localYmd(new Date()));

  // ── EDIT MODE ─────────────────────────────────────────────────────────────
  // Arriving as /admin/cmyk-print/retail-pos?edit=<sale id> loads that bill back into
  // the cart so it can be corrected. The bill number and its original date never change —
  // the same bill is fixed, not replaced, so the day's takings stay complete.
  // (Read from window.location instead of useSearchParams: no Suspense boundary needed.)
  const [editId, setEditId] = useState<string | null>(null);
  const [editSale, setEditSale] = useState<any | null>(null);
  const [loadedEditId, setLoadedEditId] = useState<string | null>(null);
  const canEdit = CAN_EDIT_ROLES.includes(profile?.role || '');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const id = new URLSearchParams(window.location.search).get('edit');
    setEditId(id);
  }, []);

  // Rebuild the cart from the saved bill, once its rows have arrived.
  useEffect(() => {
    if (!editId || loadedEditId === editId) return;
    const sale = (sales || []).find((s: any) => s.id === editId);
    if (!sale) return; // still loading, or not found — handled by the banner below

    setEditSale(sale);
    setLoadedEditId(editId);

    setCart((sale.items || []).map((it: any, idx: number) => {
      // quantity stored on the bill is the PRINT count (2-side lines are already doubled),
      // while sheets is the piece count. Restore both so the line total comes back exactly.
      const twoSide = it.print_sides === 'two';
      const pieces = it.sheets || (twoSide ? Math.max(1, Math.round((it.quantity || 1) / 2)) : (it.quantity || 1));
      const name = it.product_name || 'Item';
      return {
        id: it.product_id || `line-${idx}-${it.id || Math.random().toString(36).slice(2, 7)}`,
        name,
        price: Number(it.price) || 0,
        qty: pieces,
        kind: it.product_id ? 'product' : (CHARGE_PRESETS.includes(name) ? 'charge' : 'item'),
        details: it.details || '',
        sides: (it.print_sides as 'one' | 'two' | null) || null,
        // Keep the exact stored print count so an edited 2-side line doesn't silently re-price
        prints: twoSide ? String(it.quantity || '') : '',
        paperStockId: it.paper_stock_id || '',
      } as CartItem;
    }));

    setCustomerName(sale.customer_name || '');
    setCustomerPhone(sale.customer_phone || '');
    setCmykClientId(sale.cmyk_client_id || '');
    setDiscount(Number(sale.discount_percent) || 0);
    setOrderType((sale.order_type as 'walkin' | 'pickup') || 'walkin');
    setArtworkLink(sale.artwork_link || '');
    setNotes(sale.notes || '');
    setAmountReceived(sale.amount_received ? String(sale.amount_received) : '');
    // Reopen an unpaid bill in credit mode so re-saving it doesn't invent a receipt.
    setIsCredit(!Number(sale.amount_received));
    setPaymentMethod((sale.payment_mode === 'upi' ? 'upi' : 'cash'));
    setBillDate(sale.created_at ? localYmd(new Date(sale.created_at)) : localYmd(new Date()));
    if (sale.cmyk_account_id) setPayAccount(sale.cmyk_account_id);
  }, [editId, loadedEditId, sales]);

  // Drop out of edit mode and go back to a blank counter bill
  const exitEditMode = () => {
    setEditId(null);
    setEditSale(null);
    setLoadedEditId(null);
    if (typeof window !== 'undefined') window.history.replaceState(null, '', '/admin/cmyk-print/retail-pos');
  };

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

  const newId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  // Tap a catalog product → adds (or increments) a line, pre-filled with its price
  const addToCart = (product: POSProduct) => {
    const existing = cart.find(item => item.id === product.id);
    if (existing) {
      setCart(cart.map(item => item.id === product.id ? { ...item, qty: item.qty + 1 } : item));
    } else {
      setCart([...cart, { id: product.id, name: product.name, price: product.price, qty: 1, kind: 'product', details: '', sides: null }]);
    }
  };

  // Quick-add a named service line (Print, Die Cut, Delivery, …) — rate entered in the cart
  const addCharge = (name: string) => {
    setCart(prev => [...prev, { id: newId('charge'), name, price: 0, qty: 1, kind: 'charge', details: '', sides: null }]);
  };

  // Add a blank, fully editable item/service line
  const addCustomItem = () => {
    setCart(prev => [...prev, { id: newId('item'), name: '', price: 0, qty: 1, kind: 'item', details: '', sides: null }]);
  };

  // Generic per-line editor (name / details / qty / rate / paper)
  const updateLine = (id: string, field: 'name' | 'qty' | 'price' | 'details' | 'paperStockId' | 'sheetsUsed' | 'prints', value: string | number) => {
    setCart(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };
  // 1 Side / 2 Side — tap the selected one again to clear (not every line is a print).
  // Switching sides resets any manual print-count override back to auto.
  const setLineSides = (id: string, side: 'one' | 'two') => {
    setCart(prev => prev.map(item => item.id === id ? { ...item, sides: item.sides === side ? null : side, prints: '' } : item));
  };

  const removeFromCart = (id: string) => setCart(cart.filter(item => item.id !== id));

  // Paper is attached PER ITEM (spec + stock). It is NOT billed separately — the item's
  // single rate covers everything. Aggregate per paper for the stock-deduction trigger
  // (sale.papers → deduct_paper_stock / restore_paper_stock) and cost tracking.
  const itemPaper = (i: CartItem) => {
    const p = i.paperStockId ? paperStock.find(x => x.id === i.paperStockId) : undefined;
    // Sheets consumed = quantity printed (1 sheet per piece). No separate input:
    // selected paper − qty = stock.
    const sheets = i.qty || 0;
    return { p, sheets };
  };
  const paperList = (() => {
    const agg: Record<string, { paper_stock_id: string; paper_name?: string; size?: string; sheets: number; rate: number; amount: number; cost: number }> = {};
    cart.forEach(i => {
      const { p, sheets } = itemPaper(i);
      if (!i.paperStockId || sheets <= 0) return;
      const e = agg[i.paperStockId] || (agg[i.paperStockId] = { paper_stock_id: i.paperStockId, paper_name: p?.name, size: p?.size, sheets: 0, rate: 0, amount: 0, cost: 0 });
      e.sheets += sheets;
      e.cost += (p?.cost_per_unit || 0) * sheets;
    });
    return Object.values(agg);
  })();

  const subtotal = cart.reduce((sum, item) => sum + lineTotal(item), 0);
  const discountAmount = (subtotal * discount) / 100;
  const taxableAmount = subtotal - discountAmount;
  // This CMYK counter does not raise GST bills — the estimate total is just subtotal − discount.
  const grandTotal = taxableAmount;

  // Payment calculation
  const receivedAmt = parseFloat(amountReceived || '0');
  const changeAmount = receivedAmt > grandTotal ? receivedAmt - grandTotal : 0;

  // Payment status is derived purely from what was collected now (cash/UPI).
  // Nothing collected → the bill is left as a PENDING PAYMENT.
  const getPaymentStatus = (): 'paid' | 'pending' | 'partial' => {
    if (receivedAmt <= 0) return 'pending';
    if (receivedAmt >= grandTotal) return 'paid';
    return 'partial';
  };

  const getBalanceDue = () => {
    if (receivedAmt <= 0) return grandTotal;
    return Math.max(0, grandTotal - receivedAmt);
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
    setCmykClientId('');
    setDiscount(0);
    setOrderType('walkin');
    setArtworkLink('');
    setAmountReceived('');
    setIsCredit(false);
    setPaymentMethod('cash');
    setNotes('');
    setBillDate(localYmd(new Date()));
    setShowPaymentModal(false);
    exitEditMode();
  };

  const [isProcessing, setIsProcessing] = useState(false);

  const saveSale = async () => {
    setIsProcessing(true);
    try {
      // Only what was actually collected now is recorded as received (0 = pending payment).
      const paidAmount = isCredit ? 0 : (receivedAmt > 0 ? receivedAmt : 0);
      // Which CMYK account the money landed in; derive legacy payment_mode from its type.
      // A credit sale is tagged to NO account — otherwise Accounts would list it as a receipt.
      const payAcct = isCredit ? undefined : accountOptions.find(o => o.value === payAccount);
      const saleData = {
        customer_name: customerName || undefined,
        customer_phone: customerPhone || undefined,
        cmyk_client_id: cmykClientId || undefined,
        subtotal,
        discount_percent: discount,
        discount_amount: discountAmount,
        gst_rate: 0,
        gst_amount: 0,
        cgst_amount: 0,
        sgst_amount: 0,
        order_type: orderType,
        pickup_status: orderType === 'pickup' ? 'pending' : undefined,
        artwork_link: artworkLink || undefined,
        total_amount: grandTotal,
        payment_mode: payAcct ? (payAcct.type === 'cash' ? 'cash' : 'upi') : paymentMethod,
        cmyk_account_id: isCredit ? null : (payAccount || undefined),
        amount_received: paidAmount,
        change_amount: changeAmount > 0 ? changeAmount : 0,
        payment_status: getPaymentStatus(),
        balance_due: getBalanceDue(),
        paper_stock_id: paperList[0]?.paper_stock_id || undefined,
        sheets_used: paperList.reduce((sum, p) => sum + p.sheets, 0),
        papers: paperList.length > 0 ? paperList : undefined,
        notes: notes || undefined,
        sold_by: profile?.full_name || profile?.email?.split('@')[0] || 'CMYK',
        // Back-dating a new bill: keep the current time of day on the chosen date.
        created_at: withDate(billDate, null),
      };

      const saleItems = cart.map(item => {
        const { p, sheets } = itemPaper(item);
        return {
          product_id: item.kind === 'product' ? item.id : null,
          product_name: item.name || 'Item',
          quantity: printCount(item), // 2 Side → double prints, so qty × price = total stays true
          price: item.price,
          total: lineTotal(item),
          details: item.details?.trim() || null,
          print_sides: isPrintLine(item) ? item.sides || null : null,
          paper_stock_id: item.paperStockId || null,
          paper_name: p ? `${p.name}${p.size ? ` (${p.size})` : ''}` : null,
          sheets: sheets > 0 ? sheets : null,
        };
      });

      // EDIT: correct the existing bill instead of raising a new one. Goes through the
      // server route so the role check, the audit reason and the paper-stock adjustment
      // all happen in one place that the browser cannot skip.
      if (editId) {
        const originalYmd = editSale?.created_at ? localYmd(new Date(editSale.created_at)) : '';
        const dateMoved = !!originalYmd && originalYmd !== billDate;
        const asDate = (ymd: string) =>
          ymd ? new Date(`${ymd}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';

        const { confirmed, inputValue } = await confirm({
          title: `Save changes to ${editSale?.sale_number || 'this bill'}?`,
          message: `The bill number stays the same — only the contents change.${
            editSale ? `\n\nTotal: ₹${editSale.total_amount} → ₹${grandTotal}` : ''
          }${
            dateMoved
              ? `\n\nDATE: ${asDate(originalYmd)} → ${asDate(billDate)}${
                  originalYmd.slice(0, 7) !== billDate.slice(0, 7)
                    ? '\nThis moves the bill into a different MONTH, so both months’ sales totals and the client statement will change.'
                    : ''
                }`
              : ''
          }\n\nWhy is this bill being changed? (required — saved to the activity log)`,
          confirmLabel: 'Save changes',
          showInput: true,
          inputRequired: true,
          inputPlaceholder: 'e.g. "wrong rate entered", "customer added 100 more copies"',
        });
        if (!confirmed) return null;

        const reason = (inputValue || '').trim();
        if (reason.length < 3) {
          toast.error('Please enter a reason (at least 3 characters). Nothing was changed.');
          return null;
        }

        // JSON.stringify silently DROPS undefined keys, so a field the operator just
        // cleared would never reach the server. Send explicit nulls for everything
        // optional, otherwise "remove the phone number" would quietly do nothing.
        const editPayload = {
          ...saleData,
          customer_name: customerName || null,
          customer_phone: customerPhone || null,
          cmyk_client_id: cmykClientId || null,
          artwork_link: artworkLink || null,
          notes: notes || null,
          cmyk_account_id: isCredit ? null : (payAccount || null),
          paper_stock_id: paperList[0]?.paper_stock_id || null,
          papers: paperList.length > 0 ? paperList : null,
          // A pickup that's already been collected stays collected — editing the
          // bill must not send a finished order back to "pending".
          pickup_status: orderType === 'pickup' ? (editSale?.pickup_status || 'pending') : null,
          // Only the day moves; the bill keeps its original time of day.
          created_at: withDate(billDate, editSale?.created_at),
        };

        const res = await fetch(`/api/cmyk-print/sales/${editId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason, sale: editPayload, items: saleItems }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          toast.error(json.error || 'Could not save the changes');
          return null;
        }
        refetchSales();
        return json.sale_number || editSale?.sale_number || null;
      }

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

  // One full line per item on the receipt: name (sides) — matter · paper (size) × sheets
  const receiptItemName = (i: CartItem) => {
    let n = i.name || 'Item';
    if (isPrintLine(i) && i.sides) n += i.sides === 'two' ? ' (2 Side)' : ' (1 Side)';
    if (i.details?.trim()) n += ` — ${i.details.trim()}`;
    const { p, sheets } = itemPaper(i);
    if (p) n += ` · ${p.name}${p.size ? ` (${p.size})` : ''}${sheets > 0 ? ` × ${sheets} sh` : ''}`;
    return n;
  };

  const buildReceiptData = (saleNumber: string): ReceiptData => {
    // The receipt carries the bill's own date — the one chosen above, not today's.
    const stamped = withDate(billDate, editSale?.created_at ?? null);
    const now = stamped ? new Date(stamped) : new Date();
    return {
      companyName: companySettings.companyName,
      companyAddress: `${companySettings.companyAddress}, ${companySettings.companyCity} ${companySettings.companyPincode}`,
      companyPhone: companySettings.companyPhone,
      receiptNumber: saleNumber,
      date: now.toLocaleDateString('en-IN'),
      time: now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      customerName: customerName || cmykClients?.find(c => c.id === cmykClientId)?.company || cmykClients?.find(c => c.id === cmykClientId)?.name || undefined,
      customerPhone: customerPhone || undefined,
      items: cart.map(item => ({ name: receiptItemName(item), qty: printCount(item), price: item.price, total: lineTotal(item) })),
      subtotal,
      discountPercent: discount,
      discountAmount,
      gstRate: 0,
      cgstAmount: 0,
      sgstAmount: 0,
      grandTotal,
      // The receipt must not claim money that was never collected. It used to fall back to
      // the grand total when nothing was received, so an unpaid bill printed "Payment: Cash"
      // and looked settled while Accounts correctly showed ₹0.
      paymentMode: isCredit || receivedAmt <= 0
        ? 'UNPAID · pay later'
        : (accountOptions.find(o => o.value === payAccount)?.label || paymentMethod),
      amountReceived: isCredit ? 0 : (receivedAmt > 0 ? receivedAmt : 0),
      change: changeAmount > 0 ? changeAmount : 0,
      cashier: profile?.full_name || profile?.email?.split('@')[0] || 'CMYK',
    };
  };

  // After an EDIT the operator belongs back on the Sales list, looking at the corrected
  // bill — not at a blank counter screen wondering whether it saved.
  const finishAfterSave = (saleNumber: string) => {
    const wasEdit = !!editId;
    clearCart();
    if (wasEdit) {
      toast.success(`Bill ${saleNumber} updated`);
      router.push('/admin/cmyk-print/sales');
    }
  };

  const handlePrint = async () => {
    const saleNumber = await saveSale();
    if (!saleNumber) { setIsProcessing(false); return; }
    try {
      await printReceipt(buildReceiptData(saleNumber));
      finishAfterSave(saleNumber);
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
      finishAfterSave(saleNumber);
    } catch {
      toast.error('Error downloading receipt.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCompleteWithoutReceipt = async () => {
    const saleNumber = await saveSale();
    if (saleNumber) {
      if (!editId) toast.success(`Sale ${saleNumber} recorded`);
      finishAfterSave(saleNumber);
    }
    setIsProcessing(false);
  };

  const formatCurrency = (amount: number) => `₹${amount.toLocaleString('en-IN')}`;

  const inputCls = 'px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400';

  return (
    <div className="lg:h-[calc(100vh-80px)] flex flex-col">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/admin/cmyk-print" className="p-2 hover:bg-gray-100 rounded-md">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-page-title text-gray-900">
              {editId ? `Editing ${editSale?.sale_number || 'bill'}` : 'Retail POS'}
            </h1>
            <p className="text-sm text-gray-500">
              {editId ? 'Same bill number, same date — only the contents change' : 'Quick billing system'}
            </p>
          </div>
        </div>
        <button onClick={() => setShowSettingsModal(true)}
          className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors">
          <Settings className="w-4 h-4" />
          <span className="hidden sm:inline">Manage Items</span>
        </button>
      </div>

      {/* Edit-mode banner — always visible so nobody edits a bill by accident */}
      {editId && (
        <div className={`shrink-0 px-4 py-2.5 border-b flex flex-wrap items-center justify-between gap-2 text-sm ${
          canEdit ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-red-50 border-red-200 text-red-700'
        }`}>
          <span className="inline-flex items-center gap-2">
            <Pencil className="w-4 h-4 shrink-0" />
            {!canEdit ? (
              <span>You do not have permission to edit bills. Only admin and CMYK team members can.</span>
            ) : editSale ? (
              <span>
                Editing <strong>{editSale.sale_number}</strong> ({editSale.customer_name || 'Walk-in'}) —
                originally {formatCurrency(Number(editSale.total_amount) || 0)}. Saving asks for a reason and logs the change.
              </span>
            ) : salesLoading ? (
              <span className="inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading this bill…</span>
            ) : (
              // Don't leave a spinner running forever on a bad or deleted link
              <span>That bill could not be found — it may have been deleted. Nothing here will be saved to it.</span>
            )}
          </span>
          <button onClick={exitEditMode} className="underline font-medium shrink-0">
            {canEdit ? 'Cancel edit' : 'Start a new bill'}
          </button>
        </div>
      )}

      {/* Main Content — 3 panels: catalog | bill builder | summary */}
      <div className="flex-1 flex flex-col lg:flex-row lg:overflow-hidden">

        {/* ── LEFT: Product catalog ─────────────────────────────── */}
        <div className="order-3 lg:order-1 w-full lg:w-[280px] xl:w-[320px] shrink-0 border-t lg:border-t-0 lg:border-r flex flex-col p-4 lg:overflow-y-auto">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Products</p>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input type="text" placeholder="Search products..." value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
          </div>
          <div className="flex flex-wrap gap-1.5 mb-3">
            <button onClick={() => setSelectedCategory('all')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${selectedCategory === 'all' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
              All
            </button>
            {categories?.map(cat => (
              <button key={cat.id} onClick={() => setSelectedCategory(cat.id)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${selectedCategory === cat.id ? 'bg-gray-900 text-white' : `${cat.color} hover:opacity-80`}`}>
                {cat.name}
              </button>
            ))}
          </div>

          <div className="flex-1 min-h-[120px]">
            {productsLoading ? (
              <div className="flex items-center justify-center h-full text-gray-500 text-sm py-8">
                <Loader2 className="animate-spin mr-2 w-4 h-4" /> Loading products...
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-gray-400 text-sm py-8 border border-dashed rounded-md">
                <p>No products found.</p>
                <button onClick={() => setShowSettingsModal(true)} className="mt-1 text-primary font-medium">Add Products</button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {filteredProducts.map(product => (
                  <button key={product.id} onClick={() => addToCart(product)}
                    className="p-2.5 bg-white border rounded-md hover:border-primary/30 transition-all text-left flex flex-col justify-between h-full">
                    <div>
                      <p className="font-medium text-gray-900 text-sm line-clamp-2">{product.name}</p>
                      <p className="text-[11px] text-gray-500 mt-0.5">{product.category?.name}</p>
                    </div>
                    <p className="text-primary font-bold mt-1.5 text-sm">{formatCurrency(product.price)}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── CENTER: Bill builder ──────────────────────────────── */}
        <div className="order-1 lg:order-2 flex-1 min-w-0 bg-gray-50 lg:overflow-y-auto">
          <div className="p-4 lg:p-6 max-w-3xl mx-auto space-y-4">

            {/* Customer */}
            <div className="bg-white border rounded-md p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Customer</p>
                {/* Bill date — defaults to today; change it to enter an earlier day's work */}
                <div className="flex items-center gap-2">
                  <label htmlFor="bill-date" className="text-xs font-medium text-gray-500">Bill date</label>
                  <input
                    id="bill-date"
                    type="date"
                    value={billDate}
                    max={localYmd(new Date())}
                    onChange={(e) => setBillDate(e.target.value || localYmd(new Date()))}
                    className="px-2 py-1 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                  />
                </div>
              </div>
              {(() => {
                const today = localYmd(new Date());
                const originalYmd = editSale?.created_at ? localYmd(new Date(editSale.created_at)) : '';
                // Moving a bill across a month boundary changes two months of totals and
                // the client's monthly statement — say so before it is saved, not after.
                if (originalYmd && originalYmd !== billDate) {
                  const crossesMonth = originalYmd.slice(0, 7) !== billDate.slice(0, 7);
                  return (
                    <p className={`text-xs mb-3 ${crossesMonth ? 'text-red-600' : 'text-amber-700'}`}>
                      Moving this bill from {new Date(`${originalYmd}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} to {new Date(`${billDate}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                      {crossesMonth && ' — a different month, so both months’ sales totals and the client statement will change.'}
                    </p>
                  );
                }
                if (!editId && billDate !== today) {
                  return (
                    <p className="text-xs text-amber-700 mb-3">
                      This bill will be dated {new Date(`${billDate}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}, not today.
                    </p>
                  );
                }
                return null;
              })()}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* CMYK print client — links this bill to a client for the monthly statement */}
                <div className="sm:col-span-2">
                  <select value={cmykClientId}
                    onChange={(e) => {
                      setCmykClientId(e.target.value);
                      const c = cmykClients?.find(x => x.id === e.target.value);
                      if (c) {
                        // Auto-fill the (still visible, still editable) name & phone boxes from the saved client
                        setCustomerName(c.company || c.name || '');
                        setCustomerPhone(c.phone || '');
                      } else {
                        // Back to Walk-in — clear the auto-filled fields
                        setCustomerName('');
                        setCustomerPhone('');
                      }
                    }}
                    className={`w-full ${inputCls} bg-white`}>
                    <option value="">Walk-in (no CMYK client)</option>
                    {(cmykClients || []).filter(c => c.is_active !== false).map(c => (
                      <option key={c.id} value={c.id}>{c.company || c.name}</option>
                    ))}
                  </select>
                  <p className="text-[11px] text-gray-400 mt-1">Pick a CMYK client to add this bill to their monthly print report.</p>
                </div>
                <input type="text" placeholder="Customer Name" value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)} className={inputCls} />
                <input type="tel" placeholder="Phone" value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)} className={inputCls} />
                <input type="text" placeholder="Artwork link / note" value={artworkLink}
                  onChange={(e) => setArtworkLink(e.target.value)} className={inputCls} />
                {/* Order type: walk-in vs later pickup */}
                <div className="grid grid-cols-2 gap-1 bg-gray-100 p-1 rounded-md">
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
              </div>
            </div>

            {/* Items — every line is fully editable (details + sides + qty × rate + paper) */}
            <div className="bg-white border rounded-md p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Items</p>
                {cart.length > 0 && <span className="text-xs text-gray-400">{cart.length} line{cart.length > 1 ? 's' : ''}</span>}
              </div>

              {/* Quick add — print charge, services & extra items (no catalog product needed) */}
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className="text-xs font-medium text-gray-500 flex items-center gap-1"><Tag className="w-3.5 h-3.5" /> Quick add:</span>
                {CHARGE_PRESETS.map(name => (
                  <button key={name} onClick={() => addCharge(name)}
                    className="px-2.5 py-1 rounded-md border border-dashed border-amber-300 text-amber-700 bg-amber-50 text-xs font-medium hover:bg-amber-100 transition-colors">
                    + {name}
                  </button>
                ))}
              </div>

              <div className="space-y-2">
                {cart.length === 0 && (
                  <div className="text-center py-8 text-gray-400 text-sm border border-dashed rounded-md">
                    Tap a product, use Quick add, or “Add item / service” to start a bill
                  </div>
                )}
                {cart.map(item => (
                  <div key={item.id} className="bg-gray-50/60 p-3 rounded-md border space-y-2">
                    {/* Name + line total + delete */}
                    <div className="flex items-center gap-2">
                      {item.kind !== 'product' && <Tag className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                      {item.kind === 'product' ? (
                        <span className="font-medium text-sm flex-1 truncate">{item.name}</span>
                      ) : (
                        <input type="text" value={item.name} placeholder="Item / service name"
                          onChange={e => updateLine(item.id, 'name', e.target.value)}
                          className="font-medium text-sm flex-1 min-w-0 bg-transparent border-b border-dashed border-gray-300 focus:outline-none focus:border-gray-500" />
                      )}
                      <span className="font-bold text-primary text-sm shrink-0">{formatCurrency(lineTotal(item))}</span>
                      <button onClick={() => removeFromCart(item.id)} className="text-red-500 shrink-0"><Trash2 className="w-4 h-4" /></button>
                    </div>

                    {/* Item details — what design / matter is being printed */}
                    <div className="flex items-center gap-2">
                      <FileText className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <input type="text" value={item.details || ''}
                        placeholder="Item details — design / matter (e.g. Wedding card, Bill book, Shop flyer)"
                        onChange={e => updateLine(item.id, 'details', e.target.value)}
                        className="flex-1 min-w-0 px-2 py-1.5 text-xs border rounded focus:outline-none focus:ring-2 focus:ring-gray-400 bg-white" />
                    </div>

                    {/* Sides (print lines only) + Qty × Rate; 2 Side doubles the print count */}
                    <div className="flex items-center gap-1.5 text-xs flex-wrap">
                      {isPrintLine(item) && (
                        <div className="flex rounded-md border overflow-hidden shrink-0" title="Print sides">
                          {([['one', '1 Side'], ['two', '2 Side']] as const).map(([val, label]) => (
                            <button key={val} type="button" onClick={() => setLineSides(item.id, val)}
                              className={`px-2 py-1 font-medium transition-colors flex items-center gap-1 ${item.sides === val ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 hover:bg-gray-100'}`}>
                              {val === 'two' && <Copy className="w-3 h-3" />}{label}
                            </button>
                          ))}
                        </div>
                      )}
                      <span className="text-gray-400 ml-1">Qty</span>
                      <input type="number" min="1" value={item.qty}
                        onChange={e => updateLine(item.id, 'qty', parseInt(e.target.value) || 1)}
                        className="w-14 px-1.5 py-1 border rounded text-right focus:outline-none focus:ring-2 focus:ring-gray-400" />
                      <span className="text-gray-400">× ₹</span>
                      <input type="number" min="0" value={item.price || ''} placeholder="rate/print"
                        onChange={e => updateLine(item.id, 'price', parseFloat(e.target.value) || 0)}
                        className="w-20 px-1.5 py-1 border rounded text-right focus:outline-none focus:ring-2 focus:ring-gray-400" />
                      {item.sides === 'two' && (
                        <>
                          <span className="text-gray-400">→</span>
                          <input type="number" min="1" value={item.prints || ''}
                            placeholder={String(item.qty * 2)}
                            onChange={e => updateLine(item.id, 'prints', e.target.value)}
                            title="Total prints — auto qty × 2, type your own number if pricing differs"
                            className="w-16 px-1.5 py-1 border border-amber-300 bg-amber-50 rounded text-right focus:outline-none focus:ring-2 focus:ring-amber-400" />
                          <span className="text-amber-600 font-medium">prints{!(parseInt(item.prints || '') > 0) ? ' (auto ×2)' : ''}</span>
                        </>
                      )}
                    </div>

                    {/* Paper for THIS item (print lines only) — spec + stock; billed via the item rate above */}
                    {isPrintLine(item) && (() => {
                      const { p, sheets } = itemPaper(item);
                      const over = !!(p && sheets > p.quantity);
                      return (
                        <div>
                          <div className="flex items-center gap-2 text-xs flex-wrap">
                            <Package className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                            <select value={item.paperStockId || ''}
                              onChange={e => updateLine(item.id, 'paperStockId', e.target.value)}
                              className="flex-1 min-w-[160px] px-2 py-1.5 border rounded text-xs focus:outline-none focus:ring-2 focus:ring-gray-400 bg-white">
                              <option value="">Paper for this item (optional)…</option>
                              {paperStock.map(ps => (
                                <option key={ps.id} value={ps.id}>
                                  {ps.name}{ps.size ? ` (${ps.size})` : ''} — {ps.quantity} left
                                </option>
                              ))}
                            </select>
                            {item.paperStockId && (
                              <span className="text-gray-500 whitespace-nowrap">− {item.qty || 0} sheet{(item.qty || 0) === 1 ? '' : 's'} from stock</span>
                            )}
                          </div>
                          {over && (
                            <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                              <Package className="w-3 h-3" /> Only {p?.quantity} sheets of {p?.name} in stock!
                            </p>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                ))}
                <button type="button" onClick={addCustomItem}
                  className="w-full py-2 border border-dashed border-gray-300 rounded-md text-sm text-gray-600 hover:bg-gray-50 flex items-center justify-center gap-1">
                  <Plus className="w-4 h-4" /> Add item / service
                </button>
              </div>
            </div>

          </div>
        </div>

        {/* ── RIGHT: Bill summary ───────────────────────────────── */}
        <div className="order-2 lg:order-3 w-full lg:w-[300px] xl:w-[340px] shrink-0 border-t lg:border-t-0 lg:border-l bg-white flex flex-col">
          <div className="p-4 border-b flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-primary" />
              <span className="font-semibold">Bill ({cart.length})</span>
            </div>
            {(cart.length > 0 || customerName) && (
              <button onClick={clearCart} className="text-red-600 text-sm hover:underline">Clear</button>
            )}
          </div>

          {/* Line summary — one full line per item: name · sides · qty, paper below */}
          <div className="flex-1 p-4 space-y-2 lg:overflow-y-auto text-sm">
            {cart.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-6">No items yet</p>
            ) : (
              cart.map(item => {
                const { p, sheets } = itemPaper(item);
                return (
                  <div key={item.id}>
                    <div className="flex justify-between gap-2">
                      <span className="text-gray-700 truncate">
                        {item.name || 'Item'}
                        {isPrintLine(item) && item.sides && <span className="text-gray-400"> · {item.sides === 'two' ? '2-side' : '1-side'}</span>}
                        {printCount(item) > 1 && <span className="text-gray-400"> × {printCount(item)}{item.sides === 'two' ? ' prints' : ''}</span>}
                      </span>
                      <span className="font-medium shrink-0">{formatCurrency(lineTotal(item))}</span>
                    </div>
                    {(item.details?.trim() || p) && (
                      <p className="text-[11px] text-gray-400 truncate">
                        {item.details?.trim()}{item.details?.trim() && p ? ' · ' : ''}{p ? `${p.name}${p.size ? ` (${p.size})` : ''}${sheets > 0 ? ` × ${sheets} sh` : ''}` : ''}
                      </p>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Totals & Payment */}
          <div className="p-4 border-t mt-auto">
            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-sm"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
              <div className="flex justify-between items-center text-sm">
                <span>Discount</span>
                <div className="flex items-center gap-2">
                  <input type="number" value={discount || ''} onChange={(e) => setDiscount(Math.min(100, parseFloat(e.target.value) || 0))}
                    className="w-16 px-2 py-1 border rounded text-right text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" /><span>%</span>
                </div>
              </div>
              {discount > 0 && <div className="flex justify-between text-sm text-gray-500"><span>Taxable Value</span><span>{formatCurrency(taxableAmount)}</span></div>}
              <div className="flex justify-between text-section pt-2 border-t"><span>Grand Total</span><span className="text-primary">{formatCurrency(grandTotal)}</span></div>
            </div>
            {editId && editSale && grandTotal !== Number(editSale.total_amount) && (
              <p className="text-xs text-amber-700 mb-2 text-center">
                Was {formatCurrency(Number(editSale.total_amount) || 0)} → now {formatCurrency(grandTotal)}
              </p>
            )}
            <button onClick={() => { if (!isCredit) setAmountReceived(String(grandTotal)); setShowPaymentModal(true); }} disabled={grandTotal <= 0 || (!!editId && (!canEdit || !editSale))}
              className="w-full py-3 bg-gray-900 text-white rounded-md font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-800 transition-colors shadow-sm">
              {editId ? `Review & save changes` : `Pay ${formatCurrency(grandTotal)}`}
            </button>
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-md w-full max-w-md animate-scale-in max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b flex items-center justify-between">
              <h2 className="text-page-title">{editId ? 'Save changes' : 'Payment'}</h2>
              <button onClick={() => setShowPaymentModal(false)} className="p-2 hover:bg-gray-100 rounded-md"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="text-center bg-gray-50 rounded-md p-4 border">
                <p className="text-sm text-gray-500">Grand Total</p>
                <p className="text-2xl font-bold text-primary">{formatCurrency(grandTotal)}</p>
              </div>

              {/* Received in — pick which real account got the money */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium">Received in account</p>
                  <Link href="/admin/cmyk-print/accounts" className="text-[11px] text-gray-400 hover:text-gray-700 inline-flex items-center gap-1">
                    <Settings className="w-3 h-3" /> Manage
                  </Link>
                </div>
                {accountOptions.length === 0 ? (
                  <p className="text-sm text-amber-600">
                    No CMYK accounts yet. <Link href="/admin/cmyk-print/accounts" className="underline">Add one</Link>.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {accountOptions.map(o => (
                      <button key={o.value} type="button"
                        onClick={() => { setPayAccount(o.value); setIsCredit(false); setAmountReceived(String(grandTotal)); }}
                        className={`p-3 rounded-md border-2 flex flex-col items-center gap-1 transition-all text-center ${!isCredit && payAccount === o.value ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-gray-300'}`}>
                        {o.type === 'cash' ? <Banknote className="w-5 h-5" /> : <Smartphone className="w-5 h-5" />}
                        <span className="text-xs leading-tight">{o.label}</span>
                      </button>
                    ))}
                    {/* Deliberate "not collected" choice. Clears the account so an unpaid bill
                        can never sit tagged to Rohan/Eklavya/Cash pretending to be a receipt. */}
                    <button type="button"
                      onClick={() => { setIsCredit(true); setPayAccount(''); setAmountReceived(''); }}
                      className={`p-3 rounded-md border-2 border-dashed flex flex-col items-center gap-1 transition-all text-center ${isCredit ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-gray-200 hover:border-gray-300 text-gray-500'}`}>
                      <Clock className="w-5 h-5" />
                      <span className="text-xs leading-tight">Credit · pay later</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Amount received — prefilled with the full total; edit only for part payment */}
              <div>
                <label className="text-sm font-medium">Amount Received</label>
                <input type="number" value={amountReceived || ''} disabled={isCredit}
                  onChange={(e) => setAmountReceived(e.target.value)}
                  className="w-full mt-1 px-4 py-2.5 border rounded-md text-lg focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:bg-gray-100 disabled:text-gray-400"
                  placeholder={isCredit ? 'Nothing collected — credit sale' : '0'} />
                {isCredit || receivedAmt <= 0 ? (
                  <p className="mt-2 inline-flex items-center gap-1.5 text-amber-600 font-medium text-sm">
                    <Clock className="w-4 h-4" /> This bill will be saved as PENDING PAYMENT
                  </p>
                ) : receivedAmt < grandTotal ? (
                  <p className="mt-2 text-amber-600 font-medium text-sm">Partly paid · Balance due: {formatCurrency(getBalanceDue())}</p>
                ) : (
                  <p className="mt-2 text-green-700 font-medium text-sm">Paid in full{changeAmount > 0 ? ` · Change: ${formatCurrency(changeAmount)}` : ''}</p>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="text-sm font-medium">Notes (optional)</label>
                <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any remarks..."
                  className="w-full mt-1 px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
              </div>

              {/* In edit mode the primary action is simply saving; reprinting is optional. */}
              {editId ? (
                <>
                  <button onClick={handleCompleteWithoutReceipt} disabled={isProcessing}
                    className="w-full py-3 bg-gray-900 text-white rounded-md font-semibold flex items-center justify-center gap-2 hover:bg-gray-800 disabled:opacity-50 transition-colors">
                    {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                    Save changes
                  </button>
                  <div className="flex gap-3">
                    <button onClick={handleDownloadReceipt} disabled={isProcessing}
                      className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-md text-sm flex items-center justify-center gap-2 hover:bg-gray-50 disabled:opacity-50 transition-colors">
                      <Download className="w-4 h-4" /> Save &amp; download
                    </button>
                    <button onClick={handlePrint} disabled={isProcessing}
                      className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-md text-sm flex items-center justify-center gap-2 hover:bg-gray-50 disabled:opacity-50 transition-colors">
                      <Printer className="w-4 h-4" /> Save &amp; print
                    </button>
                  </div>
                </>
              ) : (
                <>
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
                </>
              )}
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
