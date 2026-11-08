/**
 * ai_report.js - SIGMA 교통운영 AI 비교분석 리포트 생성 및 인쇄 모듈
 * ─────────────────────────────────────────────────────────────
 * 역할:
 * 1. 구청/경찰서별 통계 비교분석 프롬프트 구성 및 LLM 비동기 호출
 * 2. 실시간 프로그레스 바 및 Mermaid 차트 정규화 렌더링
 * 3. 분석 결과 PDF 인쇄 팝업 창 생성
 */

// ── [신규] AI 리포트 UI 열기 및 셀렉트 박스 세팅 ──
function generateAIReport() {
    const box = document.getElementById('ai-report-box');
    const setup = document.getElementById('ai-report-setup');
    const content = document.getElementById('ai-report-content');
    if (!box || !setup || !content) return;
    
    box.style.display = 'block';
    setup.style.display = 'block';
    content.style.display = 'none';
    
    const offices = new Set();
    const polices = new Set();
    Object.values(STATE.junctions || {}).forEach(j => {
        if (j.office && j.office.trim() !== '') offices.add(j.office.trim());
        if (j.police && j.police.trim() !== '') polices.add(j.police.trim());
    });
    const sortedOffices = Array.from(offices).sort();
    const sortedPolices = Array.from(polices).sort();
    
    const baseSel = document.getElementById('ai-base-select');
    const targetSel = document.getElementById('ai-target-select');
    if (!baseSel || !targetSel) return;
    
    let optionsHtml = '<option value="ALL">서울시 전체</option>';
    
    optionsHtml += '<optgroup label="구청(District)">';
    sortedOffices.forEach(o => { optionsHtml += `<option value="office|${o}">[구청] ${o}</option>`; });
    optionsHtml += '</optgroup>';
    
    optionsHtml += '<optgroup label="경찰서(Police)">';
    sortedPolices.forEach(p => { optionsHtml += `<option value="police|${p}">[경찰서] ${p}</option>`; });
    optionsHtml += '</optgroup>';
    
    baseSel.innerHTML = optionsHtml;
    targetSel.innerHTML = optionsHtml;
}

async function startAIAnalysis() {
    const setup = document.getElementById('ai-report-setup');
    const content = document.getElementById('ai-report-content');
    if (!setup || !content) return;
    
    const baseVal = document.getElementById('ai-base-select')?.value || 'ALL';
    const targetVal = document.getElementById('ai-target-select')?.value || 'ALL';
    
    const getLabel = (val) => {
        if (val === 'ALL') return '서울시 전체';
        const parts = val.split('|');
        return parts.length === 2 ? parts[1] : val;
    };
    
    const baseName = getLabel(baseVal);
    const targetName = getLabel(targetVal);
    
    setup.style.display = 'none';
    content.style.display = 'block';
    
    content.innerHTML = `
        <div style="text-align:center; padding: 30px; font-size: 14px; color:#90caf9;">
            <div style="font-size: 24px; margin-bottom: 15px;" class="loading-spinner">🔄</div>
            <strong style="color: #fff; font-size: 16px;">${baseName}</strong>와(과) <strong style="color: #fff; font-size: 16px;">${targetName}</strong>의 통계를 비교분석 중입니다...<br/><div style="margin-top: 12px;"><span style="background: rgba(156, 39, 176, 0.2); border: 1px solid #9c27b0; color: #e1bee7; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: bold;">⚡ Groq GPT-OSS 120B 작동 중</span></div>
            <div style="margin-top: 15px; width: 100%; background: rgba(0,0,0,0.5); border-radius: 4px; height: 6px; overflow: hidden;">
                <div id="ai-progress-bar" style="width: 0%; height: 100%; background: #64b5f6; transition: width 0.5s ease;"></div>
            </div>
            <div style="margin-top: 10px; font-size: 11px; color: #78909c;" id="ai-loading-text">데이터 준비 중...</div>
        </div>
        <style>
            @keyframes spin { 100% { transform: rotate(360deg); } }
            .loading-spinner { display: inline-block; animation: spin 1.5s linear infinite; }
        </style>
    `;
    
    let progress = 0;
    const pBar = document.getElementById('ai-progress-bar');
    const pText = document.getElementById('ai-loading-text');
    
    const progressInterval = setInterval(() => {
        progress += Math.random() * 15;
        if (progress > 90) progress = 90;
        if (pBar) pBar.style.width = progress + '%';
        
        if (progress > 20 && progress <= 50 && pText) pText.innerText = "전문가 분석 프롬프트 주입 중...";
        if (progress > 50 && progress <= 80 && pText) pText.innerText = "거시적/미시적 특성 도출 중...";
        if (progress > 80 && pText) pText.innerText = "데이터 기반 객관적 요약 중...";
    }, 800);
    
    let allIntersections = Object.values(STATE.junctions || {});
    
    const filterIntersections = (val) => {
        if (val === 'ALL') return allIntersections;
        const [type, name] = val.split('|');
        if (type === 'office') return allIntersections.filter(j => (j.office || "").trim() === name);
        if (type === 'police') return allIntersections.filter(j => (j.police || "").trim() === name);
        return allIntersections;
    };
    
    let baseIntersections = filterIntersections(baseVal);
    let targetIntersections = filterIntersections(targetVal);
    
    // UI의 시간대 필터를 동일하게 적용하기 위해 window.STAT_VALID_HOURS 상태를 가져옴
    const timeFilter = document.getElementById('stat-time-filter')?.value || 'ALL';
    if (timeFilter === 'ALL') window.STAT_VALID_HOURS = [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23];
    else if (timeFilter === 'AM_PEAK') window.STAT_VALID_HOURS = [7, 8, 9];
    else if (timeFilter === 'PM_PEAK') window.STAT_VALID_HOURS = [17, 18];
    else if (timeFilter === 'NORMAL') window.STAT_VALID_HOURS = [9, 10, 11, 12, 13, 14, 15, 16];
    else if (timeFilter === 'NIGHT') window.STAT_VALID_HOURS = [20, 21, 22, 23, 0, 1, 2, 3, 4, 5];
    else window.STAT_VALID_HOURS = [parseInt(timeFilter)];

    let baseStats = calculateStats(baseIntersections);
    let targetStats = calculateStats(targetIntersections);
    
    try {
        if (typeof recordAIRequest === 'function') recordAIRequest();
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
        
        let data = {};
        try {
            data = await response.json();
        } catch(e) {
            data = { error: '서버가 올바른 JSON을 반환하지 않았습니다 (500 Error)' };
        }
        
        if (!response.ok || !data || !data.report) {
            content.innerHTML = `<div style="color:#ef5350; font-weight:bold; padding: 10px; text-align:center;">${(data && data.error) || '알수없는 오류 또는 빈 응답'}</div>
            <div style="text-align:center; margin-top:10px;"><button onclick="startAIAnalysis()" class="action-btn">다시 시도</button></div>`;
            return;
        }

        setTimeout(() => {
            // --- AI Mermaid Hallucination Cleanup ---
            if (data.report) {
                data.report = data.report.replace(/<br\s*\/?>/gi, '\n');
                data.report = data.report.replace(/xychart-betatitle/g, 'xychart-beta\ntitle');
                data.report = data.report.replace(/xychart-beta\s*title/g, 'xychart-beta\ntitle');
                data.report = data.report.replace(/\s+x-axis/g, '\nx-axis');
                data.report = data.report.replace(/\)\s*x-axis/g, ')\nx-axis');
                data.report = data.report.replace(/\]\s*y-axis/g, ']\ny-axis');
                data.report = data.report.replace(/\]\s*bar/g, ']\nbar');
                data.report = data.report.replace(/\]\s*line/g, ']\nline');
                
                data.report = data.report.replace(/(bar|line)\s*\[\s*"[^"]*"\s*,\s*/g, '$1 [');
                data.report = data.report.replace(/(bar|line)\s*\[\s*'[^']*'\s*,\s*/g, '$1 [');
            }
            
            let formattedText = typeof marked !== 'undefined' ? marked.parse(data.report) : data.report;
            const unescapeHtml = (text) => text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
            
            const enforceMermaidNewlines = (code) => {
                let s = code;
                s = s.replace(/<br\s*\/?>/gi, '\n');
                s = s.replace(/&nbsp;/gi, ' ');
                s = s.replace(/\s+/g, ' ');
                s = s.replace(/xychart-beta/gi, 'xychart-beta\n');
                
                s = s.replace(/\s*title\s+(?:"([^"]*)"|([^\[\n\r]+?))(?=\s*(?:x-axis|y-axis|bar|line|$))/gi, (m, p1, p2) => {
                    let t = (p1 || p2 || '').trim().replace(/^["']+|["']+$/g, '');
                    return '\ntitle "' + t + '"\n';
                });
                
                s = s.replace(/\s*x-axis\s*/gi, '\nx-axis ');
                s = s.replace(/\s*y-axis\s*/gi, '\ny-axis ');
                s = s.replace(/\s*bar\s*/gi, '\nbar ');
                s = s.replace(/\s*line\s*/gi, '\nline ');
                s = s.replace(/(bar|line)\s*\[\s*(?:"[^"]*"|'[^']*')\s*,\s*/gi, '$1 [');
                s = s.replace(/\n\s*\n/g, '\n');
                return s.trim();
            };

            formattedText = formattedText.replace(/<pre><code class="language-mermaid">([\s\S]*?)<\/code><\/pre>/g, (match, p1) => {
                let codeText = unescapeHtml(p1).trim();
                codeText = enforceMermaidNewlines(codeText);
                return '<pre class="mermaid">\n' + codeText + '\n</pre>';
            });
            formattedText = formattedText.replace(/<pre><code>\s*(xychart-beta|xychart|pie|graph|sequenceDiagram|gantt|classDiagram)([\s\S]*?)<\/code><\/pre>/g, (match, p1, p2) => {
                let codeText = unescapeHtml(p1 + " " + p2).trim();
                codeText = enforceMermaidNewlines(codeText);
                return '<pre class="mermaid">\n' + codeText + '\n</pre>';
            });
            formattedText = `<div class="ai-report-markdown">${formattedText}</div>`;
            window.__lastAIReportHTML = formattedText;
            window.__lastAIReportTitle = `${baseName} vs ${targetName} 교통운영 통계 분석 리포트`;
            
            content.innerHTML = `
                <div style="display: flex; justify-content: flex-end; gap: 10px; margin-bottom: 15px;">
                    <button onclick="printAIReport()" style="background: rgba(255,183,77,0.1); border: 1px solid #ffb74d; color: #ffb74d; padding: 4px 12px; border-radius: 4px; font-size: 11px; cursor: pointer; display: flex; align-items: center; gap: 4px;">🖨️ PDF 출력</button>
                    <button onclick="generateAIReport()" style="background: none; border: 1px solid #4a90e2; color: #4a90e2; padding: 4px 12px; border-radius: 4px; font-size: 11px; cursor: pointer; display: flex; align-items: center; gap: 4px;">🔄 다시 분석하기</button>
                </div>
                ${formattedText}
            `;
            
            setTimeout(() => {
                if (typeof mermaid !== 'undefined') {
                    try {
                        document.querySelectorAll('.mermaid').forEach(el => {
                            el.textContent = enforceMermaidNewlines(el.textContent);
                        });
                        mermaid.run({ querySelector: '.mermaid' }); 
                    } catch(e) { console.error('Mermaid error', e); }
                }
            }, 100);
        }, 500);
        
    } catch (err) {
        clearInterval(progressInterval);
        content.innerHTML = `<div style="color:#ef5350; font-weight:bold; padding: 10px; text-align:center;">서버 통신 실패: ${err.message}</div>
        <div style="text-align:center; margin-top:10px;"><button onclick="startAIAnalysis()" class="action-btn">다시 시도</button></div>`;
    }
}

function calculateStats(inters) {
    if (typeof renderAdvancedInsights === 'function') {
        const stats = renderAdvancedInsights(inters, true);
        if (stats) return stats;
    }
    return { error: "Stats engine unavailable" };
}

function printAIReport() {
    if (!window.__lastAIReportHTML) {
        alert('리포트 데이터가 없습니다. 먼저 분석을 진행해주세요.');
        return;
    }
    
    const printWindow = window.open('', '_blank', 'width=850,height=900');
    if (!printWindow) {
        alert('팝업이 차단되었습니다. 브라우저 설정에서 팝업을 허용해주세요.');
        return;
    }
    
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>${window.__lastAIReportTitle || 'SIGMA 교통운영 분석 리포트'}</title>
            <meta charset="utf-8">
            <style>
                body { font-family: 'Pretendard', sans-serif; padding: 40px; color: #333; line-height: 1.6; }
                h1, h2, h3 { color: #1e3a8a; }
                table { border-collapse: collapse; width: 100%; margin: 20px 0; }
                th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
                th { background-color: #f1f5f9; }
                pre { background: #f8fafc; padding: 15px; border-radius: 6px; overflow-x: auto; }
                @media print {
                    button { display: none; }
                }
            </style>
        </head>
        <body>
            <button onclick="window.print()" style="position:fixed; top:20px; right:20px; padding:10px 20px; background:#0284c7; color:#fff; border:none; border-radius:6px; font-weight:bold; cursor:pointer;">인쇄하기 / PDF 저장</button>
            <h1>${window.__lastAIReportTitle || 'SIGMA 교통운영 분석 리포트'}</h1>
            <p style="color:#64748b; font-size:12px;">발행일시: ${new Date().toLocaleString()}</p>
            <hr style="margin:20px 0; border:none; border-top:1px solid #cbd5e1;"/>
            ${window.__lastAIReportHTML}
        </body>
        </html>
    `);
    printWindow.document.close();
}
