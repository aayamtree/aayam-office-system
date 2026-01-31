'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Plus, Minus, Trash2, ShoppingCart,
  Printer, CreditCard, Banknote, Smartphone, X, Search, User,
  Settings, Edit, Check, FolderPlus, Loader2, Download
} from 'lucide-react';
import { ReceiptData, defaultReceiptCompany, printReceipt, downloadReceipt } from '@/components/receipt/ReceiptPDF';
import { usePOSSales, usePOSProducts } from '@/lib/hooks';
import { POSCategory, POSProduct } from '@/types/database';

interface CartItem {
  id: string;
  name: string;
  price: number;
  qty: number;
  total: number;
}

const categoryColors = [
  'bg-blue-100 text-blue-700',
  'bg-[rgba(0,0,255,0.1)] text-oms-blue',
  'bg-green-100 text-green-700',
  'bg-amber-100 text-amber-700',
  'bg-pink-100 text-pink-700',
  'bg-cyan-100 text-cyan-700',
  'bg-red-100 text-red-700',
  'bg-[rgba(0,0,255,0.1)] text-oms-blue',
  'bg-orange-100 text-orange-700',
  'bg-teal-100 text-teal-700',
  'bg-lime-100 text-lime-700',
  'bg-rose-100 text-rose-700',
];

export default function RetailPOSPage() {
  const { createPOSSale } = usePOSSales();
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

  // Settings Modal State
  const [activeTab, setActiveTab] = useState<'products' | 'categories'>('products');
  const [isEditingProduct, setIsEditingProduct] = useState(false);
  const [productForm, setProductForm] = useState({ id: '', name: '', price: 0, category_id: '' });
  const [categoryForm, setCategoryForm] = useState({ id: '', name: '', color: categoryColors[0] });

  const filteredProducts = products?.filter(p => {
    const matchesCategory = selectedCategory === 'all' || p.category_id === selectedCategory;
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
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
      setCart([...cart, {
        id: product.id,
        name: product.name,
        price: product.price,
        qty: 1,
        total: product.price
      }]);
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

  const removeFromCart = (id: string) => {
    setCart(cart.filter(item => item.id !== id));
  };

  const subtotal = cart.reduce((sum, item) => sum + item.total, 0);
  const discountAmount = (subtotal * discount) / 100;
  const grandTotal = subtotal - discountAmount;
  const changeAmount = parseFloat(amountReceived || '0') - grandTotal;

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
    if (confirm('Delete this category? Products in this category might be affected.')) {
      await deleteCategory(id);
    }
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

  const handleEditProductClick = (p: POSProduct) => {
    setProductForm({ id: p.id, name: p.name, price: p.price, category_id: p.category_id });
    setIsEditingProduct(true);
  };

  const handleDeleteProductReq = async (id: string) => {
    if (confirm('Delete this product?')) {
      await deleteProduct(id);
    }
  };

  const clearCart = () => {
    setCart([]);
    setCustomerName('');
    setCustomerPhone('');
    setDiscount(0);
    setAmountReceived('');
    setShowPaymentModal(false);
  };

  const [isProcessing, setIsProcessing] = useState(false);

  const saveSale = async () => {
    setIsProcessing(true);
    try {
      const saleData = {
        customer_name: customerName,
        customer_phone: customerPhone,
        subtotal,
        discount_percent: discount,
        discount_amount: discountAmount,
        total_amount: grandTotal,
        payment_mode: paymentMethod,
        amount_received: parseFloat(amountReceived) || grandTotal,
        change_amount: changeAmount > 0 ? changeAmount : 0,
      };

      const saleItems = cart.map(item => ({
        product_id: item.id, // Might need to ensure item.id handles non-database items gracefully if any
        product_name: item.name, // Fallback if name changes
        quantity: item.qty,
        price: item.price,
        total: item.total
      }));

      const result = await createPOSSale(saleData, saleItems);
      if (result.error) {
        alert('Failed to save sale: ' + result.error);
        return null;
      }
      return result.data?.sale_number;
    } catch (e) {
      console.error(e);
      alert('An unexpected error occurred.');
      return null;
    }
  };

  const handlePrint = async () => {
    const saleNumber = await saveSale();
    if (!saleNumber) {
      setIsProcessing(false);
      return;
    }

    try {
      const now = new Date();
      const receiptData: ReceiptData = {
        ...defaultReceiptCompany,
        receiptNumber: saleNumber,
        date: now.toLocaleDateString('en-IN'),
        time: now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
        customerName: customerName || undefined,
        customerPhone: customerPhone || undefined,
        items: cart.map(item => ({
          name: item.name,
          qty: item.qty,
          price: item.price,
          total: item.total,
        })),
        subtotal,
        discountPercent: discount,
        discountAmount,
        grandTotal,
        paymentMode: paymentMethod,
        amountReceived: parseFloat(amountReceived) || grandTotal,
        change: changeAmount > 0 ? changeAmount : 0,
        cashier: 'SATISH',
      };

      await printReceipt(receiptData);
      clearCart();
    } catch (error) {
      console.error('Error printing receipt:', error);
      alert('Error printing receipt. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadReceipt = async () => {
    const saleNumber = await saveSale();
    if (!saleNumber) {
      setIsProcessing(false);
      return;
    }

    try {
      const now = new Date();
      const receiptData: ReceiptData = {
        ...defaultReceiptCompany,
        receiptNumber: saleNumber,
        date: now.toLocaleDateString('en-IN'),
        time: now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
        customerName: customerName || undefined,
        customerPhone: customerPhone || undefined,
        items: cart.map(item => ({
          name: item.name,
          qty: item.qty,
          price: item.price,
          total: item.total,
        })),
        subtotal,
        discountPercent: discount,
        discountAmount,
        grandTotal,
        paymentMode: paymentMethod,
        amountReceived: parseFloat(amountReceived) || grandTotal,
        change: changeAmount > 0 ? changeAmount : 0,
        cashier: 'SATISH',
      };

      await downloadReceipt(receiptData);
      clearCart();
    } catch (error) {
      console.error('Error downloading receipt:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const formatCurrency = (amount: number) => `₹${amount.toLocaleString('en-IN')}`;

  return (
    <div className="h-[calc(100vh-80px)] flex flex-col">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin/cmyk-print" className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-page-title text-gray-900">Retail POS</h1>
            <p className="text-sm text-gray-500">Quick billing system</p>
          </div>
        </div>
        <button onClick={() => setShowSettingsModal(true)}
          className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
          <Settings size={18} />
          <span className="hidden sm:inline">Manage Items</span>
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Products Section */}
        <div className="flex-1 flex flex-col p-4 overflow-hidden">
          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input type="text" placeholder="Search products..." value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>

          {/* Categories */}
          <div className="flex flex-wrap gap-2 mb-4">
            <button onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${selectedCategory === 'all' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
              All
            </button>
            {categories?.map(cat => (
              <button key={cat.id} onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${selectedCategory === cat.id ? 'bg-gray-900 text-white' : `${cat.color} hover:opacity-80`}`}>
                {cat.name}
              </button>
            ))}
          </div>

          {/* Products Grid */}
          <div className="flex-1 overflow-y-auto">
            {productsLoading ? (
              <div className="flex items-center justify-center h-full text-gray-500">
                <Loader2 className="animate-spin mr-2" /> Loading products...
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <p>No products found in this category.</p>
                <button onClick={() => setShowSettingsModal(true)} className="mt-2 text-oms-blue font-medium">Add Products</button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {filteredProducts.map(product => (
                  <button key={product.id} onClick={() => addToCart(product)}
                    className="p-3 bg-white border rounded-lg hover:shadow-md hover:border-indigo-300 transition-all text-left flex flex-col justify-between h-full">
                    <div>
                      <p className="font-medium text-gray-900 text-sm line-clamp-2">{product.name}</p>
                      <p className="text-xs text-gray-500 mt-1">{product.category?.name}</p>
                    </div>
                    <p className="text-oms-blue font-bold mt-2">{formatCurrency(product.price)}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Cart Section */}
        <div className="w-full lg:w-96 border-t lg:border-t-0 lg:border-l bg-gray-50 flex flex-col">
          <div className="p-4 border-b bg-white">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ShoppingCart size={20} className="text-oms-blue" />
                <span className="font-semibold">Cart ({cart.length})</span>
              </div>
              {cart.length > 0 && (
                <button onClick={clearCart} className="text-red-600 text-sm hover:underline">Clear</button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input type="text" placeholder="Customer Name" value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <input type="tel" placeholder="Phone" value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>

          {/* Cart Items */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {cart.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <ShoppingCart size={40} className="mx-auto mb-2 opacity-50" />
                <p>Cart is empty</p>
              </div>
            ) : (
              cart.map(item => (
                <div key={item.id} className="bg-white p-3 rounded-lg border">
                  <div className="flex justify-between mb-2">
                    <span className="font-medium text-sm">{item.name}</span>
                    <button onClick={() => removeFromCart(item.id)} className="text-red-500"><Trash2 size={14} /></button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button onClick={() => updateQty(item.id, -1)} className="w-7 h-7 bg-gray-100 rounded flex items-center justify-center hover:bg-gray-200"><Minus size={14} /></button>
                      <span className="w-8 text-center font-medium">{item.qty}</span>
                      <button onClick={() => updateQty(item.id, 1)} className="w-7 h-7 bg-gray-100 rounded flex items-center justify-center hover:bg-gray-200"><Plus size={14} /></button>
                    </div>
                    <span className="font-bold text-oms-blue">{formatCurrency(item.total)}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Totals & Payment */}
          <div className="p-4 border-t bg-white">
            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-sm"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
              <div className="flex justify-between items-center text-sm">
                <span>Discount</span>
                <div className="flex items-center gap-2">
                  <input type="number" value={discount || ''} onChange={(e) => setDiscount(Math.min(100, parseFloat(e.target.value) || 0))}
                    className="w-16 px-2 py-1 border rounded text-right text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" /><span>%</span>
                </div>
              </div>
              {discount > 0 && <div className="flex justify-between text-sm text-green-600"><span>Discount Amount</span><span>-{formatCurrency(discountAmount)}</span></div>}
              <div className="flex justify-between text-section pt-2 border-t"><span>Grand Total</span><span className="text-oms-blue">{formatCurrency(grandTotal)}</span></div>
            </div>
            <button onClick={() => setShowPaymentModal(true)} disabled={cart.length === 0}
              className="w-full py-3 bg-[rgba(0,0,255,0.1)] text-white rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[rgba(0,0,255,0.1)] transition-colors">
              Pay {formatCurrency(grandTotal)}
            </button>
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md animate-scale-in">
            <div className="p-5 border-b flex items-center justify-between">
              <h2 className="text-page-title">Payment</h2>
              <button onClick={() => setShowPaymentModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="text-center bg-[rgba(0,0,255,0.1)] rounded-xl p-4">
                <p className="text-sm text-gray-600">Total Amount</p>
                <p className="text-page-title text-oms-blue">{formatCurrency(grandTotal)}</p>
              </div>
              <div>
                <p className="text-sm font-medium mb-2">Payment Method</p>
                <div className="grid grid-cols-3 gap-2">
                  {[{ id: 'cash', label: 'Cash', icon: Banknote }, { id: 'card', label: 'Card', icon: CreditCard }, { id: 'upi', label: 'UPI', icon: Smartphone }].map(method => (
                    <button key={method.id} onClick={() => setPaymentMethod(method.id as any)}
                      className={`p-3 rounded-lg border-2 flex flex-col items-center gap-1 transition-all ${paymentMethod === method.id ? 'border-indigo-500 bg-[rgba(0,0,255,0.1)]' : 'border-gray-200 hover:border-gray-300'}`}>
                      <method.icon size={20} /><span className="text-sm">{method.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              {paymentMethod === 'cash' && (
                <div>
                  <label className="text-sm font-medium">Amount Received</label>
                  <input type="number" value={amountReceived} onChange={(e) => setAmountReceived(e.target.value)}
                    className="w-full mt-1 px-4 py-2.5 border rounded-lg text-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Enter amount" />
                  {changeAmount >= 0 && amountReceived && <p className="mt-2 text-green-600 font-medium">Change: {formatCurrency(changeAmount)}</p>}
                </div>
              )}
              <div className="flex gap-3">
                <button onClick={handleDownloadReceipt} disabled={isProcessing}
                  className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-gray-200 disabled:opacity-50 transition-colors">
                  {isProcessing ? <Loader2 size={20} className="animate-spin" /> : <Download size={20} />}
                  Download Receipt
                </button>
                <button onClick={handlePrint} disabled={isProcessing}
                  className="flex-1 py-3 bg-green-600 text-white rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-green-700 disabled:opacity-50 transition-colors">
                  {isProcessing ? <Loader2 size={20} className="animate-spin" /> : <Printer size={20} />}
                  Print & Complete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal (CRUD) */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-scale-in">
            <div className="p-5 border-b bg-white flex items-center justify-between">
              <div className="flex items-center gap-4">
                <h2 className="text-page-title">Manage Items</h2>
                <div className="flex bg-gray-100 p-1 rounded-lg">
                  <button onClick={() => setActiveTab('products')} className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${activeTab === 'products' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>Products</button>
                  <button onClick={() => setActiveTab('categories')} className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${activeTab === 'categories' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>Categories</button>
                </div>
              </div>
              <button onClick={() => setShowSettingsModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
              {activeTab === 'products' ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Product List */}
                  <div className="lg:col-span-2 space-y-4">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-100">
                          <tr>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Product</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Category</th>
                            <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Price</th>
                            <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {products?.map(p => (
                            <tr key={p.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                              <td className="px-4 py-3 text-sm text-gray-500">{p.category?.name}</td>
                              <td className="px-4 py-3 text-right font-medium text-gray-900">{formatCurrency(p.price)}</td>
                              <td className="px-4 py-3 text-right">
                                <div className="flex justify-end gap-2">
                                  <button onClick={() => handleEditProductClick(p)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"><Edit size={16} /></button>
                                  <button onClick={() => handleDeleteProductReq(p.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded"><Trash2 size={16} /></button>
                                </div>
                              </td>
                            </tr>
                          ))}
                          {products?.length === 0 && <tr><td colSpan={4} className="text-center py-4 text-gray-500">No products found</td></tr>}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Add/Edit Product Form */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 h-fit">
                    <h3 className="font-bold text-gray-900 mb-4">{isEditingProduct ? 'Edit Product' : 'Add New Product'}</h3>
                    <form onSubmit={handleSaveProduct} className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                        <input type="text" required value={productForm.name} onChange={e => setProductForm({ ...productForm, name: e.target.value })} className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Price</label>
                        <input type="number" required min="0" value={productForm.price} onChange={e => setProductForm({ ...productForm, price: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                        <select required value={productForm.category_id} onChange={e => setProductForm({ ...productForm, category_id: e.target.value })} className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
                          <option value="">Select Category</option>
                          {categories?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </div>
                      <div className="flex gap-2 pt-2">
                        {isEditingProduct && <button type="button" onClick={() => { setIsEditingProduct(false); setProductForm({ id: '', name: '', price: 0, category_id: '' }) }} className="flex-1 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>}
                        <button type="submit" className="flex-1 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800">{isEditingProduct ? 'Update' : 'Add Product'}</button>
                      </div>
                    </form>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Categories List */}
                  <div className="lg:col-span-2 space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {categories?.map(c => (
                        <div key={c.id} className={`p-4 rounded-xl border flex items-center justify-between ${c.color}`}>
                          <span className="font-semibold">{c.name}</span>
                          <button onClick={() => handleDeleteCategoryReq(c.id)} className="p-1.5 bg-white/50 rounded-lg hover:bg-white text-red-600 transition-colors"><Trash2 size={16} /></button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Add Category Form */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 h-fit">
                    <h3 className="font-bold text-gray-900 mb-4">Add New Category</h3>
                    <form onSubmit={handleSaveCategory} className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                        <input type="text" required value={categoryForm.name} onChange={e => setCategoryForm({ ...categoryForm, name: e.target.value })} className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
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
                      <button type="submit" className="w-full py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 mt-2">Add Category</button>
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
