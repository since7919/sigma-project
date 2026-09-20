const fs = require('fs');
const path = require('path');

const dir = 'SIGMA_SIM/js';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.js')).map(f => path.join(dir, f));
const funcMap = {};
const duplicates = [];

files.forEach(f => {
    const lines = fs.readFileSync(f, 'utf8').split('\n');
    lines.forEach(l => {
        const match = l.match(/^(?:async\s+)?function\s+([a-zA-Z0-9_]+)\s*\(/);
        if (match) {
            const funcName = match[1];
            if (!funcMap[funcName]) {
                funcMap[funcName] = [];
            }
            funcMap[funcName].push(f);
        }
    });
});

for (const [funcName, files] of Object.entries(funcMap)) {
    const uniqueFiles = [...new Set(files)];
    if (uniqueFiles.length > 1) {
        duplicates.push({ funcName, files: uniqueFiles });
    }
}

console.log(duplicates);
