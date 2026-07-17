'use client';

// Tab bar shared across the Product Library sections: Designs (products),
// Brands (brand masters), and Products (generic product masters).

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Package, Building2, FlaskConical } from 'lucide-react';

const TABS = [
  { href: '/admin/library', label: 'Designs', icon: Package, match: (p: string) => p === '/admin/library' || /^\/admin\/library\/[0-9a-f-]{36}$/.test(p) },
  { href: '/admin/library/brands', label: 'Brands', icon: Building2, match: (p: string) => p.startsWith('/admin/library/brands') },
  { href: '/admin/library/masters', label: 'Products', icon: FlaskConical, match: (p: string) => p.startsWith('/admin/library/masters') },
];

export default function LibraryTabs() {
  const pathname = usePathname() || '';
  return (
    <div className="flex gap-1 border-b mb-4">
      {TABS.map((t) => {
        const active = t.match(pathname);
        const Icon = t.icon;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              active ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon className="w-4 h-4" /> {t.label}
          </Link>
        );
      })}
    </div>
  );
}
