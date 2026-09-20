const fs = require('fs');
const xlsx = require('xlsx');

const buf = fs.readFileSync('SIGMA_SIM/scratch/test.xlsx');
const wb = xlsx.read(buf, { type: 'buffer' });
const sheetData = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
const getVal = (r, c) => (sheetData[r - 1] ? sheetData[r - 1][c - 1] : null);

const tpPlansDict = {};
for (let r = 1; r < sheetData.length; r++) {
    for (let c = 1; c < 60; c++) {
        const cellVal = String(getVal(r, c) || "");
        const cleanVal = cellVal.replace(/\s/g, '');
        if (cleanVal.includes('½Ã°£°èÈ¹(')) {
            const tMatch = cleanVal.match(/½Ã°£°èÈ¹\((\d+)\)/);
            if (tMatch) {
                const tpIdx = parseInt(tMatch[1]);
                const baseR = r + 2;
                const tpPlans = Array(16).fill(null);

                const cycCols = [], idxCols = [], offCols = [], spCols = [], noCols = [];
                for (let col = 1; col <= 80; col++) {
                    const hVal = String(getVal(r + 1, col) || "").toLowerCase().replace(/\s/g, '');
                    if (hVal === "cycle" || hVal === "ÁÖ±â") cycCols.push(col);
                    else if (hVal === "index" || hVal === "ÀÎµ¦½º") idxCols.push(col);
                    else if (hVal === "offset" || hVal === "¿É¼Â") offCols.push(col);
                    else if (hVal === "split" || hVal === "½ºÇÃ¸´" || hVal.includes("split")) spCols.push(col);
                    else if (hVal === "no" || hVal === "ÆÐÅÏ") noCols.push(col);
                }

                const cycCL = cycCols[0] || 5, cycCR = cycCols[1] || (cycCols[0] ? cycCols[0] + 24 : 29);
                const offCL = offCols[0] || 9, offCR = offCols[1] || (offCols[0] ? offCols[0] + 23 : 32);
                const spCL = spCols[0] || 13, spCR = spCols[1] || (spCols[0] ? spCols[0] + 22 : 35);
                const noCL = noCols[0] || 1, noCR = noCols[1] || (noCols[0] ? noCols[0] + 25 : 26);
                const idxCL = idxCols[0] || 3, idxCR = idxCols[1] || (idxCols[0] ? idxCols[0] + 25 : 28);

                let lastCycL = 100, lastCycR = 100;
                let rA = baseR;
                while (rA < baseR + 30 && rA < sheetData.length) {
                    const firstCell = String(getVal(rA, 1) || "").replace(/\s/g, '');
                    if (firstCell.includes('½Ã°£°èÈ¹(') || firstCell.includes('ÀÏ°èÈ¹(')) break;

                    const rB = rA + 1;

                    const parsedIdxL = parseInt(getVal(rA, idxCL));
                    if (!isNaN(parsedIdxL) && parsedIdxL >= 1 && parsedIdxL <= 16) {
                        const parsedCycL = parseInt(getVal(rA, cycCL));
                        if (!isNaN(parsedCycL) && parsedCycL > 0) lastCycL = parsedCycL;
                        const offL = parseInt(getVal(rA, offCL)) || 0;
                        const splitColsL = [];
                        for (let sc = spCL; sc < spCL + 35 && splitColsL.length < 8; sc++) {
                            const v = getVal(rA, sc);
                            if (v !== null && v !== undefined && String(v).trim() !== '') splitColsL.push(sc);
                        }
                        const sAL = splitColsL.map(sc => parseInt(getVal(rA, sc)) || 0);
                        const sBL = splitColsL.map(sc => parseInt(getVal(rB, sc)) || 0);
                        while (sAL.length < 8) sAL.push(0);
                        while (sBL.length < 8) sBL.push(0);

                        tpPlans[parsedIdxL - 1] = { cycle: lastCycL, offset: offL, splitA: sAL, splitB: sBL };
                    }

                    const parsedIdxR = parseInt(getVal(rA, idxCR));
                    if (!isNaN(parsedIdxR) && parsedIdxR >= 1 && parsedIdxR <= 16) {
                        const parsedCycR = parseInt(getVal(rA, cycCR));
                        if (!isNaN(parsedCycR) && parsedCycR > 0) lastCycR = parsedCycR;
                        const offR = parseInt(getVal(rA, offCR)) || 0;
                        const splitColsR = [];
                        for (let sc = spCR; sc < spCR + 35 && splitColsR.length < 8; sc++) {
                            const v = getVal(rA, sc);
                            if (v !== null && v !== undefined && String(v).trim() !== '') splitColsR.push(sc);
                        }
                        const sAR = splitColsR.map(sc => parseInt(getVal(rA, sc)) || 0);
                        const sBR = splitColsR.map(sc => parseInt(getVal(rB, sc)) || 0);
                        while (sAR.length < 8) sAR.push(0);
                        while (sBR.length < 8) sBR.push(0);

                        tpPlans[parsedIdxR - 1] = { cycle: lastCycR, offset: offR, splitA: sAR, splitB: sBR };
                    }
                    rA += 2;
                }
                tpPlansDict[tpIdx] = tpPlans;
            }
        }
    }
}
for (let i=0; i<16; i++) {
    if (tpPlansDict[1] && tpPlansDict[1][i]) {
        console.log("Pattern " + (i+1) + ": Cycle " + tpPlansDict[1][i].cycle + " / Offset " + tpPlansDict[1][i].offset);
    }
}
