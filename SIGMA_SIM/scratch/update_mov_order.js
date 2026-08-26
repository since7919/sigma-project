const fs = require('fs');

let code = fs.readFileSync('SIGMA_SIM/js/phase.js', 'utf8');

const oldBlock = `    const movRows = [
        { label: 'A링 (Mov)', key: 'movA', src: sm },
        { label: 'B링 (Mov)', key: 'movB', src: sm },
        { label: 'A링 보행ID', key: 'pedMovA', src: sm },
        { label: 'B링 보행ID', key: 'pedMovB', src: sm }
    ].map(r => ({
        cells: [
            { content: r.label, className: 'row-label' },
            ...(r.src[r.key] || [0, 0, 0, 0, 0, 0, 0, 0]).map((v, i) => ({
                content: \`<input type="number" class="sigma-input inp-\${r.key}" data-type="mov" data-key="\${r.key}" data-index="\${i}" value="\${v}">\`
            }))
        ]
    }));

    // 방향 및 주현시 데이터 추가
    ['A', 'B'].forEach((ring, idx) => {
        const movs = idx === 0 ? sm.movA : sm.movB;
        movRows.push({
            cells: [
                { content: \`\${ring}링 (Dir)\`, className: 'row-label' },
                ...movs.map(m => {
                    const a = getVisualArrow(m);
                    return { content: \`<div class="visual-arrow-icon" style="transform: rotate(\${a.ang}deg); color: var(--accent)">\${a.type}</div>\` };
                })
            ]
        });
    });

    ['A', 'B'].forEach(ring => {
        const mainMovs = sm.mainMovements || [];
        movRows.push({
            cells: [
                { content: \`주현시 \${ring}\`, className: 'row-label', attr: { title: '최대 2개 선택' } },
                ...[0, 1, 2, 3, 4, 5, 6, 7].map(i => ({
                    content: \`<input type="checkbox" class="inp-main-mov" value="\${ring}\${i}" \${mainMovs.includes(ring + i) ? 'checked' : ''} onchange="limitCheck(this)">\`
                }))
            ]
        });
    });`;

const newBlock = `    const movRows = [];

    ['A', 'B'].forEach((ring, idx) => {
        const movs = idx === 0 ? sm.movA : sm.movB;
        const movKey = idx === 0 ? 'movA' : 'movB';
        const pedKey = idx === 0 ? 'pedMovA' : 'pedMovB';
        const mainMovs = sm.mainMovements || [];
        
        // 1. Dir
        movRows.push({
            cells: [
                { content: \`\${ring}링 (Dir)\`, className: 'row-label' },
                ...movs.map(m => {
                    const a = getVisualArrow(m);
                    return { content: \`<div class="visual-arrow-icon" style="transform: rotate(\${a.ang}deg); color: var(--accent)">\${a.type}</div>\` };
                })
            ]
        });
        
        // 2. Mov
        movRows.push({
            cells: [
                { content: \`\${ring}링 (Mov)\`, className: 'row-label' },
                ...(sm[movKey] || [0, 0, 0, 0, 0, 0, 0, 0]).map((v, i) => ({
                    content: \`<input type="number" class="sigma-input inp-\${movKey}" data-type="mov" data-key="\${movKey}" data-index="\${i}" value="\${v}">\`
                }))
            ]
        });
        
        // 3. 보행ID
        movRows.push({
            cells: [
                { content: \`\${ring}링 보행ID\`, className: 'row-label' },
                ...(sm[pedKey] || [0, 0, 0, 0, 0, 0, 0, 0]).map((v, i) => ({
                    content: \`<input type="number" class="sigma-input inp-\${pedKey}" data-type="mov" data-key="\${pedKey}" data-index="\${i}" value="\${v}">\`
                }))
            ]
        });
        
        // 4. 주현시
        movRows.push({
            cells: [
                { content: \`주현시 \${ring}\`, className: 'row-label', attr: { title: '최대 2개 선택' } },
                ...[0, 1, 2, 3, 4, 5, 6, 7].map(i => ({
                    content: \`<input type="checkbox" class="inp-main-mov" value="\${ring}\${i}" \${mainMovs.includes(ring + i) ? 'checked' : ''} onchange="limitCheck(this)">\`
                }))
            ]
        });
    });`;

if (code.includes('const movRows = [')) {
    code = code.replace(oldBlock, newBlock);
    fs.writeFileSync('SIGMA_SIM/js/phase.js', code, 'utf8');
    console.log('Updated phase.js with new order');
} else {
    console.log('Could not find movRows block');
}
