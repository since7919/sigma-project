const fs = require('fs');
let code = fs.readFileSync('SIGMA_SIM/js/junction_optimizer.js', 'utf8');

const regex = /\/\/ 8개 접근로 테이블[\s\S]*?const tableHtml = `[\s\S]*?`;/;

const newLayout = `    // 8개 접근로 횡방향 테이블
    let theadCells = '';
    let tbodyCells = '';
    
    OPT_DIRS.forEach(d => {
        theadCells += \`<th style="padding:4px; text-align:center; font-size:11px; color:#aaa; border:1px solid #444; width:120px;">
            <label style="cursor:pointer; display:flex; flex-direction:row; align-items:center; justify-content:center; gap:5px;">
                <input type="checkbox" id="chk-preset-\${d.id}" onchange="toggleOptActiveFromPanel('\${d.id}')">
                \${d.label} (\${d.id})
            </label>
        </th>\`;
        
        tbodyCells += \`<td id="td-preset-\${d.id}" style="padding:4px; border:1px solid #444; transition:0.2s;">
            <select class="preset-select" data-dir="\${d.id}" onchange="applyLanePresetToDir('\${d.id}', this.value)"
                style="width:100%; height:22px; font-size:11px; background:#333; color:#fff; border:1px solid #555; border-radius:3px; outline:none; cursor:pointer;">
                \${optionsHtml}
            </select>
        </td>\`;
    });

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
                    <tr>\${tbodyCells}</tr>
                </tbody>
            </table>
        </div>
    \`;`;

if (regex.test(code)) {
    code = code.replace(regex, newLayout);
    fs.writeFileSync('SIGMA_SIM/js/junction_optimizer.js', code, 'utf8');
    console.log("Success");
} else {
    console.log("Not found");
}
