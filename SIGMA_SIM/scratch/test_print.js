const fs = require('fs');
const xlsx = require('./SIGMA_SIM/node_modules/xlsx');

async function testFull() {
    try {
        const buf = fs.readFileSync('./SIGMA_SIM/1821 ¼¼Á¾´ë·Î»ç°Å¸®(0528).xlsx');
        const workbook = xlsx.read(buf, { type: 'buffer' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const sheetData = xlsx.utils.sheet_to_json(sheet, { header: 1 });
        const getVal = (r, c) => (sheetData[r-1] ? sheetData[r-1][c-1] : null);

        for (let r = 1; r < sheetData.length; r++) {
            for (let c = 1; c < 60; c++) {
                const cellVal = String(getVal(r, c) || "");
                const cleanVal = cellVal.replace(/\s/g, '');
                if (cleanVal.includes('½Ã°£°èÈ¹(')) {
                    const tMatch = cleanVal.match(/½Ã°£°èÈ¹\((\d+)\)/);
                    if (tMatch) {
                        const tpIdx = parseInt(tMatch[1]);
                        if(tpIdx !== 1) continue; 
                        const baseR = r + 2;
                        const tpPlans = Array(16).fill(null);

                        const cycCols = [], idxCols = [], offCols = [], spCols = [], noCols = [];
                        for (let col = 1; col <= 80; col++) {
                            const hVal = String(getVal(r + 1, col) || "").toLowerCase().replace(/\s/g, '');
                            if (hVal === "cycle" || hVal === "ÁÖ±â") cycCols.push(col);
                            else if (hVal === "index" || hVal === "ÀÎµ¦½º") idxCols.push(col);
                            else if (hVal === "offset" || hVal === "¿É¼Â") offCols.push(col);
                            else if (hVal === "split" || hVal === "½ºÇÃ¸´" || hVal.includes("split")) spCols.push(col);
                        }

                        const cycCL = cycCols[0] || 5, cycCR = cycCols[1] || (cycCols[0] ? cycCols[0] + 24 : 29);
                        const offCL = offCols[0] || 9, offCR = offCols[1] || (offCols[0] ? offCols[0] + 23 : 32);
                        const spCL = spCols[0] || 13, spCR = spCols[1] || (spCols[0] ? spCols[0] + 22 : 35);
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
                                tpPlans[parsedIdxL - 1] = { cycle: lastCycL, offset: offL };
                            }

                            const parsedIdxR = parseInt(getVal(rA, idxCR));
                            if (!isNaN(parsedIdxR) && parsedIdxR >= 1 && parsedIdxR <= 16) {
                                const parsedCycR = parseInt(getVal(rA, cycCR));
                                if (!isNaN(parsedCycR) && parsedCycR > 0) lastCycR = parsedCycR;
                                const offR = parseInt(getVal(rA, offCR)) || 0;
                                tpPlans[parsedIdxR - 1] = { cycle: lastCycR, offset: offR };
                            }
                            rA += 2;
                        }
                        console.log("tpPlans:");
                        tpPlans.forEach((p, i) => {
                            if(p) console.log(\Pattern \: Offset \\);
                            else console.log(\Pattern \: null\);
                        });
                    }
                }
            }
        }
    } catch (e) {
        console.error("ERROR:", e);
    }
}
testFull();
