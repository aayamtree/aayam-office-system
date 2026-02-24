'use client';

import Link from 'next/link';
import { IndianRupee, FileText, CreditCard, AlertTriangle, TrendingDown, ArrowUpRight, ArrowDownRight, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

export default function FinancePage() {
  const stats = [
    { label: 'Total Revenue', value: '₹12,45,000', change: '+18%', icon: IndianRupee },
    { label: 'Outstanding', value: '₹2,85,000', change: '12 invoices', icon: AlertTriangle },
    { label: 'Received This Month', value: '₹4,50,000', change: '+12%', icon: ArrowDownRight },
    { label: 'Pending Payments', value: '₹95,000', change: '5 vendors', icon: ArrowUpRight },
  ];

  const tools = [
    { href: '/admin/finance/opening-balance', icon: IndianRupee, title: 'Opening Balance', sub: 'FY opening entries' },
    { href: '/admin/finance/banks', icon: CreditCard, title: 'Bank Accounts', sub: 'Multi-bank ledger' },
    { href: '/admin/finance/banking', icon: RefreshCw, title: 'Reconciliation', sub: 'Match statements' },
    { href: '/admin/finance/expenses/quick', icon: TrendingDown, title: 'Quick Expense', sub: 'Fast entry' },
    { href: '/admin/finance/reports/cashbook', icon: FileText, title: 'Cash Book', sub: 'Cash report' },
  ];

  const recentTransactions = [
    { id: 1, type: 'received', client: 'ABC Industries', amount: '₹25,000', date: '2024-12-24', method: 'Bank Transfer' },
    { id: 2, type: 'received', client: 'XYZ Corporation', amount: '₹50,445', date: '2024-12-23', method: 'Cheque' },
    { id: 3, type: 'paid', client: 'Paper World Supplies', amount: '₹18,500', date: '2024-12-23', method: 'Bank Transfer' },
    { id: 4, type: 'received', client: 'Global Traders', amount: '₹1,00,000', date: '2024-12-22', method: 'Cash' },
    { id: 5, type: 'paid', client: 'Ink Solutions', amount: '₹8,750', date: '2024-12-22', method: 'UPI' },
  ];

  const overdueInvoices = [
    { id: 'INV-2024-089', client: 'Tech Solutions', amount: '₹45,000', dueDate: '2024-12-15', days: 10 },
    { id: 'INV-2024-078', client: 'Print Masters', amount: '₹32,500', dueDate: '2024-12-10', days: 15 },
    { id: 'INV-2024-065', client: 'Fashion Hub', amount: '₹28,000', dueDate: '2024-12-05', days: 20 },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight">Finance</h1>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/admin/finance/payments?new=true" className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" /> Record Payment
            </Link>
          </Button>
          <Button asChild>
            <Link href="/admin/finance/invoices?new=true" className="flex items-center gap-2">
              <FileText className="h-4 w-4" /> New Invoice
            </Link>
          </Button>
        </div>
      </div>

      {/* Quick Tools */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {tools.map((t) => (
          <Link key={t.href} href={t.href} className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors">
            <div className="w-8 h-8 bg-muted rounded-md flex items-center justify-center shrink-0">
              <t.icon className="h-4 w-4 text-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">{t.title}</p>
              <p className="text-xs text-muted-foreground">{t.sub}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{stat.label}</CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{stat.change}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/admin/finance/invoices">
          <Card className="hover:shadow-md transition-shadow h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                  <FileText className="h-4 w-4 text-foreground" />
                </div>
                <div>
                  <CardTitle className="text-sm font-medium">Invoices</CardTitle>
                  <p className="text-xs text-muted-foreground">156 total invoices</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-xs">
                <Badge variant="outline">132 Paid</Badge>
                <Badge variant="outline">12 Pending</Badge>
                <Badge variant="destructive">12 Overdue</Badge>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/finance/vendors">
          <Card className="hover:shadow-md transition-shadow h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                  <CreditCard className="h-4 w-4 text-foreground" />
                </div>
                <div>
                  <CardTitle className="text-sm font-medium">Purchases</CardTitle>
                  <p className="text-xs text-muted-foreground">Vendors & Bills</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-xs">
                <Badge variant="outline">34 Vendors</Badge>
                <Badge variant="outline">Manage Bills</Badge>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/finance/payments">
          <Card className="hover:shadow-md transition-shadow h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                  <CreditCard className="h-4 w-4 text-foreground" />
                </div>
                <div>
                  <CardTitle className="text-sm font-medium">Payments</CardTitle>
                  <p className="text-xs text-muted-foreground">Track all transactions</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-xs">
                <Badge variant="outline">₹4.5L Received</Badge>
                <Badge variant="destructive">₹95K Paid</Badge>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Recent Transactions + Overdue Invoices */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Recent Transactions</CardTitle>
              <Button variant="ghost" size="sm" asChild className="h-7 text-xs">
                <Link href="/admin/finance/payments">View All</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentTransactions.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-md flex items-center justify-center ${tx.type === 'received' ? 'bg-muted' : 'bg-destructive/10'}`}>
                      {tx.type === 'received' ? <ArrowDownRight className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4 text-destructive" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{tx.client}</p>
                      <p className="text-xs text-muted-foreground">{tx.method} • {tx.date}</p>
                    </div>
                  </div>
                  <span className={`text-sm font-semibold ${tx.type === 'received' ? 'text-foreground' : 'text-destructive'}`}>
                    {tx.type === 'received' ? '+' : '-'}{tx.amount}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Overdue Invoices</CardTitle>
              <Badge variant="destructive">{overdueInvoices.length} overdue</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {overdueInvoices.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between p-3 rounded-lg border border-destructive/20 bg-destructive/5 hover:bg-destructive/10 transition-colors">
                  <div>
                    <p className="text-sm font-medium">{inv.id}</p>
                    <p className="text-xs text-muted-foreground">{inv.client}</p>
                    <Badge variant="destructive" className="mt-1 text-xs">{inv.days} days overdue</Badge>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{inv.amount}</p>
                    <p className="text-xs text-muted-foreground">Due: {inv.dueDate}</p>
                  </div>
                </div>
              ))}
            </div>
            <Button variant="outline" className="w-full mt-3" asChild>
              <Link href="/admin/finance/invoices?status=overdue">Send Payment Reminders</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Monthly Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 rounded-lg border">
              <p className="text-xs text-muted-foreground mb-1">Total Invoiced</p>
              <p className="text-lg font-semibold">₹5,25,000</p>
            </div>
            <div className="p-3 rounded-lg border">
              <p className="text-xs text-muted-foreground mb-1">Collected</p>
              <p className="text-lg font-semibold">₹4,50,000</p>
            </div>
            <div className="p-3 rounded-lg border">
              <p className="text-xs text-muted-foreground mb-1">Pending</p>
              <p className="text-lg font-semibold text-destructive">₹75,000</p>
            </div>
            <div className="p-3 rounded-lg border">
              <p className="text-xs text-muted-foreground mb-1">Expenses</p>
              <p className="text-lg font-semibold">₹1,85,000</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
