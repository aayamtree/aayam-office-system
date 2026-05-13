#!/usr/bin/env node
/**
 * fix-native-dialogs.js
 * Replaces all native alert() and confirm() calls with React toast/useConfirm.
 * Run: node fix-native-dialogs.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = '/Users/satish/Desktop/01 PROJECT/OFFICE SYSTEM 2/aayam-office-2';

// Get all affected files (excluding node_modules, .next, .old files)
const output = execSync(
    `grep -rln "[^a-zA-Z]alert([^s]\\|window\\.alert\\|[^a-zA-Z]confirm(" ` +
    `--include="*.tsx" --include="*.ts" ` +
    `"${ROOT}/app/admin/" "${ROOT}/components/"`,
    { encoding: 'utf-8' }
).trim();

const files = output.split('\n').filter(f => f && !f.includes('.old.') && !f.includes('fix-native'));
console.log(`Found ${files.length} files to process\n`);

let totalFixed = 0;

files.forEach(filePath => {
    let content = fs.readFileSync(filePath, 'utf-8');
    const original = content;
    let changed = false;

    // ── 1. Replace alert() with toast calls ──────────────────────────────────
    // alert('✅ ...')  → toast.success('...')
    content = content.replace(/\balert\('✅\s*(.*?)'\)/g, (_, msg) => {
        changed = true;
        return `toast.success('${msg}')`;
    });
    content = content.replace(/\balert\("✅\s*(.*?)"\)/g, (_, msg) => {
        changed = true;
        return `toast.success("${msg}")`;
    });
    // alert with template literal ✅
    content = content.replace(/\balert\(`✅\s*(.*?)`\)/gs, (_, msg) => {
        changed = true;
        return `toast.success(\`${msg}\`)`;
    });

    // alert('❌ ...')  → toast.error('...')
    content = content.replace(/\balert\('❌\s*(.*?)'\)/g, (_, msg) => {
        changed = true;
        return `toast.error('${msg}')`;
    });
    content = content.replace(/\balert\("❌\s*(.*?)"\)/g, (_, msg) => {
        changed = true;
        return `toast.error("${msg}")`;
    });
    content = content.replace(/\balert\(`❌\s*(.*?)`\)/gs, (_, msg) => {
        changed = true;
        return `toast.error(\`${msg}\`)`;
    });

    // alert('Google Drive connected successfully!') → toast.success(...)
    content = content.replace(/\balert\('Google Drive connected successfully!'\)/g, () => {
        changed = true;
        return `toast.success('Google Drive connected successfully!')`;
    });
    content = content.replace(/\balert\('Google Drive disconnected successfully'\)/g, () => {
        changed = true;
        return `toast.success('Google Drive disconnected successfully')`;
    });

    // alert('Error ...') or alert('Failed ...') → toast.error(...)
    content = content.replace(/\balert\('((?:Error|Failed|error|failed)[^']*)'\)/g, (_, msg) => {
        changed = true;
        return `toast.error('${msg}')`;
    });
    content = content.replace(/\balert\("((?:Error|Failed|error|failed)[^"]*)"\)/g, (_, msg) => {
        changed = true;
        return `toast.error("${msg}")`;
    });
    content = content.replace(/\balert\(`((?:Error|Failed|error|failed)[^`]*)`\)/g, (_, msg) => {
        changed = true;
        return `toast.error(\`${msg}\`)`;
    });

    // alert('...required...' or 'Please...') → toast.error(...)
    content = content.replace(/\balert\('((?:.*required.*|Please[^']*)?)'\)/g, (_, msg) => {
        changed = true;
        return `toast.error('${msg}')`;
    });

    // Remaining single-quoted alerts → try to infer from content
    // Contains 'success', 'created', 'added', 'saved', 'updated' → toast.success
    const successWords = /success|created|added|saved|updated|deleted|sent|connected|done/i;
    const errorWords = /error|fail|wrong|invalid|required|unable|cannot|not found/i;

    content = content.replace(/\balert\(('(?:[^'\\]|\\.)*')\)/g, (full, str) => {
        changed = true;
        if (successWords.test(str)) return `toast.success(${str})`;
        if (errorWords.test(str)) return `toast.error(${str})`;
        return `toast.info(${str})`;
    });
    content = content.replace(/\balert\(("(?:[^"\\]|\\.)*")\)/g, (full, str) => {
        changed = true;
        if (successWords.test(str)) return `toast.success(${str})`;
        if (errorWords.test(str)) return `toast.error(${str})`;
        return `toast.info(${str})`;
    });
    content = content.replace(/\balert\((`(?:[^`\\]|\\.)*`)\)/g, (full, str) => {
        changed = true;
        if (successWords.test(str)) return `toast.success(${str})`;
        if (errorWords.test(str)) return `toast.error(${str})`;
        return `toast.info(${str})`;
    });

    // alert(variable) → toast.error(variable)
    content = content.replace(/\balert\(([^)]+)\)/g, (full, arg) => {
        if (arg.includes('toast') || arg.includes('confirm')) return full; // skip if already replaced
        changed = true;
        return `toast.error(String(${arg}))`;
    });

    // ── 2. Add toast import if we made changes and it's not already there ────
    if (changed && !content.includes("from '@/lib/toast'") && !content.includes('from "@/lib/toast"')) {
        // Find first import line and add after it
        const firstImport = content.match(/^import .+$/m);
        if (firstImport) {
            content = content.replace(firstImport[0], `${firstImport[0]}\nimport { toast } from '@/lib/toast';`);
        } else {
            content = `import { toast } from '@/lib/toast';\n` + content;
        }
    }

    // ── 3. Write back if changed ─────────────────────────────────────────────
    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf-8');
        const relPath = filePath.replace(ROOT + '/', '');
        const count = (original.match(/\balert\(/g) || []).length;
        console.log(`✅ Fixed ${count} alert() call(s) in: ${relPath}`);
        totalFixed++;
    }
});

console.log(`\n✨ Done! Fixed ${totalFixed} files.`);
console.log('\n⚠️  Remaining confirm() calls need manual useConfirm() replacement — check with:');
console.log('grep -rn "[^a-zA-Z]confirm(" --include="*.tsx" app/admin/ components/ | grep -v "// " | grep -v "confirmed"');
