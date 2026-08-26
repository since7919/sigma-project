const fs = require('fs');

let phaseCode = fs.readFileSync('SIGMA_SIM/js/phase.js', 'utf8');

const oldContent = `                        <div style="display:flex; align-items:center; margin-bottom:2px;">
                            <span style="color:\${isMatchA ? 'var(--accent)' : '#ff4444'}; font-weight:700; width:12px; cursor:pointer;" onclick="jumpToTOD(\${i})" title="\${!isMatchA ? \`A링 합계(\${sumA})가 목표(\${targetCycle})와 불일치\` : ''}">A</span> 
                            <input type="text" class="sigma-input" style="flex:1; background:transparent; border:none; border-bottom:1px solid #444; color:\${isMatchA ? '#eee' : '#ff4444'}; font-family:inherit; font-size:inherit; padding:0 2px;" value="\${(p.splitA || []).join(' ')}" data-type="split" data-ring="A" data-index="\${i}">
                        </div>
                        <div style="display:flex; align-items:center;">
                            <span style="color:\${isMatchB ? '#888' : '#ff4444'}; font-weight:700; width:12px; cursor:pointer;" onclick="jumpToTOD(\${i})" title="\${!isMatchB ? \`B링 합계(\${sumB})가 목표(\${targetCycle})와 불일치\` : ''}">B</span> 
                            <input type="text" class="sigma-input" style="flex:1; background:transparent; border:none; border-bottom:1px solid #444; color:\${isMatchB ? '#888' : '#ff4444'}; font-family:inherit; font-size:inherit; padding:0 2px;" value="\${(p.splitB || []).join(' ')}" data-type="split" data-ring="B" data-index="\${i}">
                        </div>`;

const newContent = `                        <div style="display:flex; align-items:center; margin-bottom:2px; gap:2px;">
                            <span style="color:\${isMatchA ? 'var(--accent)' : '#ff4444'}; font-weight:700; width:12px; cursor:pointer;" onclick="jumpToTOD(\${i})" title="\${!isMatchA ? \`A링 합계(\${sumA})가 목표(\${targetCycle})와 불일치\` : ''}">A</span> 
                            \${ Array.from({length: 8}).map((_, k) => \`<input type="text" class="sigma-input" style="width:20px; text-align:center; background:transparent; border:none; border-bottom:1px solid #444; color:\${isMatchA ? '#eee' : '#ff4444'}; font-family:inherit; font-size:11px; padding:0;" value="\${p.splitA[k] || 0}" data-type="split-cell" data-ring="A" data-index="\${i}" data-col="\${k}">\`).join('') }
                        </div>
                        <div style="display:flex; align-items:center; gap:2px;">
                            <span style="color:\${isMatchB ? '#888' : '#ff4444'}; font-weight:700; width:12px; cursor:pointer;" onclick="jumpToTOD(\${i})" title="\${!isMatchB ? \`B링 합계(\${sumB})가 목표(\${targetCycle})와 불일치\` : ''}">B</span> 
                            \${ Array.from({length: 8}).map((_, k) => \`<input type="text" class="sigma-input" style="width:20px; text-align:center; background:transparent; border:none; border-bottom:1px solid #444; color:\${isMatchB ? '#888' : '#ff4444'}; font-family:inherit; font-size:11px; padding:0;" value="\${p.splitB[k] || 0}" data-type="split-cell" data-ring="B" data-index="\${i}" data-col="\${k}">\`).join('') }
                        </div>`;

phaseCode = phaseCode.replace(oldContent, newContent);
fs.writeFileSync('SIGMA_SIM/js/phase.js', phaseCode, 'utf8');
console.log("Updated phase.js successfully.");
