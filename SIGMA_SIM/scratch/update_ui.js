const fs = require('fs');
let code = fs.readFileSync('SIGMA_SIM/js/overlay_ui.js', 'utf8');

const targetFunc = `function switchOverlayTab(tabName) {
    // 모든 탭 내용 숨기기
    document.querySelectorAll('.detail-tab-content').forEach(el => el.style.display = 'none');
    // 모든 탭 버튼 활성화 상태 제거
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    
    // 선택한 탭 보이기 및 활성화
    const targetContent = document.getElementById(\`overlay-tab-\${tabName}\`);
    if (targetContent) {
        if (tabName === 'phase') {
            targetContent.style.display = 'flex';
        } else {
            targetContent.style.display = 'block';
        }
    }
    
    const targetBtn = document.getElementById(\`tab-btn-\${tabName}\`);
    if (targetBtn) targetBtn.classList.add('active');

    // 운영통계 탭일 때만 SVG 및 통계요약 보이기
    const svgArea = document.getElementById('overlay-svg-area');
    const summaryArea = document.getElementById('overlay-summary-area');
    if (svgArea) svgArea.style.display = (tabName === 'optstats') ? 'flex' : 'none';
    if (summaryArea) summaryArea.style.display = (tabName === 'optstats') ? 'flex' : 'none';
    
    setTimeout(() => {
        if (typeof overlayMap !== 'undefined' && overlayMap) {
            overlayMap.invalidateSize();
        }
    }, 300);
}`;

code = code.replace(/function switchOverlayTab\(tabName\) \{[\s\S]*?\}\n/, targetFunc + '\n');
fs.writeFileSync('SIGMA_SIM/js/overlay_ui.js', code, 'utf8');
console.log('UI updated');
