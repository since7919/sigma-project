const fs = require('fs');
const xlsx = require('C:/Users/since/OneDrive/바탕 화면/SIGMA/SIGMA_SIM/node_modules/xlsx');

async function testFull() {
    try {
        const buf = fs.readFileSync('SIGMA_SIM/1821 세종대로사거리(0528).xlsx');
        const workbook = xlsx.read(buf, { type: 'buffer' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const sheetData = xlsx.utils.sheet_to_json(sheet, { header: 1 });
        const getVal = (r, c) => (sheetData[r-1] ? sheetData[r-1][c-1] : null);

        const jNo = parseInt(getVal(3, 37));
        if (isNaN(jNo)) throw new Error('[C37] 교차로 번호 누락');

        const baseMovA = [], baseMovB = [];
        for (let c = 19; c <= 54; c += 5) {
            baseMovA.push(parseInt(getVal(5, c)) || 0);
            baseMovB.push(parseInt(getVal(12, c)) || 0);
        }

        const baseRowMapStart = 247;
        const processRingData = (startRow, baseMovs, eopSourceRow = null) => {
            const phaseData = Array.from({ length: 8 }, () => ({ vId: 0, pId: 0, g: 0, f: 0, yellow: 0 }));
            const rawSteps = [];
            let minCol = 53, maxCol = 55, eopCol = 57;
            let lsuCols = Array(8).fill(null).map((_, i) => ({ v: 5 + i * 6, p: 8 + i * 6 }));

            const headerRow1 = sheetData[startRow - 3] || [];
            const headerRow2 = sheetData[startRow - 2] || [];

            const findCol = (row, text) => {
                for (let c = 0; c < row.length; c++) {
                    if (String(row[c]).toUpperCase().replace(/\s/g, '').includes(text)) return c + 1;
                }
                return -1;
            };

            const detectedMin = findCol(headerRow1, "MIN");
            if (detectedMin !== -1) minCol = detectedMin;

            const detectedMax = findCol(headerRow1, "MAX");
            if (detectedMax !== -1) maxCol = detectedMax;

            const detectedEop = findCol(headerRow1, "EOP");
            if (detectedEop !== -1) eopCol = detectedEop;

            for (let lsu = 1; lsu <= 8; lsu++) {
                const lsuStartCol = findCol(headerRow1, \LSU\\) - 1;
                if (lsuStartCol !== -1) {
                    let vFound = -1, pFound = -1;
                    for (let c = lsuStartCol; c < lsuStartCol + 5 && c < headerRow2.length; c++) {
                        const h2 = String(headerRow2[c] || "").toUpperCase().trim();
                        if (h2 === "V") vFound = c + 1;
                        if (h2 === "P") pFound = c + 1;
                    }
                    if (vFound !== -1) lsuCols[lsu - 1].v = vFound;
                    if (pFound !== -1) lsuCols[lsu - 1].p = pFound;
                }
            }

            const allSteps = [];
            for (let s = 0; s < 32; s++) {
                const r = startRow + s;
                const eopRow = eopSourceRow ? eopSourceRow + s : r;
                const minStr = String(getVal(r, minCol) || "").trim();
                const eopStr = String(getVal(eopRow, eopCol) || "").toUpperCase().trim();
                const info = { min: parseInt(minStr) || 0, eop: eopStr === 'Y', sigsV: [], sigsP: [] };
                for (let l = 0; l < 8; l++) {
                    info.sigsV.push(parseInt(String(getVal(r, lsuCols[l].v) || "0").trim()) || 0);
                    info.sigsP.push(parseInt(String(getVal(r, lsuCols[l].p) || "0").trim()) || 0);
                }
                allSteps.push(info);
            }
            return { phaseData, rawSteps };
        };

        const signalMaps = [];
        for (let pIdx = 1; pIdx <= 16; pIdx++) {
            const rowA = baseRowMapStart + ((pIdx - 1) * 78);
            const rowB = rowA + 40;
            const ringA = processRingData(rowA, baseMovA);
            const ringB = processRingData(rowB, baseMovB, rowA);
            signalMaps.push({ planNo: pIdx, ringA, ringB });
        }

        console.log("Full Parser succeeded without throwing!");
    } catch (e) {
        console.error("ERROR CAUGHT:", e);
    }
}
testFull();
