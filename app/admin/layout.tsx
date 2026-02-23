'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import DailyBriefingTrigger from '@/components/calendar/DailyBriefingTrigger';
import CommandPalette from '@/components/shared/CommandPalette';
import { MobileBottomNav } from '@/components/layout/MobileBottomNav';
import { ConfirmProvider } from '@/components/ConfirmModal';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { profile, loading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarHovered, setSidebarHovered] = useState(false);
  const [sidebarLocked, setSidebarLocked] = useState(false);

  // Load sidebar lock state from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('sidebar-locked');
    if (saved === 'true') setSidebarLocked(true);
  }, []);

  // Role-based redirect (non-blocking — just redirects after profile loads)
  useEffect(() => {
    if (!loading && !profile) {
      // Middleware should catch this, but as a fallback:
      window.location.href = '/login';
    }
  }, [profile, loading]);

  // Close sidebar when clicking outside on mobile
  const closeSidebar = () => setSidebarOpen(false);

  // NO BLOCKING SPINNER — middleware handles auth protection
  // Render immediately, profile populates asynchronously

  return (
    <ConfirmProvider>
      <div className="min-h-screen bg-background">
        {/* Mobile Overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-30 lg:hidden"
            onClick={closeSidebar}
          />
        )}

        {/* Sidebar */}
        <Sidebar
          isOpen={sidebarOpen}
          onClose={closeSidebar}
          onHoverChange={setSidebarHovered}
          locked={sidebarLocked}
          onLockedChange={(v) => { setSidebarLocked(v); localStorage.setItem('sidebar-locked', String(v)); }}
        />

        {/* Header */}
        <Header onMenuClick={() => setSidebarOpen(true)} sidebarExpanded={sidebarHovered || sidebarLocked} />

        {/* Global Command Palette (Cmd+K) */}
        <CommandPalette />

        {/* Daily Briefing - Auto shows once per day on login */}
        {profile && <DailyBriefingTrigger />}

        {/* Main Content */}
        <main className={`pt-20 lg:pt-24 px-4 md:px-6 lg:px-8 py-6 min-h-screen transition-[margin] duration-200 ease-in-out ${(sidebarHovered || sidebarLocked) ? 'lg:ml-64' : 'lg:ml-16'}`}>
          {children}
        </main>

        {/* Mobile Bottom Navigation */}
        <MobileBottomNav />
      </div>
    </ConfirmProvider>
  );
}
