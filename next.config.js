/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        // Static assets (JS, CSS, fonts, images) — cache for 1 year
        // Next.js includes content hash in filenames, so this is safe
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        // Public folder assets (logo, icons etc.) — cache for 1 day
        source: '/(:path((?!api).*)).(png|jpg|jpeg|gif|svg|ico|webp|woff|woff2)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=3600' },
        ],
      },
      {
        // API routes — always fresh, never cached
        source: '/api/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' },
          { key: 'Pragma', value: 'no-cache' },
        ],
      },
      {
        // Admin pages — short cache, always revalidate
        // Keeps the app feeling live without hammering the server
        source: '/admin/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, must-revalidate' },
        ],
      },
    ];
  },
}

module.exports = nextConfig
