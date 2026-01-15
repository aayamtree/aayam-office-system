'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Bell, Settings, ChevronDown, Plus, Menu, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { Fragment } from 'react';

interface HeaderProps {
  onMenuClick: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { profile, signOut, isAdmin } = useAuth();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  // Generate Breadcrumbs
  const generateBreadcrumbs = () => {
    // Remove /admin and split
    const pathSegments = pathname.split('/').filter(p => p !== '' && p !== 'admin');

    // Default to Dashboard if empty
    if (pathSegments.length === 0) return [{ label: 'Dashboard', href: '/admin/dashboard' }];

    const segmentLabels: Record<string, string> = {
      'crm': 'CRM',
      'cmyk-print': 'CMYK Print',
      'pos': 'POS',
      'retail-pos': 'Retail POS',
      'purchase-bills': 'Purchase Bills',
    };

    const breadcrumbs = pathSegments.map((segment, index) => {
      const href = '/admin/' + pathSegments.slice(0, index + 1).join('/');

      // Use map or auto-format
      const label = segmentLabels[segment] || segment.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

      return { label, href };
    });

    return [{ label: 'Dashboard', href: '/admin/dashboard' }, ...breadcrumbs];
  };

  const breadcrumbs = generateBreadcrumbs();

  const notifications = [
    { id: 1, title: 'Payment overdue', desc: 'XYZ Corp - ₹50,445', time: '2h ago', type: 'danger' },
    { id: 2, title: 'QC Completed', desc: 'Order AAY-2024-003', time: '4h ago', type: 'success' },
    { id: 3, title: 'New Lead', desc: 'Tech Solutions inquiry', time: '5h ago', type: 'info' },
  ];

  const handleLogout = async () => {
    await signOut();
    router.push('/login');
  };

  return (
    <header className="fixed top-0 left-0 right-0 lg:left-64 h-16 bg-white/80 backdrop-blur-md border-b border-gray-100 z-20">
      <div className="h-full px-4 lg:px-6 flex items-center justify-between">
        {/* Left - Menu Button & Breadcrumbs */}
        <div className="flex items-center gap-2 lg:gap-3 flex-1 overflow-hidden mr-4 h-full">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-xl flex-shrink-0"
          >
            <Menu size={24} />
          </button>

          <nav className="flex items-center text-sm font-medium text-gray-500 overflow-x-auto scrollbar-hide whitespace-nowrap">
            {breadcrumbs.map((crumb, index) => {
              const isLast = index === breadcrumbs.length - 1;
              const isDeep = breadcrumbs.length > 1;
              const isDashboard = index === 0;
              const isFirstSeparator = index === 1;

              // Hide Dashboard on mobile/tablet (below lg) if we have a deeper path
              const hideOnMobile = isDashboard && isDeep;
              const hideSeparatorOnMobile = isFirstSeparator && isDeep;

              return (
                <div key={crumb.href} className={`flex items-center ${hideOnMobile ? 'hidden md:flex' : 'flex'}`}>
                  {index > 0 && (
                    <ChevronRight
                      size={16}
                      className={`mx-1 text-gray-400 flex-shrink-0 ${hideSeparatorOnMobile ? 'hidden md:block' : ''}`}
                    />
                  )}
                  <Link
                    href={crumb.href}
                    className={`flex items-center ${isLast ? 'text-gray-900 font-semibold' : 'hover:text-gray-900'} transition-colors py-1`}
                  >
                    {crumb.label}
                  </Link>
                </div>
              );
            })}
          </nav>
        </div>

        {/* Right - Actions */}
        <div className="flex items-center gap-2 lg:gap-3">
          {/* Quick Add - Hidden on small mobile - ADMIN ONLY */}
          {isAdmin && (
            <Link
              href="/admin/sales/orders"
              className="hidden sm:flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-indigo-500 text-white px-3 lg:px-4 py-2 rounded-xl text-sm font-medium hover:from-indigo-700 hover:to-indigo-600 transition-all"
            >
              <Plus size={16} />
              <span className="hidden md:inline">New Order</span>
            </Link>
          )}

          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 lg:p-2.5 hover:bg-gray-100 rounded-xl transition-colors"
            >
              <Bell size={20} className="text-gray-600" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>

            {showNotifications && (
              <div className="absolute right-0 top-12 w-72 lg:w-80 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                <div className="p-4 border-b border-gray-100">
                  <h3 className="font-semibold text-gray-900">Notifications</h3>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications.map((notif) => (
                    <div key={notif.id} className="p-4 hover:bg-gray-50 border-b border-gray-50 cursor-pointer">
                      <div className="flex items-start gap-3">
                        <span className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${notif.type === 'danger' ? 'bg-red-500' :
                          notif.type === 'success' ? 'bg-green-500' : 'bg-blue-500'
                          }`}></span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">{notif.title}</p>
                          <p className="text-xs text-gray-500 truncate">{notif.desc}</p>
                          <p className="text-xs text-gray-400 mt-1">{notif.time}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Settings - Hidden on mobile - ADMIN ONLY */}
          {isAdmin && (
            <Link href="/admin/settings" className="hidden lg:block p-2.5 hover:bg-gray-100 rounded-xl transition-colors">
              <Settings size={20} className="text-gray-600" />
            </Link>
          )}

          {/* Divider - Hidden on mobile */}
          <div className="hidden lg:block w-px h-8 bg-gray-200"></div>

          {/* User Menu */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 lg:gap-3 p-1.5 lg:p-2 hover:bg-gray-100 rounded-xl transition-colors"
            >
              <div className="w-8 h-8 lg:w-9 lg:h-9 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                {profile?.full_name?.charAt(0) || 'A'}
              </div>
              <div className="text-left hidden md:block">
                <p className="text-sm font-medium text-gray-900">{profile?.full_name}</p>
                <p className="text-xs text-gray-500 capitalize">{profile?.role}</p>
              </div>
              <ChevronDown size={16} className="text-gray-400 hidden md:block" />
            </button>

            {showUserMenu && (
              <div className="absolute right-0 top-12 lg:top-14 w-48 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden">
                <div className="p-2">
                  {isAdmin && (
                    <Link href="/admin/settings" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg">
                      Profile Settings
                    </Link>
                  )}
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg"
                  >
                    Logout
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
