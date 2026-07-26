/** @type {import('next').NextConfig} */

// ---------------------------------------------------------------------------
// Content Security Policy
// ---------------------------------------------------------------------------
// Next.js injects inline bootstrap scripts and Tailwind/styled JSX emits inline
// styles, so 'unsafe-inline' is required for script-src/style-src unless we
// wire up per-request nonces. The high-value protections here are:
//   frame-ancestors 'none'  -> clickjacking
//   object-src 'none'       -> legacy plugin injection
//   base-uri 'self'         -> <base> tag hijacking of relative URLs
//   form-action 'self'      -> form-post exfiltration
// connect-src is scoped to the services this app genuinely talks to.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com https://apis.google.com https://accounts.google.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://www.googleapis.com https://oauth2.googleapis.com https://accounts.google.com https://api.telegram.org https://vitals.vercel-insights.com",
  "frame-src 'self' https://drive.google.com https://docs.google.com https://accounts.google.com",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  'upgrade-insecure-requests',
].join('; ');

// Applied to every response.
const securityHeaders = [
  // Force HTTPS for 2 years, including subdomains. Vercel serves HTTPS only.
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  // Stop the browser guessing content types (defends against upload-based XSS).
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Belt-and-braces clickjacking defence for older browsers that ignore CSP.
  { key: 'X-Frame-Options', value: 'DENY' },
  // Don't leak internal admin URLs (which contain job/client IDs) to third parties.
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Turn off browser features this app never uses.
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()' },
  // Isolate the browsing context from cross-origin popups.
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'Content-Security-Policy', value: CSP },
];

const nextConfig = {
  reactStrictMode: true,
  // Don't advertise the framework version to scanners.
  poweredByHeader: false,
  async headers() {
    return [
      {
        // Baseline security headers on every route.
        source: '/:path*',
        headers: securityHeaders,
      },
      {
        // Static assets (JS, CSS, fonts, images) — cache for 1 year
        // Next.js includes content hash in filenames, so this is safe
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        // Public folder assets (logo, icons, fonts) — cache for 1 day
        source: '/:path*.(png|jpg|jpeg|gif|svg|ico|webp|woff|woff2)',
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
