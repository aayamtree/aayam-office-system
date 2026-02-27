'use client';

import Link from 'next/link';
import { IndianRupee, FileText, CreditCard, AlertTriangle, TrendingDown, ArrowUpRight, ArrowDownRight } from 'lucide-react';

export default function FinancePage() {
  const navCards = [
    {
      href: '/admin/finance/invoices',
      icon: FileText,
      title: 'Invoices',
      sub: 'Manage & track invoices',
      headerBg: 'bg-gray-900',
    },
    {
      href: '/admin/finance/payments',
      icon: CreditCard,
      title: 'Payments',
      sub: 'Record & track payments',
      headerBg: 'bg-gray-700',
    },
    {
      href: '/admin/finance/vendors',
      icon: ArrowUpRight,
      title: 'Purchases',
      sub: 'Vendors & bills',
      headerBg: 'bg-gray-800',
    },
    {
      href: '/admin/finance/expenses',
      icon: TrendingDown,
      title: 'Expenses',
      sub: 'Daily & operational costs',
      headerBg: 'bg-gray-600',
    },
    {
      href: '/admin/finance/reports',
      icon: IndianRupee,
      title: 'Reports',
      sub: 'Financial reports',
      headerBg: 'bg-gray-500',
    },
    {
      href: '/admin/finance/daily',
      icon: ArrowDownRight,
      title: 'Daily Summary',
      sub: 'Today\'s finance snapshot',
      headerBg: 'bg-gray-400',
    },
  ];

  return (
    <div className="space-y-2 md:space-y-4 lg:space-y-3 px-2 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-page-title text-gray-900">Finance</h1>
          <p className="text-xs md:text-sm text-gray-500">Financial overview & management</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/finance/payments?new=true"
            className="flex items-center gap-2 bg-gray-700 text-white px-3 md:px-4 py-2 rounded-md hover:bg-gray-600 transition-colors font-semibold text-sm"
          >
            <CreditCard className="w-4 h-4" />
            <span>Record Payment</span>
          </Link>
          <Link
            href="/admin/finance/invoices?new=true"
            className="flex items-center gap-2 bg-gray-900 text-white px-3 md:px-4 py-2 rounded-md hover:bg-gray-800 transition-colors font-semibold text-sm"
          >
            <FileText className="w-4 h-4" />
            <span>New Invoice</span>
          </Link>
        </div>
      </div>

      {/* Stat Cards — Job Queue style (static placeholders, real data comes from sub-pages) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-3">
        <div className="bg-gray-900 border border-gray-800 rounded-md p-2 md:p-3">
          <div className="flex items-center gap-1 md:gap-2 mb-1">
            <IndianRupee className="w-4 h-4 text-white" />
            <span className="text-xs text-white font-medium">Total Revenue</span>
          </div>
          <p className="text-page-title text-white">—</p>
        </div>
        <div className="bg-muted border border-border rounded-md p-2 md:p-3">
          <div className="flex items-center gap-1 md:gap-2 mb-1">
            <ArrowDownRight className="w-4 h-4 text-foreground" />
            <span className="text-xs text-foreground font-medium">Received</span>
          </div>
          <p className="text-page-title text-foreground">—</p>
        </div>
        <div className="bg-white border border-gray-300 rounded-md p-2 md:p-3">
          <div className="flex items-center gap-1 md:gap-2 mb-1">
            <ArrowUpRight className="w-4 h-4 text-gray-900" />
            <span className="text-xs text-gray-900 font-medium">Expenses</span>
          </div>
          <p className="text-page-title text-gray-900">—</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-md p-2 md:p-3">
          <div className="flex items-center gap-1 md:gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-red-600" />
            <span className="text-xs text-red-600 font-medium">Outstanding</span>
          </div>
          <p className="text-page-title text-red-700">—</p>
        </div>
      </div>

      {/* Navigation Cards — 3-col grid like Job Queue content cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {navCards.map((card) => (
          <Link key={card.href} href={card.href}>
            <div className="bg-white rounded-md overflow-hidden border border-gray-200 hover:shadow-sm transition-all">
              <div className={`${card.headerBg} px-3 py-2 flex items-center gap-2`}>
                <card.icon className="w-4 h-4 text-white" />
                <span className="text-white font-semibold text-sm">{card.title}</span>
              </div>
              <div className="p-3">
                <p className="text-gray-500 text-sm">{card.sub}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
