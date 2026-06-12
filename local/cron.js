/**
 * Local Cron Jobs — replaces all Vercel cron entries in vercel.json
 *
 * Vercel cron replaced:
 *  - /api/cron/keep-alive       every 5 min
 *  - /api/cron/refresh-drive-token  every 50 min
 *  - /api/cron/eod-logout       Mon-Sat at 19:30 IST (14:00 UTC)
 *  - /api/cron/optimize-db      daily at 01:30 IST & 09:00 IST
 *
 * Runs inside the same process as start.js — no extra process needed.
 */

const https = require('https');
const http = require('http');

const APP_PORT = process.env.PORT || 3000;
const BASE_URL = `http://localhost:${APP_PORT}`;
const CRON_SECRET = process.env.CRON_SECRET || '';

// ── Simple HTTP caller ────────────────────────────────────────
function callRoute(path) {
  return new Promise((resolve) => {
    const url = `${BASE_URL}${path}`;
    const options = {
      headers: CRON_SECRET ? { authorization: `Bearer ${CRON_SECRET}` } : {},
    };
    http.get(url, options, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        console.log(`[cron] ${path} → ${res.statusCode}`);
        resolve({ status: res.statusCode, body });
      });
    }).on('error', (e) => {
      console.warn(`[cron] ${path} failed: ${e.message}`);
      resolve({ error: e.message });
    });
  });
}

// ── Interval helpers ──────────────────────────────────────────
function everyMinutes(n, fn) {
  // Wait for app to boot before first run
  setTimeout(() => {
    fn();
    setInterval(fn, n * 60 * 1000);
  }, 30 * 1000); // 30s boot delay
}

function dailyAt(hour, minute, fn, daysOfWeek) {
  // daysOfWeek: 0=Sun,1=Mon,...,6=Sat. null = every day
  function scheduleNext() {
    const now = new Date();
    const next = new Date();
    next.setHours(hour, minute, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);

    // Skip to next valid day if daysOfWeek specified
    if (daysOfWeek) {
      while (!daysOfWeek.includes(next.getDay())) {
        next.setDate(next.getDate() + 1);
      }
    }

    const msUntil = next - now;
    setTimeout(() => {
      const today = new Date().getDay();
      if (!daysOfWeek || daysOfWeek.includes(today)) fn();
      scheduleNext();
    }, msUntil);
  }
  scheduleNext();
}

// ── Schedule all cron jobs ────────────────────────────────────

// 1. Keep-alive: every 5 minutes
everyMinutes(5, () => callRoute('/api/cron/keep-alive'));

// 2. Refresh Google Drive token: every 50 minutes
everyMinutes(50, () => callRoute('/api/cron/refresh-drive-token'));

// 3. EOD logout: Mon-Sat at 19:30 IST
//    IST = UTC+5:30, so we run at local time 19:30
//    If system clock is IST, use 19:30. If UTC, use 14:00.
const isIST = Intl.DateTimeFormat().resolvedOptions().timeZone?.includes('Calcutta') ||
              Intl.DateTimeFormat().resolvedOptions().timeZone?.includes('Kolkata');
const eodHour = isIST ? 19 : 14;
const eodMin  = isIST ? 30 : 0;
dailyAt(eodHour, eodMin, () => callRoute('/api/cron/eod-logout'), [1,2,3,4,5,6]);
console.log(`[cron] EOD logout scheduled at ${eodHour}:${String(eodMin).padStart(2,'0')} local time (Mon-Sat)`);

// 4. Optimize DB: daily at 01:30 and 09:00 IST
const dbHour1 = isIST ? 1 : 20; // 01:30 IST = 20:00 UTC prev day (approx)
const dbHour2 = isIST ? 9 : 3;  // 09:00 IST = 03:30 UTC
dailyAt(dbHour1, 30, () => callRoute('/api/cron/optimize-db'), null);
dailyAt(dbHour2, 0,  () => callRoute('/api/cron/optimize-db'), null);

console.log('[cron] All jobs scheduled');
