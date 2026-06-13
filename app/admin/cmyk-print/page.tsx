'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Printer, ShoppingCart, Package, Clock, CheckCircle, AlertTriangle, Calculator, BarChart2, Receipt, X, Loader2, BookOpen, ShoppingBag } from 'lucide-react';
import { useJobs, usePaperStock, usePOSSales, useCMYKJobLogs, useVendors } from '@/lib/hooks';
import { useAuth } from '@/lib/auth-context';
import DriveConnectionStatus from '@/components/drive/DriveConnectionStatus';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { toast } from '@/lib/toast';

export default function CMYKPrintPage() {
  const { profile } = useAuth();
  const { jobs, loading: jobsLoading, refetch: refetchJobs } = useJobs({
    orderBy: { column: 'created_at', ascending: false }
  });
  const { stock, loading: stockLoading, refetch: refetchStock } = usePaperStock();
  const { sales, loading: salesLoading } = usePOSSales();
  const { logs, completeJob } = useCMYKJobLogs();
  const { vendors } = useVendors();

  // Match ALL vendors with CMYK in the name (handles "CMYK", "AAYAM CMYK", etc.)
  const cmykVendorIds = vendors
    .filter(v => v.name?.toLowerCase().includes('cmyk'))
    .map(v => v.id);

  const loading = jobsLoading || stockLoading || salesLoading;

  // Start Print Modal state
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [selectedPaperId, setSelectedPaperId] = useState('');
  const [sheetsUsed, setSheetsUsed] = useState('');
  const [printNotes, setPrintNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // CMYK queue: any job assigned to CMYK vendor that hasn't been dispatched/delivered yet
  const DONE_STAGES = ['finishing', 'quality_check', 'ready', 'dispatched', 'delivered', 'cancelled'];
  const pendingJobs = jobs.filter(j =>
    !DONE_STAGES.includes(j.current_stage) &&
    cmykVendorIds.length > 0 &&
    j.vendor_id &&
    cmykVendorIds.includes(j.vendor_id)
  ).slice(0, 10);
  const completedTodayJobs = logs.filter(l => {
    const d = new Date(l.completed_at || l.created_at);
    const today = new Date();
    return d.toDateString() === today.toDateString() && l.status === 'completed';
  });
  const lowStockItems = stock.filter(s => s.quantity <= s.reorder_level).slice(0, 5);
  const todaysSalesTotal = sales.slice(0, 10).reduce((sum, s) => sum + s.total_amount, 0);

  const selectedPaper = stock.find(p => p.id === selectedPaperId);
  const estimatedCost = selectedPaper && sheetsUsed ? selectedPaper.cost_per_unit * parseInt(sheetsUsed || '0') : 0;
  const insufficientStock = selectedPaper && sheetsUsed ? parseInt(sheetsUsed) > selectedPaper.quantity : false;

  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

  const openPrintModal = (job: any) => {
    setSelectedJob(job);
    setSelectedPaperId('');
    setSheetsUsed('');
    setPrintNotes('');
    setShowPrintModal(true);
  };

  const handleMarkPrinted = async () => {
    if (!selectedJob || !selectedPaperId || !sheetsUsed) {
      toast.error('Please select paper and enter sheets used');
      return;
    }
    if (insufficientStock) {
      toast.error('Insufficient paper stock');
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await completeJob(
        selectedJob.id,
        selectedPaperId,
        parseInt(sheetsUsed),
        profile?.id || '',
        profile?.full_name || profile?.email?.split('@')[0] || 'CMYK',
        printNotes
      );
      if (result.error) {
        toast.error('Failed: ' + result.error);
        return;
      }
      toast.success(`${selectedJob.job_number} marked as printed → moved to finishing`);
      setShowPrintModal(false);
      refetchJobs();
      refetchStock();
    } catch {
      toast.error('Unexpected error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const statCards = [
    { label: 'Recent POS Sales', value: formatCurrency(todaysSalesTotal), change: 'Last 10 sales', icon: ShoppingCart },
    { label: 'Pending Jobs', value: pendingJobs.length.toString(), change: 'In Queue', icon: Clock },
    { label: 'Printed Today', value: completedTodayJobs.length.toString(), change: 'Jobs done', icon: CheckCircle },
    { label: 'Stock Alerts', value: lowStockItems.length.toString(), change: 'Items low', icon: Package },
  ];

  const quickLinks = [
    { href: '/admin/cmyk-print/retail-pos', icon: ShoppingCart, title: 'Retail POS', sub: 'Quick billing', extra: <span className="text-xs text-muted-foreground">Open Counter →</span> },
    { href: '/admin/cmyk-print/paper-stock', icon: Package, title: 'Paper Stock', sub: 'Inventory', extra: lowStockItems.length > 0 ? <Badge variant="destructive">{lowStockItems.length} Low</Badge> : <Badge variant="outline">All Stocked</Badge> },
    { href: '/admin/cmyk-print/cost-calculator', icon: Calculator, title: 'Cost Calculator', sub: 'Paper costing', extra: <span className="text-xs text-muted-foreground">Estimate Costs →</span> },
    { href: '/admin/cmyk-print/paper-purchases', icon: ShoppingBag, title: 'Paper Purchases', sub: 'Buy from suppliers', extra: <span className="text-xs text-muted-foreground">Record Purchase →</span> },
    { href: '/admin/cmyk-print/expenses', icon: Receipt, title: 'Expenses', sub: 'Daily costs', extra: <span className="text-xs text-muted-foreground">Record Expenses →</span> },
    { href: '/admin/cmyk-print/job-log', icon: BookOpen, title: 'Job Log', sub: 'Activity history', extra: <span className="text-xs text-muted-foreground">View Log →</span> },
    { href: '/admin/cmyk-print/overview', icon: BarChart2, title: 'Monthly Overview', sub: 'Profit & loss', extra: <span className="text-xs text-muted-foreground">View Report →</span> },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">CMYK Print Station</h1>
          <p className="text-sm text-muted-foreground">Welcome, {profile?.full_name || profile?.email?.split('@')[0] || 'CMYK User'}</p>
        </div>
        <div className="w-fit"><DriveConnectionStatus /></div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{stat.label}</CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{loading ? '...' : stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{stat.change}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {quickLinks.map(ql => (
          <Link key={ql.href} href={ql.href}>
            <Card className="hover:shadow-sm transition-shadow h-full">
              <CardHeader className="pb-2">
                <div className="w-8 h-8 bg-muted rounded-md flex items-center justify-center mb-2">
                  <ql.icon className="h-4 w-4 text-foreground" />
                </div>
                <CardTitle className="text-xs font-medium">{ql.title}</CardTitle>
                <p className="text-xs text-muted-foreground">{ql.sub}</p>
              </CardHeader>
              <CardContent className="pt-0">{ql.extra}</CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Pending Jobs + Completed Today */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Pending Jobs — with Start Print button */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Pending Print Jobs</CardTitle>
              <span className="text-xs text-muted-foreground">Tap to start printing</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pendingJobs.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <p className="text-sm">No jobs assigned to CMYK station.</p>
                  <p className="text-xs mt-1">Go to <span className="font-medium">Jobs → Send to Printer → CMYK Station</span> to assign jobs.</p>
                </div>
              ) : pendingJobs.map((job) => (
                <div key={job.id} className={`p-3 rounded-md border ${job.priority === 'urgent' ? 'border-destructive/30 bg-destructive/5' : ''}`}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{job.job_number}</span>
                      {job.priority === 'urgent' && <Badge variant="destructive" className="text-xs">Urgent</Badge>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">{job.current_stage}</Badge>
                      <Button size="sm" className="h-7 text-xs px-2" onClick={() => openPrintModal(job)}>
                        <Printer className="w-3 h-3 mr-1" /> Print
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">{job.client?.company || job.client?.name}</p>
                  <p className="text-xs text-muted-foreground">{job.project_name} • {job.quantity}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Completed Today */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Printed Today</CardTitle>
              <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
                <Link href="/admin/cmyk-print/job-log">View All</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {completedTodayJobs.length === 0 ? (
                <p className="text-center text-muted-foreground py-4 text-sm">Nothing printed yet today.</p>
              ) : completedTodayJobs.slice(0, 5).map((log) => (
                <div key={log.id} className="flex items-center justify-between p-3 rounded-md border">
                  <div>
                    <p className="text-sm font-medium">{log.job_number}</p>
                    <p className="text-xs text-muted-foreground">{log.client_name} • {log.paper_name}</p>
                    <p className="text-xs text-muted-foreground">{log.sheets_used} sheets • {formatCurrency(log.paper_cost)}</p>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">Done</Badge>
                    <p className="text-xs text-muted-foreground mt-1">{log.operator_name}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Sales */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Recent POS Sales</CardTitle>
            <Button variant="ghost" size="sm" asChild className="h-7 text-xs">
              <Link href="/admin/cmyk-print/retail-pos">View All</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {sales.length === 0 ? <p className="text-center text-muted-foreground py-4 text-sm">No recent sales.</p> : sales.slice(0, 5).map((sale) => (
              <div key={sale.id} className="flex items-center justify-between p-3 rounded-md border hover:bg-muted/50 transition-colors">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{sale.sale_number}</span>
                    <span className="text-xs text-muted-foreground">{new Date(sale.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{sale.customer_name || 'Walk-in'}</p>
                </div>
                <p className="text-sm font-semibold">{formatCurrency(sale.total_amount)}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Stock Alert */}
      {lowStockItems.length > 0 && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Package className="h-4 w-4" />
                Low Stock Alert — {lowStockItems.length} item{lowStockItems.length > 1 ? 's' : ''} need restock
              </CardTitle>
              <Button variant="ghost" size="sm" asChild className="h-7 text-xs">
                <Link href="/admin/cmyk-print/paper-stock">Manage Stock</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {lowStockItems.map((item, idx) => (
                <div key={idx} className="p-3 rounded-md bg-background border">
                  <p className="text-sm font-medium">{item.name}</p>
                  <p className="text-xs text-destructive">{item.quantity} {item.unit} left <span className="text-muted-foreground ml-1">(min: {item.reorder_level})</span></p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* START PRINT MODAL */}
      {showPrintModal && selectedJob && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-md w-full max-w-md border border-border shadow-xl">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div>
                <h2 className="text-sm font-semibold flex items-center gap-2">
                  <Printer className="w-4 h-4" /> Start Print — {selectedJob.job_number}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">{selectedJob.client?.company || selectedJob.client?.name} · {selectedJob.project_name}</p>
              </div>
              <button onClick={() => setShowPrintModal(false)} className="p-1.5 hover:bg-muted rounded-md">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Qty reminder */}
              <div className="bg-muted rounded-md px-3 py-2 text-xs text-muted-foreground">
                Order qty: <span className="font-semibold text-foreground">{selectedJob.quantity}</span>
                {selectedJob.project_name && <> · {selectedJob.project_name}</>}
              </div>

              {/* Paper selector */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Select Paper *</label>
                {stock.length === 0 ? (
                  <p className="text-xs text-destructive">No paper in stock. <Link href="/admin/cmyk-print/paper-stock" className="underline">Add stock</Link></p>
                ) : (
                  <select value={selectedPaperId} onChange={e => setSelectedPaperId(e.target.value)}
                    className="w-full px-3 py-2.5 border border-border rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring">
                    <option value="">Select paper...</option>
                    {stock.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name}{p.size ? ` (${p.size})` : ''}{p.gsm ? ` ${p.gsm}gsm` : ''} — {p.quantity} {p.unit} left
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Paper info */}
              {selectedPaper && (
                <div className="grid grid-cols-3 gap-2 bg-muted rounded-md p-3 text-xs">
                  <div><p className="text-muted-foreground">In Stock</p><p className="font-semibold">{selectedPaper.quantity} {selectedPaper.unit}</p></div>
                  <div><p className="text-muted-foreground">Cost/sheet</p><p className="font-semibold">₹{selectedPaper.cost_per_unit}</p></div>
                  <div><p className="text-muted-foreground">Est. Cost</p><p className="font-semibold text-primary">{estimatedCost > 0 ? `₹${estimatedCost.toFixed(2)}` : '—'}</p></div>
                </div>
              )}

              {/* Sheets used */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Sheets Used *</label>
                <input type="number" min="1" placeholder="e.g. 25" value={sheetsUsed || ''}
                  onChange={e => setSheetsUsed(e.target.value)}
                  className="w-full px-3 py-2.5 border border-border rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
                {insufficientStock && (
                  <p className="text-xs text-destructive mt-1">⚠️ Only {selectedPaper?.quantity} sheets in stock!</p>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Notes (optional)</label>
                <input type="text" placeholder="Any remarks..." value={printNotes}
                  onChange={e => setPrintNotes(e.target.value)}
                  className="w-full px-3 py-2.5 border border-border rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>

              <div className="flex gap-3 pt-1">
                <Button variant="outline" className="flex-1" onClick={() => setShowPrintModal(false)}>Cancel</Button>
                <Button className="flex-1" disabled={isSubmitting || !selectedPaperId || !sheetsUsed || insufficientStock} onClick={handleMarkPrinted}>
                  {isSubmitting && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                  <Printer className="w-4 h-4 mr-1" /> Mark as Printed
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
