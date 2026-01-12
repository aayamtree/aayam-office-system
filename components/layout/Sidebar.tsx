'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
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
    allowedRoles: ['admin', 'account'],
  },
  {
    name: 'Projects & Jobs',
    icon: Briefcase,
    href: '/admin/jobs',
    allowedRoles: ['admin', 'account'],
  },
  {
    name: 'Design Tasks',
    icon: Palette,
    href: '/admin/designers/tasks', // Updated to point to new Workspace
    allowedRoles: ['designer'],
  },
  {
    name: 'Marketing',
    icon: Megaphone,
    href: '/admin/marketing',
    allowedRoles: ['admin', 'account', 'marketing'],
    submenu: [
      { name: 'Dashboard', href: '/admin/marketing' },
      { name: 'Leads', href: '/admin/marketing/leads' },
      { name: 'Follow-ups', href: '/admin/marketing/follow-ups' },
      { name: 'Quotations', href: '/admin/marketing/quotations' },
      { name: 'My Orders', href: '/admin/marketing/orders' },
      { name: 'Commissions', href: '/admin/marketing/commissions' },
    ]
  },
  {
    name: 'Sales',
    icon: ShoppingCart,
    href: '/admin/sales',
    allowedRoles: ['admin', 'account', 'marketing'],
    submenu: [
      { name: 'Quotations', href: '/admin/sales/quotations' },
      { name: 'Orders', href: '/admin/sales/orders' },
    ]
  },
  {
    name: 'CRM',
    icon: Users,
    href: '/admin/crm',
    allowedRoles: ['admin', 'account', 'marketing'],
    submenu: [
      { name: 'Clients', href: '/admin/crm/clients' },
      { name: 'Vendors', href: '/admin/crm/vendors' },
      { name: 'Purchases', href: '/admin/crm/vendors/purchases' },
    ]
  },
  {
    name: 'Designers Mgmt', // Renamed for clarity
    icon: Palette,
    href: '/admin/designers',
    allowedRoles: ['admin', 'account'],
  },
  {
    name: 'Finance',
    icon: IndianRupee,
    href: '/admin/finance',
    allowedRoles: ['admin', 'account'],
    submenu: [
      { name: 'Overview', href: '/admin/finance' },
      { name: 'Sales Orders', href: '/admin/finance/sales-orders' },
      { name: 'Invoices', href: '/admin/finance/invoices' },
      { name: 'Payments', href: '/admin/finance/payments' },
      { name: 'Bank Accounts', href: '/admin/finance/banks' },
      { name: 'Reconciliation', href: '/admin/finance/banking' },
    ]
  },
  {
    name: 'Dispatch',
    icon: Truck,
    href: '/admin/dispatch',
    allowedRoles: ['admin', 'account', 'dispatch'],
  },
  {
    name: 'CMYK Print',
    icon: Printer,
    href: '/admin/cmyk-print',
    allowedRoles: ['admin', 'account', 'cmyk'],
  },
  {
    name: 'Reports',
    icon: FileText,
    href: '/admin/reports',
    allowedRoles: ['admin', 'account'],
  },
  {
    name: 'Activity',
    icon: Activity,
    href: '/admin/activity',
    allowedRoles: ['admin'],
  },
  {
    name: 'Settings',
    icon: Settings,
    href: '/admin/settings',
    allowedRoles: ['admin'],
  },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, signOut } = useAuth();
  const [expandedItems, setExpandedItems] = useState<string[]>(['Marketing', 'Finance', 'Sales', 'CRM']);

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

  const handleLinkClick = () => {
    // Close sidebar on mobile when clicking a link
    onClose();
  };

  return (
    <aside className={`
      fixed left-0 top-0 h-screen w-64 bg-[#0f0f1a] flex flex-col z-40
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
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
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
          {menuItems.filter(item => {
            // If allowedRoles is missing, default to showing (safe fallback) or admin only? 
            // Let's mimic 'admin' logic if profile is missing, or show nothing.
            // If profile.role is undefined (loading), maybe show nothing or loaders.
            // But for now, if item.allowedRoles includes current role, show it.
            const userRole = profile?.role || 'admin'; // Default to admin for dev safety if profile missing
            return !item.allowedRoles || item.allowedRoles.includes(userRole);
          }).map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            const isExpanded = expandedItems.includes(item.name);
            const hasSubmenu = item.submenu && item.submenu.length > 0;

            return (
              <div key={item.name}>
                {hasSubmenu ? (
                  <button
                    onClick={() => toggleExpanded(item.name)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all
                      ${active
                        ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white'
                        : 'text-gray-400 hover:bg-white/5 hover:text-white'
                      }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon size={18} />
                      <span className="text-sm font-medium">{item.name}</span>
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
                        ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white'
                        : 'text-gray-400 hover:bg-white/5 hover:text-white'
                      }`}
                  >
                    <Icon size={18} />
                    <span className="text-sm font-medium">{item.name}</span>
                  </Link>
                )}

                {/* Submenu */}
                {hasSubmenu && isExpanded && (
                  <div className="ml-4 mt-1 space-y-1 border-l border-white/10 pl-4">
                    {item.submenu!.map((sub) => (
                      <Link
                        key={sub.href}
                        href={sub.href}
                        onClick={handleLinkClick}
                        className={`block px-3 py-2 rounded-lg text-sm transition-all
                          ${pathname === sub.href
                            ? 'bg-white/10 text-white'
                            : 'text-gray-500 hover:text-white'
                          }`}
                      >
                        {sub.name}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </nav>

      {/* User Profile */}
      <div className="p-4 border-t border-white/10">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5">
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold">
            {profile?.full_name?.charAt(0) || 'A'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-white text-sm truncate">{profile?.full_name}</p>
            <div className="flex items-center gap-2">
              <p className="text-xs text-gray-500 capitalize">{profile?.role}</p>
              <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded">v1.4</span>
            </div>
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
    </aside>
  );
}
