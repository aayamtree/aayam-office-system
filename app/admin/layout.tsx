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
import { SessionProvider } from 'next-auth/react';
import { GlobalErrorBoundary } from '@/components/ErrorBoundary';
import ToastContainer from '@/components/ToastContainer';
import EODNudge from '@/components/eod/EODNudge';
import RouteGuard from '@/components/layout/RouteGuard';
import { NotificationPopup } from '@/components/NotificationPopup';
import DriveDisconnectBanner from '@/components/drive/DriveDisconnectBanner';
import FloatingDock from '@/components/shared/FloatingDock';
import ChatPanel from '@/components/ChatPanel';
import { ServiceWorkerRegistration } from '@/components/ServiceWorkerRegistration';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { profile, loading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // sidebarCollapsed is driven by Sidebar's internal click-toggle (persisted to localStorage).
  // Hover-expand was permanently removed — it caused a CSS layout-shift oscillation loop
  // that froze the browser after ~5 minutes of use.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  // Role-based redirect (non-blocking — just redirects after profile loads)
  useEffect(() => {
    if (!loading && !profile) {
      // Middleware should catch this, but as a fallback:
      window.location.href = '/login';
    }
  }, [profile, loading]);

  // Close sidebar when clicking outside on mobile
  const closeSidebar = () => setSidebarOpen(false);

  // Brief loading gate — with cookie-based sessions this resolves in <100ms
  // (vs old 3-6s with localStorage + timeout approach)
  if (loading) {
    return (
      <ConfirmProvider>
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="w-8 h-8 border-3 border-muted border-t-foreground rounded-full animate-spin" />
        </div>
      </ConfirmProvider>
    );
  }

  return (
    <SessionProvider>
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
            onCollapsedChange={setSidebarCollapsed}
          />

          {/* Header */}
          <Header onMenuClick={() => setSidebarOpen(true)} sidebarExpanded={!sidebarCollapsed} />

          {/* Global Command Palette (Cmd+K) */}
          <CommandPalette />

          {/* Daily Briefing - Auto shows once per day on login */}
          {profile && <DailyBriefingTrigger />}

          {/* Google Drive Disconnect Banner — shows for admins when Drive is not connected */}
          <div className={`fixed top-16 left-0 right-0 z-20 transition-[left] duration-300 ease-in-out ${sidebarCollapsed ? 'lg:left-16' : 'lg:left-64'}`}>
            <DriveDisconnectBanner />
          </div>

          {/* Main Content — RouteGuard enforces RBAC per role before rendering */}
          <main className={`pt-20 lg:pt-24 px-4 md:px-6 lg:px-8 py-6 min-h-screen transition-[margin] duration-300 ease-in-out ${sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64'}`}>
            <GlobalErrorBoundary>
              <RouteGuard>
                {children}
              </RouteGuard>
            </GlobalErrorBoundary>
          </main>

          {/* Mobile Bottom Navigation */}
          <MobileBottomNav />

          {/* Global toast notifications — replaces native alert() across app */}
          <ToastContainer />

          {/* EOD Nudge — appears at 5:30pm for non-admin staff who haven't submitted yet */}
          {profile && profile.role !== 'admin' && <EODNudge />}

          {/* In-app notification popups (broadcast system) + push notification trigger */}
          <NotificationPopup />

          {/* PWA Service Worker + Push Notification subscription */}
          <ServiceWorkerRegistration />

          {/* Floating dock — GST calculator + team chat, draggable up/down on the right edge */}
          <FloatingDock onOpenChat={() => setChatOpen(true)} />

          {/* Chat Panel */}
          <ChatPanel open={chatOpen} onClose={() => setChatOpen(false)} />

        </div>
      </ConfirmProvider>
    </SessionProvider>
  );
}
