const fs = require('fs');
const path = 'SIGMA_SIM/js/phase.js';
let content = fs.readFileSync(path, 'utf8');
content = content.replace(/\r\n/g, '\n');

// 1. Update phaseCategories array
const targetCategories = `    const phaseCategories = [
        { id: 'split', label: 'Split', keyA: 'splitA', keyB: 'splitB', clsA: '', clsB: '', isDetail: false },
        { id: 'mg', label: 'MG (최소녹색)', keyA: 'minGreenA', keyB: 'minGreenB', clsA: 'c-green', clsB: 'c-green', isDetail: true,
          calcA: (i) => { const pA = sm.pedA?.[i] || 0; const arA = sm.allredA?.[i] || 0; const dlyA = sm.pedDelayA?.[i] || 0; return pA > 0 ? pA + arA + dlyA : 7 + arA; },
          calcB: (i) => { const pB = sm.pedB?.[i] || 0; const arB = sm.allredB?.[i] || 0; const dlyB = sm.pedDelayB?.[i] || 0; return pB > 0 ? pB + arB + dlyB : 7 + arB; }
        },
        { id: 'allred', label: 'AllRed', keyA: 'allredA', keyB: 'allredB', clsA: 'c-red', clsB: 'c-red', isDetail: true },
        { id: 'yellow', label: 'Yellow', keyA: 'yellowA', keyB: 'yellowB', clsA: 'c-yellow', clsB: 'c-yellow', isDetail: true },
        { id: 'peddly', label: 'PedDly', keyA: 'pedDelayA', keyB: 'pedDelayB', clsA: '', clsB: '', isDetail: true },
        { id: 'pedgreen', label: '보행녹색', keyA: 'pedGreenA', keyB: 'pedGreenB', clsA: 'c-green', clsB: 'c-green', isDetail: true },
        { id: 'pedflash', label: '보행점멸', keyA: 'pedFlashA', keyB: 'pedFlashB', clsA: 'c-orange', clsB: 'c-orange', isDetail: true },
        { id: 'pedtotal', label: '보행합계', keyA: 'pedA', keyB: 'pedB', clsA: 'c-green-bold', clsB: 'c-green-bold', isDetail: true }
    ];`;

const replacementCategories = `    const phaseCategories = [
        { id: 'split', label: 'Split', keyA: 'splitA', keyB: 'splitB', clsA: '', clsB: '', isDetail: false },
        { id: 'mg', label: 'MG (최소녹색)', keyA: 'minGreenA', keyB: 'minGreenB', clsA: 'c-green', clsB: 'c-green', isDetail: true,
          calcA: (i) => { const pA = sm.pedA?.[i] || 0; const arA = sm.allredA?.[i] || 0; const dlyA = sm.pedDelayA?.[i] || 0; return pA > 0 ? pA + arA + dlyA : 7 + arA; },
          calcB: (i) => { const pB = sm.pedB?.[i] || 0; const arB = sm.allredB?.[i] || 0; const dlyB = sm.pedDelayB?.[i] || 0; return pB > 0 ? pB + arB + dlyB : 7 + arB; },
          calcTitle: '최소녹색시간 = 보행합계+전적색+보행지연 (또는 최소 7초+전적색)'
        },
        { id: 'allred', label: 'AllRed', keyA: 'allredA', keyB: 'allredB', clsA: 'c-red', clsB: 'c-red', isDetail: true },
        { id: 'yellow', label: 'Yellow', keyA: 'yellowA', keyB: 'yellowB', clsA: 'c-yellow', clsB: 'c-yellow', isDetail: true },
        { id: 'peddly', label: 'PedDly', keyA: 'pedDelayA', keyB: 'pedDelayB', clsA: '', clsB: '', isDetail: true },
        { id: 'pedgreen', label: '보행녹색', keyA: 'pedGreenA', keyB: 'pedGreenB', clsA: '', clsB: '', isDetail: true },
        { id: 'pedflash', label: '보행점멸', keyA: 'pedFlashA', keyB: 'pedFlashB', clsA: 'c-orange', clsB: 'c-orange', isDetail: true },
        { id: 'pedtotal', label: '보행합계', keyA: 'pedA', keyB: 'pedB', clsA: 'c-green-bold', clsB: 'c-green-bold', isDetail: true,
          calcA: (i) => { return (sm.pedGreenA?.[i] || 0) + (sm.pedFlashA?.[i] || 0); },
          calcB: (i) => { return (sm.pedGreenB?.[i] || 0) + (sm.pedFlashB?.[i] || 0); },
          calcTitle: '자동 계산 (보행녹색 + 보행점멸)'
        }
    ];`;


// 2. Update the calc render part
const targetCalc = `                    content: calc
                        ? \`<input type="text" class="sigma-input" value="\${calc(i)}" readonly 
                            style="color:#10b981 !important; font-weight:bold; cursor:default; border-color:rgba(16,185,129,0.15) !important;" 
                            title="최소녹색시간 = 보행합계+전적색+보행지연 (또는 최소 7초+전적색)">\`
                        : \`<input type="number" class="sigma-input \${cls} inp-\${key}" data-key="\${key}" data-index="\${i}" value="\${val}" style="\${extraStyle}" title="\${tooltip}" \${isDisabled}>\`,`;

const replacementCalc = `                    content: calc
                        ? \`<input type="text" class="sigma-input" value="\${calc(i)}" readonly 
                            style="color:#10b981 !important; font-weight:bold; cursor:default; border-color:rgba(16,185,129,0.15) !important;" 
                            title="\${cat.calcTitle || ''}">\`
                        : \`<input type="number" class="sigma-input \${cls} inp-\${key}" data-key="\${key}" data-index="\${i}" value="\${val}" style="\${extraStyle}" title="\${tooltip}" \${isDisabled}>\`,`;


// 3. Update updateMov to sync pedA/pedB automatically
const targetUpdateMov = `function updateMov(k, i, v) {
    const j = STATE.junctions[STATE.activeJid];
    const isDual = document.getElementById('chk-dual-ring')?.checked;
    const smIdx = STATE.currentSignalMapIdx || 0;
    const sm = (j.signalMaps && j.signalMaps[smIdx]) ? j.signalMaps[smIdx] : null;

    if (!sm) return;

    sm[k][i] = parseInt(v) || 0;

    // [Sync Logic] Dual(각각입력)이 체크해제(!isDual) 상태에서 A링 데이터를 변경하면 B링도 자동으로 따라감
    if (!isDual && k.endsWith('A')) {
        const keyB = k.replace(/A$/, 'B');
        if (sm[keyB]) {
            sm[keyB][i] = parseInt(v) || 0;
        }
    }

    renderRingTables();
    refreshVisibleArrows();
}`;

const replacementUpdateMov = `function updateMov(k, i, v) {
    const j = STATE.junctions[STATE.activeJid];
    const isDual = document.getElementById('chk-dual-ring')?.checked;
    const smIdx = STATE.currentSignalMapIdx || 0;
    const sm = (j.signalMaps && j.signalMaps[smIdx]) ? j.signalMaps[smIdx] : null;

    if (!sm) return;

    sm[k][i] = parseInt(v) || 0;

    // [Sync Logic] Dual(각각입력)이 체크해제(!isDual) 상태에서 A링 데이터를 변경하면 B링도 자동으로 따라감
    if (!isDual && k.endsWith('A')) {
        const keyB = k.replace(/A$/, 'B');
        if (sm[keyB]) {
            sm[keyB][i] = parseInt(v) || 0;
        }
    }

    // [Sync Logic] Auto-calculate pedA and pedB
    if (['pedGreenA', 'pedFlashA', 'pedGreenB', 'pedFlashB'].includes(k)) {
        if (!sm.pedA) sm.pedA = [0,0,0,0,0,0,0,0];
        if (!sm.pedB) sm.pedB = [0,0,0,0,0,0,0,0];
        
        if (k.endsWith('A')) {
            sm.pedA[i] = (sm.pedGreenA?.[i] || 0) + (sm.pedFlashA?.[i] || 0);
            if (!isDual) {
                sm.pedB[i] = (sm.pedGreenB?.[i] || 0) + (sm.pedFlashB?.[i] || 0);
            }
        } else {
            sm.pedB[i] = (sm.pedGreenB?.[i] || 0) + (sm.pedFlashB?.[i] || 0);
        }
    }

    renderRingTables();
    refreshVisibleArrows();
}`;


let success = 0;
if (content.includes(targetCategories.replace(/\r\n/g, '\n'))) {
    content = content.replace(targetCategories.replace(/\r\n/g, '\n'), replacementCategories.replace(/\r\n/g, '\n'));
    success++;
} else { console.log('targetCategories not found'); }

if (content.includes(targetCalc.replace(/\r\n/g, '\n'))) {
    content = content.replace(targetCalc.replace(/\r\n/g, '\n'), replacementCalc.replace(/\r\n/g, '\n'));
    success++;
} else { console.log('targetCalc not found'); }

if (content.includes(targetUpdateMov.replace(/\r\n/g, '\n'))) {
    content = content.replace(targetUpdateMov.replace(/\r\n/g, '\n'), replacementUpdateMov.replace(/\r\n/g, '\n'));
    success++;
} else { console.log('targetUpdateMov not found'); }

if (success === 3) {
    fs.writeFileSync(path, content, 'utf8');
    console.log("All replacements successful.");
} else {
    console.log("Not all replacements successful. Success count: " + success);
}
