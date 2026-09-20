const fs = require('fs');
const XLSX = require('xlsx');

const file = fs.readdirSync('.').find(f => f.startsWith('1826') && f.endsWith('.xlsx'));
const workbook = XLSX.readFile(file);
const sheet = workbook.Sheets[workbook.SheetNames[0]];
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
                
                const cycCols = [], idxCols = [], offCols = [], spCols = [];
                for (let colSearch = 1; colSearch < 60; colSearch++) {
                    const hVal = String(getVal(r + 1, colSearch) || "").toLowerCase().replace(/\s/g, '');
                    if (hVal === "cycle" || hVal === "ÁÖ±â") cycCols.push(colSearch);
                    else if (hVal === "index" || hVal === "ÀÎµ¦½º") idxCols.push(colSearch);
                    else if (hVal === "offset" || hVal === "¿É¼Â") offCols.push(colSearch);
                    else if (hVal === "split" || hVal === "½ºÇÃ¸´" || hVal.includes("split")) spCols.push(colSearch);
                }
                
                let cycCL = cycCols[0] || 3, cycCR = cycCols[1] || 15;
                let idxCL = idxCols[0] || 4, idxCR = idxCols[1] || 16;
                let offCL = offCols[0] || 5, offCR = offCols[1] || 17;
                let spCL = spCols[0] || 6, spCR = spCols[1] || 18;
                
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
                console.log('Successfully set tpPlansDict[' + tpIdx + ']');
            }
        }
    }
}
