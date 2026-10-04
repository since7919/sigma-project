const fs = require('fs');
let html = fs.readFileSync('SIGMA_SIM/index.html', 'utf8');
html = html.replace(
    '<!-- [추가] 미니게임 호출 배너 -->',
    `<div id="info-mov-combined-container" style="display:none; margin-top:15px;" class="sigma-panel">
        <div class="card-title">
            <span>🚦 이동류 (Phase/Split 연동)</span>
        </div>
        <div class="foldable-content" id="info-mov-table-wrapper" style="overflow-x: auto;">
        </div>
    </div>
    <!-- [추가] 미니게임 호출 배너 -->`
);
fs.writeFileSync('SIGMA_SIM/index.html', html, 'utf8');
