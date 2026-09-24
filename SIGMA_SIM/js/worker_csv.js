self.onmessage = function(e) {
    const { type, csv } = e.data;
    
    if (type === 'signalMaps') {
        const parsed = parseSignalMaps(csv);
        self.postMessage({ type: 'signalMaps_done', data: parsed });
    } else if (type === 'todPlans') {
        const parsed = parseTodPlans(csv);
        self.postMessage({ type: 'todPlans_done', data: parsed });
    }
};

function parseSignalMaps(csv) {
    const lines = csv.trim().split(/\r?\n/);
    if (lines.length < 2) return [];
    
    const headers = lines[0].replace(/^\ufeff/, '').split(',').map(h => h.replace(/^"|"$/g, '').trim());
    
    const idIdx = headers.findIndex(h => h === "ID" || h === "id");
    const mapIdxIdx = headers.findIndex(h => h === "MapIdx");
    
    const fields = ["movA","movB","pedMovA","pedMovB","yellowA","yellowB","allredA","allredB","pedA","pedB","pedDelayA","pedDelayB","pedFlashA","pedFlashB","pedGreenA","pedGreenB"];
    const fieldIndices = fields.map(f => headers.findIndex(h => h === f));
    const mainMovIdx = headers.findIndex(h => h === "mainMovements");
    const rawStepsIdx = headers.findIndex(h => h === "rawSteps");

    const results = [];

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
        
        const mapData = {};
        
        for (let f = 0; f < fields.length; f++) {
            const cIdx = fieldIndices[f];
            if (cIdx !== -1 && cols[cIdx] !== undefined) {
                mapData[fields[f]] = String(cols[cIdx]).split(';').map(Number);
            }
        }
        
        if (mainMovIdx !== -1 && cols[mainMovIdx]) {
            mapData.mainMovements = String(cols[mainMovIdx]).split(';');
        }
        
        if (rawStepsIdx !== -1 && cols[rawStepsIdx]) {
            try {
                const rs = JSON.parse(cols[rawStepsIdx]);
                if (rs && rs.stepsA) mapData.stepsA = rs.stepsA;
                if (rs && rs.stepsB) mapData.stepsB = rs.stepsB;
                if (rs && rs.ipdCustomArrows) mapData.ipdCustomArrows = rs.ipdCustomArrows;
            } catch(e) {
                // ignore
            }
        }
        
        results.push({ jid, midx, mapData });
    }
    
    return results;
}

function parseTodPlans(csv) {
    const lines = csv.trim().split(/\r?\n/); 
    if (lines.length < 2) return [];
    
    const headers = lines[0].replace(/^\ufeff/, '').split(',').map(h => h.replace(/^"|"$/g, '').trim());
    
    const idIdx = headers.findIndex(h => h === "ID" || h === "id");
    const dayPlanIdx = headers.findIndex(h => h === "Day_plan");
    const sigMapIdx = headers.findIndex(h => h === "SignalMap");
    
    const tpIndices = [];
    for (let i = 1; i <= 16; i++) {
        tpIndices.push(headers.findIndex(h => h === `Time_plan${i}`));
    }

    const results = [];

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        const cols = [];
        let start = 0, inQ = false;
        for (let c = 0; c < line.length; c++) {
            if (line[c] === '"') inQ = !inQ;
            else if (line[c] === ',' && !inQ) { cols.push(line.substring(start, c).replace(/^"|"$/g,'').trim()); start = c + 1; }
        }
        cols.push(line.substring(start).replace(/^"|"$/g,'').trim());
        
        let jid = cols[idIdx]; 
        if (!jid) continue;
        const d_plan = parseInt(cols[dayPlanIdx]); 
        if (isNaN(d_plan) || d_plan < 1 || d_plan > 10) continue;
        
        const dIdx = d_plan - 1;
        const mapId = parseInt(cols[sigMapIdx]) || 0;
        const schedules = [];
        
        for (let sIdx = 0; sIdx < 16; sIdx++) {
            const slotIdx = tpIndices[sIdx];
            if (slotIdx === -1) continue;
            const slot = cols[slotIdx]; 
            if (!slot) continue;
            
            const p = slot.split('|');
            let h = null, m = null;
            if (p[0] === "-1") {
                h = -1;
            } else if (p[0].includes(':')) { 
                const hm = p[0].split(':'); 
                h = parseInt(hm[0]) || 0; 
                m = parseInt(hm[1]) || 0; 
            }
            
            const scheduleIdx = (p[5] ? parseInt(p[5]) : (mapId + 1));
            
            const schedObj = {
                sIdx: sIdx,
                idx: scheduleIdx
            };
            if (h !== null) { schedObj.h = h; schedObj.m = m; }
            if (p[1]) { schedObj.cycle = parseInt(p[1]); }
            
            if (p[3] && p[4]) {
                schedObj.dp = {
                    splitA: p[3].split(';').map(Number),
                    splitB: p[4].split(';').map(Number)
                };
                if (p[1]) schedObj.dp.cycle = parseInt(p[1]);
                if (p[2]) schedObj.dp.offset = parseInt(p[2]);
            }
            
            schedules.push(schedObj);
        }
        
        results.push({ jid, dIdx, mapId, schedules });
    }
    
    return results;
}
