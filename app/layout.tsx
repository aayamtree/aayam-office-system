import type { Metadata, Viewport } from 'next';
import { Providers } from '@/components/Providers';
import { StaleBuildReloader } from '@/components/StaleBuildReloader';

import { Toaster } from '@/components/ui/toaster';
import './globals.css';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#FAF9F5',
};

export const metadata: Metadata = {
  title: 'Aayam Office System',
  description: 'Complete Business Management System',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Aayam',
  },

};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body>
        {/* Recovers tabs left open across a deploy — see the component for why. */}
        <StaleBuildReloader />
        <Providers>

          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
