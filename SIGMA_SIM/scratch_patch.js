const fs = require('fs');
let content = fs.readFileSync('../SIGMA_API/sigma-backend/app.js', 'utf8');

const patchFunc = `
const patchLocalCsvCache = async (updates) => {
    try {
        const scratchDir = path.join(__dirname, 'scratch');
        if (!fs.existsSync(scratchDir)) return false;
        
        let patchedAny = false;
        const filesToPatch = ['db_L01.csv', 'db_L01_maps.csv', 'db_L01_tod_plans.csv', 'db_L01_stats.csv'];
        
        for (const file of filesToPatch) {
            const cacheFilePath = path.join(scratchDir, 'cache_' + file);
            if (!fs.existsSync(cacheFilePath)) continue;
            
            let lines = fs.readFileSync(cacheFilePath, 'utf8').split(/\\r?\\n/);
            
            for (const update of updates) {
                const { jid, interCsvLine, mapCsvLines, todCsvLines, statsCsvLines } = update;
                if (file === 'db_L01.csv' && interCsvLine) {
                    lines = lines.filter(l => !l.startsWith(jid + ','));
                    lines.push(interCsvLine);
                } else if (file === 'db_L01_maps.csv' && mapCsvLines) {
                    lines = lines.filter(l => !l.startsWith(jid + ','));
                    mapCsvLines.split(/\\r?\\n/).filter(l => l.trim()).forEach(l => lines.push(l));
                } else if (file === 'db_L01_tod_plans.csv' && todCsvLines) {
                    lines = lines.filter(l => !l.startsWith(jid + ','));
                    todCsvLines.split(/\\r?\\n/).filter(l => l.trim()).forEach(l => lines.push(l));
                } else if (file === 'db_L01_stats.csv' && statsCsvLines) {
                    lines = lines.filter(l => !l.startsWith(jid + ','));
                    const statLines = statsCsvLines.split(/\\r?\\n/).filter(l => l.trim());
                    if (statLines.length > 1) {
                        for (let i = 1; i < statLines.length; i++) {
                            lines.push(statLines[i]);
                        }
                    }
                }
            }
            fs.writeFileSync(cacheFilePath, lines.join('\\n'));
            patchedAny = true;
        }
        
        if (patchedAny) {
            global.SIGMA_DB_VERSION = Date.now() + '_v2';
            for (const file of filesToPatch) {
                const cacheFilePath = path.join(scratchDir, 'cache_' + file);
                if (fs.existsSync(cacheFilePath)) {
                    // Upload patched files to CDN asynchronously so it doesn't block
                    uploadToCDN(cacheFilePath, \\\`cache_\\\${file}_\\\${global.SIGMA_DB_VERSION}.csv\\\`).catch(console.error);
                }
            }
            console.log('[Cache] Successfully patched CSV cache and updated SIGMA_DB_VERSION to', global.SIGMA_DB_VERSION);
            return true;
        }
        return false;
    } catch(e) {
        console.error('[Cache] Error patching cache:', e);
        return false;
    }
};
`;

content = content.replace('const uploadToCDN', patchFunc.replace(/\\\\`/g, '`').replace(/\\\\\\\$/g, '$') + '\n\nconst uploadToCDN');
fs.writeFileSync('../SIGMA_API/sigma-backend/app.js', content);
