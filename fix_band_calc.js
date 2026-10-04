const fs = require('fs');

// --- 1. Update tsd.js ---
let js = fs.readFileSync('SIGMA_SIM/js/tsd.js', 'utf8');

const getGreenRegex = /static getGreenWindow[\s\S]*?if \(totalGreenDuration <= 0\) return null;\s*const gStart = \(\(offset \+ accT\) % cycle \+ cycle\) % cycle;\s*return \{ gStart, gLen: totalGreenDuration \};\s*\}/;

const newGetGreen = `static getGreenWindow(j, axis, dir, dayIdx, pIdx, cycle, offsetOverride) {
        const smIdx = (j.dayPlanMapIds && j.dayPlanMapIds[dayIdx]) ? j.dayPlanMapIds[dayIdx] : 0;
        const sm = (j.signalMaps && j.signalMaps[smIdx]) ? j.signalMaps[smIdx] : null;
        if (!sm) return [];

        const tod = (j.dayPlans && j.dayPlans[dayIdx]) ? j.dayPlans[dayIdx][pIdx] : null;
        if (!tod) return [];
        const offset = (offsetOverride !== undefined) ? offsetOverride : (tod.offset || 0);

        const targetMov = (dir === 'up') ? (axis === 'ew' ? 2 : 4) : (axis === 'ew' ? 6 : 8);

        let targetIdxs = [];
        let splits = [];
        let yellows = [];

        const idxsA = [];
        (sm.movA || []).forEach((m, idx) => { if (m === targetMov) idxsA.push(idx); });
        const idxsB = [];
        (sm.movB || []).forEach((m, idx) => { if (m === targetMov) idxsB.push(idx); });

        if (idxsA.length > 0) {
            targetIdxs = idxsA; splits = tod.splitA || []; yellows = sm.yellowA || [];
        } else if (idxsB.length > 0) {
            targetIdxs = idxsB; splits = tod.splitB || []; yellows = sm.yellowB || [];
        }
        
        if (targetIdxs.length === 0) return [];

        const windows = [];
        let i = 0;
        while (i < targetIdxs.length) {
            const startPhaseIdx = targetIdxs[i];
            
            let accT = 0;
            for (let s = 0; s < startPhaseIdx; s++) accT += (splits[s] || 0);
            
            let totalGreenDuration = 0;
            let jIdx = i;
            while (jIdx < targetIdxs.length) {
                const currIdx = targetIdxs[jIdx];
                const sTime = splits[currIdx] || 0;
                const yTime = yellows[currIdx] || 0;
                
                const isNextSame = (jIdx < targetIdxs.length - 1 && targetIdxs[jIdx+1] === currIdx + 1);
                if (isNextSame) {
                    totalGreenDuration += sTime;
                    jIdx++;
                } else {
                    totalGreenDuration += Math.max(0, sTime - yTime);
                    break;
                }
            }
            
            if (totalGreenDuration > 0) {
                const gStart = ((offset + accT) % cycle + cycle) % cycle;
                windows.push({ gStart, gLen: totalGreenDuration });
            }
            
            i = jIdx + 1;
        }
        
        return windows;
    }`;

const calcBandRegex = /static calculateBandwidth[\s\S]*?return \{ width: bestW, start: bestS, validCount: validNodes\.length \};\s*\}/;

const newCalcBand = `static calculateBandwidth(dir, axis, members, distances, totalDist, cycle, travelTimes, dayIdx, pIdx, offsets) {
        if (!members || members.length < 2 || cycle <= 0)
            return { width: 0, start: 0, validCount: 0 };

        const totalTT = travelTimes[travelTimes.length - 1] || 1;

        const validNodes = [];
        for (let i = 0; i < members.length; i++) {
            const off = (offsets && offsets[members[i].id]) ? offsets[members[i].id][pIdx] : undefined;
            const greens = this.getGreenWindow(members[i], axis, dir, dayIdx, pIdx, cycle, off);
            if (greens && greens.length > 0) {
                validNodes.push({ idx: i, tt: travelTimes[i], greens: greens });
            }
        }
        if (validNodes.length < 2) return { width: 0, start: 0, validCount: validNodes.length };

        let bestW = 0, bestS = 0;

        for (let t = 0; t < cycle; t += 0.25) {
            let minR = cycle, ok = true;

            for (const node of validNodes) {
                const travel = (dir === 'up') ? node.tt : (totalTT - node.tt);
                const arrival = ((t + travel) % cycle + cycle) % cycle;
                
                let maxRemForThisNode = -1;
                for (const g of node.greens) {
                    const gS = g.gStart;
                    const gE = (gS + g.gLen) % cycle;

                    const isGreen = (gS < gE)
                        ? (arrival >= gS && arrival < gE)
                        : (arrival >= gS || arrival < gE);
                    
                    if (isGreen) {
                        const rem = (gS < gE)
                            ? (gE - arrival)
                            : (arrival >= gS ? cycle - arrival + gE : gE - arrival);
                        if (rem > maxRemForThisNode) {
                            maxRemForThisNode = rem;
                        }
                    }
                }

                if (maxRemForThisNode < 0) { ok = false; break; }
                minR = Math.min(minR, maxRemForThisNode);
            }
            if (ok && minR > bestW) { bestW = minR; bestS = t; }
        }

        return { width: bestW, start: bestS, validCount: validNodes.length };
    }`;

if(js.match(getGreenRegex)) {
    js = js.replace(getGreenRegex, newGetGreen);
}
if(js.match(calcBandRegex)) {
    js = js.replace(calcBandRegex, newCalcBand);
}
fs.writeFileSync('SIGMA_SIM/js/tsd.js', js, 'utf8');
console.log("tsd.js updated");


// --- 2. Update tsd_popup.html ---
let html = fs.readFileSync('SIGMA_SIM/tsd_popup.html', 'utf8');

const popupGetGreenRegex = /static getGreenWindow[\s\S]*?return \{ gStart:\(\(offset\+accT\)%cycle\+cycle\)%cycle, gLen \};\s*\}/;
const popupCalcBandRegex = /static calcBand[\s\S]*?return \{width:bW,start:bS,vc:vn\.length\};\s*\}/;

const newPopupGetGreen = `static getGreenWindow(j, axis, dir, dayIdx, pIdx, cycle, offsetOverride) {
    const smIdx = (j.dayPlanMapIds && j.dayPlanMapIds[dayIdx]) ? j.dayPlanMapIds[dayIdx] : 0;
    const sm = (j.signalMaps && j.signalMaps[smIdx]) ? j.signalMaps[smIdx] : null;
    if (!sm) return [];
    const tod = (j.dayPlans && j.dayPlans[dayIdx]) ? j.dayPlans[dayIdx][pIdx] : null;
    if (!tod) return [];
    const offset = (offsetOverride !== undefined) ? offsetOverride : (tod.offset || 0);
    const targetMov = (dir==='up') ? (axis==='ew'?2:4) : (axis==='ew'?6:8);
    
    let targetIdxs = [];
    let splits = [];
    let yellows = [];

    const idxsA = [];
    (sm.movA || []).forEach((m, idx) => { if (m === targetMov) idxsA.push(idx); });
    const idxsB = [];
    (sm.movB || []).forEach((m, idx) => { if (m === targetMov) idxsB.push(idx); });

    if (idxsA.length > 0) {
        targetIdxs = idxsA; splits = tod.splitA || []; yellows = sm.yellowA || [];
    } else if (idxsB.length > 0) {
        targetIdxs = idxsB; splits = tod.splitB || []; yellows = sm.yellowB || [];
    }
    
    if (targetIdxs.length === 0) return [];

    const windows = [];
    let i = 0;
    while (i < targetIdxs.length) {
        const startPhaseIdx = targetIdxs[i];
        let accT = 0;
        for (let s = 0; s < startPhaseIdx; s++) accT += (splits[s] || 0);
        
        let totalGreenDuration = 0;
        let jIdx = i;
        while (jIdx < targetIdxs.length) {
            const currIdx = targetIdxs[jIdx];
            const sTime = splits[currIdx] || 0;
            const yTime = yellows[currIdx] || 0;
            
            const isNextSame = (jIdx < targetIdxs.length - 1 && targetIdxs[jIdx+1] === currIdx + 1);
            if (isNextSame) {
                totalGreenDuration += sTime;
                jIdx++;
            } else {
                totalGreenDuration += Math.max(0, sTime - yTime);
                break;
            }
        }
        
        if (totalGreenDuration > 0) {
            const gStart = ((offset + accT) % cycle + cycle) % cycle;
            windows.push({ gStart, gLen: totalGreenDuration });
        }
        
        i = jIdx + 1;
    }
    return windows;
  }`;

const newPopupCalcBand = `static calcBand(dir,axis,members,distances,totalDist,cycle,travelTimes,dayIdx,pIdx,offsets) {
    if(!members||members.length<2||cycle<=0) return {width:0,start:0,vc:0};
    const totalTT = travelTimes[travelTimes.length - 1] || 1;
    const vn=[];
    for(let i=0;i<members.length;i++){
      const off = offsets[members[i].id] ? offsets[members[i].id][pIdx] : undefined;
      const greens = this.getGreenWindow(members[i],axis,dir,dayIdx,pIdx,cycle,off);
      if(greens && greens.length>0) vn.push({idx:i,tt:travelTimes[i],greens:greens});
    }
    if(vn.length<2) return {width:0,start:0,vc:vn.length};
    let bW=0,bS=0;
    for(let t=0;t<cycle;t+=0.25){
      let minR=cycle,ok=true;
      for(const n of vn){
        const tr=(dir==='up')?(n.tt):((totalTT-n.tt));
        const arr=((t+tr)%cycle+cycle)%cycle;
        let maxRem = -1;
        for(const g of n.greens){
            const gS=g.gStart, gE=(gS+g.gLen)%cycle;
            const isG=(gS<gE)?(arr>=gS&&arr<gE):(arr>=gS||arr<gE);
            if(isG){
                const rem = (gS<gE)?(gE-arr):(arr>=gS?cycle-arr+gE:gE-arr);
                if(rem>maxRem) maxRem = rem;
            }
        }
        if(maxRem<0){ok=false;break;}
        if(maxRem<minR) minR=maxRem;
      }
      if(ok&&minR>bW){bW=minR;bS=t;}
    }
    return {width:bW,start:bS,vc:vn.length};
  }`;

if(html.match(popupGetGreenRegex)) {
    html = html.replace(popupGetGreenRegex, newPopupGetGreen);
}
if(html.match(popupCalcBandRegex)) {
    html = html.replace(popupCalcBandRegex, newPopupCalcBand);
}
fs.writeFileSync('SIGMA_SIM/tsd_popup.html', html, 'utf8');
console.log("tsd_popup.html updated");
