'use client';

import Link from 'next/link';
import { BarChart3, TrendingUp, Truck, FileText, Download, Loader2, Search, Printer, Calendar, ArrowRightLeft, DollarSign } from 'lucide-react';
import { useDashboardStats, useClients, useJobs, usePaymentsReceived, useVendors, usePurchaseBills, useVendorPayments, useExpenses } from '@/lib/hooks';
import { useState } from 'react';
import { exportToCSV } from '@/lib/csv-export';

export default function ReportsPage() {
  const { stats, loading } = useDashboardStats();
  const [activeTab, setActiveTab] = useState<'client' | 'vendor' | 'cashflow'>('client');

  return (
    <div className="space-y-3 md:space-y-6 animate-fade-in pb-16 md:pb-20">
      {/* Header */}
      <div>
        <h1 className="text-page-title text-gray-900">Reports Center</h1>
        <p className="text-gray-500">Financial statements, sales analytics, and cash flow</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8 overflow-x-auto">
          <button
            onClick={() => setActiveTab('client')}
            className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'client'
              ? 'border-primary text-primary'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
          >
            Client Statement
          </button>
          <button
            onClick={() => setActiveTab('vendor')}
            className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'vendor'
              ? 'border-primary text-primary'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
          >
            Vendor Statement
          </button>
          <button
            onClick={() => setActiveTab('cashflow')}
            className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'cashflow'
              ? 'border-primary text-primary'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
          >
            Cash Flow Report
          </button>
        </nav>
      </div>

      {activeTab === 'client' && <ClientStatementGenerator />}
      {activeTab === 'vendor' && <VendorStatementGenerator />}
      {activeTab === 'cashflow' && <CashFlowStatement />}

      {/* Manual Journal Link */}
      <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-lg md:rounded-lg p-3 md:p-4 text-white flex justify-between items-center">
        <div>
          <h3 className="text-section mb-1">Manual Journal Entry</h3>
          <p className="text-gray-300 text-sm">Record accounting adjustments and non-cash transactions</p>
        </div>
        <Link href="/admin/finance/journal" className="px-4 py-2 bg-white text-gray-900 rounded-lg font-bold hover:bg-gray-100 transition-colors">
          Open Journal
        </Link>
      </div>

    </div>
  );
}

function ClientStatementGenerator() {
  const { clients } = useClients();
  const { jobs } = useJobs();
  const { paymentsReceived: payments } = usePaymentsReceived();

  const [selectedClientId, setSelectedClientId] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [showStatement, setShowStatement] = useState(false);

  const generateStatement = () => {
    if (!selectedClientId) return alert('Please select a client');
    setShowStatement(true);
  };

  const client = clients?.find(c => c.id === selectedClientId);

  // MERGE LEGER
  const mergedLedger = client ? [
    ...(jobs?.filter(j => j.client_id === selectedClientId) || []).map(j => ({
      date: j.created_at, type: 'INVOICE', ref: j.job_number,
      desc: j.project_name, debit: j.total_amount, credit: 0,
      mode: '-'
    })),
    ...(payments?.filter(p => p.client_id === selectedClientId) || []).map(p => ({
      date: p.payment_date, type: 'PAYMENT', ref: p.payment_number,
      desc: 'Payment Received', debit: 0, credit: p.amount,
      mode: p.payment_mode
    }))
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()) : [];

  // Filter by Date
  const filteredLedger = mergedLedger.filter(item => {
    if (dateRange.start && new Date(item.date) < new Date(dateRange.start)) return false;
    if (dateRange.end && new Date(item.date) > new Date(dateRange.end + 'T23:59:59')) return false;
    return true;
  });

  return (
    <div className="bg-white rounded-lg md:rounded-lg p-3 md:p-4 border border-gray-100 animate-scale-in">
      {/* ... Header UI ... */}
      <div className="flex items-center gap-3 mb-3 md:mb-1.5">
        <div className="w-10 h-10 bg-gray-900 rounded-lg flex items-center justify-center text-white">
          <FileText size={20} />
        </div>
        <div>
          <h2 className="text-section text-gray-900">Generate Client Statement</h2>
          <p className="text-sm text-gray-500">Debtor Ledger (Receivables)</p>
        </div>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-2 md:gap-4 items-end mb-3 md:mb-1.5">
        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-1">Select Client</label>
          <select value={selectedClientId} onChange={e => setSelectedClientId(e.target.value)} className="w-full px-3 py-2 border rounded-lg bg-white">
            <option value="">-- Choose Client --</option>
            {clients?.map(c => <option key={c.id} value={c.id}>{c.name} {c.company ? `(${c.company})` : ''}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">From Date</label>
          <input type="date" className="w-full px-3 py-2 border rounded-lg" onChange={e => setDateRange({ ...dateRange, start: e.target.value })} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">To Date</label>
          <input type="date" className="w-full px-3 py-2 border rounded-lg" onChange={e => setDateRange({ ...dateRange, end: e.target.value })} />
        </div>
      </div>
      <button onClick={generateStatement} className="px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-900 font-medium w-full md:w-auto">
        Generate Statement
      </button>

      {/* Detail Modal */}
      {showStatement && client && (
        <StatementModal
          title="Statement of Account"
          entity={client}
          period={dateRange}
          ledger={filteredLedger}
          onClose={() => setShowStatement(false)}
          columns={['Description', 'Mode', 'Debit (Inv)', 'Credit (Rec)']}
        />
      )}
    </div>
  );
}

function VendorStatementGenerator() {
  const { vendors } = useVendors();
  const { purchaseBills: bills } = usePurchaseBills();
  const { vendorPayments: payments } = useVendorPayments();

  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [showStatement, setShowStatement] = useState(false);

  const vendor = vendors?.find(v => v.id === selectedVendorId);

  const mergedLedger = vendor ? [
    ...(bills?.filter(b => b.vendor_id === selectedVendorId) || []).map(b => ({
      date: b.bill_date, type: 'BILL', ref: b.bill_number,
      desc: b.description || 'Purchase Bill', debit: 0, credit: b.total_amount, // Crediting Vendor (We owe)
      mode: '-'
    })),
    ...(payments?.filter(p => p.vendor_id === selectedVendorId) || []).map(p => ({
      date: p.payment_date, type: 'PAYMENT', ref: p.payment_number,
      desc: 'Payment Made', debit: p.amount, credit: 0, // Debiting Vendor (We paid)
      mode: p.payment_mode
    }))
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()) : [];

  // Filter by Date
  const filteredLedger = mergedLedger.filter(item => {
    if (dateRange.start && new Date(item.date) < new Date(dateRange.start)) return false;
    if (dateRange.end && new Date(item.date) > new Date(dateRange.end + 'T23:59:59')) return false;
    return true;
  });

  return (
    <div className="bg-white rounded-lg md:rounded-lg p-3 md:p-4 border border-gray-100 animate-scale-in">
      <div className="flex items-center gap-3 mb-3 md:mb-1.5">
        <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center text-destructive">
          <Truck size={20} />
        </div>
        <div>
          <h2 className="text-section text-gray-900">Generate Vendor Statement</h2>
          <p className="text-sm text-gray-500">Creditor Ledger (Payables)</p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-2 md:gap-4 items-end mb-3 md:mb-1.5">
        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-1">Select Vendor</label>
          <select value={selectedVendorId} onChange={e => setSelectedVendorId(e.target.value)} className="w-full px-3 py-2 border rounded-lg bg-white">
            <option value="">-- Choose Vendor --</option>
            {vendors?.map(v => <option key={v.id} value={v.id}>{v.name} {v.company ? `(${v.company})` : ''}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">From Date</label>
          <input type="date" className="w-full px-3 py-2 border rounded-lg" onChange={e => setDateRange({ ...dateRange, start: e.target.value })} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">To Date</label>
          <input type="date" className="w-full px-3 py-2 border rounded-lg" onChange={e => setDateRange({ ...dateRange, end: e.target.value })} />
        </div>
      </div>
      <button onClick={() => selectedVendorId && setShowStatement(true)} className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-900 font-medium w-full md:w-auto">
        Generate Statement
      </button>

      {showStatement && vendor && (
        <StatementModal
          title="Vendor Statement"
          entity={vendor}
          period={dateRange}
          ledger={filteredLedger}
          onClose={() => setShowStatement(false)}
          columns={['Description', 'Mode', 'Debit (Paid)', 'Credit (Billed)']}
          // Vendor balance is Credit dominated usually (Payables). 
          // But here we used Debit=Paid, Credit=Bill. 
          // Running Balance (Debit - Credit) would be negative if we owe money.
          // To show "Amount Payable" as positive, we might flip signs in display?
          // Standard: Cr Balance = Payable. Dr Balance = Advance Paid.
          reverseBalanceColor={true}
        />
      )}
    </div>
  )
}

function CashFlowStatement() {
  const { paymentsReceived: inflows } = usePaymentsReceived();
  const { vendorPayments: vendorOutflows } = useVendorPayments();
  const { expenses } = useExpenses();

  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  const mergedFlow = [
    ...(inflows || []).map(i => ({
      date: i.payment_date, type: 'INFLOW', ref: i.payment_number,
      desc: `Received from ${i.client?.name || 'Client'}`, amount: i.amount, mode: i.payment_mode
    })),
    ...(vendorOutflows || []).map(o => ({
      date: o.payment_date, type: 'OUTFLOW', ref: o.payment_number,
      desc: `Paid to ${o.vendor?.name || 'Vendor'}`, amount: -o.amount, mode: o.payment_mode
    })),
    ...(expenses || []).map(e => ({
      date: e.expense_date, type: 'EXPENSE', ref: e.expense_number,
      desc: `${e.category}: ${e.description || ''}`, amount: -e.amount, mode: e.payment_mode || 'cash'
    }))
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const filteredFlow = mergedFlow.filter(item => {
    if (dateRange.start && new Date(item.date) < new Date(dateRange.start)) return false;
    if (dateRange.end && new Date(item.date) > new Date(dateRange.end + 'T23:59:59')) return false;
    return true;
  });

  const totalIn = filteredFlow.filter(f => f.amount > 0).reduce((sum, f) => sum + f.amount, 0);
  const totalOut = filteredFlow.filter(f => f.amount < 0).reduce((sum, f) => sum + Math.abs(f.amount), 0);
  const netFlow = totalIn - totalOut;

  return (
    <div className="bg-white rounded-lg md:rounded-lg p-3 md:p-4 border border-gray-100 animate-scale-in">
      <div className="flex items-center gap-3 mb-3 md:mb-1.5">
        <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-gray-900">
          <ArrowRightLeft size={20} />
        </div>
        <div>
          <h2 className="text-section text-gray-900">Cash Flow Statement</h2>
          <p className="text-sm text-gray-500">Inflow vs Outflow Analysis</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 md:gap-4 mb-3 md:mb-1.5">
        <div>
          <label className="block text-sm font-medium mb-1">From</label>
          <input type="date" value={dateRange.start} className="px-3 py-2 border rounded-lg" onChange={e => setDateRange({ ...dateRange, start: e.target.value })} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">To</label>
          <input type="date" value={dateRange.end} className="px-3 py-2 border rounded-lg" onChange={e => setDateRange({ ...dateRange, end: e.target.value })} />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-4 mb-3 md:mb-1.5">
        <div className="bg-white p-4 rounded-lg border border-green-100">
          <p className="text-sm text-gray-900 font-medium">Total Inflow</p>
          <p className="text-page-title text-gray-900">₹{totalIn.toLocaleString()}</p>
        </div>
        <div className="bg-red-50 p-4 rounded-lg border border-red-100">
          <p className="text-sm text-red-600 font-medium">Total Outflow</p>
          <p className="text-page-title text-red-700">₹{totalOut.toLocaleString()}</p>
        </div>
        <div className={`p-4 rounded-lg border ${netFlow >= 0 ? 'bg-gray-900 border-gray-300' : 'bg-white border-gray-100'}`}>
          <p className={`text-sm font-medium ${netFlow >= 0 ? 'text-primary' : 'text-destructive'}`}>Net Cash Flow</p>
          <p className={`text-page-title ${netFlow >= 0 ? 'text-primary' : 'text-amber-700'}`}>
            {netFlow >= 0 ? '+' : ''}₹{netFlow.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Print Button */}
      <div className="mt-4 flex justify-end gap-2">
        <button onClick={() => exportToCSV(filteredFlow.map(f => ({ ...f, amount_display: f.amount })), [
          { header: 'Date', accessor: (r: any) => new Date(r.date).toLocaleDateString('en-IN') },
          { header: 'Description', accessor: (r: any) => r.desc },
          { header: 'Reference', accessor: (r: any) => r.ref },
          { header: 'Type', accessor: (r: any) => r.type },
          { header: 'Mode', accessor: (r: any) => r.mode },
          { header: 'Amount', accessor: (r: any) => r.amount },
        ], 'cashflow_report')} className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 rounded-lg hover:bg-gray-50 border">
          <Download size={16} /> Export CSV
        </button>
        <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
          <Printer size={16} /> Print Report
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto border rounded-lg mt-4">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="py-3 px-4 font-semibold text-gray-600">Date</th>
              <th className="py-3 px-4 font-semibold text-gray-600">Description</th>
              <th className="py-3 px-4 font-semibold text-gray-600">Type</th>
              <th className="py-3 px-4 font-semibold text-gray-600 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredFlow.length === 0 ? (
              <tr><td colSpan={4} className="py-8 text-center text-gray-500">No transactions found in this period.</td></tr>
            ) : filteredFlow.map((flow, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="py-3 px-4 text-gray-500">{new Date(flow.date).toLocaleDateString()}</td>
                <td className="py-3 px-4 font-medium">{flow.desc} <span className="text-xs text-gray-400">({flow.ref})</span></td>
                <td className="py-3 px-4">
                  <span className={`px-2 py-0.5 rounded textxs font-bold uppercase text-xs ${flow.type === 'INFLOW' ? 'bg-gray-100 text-gray-900' : 'bg-red-100 text-red-700'
                    }`}>{flow.type}</span>
                </td>
                <td className={`py-3 px-4 text-right font-mono font-medium ${flow.amount > 0 ? 'text-gray-900' : 'text-red-600'}`}>
                  {flow.amount > 0 ? '+' : ''}{flow.amount.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// Shared Modal Component
function StatementModal({ title, entity, period, ledger, onClose, columns, reverseBalanceColor }: any) {
  // Calculate running balance and totals
  let runningBalance = 0;
  const totals = ledger.reduce((acc: any, row: any) => ({
    debit: acc.debit + row.debit,
    credit: acc.credit + row.credit
  }), { debit: 0, credit: 0 });

  return (
    <div className="fixed inset-0 bg-white z-[100] overflow-auto p-4 md:p-8 animate-fade-in">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-start mb-1.5 border-b pb-4">
          <div>
            <h1 className="text-page-title uppercase tracking-widest text-gray-900">{title}</h1>
            <p className="text-gray-500 mt-1">Aayam Office System</p>
          </div>
          <div className="text-right flex gap-2 print:hidden">
            <button onClick={() => exportToCSV(ledger, [
              { header: 'Date', accessor: (r: any) => new Date(r.date).toLocaleDateString('en-IN') },
              { header: 'Reference', accessor: (r: any) => r.ref },
              { header: 'Description', accessor: (r: any) => r.desc },
              { header: 'Mode', accessor: (r: any) => r.mode !== '-' ? r.mode : '' },
              { header: 'Debit', accessor: (r: any) => r.debit || '' },
              { header: 'Credit', accessor: (r: any) => r.credit || '' },
            ], `statement_${entity.name}`)} className="px-4 py-2 bg-white text-gray-700 rounded-lg flex items-center gap-2 hover:bg-gray-50 border">
              <Download size={16} /> CSV
            </button>
            <button onClick={() => window.print()} className="px-4 py-2 bg-gray-900 text-white rounded-lg flex items-center gap-2 hover:bg-gray-800">
              <Printer size={16} /> Print
            </button>
            <button onClick={onClose} className="px-4 py-2 text-gray-500 hover:text-red-500 border rounded-md">Close</button>
          </div>
        </div>

        <div className="flex justify-between mb-1.5">
          <div>
            <p className="text-xs text-gray-400 uppercase font-bold">To</p>
            <h3 className="text-page-title">{entity.name}</h3>
            <p>{entity.company}</p>
            <p className="text-gray-500">{entity.phone}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400 uppercase font-bold">Statement Period</p>
            <p className="font-medium">{period.start || 'Beginning'} - {period.end || 'Today'}</p>
          </div>
        </div>

        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-50 border-y border-gray-200">
              <th className="py-3 text-left font-semibold text-gray-600 pl-2">Date</th>
              <th className="py-3 text-left font-semibold text-gray-600">Ref</th>
              <th className="py-3 text-left font-semibold text-gray-600 w-1/3">{columns[0]}</th>
              <th className="py-3 text-left font-semibold text-gray-600">{columns[1]}</th>
              <th className="py-3 text-right font-semibold text-gray-600">{columns[2]}</th>
              <th className="py-3 text-right font-semibold text-gray-600">{columns[3]}</th>
              <th className="py-3 text-right font-semibold text-gray-600 pr-2">Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {ledger.length === 0 ? (
              <tr><td colSpan={7} className="py-8 text-center text-gray-400">No transactions found</td></tr>
            ) : ledger.map((row: any, i: number) => {
              runningBalance += (row.debit - row.credit); // Standard: Dr+ Cr-
              // For Vendor, if Credit (Bill) > Debit (Paid), Balance is Negative (Payable).
              // We can display Absolute value and Dr/Cr suffix if we want, but keeping signed number is clearer for internal view.
              return (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="py-3 pl-2 text-gray-500">{new Date(row.date).toLocaleDateString('en-IN')}</td>
                  <td className="py-3 font-mono text-xs">{row.ref}</td>
                  <td className="py-3 font-medium">{row.desc}</td>
                  <td className="py-3 text-xs uppercase text-gray-400">{row.mode !== '-' ? row.mode : ''}</td>
                  <td className="py-3 text-right text-gray-600">{row.debit > 0 ? row.debit.toLocaleString() : '-'}</td>
                  <td className="py-3 text-right text-gray-600">{row.credit > 0 ? row.credit.toLocaleString() : '-'}</td>
                  <td className={`py-3 text-right font-bold pr-2 ${reverseBalanceColor
                    ? (runningBalance < 0 ? 'text-red-600' : 'text-gray-900') // Vendor: Negative is Payable (Red?) Wait. Payable = Bad (Red)? No Payable is standard. 
                    // Let's stick to: Negative balance = Credit Balance (Payable).
                    : (runningBalance > 0 ? 'text-primary' : 'text-red-700')
                    }`}>
                    {Math.abs(runningBalance).toLocaleString()} {runningBalance < 0 ? 'Cr' : 'Dr'}
                  </td>
                </tr>
              );
            })}
            {/* TOTALS */}
            <tr className="bg-gray-50 font-bold border-t-2 border-gray-200">
              <td colSpan={4} className="py-4 pl-2 text-right uppercase">Total</td>
              <td className="py-4 text-right text-gray-900">{totals.debit.toLocaleString()}</td>
              <td className="py-4 text-right text-gray-900">{totals.credit.toLocaleString()}</td>
              <td className="py-4 text-right pr-2 text-lg">
                {Math.abs(runningBalance).toLocaleString()} {runningBalance < 0 ? 'Cr' : 'Dr'}
              </td>
            </tr>
          </tbody>
        </table>

        <div className="mt-12 pt-8 border-t text-center text-gray-400 text-xs">
          <p>Generated by Aayam Office System on {new Date().toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
}
