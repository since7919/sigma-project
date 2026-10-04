const fs = require('fs');

// 1. Update index.html
let html = fs.readFileSync('SIGMA_SIM/index.html', 'utf8');

const oldAiBox = /<div id="ai-report-box"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/; // Matches the AI box I added earlier

const newAiBox = `
                        <!-- [신규] AI 리포트 출력 및 설정 박스 -->
                        <div id="ai-report-box" class="sigma-panel mb-20" style="display:none; background: rgba(10, 25, 41, 0.9); border: 1px solid #1e4976; padding: 20px; border-radius: 8px; font-size: 13px; line-height: 1.6; color: #e0e0e0; box-shadow: 0 4px 20px rgba(0,0,0,0.6);">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom:15px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 10px;">
                                <div style="font-weight:bold; font-size:15px; color:#64b5f6;">🤖 SIGMA AI 비교 분석 리포트</div>
                                <button onclick="document.getElementById('ai-report-box').style.display='none'" style="background:none; border:none; color:#999; cursor:pointer; font-size:16px;">&times;</button>
                            </div>
                            
                            <!-- 설정 영역 -->
                            <div id="ai-report-setup" style="padding: 10px 0;">
                                <div style="margin-bottom: 15px; color: #b0bec5; font-size: 12px;">분석할 두 지역(관리청)을 선택하세요.</div>
                                <div class="flex-row gap-20" style="align-items: center;">
                                    <div style="flex: 1;">
                                        <div class="text-dim fs-11 mb-8">🅰️ 기준 지역 (Base)</div>
                                        <select id="ai-base-select" class="tsd-select" style="width: 100%; height: 32px; background: rgba(0,0,0,0.4); color: #fff; border: 1px solid #64b5f6;">
                                            <option value="ALL">서울시 전체</option>
                                        </select>
                                    </div>
                                    <div style="font-size: 16px; color: #fff; padding-top: 20px;">VS</div>
                                    <div style="flex: 1;">
                                        <div class="text-dim fs-11 mb-8">🅱️ 비교 지역 (Target)</div>
                                        <select id="ai-target-select" class="tsd-select" style="width: 100%; height: 32px; background: rgba(0,0,0,0.4); color: #fff; border: 1px solid #ffb74d;">
                                            <option value="ALL">서울시 전체</option>
                                        </select>
                                    </div>
                                    <div style="padding-top: 20px;">
                                        <button onclick="startAIAnalysis()" style="background: #2b5c8f; border: 1px solid #4a90e2; padding: 6px 16px; height: 32px; border-radius: 4px; font-size: 12px; font-weight: bold; cursor: pointer; color: white;">🚀 분석 시작</button>
                                    </div>
                                </div>
                            </div>

                            <!-- 로딩 및 결과 영역 -->
                            <div id="ai-report-content" style="display:none; white-space: pre-wrap; margin-top: 15px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 15px;"></div>
                        </div>`;

if (html.match(oldAiBox)) {
    html = html.replace(oldAiBox, newAiBox);
    fs.writeFileSync('SIGMA_SIM/index.html', html, 'utf8');
    console.log('index.html patched with new UI.');
} else {
    console.log('Could not find old AI box in index.html to replace.');
    // Let's fallback if regex failed due to whitespace
    const startStr = '<!-- [신규] AI 리포트 출력 박스 -->';
    const endStr = '</div>'; // it's hard to match reliably without AST, let's just do a rough index based replace if regex fails
    const idx1 = html.indexOf(startStr);
    if (idx1 !== -1) {
        const nextDiv = html.indexOf('<!--', idx1 + 10);
        let idx2 = html.lastIndexOf('</div>', nextDiv !== -1 ? nextDiv : html.indexOf('<div class="sigma-panel" style="margin-top: 20px;">', idx1));
        if (idx2 === -1) idx2 = html.indexOf('</div>', html.indexOf('id="ai-report-content"', idx1)) + 6 + 6; // roughly
        html = html.slice(0, idx1) + newAiBox + html.slice(idx2);
        fs.writeFileSync('SIGMA_SIM/index.html', html, 'utf8');
        console.log('index.html patched manually.');
    }
}

// 2. Update data.js
let dataJs = fs.readFileSync('SIGMA_SIM/js/data.js', 'utf8');

const aiFuncRegex = /async function generateAIReport\(\) \{[\s\S]*?\n\}/;
const helperRegex = /function calculateStats\(inters\) \{[\s\S]*?\n\}/;

const newAiScripts = `
// ── [신규] AI 리포트 UI 열기 및 셀렉트 박스 세팅 ──
function generateAIReport() {
    const box = document.getElementById('ai-report-box');
    const setup = document.getElementById('ai-report-setup');
    const content = document.getElementById('ai-report-content');
    
    box.style.display = 'block';
    setup.style.display = 'block';
    content.style.display = 'none';
    
    // 사무소(구청) 목록 추출하여 셀렉트 박스 채우기
    const offices = new Set();
    Object.values(window.STATE?.junctions || {}).forEach(j => {
        if (j.office && j.office.trim() !== '') offices.add(j.office.trim());
    });
    const sortedOffices = Array.from(offices).sort();
    
    const baseSel = document.getElementById('ai-base-select');
    const targetSel = document.getElementById('ai-target-select');
    
    let optionsHtml = '<option value="ALL">서울시 전체</option>';
    sortedOffices.forEach(o => {
        optionsHtml += \`<option value="\${o}">\${o}</option>\`;
    });
    
    baseSel.innerHTML = optionsHtml;
    targetSel.innerHTML = optionsHtml;
}

// ── [신규] 실제 AI 분석 시작 (로딩 애니메이션 및 API 호출) ──
async function startAIAnalysis() {
    const setup = document.getElementById('ai-report-setup');
    const content = document.getElementById('ai-report-content');
    
    const baseVal = document.getElementById('ai-base-select').value;
    const targetVal = document.getElementById('ai-target-select').value;
    
    const baseName = baseVal === 'ALL' ? '서울시 전체' : baseVal;
    const targetName = targetVal === 'ALL' ? '서울시 전체' : targetVal;
    
    setup.style.display = 'none';
    content.style.display = 'block';
    
    // 시각적 로딩 애니메이션 (점진적 진행바 포함)
    content.innerHTML = \`
        <div style="text-align:center; padding: 30px; font-size: 14px; color:#90caf9;">
            <div style="font-size: 24px; margin-bottom: 15px;" class="loading-spinner">🔄</div>
            <strong style="color: #fff; font-size: 16px;">\${baseName}</strong>와(과) <strong style="color: #fff; font-size: 16px;">\${targetName}</strong>의 통계를 비교분석 중입니다...<br/>
            <div style="margin-top: 15px; width: 100%; background: rgba(0,0,0,0.5); border-radius: 4px; height: 6px; overflow: hidden;">
                <div id="ai-progress-bar" style="width: 0%; height: 100%; background: #64b5f6; transition: width 0.5s ease;"></div>
            </div>
            <div style="margin-top: 10px; font-size: 11px; color: #78909c;" id="ai-loading-text">데이터 준비 중...</div>
        </div>
        <style>
            @keyframes spin { 100% { transform: rotate(360deg); } }
            .loading-spinner { display: inline-block; animation: spin 1.5s linear infinite; }
        </style>
    \`;
    
    let progress = 0;
    const pBar = document.getElementById('ai-progress-bar');
    const pText = document.getElementById('ai-loading-text');
    
    const progressInterval = setInterval(() => {
        progress += Math.random() * 15;
        if (progress > 90) progress = 90; // API 완료 전까지는 90%에서 대기
        if (pBar) pBar.style.width = progress + '%';
        
        if (progress > 20 && progress <= 50) pText.innerText = "전문가 분석 프롬프트 주입 중...";
        if (progress > 50 && progress <= 80) pText.innerText = "거시적/미시적 특성 도출 중...";
        if (progress > 80) pText.innerText = "정책 제언 및 시사점 요약 중...";
    }, 800);
    
    // 데이터 집계
    let allIntersections = Object.values(window.STATE?.junctions || {});
    
    let baseIntersections = baseVal === 'ALL' ? allIntersections : allIntersections.filter(j => (j.office || "").trim() === baseVal);
    let targetIntersections = targetVal === 'ALL' ? allIntersections : allIntersections.filter(j => (j.office || "").trim() === targetVal);
    
    let baseStats = calculateStats(baseIntersections);
    let targetStats = calculateStats(targetIntersections);
    
    try {
        const response = await fetch('/api/ai/report', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                baseName: baseName,
                targetName: targetName,
                baseStats: baseStats,
                targetStats: targetStats
            })
        });
        
        clearInterval(progressInterval);
        if (pBar) pBar.style.width = '100%';
        if (pText) pText.innerText = "분석 완료!";
        
        const data = await response.json();
        
        if (!response.ok) {
            content.innerHTML = \`<div style="color:#ef5350; font-weight:bold; padding: 10px; text-align:center;">\${data.error || '알 수 없는 오류'}</div>
            <div style="text-align:center; margin-top:10px;"><button onclick="document.getElementById('ai-report-setup').style.display='block'; document.getElementById('ai-report-content').style.display='none';" class="action-btn">다시 시도</button></div>\`;
            return;
        }
        
        // 렌더링 지연 (애니메이션이 100% 차는 것을 보여주기 위함)
        setTimeout(() => {
            let formattedText = data.report.replace(/\\*\\*(.*?)\\*\\*/g, '<strong style="color:#ffb74d;">$1</strong>');
            formattedText = formattedText.replace(/^## (.*)/gm, '<h3 style="color:#90caf9; margin-top:15px; margin-bottom:5px; border-bottom: 1px solid rgba(144, 202, 249, 0.2); padding-bottom: 5px;">$1</h3>');
            formattedText = formattedText.replace(/^### (.*)/gm, '<h4 style="color:#81d4fa; margin-top:15px; margin-bottom:5px;">$1</h4>');
            formattedText = formattedText.replace(/^\\* (.*)/gm, '<li style="margin-left: 20px; margin-bottom: 4px;">$1</li>');
            formattedText = formattedText.replace(/^\\d+\\. (.*)/gm, '<div style="font-size: 15px; font-weight: bold; color: #bbdefb; margin-top: 20px; margin-bottom: 8px;">$&</div>');
            
            content.innerHTML = \`
                <div style="text-align: right; margin-bottom: 10px;">
                    <button onclick="generateAIReport()" style="background: none; border: 1px solid #4a90e2; color: #4a90e2; padding: 4px 10px; border-radius: 4px; font-size: 11px; cursor: pointer;">🔄 다시 분석하기</button>
                </div>
                \${formattedText}
            \`;
        }, 500);
        
    } catch (err) {
        clearInterval(progressInterval);
        content.innerHTML = \`<div style="color:#ef5350; font-weight:bold; padding: 10px; text-align:center;">서버 통신 실패: \${err.message}</div>
        <div style="text-align:center; margin-top:10px;"><button onclick="document.getElementById('ai-report-setup').style.display='block'; document.getElementById('ai-report-content').style.display='none';" class="action-btn">다시 시도</button></div>\`;
    }
}
`;

// Remove the old generateAIReport and calculateStats
let cleanedDataJs = dataJs.replace(aiFuncRegex, '').replace(helperRegex, '');
cleanedDataJs += '\n' + newAiScripts + '\n' + `
// 헬퍼: 통계 계산
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
        if (j.isPPLT) pplt++;
        if (j.isDiag) diag++;
        if (j.isPLeft) pLeft++;
    });
    
    let avgCycle = cycles.length ? (cycles.reduce((a,b)=>a+b,0)/cycles.length).toFixed(1) : 0;
    
    return {
        total_intersections: inters.length,
        coordinated_intersections: coordCount,
        coord_rate_percent: ((coordCount / inters.length) * 100).toFixed(1) + '%',
        avg_cycle: parseFloat(avgCycle),
        max_cycle: maxCycle,
        protected_left: pLeft,
        pplt: pplt,
        diagonal_crosswalk: diag
    };
}`;

fs.writeFileSync('SIGMA_SIM/js/data.js', cleanedDataJs, 'utf8');
console.log('data.js updated with advanced UI and loading state.');
