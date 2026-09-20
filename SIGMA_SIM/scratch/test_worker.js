const https = require('https');
const fs = require('fs');

https.get('https://sigma-project-245n.onrender.com/api/sim/data?file=db_L01_signal_maps.csv&v=v3_1789914733623_v2', res => {
    console.log('Status:', res.statusCode);
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => {
        console.log('Downloaded length:', data.length);
        if (res.statusCode !== 200) {
            console.log('Response:', data.substring(0, 200));
            return;
        }
        
        // Execute worker logic
        const lines = data.trim().split(/\r?\n/);
        console.log('Lines:', lines.length);
        
        const headers = lines[0].replace(/^\ufeff/, '').split(',').map(h => h.replace(/^"|"$/g, '').trim());
        const idIdx = headers.findIndex(h => h === 'ID' || h === 'id');
        const mapIdxIdx = headers.findIndex(h => h === 'MapIdx');
        const fields = ['movA','movB','pedMovA','pedMovB','yellowA','yellowB','allredA','allredB','pedA','pedB','pedDelayA','pedDelayB','pedFlashA','pedFlashB','pedGreenA','pedGreenB'];
        const fieldIndices = fields.map(f => headers.findIndex(h => h === f));
        const mainMovIdx = headers.findIndex(h => h === 'mainMovements');
        const rawStepsIdx = headers.findIndex(h => h === 'rawSteps');
        
        console.log('rawStepsIdx:', rawStepsIdx);
        
        try {
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i];
                const cols = [];
                let start = 0, inQ = false;
                const parseVal = (str) => {
                    let v = str.trim();
                    if (v.startsWith('"') && v.endsWith('"')) {
                        return v.substring(1, v.length - 1).replace(/""/g, '"');
                    }
                    return v;
                };
                for (let c = 0; c < line.length; c++) {
                    if (line[c] === '"') inQ = !inQ;
                    else if (line[c] === ',' && !inQ) { cols.push(parseVal(line.substring(start, c))); start = c + 1; }
                }
                cols.push(parseVal(line.substring(start)));
                
                let jid = cols[idIdx]; 
                if (!jid) continue;
                const midx = parseInt(cols[mapIdxIdx]); 
                if (isNaN(midx) || midx >= 10) continue;
                
                if (rawStepsIdx !== -1 && cols[rawStepsIdx]) {
                    try {
                        const rs = JSON.parse(cols[rawStepsIdx]);
                    } catch(e) {
                        console.log('Failed JSON:', cols[rawStepsIdx].substring(0, 100));
                        throw e;
                    }
                }
            }
            console.log('Worker loop OK for ALL lines');
        } catch(e) {
            console.error('Worker error:', e);
        }
    });
});
