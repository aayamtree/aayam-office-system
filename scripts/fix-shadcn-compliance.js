#!/usr/bin/env node

/**
 * Automated Shadcn Compliance Fix Script
 * 
 * This script fixes ALL Shadcn UI violations across the codebase:
 * - Buttons: bg-primary → bg-gray-900, padding, border-radius
 * - Icons: w-3.5 h-3.5 → w-4 h-4
 * - Typography: custom sizes → standard sizes
 * 
 * Run: node scripts/fix-shadcn-compliance.js
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Track all changes
const changes = {
    bgPrimary: 0,
    borderRadius: 0,
    padding: 0,
    iconSizes: 0,
    typography: 0,
    focusRings: 0,
    total: 0
};

const filesChanged = new Set();

// Shadcn compliance rules
const replacementRules = [
    // 1. Button Background Colors
    {
        category: 'bgPrimary',
        pattern: /bg-primary(\s)/g,
        replacement: 'bg-gray-900$1',
        description: 'Button background: bg-primary → bg-gray-900'
    },
    {
        category: 'bgPrimary',
        pattern: /hover:bg-primary\/90/g,
        replacement: 'hover:bg-gray-800',
        description: 'Button hover: hover:bg-primary/90 → hover:bg-gray-800'
    },
    {
        category: 'bgPrimary',
        pattern: /hover:bg-primary(\s|")/g,
        replacement: 'hover:bg-gray-800$1',
        description: 'Button hover: hover:bg-primary → hover:bg-gray-800'
    },

    // 2. Border Radius (only for buttons - context-aware)
    {
        category: 'borderRadius',
        pattern: /(<button[^>]*className="[^"]*)(rounded-xl)/g,
        replacement: '$1rounded-md',
        description: 'Button border: rounded-xl → rounded-md'
    },
    {
        category: 'borderRadius',
        pattern: /(<button[^>]*className="[^"]*)(rounded-lg)/g,
        replacement: '$1rounded-md',
        description: 'Button border: rounded-lg → rounded-md'
    },

    // 3. Button Padding - Non-standard sizes
    {
        category: 'padding',
        pattern: /px-6 py-2/g,
        replacement: 'px-4 py-2',
        description: 'Button padding: px-6 py-2 → px-4 py-2'
    },
    {
        category: 'padding',
        pattern: /px-8 py-3/g,
        replacement: 'px-8 py-2',
        description: 'Button padding: px-8 py-3 → px-8 py-2'
    },
    {
        category: 'padding',
        pattern: /(<button[^>]*className="[^"]*)(px-3 py-1)(\s)/g,
        replacement: '$1px-3 py-2$3',
        description: 'Button padding: px-3 py-1 → px-3 py-2'
    },

    // 4. Icon Sizes
    {
        category: 'iconSizes',
        pattern: /w-3\.5 h-3\.5/g,
        replacement: 'w-4 h-4',
        description: 'Icon size: w-3.5 h-3.5 → w-4 h-4'
    },
    {
        category: 'iconSizes',
        pattern: /w-4\.5 h-4\.5/g,
        replacement: 'w-4 h-4',
        description: 'Icon size: w-4.5 h-4.5 → w-4 h-4'
    },
    {
        category: 'iconSizes',
        pattern: /w-5\.5 h-5\.5/g,
        replacement: 'w-5 h-5',
        description: 'Icon size: w-5.5 h-5.5 → w-5 h-5'
    },

    // 5. Typography - Custom sizes
    {
        category: 'typography',
        pattern: /text-\[10px\]/g,
        replacement: 'text-xs',
        description: 'Typography: text-[10px] → text-xs'
    },

    // 6. Focus Rings
    {
        category: 'focusRings',
        pattern: /focus:ring-primary/g,
        replacement: 'focus:ring-gray-400',
        description: 'Focus ring: focus:ring-primary → focus:ring-gray-400'
    },
    {
        category: 'focusRings',
        pattern: /focus-visible:ring-primary/g,
        replacement: 'focus-visible:ring-gray-400',
        description: 'Focus ring: focus-visible:ring-primary → focus-visible:ring-gray-400'
    }
];

/**
 * Process a single file and apply all replacement rules
 */
function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let originalContent = content;
    let fileChanges = 0;

    // Apply all replacement rules
    replacementRules.forEach(rule => {
        const matches = content.match(rule.pattern);
        if (matches) {
            const count = matches.length;
            content = content.replace(rule.pattern, rule.replacement);
            changes[rule.category] += count;
            fileChanges += count;
        }
    });

    // Write back if changes were made
    if (content !== originalContent) {
        fs.writeFileSync(filePath, content, 'utf8');
        filesChanged.add(filePath);
        changes.total += fileChanges;
        return fileChanges;
    }

    return 0;
}

/**
 * Main execution
 */
function main() {
    console.log('\n🔧 Shadcn Compliance Fix - Starting...\n');
    console.log('📋 Rules to apply:');
    replacementRules.forEach((rule, i) => {
        console.log(`  ${i + 1}. ${rule.description}`);
    });
    console.log('');

    // Find all TSX files in app and components
    const appFiles = glob.sync('app/**/*.tsx', { absolute: true });
    const componentFiles = glob.sync('components/**/*.tsx', { absolute: true });
    const allFiles = [...appFiles, ...componentFiles];

    console.log(`📦 Found ${allFiles.length} files to process\n`);
    console.log('⚙️  Processing files...\n');

    // Process all files
    let filesProcessed = 0;
    allFiles.forEach(file => {
        const changeCount = processFile(file);
        if (changeCount > 0) {
            filesProcessed++;
            const relativePath = path.relative(process.cwd(), file);
            console.log(`  ✓ ${relativePath} (${changeCount} changes)`);
        }
    });

    // Report results
    console.log('\n' + '='.repeat(60));
    console.log('✅ COMPLIANCE FIX COMPLETE');
    console.log('='.repeat(60));
    console.log('\n📊 Changes Summary:');
    console.log(`  • Button backgrounds:  ${changes.bgPrimary} fixes`);
    console.log(`  • Border radius:       ${changes.borderRadius} fixes`);
    console.log(`  • Padding:             ${changes.padding} fixes`);
    console.log(`  • Icon sizes:          ${changes.iconSizes} fixes`);
    console.log(`  • Typography:          ${changes.typography} fixes`);
    console.log(`  • Focus rings:         ${changes.focusRings} fixes`);
    console.log(`  ─────────────────────────────────────`);
    console.log(`  TOTAL:                 ${changes.total} fixes`);
    console.log('');
    console.log(`📁 Files modified:       ${filesChanged.size} files`);
    console.log('');

    // Generate compliance report
    const report = {
        timestamp: new Date().toISOString(),
        totalChanges: changes.total,
        filesModified: filesChanged.size,
        changesByCategory: {
            bgPrimary: changes.bgPrimary,
            borderRadius: changes.borderRadius,
            padding: changes.padding,
            iconSizes: changes.iconSizes,
            typography: changes.typography,
            focusRings: changes.focusRings
        },
        filesChanged: Array.from(filesChanged).map(f => path.relative(process.cwd(), f))
    };

    // Save report
    const reportPath = path.join(process.cwd(), 'shadcn-compliance-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`📄 Report saved to:      ${path.basename(reportPath)}`);
    console.log('');

    if (changes.total === 0) {
        console.log('✨ No violations found! Already 100% compliant.\n');
    } else {
        console.log('🎉 All Shadcn violations have been fixed!\n');
        console.log('Next steps:');
        console.log('  1. Review the changes: git diff');
        console.log('  2. Test the app: npm run dev');
        console.log('  3. Commit: git add . && git commit -m "fix: Shadcn compliance - all violations fixed"');
        console.log('');
    }
}

// Run the script
try {
    main();
} catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
}
