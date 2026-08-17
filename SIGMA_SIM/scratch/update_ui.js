const fs = require('fs');
let content = fs.readFileSync('js/overlay_ui.js', 'utf8');

if (!content.includes('function updateOverlayPhaseDiagram')) {
    content += `
function updateOverlayPhaseDiagram(jid) {
    if (window._currentOverlayJid !== jid) return;
    const j = typeof STATE !== 'undefined' ? STATE.junctions[jid] : null;
    if (!j) return;
    
    const pA = j._activePhaseA || 0;
    const pB = j._activePhaseB || 0;
    const rA = j._remainA || 0;
    const rB = j._remainB || 0;
    
    for (let i = 1; i <= 8; i++) {
        const box = document.getElementById(\`phase-box-\${i}\`);
        const titleBar = document.getElementById(\`phase-title-bar-\${i}\`);
        const titleTime = document.getElementById(\`phase-title-time-\${i}\`);
        const labelA = document.getElementById(\`phase-label-A-\${i}\`);
        const labelB = document.getElementById(\`phase-label-B-\${i}\`);
        
        if (!box) continue;
        
        const isAActive = (pA === i && j._simCycle > 0);
        const isBActive = (pB === i && j._simCycle > 0);
        const isAnyActive = isAActive || isBActive;
        
        if (isAnyActive) {
            box.style.border = '2px solid #10b981';
            box.style.background = 'rgba(16, 185, 129, 0.1)';
            titleBar.style.background = '#10b981';
            titleBar.style.color = '#0f172a';
            
            let remainText = '';
            if (isAActive && isBActive) {
                remainText = (rA === rB) ? \`\${rA}s\` : \`A:\${rA}s B:\${rB}s\`;
            } else if (isAActive) {
                remainText = \`\${rA}s\`;
            } else if (isBActive) {
                remainText = \`\${rB}s\`;
            }
            if (titleTime) {
                titleTime.style.display = 'inline-block';
                titleTime.innerText = remainText;
            }
        } else {
            const hasSplit = box.getAttribute('data-has-split') === 'true';
            box.style.border = hasSplit ? '1px solid #334155' : '1px solid #1e293b';
            box.style.background = 'rgba(255,255,255,0.02)';
            titleBar.style.background = '#1e293b';
            titleBar.style.color = '#cbd5e1';
            if (titleTime) titleTime.style.display = 'none';
        }
        
        if (labelA) labelA.style.color = isAActive ? '#10b981' : '#64748b';
        if (labelB) labelB.style.color = isBActive ? '#10b981' : '#64748b';
    }
}
`;
    fs.writeFileSync('js/overlay_ui.js', content, 'utf8');
}
