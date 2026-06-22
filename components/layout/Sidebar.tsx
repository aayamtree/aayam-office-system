'use client';

import { useState, useEffect, useMemo, type MouseEvent } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
// PERF: Removed useDashboardStats (25 queries!) — sidebar only needs 2 badge counts
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import {
  LayoutDashboard,
  Users,
  Truck,
  Printer,
  FileText,
  Settings,
  ChevronDown,
  IndianRupee,
  Activity,
  Palette,
  Briefcase,
  Megaphone,
  Bell,
  Calendar,
  Clock,
  LogOut,
  User,
  ChevronLeft,
  ChevronRight,
  Share2,
  Star,
  Search,
  ScanLine,
} from 'lucide-react';

// Shadcn Components
// NOTE: ScrollArea (Radix UI) intentionally removed — its ResizeObserver enters an
// infinite loop over time when sidebar content re-renders (pathname/badge changes),
// causing the sidebar to freeze after ~5 minutes. Plain overflow-y-auto div is used instead.
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/Button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/Badge';

interface MenuItem {
  name: string;
  icon: any;
  href: string;
  allowedRoles?: string[];
  submenu?: { name: string; href: string; adminOnly?: boolean }[];
}

const menuItems: MenuItem[] = [
  {
    name: 'My Work',
    icon: Star,
    href: '/admin/my-work',
    // Visible to everyone
  },
  {
    name: 'Overview',
    icon: LayoutDashboard,
    href: '/admin/dashboard',
    allowedRoles: ['admin', 'finance'],
  },
  {
    name: 'Projects & Jobs',
    icon: Briefcase,
    href: '/admin/jobs',
    allowedRoles: ['admin', 'finance'],
    submenu: [
      { name: 'Overview', href: '/admin/jobs' },
      { name: 'Job Dossier', href: '/admin/jobs/dossier' },
      { name: 'Production Queue', href: '/admin/jobs/queue' },
      { name: '🔴 Overdue', href: '/admin/jobs/overdue' },
    ]
  },
  {
    name: 'Print Planner',
    icon: Printer,
    href: '/admin/print-planner',
    allowedRoles: ['admin', 'finance', 'cmyk'],
    submenu: [
      { name: 'Planner', href: '/admin/print-planner' },
      { name: 'Print Runs', href: '/admin/print-runs' },
    ]
  },
  {
    name: 'Design Studio',
    icon: Palette,
    href: '/admin/designers/tasks?view=board',
    allowedRoles: ['admin', 'designer'],
    submenu: [
      { name: 'Queue',         href: '/admin/designers/my-queue' },
      { name: 'Timeline',      href: '/admin/designers/timeline' },
      { name: 'My Notes',      href: '/admin/designers/my-notes' },
      { name: '+ New Project', href: '/admin/designers/new-project' },
      { name: 'Dossier',       href: '/admin/designers/dossier',    adminOnly: true },
      { name: '📖 My Guide',   href: '/admin/designers/guide' },
    ]
  },
  {
    name: 'Attendance',
    icon: Clock,
    href: '/admin/designers/attendance',
    allowedRoles: ['admin'],
  },
  {
    name: 'Marketing',
    icon: Megaphone,
    href: '/admin/marketing',
    allowedRoles: ['admin', 'marketing'],
    submenu: [
      { name: 'Dashboard', href: '/admin/marketing/dashboard' },
      { name: 'Leads', href: '/admin/marketing/leads' },
      { name: 'Follow-ups', href: '/admin/marketing/follow-ups' },
      { name: 'Quotations', href: '/admin/marketing/quotations' },
      { name: 'My Orders', href: '/admin/marketing/orders' },
      { name: 'Dispatched Orders', href: '/admin/marketing/dispatch' },
      { name: 'Commissions', href: '/admin/marketing/commissions' },
      { name: '📖 My Guide', href: '/admin/marketing/guide' },
    ]
  },
  {
    name: 'CRM',
    icon: Users,
    href: '/admin/crm',
    allowedRoles: ['admin', 'finance', 'marketing'],
    submenu: [
      { name: 'Clients', href: '/admin/crm/clients' },
    ]
  },
  {
    name: 'Sales & Finance',
    icon: IndianRupee,
    href: '/admin/finance',
    allowedRoles: ['admin', 'finance'],
    submenu: [
      { name: 'Overview', href: '/admin/finance' },
      { name: 'Quotations', href: '/admin/sales/quotations' },
      { name: 'Orders', href: '/admin/sales/orders' },
      { name: 'Invoices', href: '/admin/finance/invoices' },
      { name: 'Payments', href: '/admin/finance/payments' },
      { name: '⚡ Quick Expense', href: '/admin/finance/expenses/quick' },
      { name: 'Banking', href: '/admin/finance/banking' },
      { name: 'Bank Accounts', href: '/admin/finance/banks', adminOnly: true },
      { name: 'Daily Summary', href: '/admin/finance/daily', adminOnly: true },
      { name: 'Accounts', href: '/admin/finance/accounts', adminOnly: true },
      { name: 'Chart of Accounts', href: '/admin/finance/chart-of-accounts', adminOnly: true },
      { name: 'Journal', href: '/admin/finance/journal', adminOnly: true },
      { name: 'Purchase Bills', href: '/admin/finance/vendors/purchases' },
      { name: 'Vendors', href: '/admin/finance/vendors' },
      { name: '📖 My Guide', href: '/admin/finance/guide' },
    ]
  },
  {
    name: 'Dispatch',
    icon: Truck,
    href: '/admin/dispatch',
    allowedRoles: ['admin', 'dispatch'],
    submenu: [
      { name: 'Command Center', href: '/admin/dispatch' },
      { name: 'QC & Packing', href: '/admin/dispatch/qc-check' },
      { name: 'Delivery History', href: '/admin/dispatch/history' },
      { name: 'Transporters', href: '/admin/dispatch/transporters' },
      { name: '📖 My Guide', href: '/admin/dispatch/guide' },
    ]
  },
  {
    name: 'CMYK Print',
    icon: Printer,
    href: '/admin/cmyk-print',
    allowedRoles: ['admin', 'finance', 'cmyk'],
    submenu: [
      { name: 'Station Overview', href: '/admin/cmyk-print' },
      { name: 'Paper Stock', href: '/admin/cmyk-print/paper-stock' },
      { name: 'Retail POS', href: '/admin/cmyk-print/retail-pos' },
    ]
  },
  {
    name: 'Reports',
    icon: FileText,
    href: '/admin/reports',
    allowedRoles: ['admin', 'finance'],
    submenu: [
      { name: 'Overview', href: '/admin/reports' },
      { name: 'Team Performance', href: '/admin/team/performance', adminOnly: true },
      { name: 'Finance Reports', href: '/admin/reports/finance' },
      { name: 'Sales Reports', href: '/admin/reports/sales' },
      { name: 'Vendor Reports', href: '/admin/finance/reports/vendor-reports' },
      { name: 'Dispatch Reports', href: '/admin/reports/dispatch' },
    ]
  },
  {
    name: 'Activity',
    icon: Activity,
    href: '/admin/activity',
    allowedRoles: ['admin'],
  },
  {
    name: 'Calendar',
    icon: Calendar,
    href: '/admin/calendar',
    allowedRoles: ['admin', 'finance', 'designer', 'marketing', 'dispatch'],
  },
  {
    name: 'EOD Report',
    icon: FileText,
    href: '/admin/eod-report',
    allowedRoles: ['admin', 'finance', 'designer', 'marketing', 'dispatch'],
  },
  {
    name: 'Broadcast',
    icon: Bell,
    href: '/admin/broadcast',
    allowedRoles: ['admin', 'finance'],
  },
  {
    name: 'Team Files',
    icon: Share2,
    href: '/admin/team/files',
    allowedRoles: ['admin', 'finance', 'designer', 'marketing', 'dispatch', 'cmyk'],
  },
  {
    name: 'My Profile',
    icon: Settings,
    href: '/admin/settings/profile',
    allowedRoles: ['admin', 'finance', 'designer', 'marketing', 'dispatch', 'cmyk'],
  },
  {
    name: 'Label Studio',
    icon: ScanLine,
    href: '/admin/label-studio',
    allowedRoles: ['admin', 'designer'],
    submenu: [
      { name: 'Extract Master', href: '/admin/label-studio/extract' },
      { name: 'Brands',        href: '/admin/label-studio/brands' },
      { name: 'Products',      href: '/admin/label-studio/products' },
      { name: 'Label Check',   href: '/admin/label-studio/check' },
      { name: 'History',       href: '/admin/label-studio/history' },
    ]
  },
  {
    name: 'Settings',
    icon: Settings,
    href: '/admin/settings',
    allowedRoles: ['admin'],
    submenu: [
      { name: 'General', href: '/admin/settings' },
      { name: 'Company Info', href: '/admin/settings/company' },
      { name: 'Notifications', href: '/admin/settings/notifications' },
      { name: 'Preferences', href: '/admin/settings/preferences' },
      { name: 'Production Settings', href: '/admin/settings/production' },
      { name: 'Google Drive', href: '/admin/settings/drive' },
      { name: 'Vendor Categories', href: '/admin/settings/vendor-categories' },
      { name: 'Product Categories', href: '/admin/settings/product-categories' },
      { name: 'System Health', href: '/admin/system-health' },
      { name: '📖 Admin Guide', href: '/admin/guide' },
    ]
  },
];


interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onCollapsedChange?: (collapsed: boolean) => void;
}

const COLLAPSE_KEY = 'sidebar-collapsed';

export default function Sidebar({ isOpen, onClose, onCollapsedChange }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, signOut } = useAuth();
  const [expandedItems, setExpandedItems] = useState<string[]>(['Design Studio', 'Marketing', 'Sales & Finance', 'CRM', 'Dispatch']);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Close mobile sidebar on navigation — watching pathname is reliable and
  // avoids calling setState inside link onClick handlers, which can interfere
  // with Next.js startTransition-based routing on heavy pages (e.g. tasks page).
  useEffect(() => {
    onClose();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Sidebar collapsed state — click-only, persisted to localStorage.
  // NO hover logic. Hover-expand was removed permanently because any CSS layout
  // shift near the sidebar edge (margin: ml-16 ↔ ml-64) caused an oscillation
  // loop that saturated the browser main thread and froze the UI after ~5 minutes.
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(COLLAPSE_KEY);
      const isCollapsed = saved === 'true';
      setCollapsed(isCollapsed);
      onCollapsedChange?.(isCollapsed);
    } catch { /* localStorage unavailable */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    try { localStorage.setItem(COLLAPSE_KEY, String(next)); } catch { /* ignore */ }
    onCollapsedChange?.(next);
  };

  // PERF: Badge counts cached in sessionStorage for 5 minutes — no re-fetch on every navigation
  const [activeLeadsCount, setActiveLeadsCount] = useState(0);
  const [prodQueueCount, setProdQueueCount] = useState(0);
  const [overdueCount, setOverdueCount] = useState(0);
  useEffect(() => {
    const CACHE_KEY = 'sidebar_badge_counts';
    const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

    try {
      const cached = sessionStorage.getItem(CACHE_KEY);
      if (cached) {
        const { ts, leads, prod, overdue } = JSON.parse(cached);
        if (Date.now() - ts < CACHE_TTL) {
          setActiveLeadsCount(leads);
          setProdQueueCount(prod);
          setOverdueCount(overdue);
          return; // skip all 3 queries
        }
      }
    } catch { /* sessionStorage unavailable */ }

    const today = new Date().toISOString().split('T')[0];
    Promise.all([
      supabase.from('leads').select('id', { count: 'exact', head: true }).not('status', 'in', '(converted,lost)'),
      supabase.from('jobs').select('id', { count: 'exact', head: true }).in('current_stage', ['printing', 'finishing']),
      supabase.from('jobs').select('id', { count: 'exact', head: true }).lt('client_deadline', today).not('current_stage', 'in', '(delivered,cancelled,completed)'),
    ]).then(([leadsRes, prodRes, overdueRes]) => {
      const leads = leadsRes.count || 0;
      const prod  = prodRes.count || 0;
      const overdue = overdueRes.count || 0;
      setActiveLeadsCount(leads);
      setProdQueueCount(prod);
      setOverdueCount(overdue);
      try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), leads, prod, overdue })); } catch { /* ignore */ }
    });
  }, []);

  const toggleExpanded = (name: string) => {
    setExpandedItems(prev =>
      prev.includes(name)
        ? prev.filter(item => item !== name)
        : [...prev, name]
    );
  };

  const handleLogout = async () => {
    await signOut();
    window.location.href = '/login';
  };

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  const isSubActive = (href: string) => {
    if (href.includes('?')) {
      const [path, query] = href.split('?');
      if (pathname !== path) return false;
      const currentParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
      const subParams = new URLSearchParams(query);
      for (const [key, val] of Array.from(subParams.entries())) {
        if (currentParams.get(key) !== val) return false;
      }
      return true;
    }
    return pathname === href;
  };

  // Reliable sidebar navigation:
  // Next.js <Link> / router.push uses startTransition internally. On heavy pages
  // like the tasks board (200+ jobs), startTransition can be silently abandoned
  // by React's concurrent scheduler, leaving the URL unchanged with no error.
  // Fix: try router.push first; if the URL hasn't changed after 300ms, fall back
  // to window.location.href (hard nav). This is fast on all normal pages (URL
  // changes in <50ms), and self-corrects on the tasks page.
  const navigate = (e: MouseEvent, href: string) => {
    e.preventDefault();
    const before = window.location.pathname + window.location.search;
    router.push(href);
    setTimeout(() => {
      if (window.location.pathname + window.location.search === before) {
        window.location.href = href;
      }
    }, 300);
  };

  // Kept for the logo link only (needs no navigation override)
  const handleLinkClick = () => {};

  // Determine if we're on desktop (lg breakpoint = 1024px)
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const checkDesktop = () => setIsDesktop(window.innerWidth >= 1024);
    checkDesktop();
    window.addEventListener('resize', checkDesktop);
    return () => window.removeEventListener('resize', checkDesktop);
  }, []);

  // On desktop: collapsed = icon strip (w-16), expanded = full (w-64)
  // On mobile: always full width, translate-x controls visibility
  const isCollapsed = isDesktop && collapsed;
  const sidebarWidth = isCollapsed ? 'w-16' : 'w-64';

  // Memoize filtered menu — only recompute when role changes, not on every render
  const filteredMenu = useMemo(() => menuItems.filter(item => {
    const userRole = profile?.role || 'admin';
    if (!item.allowedRoles || item.allowedRoles.length === 0) return true;
    return item.allowedRoles.includes(userRole);
  }), [profile?.role]);

  // Mobile translate: slide off-screen when closed, slide in when open
  const mobileTranslate = !isDesktop ? (isOpen ? 'translate-x-0 shadow-xl' : '-translate-x-full') : '';

  return (
    <aside
      className={`fixed left-0 top-0 h-screen ${sidebarWidth} bg-background border-r border-border flex flex-col z-40 transition-all duration-300 ease-in-out ${mobileTranslate}`}
    >
      {/* Logo + collapse toggle */}
      {isCollapsed ? (
        // Collapsed: only show the expand chevron — no logo, no overflow
        <div className="border-b border-border p-3 flex justify-center">
          {isDesktop && (
            <button
              onClick={toggleCollapsed}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Expand sidebar"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      ) : (
        // Expanded: logo + name on left, collapse chevron on right
        <div className="border-b border-border p-4 flex items-center justify-between">
          <Link
            href={profile?.role === 'designer' ? '/admin/designers/tasks' : '/admin/dashboard'}
            className="flex items-center gap-2"
            onClick={handleLinkClick}
          >
            <Image src="/company-logo.png" alt="Aayam" width={32} height={32} className="rounded shrink-0" />
            <span className="font-bold text-foreground text-xl whitespace-nowrap">Aayam</span>
          </Link>
          {isDesktop && (
            <button
              onClick={toggleCollapsed}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Collapse sidebar"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* Search button */}
      <div className={`border-b border-border ${isCollapsed ? 'px-1.5 py-2 flex justify-center' : 'px-3 py-2'}`}>
        <button
          onClick={() => window.dispatchEvent(new Event('aayam:open-search'))}
          title="Search (⌘K)"
          className={`flex items-center gap-2 rounded-md transition-colors text-muted-foreground hover:bg-accent hover:text-accent-foreground
            ${isCollapsed ? 'w-10 h-10 justify-center' : 'w-full px-3 py-2 text-sm'}`}
        >
          <Search className="h-4 w-4 shrink-0" strokeWidth={1.5} />
          {!isCollapsed && (
            <>
              <span className="flex-1 text-left">Search...</span>
              <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-border bg-muted hidden sm:inline">⌘K</kbd>
            </>
          )}
        </button>
      </div>

      {/* Navigation — plain overflow div (ScrollArea removed: caused ResizeObserver freeze) */}
      <div className={`flex-1 overflow-y-auto ${isCollapsed ? 'px-1.5' : 'px-3'} py-4`}>
        <nav className="space-y-1">
          {profile && !profile.role ? (
            !isCollapsed && (
              <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
                <p className="text-sm text-destructive font-medium">⚠️ No Role Assigned</p>
                <p className="text-xs text-muted-foreground mt-1">Contact admin to assign your role</p>
              </div>
            )
          ) : (
            filteredMenu.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              const isExpanded = expandedItems.includes(item.name);
              const hasSubmenu = item.submenu && item.submenu.length > 0;

              // COLLAPSED MODE: icon-only buttons
              if (isCollapsed) {
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={(e) => navigate(e, item.href)}
                    title={item.name}
                    className={`flex items-center justify-center w-full h-10 rounded-md transition-colors
                      ${active
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                      }`}
                  >
                    <Icon className="h-4 w-4" strokeWidth={1.5} />
                  </Link>
                );
              }

              // EXPANDED MODE: full sidebar
              return (
                <div key={item.name}>
                  {hasSubmenu && item.name !== 'Design Studio' ? (
                    <button
                      onClick={() => toggleExpanded(item.name)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-md transition-colors text-sm font-medium
                        ${active
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                        }`}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" strokeWidth={1} />
                        <span className="whitespace-nowrap">{item.name}</span>
                      </div>
                      <ChevronDown
                        className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        strokeWidth={1}
                      />
                    </button>
                  ) : (
                    <Link
                      href={item.href}
                      onClick={(e) => navigate(e, item.href)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors text-sm font-medium
                        ${active
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                        }`}
                    >
                      <Icon className="h-4 w-4" strokeWidth={1} />
                      <span className="whitespace-nowrap">{item.name}</span>
                    </Link>
                  )}

                  {/* Submenu */}
                  {hasSubmenu && (isExpanded || item.name === 'Design Studio') && (
                    <div className="ml-6 mt-1 space-y-1 border-l border-border pl-3">
                      {item.submenu!.filter(sub => !sub.adminOnly || profile?.role === 'admin').map((sub) => {
                        let badge = 0;
                        if (sub.name === 'Leads') badge = activeLeadsCount;
                        if (sub.name === 'Production Queue') badge = prodQueueCount;
                        if (sub.name === '🔴 Overdue') badge = overdueCount;

                        const showBadge = badge > 0;

                        return (
                          <Link
                            key={sub.href}
                            href={sub.href}
                            onClick={(e) => navigate(e, sub.href)}
                            className={`flex items-center justify-between px-3 py-1.5 rounded-md text-sm transition-colors
                              ${isSubActive(sub.href)
                                ? 'bg-primary text-primary-foreground font-medium'
                                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                              }`}
                          >
                            <span className="whitespace-nowrap">{sub.name}</span>
                            {showBadge && (
                              <Badge variant="secondary" className="ml-auto text-xs">
                                {badge}
                              </Badge>
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </nav>
      </div>

      {/* User Profile */}
      <div className={`border-t border-border ${isCollapsed ? 'p-2 flex justify-center' : 'p-4'}`}>
        {isCollapsed ? (
          <Link href="/admin/settings/profile" title={profile?.full_name || 'Profile'}>
            <Avatar className="h-8 w-8">
              <AvatarImage src={profile?.avatar_url} alt={profile?.full_name} />
              <AvatarFallback>{profile?.full_name?.charAt(0)?.toUpperCase() || profile?.email?.charAt(0)?.toUpperCase() || '?'}</AvatarFallback>
            </Avatar>
          </Link>
        ) : (
          <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="w-full justify-start px-2 h-auto py-2">
                <Avatar className="h-8 w-8 mr-2">
                  <AvatarImage src={profile?.avatar_url} alt={profile?.full_name} />
                  <AvatarFallback>{profile?.full_name?.charAt(0)?.toUpperCase() || profile?.email?.charAt(0)?.toUpperCase() || '?'}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col items-start text-left flex-1 min-w-0">
                  <span className="text-sm font-medium truncate w-full whitespace-nowrap">{profile?.full_name}</span>
                  <span className="text-xs text-muted-foreground capitalize whitespace-nowrap">{profile?.role}</span>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" side="top" align="start" sideOffset={8}>
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/admin/settings/profile" onClick={(e) => navigate(e, '/admin/settings/profile')}>
                  <User className="mr-2 h-4 w-4" strokeWidth={1} />
                  <span>Profile</span>
                </Link>
              </DropdownMenuItem>
              {profile?.role === 'admin' && (
                <DropdownMenuItem asChild>
                  <Link href="/admin/settings" onClick={(e) => navigate(e, '/admin/settings')}>
                    <Settings className="mr-2 h-4 w-4" strokeWidth={1} />
                    <span>Settings</span>
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                <LogOut className="mr-2 h-4 w-4" strokeWidth={1} />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </aside>
  );
}
