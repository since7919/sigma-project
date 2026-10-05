const fs = require('fs');
let content = fs.readFileSync('SIGMA_SIM/js/junction_map.js', 'utf8');

const targetStr = `
    // ── [신규모드] 현재 인맥/상황에 맞는 시차맵(SignalMap) 데이터 추출 ──
    const t = parseInt(UI.timeSlider?.value) || 0;
    const isEditingMode = (jid === STATE.activeJid && STATE.isMapEditMode);
    const smIdx = isEditingMode ? (STATE.currentSignalMapIdx || 0) : getActiveSignalMapIdx(j, t);
`;

const replaceStr = `
    // ── [신규모드] 현재 인맥/상황에 맞는 시차맵(SignalMap) 데이터 추출 ──
    const t = parseInt(UI.timeSlider?.value) || 0;
    const isEditingMode = (jid === STATE.activeJid && STATE.isMapEditMode);
    let smIdx = 0;
    if (isEditingMode) {
        smIdx = STATE.currentSignalMapIdx || 0;
    } else {
        const ctx = typeof getSimContext === "function" ? getSimContext(j, t) : null;
        smIdx = ctx ? ctx.mapIdx : getActiveSignalMapIdx(j, t);
    }
`;

content = content.replace(targetStr, replaceStr);
fs.writeFileSync('SIGMA_SIM/js/junction_map.js', content, 'utf8');
console.log('Fixed createArrows to use getSimContext mapIdx');
