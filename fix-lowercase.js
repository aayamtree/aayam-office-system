const fs = require('fs');
const path = require('path');

function walk(dir, callback) {
    const list = fs.readdirSync(dir);
    list.forEach((file) => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat && stat.isDirectory()) {
            walk(filePath, callback);
        } else {
            callback(filePath);
        }
    });
}

function processFile(filePath) {
    if (!filePath.endsWith('.tsx') && !filePath.endsWith('.ts')) return;

    let content = fs.readFileSync(filePath, 'utf8');
    let originalContent = content;

    // Regex to find variable paths calling `.toLowerCase()`
    // E.g., job.title.toLowerCase()
    // Ignores simple safe variables
    const regexLower = /([a-zA-Z0-9_]+(?:\??\.[a-zA-Z0-9_]+)*)\.toLowerCase\(\)/g;
    const safeVars = ['searchQuery', 'searchTerm', 'searchString', 's', 'q', 'search', 'val', 'value', 'str', 'term', 'string', 'query', 'categorySearch', 'categoryFilter', 'mentionFilter', 'text', 'match', 'nameQuery', 'v', 'fileExt', 'e', 'req', 'res', 'item', 'role'];

    content = content.replace(regexLower, (match, varName) => {
        if (safeVars.includes(varName) || varName.endsWith('?.toLowerCase()')) {
            return match;
        }
        return `String(${varName} || '').toLowerCase()`;
    });

    const regexUpper = /([a-zA-Z0-9_]+(?:\??\.[a-zA-Z0-9_]+)*)\.toUpperCase\(\)/g;
    content = content.replace(regexUpper, (match, varName) => {
        if (safeVars.includes(varName) || varName.endsWith('?.toUpperCase()')) {
            return match;
        }
        return `String(${varName} || '').toUpperCase()`;
    });

    // Also catch optional chaining ones that crash on .includes. e.g. foo?.toLowerCase().includes()
    // Wait, the previous `.replace` regex doesn't catch `?.toLowerCase()` ?
    // Yes it does: `(?:\??\.[a-zA-Z0-9_]+)*` catches `?.`.
    // Wait, if it matched `foo?.toLowerCase()`, varName = `foo`, we replaced it with `String(foo || '').toLowerCase()`. That's safe.

    const finalFixedContent1 = content.replace(/String\(String\((.*?)\|\| ''\)\.toLowerCase\(\) \|\| ''\)\.toLowerCase\(\)/g, "String($1|| '').toLowerCase()");
    if (finalFixedContent1 !== originalContent) {
        fs.writeFileSync(filePath, finalFixedContent1, 'utf8');
        console.log(`Updated: ${filePath}`);
    }
}

// Run on app directory
console.log('Starting global string method safety pass...');
walk(path.join(__dirname, 'app'), processFile);
console.log('Done.');
