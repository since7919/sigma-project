const fs = require('fs');
let code = fs.readFileSync('SIGMA_SIM/js/junction_optimizer.js', 'utf8');

const startStr = `    // 8개 접근로 횡방향 테이블`;
const endStr = `container.innerHTML = templateHtml + tableHtml;`;
const startIndex = code.indexOf(startStr);
const endIndex = code.indexOf(endStr, startIndex) + endStr.length;

if (startIndex === -1 || endIndex === -1) {
    console.error("Could not find table generation block");
    process.exit(1);
}

const newTableLogic = `    // 8개 접근로 횡방향 32열 테이블
    let theadRow1 = \`<th rowspan="2" style="padding:4px; text-align:center; font-size:11px; color:#aaa; border:1px solid #444; width:80px; background:rgba(255,255,255,0.05); min-width:80px;">구분</th>\`;
    let theadRow2 = \`<th style="display:none;"></th>\`; // For valid HTML matching rowspan
    
    let tbodyRow = \`<tr><td style="padding:4px; text-align:center; font-size:11px; color:#aaa; border:1px solid #444; font-weight:bold; background:rgba(255,255,255,0.05);">차로 프리셋</td>\`;

    OPT_DIRS.forEach(d => {
        // Row 1: Direction Header (colspan 4)
        theadRow1 += \`<th colspan="4" style="padding:4px; text-align:center; font-size:11px; color:#aaa; border:1px solid #444;">
            <label style="cursor:pointer; display:flex; flex-direction:row; align-items:center; justify-content:center; gap:5px;">
                <input type="checkbox" id="chk-preset-\${d.id}" onchange="toggleOptActiveFromPanel('\${d.id}')">
                \${d.label} (\${d.id})
            </label>
        </th>\`;
        
        // Row 2: Sub-headers (Bus, L, T, R)
        theadRow2 += \`
            <th style="padding:4px; text-align:center; font-size:10px; color:#888; border:1px solid #444; width:70px; min-width:70px; font-weight:normal; background:rgba(255,255,255,0.02);">버스</th>
            <th style="padding:4px; text-align:center; font-size:10px; color:#888; border:1px solid #444; width:70px; min-width:70px; font-weight:normal; background:rgba(255,255,255,0.02);">좌회전</th>
            <th style="padding:4px; text-align:center; font-size:10px; color:#888; border:1px solid #444; width:70px; min-width:70px; font-weight:normal; background:rgba(255,255,255,0.02);">직진</th>
            <th style="padding:4px; text-align:center; font-size:10px; color:#888; border:1px solid #444; width:70px; min-width:70px; font-weight:normal; background:rgba(255,255,255,0.02);">우회전</th>
        \`;

        // Body Row: Selects
        tbodyRow += \`
            <td style="padding:2px; border:1px solid #444; text-align:center;">
                <select id="preset-bus-\${d.id}" class="preset-select" data-dir="\${d.id}" onchange="applyLanePresetComposite('\${d.id}')" style="width:100%; height:22px; font-size:11px; background:#333; color:#fff; border:1px solid #555; border-radius:3px; outline:none; cursor:pointer;">
                    <option value="">-</option>
                    <option value="C1">C1</option>
                    <option value="C2">C2</option>
                </select>
            </td>
            <td style="padding:2px; border:1px solid #444; text-align:center;">
                <select id="preset-left-\${d.id}" class="preset-select" data-dir="\${d.id}" onchange="applyLanePresetComposite('\${d.id}')" style="width:100%; height:22px; font-size:11px; background:#333; color:#fff; border:1px solid #555; border-radius:3px; outline:none; cursor:pointer;">
                    <option value="">-</option>
                    <option value="L1">L1</option>
                    <option value="L2">L2</option>
                    <option value="L3">L3</option>
                    <option value="LU1">LU1</option>
                    <option value="LU1,L1">LU1,L1</option>
                    <option value="LT1">LT1</option>
                    <option value="LT1,L1">LT1,L1</option>
                    <option value="LR1">LR1</option>
                </select>
            </td>
            <td style="padding:2px; border:1px solid #444; text-align:center;">
                <select id="preset-straight-\${d.id}" class="preset-select" data-dir="\${d.id}" onchange="applyLanePresetComposite('\${d.id}')" style="width:100%; height:22px; font-size:11px; background:#333; color:#fff; border:1px solid #555; border-radius:3px; outline:none; cursor:pointer;">
                    <option value="">-</option>
                    <option value="T1">T1</option>
                    <option value="T2">T2</option>
                    <option value="T3">T3</option>
                    <option value="T4">T4</option>
                    <option value="T5">T5</option>
                </select>
            </td>
            <td style="padding:2px; border:1px solid #444; text-align:center;">
                <select id="preset-right-\${d.id}" class="preset-select" data-dir="\${d.id}" onchange="applyLanePresetComposite('\${d.id}')" style="width:100%; height:22px; font-size:11px; background:#333; color:#fff; border:1px solid #555; border-radius:3px; outline:none; cursor:pointer;">
                    <option value="">-</option>
                    <option value="R1">R1</option>
                    <option value="R2">R2</option>
                    <option value="TR1">TR1</option>
                    <option value="TR1,R1">TR1,R1</option>
                    <option value="R_D1">우도류</option>
                </select>
            </td>
        \`;
    });

    tbodyRow += \`</tr>\`;

    const tableHtml = \`
        <div class="sector-header-opt flex-row-between gap-10 mb-5 pb-5 border-b-1 mt-10" style="color:#3498db; border-bottom-color:#444;">
            <span class="fs-12 fw-800">🚘 접근로별 차로 일괄 설정</span>
        </div>
        <div style="width: 100%; overflow-x: auto; padding-bottom: 5px;" class="custom-scroll">
            <table style="border-collapse:collapse; background:rgba(0,0,0,0.2); border:1px solid #333; margin-bottom:10px; table-layout:fixed; min-width:2400px;">
                <thead>
                    <tr style="background:rgba(255,255,255,0.05);">\${theadRow1}</tr>
                    <tr style="background:rgba(255,255,255,0.03);">\${theadRow2}</tr>
                </thead>
                <tbody>
                    \${tbodyRow}
                </tbody>
            </table>
        </div>
    \`;

    container.innerHTML = templateHtml + tableHtml;`;

code = code.substring(0, startIndex) + newTableLogic + code.substring(endIndex);
fs.writeFileSync('SIGMA_SIM/js/junction_optimizer.js', code, 'utf8');
console.log('Restructured table to 32 cols and fixed syntax');
