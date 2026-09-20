
const fs = require('fs');
const XLSX = require('xlsx');

const filePath = 'C:/Users/since/OneDrive/πŸ≈¡ »≠∏È/SIGMA/SIGMA_SIM/1826 æ»±πø™(0530).xlsx';
const workbook = XLSX.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const sheetData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

const getVal = (r, c) => (sheetData[r-1] ? sheetData[r-1][c-1] : null);

const dayPlansFound = {};
const tpPlansDict = {};

for (let r = 1; r < sheetData.length; r++) {
    for (let c = 1; c < 60; c++) {
        const cellVal = String(getVal(r, c) || '');
        const cleanVal = cellVal.replace(/\s/g, '');
        
        if (cleanVal.includes('¿œ∞Ë»π(')) {
            const dMatch = cleanVal.match(/¿œ∞Ë»π\((\d+)\)/);
            if (dMatch) {
                const dNo = parseInt(dMatch[1]), slots = [];
                let timeCol = -1, cycCol = -1, idxCol = -1;
                for (let colSearch = c; colSearch < c + 8; colSearch++) {
                    const hVal = String(getVal(r + 1, colSearch) || '').toLowerCase();
                    if (hVal.includes('Ω√∞£') || hVal.includes('time')) timeCol = colSearch;
                    if (hVal.includes('¡÷±‚') || hVal.includes('cyc')) cycCol = colSearch;
                    if (hVal.includes('index') || hVal.includes('¿Œµ¶Ω∫') || hVal.includes('idx')) idxCol = colSearch;
                }
                if (timeCol === -1) timeCol = c + 1;
                if (cycCol === -1) cycCol = c + 2;
                if (idxCol === -1) idxCol = c + 3;

                for (let sr = r + 2; sr < r + 18; sr++) {
                    let vTime = getVal(sr, timeCol), tStr = '-1';
                    if (typeof vTime === 'number') {
                        const tot = Math.round(vTime * 1440);
                        tStr = \\:\\;
                    } else {
                        tStr = String(vTime || '-1').trim();
                    }
                    const cyc = parseInt(getVal(sr, cycCol)) || 0;
                    const tIdx = parseInt(getVal(sr, idxCol)) || 0;
                    if (cyc > 0 || (tStr !== '-1' && tStr !== '')) {
                        slots.push({ time: tStr, cycle: cyc, tpIdx: tIdx });
                    }
                }
                dayPlansFound[dNo] = slots;
            }
        }
        
        if (cleanVal.includes('Ω√∞£∞Ë»π(')) {
            const tMatch = cleanVal.match(/Ω√∞£∞Ë»π\((\d+)\)/);
            if (tMatch) {
                const tpIdx = parseInt(tMatch[1]), baseR = r + 2;
                const tpPlans = Array(16).fill(null);
                let lastCycleL = 100, lastCycleR = 100;
                
                for (let idxS = 0; idxS < 16; idxS++) {
                    const isR = (idxS >= 8);
                    const locI = isR ? (idxS - 8) : idxS;
                    const rA = baseR + (locI * 2), rB = rA + 1;
                    
                    const baseC = isR ? 14 : 2; 
                    const cycC = baseC + 1;     
                    const idxC = baseC + 2;     
                    const offC = baseC + 3;     
                    const spC = baseC + 4;      
                    
                    let currentCycle = isR ? lastCycleR : lastCycleL;
                    const parsedCycle = parseInt(getVal(rA, cycC));
                    if (!isNaN(parsedCycle) && parsedCycle > 0) {
                        currentCycle = parsedCycle;
                        if (isR) lastCycleR = parsedCycle;
                        else lastCycleL = parsedCycle;
                    }

                    const patternIdx = parseInt(getVal(rA, idxC));
                    if (!isNaN(patternIdx) && patternIdx >= 1 && patternIdx <= 16) {
                        const sAL = [], sBL = [];
                        for (let sc = spC; sc < spC + 8; sc++) { 
                            sAL.push(parseInt(getVal(rA, sc)) || 0); 
                            sBL.push(parseInt(getVal(rB, sc)) || 0); 
                        }
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
console.log('dayPlansFound keys:', Object.keys(dayPlansFound));
console.log('tpPlansDict keys:', Object.keys(tpPlansDict));
if (tpPlansDict[1]) {
    console.log('tpPlansDict[1] Patterns 11~15 (12~16):');
    for(let i=11; i<16; i++) console.log(\Pattern \:\, tpPlansDict[1][i]);
}

