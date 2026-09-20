const fs = require('fs');

// Dummy STATE
global.STATE = { junctions: {} };
for (let i = 0; i < 3000; i++) {
    STATE.junctions['L01-' + i] = {
        schedules: Array.from({length: 10}, () => Array.from({length: 16}, () => ({}))),
        dayPlans: Array.from({length: 10}, () => Array.from({length: 16}, () => ({}))),
        dayPlanMapIds: new Array(10).fill(0)
    };
}

let todCSV = 'ID,Day_plan,SignalMap,Time_plan1,Time_plan2,Time_plan3,Time_plan4,Time_plan5,Time_plan6,Time_plan7,Time_plan8,Time_plan9,Time_plan10,Time_plan11,Time_plan12,Time_plan13,Time_plan14,Time_plan15,Time_plan16\n';
for (let i = 0; i < 3000; i++) {
    for (let d = 1; d <= 10; d++) {
        todCSV += \L01-\,\,1,-1|100|0|50;50|50;50|1,06:00|100|0|50;50|50;50|2,07:00|100|0|50;50|50;50|3,-1|100|0|50;50|50;50|1,-1|100|0|50;50|50;50|1,-1|100|0|50;50|50;50|1,-1|100|0|50;50|50;50|1,-1|100|0|50;50|50;50|1,-1|100|0|50;50|50;50|1,-1|100|0|50;50|50;50|1,-1|100|0|50;50|50;50|1,-1|100|0|50;50|50;50|1,-1|100|0|50;50|50;50|1,-1|100|0|50;50|50;50|1,-1|100|0|50;50|50;50|1,-1|100|0|50;50|50;50|1\n\;
    }
}

// Add the function
function processTodPlanCSV(csv) {
    const lines = csv.trim().split(/\r?\n/); if (lines.length < 2) return;
    const headers = lines[0].replace(/^\ufeff/, '').split(',').map(h => h.replace(/^"|"$/g, '').trim());
    
    const idIdx = headers.findIndex(h => h === "ID" || h === "id");
    const dayPlanIdx = headers.findIndex(h => h === "Day_plan");
    const sigMapIdx = headers.findIndex(h => h === "SignalMap");
    
    const tpIndices = [];
    for (let i = 1; i <= 16; i++) {
        tpIndices.push(headers.findIndex(h => h === \Time_plan\\));
    }

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        const cols = [];
        let start = 0, inQ = false;
        for (let c = 0; c < line.length; c++) {
            if (line[c] === '"') inQ = !inQ;
            else if (line[c] === ',' && !inQ) { cols.push(line.substring(start, c).replace(/^"|"$/g,'').trim()); start = c + 1; }
        }
        cols.push(line.substring(start).replace(/^"|"$/g,'').trim());

        let jid = cols[idIdx]; if (!jid || !STATE.junctions[jid]) continue;
        const d_plan = parseInt(cols[dayPlanIdx]); if (isNaN(d_plan) || d_plan < 1 || d_plan > 10) continue;
        const dIdx = d_plan - 1;
        
        STATE.junctions[jid].dayPlanMapIds[dIdx] = parseInt(cols[sigMapIdx]) || 0;
        
        for (let sIdx = 0; sIdx < 16; sIdx++) {
            const slotIdx = tpIndices[sIdx];
            if (slotIdx === -1) continue;
            const slot = cols[slotIdx]; if (!slot) continue;
            
            const p = slot.split('|');
            if (p[0] === "-1") STATE.junctions[jid].schedules[dIdx][sIdx].h = -1;
            else if (p[0].includes(':')) { 
                const hm = p[0].split(':'); 
                STATE.junctions[jid].schedules[dIdx][sIdx].h = parseInt(hm[0]) || 0; 
                STATE.junctions[jid].schedules[dIdx][sIdx].m = parseInt(hm[1]) || 0; 
            }
            if (p[1]) {
                STATE.junctions[jid].schedules[dIdx][sIdx].cycle = parseInt(p[1]);
                STATE.junctions[jid].dayPlans[dIdx][sIdx].cycle = parseInt(p[1]);
            }
            if (p[2]) STATE.junctions[jid].dayPlans[dIdx][sIdx].offset = parseInt(p[2]);
            if (p[3]) STATE.junctions[jid].dayPlans[dIdx][sIdx].splitA = p[3].split(';').map(Number);
            if (p[4]) STATE.junctions[jid].dayPlans[dIdx][sIdx].splitB = p[4].split(';').map(Number);
            if (p[5]) STATE.junctions[jid].schedules[dIdx][sIdx].idx = parseInt(p[5]);
            else STATE.junctions[jid].schedules[dIdx][sIdx].idx = (parseInt(cols[sigMapIdx]) || 0) + 1;
        }
    }
}

console.time('processTodPlanCSV');
processTodPlanCSV(todCSV);
console.timeEnd('processTodPlanCSV');
