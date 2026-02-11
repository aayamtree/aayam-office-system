'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SessionProvider } from 'next-auth/react';
import { useAuth } from '@/lib/auth-context';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import { NotificationPopup } from '@/components/NotificationPopup';
import DailyBriefingTrigger from '@/components/calendar/DailyBriefingTrigger';
import CommandPalette from '@/components/shared/CommandPalette';
import SmartReminders from '@/components/shared/SmartReminders';
import { MobileBottomNav } from '@/components/layout/MobileBottomNav';

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
      // router.push('/login');
      // TEMPORARILY DISABLED TO FIX LOGIN LOOP
      console.log('Would redirect to login, but staying for debug');
    }
  }, [mounted, profile, loading, router]);

  // Close sidebar when clicking outside on mobile
  const closeSidebar = () => setSidebarOpen(false);

  if (!mounted || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-muted border-t-foreground rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // if (!profile) {
  //   return null;
  // }

  return (
    <SessionProvider>
      <div className="min-h-screen bg-background">
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

        {/* Broadcast Notifications Popup */}
        <NotificationPopup />

        {/* Global Command Palette (Cmd+K) */}
        <CommandPalette />

        {/* Smart Reminders (Auto) */}
        <SmartReminders />

        {/* Daily Briefing - Auto shows once per day on login */}
        {profile && <DailyBriefingTrigger />}

        {/* Main Content */}
        <main className="lg:ml-64 pt-20 lg:pt-24 px-4 md:px-6 lg:px-8 py-6 min-h-screen">
          {children}
        </main>

        {/* Mobile Bottom Navigation */}
        <MobileBottomNav />
      </div>
    </SessionProvider>
  );
}
