#!/usr/bin/env node

/**
 * Final Blue Color Cleanup
 * Catches remaining edge cases like text-blue-800, ring-blue-500/20, etc.
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Find all TSX files
const files = glob.sync('app/admin/**/*.tsx', { cwd: process.cwd() });

const edgeCaseReplacements = [
    // Text colors -  all shades
    { pattern: /text-blue-300\b/g, replacement: 'text-muted-foreground' },
    { pattern: /text-blue-400\b/g, replacement: 'text-muted-foreground' },
    { pattern: /text-blue-800\b/g, replacement: 'text-foreground' },

    // Ring/focus colors
    { pattern: /ring-blue-500\/20/g, replacement: 'ring-ring/20' },
    { pattern: /focus:ring-blue-500/g, replacement: 'focus:ring-ring' },

    //Placeholder colors
    { pattern: /placeholder:text-blue-300/g, replacement: 'placeholder:text-muted-foreground' },
];

console.log(`Scanning ${files.length} files for edge cases...\n`);

let totalChanges = 0;
let filesChanged = 0;

files.forEach((file) => {
    const filePath = path.join(process.cwd(), file);
    let content = fs.readFileSync(filePath, 'utf-8');
    const originalContent = content;
    let fileChanges = 0;

    edgeCaseReplacements.forEach(({ pattern, replacement }) => {
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

console.log(`\n✅ Edge cases fixed!`);
console.log(`   Files changed: ${filesChanged}`);
console.log(`   Total replacements: ${totalChanges}`);
