const fs = require('fs');
const XLSX = require('xlsx');

const file = fs.readdirSync('.').find(f => f.startsWith('1826') && f.endsWith('.xlsx'));
if (!file) { console.log('not found'); process.exit(1); }
const workbook = XLSX.readFile(file);
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const sheetData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

const getVal = (r, c) => (sheetData[r-1] ? sheetData[r-1][c-1] : null);
const tpPlansDict = {};

for (let r = 1; r < sheetData.length; r++) {
    for (let c = 1; c < 60; c++) {
        const cellVal = String(getVal(r, c) || '');
        const cleanVal = cellVal.replace(/\s/g, '');
        
        if (cleanVal.includes('½Ã°£°èÈ¹(')) {
            const tMatch = cleanVal.match(/½Ã°£°èÈ¹\((\d+)\)/);
            if (tMatch) {
                const tpIdx = parseInt(tMatch[1]), baseR = r + 2;
                const tpPlans = Array(16).fill(null);
                let lastCycleL = 100, lastCycleR = 100;
                
                let cycCL = -1, idxCL = -1, offCL = -1, spCL = -1;
                for (let col = 1; col <= 25; col++) {
                    const hVal = String(getVal(r + 1, col) || "").toLowerCase().replace(/\s/g, '');
                    if (hVal.includes("cycle") || hVal.includes("ÁÖ±â")) cycCL = col;
                    else if (hVal.includes("index") || hVal.includes("ÀÎµ¦½º")) idxCL = col;
                    else if (hVal.includes("offset") || hVal.includes("¿É¼Â")) offCL = col;
                    else if (hVal.includes("split") || hVal.includes("½ºÇÃ¸´")) spCL = col;
                }
                let cycCR = -1, idxCR = -1, offCR = -1, spCR = -1;
                for (let col = 26; col <= 60; col++) {
                    const hVal = String(getVal(r + 1, col) || "").toLowerCase().replace(/\s/g, '');
                    if (hVal.includes("cycle") || hVal.includes("ÁÖ±â")) cycCR = col;
                    else if (hVal.includes("index") || hVal.includes("ÀÎµ¦½º")) idxCR = col;
                    else if (hVal.includes("offset") || hVal.includes("¿É¼Â")) offCR = col;
                    else if (hVal.includes("split") || hVal.includes("½ºÇÃ¸´")) spCR = col;
                }
                
                if (cycCL === -1) cycCL = 3; if (idxCL === -1) idxCL = 4;
                if (offCL === -1) offCL = 5; if (spCL === -1) spCL = 6;
                if (cycCR === -1) cycCR = 15; if (idxCR === -1) idxCR = 16;
                if (offCR === -1) offCR = 17; if (spCR === -1) spCR = 18;
                
                for (let idxS = 0; idxS < 16; idxS++) {
                    const isR = (idxS >= 8);
                    const locI = isR ? (idxS - 8) : idxS;
                    const rA = baseR + (locI * 2), rB = rA + 1;
                    
                    const cycC = isR ? cycCR : cycCL;
                    const idxC = isR ? idxCR : idxCL;
                    const offC = isR ? offCR : offCL;
                    const spC  = isR ? spCR : spCL;
                    
                    let currentCycle = isR ? lastCycleR : lastCycleL;
                    const parsedCycle = parseInt(getVal(rA, cycC));
                    if (!isNaN(parsedCycle) && parsedCycle > 0) {
                        currentCycle = parsedCycle;
                        if (isR) lastCycleR = parsedCycle; else lastCycleL = parsedCycle;
                    }

                    const patternIdx = parseInt(getVal(rA, idxC));
                    if (!isNaN(patternIdx) && patternIdx >= 1 && patternIdx <= 16) {
                        const splitCols = [];
                        for (let sc = spC; sc < spC + 16 && splitCols.length < 8; sc++) {
                            const val = getVal(rA, sc);
                            if (val !== null && val !== undefined && String(val).trim() !== '') {
                                splitCols.push(sc);
                            }
                        }
                        const sAL = splitCols.map(sc => parseInt(getVal(rA, sc)) || 0);
                        const sBL = splitCols.map(sc => parseInt(getVal(rB, sc)) || 0);
                        while(sAL.length < 8) sAL.push(0);
                        while(sBL.length < 8) sBL.push(0);
                        
                        tpPlans[patternIdx - 1] = { 
                            cycle: currentCycle, 
                            offset: parseInt(getVal(rA, offC)) || 0, 
                            splitA: sAL, 
                            splitB: sBL 
                        };
                    }
                }
                
                for(let i=0; i<16; i++) {
                    if(!tpPlans[i]) tpPlans[i] = { cycle: 100, offset: 0, splitA: Array(8).fill(0), splitB: Array(8).fill(0) };
                }
                tpPlansDict[tpIdx] = tpPlans;
            }
        }
    }
}
console.log('tpPlansDict keys:', Object.keys(tpPlansDict));
if (tpPlansDict[1]) {
    for(let i=0; i<3; i++) console.log('Pattern ' + (i+1) + ':', tpPlansDict[1][i]);
    for(let i=8; i<11; i++) console.log('Pattern ' + (i+1) + ':', tpPlansDict[1][i]);
}
