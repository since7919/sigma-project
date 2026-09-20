const xlsx = require('xlsx');

// Mock data_parser.js logic
const workbook = xlsx.readFile('test.xlsx');
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const sheetData = xlsx.utils.sheet_to_json(worksheet, { header: 1, defval: "" });

function searchKeyword(data, keyword, colIdx) {
    for (let r = 0; r < data.length; r++) {
        if (String(data[r][colIdx]).includes(keyword)) return r;
    }
    return -1;
}

const baseRowMapStart = searchKeyword(sheetData, "EOP", 3) - 1;
const baseMovA = 6;
const baseMovB = 16;

function createEmptySignalMap() {
    return {
        stepsA: Array(32).fill(0).map((_, i) => ({ eop: 0, car1: 0, car2: 0, car3: 0, car4: 0, car5: 0, car6: 0, car7: 0, car8: 0, ped1: 0, ped2: 0, ped3: 0, ped4: 0, ped5: 0, ped6: 0, ped7: 0, ped8: 0, maxTm: 0, minTm: 0, stepNo: i + 1 })),
        stepsB: Array(32).fill(0).map((_, i) => ({ eop: 0, car1: 0, car2: 0, car3: 0, car4: 0, car5: 0, car6: 0, car7: 0, car8: 0, ped1: 0, ped2: 0, ped3: 0, ped4: 0, ped5: 0, ped6: 0, ped7: 0, ped8: 0, maxTm: 0, minTm: 0, stepNo: i + 1 })),
        movA: Array(8).fill(0), movB: Array(8).fill(0),
        pedMovA: Array(8).fill(0), pedMovB: Array(8).fill(0),
        yellowA: Array(8).fill(0), yellowB: Array(8).fill(0),
        pedGreenA: Array(8).fill(0), pedGreenB: Array(8).fill(0),
        pedFlashA: Array(8).fill(0), pedFlashB: Array(8).fill(0),
        pedDelayA: Array(8).fill(0), pedDelayB: Array(8).fill(0),
        pedA: Array(8).fill(0), pedB: Array(8).fill(0),
    };
}

function processRingData(startRow, movBaseCol, syncEopStartRow = -1) {
    const rawSteps = [];
    const phaseData = Array(8).fill(0).map(() => ({ vId: 0, pId: 0, yellow: 0, g: 0, f: 0, delay: 0 }));

    // Extract raw steps
    for (let r = 0; r < 32; r++) {
        const row = sheetData[startRow + r] || [];
        const eopRow = (syncEopStartRow > -1) ? (sheetData[syncEopStartRow + r] || []) : row;
        
        let eop = String(eopRow[3] || "").trim() === "E" ? 1 : 0;
        
        const step = { eop, maxTm: 0, minTm: parseInt(row[5]) || 0, stepNo: r + 1 };
        for (let i = 1; i <= 8; i++) {
            step[`car${i}`] = parseInt(row[movBaseCol + i - 1]) || 0;
            step[`ped${i}`] = parseInt(row[movBaseCol + 8 + i - 1]) || 0;
        }
        rawSteps.push(step);
    }
    return { phaseData, rawSteps };
}

if (baseRowMapStart >= 0) {
    console.log("Map Start Row:", baseRowMapStart);
    for (let m = 0; m < 1; m++) { // just check map 1
        const startRowA = baseRowMapStart + (m * 67) + 3;
        const startRowB = startRowA + 32;

        const { rawSteps: stepsA } = processRingData(startRowA, baseMovA);
        const { rawSteps: stepsB } = processRingData(startRowB, baseMovB, startRowA);

        console.log("Steps A count:", stepsA.length);
        console.log("Steps B count:", stepsB.length);
        console.log("Step 1 A eop:", stepsA[0].eop);
        console.log("Step 1 A car1:", stepsA[0].car1);
    }
} else {
    console.log("EOP keyword not found");
}
