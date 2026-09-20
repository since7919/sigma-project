const fs = require('fs');
let script = fs.readFileSync('scrape_all_zones.js', 'utf8');

const dynamicSkipCode = `
    // Get existing SGG codes from DB
    console.log("Checking DB for existing regions to skip...");
    const { data: existing } = await supabase.from('safety_zones').select('sggcd');
    const existingPrefixes = new Set();
    if (existing) {
        existing.forEach(d => {
            if (d.sggcd) existingPrefixes.add(d.sggcd.substring(0, 5));
        });
    }
    console.log(\`Found \${existingPrefixes.size} SGG codes already in DB.\`);

    console.log("Fetching all SGG codes...");`;

script = script.replace('    console.log("Fetching all SGG codes...");', dynamicSkipCode);

const loopSkipCode = `
        if (existingPrefixes.has(sggCd)) {
            skipCount++;
            continue;
        }`;

const oldLoopSkipCode = `        // Skip Seoul and Incheon if we want, or just re-upsert. Let's re-upsert to be safe.
        // Wait, to save API calls, let's skip 11 (Seoul) and 28 (Incheon).
        if (sggCd.startsWith('11') || sggCd.startsWith('28')) {
            skipCount++;
            continue;
        }`;

script = script.replace(oldLoopSkipCode, loopSkipCode);

fs.writeFileSync('scrape_all_zones_smart.js', script, 'utf8');
console.log('created scrape_all_zones_smart.js');
