'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Bell, Menu, ChevronRight, Plus, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import NotificationBell from '@/components/NotificationBell';

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
  sidebarExpanded?: boolean;
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

export default function Header({ onMenuClick, sidebarExpanded }: HeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAdmin, profile } = useAuth();
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [hasUrgent, setHasUrgent] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshSuccess, setRefreshSuccess] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setRefreshSuccess(false);
    try {
      router.refresh();
      await fetchNotifications();
      // Brief delay to let Next.js revalidate
      await new Promise(r => setTimeout(r, 800));
      setRefreshSuccess(true);
      setTimeout(() => setRefreshSuccess(false), 2000);
    } catch (e) {
      console.error('Refresh failed:', e);
    } finally {
      setIsRefreshing(false);
    }
  };

  const fetchNotifications = useCallback(async () => {
    if (!isSupabaseConfigured()) return;

    const items: Notification[] = [];

    try {
      // 1. Overdue invoices (unpaid past due_date)
      const { data: overdueInvoices } = await supabase
        .from('invoices')
        .select('id, invoice_number, total_amount, due_date')
        .neq('payment_status', 'paid')
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
        .select('id, job_number, project_name, created_at')
        .gt('created_at', yesterday)
        .order('created_at', { ascending: false })
        .limit(3);

      if (recentJobs?.length) {
        recentJobs.forEach(job => {
          items.push({
            id: `job-${job.id}`,
            title: 'New order',
            desc: `${job.job_number || ''} — ${job.project_name || 'Untitled'}`,
            time: timeAgo(job.created_at),
            type: 'success',
            href: '/admin/jobs',
          });
        });
      }

      // 3. Recent leads (last 24h)
      const { data: recentLeads } = await supabase
        .from('leads')
        .select('id, company, name, created_at')
        .gt('created_at', yesterday)
        .order('created_at', { ascending: false })
        .limit(2);

      if (recentLeads?.length) {
        recentLeads.forEach(lead => {
          items.push({
            id: `lead-${lead.id}`,
            title: 'New lead',
            desc: lead.company || lead.name || 'Unknown',
            time: timeAgo(lead.created_at),
            type: 'info',
            href: '/admin/marketing/leads',
          });
        });
      }

      // 4. Google Drive status — admin only
      if (isAdmin) {
        try {
          const driveRes = await fetch('/api/drive/connect');
          const driveData = await driveRes.json();
          if (!driveData.connected || driveData.isExpired) {
            items.unshift({
              id: 'drive-disconnect',
              title: driveData.isExpired ? '🔴 Google Drive Expired' : '🔴 Google Drive Disconnected',
              desc: driveData.isExpired
                ? 'Token expired — file uploads disabled for all users'
                : 'Not connected — file uploads disabled for all users',
              time: 'Now',
              type: 'danger' as const,
              href: '/admin/settings/drive',
            });
          }
        } catch {
          // silent
        }
      }

      // 5. @mention notifications for this user (last 48h)
      if (profile?.id) {
        const twoDaysAgo = new Date(Date.now() - 172800000).toISOString();
        const { data: mentionNotifs } = await supabase
          .from('broadcast_notifications')
          .select('id, message, created_at')
          .eq('target_audience', `user_${profile.id}`)
          .gt('created_at', twoDaysAgo)
          .order('created_at', { ascending: false })
          .limit(5);

        if (mentionNotifs?.length) {
          mentionNotifs.forEach(notif => {
            items.push({
              id: `mention-${notif.id}`,
              title: 'You were mentioned',
              desc: notif.message || 'Someone tagged you in a note',
              time: timeAgo(notif.created_at),
              type: 'info',
              href: '/admin/designers/my-notes',
            });
          });
        }
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }

    setNotifications(items);
    setHasUrgent(items.some(n => n.type === 'danger'));
  }, [profile?.id]);

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
  const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

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

    const breadcrumbs = pathSegments
      .filter(segment => !isUUID(segment)) // hide raw UUIDs — page content shows the name clearly
      .map((segment) => {
        // rebuild href using the original full path up to this segment's position
        const originalIndex = pathSegments.indexOf(segment);
        const href = '/admin/' + pathSegments.slice(0, originalIndex + 1).join('/');
        const label = segmentLabels[segment] || segment.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
        return { label, href };
      });

    return [{ label: 'Dashboard', href: '/admin/dashboard' }, ...breadcrumbs];
  };

  const breadcrumbs = generateBreadcrumbs();

  return (
    <>
    <header className={`fixed top-0 left-0 right-0 h-16 bg-background/80 backdrop-blur-md border-b border-border z-20 transition-[left] duration-200 ease-in-out ${sidebarExpanded ? 'lg:left-64' : 'lg:left-16'}`}>
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

          {/* Refresh Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className={`relative transition-colors duration-300 ${refreshSuccess
              ? 'text-green-500 hover:text-green-600'
              : 'text-muted-foreground hover:text-foreground'
              }`}
            title="Refresh data"
          >
            <RefreshCw
              className={`h-4.5 w-4.5 transition-transform ${isRefreshing ? 'animate-spin' : ''
                }`}
              strokeWidth={1.5}
            />
            {refreshSuccess && (
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full animate-ping" />
            )}
            {refreshSuccess && (
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full" />
            )}
          </Button>

          {/* Personal Notifications (Telegram + In-App) */}
          <NotificationBell />
        </div>
      </div>
    </header>

    </>
  );
}
