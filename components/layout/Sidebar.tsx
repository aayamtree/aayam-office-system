'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
  LogOut,
  User,
  PanelLeftClose,
  PanelLeft,
} from 'lucide-react';

// Shadcn Components
import { ScrollArea } from '@/components/ui/scroll-area';
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
  submenu?: { name: string; href: string }[];
}

const menuItems: MenuItem[] = [
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
      { name: 'Queue', href: '/admin/designers/my-queue' },
      { name: 'Timeline', href: '/admin/designers/timeline' },
      { name: 'My Notes', href: '/admin/designers/my-notes' },
      { name: '+ New Project', href: '/admin/designers/new-project' },
      { name: '📖 My Guide', href: '/admin/designers/guide' },
    ]
  },
  {
    name: 'Marketing',
    icon: Megaphone,
    href: '/admin/marketing',
    allowedRoles: ['admin', 'finance', 'marketing'],
    submenu: [
      { name: 'Dashboard', href: '/admin/marketing/dashboard' },
      { name: 'Leads', href: '/admin/marketing/leads' },
      { name: 'Follow-ups', href: '/admin/marketing/follow-ups' },
      { name: 'Quotations', href: '/admin/marketing/quotations' },
      { name: 'My Orders', href: '/admin/marketing/orders' },
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
      { name: 'Banking', href: '/admin/finance/banking' },
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
    name: 'My Profile',
    icon: Settings,
    href: '/admin/settings/profile',
    allowedRoles: ['admin', 'finance', 'designer', 'marketing', 'dispatch', 'cmyk'],
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
  onHoverChange?: (hovered: boolean) => void;
  locked?: boolean;
  onLockedChange?: (locked: boolean) => void;
}

export default function Sidebar({ isOpen, onClose, onHoverChange, locked = false, onLockedChange }: SidebarProps) {
  const pathname = usePathname();
  const { profile, signOut } = useAuth();
  const [expandedItems, setExpandedItems] = useState<string[]>(['Design Studio', 'Marketing', 'Sales & Finance', 'CRM', 'Dispatch']);
  const [hovered, setHovered] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // PERF: Only 2 lightweight count queries instead of 25 from useDashboardStats
  const [activeLeadsCount, setActiveLeadsCount] = useState(0);
  const [prodQueueCount, setProdQueueCount] = useState(0);
  useEffect(() => {
    // Leads badge count
    supabase.from('leads')
      .select('id', { count: 'exact', head: true })
      .not('status', 'in', '(converted,lost)')
      .then(({ count }) => setActiveLeadsCount(count || 0));
    // Production Queue badge count (printing + finishing)
    supabase.from('jobs')
      .select('id', { count: 'exact', head: true })
      .in('current_stage', ['printing', 'finishing'])
      .then(({ count }) => setProdQueueCount(count || 0));
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
      // Read current query from window.location.search (stable, no re-render on URL change)
      const currentParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
      const subParams = new URLSearchParams(query);
      for (const [key, val] of Array.from(subParams.entries())) {
        if (currentParams.get(key) !== val) return false;
      }
      return true;
    }
    return pathname === href;
  };

  const handleLinkClick = () => {
    onClose();
  };

  // Determine if we're on desktop (lg breakpoint = 1024px)
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const checkDesktop = () => setIsDesktop(window.innerWidth >= 1024);
    checkDesktop();
    window.addEventListener('resize', checkDesktop);
    return () => window.removeEventListener('resize', checkDesktop);
  }, []);

  // On mobile: only render sidebar when explicitly opened
  // On desktop: always render (collapsed or expanded)
  if (!isDesktop && !isOpen) {
    return null;
  }

  // Desktop: collapsed = icon strip (64px), expanded on hover = full sidebar (256px) as overlay
  // When LOCKED, sidebar stays expanded regardless of hover
  const isCollapsed = isDesktop && !locked && !hovered && !dropdownOpen;
  const sidebarWidth = isCollapsed ? 'w-16' : 'w-64';

  const filteredMenu = menuItems.filter(item => {
    const userRole = profile?.role || 'admin';
    if (!item.allowedRoles || item.allowedRoles.length === 0) return true;
    return item.allowedRoles.includes(userRole);
  });

  return (
    <aside
      className={`fixed left-0 top-0 h-screen ${sidebarWidth} bg-background border-r border-border flex flex-col z-40 transition-all duration-200 ease-in-out ${isDesktop && hovered ? 'shadow-xl' : ''}`}
      onMouseEnter={() => {
        if (isDesktop && !locked) {
          setHovered(true);
          onHoverChange?.(true);
        }
      }}
      onMouseLeave={() => {
        if (isDesktop && !dropdownOpen && !locked) {
          setHovered(false);
          onHoverChange?.(false);
        }
      }}
    >
      {/* Logo + Lock toggle */}
      <div className={`border-b border-border ${isCollapsed ? 'p-3 flex justify-center' : 'p-4 flex items-center justify-between'}`}>
        <Link
          href={profile?.role === 'designer' ? '/admin/designers/tasks' : '/admin/dashboard'}
          className="flex items-center gap-2"
          onClick={handleLinkClick}
        >
          <img src="/company-logo.png" alt="Aayam" className="w-8 h-8 rounded shrink-0" />
          {!isCollapsed && <span className="font-bold text-foreground text-xl whitespace-nowrap">Aayam</span>}
        </Link>
        {!isCollapsed && isDesktop && (
          <button
            onClick={() => onLockedChange?.(!locked)}
            className={`p-1.5 rounded-md transition-colors ${locked ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
            title={locked ? 'Unlock sidebar (auto-collapse)' : 'Lock sidebar open'}
          >
            {locked ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeft className="w-4 h-4" />}
          </button>
        )}
      </div>

      {/* Navigation */}
      <ScrollArea className={`flex-1 ${isCollapsed ? 'px-1.5' : 'px-3'} py-4`}>
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
                    onClick={handleLinkClick}
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
                      onClick={handleLinkClick}
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
                      {item.submenu!.map((sub) => {
                        let badge = 0;
                        if (sub.name === 'Leads') badge = activeLeadsCount;
                        if (sub.name === 'Production Queue') badge = prodQueueCount;

                        const showBadge = badge > 0;

                        return (
                          <Link
                            key={sub.href}
                            href={sub.href}
                            onClick={handleLinkClick}
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
      </ScrollArea>

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
          <DropdownMenu open={dropdownOpen} onOpenChange={(open) => {
            setDropdownOpen(open);
            if (!open) {
              setHovered(false);
              onHoverChange?.(false);
            }
          }}>
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
                <Link href="/admin/settings/profile" onClick={handleLinkClick}>
                  <User className="mr-2 h-4 w-4" strokeWidth={1} />
                  <span>Profile</span>
                </Link>
              </DropdownMenuItem>
              {profile?.role === 'admin' && (
                <DropdownMenuItem asChild>
                  <Link href="/admin/settings" onClick={handleLinkClick}>
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
