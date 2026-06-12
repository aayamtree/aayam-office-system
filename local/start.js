#!/usr/bin/env node
/**
 * Aayam Office — Local Network Launcher
 *
 * What this does:
 *  1. Advertises "aayam.local" on your LAN via mDNS (no static IP needed)
 *  2. Starts the Next.js app on port 3000
 *  3. Runs all cron jobs locally (replaces Vercel cron)
 *
 * How to use:
 *  node local/start.js
 *
 * Staff then open:  http://aayam.local:3000
 */

const { spawn } = require('child_process');
const path = require('path');
const os = require('os');

// ── Detect local IP for display purposes ─────────────────────
function getLocalIP() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return 'unknown';
}

const localIP = getLocalIP();
const APP_PORT = process.env.PORT || 3000;
const APP_URL = `http://localhost:${APP_PORT}`;

// ── mDNS advertisement ────────────────────────────────────────
function startMDNS() {
  try {
    const bonjour = require('bonjour-service');
    const b = new bonjour.Bonjour();
    b.publish({
      name: 'Aayam Office',
      type: 'http',
      port: Number(APP_PORT),
      host: 'aayam.local',
    });
    console.log(`🌐 mDNS: http://aayam.local:${APP_PORT} is now discoverable on LAN`);
    // Keep bonjour alive — clean up on exit
    process.on('exit', () => b.destroy());
    process.on('SIGINT', () => { b.destroy(); process.exit(); });
    process.on('SIGTERM', () => { b.destroy(); process.exit(); });
  } catch (e) {
    console.warn('⚠️  mDNS not available (run: npm install bonjour-service)');
    console.log(`   Staff can still use: http://${localIP}:${APP_PORT}`);
  }
}

// ── Auto-update (nightly at 2 AM) ────────────────────────────
function startAutoUpdate() {
  try {
    const { scheduleNightly } = require('./auto-update');
    scheduleNightly();
    console.log('🔄 Auto-update: will check for new code every night at 2:00 AM');
  } catch (e) {
    console.warn('⚠️  Auto-update not started:', e.message);
  }
}

// ── Start Next.js ─────────────────────────────────────────────
function startNextJS() {
  console.log('🚀 Starting Next.js app...');
  const isWindows = process.platform === 'win32';
  const npmCmd = isWindows ? 'npm.cmd' : 'npm';

  const next = spawn(npmCmd, ['run', 'start'], {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit',
    env: { ...process.env, HOSTNAME: '0.0.0.0', PORT: String(APP_PORT) },
  });

  next.on('error', (err) => {
    console.error('❌ Failed to start Next.js:', err.message);
    console.error('   Did you run "npm run build" first?');
    process.exit(1);
  });

  next.on('exit', (code) => {
    console.log(`Next.js exited with code ${code}`);
    process.exit(code);
  });

  return next;
}

// ── Local Cron Jobs (replaces Vercel cron) ────────────────────
function startCron() {
  try {
    require('./cron');
    console.log('⏰ Local cron jobs started');
  } catch (e) {
    console.warn('⚠️  Cron not started:', e.message);
  }
}

// ── Print banner ──────────────────────────────────────────────
function printBanner() {
  console.log('');
  console.log('╔═══════════════════════════════════════════════╗');
  console.log('║         Aayam Office — Local Server           ║');
  console.log('╠═══════════════════════════════════════════════╣');
  console.log(`║  LAN URL  :  http://aayam.local:${APP_PORT}          ║`);
  console.log(`║  Direct IP:  http://${localIP}:${APP_PORT}        ║`);
  console.log('║  Status   :  Starting...                      ║');
  console.log('╚═══════════════════════════════════════════════╝');
  console.log('');
  console.log('📌 Share "http://aayam.local:3000" with all staff');
  console.log('   Works on any device connected to office WiFi/LAN');
  console.log('');
}

// ── Main ──────────────────────────────────────────────────────
printBanner();
startMDNS();
startCron();
startAutoUpdate();
startNextJS();
