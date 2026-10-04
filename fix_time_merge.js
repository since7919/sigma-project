const fs = require('fs');

function buildNewGetGreen(isPopup) {
    return `static getGreenWindow(j, axis, dir, dayIdx, pIdx, cycle, offsetOverride) {
        const smIdx = (j.dayPlanMapIds && j.dayPlanMapIds[dayIdx]) ? j.dayPlanMapIds[dayIdx] : 0;
        const sm = (j.signalMaps && j.signalMaps[smIdx]) ? j.signalMaps[smIdx] : null;
        if (!sm) return [];

        const tod = (j.dayPlans && j.dayPlans[dayIdx]) ? j.dayPlans[dayIdx][pIdx] : null;
        if (!tod) return [];
        const offset = (offsetOverride !== undefined) ? offsetOverride : (tod.offset || 0);

        const targetMov = (dir === 'up') ? (axis === 'ew' ? 2 : 4) : (axis === 'ew' ? 6 : 8);

        let targetRing = -1;
        if ((sm.movA || []).includes(targetMov)) targetRing = 0;
        else if ((sm.movB || []).includes(targetMov)) targetRing = 1;
        
        if (targetRing === -1) return [];

        const splits = (targetRing === 0) ? (tod.splitA || []) : (tod.splitB || []);
        const yellows = (targetRing === 0) ? (sm.yellowA || []) : (sm.yellowB || []);
        const movs = (targetRing === 0) ? (sm.movA || []) : (sm.movB || []);

        // 1. Build list of active blocks based on actual time
        let currentT = 0;
        const blocks = [];
        for (let i = 0; i < splits.length; i++) {
            const split = splits[i] || 0;
            if (split <= 0) {
                // If split is 0, time doesn't advance.
                continue;
            }
            if (movs[i] === targetMov) {
                blocks.push({
                    start: currentT,
                    end: currentT + split,
                    yellowTime: yellows[i] || 0
                });
            }
            currentT += split;
        }

        if (blocks.length === 0) return [];

        // 2. Merge contiguous blocks
        const mergedBlocks = [];
        let currentBlock = Object.assign({}, blocks[0]);

        for (let i = 1; i < blocks.length; i++) {
            const b = blocks[i];
            // If the next block starts EXACTLY when the current one ends, merge them!
            if (Math.abs(b.start - currentBlock.end) < 0.1) {
                currentBlock.end = b.end;
                currentBlock.yellowTime = b.yellowTime; // Only the LAST phase's yellow matters
            } else {
                mergedBlocks.push(currentBlock);
                currentBlock = Object.assign({}, b);
            }
        }
        mergedBlocks.push(currentBlock);

        // 3. Subtract yellow time and handle wrap-around if the first and last blocks connect across the cycle!
        // (e.g. if a movement is in the last phase and the first phase)
        if (mergedBlocks.length > 1) {
            const first = mergedBlocks[0];
            const last = mergedBlocks[mergedBlocks.length - 1];
            if (Math.abs(last.end - cycle) < 0.1 && Math.abs(first.start - 0) < 0.1) {
                // They connect across the cycle boundary!
                first.start = last.start - cycle;
                first.yellowTime = first.yellowTime; // The yellow time of the first block (which is chronologically the end)
                mergedBlocks.pop(); // Remove the last block since it's merged into the first
            }
        }

        // 4. Format into final windows
        const windows = [];
        for (const mb of mergedBlocks) {
            const gLen = Math.max(0, (mb.end - mb.start) - mb.yellowTime);
            if (gLen > 0) {
                const gStart = ((offset + mb.start) % cycle + cycle) % cycle;
                windows.push({ gStart, gLen });
            }
        }

        return windows;
    }`;
}

// Update tsd.js
let js = fs.readFileSync('SIGMA_SIM/js/tsd.js', 'utf8');
const getGreenRegex = /static getGreenWindow[\s\S]*?return windows;\s*\}/;
if (js.match(getGreenRegex)) {
    js = js.replace(getGreenRegex, buildNewGetGreen(false));
    fs.writeFileSync('SIGMA_SIM/js/tsd.js', js, 'utf8');
    console.log("tsd.js updated");
} else {
    console.log("Regex failed in tsd.js");
}

// Update tsd_popup.html
let html = fs.readFileSync('SIGMA_SIM/tsd_popup.html', 'utf8');
const popupGetGreenRegex = /static getGreenWindow[\s\S]*?return windows;\s*\}/;
if (html.match(popupGetGreenRegex)) {
    html = html.replace(popupGetGreenRegex, buildNewGetGreen(true));
    fs.writeFileSync('SIGMA_SIM/tsd_popup.html', html, 'utf8');
    console.log("tsd_popup.html updated");
} else {
    console.log("Regex failed in tsd_popup.html");
}
