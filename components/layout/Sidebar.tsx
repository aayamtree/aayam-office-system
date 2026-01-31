'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useDashboardStats } from '@/lib/hooks';
import { useAuth } from '@/lib/auth-context';
import {
  LayoutDashboard,
  Users,
  ShoppingCart,
  Truck,
  Printer,
  FileText,
  Settings,
  ChevronDown,
  IndianRupee,
  Activity,
  LogOut,
  Search,
  X,
  Palette,
  Briefcase,
  Megaphone,
  Bell,
  Calendar,
} from 'lucide-react';

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
      { name: 'Production Queue', href: '/admin/jobs/queue' },
    ]
  },
  {
    name: 'Print Planner',
    icon: Printer,
    href: '/admin/print-planner',
    allowedRoles: ['admin', 'finance', 'cmyk'],
  },
  {
    name: 'Design Studio',
    icon: Palette,
    href: '/admin/designers/tasks?view=board',
    allowedRoles: ['admin', 'designer'],
    submenu: [
      { name: 'My Queue', href: '/admin/designers/my-queue' },
      { name: 'Team Queue', href: '/admin/designers/team-queue' },
      { name: 'Timeline', href: '/admin/designers/timeline' },
      { name: 'My Notes', href: '/admin/designers/my-notes' },
      { name: '+ New Project', href: '/admin/designers/new-project' },
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
    allowedRoles: ['admin', 'finance', 'designer', 'marketing', 'dispatch'], // All roles
  },
  {
    name: 'EOD Report',
    icon: FileText,
    href: '/admin/eod-report',
    allowedRoles: ['admin', 'finance', 'designer', 'marketing', 'dispatch'], // All roles - accountability for everyone
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
    allowedRoles: ['admin', 'finance', 'designer', 'marketing', 'dispatch', 'cmyk'], // All roles can access their own profile
  },
  {
    name: 'Settings',
    icon: Settings,
    href: '/admin/settings',
    allowedRoles: ['admin'],
    submenu: [
      { name: 'General', href: '/admin/settings' },
      { name: 'Company Info', href: '/admin/settings/company' },
      { name: 'User Management', href: '/admin/settings/users' },
      { name: 'Notifications', href: '/admin/settings/notifications' },
      { name: 'Preferences', href: '/admin/settings/preferences' },
      { name: 'Production Settings', href: '/admin/settings/production' },
      { name: 'Google Drive', href: '/admin/settings/drive' },
    ]
  },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { profile, signOut } = useAuth();
  const [expandedItems, setExpandedItems] = useState<string[]>(['Design Studio', 'Marketing', 'Sales & Finance', 'CRM', 'Dispatch']);

  const { stats } = useDashboardStats(); // Fetch stats for badges

  const toggleExpanded = (name: string) => {
    setExpandedItems(prev =>
      prev.includes(name)
        ? prev.filter(item => item !== name)
        : [...prev, name]
    );
  };

  const handleLogout = async () => {
    await signOut();
    router.push('/login');
  };

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  // Helper to check if a submenu link is active (handling query params)
  const isSubActive = (href: string) => {
    if (href.includes('?')) {
      const [path, query] = href.split('?');
      if (pathname !== path) return false;
      const subParams = new URLSearchParams(query);
      const entries = Array.from(subParams.entries());
      for (const [key, val] of entries) {
        if (searchParams.get(key) !== val) return false;
      }
      return true;
    }
    return pathname === href;
  }

  const handleLinkClick = () => {
    // Close sidebar on mobile when clicking a link
    onClose();
  };

  return (
    <aside className={`
      fixed left-0 top-0 h-screen w-64 bg-oms-dark flex flex-col z-40
      transform transition-transform duration-300 ease-in-out
      ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      lg:translate-x-0
    `}>
      {/* Logo & Close Button */}
      <div className="p-6 flex items-center justify-between">
        <Link
          href={profile?.role === 'designer' ? '/admin/designers/tasks' : '/admin/dashboard'}
          className="flex items-center gap-3"
          onClick={handleLinkClick}
        >
          <div className="w-10 h-10 bg-oms-blue rounded-xl flex items-center justify-center">
            <span className="text-white font-bold text-lg">A</span>
          </div>
          <span className="font-bold text-white text-xl">Aayam</span>
        </Link>

        {/* Close button - mobile only */}
        <button
          onClick={onClose}
          className="lg:hidden p-2 text-gray-400 hover:text-white"
        >
          <X size={20} />
        </button>
      </div>

      {/* Search */}
      <div className="px-4 mb-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Search..."
            className="w-full pl-9 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3">
        <div className="space-y-1">
          {!profile ? (
            // Loading skeleton while profile loads
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-12 bg-white/5 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : !profile.role ? (
            // User has no role assigned - show error state
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
              <p className="text-sm text-red-400 font-medium">⚠️ No Role Assigned</p>
              <p className="text-xs text-gray-400 mt-1">Contact admin to assign your role</p>
              <p className="text-xs text-gray-500 mt-2">Email: {profile.email}</p>
            </div>
          ) : (
            menuItems.filter(item => {
              // Get the user's role - no defaults, no fallbacks
              const userRole = profile.role;

              // Debug logging to help diagnose role issues  
              if (process.env.NODE_ENV === 'development') {
                console.log('[Sidebar Debug]', {
                  userRole,
                  itemName: item.name,
                  allowedRoles: item.allowedRoles,
                  profileEmail: profile.email,
                  will_show: item.allowedRoles ? item.allowedRoles.includes(userRole) : true
                });
              }

              // If no allowed roles specified, show to everyone
              // (Note: All sensitive menu items should ALWAYS have allowedRoles defined)
              if (!item.allowedRoles || item.allowedRoles.length === 0) {
                return true;
              }

              // Check if user's role is in the allowed list
              const isAllowed = item.allowedRoles.includes(userRole);

              if (!isAllowed && process.env.NODE_ENV === 'development') {
                console.log(`[Sidebar] Hiding "${item.name}" from ${userRole} (allowed: ${item.allowedRoles.join(', ')})`);
              }

              return isAllowed;
            }).map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              const isExpanded = expandedItems.includes(item.name);
              const hasSubmenu = item.submenu && item.submenu.length > 0;

              return (
                <div key={item.name}>
                  {hasSubmenu && item.name !== 'Design Studio' ? (
                    <button
                      onClick={() => toggleExpanded(item.name)}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all text-body
                      ${active
                          ? 'bg-[rgba(0,0,255,0.15)] text-white border-l-4 border-oms-blue'
                          : 'text-white/70 hover:bg-white/5 hover:text-white'
                        }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon size={18} />
                        <span className="text-body font-medium">{item.name}</span>
                      </div>
                      <ChevronDown
                        size={14}
                        className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      />
                    </button>
                  ) : (
                    <Link
                      href={item.href}
                      onClick={handleLinkClick}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all
                      ${active
                          ? 'bg-[rgba(0,0,255,0.15)] border-l-4 border-oms-blue text-white'
                          : 'text-white/70 hover:bg-white/5 hover:text-white'
                        }`}
                    >
                      <Icon size={18} />
                      <span className="text-body font-medium">{item.name}</span>
                    </Link>
                  )}

                  {/* Submenu */}
                  {hasSubmenu && (isExpanded || item.name === 'Design Studio') && (
                    <div className="ml-4 mt-1 space-y-1 border-l border-white/10 pl-4">
                      {item.submenu!.map((sub) => {
                        let badge = 0;
                        if (sub.name === 'Leads') badge = stats?.leadsThisMonth || 0;
                        // Follow-ups counter removed - was showing incorrect numbers
                        // if (sub.name === 'Follow-ups') badge = stats?.alerts?.followUpsDue || 0;
                        if (sub.name === 'Production Queue') badge = (stats?.pipeline?.printing || 0) + (stats?.pipeline?.finishing || 0);
                        // if (sub.name === 'My Queue' && profile?.id && stats?.myTasks) badge = stats.myTasks; 

                        const showBadge = badge > 0;

                        return (
                          <Link
                            key={sub.href}
                            href={sub.href}
                            onClick={handleLinkClick}
                            className={`group flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all
                          ${isSubActive(sub.href)
                                ? 'bg-white/10 text-white font-medium'
                                : 'text-gray-500 hover:text-white'
                              }`}
                          >
                            <span>{sub.name}</span>
                            {showBadge && (
                              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${isSubActive(sub.href) ? 'bg-white text-oms-blue' : 'bg-white/10 text-gray-400 group-hover:bg-[rgba(0,0,255,0.1)] group-hover:text-white'}`}>
                                {badge}
                              </span>
                            )}
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </nav>

      {/* User Profile */}
      <div className="p-4 border-t border-white/10">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5">
          <div className="w-10 h-10 bg-oms-blue rounded-full flex items-center justify-center text-white font-semibold">
            {profile?.full_name?.charAt(0) || 'A'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-white text-sm truncate">{profile?.full_name}</p>
            <div className="flex items-center gap-2">
              <p className="text-xs text-gray-500 capitalize">{profile?.role}</p>
              <span className="text-[10px] bg-[rgba(0,0,255,0.1)]/20 text-indigo-300 px-1.5 py-0.5 rounded">v1.7.0</span>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              title="Logout"
            >
              <LogOut size={16} className="text-gray-500" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
