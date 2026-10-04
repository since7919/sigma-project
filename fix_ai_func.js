const fs = require('fs');

let dataJs = fs.readFileSync('SIGMA_SIM/js/data.js', 'utf8');

const regex = /async function generateAIReport\(\) \{[\s\S]*?\n\}/;

const newFunc = `async function generateAIReport() {
    const box = document.getElementById('ai-report-box');
    const content = document.getElementById('ai-report-content');
    
    // UI 표시
    box.style.display = 'block';
    content.innerHTML = '<div style="text-align:center; padding: 20px; color:#aaa;">✨ 구글 Gemini AI가 통계 데이터를 분석하고 있습니다... (약 5~10초 소요) ⏳</div>';
    
    const officeFilter = document.getElementById('stat-office-filter')?.value || 'ALL';
    const policeFilter = document.getElementById('stat-police-filter')?.value || 'ALL';
    
    // 1. Base 데이터 (전체)
    let baseIntersections = Object.values(STATE.junctions || {});
    let baseStats = calculateStats(baseIntersections);
    
    // 2. Target 데이터 (필터 적용)
    let targetIntersections = baseIntersections;
    if (officeFilter !== 'ALL') {
        targetIntersections = targetIntersections.filter(j => (j.office || "").trim() === officeFilter);
    }
    if (policeFilter !== 'ALL') {
        targetIntersections = targetIntersections.filter(j => (j.police || "").trim() === policeFilter);
    }
    let targetStats = calculateStats(targetIntersections);
    
    const targetName = (officeFilter === 'ALL' && policeFilter === 'ALL') ? '현재 필터 상태(전체)' : \`\${officeFilter !== 'ALL' ? officeFilter : ''} \${policeFilter !== 'ALL' ? policeFilter : ''}\`.trim();
    
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
            content.innerHTML = \`<div style="color:#ef5350; font-weight:bold; padding: 10px;">\${data.error || '알 수 없는 오류'}</div>\`;
            return;
        }
        
        // Markdown 파싱
        let formattedText = data.report.replace(/\\*\\*(.*?)\\*\\*/g, '<strong style="color:#ffb74d;">$1</strong>');
        formattedText = formattedText.replace(/^## (.*)/gm, '<h3 style="color:#90caf9; margin-top:15px; margin-bottom:5px;">$1</h3>');
        formattedText = formattedText.replace(/^### (.*)/gm, '<h4 style="color:#81d4fa; margin-top:15px; margin-bottom:5px;">$1</h4>');
        formattedText = formattedText.replace(/^\\* (.*)/gm, '<li style="margin-left: 20px;">$1</li>');
        
        content.innerHTML = formattedText;
        
    } catch (err) {
        content.innerHTML = \`<div style="color:#ef5350; font-weight:bold; padding: 10px;">서버 통신 실패: \${err.message}</div>\`;
    }
}`;

if (dataJs.match(regex)) {
    dataJs = dataJs.replace(regex, newFunc);
    fs.writeFileSync('SIGMA_SIM/js/data.js', dataJs, 'utf8');
    console.log('Fixed generateAIReport in data.js');
} else {
    console.log('Regex not matched');
}
