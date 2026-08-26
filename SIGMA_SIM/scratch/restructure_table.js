const fs = require('fs');
let code = fs.readFileSync('SIGMA_SIM/js/junction_optimizer.js', 'utf8');

// Find the start of thetable generation logic in renderTemplatePanel
const startStr = `    // 8개 접근로 횡방향 테이블`;
const endStr = `            </table>`;
const startIndex = code.indexOf(startStr);
const endIndex = code.indexOf(endStr, startIndex) + endStr.length;

if (startIndex === -1 || endIndex === -1) {
    console.error("Could not find table generation block");
    process.exit(1);
}

const newTableLogic = `    // 8개 접근로 횡방향 테이블
    let theadCells = \`<th style="padding:4px; text-align:center; font-size:11px; color:#aaa; border:1px solid #444; width:60px;">접근로</th>\`;
    let rowBus = \`<tr><td style="padding:4px; text-align:center; font-size:11px; color:#aaa; border:1px solid #444; font-weight:bold; background:rgba(255,255,255,0.05);">버스</td>\`;
    let rowLeft = \`<tr><td style="padding:4px; text-align:center; font-size:11px; color:#aaa; border:1px solid #444; font-weight:bold; background:rgba(255,255,255,0.05);">좌회전</td>\`;
    let rowStraight = \`<tr><td style="padding:4px; text-align:center; font-size:11px; color:#aaa; border:1px solid #444; font-weight:bold; background:rgba(255,255,255,0.05);">직진</td>\`;
    let rowRight = \`<tr><td style="padding:4px; text-align:center; font-size:11px; color:#aaa; border:1px solid #444; font-weight:bold; background:rgba(255,255,255,0.05);">우회전</td>\`;

    OPT_DIRS.forEach(d => {
        theadCells += \`<th style="padding:4px; text-align:center; font-size:11px; color:#aaa; border:1px solid #444; width:90px;">
            <label style="cursor:pointer; display:flex; flex-direction:row; align-items:center; justify-content:center; gap:5px;">
                <input type="checkbox" id="chk-preset-\${d.id}" onchange="toggleOptActiveFromPanel('\${d.id}')">
                \${d.label} (\${d.id})
            </label>
        </th>\`;
        
        rowBus += \`<td id="td-preset-bus-\${d.id}" style="padding:4px; border:1px solid #444; transition:0.2s;">
            <select id="preset-bus-\${d.id}" class="preset-select" data-dir="\${d.id}" onchange="applyLanePresetComposite('\${d.id}')" style="width:100%; height:22px; font-size:11px; background:#333; color:#fff; border:1px solid #555; border-radius:3px; outline:none; cursor:pointer;">
                <option value="">(선택)</option>
                <option value="C1">버스1</option>
                <option value="C2">버스2</option>
            </select>
        </td>\`;

        rowLeft += \`<td id="td-preset-left-\${d.id}" style="padding:4px; border:1px solid #444; transition:0.2s;">
            <select id="preset-left-\${d.id}" class="preset-select" data-dir="\${d.id}" onchange="applyLanePresetComposite('\${d.id}')" style="width:100%; height:22px; font-size:11px; background:#333; color:#fff; border:1px solid #555; border-radius:3px; outline:none; cursor:pointer;">
                <option value="">(선택)</option>
                <option value="L1">좌1</option>
                <option value="L2">좌2</option>
                <option value="L3">좌3</option>
                <option value="LU1">좌유1</option>
                <option value="LU1,L1">좌유1,좌1</option>
                <option value="LT1">직좌1</option>
                <option value="LT1,L1">직좌1,좌1</option>
                <option value="LR1">좌우1</option>
            </select>
        </td>\`;

        rowStraight += \`<td id="td-preset-straight-\${d.id}" style="padding:4px; border:1px solid #444; transition:0.2s;">
            <select id="preset-straight-\${d.id}" class="preset-select" data-dir="\${d.id}" onchange="applyLanePresetComposite('\${d.id}')" style="width:100%; height:22px; font-size:11px; background:#333; color:#fff; border:1px solid #555; border-radius:3px; outline:none; cursor:pointer;">
                <option value="">(선택)</option>
                <option value="T1">직1</option>
                <option value="T2">직2</option>
                <option value="T3">직3</option>
                <option value="T4">직4</option>
                <option value="T5">직5</option>
            </select>
        </td>\`;

        rowRight += \`<td id="td-preset-right-\${d.id}" style="padding:4px; border:1px solid #444; transition:0.2s;">
            <select id="preset-right-\${d.id}" class="preset-select" data-dir="\${d.id}" onchange="applyLanePresetComposite('\${d.id}')" style="width:100%; height:22px; font-size:11px; background:#333; color:#fff; border:1px solid #555; border-radius:3px; outline:none; cursor:pointer;">
                <option value="">(선택)</option>
                <option value="R1">우1</option>
                <option value="R2">우2</option>
                <option value="TR1">직우1</option>
                <option value="TR1,R1">직우1,우1</option>
                <option value="R_D1">우도류1</option>
            </select>
        </td>\`;
    });

    rowBus += \`</tr>\`;
    rowLeft += \`</tr>\`;
    rowStraight += \`</tr>\`;
    rowRight += \`</tr>\`;

    const tbodyCells = rowBus + rowLeft + rowStraight + rowRight;

    const tableHtml = \`
        <div class="sector-header-opt flex-row-between gap-10 mb-5 pb-5 border-b-1 mt-10" style="color:#3498db; border-bottom-color:#444;">
            <span class="fs-12 fw-800">🚘 접근로별 차로 일괄 설정</span>
        </div>
        <div style="width: 100%; overflow-x: auto;" class="custom-scroll">
            <table style="width:100%; border-collapse:collapse; background:rgba(0,0,0,0.2); border:1px solid #333; margin-bottom:10px; table-layout:fixed; min-width:800px;">
                <thead>
                    <tr style="background:rgba(255,255,255,0.05);">\${theadCells}</tr>
                </thead>
                <tbody>
                    \${tbodyCells}
                </tbody>
            </table>\`;

    const finalHtml = templateHtml + tableHtml + \`</div>\`;
`;

code = code.substring(0, startIndex) + newTableLogic + code.substring(endIndex);
fs.writeFileSync('SIGMA_SIM/js/junction_optimizer.js', code, 'utf8');
console.log('Restructured table');
