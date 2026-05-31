const fs = require('fs');
const path = require('path');

const htmlPath = path.join(process.cwd(), 'index.html');
const jsonPath = path.join(process.cwd(), 'AI_Core', 'alias_dictionary.json');

const htmlContent = fs.readFileSync(htmlPath, 'utf8');
let dict = {};
if (fs.existsSync(jsonPath)) {
    dict = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
}

const idRegex = /id=["']([^"']+)["']/g;
let match;
let newCount = 0;

while ((match = idRegex.exec(htmlContent)) !== null) {
    const id = match[1];
    const key = id.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('_');
    
    if (!dict[key]) {
        dict[key] = [id, id.replace(/-/g, ' ')];
        newCount++;
    }
}

// Add common tags or text
const labelRegex = />([^<]+)</g;
while ((match = labelRegex.exec(htmlContent)) !== null) {
    const text = match[1].trim();
    if (text.length > 1 && text.length < 10 && !text.includes('\n')) {
        const key = "UI_" + text.replace(/[\s\/]/g, '_');
        if (!dict[key] && Object.keys(dict).length < 350) { // Keep under control, let's say max 400
            dict[key] = [text];
            newCount++;
        }
    }
}

fs.writeFileSync(jsonPath, JSON.stringify(dict, null, 4));
console.log('Appended ' + newCount + ' new keys from index.html. Total keys now: ' + Object.keys(dict).length);
