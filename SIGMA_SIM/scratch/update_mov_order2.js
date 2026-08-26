const fs = require('fs');
let code = fs.readFileSync('SIGMA_SIM/js/phase.js', 'utf8');

const start = code.indexOf('    const movRows = [');
const end = code.indexOf('    SigmaUI.renderTable(\'mov-combined-container\'');

if (start !== -1 && end !== -1) {
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
    });

`;
    code = code.substring(0, start) + newBlock + code.substring(end);
    fs.writeFileSync('SIGMA_SIM/js/phase.js', code, 'utf8');
    console.log("Updated phase.js successfully via index slicing");
} else {
    console.log("Could not find boundaries");
}
