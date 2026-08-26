const fs = require('fs');
const path = 'SIGMA_SIM/js/phase.js';
let content = fs.readFileSync(path, 'utf8');

// Normalize line endings
content = content.replace(/\r\n/g, '\n');

const target = `    const movRows = [];

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
    });

    SigmaUI.renderTable('mov-combined-container', {
        tableId: 'mov-combined-table',
        className: 'sigma-table',
        head: ['구분', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8'],
        rows: movRows
    });`.replace(/\r\n/g, '\n');

const replacement = `    const movRows = [];

    const categories = [
        { id: 'dir', label: 'Dir' },
        { id: 'mov', label: 'Mov' },
        { id: 'ped', label: '보행ID' },
        { id: 'main', label: '주현시' }
    ];

    categories.forEach(cat => {
        ['A', 'B'].forEach((ring, idx) => {
            const movs = idx === 0 ? sm.movA : sm.movB;
            const movKey = idx === 0 ? 'movA' : 'movB';
            const pedKey = idx === 0 ? 'pedMovA' : 'pedMovB';
            const mainMovs = sm.mainMovements || [];

            const cells = [];
            
            if (idx === 0) {
                cells.push({ content: cat.label, className: 'row-label', attr: { rowspan: 2 }, style: 'vertical-align:middle; text-align:center; font-weight:bold; background:rgba(0,0,0,0.2); width:40px;' });
            }
            
            if (cat.id === 'dir') {
                cells.push({ content: \`\${ring}링\`, className: 'row-label', style: 'width:40px;' });
                movs.forEach(m => {
                    const a = getVisualArrow(m);
                    cells.push({ content: \`<div class="visual-arrow-icon" style="transform: rotate(\${a.ang}deg); color: var(--accent)">\${a.type}</div>\` });
                });
            } else if (cat.id === 'mov') {
                cells.push({ content: \`\${ring}링\`, className: 'row-label', style: 'width:40px;' });
                (sm[movKey] || [0, 0, 0, 0, 0, 0, 0, 0]).forEach((v, i) => {
                    cells.push({ content: \`<input type="number" class="sigma-input inp-\${movKey}" data-type="mov" data-key="\${movKey}" data-index="\${i}" value="\${v}">\` });
                });
            } else if (cat.id === 'ped') {
                cells.push({ content: \`\${ring}링\`, className: 'row-label', style: 'width:40px;' });
                (sm[pedKey] || [0, 0, 0, 0, 0, 0, 0, 0]).forEach((v, i) => {
                    cells.push({ content: \`<input type="number" class="sigma-input inp-\${pedKey}" data-type="mov" data-key="\${pedKey}" data-index="\${i}" value="\${v}">\` });
                });
            } else if (cat.id === 'main') {
                cells.push({ content: \`\${ring}링\`, className: 'row-label', attr: { title: '최대 2개 선택' }, style: 'width:40px;' });
                [0, 1, 2, 3, 4, 5, 6, 7].forEach(i => {
                    cells.push({ content: \`<input type="checkbox" class="inp-main-mov" value="\${ring}\${i}" \${mainMovs.includes(ring + i) ? 'checked' : ''} onchange="limitCheck(this)">\` });
                });
            }
            
            movRows.push({ cells });
        });
    });

    SigmaUI.renderTable('mov-combined-container', {
        tableId: 'mov-combined-table',
        className: 'sigma-table',
        head: [{label: '구분', colspan: 2}, 'P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8'],
        rows: movRows
    });`.replace(/\r\n/g, '\n');

if (content.includes(target)) {
    content = content.replace(target, replacement);
    fs.writeFileSync(path, content, 'utf8');
    console.log("Replacement successful.");
} else {
    console.log("Target not found!");
}
