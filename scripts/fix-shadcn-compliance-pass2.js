#!/usr/bin/env node

/**
 * Shadcn Compliance Fix - Second Pass
 * 
 * Fixes remaining violations that the first script missed:
 * - <a> tags styled as buttons
 * - Card containers
 * - Non-button interactive elements
 * 
 * Run: node scripts/fix-shadcn-compliance-pass2.js
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

const changes = {
    linksAsButtons: 0,
    cards: 0,
    inputs: 0,
    total: 0
};

const filesChanged = new Set();

// Second pass replacement rules - more aggressive patterns
const replacementRules = [
    // Fix <a> tags with bg-primary
    {
        category: 'linksAsButtons',
        pattern: /(<a[^>]*className="[^"]*)\bbg-primary\b/g,
        replacement: '$1bg-gray-900',
        description: 'Link button background: bg-primary → bg-gray-900'
    },
    {
        category: 'linksAsButtons',
        pattern: /(<a[^>]*className="[^"]*)\bhover:bg-primary\/90\b/g,
        replacement: '$1hover:bg-gray-800',
        description: 'Link button hover: hover:bg-primary/90 → hover:bg-gray-800'
    },
    {
        category: 'linksAsButtons',
        pattern: /(<a[^>]*className="[^"]*)\bhover:bg-primary\b/g,
        replacement: '$1hover:bg-gray-800',
        description: 'Link button hover: hover:bg-primary → hover:bg-gray-800'
    },
    {
        category: 'linksAsButtons',
        pattern: /(<a[^>]*className="[^"]*)\brounded-xl\b/g,
        replacement: '$1rounded-md',
        description: 'Link button radius: rounded-xl → rounded-md'
    },
    {
        category: 'linksAsButtons',
        pattern: /(<a[^>]*className="[^"]*)\brounded-lg\b/g,
        replacement: '$1rounded-md',
        description: 'Link button radius: rounded-lg → rounded-md'
    },

    // Fix icon containers
    {
        category: 'cards',
        pattern: /(icon.*className="[^"]*)\bbg-primary\b/gi,
        replacement: '$1bg-gray-900',
        description: 'Icon container: bg-primary → bg-gray-900'
    },

    // Fix any remaining bg-primary in div/span contexts
    {
        category: 'cards',
        pattern: /(<div[^>]*className="[^"]*)\bbg-primary(?!\s*text-white\s*px-3\s*py-1)/g,
        replacement: '$1bg-gray-900',
        description: 'Div background: bg-primary → bg-gray-900 (excluding badges)'
    },

    // Fix focus rings that were missed
    {
        category: 'inputs',
        pattern: /focus:ring-2 focus:ring-primary/g,
        replacement: 'focus:ring-2 focus:ring-gray-400',
        description: 'Focus ring: focus:ring-primary → focus:ring-gray-400'
    },
    {
        category: 'inputs',
        pattern: /focus:border-primary/g,
        replacement: 'focus:border-gray-400',
        description: 'Focus border: focus:border-primary → focus:border-gray-400'
    }
];

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let originalContent = content;
    let fileChanges = 0;

    replacementRules.forEach(rule => {
        const matches = content.match(rule.pattern);
        if (matches) {
            const count = matches.length;
            content = content.replace(rule.pattern, rule.replacement);
            changes[rule.category] += count;
            fileChanges += count;
        }
    });

    if (content !== originalContent) {
        fs.writeFileSync(filePath, content, 'utf8');
        filesChanged.add(filePath);
        changes.total += fileChanges;
        return fileChanges;
    }

    return 0;
}

function main() {
    console.log('\n🔧 Shadcn Compliance Fix - Pass 2 (Cleanup)\n');
    console.log('📋 Targeting:\n  • <a> tags styled as buttons\n  • Icon containers\n  • Remaining focus rings\n');

    const appFiles = glob.sync('app/**/*.tsx', { absolute: true });
    const componentFiles = glob.sync('components/**/*.tsx', { absolute: true });
    const allFiles = [...appFiles, ...componentFiles];

    console.log(`📦 Found ${allFiles.length} files to process\n`);

    allFiles.forEach(file => {
        const changeCount = processFile(file);
        if (changeCount > 0) {
            const relativePath = path.relative(process.cwd(), file);
            console.log(`  ✓ ${relativePath} (${changeCount} changes)`);
        }
    });

    console.log('\n' + '='.repeat(60));
    console.log('✅ PASS 2 COMPLETE');
    console.log('='.repeat(60));
    console.log('\n📊 Additional Changes:');
    console.log(`  • Link buttons:        ${changes.linksAsButtons} fixes`);
    console.log(`  • Cards/Containers:    ${changes.cards} fixes`);
    console.log(`  • Focus rings:         ${changes.inputs} fixes`);
    console.log(`  ─────────────────────────────────────`);
    console.log(`  TOTAL:                 ${changes.total} fixes`);
    console.log(`\n📁 Files modified:       ${filesChanged.size} files\n`);

    if (changes.total === 0) {
        console.log('✨ No additional violations found! 100% compliant.\n');
    } else {
        console.log('🎉 Additional violations fixed!\n');
    }
}

try {
    main();
} catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
}
