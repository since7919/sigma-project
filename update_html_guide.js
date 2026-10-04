const fs = require('fs');
let html = fs.readFileSync('SIGMA_SIM/index.html', 'utf8');

const targetStr = `<div id="info-mov-combined-container" style="display:none; margin-top:15px;" class="sigma-panel">
        <div class="card-title">
            <span>🚦 이동류 (Phase/Split 연동)</span>
        </div>
        <div class="foldable-content" id="info-mov-table-wrapper" style="overflow-x: auto;">
        </div>
    </div>`;

const newStr = `<div id="info-mov-combined-container" style="display:none; margin-top:15px;" class="sigma-panel">
        <div class="card-title">
            <span>📝 신호등 위치 편집 가이드</span>
        </div>
        <div class="foldable-content" style="padding: 10px; font-size: 11.5px; color: #cbd5e1; background: rgba(0,0,0,0.2); border-bottom: 1px solid rgba(255,255,255,0.05); margin-bottom: 5px;">
            <ul style="list-style-type: none; margin: 0; padding: 0; line-height: 1.6;">
                <li><span style="color: #00d4ff; font-weight: bold; display: inline-block; width: 130px;">[우클릭+드래그]</span> 모든 신호등 회전</li>
                <li><span style="color: #00d4ff; font-weight: bold; display: inline-block; width: 130px;">[좌클릭+드래그]</span> 신호등 위치 이동</li>
                <li><span style="color: #00d4ff; font-weight: bold; display: inline-block; width: 130px;">[Ctrl+왼클릭]</span> 신호등 복사</li>
                <li><span style="color: #00d4ff; font-weight: bold; display: inline-block; width: 130px;">[더블클릭+우클릭 드래그]</span> 개별 신호등 회전</li>
            </ul>
        </div>
        <div class="card-title" style="border-top: none;">
            <span>🚦 이동류 (Phase/Split 연동)</span>
        </div>
        <div class="foldable-content" id="info-mov-table-wrapper" style="overflow-x: auto;">
        </div>
    </div>`;

html = html.replace(targetStr, newStr);
html = html.replace(targetStr.replace(/\r\n/g, '\n'), newStr);

fs.writeFileSync('SIGMA_SIM/index.html', html, 'utf8');
console.log("HTML replaced.");
