'use client';

import { ReactNode } from 'react';
import { AuthProvider } from '@/lib/auth-context';
import { PushNotificationManager } from '@/components/PushNotificationManager';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      {children}
      <PushNotificationManager />
    </AuthProvider>
  );
}
