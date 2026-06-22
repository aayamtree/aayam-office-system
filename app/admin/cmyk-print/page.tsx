'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Printer, ShoppingCart, Package, Clock, Calculator, Receipt, X, Loader2, BookOpen, ShoppingBag, PauseCircle, PlayCircle, TrendingUp } from 'lucide-react';
import { useJobs, usePaperStock, usePOSSales, useCMYKJobLogs, useVendors, useCMYKExpenses } from '@/lib/hooks';
import { useAuth } from '@/lib/auth-context';
import DriveConnectionStatus from '@/components/drive/DriveConnectionStatus';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { toast } from '@/lib/toast';

export default function CMYKPrintPage() {
  const { profile } = useAuth();
  const { jobs, loading: jobsLoading, refetch: refetchJobs, updateJob } = useJobs({
    select: 'id, job_number, project_name, client_id, vendor_id, priority, current_stage, quantity, is_on_hold, hold_reason, pre_hold_stage, created_at, order_date, client:clients(id, name, company)',
    orderBy: { column: 'created_at', ascending: false }
  });
  const { stock, loading: stockLoading, refetch: refetchStock } = usePaperStock();
  const { sales, loading: salesLoading } = usePOSSales();
  const { logs, completeJob } = useCMYKJobLogs();
  const { vendors } = useVendors();
  const { expenses } = useCMYKExpenses();

  // Vendors flagged as CMYK station
  const cmykVendorIds = (vendors as any[]).filter(v => v.is_cmyk_station === true).map(v => v.id);

  const loading = jobsLoading || stockLoading || salesLoading;

  // Start Print Modal state
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [selectedPaperId, setSelectedPaperId] = useState('');
  const [sheetsUsed, setSheetsUsed] = useState('');
  const [printNotes, setPrintNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const DONE_STAGES = ['finishing', 'quality_check', 'ready', 'dispatched', 'delivered', 'cancelled'];
  const activeCmykJobs = jobs.filter(j =>
    !DONE_STAGES.includes(j.current_stage) &&
    cmykVendorIds.length > 0 && j.vendor_id && cmykVendorIds.includes(j.vendor_id)
  );
  const pendingJobs = activeCmykJobs.filter(j => !(j as any).is_on_hold).slice(0, 12);
  const onHoldJobs = activeCmykJobs.filter(j => (j as any).is_on_hold);

  const isToday = (d?: string) => d ? new Date(d).toDateString() === new Date().toDateString() : false;

  const completedTodayJobs = logs.filter(l => isToday(l.completed_at || l.created_at) && l.status === 'completed');
  const lowStockItems = stock.filter(s => s.quantity <= s.reorder_level);

  // Money — today
  const todaysSales = sales.filter(s => isToday(s.created_at));
  const todaysSalesTotal = todaysSales.reduce((sum, s) => sum + s.total_amount, 0);
  // Net profit basis = sales ex-GST (GST is pass-through, not income)
  const todaysSalesExGst = todaysSales.reduce((sum, s) => sum + ((s.subtotal || 0) - (s.discount_amount || 0)), 0);
  const todaysPaperCost = logs.filter(l => isToday(l.completed_at || l.created_at)).reduce((sum, l) => sum + (l.paper_cost || 0), 0);
  const todaysExpenses = (expenses || []).filter(e => isToday(e.expense_date)).reduce((sum, e) => sum + (e.amount || 0), 0);
  const netToday = todaysSalesExGst - todaysPaperCost - todaysExpenses;

  const selectedPaper = stock.find(p => p.id === selectedPaperId);
  const estimatedCost = selectedPaper && sheetsUsed ? selectedPaper.cost_per_unit * parseInt(sheetsUsed || '0') : 0;
  const insufficientStock = selectedPaper && sheetsUsed ? parseInt(sheetsUsed) > selectedPaper.quantity : false;

  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

  // Turnaround so far — how long the job has been waiting
  const ageLabel = (d?: string) => {
    if (!d) return '';
    const ms = Date.now() - new Date(d).getTime();
    const h = Math.floor(ms / 3600000);
    if (h < 1) return 'just now';
    if (h < 24) return `${h}h`;
    return `${Math.floor(h / 24)}d`;
  };

  const openPrintModal = (job: any) => {
    setSelectedJob(job);
    setSelectedPaperId('');
    setSheetsUsed('');
    setPrintNotes('');
    setShowPrintModal(true);
  };

  const handleHold = async (job: any) => {
    const res = await updateJob(job.id, { is_on_hold: true, pre_hold_stage: job.current_stage } as any);
    if (res.error) { toast.error('Failed to hold job'); return; }
    toast.success(`${job.job_number} put on hold`);
    refetchJobs();
  };

  const handleResume = async (job: any) => {
    const res = await updateJob(job.id, { is_on_hold: false } as any);
    if (res.error) { toast.error('Failed to resume job'); return; }
    toast.success(`${job.job_number} resumed`);
    refetchJobs();
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

  const quickLinks = [
    { href: '/admin/cmyk-print/cost-calculator', icon: Calculator, title: 'Cost Calculator', extra: null },
    { href: '/admin/cmyk-print/paper-stock', icon: Package, title: 'Paper Stock', extra: lowStockItems.length > 0 ? <Badge variant="destructive" className="text-[10px] px-1.5">{lowStockItems.length} low</Badge> : null },
    { href: '/admin/cmyk-print/paper-purchases', icon: ShoppingBag, title: 'Purchases', extra: null },
    { href: '/admin/cmyk-print/expenses', icon: Receipt, title: 'Expenses', extra: null },
    { href: '/admin/cmyk-print/job-log', icon: BookOpen, title: 'Job Log', extra: null },
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

      {/* Snapshot line */}
      <div className="text-sm text-muted-foreground bg-muted rounded-md px-3 py-2 flex flex-wrap gap-x-4 gap-y-1">
        <span>Sales today <span className="font-semibold text-foreground">{loading ? '…' : formatCurrency(todaysSalesTotal)}</span></span>
        <span><span className="font-semibold text-foreground">{pendingJobs.length}</span> in queue</span>
        <span><span className="font-semibold text-foreground">{completedTodayJobs.length}</span> printed</span>
        <span><span className={`font-semibold ${lowStockItems.length > 0 ? 'text-destructive' : 'text-foreground'}`}>{lowStockItems.length}</span> low on stock</span>
        <span>net <span className={`font-semibold ${netToday >= 0 ? 'text-green-700' : 'text-destructive'}`}>{loading ? '…' : formatCurrency(netToday)}</span></span>
      </div>

      {/* THREE PILLARS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Production */}
        <Card className="border-primary/30">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2"><Printer className="h-4 w-4" /> Production</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? '…' : pendingJobs.length}</div>
            <p className="text-xs text-muted-foreground mb-3">jobs to print</p>
            <Button size="sm" variant="outline" className="w-full" asChild>
              <a href="#queue">Open print queue</a>
            </Button>
          </CardContent>
        </Card>

        {/* Counter */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2"><ShoppingCart className="h-4 w-4" /> Counter</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? '…' : formatCurrency(todaysSalesTotal)}</div>
            <p className="text-xs text-muted-foreground mb-3">{todaysSales.length} sale{todaysSales.length !== 1 ? 's' : ''} today</p>
            <Button size="sm" className="w-full" asChild>
              <Link href="/admin/cmyk-print/retail-pos">New bill</Link>
            </Button>
          </CardContent>
        </Card>

        {/* Money */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Money</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${netToday >= 0 ? 'text-green-700' : 'text-destructive'}`}>{loading ? '…' : formatCurrency(netToday)}</div>
            <p className="text-xs text-muted-foreground mb-3">net today</p>
            <Button size="sm" variant="outline" className="w-full" asChild>
              <Link href="/admin/cmyk-print/overview">View P&amp;L</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* LIVE PRINT QUEUE */}
      <Card id="queue">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Live Print Queue</CardTitle>
            <span className="text-xs text-muted-foreground">tap a job to start printing</span>
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
                    <span className="text-xs text-muted-foreground flex items-center gap-0.5"><Clock className="w-3 h-3" />{ageLabel((job as any).order_date || job.created_at)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className="text-xs">{job.current_stage}</Badge>
                    <Button size="sm" variant="ghost" className="h-7 text-xs px-2" onClick={() => handleHold(job)}>
                      <PauseCircle className="w-3 h-3 mr-1" /> Hold
                    </Button>
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

      {/* ON HOLD */}
      {onHoldJobs.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2"><PauseCircle className="h-4 w-4 text-amber-600" /> On Hold — {onHoldJobs.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {onHoldJobs.map(job => (
                <div key={job.id} className="flex items-center justify-between p-3 rounded-md border bg-background">
                  <div>
                    <p className="text-sm font-medium">{job.job_number}</p>
                    <p className="text-xs text-muted-foreground">{job.client?.company || job.client?.name} • {job.project_name}</p>
                  </div>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleResume(job)}>
                    <PlayCircle className="w-3 h-3 mr-1" /> Resume
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Completed Today + Recent Sales */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
                      {(sale as any).order_type === 'pickup' && <Badge variant="outline" className="text-[10px] px-1.5">Pickup</Badge>}
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
      </div>

      {/* TOOLS STRIP */}
      <div className="flex flex-wrap gap-2">
        {quickLinks.map(ql => (
          <Link key={ql.href} href={ql.href}
            className="flex items-center gap-2 px-3 py-2 rounded-md border bg-background hover:bg-muted text-sm transition-colors">
            <ql.icon className="h-4 w-4 text-muted-foreground" />
            <span>{ql.title}</span>
            {ql.extra}
          </Link>
        ))}
      </div>

      {/* Stock Alert */}
      {lowStockItems.length > 0 && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Package className="h-4 w-4" />
                Low Stock — {lowStockItems.length} item{lowStockItems.length > 1 ? 's' : ''} need restock
              </CardTitle>
              <Button variant="ghost" size="sm" asChild className="h-7 text-xs">
                <Link href="/admin/cmyk-print/paper-stock">Manage Stock</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {lowStockItems.slice(0, 6).map((item, idx) => (
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
              <div className="bg-muted rounded-md px-3 py-2 text-xs text-muted-foreground">
                Order qty: <span className="font-semibold text-foreground">{selectedJob.quantity}</span>
                {selectedJob.project_name && <> · {selectedJob.project_name}</>}
              </div>

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

              {selectedPaper && (
                <div className="grid grid-cols-3 gap-2 bg-muted rounded-md p-3 text-xs">
                  <div><p className="text-muted-foreground">In Stock</p><p className="font-semibold">{selectedPaper.quantity} {selectedPaper.unit}</p></div>
                  <div><p className="text-muted-foreground">Cost/sheet</p><p className="font-semibold">₹{selectedPaper.cost_per_unit}</p></div>
                  <div><p className="text-muted-foreground">Est. Cost</p><p className="font-semibold text-primary">{estimatedCost > 0 ? `₹${estimatedCost.toFixed(2)}` : '—'}</p></div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Sheets Used *</label>
                <input type="number" min="1" placeholder="e.g. 25" value={sheetsUsed || ''}
                  onChange={e => setSheetsUsed(e.target.value)}
                  className="w-full px-3 py-2.5 border border-border rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
                {insufficientStock && (
                  <p className="text-xs text-destructive mt-1">⚠️ Only {selectedPaper?.quantity} sheets in stock!</p>
                )}
              </div>

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
