#!/usr/bin/env node

/**
 * Shadcn Color Migration Script
 * Replaces all colored Tailwind classes with Shadcn semantic classes
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Color mapping rules
const replacements = [
    // Blue backgrounds -> neutral
    { pattern: /bg-blue-50\b/g, replacement: 'bg-muted' },
    { pattern: /bg-blue-100\b/g, replacement: 'bg-muted' },
    { pattern: /bg-blue-200\b/g, replacement: 'bg-muted' },
    { pattern: /bg-blue-500\b/g, replacement: 'bg-primary' },
    { pattern: /bg-blue-600\b/g, replacement: 'bg-primary' },
    { pattern: /bg-blue-700\b/g, replacement: 'bg-primary' },

    // Blue text -> neutral
    { pattern: /text-blue-50\b/g, replacement: 'text-muted' },
    { pattern: /text-blue-100\b/g, replacement: 'text-muted-foreground' },
    { pattern: /text-blue-200\b/g, replacement: 'text-muted-foreground' },
    { pattern: /text-blue-500\b/g, replacement: 'text-foreground' },
    { pattern: /text-blue-600\b/g, replacement: 'text-foreground' },
    { pattern: /text-blue-700\b/g, replacement: 'text-foreground' },
    { pattern: /text-blue-900\b/g, replacement: 'text-foreground' },

    // Blue borders -> neutral
    { pattern: /border-blue-100\b/g, replacement: 'border-border' },
    { pattern: /border-blue-200\b/g, replacement: 'border-border' },
    { pattern: /border-blue-300\b/g, replacement: 'border-border' },
    { pattern: /border-blue-500\b/g, replacement: 'border-primary' },

    // Green backgrounds -> neutral (except success semantic)
    { pattern: /bg-green-50\b/g, replacement: 'bg-muted' },
    { pattern: /bg-green-100\b/g, replacement: 'bg-muted' },
    { pattern: /bg-green-500\b/g, replacement: 'bg-primary' },
    { pattern: /bg-green-600\b/g, replacement: 'bg-primary' },

    // Green text -> neutral
    { pattern: /text-green-50\b/g, replacement: 'text-muted-foreground' },
    { pattern: /text-green-100\b/g, replacement: 'text-muted-foreground' },
    { pattern: /text-green-500\b/g, replacement: 'text-foreground' },
    { pattern: /text-green-600\b/g, replacement: 'text-foreground' },
    { pattern: /text-green-700\b/g, replacement: 'text-foreground' },

    // Yellow backgrounds -> neutral
    { pattern: /bg-yellow-50\b/g, replacement: 'bg-muted' },
    { pattern: /bg-yellow-100\b/g, replacement: 'bg-muted' },

    // Yellow text -> neutral
    { pattern: /text-yellow-600\b/g, replacement: 'text-muted-foreground' },
    { pattern: /text-yellow-700\b/g, replacement: 'text-muted-foreground' },
];

// Get all files with colored classes
const filesOutput = execSync(
    'grep -r "bg-blue-\\|bg-green-\\|bg-yellow-\\|text-blue-\\|text-green-\\|border-blue-" app/admin --include="*.tsx" --include="*.ts" -l',
    { cwd: process.cwd(), encoding: 'utf-8' }
);

const files = filesOutput.trim().split('\n').filter(Boolean);

console.log(`Found ${files.length} files to process\n`);

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

console.log(`\n✅ Complete!`);
console.log(`   Files changed: ${filesChanged}/${files.length}`);
console.log(`   Total replacements: ${totalChanges}`);
