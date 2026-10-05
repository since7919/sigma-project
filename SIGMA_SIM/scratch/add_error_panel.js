const fs = require('fs');
let content = fs.readFileSync('SIGMA_SIM/index.html', 'utf8');

const target = '<div class="box-green" style="margin-bottom: 8px;">';
const replace = `
            <!-- [추가] 시차맵 오류 패널 -->
            <div id="phase-error-panel" style="display:none; margin-bottom:10px; padding:10px; border-radius:6px; border:1px solid #e74c3c; background:rgba(231, 76, 60, 0.15); color:#ff6b6b; font-size:12px; font-weight:600; line-height:1.4;">
                ⚠️ 시차맵 구성 오류가 발견되었습니다.
            </div>
            <div class="box-green" style="margin-bottom: 8px;">`;

content = content.replace(target, replace);
fs.writeFileSync('SIGMA_SIM/index.html', content, 'utf8');
console.log('Added panel HTML');
