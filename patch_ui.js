const fs = require('fs');

let html = fs.readFileSync('SIGMA_SIM/index.html', 'utf8');

const titleStr = '<span style="font-weight: 700; letter-spacing: 0.5px;">📊 데이터 뷰 & 거시/미시 통찰 (Data & Insights)</span>';
const replaceStr = titleStr + '\n                    <button class="action-btn" onclick="generateAIReport()" style="margin-left: 15px; background: rgba(100, 181, 246, 0.1); border: 1px solid #64b5f6; border-radius: 20px; padding: 4px 12px; font-size: 12px; font-weight: bold; cursor: pointer; color: #64b5f6; transition: all 0.2s;">🤖 AI 비교 분석 리포트 생성</button>';

if (html.includes(titleStr) && !html.includes('generateAIReport()')) {
    html = html.replace(titleStr, replaceStr);
}

const statContentStr = '<div id="stat-content" style="display:none;">';
const aiBoxStr = `
                        <!-- [신규] AI 리포트 출력 박스 -->
                        <div id="ai-report-box" class="sigma-panel mb-20" style="display:none; background: rgba(10, 25, 41, 0.8); border: 1px solid #1e4976; padding: 20px; border-radius: 8px; font-size: 13px; line-height: 1.6; color: #e0e0e0; box-shadow: 0 4px 15px rgba(0,0,0,0.5);">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom:15px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 10px;">
                                <div style="font-weight:bold; font-size:15px; color:#64b5f6;">🤖 SIGMA 교통정책 인사이트 리포트</div>
                                <button onclick="document.getElementById('ai-report-box').style.display='none'" style="background:none; border:none; color:#999; cursor:pointer; font-size:16px;">&times;</button>
                            </div>
                            <div id="ai-report-content" style="white-space: pre-wrap;">데이터를 분석하고 있습니다... ⏳</div>
                        </div>`;

if (html.includes(statContentStr) && !html.includes('id="ai-report-box"')) {
    html = html.replace(statContentStr, statContentStr + '\n' + aiBoxStr);
}

fs.writeFileSync('SIGMA_SIM/index.html', html, 'utf8');
console.log('index.html updated');

// Also write generateAIReport() function into a JS file or embed it. Let's put it in a new script block at the bottom, or just in app_init.js / data.js.
// We will patch data.js to include generateAIReport().
let dataJs = fs.readFileSync('SIGMA_SIM/js/data.js', 'utf8');

const aiFunc = `
// ── [신규] AI 리포트 생성 함수 ──
async function generateAIReport() {
    const box = document.getElementById('ai-report-box');
    const content = document.getElementById('ai-report-content');
    
    // UI 표시
    box.style.display = 'block';
    content.innerHTML = '<div style="text-align:center; padding: 20px; color:#aaa;">✨ 구글 Gemini AI가 통계 데이터를 분석하고 있습니다... (약 5~10초 소요) ⏳</div>';
    
    // 현재 화면에 렌더링된 통계(타겟) 데이터 수집
    // 편의상 화면의 select 값으로 기준을 정하거나, 서울 전체 통계와 현재 필터된 통계를 비교
    const officeFilter = document.getElementById('stat-office-filter').value;
    const policeFilter = document.getElementById('stat-police-filter').value;
    
    // 전체 통계(Base) 계산
    let baseIntersections = window.sigmaData.intersections || [];
    let baseStats = calculateStats(baseIntersections);
    
    // 현재 필터된 통계(Target) 계산
    let targetIntersections = window.filteredIntersections || baseIntersections;
    let targetStats = calculateStats(targetIntersections);
    
    const targetName = (officeFilter === 'ALL' && policeFilter === 'ALL') ? '현재 필터 상태' : \`\${officeFilter !== 'ALL' ? officeFilter : ''} \${policeFilter !== 'ALL' ? policeFilter : ''}\`.trim();
    
    try {
        const response = await fetch('/api/ai/report', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                baseName: '서울시 전체',
                targetName: targetName,
                baseStats: baseStats,
                targetStats: targetStats
            })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            content.innerHTML = \`<div style="color:#ef5350;">오류 발생: \${data.error || '알 수 없는 오류'}</div>\`;
            return;
        }
        
        // Markdown 볼드 처리 등 간단한 파싱
        let formattedText = data.report.replace(/\\*\\*(.*?)\\*\\*/g, '<strong style="color:#ffb74d;">$1</strong>');
        formattedText = formattedText.replace(/^## (.*)/gm, '<h3 style="color:#90caf9; margin-top:15px; margin-bottom:5px;">$1</h3>');
        formattedText = formattedText.replace(/^### (.*)/gm, '<h4 style="color:#81d4fa; margin-top:15px; margin-bottom:5px;">$1</h4>');
        formattedText = formattedText.replace(/^\\* (.*)/gm, '<li style="margin-left: 20px;">$1</li>');
        
        content.innerHTML = formattedText;
        
    } catch (err) {
        content.innerHTML = \`<div style="color:#ef5350;">서버 통신 실패: \${err.message}</div>\`;
    }
}

// 헬퍼: 통계 계산 (data.js 기존 로직을 축약)
function calculateStats(inters) {
    if (!inters || inters.length === 0) return { total: 0 };
    
    let cycles = [], maxCycle = 0, coordCount = 0;
    let pplt = 0, diag = 0, pLeft = 0;
    
    inters.forEach(j => {
        if (!j.dayPlans) return;
        let c = j.dayPlans[0]?.[0]?.cycle || 0;
        if (c > 0) {
            cycles.push(c);
            if (c > maxCycle) maxCycle = c;
        }
        if (j.dayPlans[0]?.[0]?.offset > 0) coordCount++;
        // 간단한 플래그 계산 (실제 데이터 구조에 맞게)
        if (j.isPPLT) pplt++;
        if (j.isDiag) diag++;
        if (j.isPLeft) pLeft++;
    });
    
    let avgCycle = cycles.length ? (cycles.reduce((a,b)=>a+b,0)/cycles.length).toFixed(1) : 0;
    
    return {
        total_intersections: inters.length,
        coordinated_intersections: coordCount,
        avg_cycle: avgCycle,
        max_cycle: maxCycle,
        protected_left: pLeft,
        pplt: pplt,
        diagonal_crosswalk: diag
    };
}
`;

if (!dataJs.includes('function generateAIReport')) {
    fs.writeFileSync('SIGMA_SIM/js/data.js', dataJs + '\n' + aiFunc, 'utf8');
    console.log('data.js updated');
}

