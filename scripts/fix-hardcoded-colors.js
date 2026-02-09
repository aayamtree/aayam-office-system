#!/usr/bin/env node

/**
 * Fix Hardcoded Blue Hex/RGBA Colors
 * Replaces bg-[#0000FF] and bg-[rgba(0,0,255...)] with Shadcn classes
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Hardcoded color replacements
const replacements = [
    // Primary blue buttons
    { pattern: /bg-\[#0000FF\]/g, replacement: 'bg-primary' },
    { pattern: /hover:bg-\[#0000CC\]/g, replacement: 'hover:bg-primary/90' },

    // Blue rgba backgrounds
    { pattern: /bg-\[rgba\(0,0,255,0\.05\)\]/g, replacement: 'bg-muted' },
    { pattern: /bg-\[rgba\(0,0,255,0\.1\)\]/g, replacement: 'bg-muted' },
    { pattern: /border-\[rgba\(0,0,255,0\.2\)\]/g, replacement: 'border-border' },
];

// Get all files with hardcoded colors
const filesOutput = execSync(
    'grep -r "bg-\\[#0000FF\\]\\|bg-\\[rgba(0,0,255" app/admin --include="*.tsx" -l',
    { cwd: process.cwd(), encoding: 'utf-8' }
);

const files = filesOutput.trim().split('\n').filter(Boolean);

console.log(`Found ${files.length} files with hardcoded colors\n`);

let totalChanges = 0;
let filesChanged = 0;

files.forEach((file) => {
    const filePath = path.join(process.cwd(), file);
    let content = fs.readFileSync(filePath, 'utf-8');
    const originalContent = content;
    let fileChanges = 0;

    replacements.forEach(({ pattern, replacement }) => {
        const matches = content.match(pattern);
        if (matches) {
            content = content.replace(pattern, replacement);
            fileChanges += matches.length;
        }
    });

    if (content !== originalContent) {
        fs.writeFileSync(filePath, content, 'utf-8');
        filesChanged++;
        totalChanges += fileChanges;
        console.log(`✓ ${file} (${fileChanges} changes)`);
    }
});

console.log(`\n✅ Hardcoded colors fixed!`);
console.log(`   Files changed: ${filesChanged}/${files.length}`);
console.log(`   Total replacements: ${totalChanges}`);
