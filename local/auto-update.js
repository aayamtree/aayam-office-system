#!/usr/bin/env node
/**
 * Aayam Office — Auto Update Script
 *
 * Runs every night at 2:00 AM on the office server PC.
 * Checks if there are new changes on git, and if yes:
 *   1. Pulls the latest code
 *   2. Installs any new packages
 *   3. Rebuilds the app
 *   4. Restarts the server automatically
 *
 * Keeps a log at: local/update.log
 * On failure: does NOT restart — old version keeps running safely
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const LOG_FILE = path.join(__dirname, 'update.log');
const MAX_LOG_LINES = 500; // keep last 500 lines

// ── Logging ───────────────────────────────────────────────────
function log(msg) {
  const line = `[${new Date().toLocaleString('en-IN')}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + '\n');
  trimLog();
}

function trimLog() {
  try {
    const lines = fs.readFileSync(LOG_FILE, 'utf8').split('\n');
    if (lines.length > MAX_LOG_LINES) {
      fs.writeFileSync(LOG_FILE, lines.slice(-MAX_LOG_LINES).join('\n'));
    }
  } catch {}
}

// ── Run a shell command, return output ────────────────────────
function run(cmd, opts = {}) {
  return execSync(cmd, { cwd: ROOT, encoding: 'utf8', ...opts }).trim();
}

// ── Check if internet is available ───────────────────────────
function hasInternet() {
  try {
    run('git ls-remote --heads origin HEAD', { timeout: 10000 });
    return true;
  } catch {
    return false;
  }
}

// ── Main update logic ─────────────────────────────────────────
async function checkAndUpdate() {
  log('── Checking for updates ──');

  // Skip if no internet
  if (!hasInternet()) {
    log('No internet — skipping update check (app keeps running as-is)');
    return;
  }

  // Fetch latest info from git (no changes yet, just metadata)
  try {
    run('git fetch origin main');
  } catch (e) {
    log(`git fetch failed: ${e.message} — skipping`);
    return;
  }

  // Compare local vs remote
  const localHash  = run('git rev-parse HEAD');
  const remoteHash = run('git rev-parse origin/main');

  if (localHash === remoteHash) {
    log(`Already up to date (${localHash.substring(0, 7)}) — no rebuild needed`);
    return;
  }

  log(`Update found: ${localHash.substring(0, 7)} → ${remoteHash.substring(0, 7)}`);

  // Get list of changed files for the log
  try {
    const changes = run(`git log --oneline ${localHash}..${remoteHash}`);
    log(`New commits:\n${changes}`);
  } catch {}

  // ── Pull ──────────────────────────────────────────────────
  log('Pulling changes...');
  try {
    run('git pull origin main');
  } catch (e) {
    log(`ERROR: git pull failed — ${e.message}`);
    log('App keeps running on old version. Fix manually.');
    return;
  }

  // ── Install new packages if package.json changed ──────────
  try {
    const changedFiles = run(`git diff HEAD~1 --name-only`);
    if (changedFiles.includes('package.json')) {
      log('package.json changed — installing new packages...');
      run('npm install --prefer-offline', { timeout: 120000 });
    }
  } catch {}

  // ── Build ─────────────────────────────────────────────────
  log('Building app (this takes 2-3 minutes)...');
  try {
    run('npm run build', { timeout: 300000 }); // 5 min timeout
    log('Build successful ✅');
  } catch (e) {
    log(`ERROR: Build failed — ${e.message}`);
    log('Reverting to previous version...');
    try {
      run(`git reset --hard ${localHash}`);
      log(`Reverted to ${localHash.substring(0, 7)} — app still running safely`);
    } catch {}
    return;
  }

  // ── Restart ───────────────────────────────────────────────
  log('Restarting server with new version...');
  // Signal the parent process (start.js) to restart
  // We do this by exiting — the .bat/.command wrapper restarts on exit
  log(`Update complete → now running ${remoteHash.substring(0, 7)}`);
  log('── Done ──');

  // Give logs a moment to flush, then restart
  setTimeout(() => process.exit(0), 1000);
}

// ── Schedule: run at 2:00 AM every night ─────────────────────
function scheduleNightly() {
  function msUntil2AM() {
    const now = new Date();
    const next = new Date();
    next.setHours(2, 0, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    return next - now;
  }

  function scheduleNext() {
    const ms = msUntil2AM();
    const hrs = Math.round(ms / 3600000);
    log(`Next update check in ~${hrs} hours (at 2:00 AM)`);
    setTimeout(async () => {
      await checkAndUpdate();
      scheduleNext();
    }, ms);
  }

  scheduleNext();
}

// ── Entry point ───────────────────────────────────────────────
if (require.main === module) {
  // If called with --now flag, run immediately (for testing)
  if (process.argv.includes('--now')) {
    checkAndUpdate().then(() => {
      if (!process.argv.includes('--stay')) process.exit(0);
    });
  } else {
    // Normal mode: schedule nightly
    scheduleNightly();
  }
} else {
  // Required from start.js — export the scheduler
  module.exports = { scheduleNightly, checkAndUpdate };
}
