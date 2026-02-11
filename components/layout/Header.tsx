'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Bell, Menu, ChevronRight, Plus } from 'lucide-react';
import Link from 'next/link';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

// Shadcn Components
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface HeaderProps {
  onMenuClick: () => void;
}

interface Notification {
  id: string;
  title: string;
  desc: string;
  time: string;
  type: 'danger' | 'success' | 'info' | 'warning';
  href?: string;
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const pathname = usePathname();
  const { isAdmin } = useAuth();
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [hasUrgent, setHasUrgent] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!isSupabaseConfigured()) return;

    const items: Notification[] = [];

    try {
      // 1. Overdue invoices (unpaid past due_date)
      const { data: overdueInvoices } = await supabase
        .from('invoices')
        .select('id, invoice_number, total_amount, due_date')
        .eq('status', 'unpaid')
        .lt('due_date', new Date().toISOString().split('T')[0])
        .order('due_date', { ascending: true })
        .limit(3);

      if (overdueInvoices?.length) {
        overdueInvoices.forEach(inv => {
          items.push({
            id: `inv-${inv.id}`,
            title: 'Payment overdue',
            desc: `${inv.invoice_number || 'Invoice'} — ₹${Number(inv.total_amount || 0).toLocaleString('en-IN')}`,
            time: inv.due_date ? timeAgo(inv.due_date) : '',
            type: 'danger',
            href: '/admin/finance',
          });
        });
      }

      // 2. Recent new jobs (last 24h)
      const yesterday = new Date(Date.now() - 86400000).toISOString();
      const { data: recentJobs } = await supabase
        .from('jobs')
        .select('id, job_id, project_name, created_at')
        .gt('created_at', yesterday)
        .order('created_at', { ascending: false })
        .limit(3);

      if (recentJobs?.length) {
        recentJobs.forEach(job => {
          items.push({
            id: `job-${job.id}`,
            title: 'New order',
            desc: `${job.job_id || ''} — ${job.project_name || 'Untitled'}`,
            time: timeAgo(job.created_at),
            type: 'success',
            href: '/admin/jobs',
          });
        });
      }

      // 3. Recent leads (last 24h)
      const { data: recentLeads } = await supabase
        .from('leads')
        .select('id, company_name, created_at')
        .gt('created_at', yesterday)
        .order('created_at', { ascending: false })
        .limit(2);

      if (recentLeads?.length) {
        recentLeads.forEach(lead => {
          items.push({
            id: `lead-${lead.id}`,
            title: 'New lead',
            desc: lead.company_name || 'Unknown',
            time: timeAgo(lead.created_at),
            type: 'info',
            href: '/admin/marketing/leads',
          });
        });
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }

    setNotifications(items);
    setHasUrgent(items.some(n => n.type === 'danger'));
  }, []);

  // Fetch on mount and every 60 seconds
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Also refresh when dropdown opens
  useEffect(() => {
    if (showNotifications) fetchNotifications();
  }, [showNotifications, fetchNotifications]);

  // Generate Breadcrumbs
  const generateBreadcrumbs = () => {
    if (!pathname) return [{ label: 'Dashboard', href: '/admin/dashboard' }];

    const pathSegments = pathname.split('/').filter(p => p !== '' && p !== 'admin');

    if (pathSegments.length === 0 || (pathSegments.length === 1 && pathSegments[0] === 'dashboard')) {
      return [{ label: 'Dashboard', href: '/admin/dashboard' }];
    }

    const segmentLabels: Record<string, string> = {
      'crm': 'CRM',
      'cmyk-print': 'CMYK Print',
      'pos': 'POS',
      'retail-pos': 'Retail POS',
      'purchase-bills': 'Purchase Bills',
    };

    const breadcrumbs = pathSegments.map((segment, index) => {
      const href = '/admin/' + pathSegments.slice(0, index + 1).join('/');
      const label = segmentLabels[segment] || segment.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
      return { label, href };
    });

    return [{ label: 'Dashboard', href: '/admin/dashboard' }, ...breadcrumbs];
  };

  const breadcrumbs = generateBreadcrumbs();

  return (
    <header className="fixed top-0 left-0 right-0 lg:left-64 h-16 bg-background/80 backdrop-blur-md border-b border-border z-20">
      <div className="h-full px-4 lg:px-6 flex items-center justify-between">
        {/* Left - Menu Button & Breadcrumbs */}
        <div className="flex items-center gap-2 flex-1 overflow-hidden mr-4 min-h-[36px]">
          <Button
            variant="ghost"
            size="icon"
            onClick={onMenuClick}
            className="lg:hidden flex-shrink-0 h-9 w-9"
          >
            <Menu className="h-5 w-5" strokeWidth={1} />
          </Button>

          <nav className="flex items-center overflow-x-auto scrollbar-hide whitespace-nowrap">
            {breadcrumbs.map((crumb, index) => {
              const isLast = index === breadcrumbs.length - 1;
              const isDeep = breadcrumbs.length > 1;
              const isDashboard = index === 0;
              const hideOnMobile = isDashboard && isDeep;
              const prevHiddenOnMobile = index === 1 && isDeep;

              return (
                <div key={crumb.href} className={`flex items-center ${hideOnMobile ? 'hidden md:flex' : 'flex'}`}>
                  {index > 0 && (
                    <ChevronRight className={`mx-1 h-3.5 w-3.5 text-muted-foreground flex-shrink-0 ${prevHiddenOnMobile ? 'hidden md:block' : ''}`} strokeWidth={1} />
                  )}
                  <Link
                    href={crumb.href}
                    className={`${isLast
                      ? 'text-foreground font-semibold text-sm'
                      : 'text-muted-foreground hover:text-foreground text-sm'
                      } transition-colors`}
                  >
                    {crumb.label}
                  </Link>
                </div>
              );
            })}
          </nav>
        </div>

        {/* Right - Actions */}
        <div className="flex items-center gap-2">
          {/* Quick Add - Admin Only */}
          {isAdmin && (
            <Button asChild className="hidden sm:flex">
              <Link href="/admin/sales/orders">
                <Plus strokeWidth={1} />
                <span className="hidden md:inline">New Order</span>
              </Link>
            </Button>
          )}

          {/* Notifications */}
          <DropdownMenu open={showNotifications} onOpenChange={setShowNotifications}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="h-5 w-5" strokeWidth={1} />
                {hasUrgent && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full"></span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel>Notifications</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    ✅ All caught up — no new notifications!
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <DropdownMenuItem key={notif.id} className="flex items-start gap-3 p-3 cursor-pointer" onClick={() => {
                      if (notif.href) window.location.href = notif.href;
                    }}>
                      <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${notif.type === 'danger' ? 'bg-destructive' :
                        notif.type === 'success' ? 'bg-green-500' :
                          notif.type === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
                        }`}></span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{notif.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{notif.desc}</p>
                        <p className="text-xs text-muted-foreground mt-1">{notif.time}</p>
                      </div>
                    </DropdownMenuItem>
                  ))
                )}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
