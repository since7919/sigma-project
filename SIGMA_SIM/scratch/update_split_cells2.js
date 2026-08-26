const fs = require('fs');

let phaseCode = fs.readFileSync('SIGMA_SIM/js/phase.js', 'utf8');

const regex = /style: "text-align:left; padding:5px 10px; font-family:'Outfit', monospace; font-size:11\.5px; line-height:1\.3;",\s*content: `[\s\S]*?`\s*\}/;

const newContent = `style: "text-align:left; padding:5px 10px; font-family:'Outfit', monospace; font-size:11.5px; line-height:1.3;",
                    content: \`
                        <div style="display:flex; align-items:center; margin-bottom:2px; gap:4px;">
                            <span style="color:\${isMatchA ? 'var(--accent)' : '#ff4444'}; font-weight:700; width:12px; cursor:pointer;" onclick="jumpToTOD(\${i})" title="\${!isMatchA ? \\\`A링 합계(\${sumA})가 목표(\${targetCycle})와 불일치\\\` : ''}">A</span> 
                            \${ Array.from({length: 8}).map((_, k) => \\\`<input type="text" class="sigma-input" style="width:20px; text-align:center; background:rgba(0,0,0,0.2); border:1px solid #333; border-radius:3px; color:\${isMatchA ? '#eee' : '#ff4444'}; font-family:inherit; font-size:11px; padding:2px 0;" value="\${p.splitA[k] || 0}" data-type="split-cell" data-ring="A" data-index="\${i}" data-col="\${k}">\\\`).join('') }
                        </div>
                        <div style="display:flex; align-items:center; gap:4px;">
                            <span style="color:\${isMatchB ? '#888' : '#ff4444'}; font-weight:700; width:12px; cursor:pointer;" onclick="jumpToTOD(\${i})" title="\${!isMatchB ? \\\`B링 합계(\${sumB})가 목표(\${targetCycle})와 불일치\\\` : ''}">B</span> 
                            \${ Array.from({length: 8}).map((_, k) => \\\`<input type="text" class="sigma-input" style="width:20px; text-align:center; background:rgba(0,0,0,0.2); border:1px solid #333; border-radius:3px; color:\${isMatchB ? '#888' : '#ff4444'}; font-family:inherit; font-size:11px; padding:2px 0;" value="\${p.splitB[k] || 0}" data-type="split-cell" data-ring="B" data-index="\${i}" data-col="\${k}">\\\`).join('') }
                        </div>\`
                }`;

if (regex.test(phaseCode)) {
    phaseCode = phaseCode.replace(regex, newContent);
    fs.writeFileSync('SIGMA_SIM/js/phase.js', phaseCode, 'utf8');
    console.log("Updated phase.js via regex!");
} else {
    console.log("Regex not matched!");
}
