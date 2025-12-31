'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { profile, loading } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !loading && !profile) {
      router.push('/login');
    }
  }, [mounted, profile, loading, router]);

  // Close sidebar when clicking outside on mobile
  const closeSidebar = () => setSidebarOpen(false);

  if (!mounted || loading) {
    return (
      <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#f5f5f7]">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={closeSidebar}
        />
      )}
      
      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={closeSidebar} />
      
      {/* Header */}
      <Header onMenuClick={() => setSidebarOpen(true)} />
      
      {/* Main Content - Full width on mobile, with sidebar margin on desktop */}
      <main className="lg:ml-64 pt-20 lg:pt-24 p-4 lg:p-6 min-h-screen">
        {children}
      </main>
    </div>
  );
}
