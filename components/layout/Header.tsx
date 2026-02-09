'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Bell, Menu, ChevronRight, Plus } from 'lucide-react';
import Link from 'next/link';

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

export default function Header({ onMenuClick }: HeaderProps) {
  const pathname = usePathname();
  const { isAdmin } = useAuth();
  const [showNotifications, setShowNotifications] = useState(false);

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

  const notifications = [
    { id: 1, title: 'Payment overdue', desc: 'XYZ Corp - ₹50,445', time: '2h ago', type: 'danger' },
    { id: 2, title: 'QC Completed', desc: 'Order AAY-2024-003', time: '4h ago', type: 'success' },
    { id: 3, title: 'New Lead', desc: 'Tech Solutions inquiry', time: '5h ago', type: 'info' },
  ];

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
              // Also hide the chevron on mobile if the previous crumb is hidden
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
                <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full"></span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel>Notifications</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <div className="max-h-80 overflow-y-auto">
                {notifications.map((notif) => (
                  <DropdownMenuItem key={notif.id} className="flex items-start gap-3 p-3">
                    <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${notif.type === 'danger' ? 'bg-destructive' :
                      notif.type === 'success' ? 'bg-green-500' : 'bg-blue-500'
                      }`}></span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{notif.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{notif.desc}</p>
                      <p className="text-xs text-muted-foreground mt-1">{notif.time}</p>
                    </div>
                  </DropdownMenuItem>
                ))}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
