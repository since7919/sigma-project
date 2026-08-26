const fs = require('fs');
const path = 'SIGMA_SIM/js/phase.js';
let content = fs.readFileSync(path, 'utf8');
content = content.replace(/\r\n/g, '\n');

const target = `    // ── Phase/Split 테이블: B링 숨김은 Split 계열에만 적용 ──
    // 현시계획(Map)의 Yellow/AllRed/Ped 등은 항상 A/B 모두 표시
    const phaseRows = [
        { lab: 'Split A', key: 'splitA', cls: '', isDetail: false, isSplit: true },
        { lab: 'Split B', key: 'splitB', cls: '', isDetail: false, ring: 'B', isSplit: true },
        { lab: 'MG A (최소녹색)', key: 'minGreenA', cls: 'c-green', isDetail: true, isSplit: false, calc: (i) => {
            const pA = sm.pedA?.[i] || 0; const arA = sm.allredA?.[i] || 0; const dlyA = sm.pedDelayA?.[i] || 0;
            return pA > 0 ? pA + arA + dlyA : 7 + arA;
        }},
        { lab: 'MG B (최소녹색)', key: 'minGreenB', cls: 'c-green', isDetail: true, ring: 'B', isSplit: false, calc: (i) => {
            const pB = sm.pedB?.[i] || 0; const arB = sm.allredB?.[i] || 0; const dlyB = sm.pedDelayB?.[i] || 0;
            return pB > 0 ? pB + arB + dlyB : 7 + arB;
        }},
        { lab: 'AllRed A', key: 'allredA', cls: 'c-red', isDetail: true, isSplit: false },
        { lab: 'AllRed B', key: 'allredB', cls: 'c-red', isDetail: true, ring: 'B', isSplit: false },
        { lab: 'Yellow A', key: 'yellowA', cls: 'c-yellow', isDetail: true, isSplit: false },
        { lab: 'Yellow B', key: 'yellowB', cls: 'c-yellow', isDetail: true, ring: 'B', isSplit: false },
        { lab: 'PedDly A', key: 'pedDelayA', cls: '', isDetail: true, isSplit: false },
        { lab: 'PedDly B', key: 'pedDelayB', cls: '', isDetail: true, ring: 'B', isSplit: false },
        { lab: '보행녹색 A', key: 'pedGreenA', cls: 'c-green', isDetail: true, isSplit: false },
        { lab: '보행녹색 B', key: 'pedGreenB', cls: 'c-green', isDetail: true, ring: 'B', isSplit: false },
        { lab: '보행점멸 A', key: 'pedFlashA', cls: 'c-orange', isDetail: true, isSplit: false },
        { lab: '보행점멸 B', key: 'pedFlashB', cls: 'c-orange', isDetail: true, ring: 'B', isSplit: false },
        { lab: '보행합계 A', key: 'pedA', cls: 'c-green-bold', isDetail: true, isSplit: false },
        { lab: '보행합계 B', key: 'pedB', cls: 'c-green-bold', isDetail: true, ring: 'B', isSplit: false }
    ]
        // B링 숨김: 모든 ring:'B' 행은 isDual 체크 상태에 따름
        .filter(r => (!r.isDetail || !onlySplits) && (r.ring !== 'B' || isDual))
        .map(r => ({
            cells: [
                { content: r.lab, className: \`row-label \${r.cls}\` },
                ...[0, 1, 2, 3, 4, 5, 6, 7].map(i => {
                    const isDisabled = (r.ring === 'B' && !isDual) ? 'disabled' : '';
                    const source = (r.key.startsWith('split')) ? p : sm;
                    const val = (source[r.key] || [])[i] || 0;
                    
                    let extraStyle = '';
                    let tooltip = '';
                    if (r.key === 'splitA' || r.key === 'splitB') {
                        const isB = r.key === 'splitB';
                        const ped = isB ? sm.pedB?.[i] : sm.pedA?.[i];
                        const arr = isB ? sm.allredB?.[i] : sm.allredA?.[i];
                        const dly = isB ? sm.pedDelayB?.[i] : sm.pedDelayA?.[i];
                        const yel = isB ? sm.yellowB?.[i] : sm.yellowA?.[i];
                        
                        const mg = (ped || 0) > 0 ? (ped || 0) + (dly || 0) + (arr || 0) : 7 + (arr || 0);
                        const mgWithYellow = mg + (yel || 0);
                        
                        if (val > 0 && val < mg) {
                            extraStyle = 'border: 2px solid #ff4d4d; box-shadow: 0 0 10px rgba(255,77,77,0.5); background: rgba(255,77,77,0.15); color: #ffffff !important; font-weight: bold;';
                            tooltip = \`안전감사 위기! 최소녹색시간(\${mg}초) 미달\`;
                        } else if (val > 0 && val < mgWithYellow) {
                            extraStyle = 'border: 2px solid #ffcc00; box-shadow: 0 0 10px rgba(255,204,0,0.5); background: rgba(255,204,0,0.1); color: #ffffff !important; font-weight: bold;';
                            tooltip = \`안전감사 주의! 최소녹색+황색(\${mgWithYellow}초) 미달\`;
                        }
                    }

                    return {
                        content: r.calc
                            ? \`<input type="text" class="sigma-input" value="\${r.calc(i)}" readonly 
                                style="color:#10b981 !important; font-weight:bold; cursor:default; border-color:rgba(16,185,129,0.15) !important;" 
                                title="최소녹색시간 = 보행합계+전적색+보행지연 (또는 최소 7초+전적색)">\`
                            : \`<input type="number" class="sigma-input \${r.cls} inp-\${r.key}" data-key="\${r.key}" data-index="\${i}" value="\${val}" style="\${extraStyle}" title="\${tooltip}" \${isDisabled}>\`,
                        className: r.cls
                    };
                })
            ]
        }));

    SigmaUI.renderTable('tod-container', {
        tableId: 'tod-table',
        className: 'sigma-table',
        head: ['항목', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8'],
        rows: phaseRows
    });`;

const replacement = `    // ── Phase/Split 테이블: B링 숨김은 Split 계열에만 적용 ──
    // 현시계획(Map)의 Yellow/AllRed/Ped 등은 항상 A/B 모두 표시
    const phaseCategories = [
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
    ];

    const finalPhaseRows = [];

    phaseCategories.forEach(cat => {
        if (cat.isDetail && onlySplits) return;

        const rings = isDual ? ['A', 'B'] : ['A'];
        
        rings.forEach((ring, idx) => {
            const cells = [];
            
            if (idx === 0) {
                cells.push({ content: cat.label, className: 'row-label', attr: rings.length > 1 ? { rowspan: 2 } : {}, style: 'vertical-align:middle; text-align:center; font-weight:bold; background:rgba(0,0,0,0.2); width:80px;' });
            }
            
            const isB = (ring === 'B');
            const key = isB ? cat.keyB : cat.keyA;
            const cls = isB ? cat.clsB : cat.clsA;
            const calc = isB ? cat.calcB : cat.calcA;

            cells.push({ content: \`\${ring}링\`, className: \`row-label \${cls}\`, style: 'width:40px; text-align:center;' });

            [0, 1, 2, 3, 4, 5, 6, 7].forEach(i => {
                const isDisabled = (isB && !isDual) ? 'disabled' : '';
                const source = (key.startsWith('split')) ? p : sm;
                const val = (source[key] || [])[i] || 0;
                
                let extraStyle = '';
                let tooltip = '';
                if (key === 'splitA' || key === 'splitB') {
                    const ped = isB ? sm.pedB?.[i] : sm.pedA?.[i];
                    const arr = isB ? sm.allredB?.[i] : sm.allredA?.[i];
                    const dly = isB ? sm.pedDelayB?.[i] : sm.pedDelayA?.[i];
                    const yel = isB ? sm.yellowB?.[i] : sm.yellowA?.[i];
                    
                    const mg = (ped || 0) > 0 ? (ped || 0) + (dly || 0) + (arr || 0) : 7 + (arr || 0);
                    const mgWithYellow = mg + (yel || 0);
                    
                    if (val > 0 && val < mg) {
                        extraStyle = 'border: 2px solid #ff4d4d; box-shadow: 0 0 10px rgba(255,77,77,0.5); background: rgba(255,77,77,0.15); color: #ffffff !important; font-weight: bold;';
                        tooltip = \`안전감사 위기! 최소녹색시간(\${mg}초) 미달\`;
                    } else if (val > 0 && val < mgWithYellow) {
                        extraStyle = 'border: 2px solid #ffcc00; box-shadow: 0 0 10px rgba(255,204,0,0.5); background: rgba(255,204,0,0.1); color: #ffffff !important; font-weight: bold;';
                        tooltip = \`안전감사 주의! 최소녹색+황색(\${mgWithYellow}초) 미달\`;
                    }
                }

                cells.push({
                    content: calc
                        ? \`<input type="text" class="sigma-input" value="\${calc(i)}" readonly 
                            style="color:#10b981 !important; font-weight:bold; cursor:default; border-color:rgba(16,185,129,0.15) !important;" 
                            title="최소녹색시간 = 보행합계+전적색+보행지연 (또는 최소 7초+전적색)">\`
                        : \`<input type="number" class="sigma-input \${cls} inp-\${key}" data-key="\${key}" data-index="\${i}" value="\${val}" style="\${extraStyle}" title="\${tooltip}" \${isDisabled}>\`,
                    className: cls
                });
            });

            finalPhaseRows.push({ cells });
        });
    });

    SigmaUI.renderTable('tod-container', {
        tableId: 'tod-table',
        className: 'sigma-table',
        head: [{label: '항목', colspan: 2}, 'P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8'],
        rows: finalPhaseRows
    });`;

if (content.includes(target.replace(/\r\n/g, '\n'))) {
    content = content.replace(target.replace(/\r\n/g, '\n'), replacement.replace(/\r\n/g, '\n'));
    fs.writeFileSync(path, content, 'utf8');
    console.log("Replacement successful.");
} else {
    console.log("Target not found!");
}
