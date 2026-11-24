/**
 * ai_report.js - SIGMA 교통운영 AI 분석 리포트 모듈 (지역비교 & 단일그룹 심층연동분석)
 * ─────────────────────────────────────────────────────────────
 * 역할:
 * 1. 지역/지자체 비교분석 (A vs B)
 * 2. 단일 그룹 심층 연동분석 (연동구간 개요, 위치도 SVG, 신호현시, 그룹TOD, 시공도 TSD 고해상도 캔버스, 종합 교통공학 진단)
 * 3. 분석 결과 PDF 인쇄 팝업 창 생성
 */

// ── 0. 모드 전환 (지역비교 vs 그룹분석) ──
function switchAIReportMode(mode) {
    const btnCompare = document.getElementById('btn-report-mode-compare');
    const btnGroup = document.getElementById('btn-report-mode-group');
    const panelCompare = document.getElementById('ai-mode-compare-panel');
    const panelGroup = document.getElementById('ai-mode-group-panel');

    if (mode === 'group') {
        if (btnCompare) {
            btnCompare.style.background = 'rgba(255,255,255,0.05)';
            btnCompare.style.borderColor = 'rgba(255,255,255,0.2)';
            btnCompare.style.color = '#aaa';
        }
        if (btnGroup) {
            btnGroup.style.background = 'rgba(0, 212, 255, 0.2)';
            btnGroup.style.borderColor = '#00d4ff';
            btnGroup.style.color = '#00d4ff';
        }
        if (panelCompare) panelCompare.style.display = 'none';
        if (panelGroup) panelGroup.style.display = 'block';
        populateGroupSingleSelect();
    } else {
        if (btnCompare) {
            btnCompare.style.background = 'rgba(100, 181, 246, 0.2)';
            btnCompare.style.borderColor = '#64b5f6';
            btnCompare.style.color = '#64b5f6';
        }
        if (btnGroup) {
            btnGroup.style.background = 'rgba(255,255,255,0.05)';
            btnGroup.style.borderColor = 'rgba(255,255,255,0.2)';
            btnGroup.style.color = '#aaa';
        }
        if (panelCompare) panelCompare.style.display = 'block';
        if (panelGroup) panelGroup.style.display = 'none';
    }
}
window.switchAIReportMode = switchAIReportMode;

// ── [신규] 단일 그룹 선택 드롭다운 채우기 ──
function populateGroupSingleSelect() {
    const sel = document.getElementById('ai-group-single-select');
    if (!sel) return;

    const groups = new Map();
    Object.values(STATE.junctions || {}).forEach(j => {
        const gid = (j.group !== undefined && j.group !== null) ? String(j.group).trim() : '';
        if (gid !== '' && gid !== '0' && gid !== '-1') {
            if (!groups.has(gid)) {
                let gName = (STATE.groups && STATE.groups[gid] && STATE.groups[gid].name) 
                    ? STATE.groups[gid].name 
                    : `그룹 ${gid}`;
                groups.set(gid, { gid, name: gName, count: 0 });
            }
            groups.get(gid).count++;
        }
    });

    const sortedGroups = Array.from(groups.values()).sort((a, b) => {
        const numA = parseInt(a.gid, 10);
        const numB = parseInt(b.gid, 10);
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
        return a.gid.localeCompare(b.gid);
    });

    let html = '<option value="">분석할 연동 그룹을 선택하세요...</option>';
    sortedGroups.forEach(g => {
        const title = (g.name && g.name !== `그룹 ${g.gid}`) ? `그룹 ${g.gid} (${g.name})` : `그룹 ${g.gid}`;
        html += `<option value="${g.gid}">[그룹 ${g.gid}] ${title} - ${g.count}개 교차로</option>`;
    });
    sel.innerHTML = html;

    // 만약 현재 전역 선택된 그룹이 있다면 자동 선택
    if (typeof currentEditingGroup !== 'undefined' && currentEditingGroup && groups.has(String(currentEditingGroup))) {
        sel.value = String(currentEditingGroup);
    }
}
window.populateGroupSingleSelect = populateGroupSingleSelect;

function onAIGroupSelectChange() {
    // 필요 시 추가 연동 로직
}
window.onAIGroupSelectChange = onAIGroupSelectChange;

// ── AI 리포트 UI 열기 및 셀렉트 박스 세팅 ──
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
    const groups = new Map();

    Object.values(STATE.junctions || {}).forEach(j => {
        if (j.office && j.office.trim() !== '') offices.add(j.office.trim());
        if (j.police && j.police.trim() !== '') polices.add(j.police.trim());
        
        const gid = (j.group !== undefined && j.group !== null) ? String(j.group).trim() : '';
        if (gid !== '' && gid !== '0' && gid !== '-1') {
            if (!groups.has(gid)) {
                let gName = (STATE.groups && STATE.groups[gid] && STATE.groups[gid].name) 
                    ? STATE.groups[gid].name 
                    : `그룹 ${gid}`;
                groups.set(gid, { gid, name: gName, count: 0 });
            }
            groups.get(gid).count++;
        }
    });
    const sortedOffices = Array.from(offices).sort();
    const sortedPolices = Array.from(polices).sort();
    const sortedGroups = Array.from(groups.values()).sort((a, b) => {
        const numA = parseInt(a.gid, 10);
        const numB = parseInt(b.gid, 10);
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
        return a.gid.localeCompare(b.gid);
    });
    
    const baseSel = document.getElementById('ai-base-select');
    const targetSel = document.getElementById('ai-target-select');
    if (baseSel && targetSel) {
        const curReg = (typeof window !== 'undefined' && window.CURRENT_REGION_CODE) || 'L01';
        const curRegName = (window.REGION_MAP && window.REGION_MAP[curReg]) || (curReg === 'L02' ? '인천시' : '서울시');
        let optionsHtml = `<option value="ALL">${curRegName} 전체</option>`;

        optionsHtml += '<optgroup label="구청(District)">';
        sortedOffices.forEach(o => { optionsHtml += `<option value="office|${o}">[구청] ${o}</option>`; });
        optionsHtml += '</optgroup>';
        
        optionsHtml += '<optgroup label="경찰서(Police)">';
        sortedPolices.forEach(p => { optionsHtml += `<option value="police|${p}">[경찰서] ${p}</option>`; });
        optionsHtml += '</optgroup>';
        
        baseSel.innerHTML = optionsHtml;
        targetSel.innerHTML = optionsHtml;
    }

    populateGroupSingleSelect();
}
window.generateAIReport = generateAIReport;

// ── [기능 1] 지역/대상 비교분석 실행 (A vs B) ──
async function startAIAnalysis() {
    const setup = document.getElementById('ai-report-setup');
    const content = document.getElementById('ai-report-content');
    if (!setup || !content) return;
    
    const baseVal = document.getElementById('ai-base-select')?.value || 'ALL';
    const targetVal = document.getElementById('ai-target-select')?.value || 'ALL';
    
    const curReg = (typeof window !== 'undefined' && window.CURRENT_REGION_CODE) || 'L01';
    const curRegName = (window.REGION_MAP && window.REGION_MAP[curReg]) || (curReg === 'L02' ? '인천시' : '서울시');
    const getLabel = (val) => {
        if (val === 'ALL') return `${curRegName} 전체`;
        const parts = val.split('|');
        if (parts.length === 2) {
            const [type, key] = parts;
            if (type === 'group') {
                const gObj = STATE.groups && STATE.groups[key];
                const gName = (gObj && gObj.name && gObj.name !== `그룹 ${key}`) ? `그룹 ${key}(${gObj.name})` : `그룹 ${key}`;
                return gName;
            }
            return parts[1];
        }
        return val;
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
        if (type === 'group') return allIntersections.filter(j => String(j.group || "").trim() === String(name).trim());
        return allIntersections;
    };
    
    let baseIntersections = filterIntersections(baseVal);
    let targetIntersections = filterIntersections(targetVal);
    
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
        if (typeof window.recordAIRequest === 'function') window.recordAIRequest();
        const response = await fetch('/api/ai/report', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ baseName, targetName, baseStats, targetStats })
        });
        
        clearInterval(progressInterval);
        if (pBar) pBar.style.width = '100%';
        if (pText) pText.innerText = "분석 완료!";
        
        let data = {};
        try { data = await response.json(); } catch(e) { data = { error: '서버가 올바른 JSON을 반환하지 않았습니다' }; }

        if (!response.ok || !data || !data.report) {
            content.innerHTML = `<div style="color:#ef5350; font-weight:bold; padding: 10px; text-align:center;">${(data && data.error) || '알수없는 오류 또는 빈 응답'}</div>
            <div style="text-align:center; margin-top:10px;"><button onclick="startAIAnalysis()" class="action-btn">다시 시도</button></div>`;
            return;
        }

        renderAIReportMarkdown(data.report, `${baseName} vs ${targetName} 교통운영 통계 분석 리포트`);
    } catch (err) {
        clearInterval(progressInterval);
        content.innerHTML = `<div style="color:#ef5350; font-weight:bold; padding: 10px; text-align:center;">서버 통신 실패: ${err.message}</div>
        <div style="text-align:center; margin-top:10px;"><button onclick="startAIAnalysis()" class="action-btn">다시 시도</button></div>`;
    }
}
window.startAIAnalysis = startAIAnalysis;

// ── [기능 2] 단일 그룹 심층 연동분석 실행 (위치도 + 시공도 + 현시 + TOD + AI) ──
async function startAIGroupAnalysis() {
    const setup = document.getElementById('ai-report-setup');
    const content = document.getElementById('ai-report-content');
    if (!setup || !content) return;

    const gid = document.getElementById('ai-group-single-select')?.value;
    if (!gid) {
        alert("분석할 연동 그룹을 선택해주세요.");
        return;
    }

    const dayIdx = parseInt(document.getElementById('ai-group-day-select')?.value || '0', 10);
    const timeSlotIdx = parseInt(document.getElementById('ai-group-time-select')?.value || '0', 10);

    const group = STATE.groups && STATE.groups[gid];
    const gName = (group && group.name && group.name !== `그룹 ${gid}`) ? group.name : `그룹 ${gid}`;

    setup.style.display = 'none';
    content.style.display = 'block';

    content.innerHTML = `
        <div style="text-align:center; padding: 35px; font-size: 14px; color:#90caf9;">
            <div style="font-size: 26px; margin-bottom: 15px;" class="loading-spinner">🔄</div>
            <strong style="color: #00d4ff; font-size: 17px;">[${gName}]</strong> 연동구간 심층 분석 보고서를 작성 중입니다...<br/>
            <div style="margin-top: 10px; color:#cbd5e1; font-size: 12px;">위치도 좌표 계산, 신호현시 분할표, 시공도(TSD) 렌더링 및 AI 교통공학 진단 수행 중</div>
            <div style="margin-top: 18px; width: 100%; background: rgba(0,0,0,0.5); border-radius: 4px; height: 6px; overflow: hidden;">
                <div id="ai-group-progress-bar" style="width: 15%; height: 100%; background: linear-gradient(90deg, #00d4ff, #ff00ff); transition: width 0.4s ease;"></div>
            </div>
            <div style="margin-top: 10px; font-size: 11px; color: #78909c;" id="ai-group-loading-text">연동구간 네트워크 및 교차로 추출 중...</div>
        </div>
    `;

    const pBar = document.getElementById('ai-group-progress-bar');
    const pText = document.getElementById('ai-group-loading-text');

    try {
        if (pBar) pBar.style.width = '30%';
        if (pText) pText.innerText = '교차로 좌표 및 연동구간 위치도(SVG) 구성 중...';

        // 1. 소속 교차로 및 거리, 순서 정렬
        let members = Object.values(STATE.junctions).filter(j => String(j.group) === String(gid));
        if (members.length < 2) {
            throw new Error(`그룹 ${gid}에 속한 교차로가 ${members.length}개소입니다. 연동 분석을 위해 최소 2개소 이상의 교차로가 필요합니다.`);
        }

        // TSD 정렬 및 거리 계산
        const tsdResult = renderOfflineTSDImage(gid, dayIdx, timeSlotIdx);
        if (!tsdResult) {
            throw new Error('시공도 및 교차로 순서 데이터를 계산하지 못했습니다.');
        }

        const sortedMembers = tsdResult.members;
        const totalDistM = Math.round(tsdResult.totalDist);
        const cycle = tsdResult.cycle || 120;
        const bandUp = tsdResult.bandUp;
        const bandDown = tsdResult.bandDown;
        const bandEfficiency = (cycle > 0) ? (((bandUp.bandwidth + bandDown.bandwidth) / (2 * cycle)) * 100).toFixed(1) : 0;

        if (pBar) pBar.style.width = '60%';
        if (pText) pText.innerText = '교차로별 신호현시 및 그룹 TOD 운영계획 매트릭스 도출 중...';

                // 1-2. 시그마앱에 저장된 실제 연동 링크 정보 추출
        const storedLinks = getGroupStoredLinks(gid, sortedMembers);

        // 2. 배경지도 타일 + 도로링크 + 교차로 마커 오프스크린 캔버스 렌더링
        if (pText) pText.innerText = '실제 도로망 링크 및 배경지도 타일 합성 중...';
        const mapSnapshotDataUrl = await renderGroupMapSnapshotAsync(gid, sortedMembers, storedLinks);
        window.__lastGroupLocationMapImage = mapSnapshotDataUrl;

        // SVG 폴백/벡터 맵
        const locationMapSvg = renderGroupLocationMapSVG(sortedMembers, storedLinks);

        // 3. 신호현시 상세표
        const phaseTableHtml = generateGroupPhaseTableHtml(sortedMembers, dayIdx, timeSlotIdx);

        // 4. 그룹 TOD 계획표
        const todTableHtml = generateGroupTODTableHtml(gid, group);

        // 5. 교차로 요약 및 백엔드 AI 분석 호출
        if (pBar) pBar.style.width = '80%';
        if (pText) pText.innerText = 'Groq LLM 수석신호운영분석관 정밀 진단 평가 수신 중...';

        const curReg = (typeof window !== 'undefined' && window.CURRENT_REGION_CODE) || 'L01';
        const curRegName = (window.REGION_MAP && window.REGION_MAP[curReg]) || (curReg === 'L02' ? '인천시' : '서울시');

        const membersSummary = sortedMembers.map((m, idx) => ({
            seq: idx + 1,
            id: m.id,
            name: m.name,
            office: m.office,
            police: m.police
        }));

        const todSummary = (group && group.schedules && group.schedules[dayIdx]) ? group.schedules[dayIdx].slice(0, 6) : [];

        let aiReportText = '';
        try {
            const aiResp = await fetch('/api/ai/group-report', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    groupId: gid,
                    groupName: gName,
                    regionName: curRegName,
                    totalDistanceM: totalDistM,
                    junctionCount: sortedMembers.length,
                    cycle,
                    bandUp,
                    bandDown,
                    bandEfficiency,
                    membersSummary,
                    todSummary
                })
            });
            const aiData = await aiResp.json();
            if (aiResp.ok && aiData.report) {
                aiReportText = aiData.report;
            } else {
                aiReportText = generateClientGroupFallback(gid, gName, totalDistM, sortedMembers, cycle, bandUp, bandDown, bandEfficiency);
            }
        } catch(aiErr) {
            console.warn('Backend AI Group Report failed, using fallback:', aiErr);
            aiReportText = generateClientGroupFallback(gid, gName, totalDistM, sortedMembers, cycle, bandUp, bandDown, bandEfficiency);
        }

        if (pBar) pBar.style.width = '100%';
        if (pText) pText.innerText = '완료!';

        // ── 6. 최종 보고서 본문 결합 (사용자 요구 순서: 1. 개요/위치도, 2. 신호운영/현시, 3. TOD/시공도, 4. 그외 분석) ──
        const finalHtml = `
        <div class="ai-group-report-container" style="font-family:'Pretendard', sans-serif; line-height:1.7; color:#e2e8f0;">
            
            <!-- 상단 컨트롤 버튼 바 -->
            <div style="display: flex; justify-content: space-between; align-items:center; margin-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 12px;">
                <div style="font-size: 18px; font-weight: 800; color: #00d4ff; display: flex; align-items: center; gap: 8px;">
                    🚦 [그룹 ${gid}] ${gName} 연동구간 신호운영 심층 분석 리포트
                </div>
                <div style="display: flex; gap: 10px;">
                    <button onclick="printAIReport()" style="background: rgba(255,183,77,0.15); border: 1px solid #ffb74d; color: #ffb74d; padding: 6px 14px; border-radius: 4px; font-size: 12px; font-weight: bold; cursor: pointer; display: flex; align-items: center; gap: 5px;">
                        🖨️ PDF 리포트 출력
                    </button>
                    <button onclick="generateAIReport()" style="background: none; border: 1px solid #4a90e2; color: #4a90e2; padding: 6px 14px; border-radius: 4px; font-size: 12px; font-weight: bold; cursor: pointer; display: flex; align-items: center; gap: 5px;">
                        🔄 다시 분석하기
                    </button>
                </div>
            </div>

            <!-- 1. 연동구간 개요 -->
            <div class="report-section mb-25" style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:18px;">
                <h3 style="margin-top:0; color:#38bdf8; font-size:16px; border-left:4px solid #38bdf8; padding-left:10px;">
                    1. 연동구간 개요
                </h3>
                
                <!-- 개요 메타 지표 카드 그리드 -->
                <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:12px; margin:15px 0;">
                    <div style="background:rgba(0,0,0,0.3); border:1px solid rgba(56,189,248,0.2); border-radius:6px; padding:12px;">
                        <div style="font-size:11px; color:#94a3b8;">그룹 식별 / 관리명칭</div>
                        <div style="font-size:15px; font-weight:bold; color:#fff; margin-top:4px;">그룹 ${gid} (${gName})</div>
                    </div>
                    <div style="background:rgba(0,0,0,0.3); border:1px solid rgba(56,189,248,0.2); border-radius:6px; padding:12px;">
                        <div style="font-size:11px; color:#94a3b8;">연동축 총 연장 거리</div>
                        <div style="font-size:16px; font-weight:bold; color:#10b981; margin-top:4px;">${(totalDistM / 1000).toFixed(2)} km <span style="font-size:12px; color:#aaa;">(${totalDistM.toLocaleString()} m)</span></div>
                    </div>
                    <div style="background:rgba(0,0,0,0.3); border:1px solid rgba(56,189,248,0.2); border-radius:6px; padding:12px;">
                        <div style="font-size:11px; color:#94a3b8;">소속 교차로 수</div>
                        <div style="font-size:16px; font-weight:bold; color:#38bdf8; margin-top:4px;">${sortedMembers.length}개소</div>
                    </div>
                    <div style="background:rgba(0,0,0,0.3); border:1px solid rgba(56,189,248,0.2); border-radius:6px; padding:12px;">
                        <div style="font-size:11px; color:#94a3b8;">평균 교차로 간격</div>
                        <div style="font-size:16px; font-weight:bold; color:#f59e0b; margin-top:4px;">${Math.round(totalDistM / Math.max(1, sortedMembers.length - 1))} m</div>
                    </div>
                </div>

                <!-- 연동구간 위치도 (배경지도 타일 + 실제 도로망 링크) -->
                <div style="margin-top:15px;">
                    <div style="font-size:13px; font-weight:bold; color:#e2e8f0; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
                        <span style="display:flex; align-items:center; gap:6px;">🗺️ 연동구간 위치도 (배경지도 및 실제 도로망 연동 링크)</span>
                        <span style="font-size:11px; color:#38bdf8; font-weight:normal;">🔗 시그마앱 저장 링크: ${storedLinks.length}개 구간 표출</span>
                    </div>
                    <div style="position:relative; width:100%; border-radius:8px; overflow:hidden; border:1px solid rgba(56,189,248,0.35); box-shadow:0 4px 20px rgba(0,0,0,0.6);">
                        ${mapSnapshotDataUrl ? `<img src="${mapSnapshotDataUrl}" style="width:100%; height:auto; display:block;" alt="연동구간 배경지도 및 링크 위치도"/>` : locationMapSvg}
                    </div>
                    <div style="font-size:11px; color:#94a3b8; margin-top:6px; display:flex; justify-content:space-between;">
                        <span>※ 시그마앱에 저장된 도로망 링크 정보를 바탕으로 실제 좌표계 및 배경지도 타일에 정확히 투영되었습니다.</span>
                        <span>🚩 녹색: 기점(Start) / 🏁 황색: 종점(End)</span>
                    </div>
                </div>
            </div>

            <!-- 2. 신호운영 현황 및 교차로별 신호현시 -->
            <div class="report-section mb-25" style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:18px;">
                <h3 style="margin-top:0; color:#38bdf8; font-size:16px; border-left:4px solid #38bdf8; padding-left:10px;">
                    2. 신호운영 현황 및 교차로별 신호현시
                </h3>
                <div style="font-size:13px; color:#cbd5e1; margin-bottom:10px;">
                    기준 일계획 ${dayIdx + 1} 및 시간대 ${timeSlotIdx + 1} 적용 기준의 각 교차로별 현시 배분(Split) 및 보행신호 운영 현황입니다.
                </div>
                ${phaseTableHtml}
            </div>

            <!-- 3. 그룹 TOD 및 시공도 -->
            <div class="report-section mb-25" style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:18px;">
                <h3 style="margin-top:0; color:#38bdf8; font-size:16px; border-left:4px solid #38bdf8; padding-left:10px;">
                    3. 그룹 TOD 운영계획 및 시공도 (Time-Space Diagram)
                </h3>
                
                <!-- 그룹 TOD 계획표 -->
                <div style="margin-bottom:18px;">
                    <div style="font-size:13px; font-weight:bold; color:#e2e8f0; margin-bottom:6px;">📋 그룹 TOD 요일별/시간대별 편성표</div>
                    ${todTableHtml}
                </div>

                <!-- 시공도 고화질 이미지 -->
                <div>
                    <div style="font-size:13px; font-weight:bold; color:#e2e8f0; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
                        <span>📈 Time-Space Diagram (Miovision Dual-Ring & Max Bandwidth)</span>
                        <span style="font-size:11px; color:#38bdf8;">주기: ${cycle}초 | 설계속도: 50 km/h</span>
                    </div>
                    <div style="text-align:center; background:#101216; padding:10px; border-radius:8px; border:1px solid rgba(255,255,255,0.1);">
                        <img src="${tsdResult.dataUrl}" style="max-width:100%; height:auto; border-radius:4px; display:block; margin:0 auto;" alt="Time Space Diagram"/>
                    </div>
                    
                    <!-- 시공도 핵심 지표 요약 -->
                    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:10px; margin-top:12px;">
                        <div style="background:rgba(46, 204, 113, 0.1); border:1px solid rgba(46, 204, 113, 0.3); border-radius:6px; padding:10px; text-align:center;">
                            <div style="font-size:11px; color:#a7f3d0;">정방향(상향) 연동 대역폭</div>
                            <div style="font-size:16px; font-weight:bold; color:#34d399; margin-top:2px;">
                                ${bandUp.bandwidth.toFixed(1)}초 <span style="font-size:12px; color:#cbd5e1;">(${bandUp.ratio.toFixed(1)}%)</span>
                            </div>
                        </div>
                        <div style="background:rgba(56, 189, 248, 0.1); border:1px solid rgba(56, 189, 248, 0.3); border-radius:6px; padding:10px; text-align:center;">
                            <div style="font-size:11px; color:#bae6fd;">역방향(하향) 연동 대역폭</div>
                            <div style="font-size:16px; font-weight:bold; color:#38bdf8; margin-top:2px;">
                                ${bandDown.bandwidth.toFixed(1)}초 <span style="font-size:12px; color:#cbd5e1;">(${bandDown.ratio.toFixed(1)}%)</span>
                            </div>
                        </div>
                        <div style="background:rgba(245, 158, 11, 0.1); border:1px solid rgba(245, 158, 11, 0.3); border-radius:6px; padding:10px; text-align:center;">
                            <div style="font-size:11px; color:#fde68a;">양방향 연동 대역 효율</div>
                            <div style="font-size:16px; font-weight:bold; color:#fbbf24; margin-top:2px;">
                                ${bandEfficiency}% <span style="font-size:11px; color:#aaa;">(${parseFloat(bandEfficiency) >= 30 ? '우수' : (parseFloat(bandEfficiency) >= 20 ? '보통' : '개선필요')})</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 4. 그 외 수록 가능한 분석 (AI 교통공학 정밀 진단) -->
            <div class="report-section mb-25" style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:18px;">
                <h3 style="margin-top:0; color:#38bdf8; font-size:16px; border-left:4px solid #38bdf8; padding-left:10px;">
                    4. 그 외 수록 분석 및 수석 신호운영분석관 종합 진단 소견
                </h3>
                <div class="ai-report-markdown" style="margin-top:12px;">
                    ${typeof marked !== 'undefined' ? marked.parse(aiReportText) : aiReportText}
                </div>
            </div>
            
        </div>`;

        window.__lastAIReportHTML = finalHtml;
        window.__lastAIReportTitle = `[그룹 ${gid}] ${gName} 연동구간 신호운영 심층 분석 리포트`;
        content.innerHTML = finalHtml;

    } catch (err) {
        console.error('Group Analysis Error:', err);
        content.innerHTML = `<div style="color:#ef5350; font-weight:bold; padding: 20px; text-align:center;">오류 발생: ${err.message}</div>
        <div style="text-align:center; margin-top:10px;"><button onclick="generateAIReport()" class="action-btn">설정으로 돌아가기</button></div>`;
    }
}
window.startAIGroupAnalysis = startAIGroupAnalysis;

// ── [보조 1] 오프스크린 TSD 렌더링 함수 (흰색 배경 고대비 인쇄용) ──
function renderOfflineTSDImage(gid, dayIdx, pIdx, axis = 'ew') {
    let members = Object.values(STATE.junctions).filter(j => String(j.group) === String(gid));
    if (members.length < 2) return null;

    const group = STATE.groups && STATE.groups[gid];
    const config = (group && group.tsdConfigs) ? group.tsdConfigs[0] : null;

    let dists = [0];
    let total = 0;
    if (config && config.enabled && config.order && config.order.length >= 2) {
        members = config.order.map(jid => STATE.junctions[jid]).filter(Boolean);
        for (let i = 0; i < members.length - 1; i++) {
            const d = parseFloat(config.distances[i]) || 0;
            total += d;
            dists.push(total);
        }
    } else {
        const getHaversineDistance = (lat1, lon1, lat2, lon2) => {
            const R = 6371000;
            const dLat = (lat2 - lat1) * Math.PI / 180;
            const dLon = (lon2 - lon1) * Math.PI / 180;
            const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                      Math.sin(dLon / 2) * Math.sin(dLon / 2);
            return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        };
        for (let i = 1; i < members.length; i++) {
            const m = members[i];
            let d = (m.extra && m.extra.diagramDistDisp !== undefined && m.extra.diagramDistDisp !== null)
                ? m.extra.diagramDistDisp
                : getHaversineDistance(members[i - 1].lat, members[i - 1].lng, m.lat, m.lng);
            total += d;
            dists.push(total);
        }
    }

    if (members.length < 2) return null;

    const cycle = (members[0].schedules && members[0].schedules[dayIdx] && members[0].schedules[dayIdx][pIdx])
        ? (members[0].schedules[dayIdx][pIdx].cycle || 120) : 120;
    const timeHorizon = cycle * 2.5;

    const canvas = document.createElement('canvas');
    const w = 1100;
    const h = Math.max(500, members.length * 64 + 120);
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');

    const cfg = {
        padding: { left: 190, right: 40, top: 40, bottom: 50 },
        speed: 50 // km/h
    };
    const chartW = w - cfg.padding.left - cfg.padding.right;
    const chartH = h - cfg.padding.top - cfg.padding.bottom;

    const tToX = (t) => cfg.padding.left + (t / (timeHorizon || 1)) * chartW;
    const distToY = (d) => cfg.padding.top + (d / (total || 1)) * chartH;
    const xF = (x) => Math.max(cfg.padding.left, Math.min(cfg.padding.left + chartW, x));

    // [핵심 변경] 배경을 순백색으로 채워 PDF 인쇄 시 잉크 낭비 및 시인성 저하 완전 해소
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);

    // 차트 영역 내부: 매우 연한 그레이 톤 및 테두리
    ctx.fillStyle = '#fafbfc';
    ctx.fillRect(cfg.padding.left, cfg.padding.top, chartW, chartH);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.strokeRect(cfg.padding.left, cfg.padding.top, chartW, chartH);

    // 시간 축 눈금선 및 라벨
    const step = cycle / 4;
    for (let t = 0; t <= timeHorizon; t += step) {
        const x = tToX(t);
        const isCycleEnd = (Math.round(t) % cycle === 0);
        ctx.strokeStyle = isCycleEnd ? '#94a3b8' : '#e2e8f0';
        ctx.lineWidth = isCycleEnd ? 1.5 : 1;
        ctx.beginPath();
        ctx.moveTo(x, cfg.padding.top);
        ctx.lineTo(x, h - cfg.padding.bottom);
        ctx.stroke();

        ctx.textAlign = 'center';
        ctx.fillStyle = isCycleEnd ? '#0f172a' : '#64748b';
        ctx.font = isCycleEnd ? 'bold 11px monospace' : '10px monospace';
        ctx.fillText(`${Math.round(t)}s`, x, h - cfg.padding.bottom + 18);
    }

    let bandUp = { bandwidth: 0, ratio: 0, t0: 0 };
    let bandDown = { bandwidth: 0, ratio: 0, t0: 0 };
    if (typeof TSDAnalyzer !== 'undefined') {
        try {
            const tt = [0];
            let acc = 0;
            for (let i = 1; i < dists.length; i++) {
                acc += (dists[i] - dists[i - 1]) / (cfg.speed / 3.6);
                tt.push(acc);
            }
            if (typeof TSDAnalyzer.findMaxBand === 'function') {
                bandUp = TSDAnalyzer.findMaxBand(members, dists, tt, 'up', axis, dayIdx, pIdx, cycle);
                bandDown = TSDAnalyzer.findMaxBand(members, dists, tt, 'down', axis, dayIdx, pIdx, cycle);
            } else if (typeof TSDAnalyzer.calculateBandwidth === 'function') {
                const totalDist = dists[dists.length - 1] || 0;
                const resUp = TSDAnalyzer.calculateBandwidth('up', axis, members, dists, totalDist, cycle, tt, dayIdx, pIdx);
                const resDown = TSDAnalyzer.calculateBandwidth('down', axis, members, dists, totalDist, cycle, tt, dayIdx, pIdx);
                bandUp = {
                    bandwidth: (resUp && resUp.width) || 0,
                    t0: (resUp && resUp.start) || 0,
                    ratio: cycle > 0 ? Math.round((((resUp && resUp.width) || 0) / cycle) * 1000) / 10 : 0
                };
                bandDown = {
                    bandwidth: (resDown && resDown.width) || 0,
                    t0: (resDown && resDown.start) || 0,
                    ratio: cycle > 0 ? Math.round((((resDown && resDown.width) || 0) / cycle) * 1000) / 10 : 0
                };
            }
        } catch (e) {
            console.warn('[AI Report] TSD Bandwidth calculation warning:', e);
        }
    }

    const drawBand = (dir, band, color, strokeColor) => {
        const b = (band && (band.bandwidth || band.width)) || 0;
        if (b <= 0) return;
        const tt = [0];
        let acc = 0;
        for (let i = 1; i < dists.length; i++) {
            acc += (dists[i] - dists[i - 1]) / (cfg.speed / 3.6);
            tt.push(acc);
        }
        const startBase = (band && band.t0 !== undefined) ? band.t0 : ((band && band.start) || 0);
        for (let cOffset = -cycle; cOffset <= timeHorizon + cycle; cOffset += cycle) {
            const startT = startBase + cOffset;
            ctx.save();
            ctx.fillStyle = color;
            ctx.strokeStyle = strokeColor;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            
            if (dir === 'up') {
                for (let i = 0; i < members.length; i++) {
                    const y = distToY(dists[i]);
                    const x = tToX(startT + tt[i]);
                    if (i === 0) ctx.moveTo(xF(x), y);
                    else ctx.lineTo(xF(x), y);
                }
                for (let i = members.length - 1; i >= 0; i--) {
                    const y = distToY(dists[i]);
                    const x = tToX(startT + tt[i] + b);
                    ctx.lineTo(xF(x), y);
                }
            } else {
                for (let i = members.length - 1; i >= 0; i--) {
                    const y = distToY(dists[i]);
                    const x = tToX(startT + tt[members.length - 1] - tt[i]);
                    if (i === members.length - 1) ctx.moveTo(xF(x), y);
                    else ctx.lineTo(xF(x), y);
                }
                for (let i = 0; i < members.length; i++) {
                    const y = distToY(dists[i]);
                    const x = tToX(startT + tt[members.length - 1] - tt[i] + b);
                    ctx.lineTo(xF(x), y);
                }
            }
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.restore();
        }
    };

    // 고대비 진행대역 (상행: 밝은 녹색/진녹색 테두리, 하행: 밝은 블루/로얄블루 테두리)
    drawBand('up', bandUp, 'rgba(16, 185, 129, 0.25)', 'rgba(5, 150, 105, 0.9)');
    drawBand('down', bandDown, 'rgba(2, 132, 199, 0.25)', 'rgba(2, 132, 199, 0.9)');

    // 교차로별 신호 분할 바 및 명칭/거리/옵셋 표기
    members.forEach((j, i) => {
        const y = distToY(dists[i]);
        const tod = typeof getEffectiveDayPlan === "function" ? getEffectiveDayPlan(j, dayIdx, pIdx) : (j.dayPlans && j.dayPlans[dayIdx] ? j.dayPlans[dayIdx][pIdx] : null);
        const offset = tod ? (tod.offset || 0) : 0;
        const sm = typeof getEffectiveSignalMap === "function" ? getEffectiveSignalMap(j, dayIdx, pIdx) : (j.signalMaps ? j.signalMaps[0] : null);

        const barH = 12;
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(cfg.padding.left, y - barH, chartW, barH * 2);

        if (sm && sm.movA && tod && tod.splitA) {
            for (let cStart = -cycle; cStart <= timeHorizon; cStart += cycle) {
                let curT = cStart + offset;
                tod.splitA.forEach((sp, idx) => {
                    if (sp <= 0) return;
                    const mov = sm.movA[idx];
                    const isGreen = (axis === 'ew' ? [2, 6] : [4, 8]).includes(mov);
                    const yellowT = (sm.yellowA && sm.yellowA[idx]) || 3;
                    const greenT = Math.max(0, sp - yellowT);

                    const x1 = tToX(curT);
                    const x2 = tToX(curT + greenT);
                    const x3 = tToX(curT + sp);

                    if (isGreen) {
                        ctx.fillStyle = '#10b981';
                        ctx.fillRect(xF(x1), y - barH, Math.max(0, xF(x2) - xF(x1)), barH * 2);
                        ctx.fillStyle = '#f59e0b';
                        ctx.fillRect(xF(x2), y - barH, Math.max(0, xF(x3) - xF(x2)), barH * 2);
                    } else {
                        ctx.fillStyle = '#ef4444';
                        ctx.fillRect(xF(x1), y - barH, Math.max(0, xF(x3) - xF(x1)), barH * 2);
                    }
                    curT += sp;
                });
            }
        }

        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cfg.padding.left, y);
        ctx.lineTo(w - cfg.padding.right, y);
        ctx.stroke();

        ctx.textAlign = 'right';
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 12px sans-serif';
        let jName = (j.name || j.id);
        if (jName.length > 9) jName = jName.slice(0, 8) + '..';
        ctx.fillText(jName, cfg.padding.left - 12, y - 4);

        ctx.font = 'bold 11px monospace';
        ctx.fillStyle = '#047857';
        ctx.fillText(`${Math.round(dists[i])}m`, cfg.padding.left - 65, y + 12);

        ctx.fillStyle = offset !== 0 ? '#d97706' : '#64748b';
        ctx.fillText(`+${Math.round(offset)}s`, cfg.padding.left - 12, y + 12);
    });

    return {
        dataUrl: canvas.toDataURL('image/png'),
        bandUp,
        bandDown,
        totalDist: total,
        members,
        cycle
    };
}

// ── [보조 2] 연동구간 위치도 SVG 렌더링 ──

// ── [보조 1-1] 시그마앱에 저장된 실제 연동 링크 정보 추출 엔진 ──
function getGroupStoredLinks(gid, members) {
    if (!members || members.length < 2) return [];

    const juncIdMap = new Map();
    const juncNormMap = new Map();
    members.forEach(m => {
        const idStr = String(m.id || '').trim();
        juncIdMap.set(idStr, m);
        const norm = idStr.split('-').pop().replace(/[^0-9]/g, '');
        if (norm) juncNormMap.set(norm, m);
    });

    const links = [];
    const linkSet = new Set();

    // 1) window.RoadManager.edges 확인 (시그마앱 내 링크 편집/저장 엔진)
    if (typeof window !== 'undefined' && window.RoadManager && Array.isArray(window.RoadManager.edges) && Array.isArray(window.RoadManager.nodes)) {
        window.RoadManager.edges.forEach(pair => {
            const u = window.RoadManager.nodes[pair[0]];
            const v = window.RoadManager.nodes[pair[1]];
            if (!u || !v) return;

            const uId = String(u.id || '').trim();
            const vId = String(v.id || '').trim();
            const uNorm = uId.split('-').pop().replace(/[^0-9]/g, '');
            const vNorm = vId.split('-').pop().replace(/[^0-9]/g, '');

            const uMatch = juncIdMap.has(uId) || juncNormMap.has(uNorm) || (String(u.group) === String(gid));
            const vMatch = juncIdMap.has(vId) || juncNormMap.has(vNorm) || (String(v.group) === String(gid));

            if (uMatch && vMatch) {
                const key1 = u.id + '_' + v.id;
                const key2 = v.id + '_' + u.id;
                if (!linkSet.has(key1) && !linkSet.has(key2)) {
                    linkSet.add(key1);
                    links.push({
                        u: { id: u.id, name: u.name, lat: parseFloat(u.lat), lng: parseFloat(u.lng) },
                        v: { id: v.id, name: v.name, lat: parseFloat(v.lat), lng: parseFloat(v.lng) },
                        coords: [[parseFloat(u.lat), parseFloat(u.lng)], [parseFloat(v.lat), parseFloat(v.lng)]]
                    });
                }
            }
        });
    }

    // 2) STATE.coordLinkGeoJson 확인 (GeoJSON 피처가 로드되어 있는 경우)
    if (links.length === 0 && typeof STATE !== 'undefined' && STATE.coordLinkGeoJson && Array.isArray(STATE.coordLinkGeoJson.features)) {
        STATE.coordLinkGeoJson.features.forEach(f => {
            const p = f.properties || {};
            const fGid = p.group || p.group_id || p.GroupID || p.link_id;
            const uId = String(p.u_id || '').trim();
            const vId = String(p.v_id || '').trim();
            const uNorm = uId.split('-').pop().replace(/[^0-9]/g, '');
            const vNorm = vId.split('-').pop().replace(/[^0-9]/g, '');

            const isGroup = (String(fGid) === String(gid));
            const isMatch = (uId && vId) &&
                (juncIdMap.has(uId) || juncNormMap.has(uNorm)) &&
                (juncIdMap.has(vId) || juncNormMap.has(vNorm));

            if ((isGroup || isMatch) && f.geometry && Array.isArray(f.geometry.coordinates)) {
                if (f.geometry.type === 'LineString') {
                    const c = f.geometry.coordinates.map(pt => [parseFloat(pt[1]), parseFloat(pt[0])]);
                    links.push({ coords: c });
                }
            }
        });
    }

    // 3) 폴백: 만약 DB에 링크가 등록되지 않은 그룹일 경우 최소 거리 기반 체인으로 안전 연결
    if (links.length === 0 && members.length >= 2) {
        for (let i = 0; i < members.length - 1; i++) {
            const u = members[i];
            const v = members[i + 1];
            links.push({
                u: { id: u.id, name: u.name, lat: parseFloat(u.lat), lng: parseFloat(u.lng) },
                v: { id: v.id, name: v.name, lat: parseFloat(v.lat), lng: parseFloat(v.lng) },
                coords: [[parseFloat(u.lat), parseFloat(u.lng)], [parseFloat(v.lat), parseFloat(v.lng)]]
            });
        }
    }

    return links;
}

// ── [보조 1-2] 배경지도 밝은 타일 + 저장된 도로링크 + 교차로 마커 렌더러 (인쇄 최적화) ──
async function renderGroupMapSnapshotAsync(gid, members, links) {
    if (!members || members.length === 0) return null;

    const lats = members.map(m => parseFloat(m.lat)).filter(v => !isNaN(v));
    const lngs = members.map(m => parseFloat(m.lng)).filter(v => !isNaN(v));
    if (lats.length === 0 || lngs.length === 0) return null;

    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);

    const padLat = Math.max((maxLat - minLat) * 0.22, 0.0035);
    const padLng = Math.max((maxLng - minLng) * 0.22, 0.0035);

    const bMinLat = minLat - padLat, bMaxLat = maxLat + padLat;
    const bMinLng = minLng - padLng, bMaxLng = maxLng + padLng;

    const canvasW = 1000, canvasH = 460;
    const pad = 45;

    const toX = (lng) => pad + ((lng - bMinLng) / (bMaxLng - bMinLng || 1)) * (canvasW - pad * 2);
    const toY = (lat) => canvasH - pad - ((lat - bMinLat) / (bMaxLat - bMinLat || 1)) * (canvasH - pad * 2);

    const canvas = document.createElement('canvas');
    canvas.width = canvasW;
    canvas.height = canvasH;
    const ctx = canvas.getContext('2d');

    // [핵심 변경] 밝은 지도 베이스 배경 (#f8fafc)
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, canvasW, canvasH);

    // 줌 레벨 계산
    const latSpan = bMaxLat - bMinLat;
    const lngSpan = bMaxLng - bMinLng;
    let zoom = 15;
    if (latSpan > 0.1 || lngSpan > 0.1) zoom = 12;
    else if (latSpan > 0.05 || lngSpan > 0.05) zoom = 13;
    else if (latSpan > 0.02 || lngSpan > 0.02) zoom = 14;
    else if (latSpan > 0.008 || lngSpan > 0.008) zoom = 15;
    else zoom = 16;

    const latLngToTile = (lat, lng, z) => {
        const latRad = lat * Math.PI / 180;
        const n = Math.pow(2, z);
        const x = (lng + 180) / 360 * n;
        const y = (1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2 * n;
        return { x, y, tileX: Math.floor(x), tileY: Math.floor(y) };
    };

    const tileMin = latLngToTile(bMaxLat, bMinLng, zoom);
    const tileMax = latLngToTile(bMinLat, bMaxLng, zoom);

    const startTileX = Math.min(tileMin.tileX, tileMax.tileX) - 1;
    const endTileX = Math.max(tileMin.tileX, tileMax.tileX) + 1;
    const startTileY = Math.min(tileMin.tileY, tileMax.tileY) - 1;
    const endTileY = Math.max(tileMin.tileY, tileMax.tileY) + 1;

    const tilePromises = [];
    const maxTilesToLoad = 25;
    let loadedTileCount = 0;

    for (let tx = startTileX; tx <= endTileX; tx++) {
        for (let ty = startTileY; ty <= endTileY; ty++) {
            if (loadedTileCount >= maxTilesToLoad) break;
            loadedTileCount++;

            const n = Math.pow(2, zoom);
            const tileLng1 = tx / n * 360 - 180;
            const tileLat1 = Math.atan(Math.sinh(Math.PI * (1 - 2 * ty / n))) * 180 / Math.PI;
            const tileLng2 = (tx + 1) / n * 360 - 180;
            const tileLat2 = Math.atan(Math.sinh(Math.PI * (1 - 2 * (ty + 1) / n))) * 180 / Math.PI;

            const x1 = toX(tileLng1), y1 = toY(tileLat1);
            const x2 = toX(tileLng2), y2 = toY(tileLat2);

            // [사용자 요구 반영] 다크모드 타일 대신 Clean Light Gray 타일 사용
            const tileUrl = `https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/${zoom}/${ty}/${tx}`;

            const p = new Promise(resolve => {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.onload = () => {
                    resolve({ img, x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1) });
                };
                img.onerror = () => resolve(null);
                img.src = tileUrl;
            });
            tilePromises.push(p);
        }
    }

    try {
        const tiles = await Promise.race([
            Promise.all(tilePromises),
            new Promise(resolve => setTimeout(() => resolve([]), 1800))
        ]);

        tiles.forEach(t => {
            if (t && t.img) {
                ctx.drawImage(t.img, t.x, t.y, t.w, t.h);
            }
        });
    } catch (tileErr) {
        console.warn('[AI Report] Light Gray tile map fallback:', tileErr);
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1;
        for (let gx = 0; gx < canvasW; gx += 40) {
            ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, canvasH); ctx.stroke();
        }
        for (let gy = 0; gy < canvasH; gy += 40) {
            ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(canvasW, gy); ctx.stroke();
        }
    }

    // 시그마앱에 저장된 실제 연동 도로 링크 표출 (밝은 배경에 선명한 로얄블루)
    if (links && links.length > 0) {
        ctx.save();
        ctx.lineWidth = 9;
        ctx.strokeStyle = 'rgba(2, 132, 199, 0.35)';
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        links.forEach(l => {
            if (!l.coords || l.coords.length < 2) return;
            ctx.beginPath();
            l.coords.forEach((pt, idx) => {
                const cx = toX(pt[1]), cy = toY(pt[0]);
                if (idx === 0) ctx.moveTo(cx, cy);
                else ctx.lineTo(cx, cy);
            });
            ctx.stroke();
        });
        ctx.restore();

        ctx.save();
        ctx.lineWidth = 4.5;
        ctx.strokeStyle = '#0284c7';
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        links.forEach(l => {
            if (!l.coords || l.coords.length < 2) return;
            ctx.beginPath();
            l.coords.forEach((pt, idx) => {
                const cx = toX(pt[1]), cy = toY(pt[0]);
                if (idx === 0) ctx.moveTo(cx, cy);
                else ctx.lineTo(cx, cy);
            });
            ctx.stroke();
        });
        ctx.restore();
    }

    // 소속 교차로 노드 마커 및 명칭 라벨 (고대비 백색 배지 + 짙은 텍스트)
    members.forEach((m, idx) => {
        const cx = toX(parseFloat(m.lng));
        const cy = toY(parseFloat(m.lat));
        const isStart = (idx === 0);
        const isEnd = (idx === members.length - 1);
        const nodeColor = isStart ? '#10b981' : (isEnd ? '#f59e0b' : '#0284c7');

        ctx.beginPath();
        ctx.arc(cx, cy, 11, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = nodeColor;
        ctx.stroke();

        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(idx + 1), cx, cy + 0.5);

        const labelText = m.name || m.id;
        ctx.font = 'bold 11px sans-serif';
        const textMetrics = ctx.measureText(labelText);
        const boxW = Math.max(56, textMetrics.width + 16);
        const boxH = 20;
        const yOff = (idx % 2 === 0) ? -24 : 26;

        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1;
        
        const bx = cx - boxW / 2;
        const by = cy + yOff - boxH / 2;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(bx, by, boxW, boxH, 4);
        else ctx.rect(bx, by, boxW, boxH);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#0f172a';
        ctx.fillText(labelText, cx, cy + yOff);

        if (isStart) {
            ctx.fillStyle = '#047857';
            ctx.font = 'bold 10px sans-serif';
            ctx.fillText('🚩 기점(Start)', cx, cy + yOff - 15);
        } else if (isEnd) {
            ctx.fillStyle = '#b45309';
            ctx.font = 'bold 10px sans-serif';
            ctx.fillText('🏁 종점(End)', cx, cy + yOff - 15);
        }
    });

    // 나침반 방위표
    ctx.save();
    const nx = canvasW - 50, ny = 45;
    ctx.beginPath();
    ctx.arc(nx, ny, 16, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.fill(); ctx.stroke();

    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.moveTo(nx, ny - 11); ctx.lineTo(nx + 4, ny + 3); ctx.lineTo(nx - 4, ny + 3);
    ctx.closePath(); ctx.fill();

    ctx.fillStyle = '#94a3b8';
    ctx.beginPath();
    ctx.moveTo(nx, ny + 11); ctx.lineTo(nx + 4, ny + 3); ctx.lineTo(nx - 4, ny + 3);
    ctx.closePath(); ctx.fill();

    ctx.fillStyle = '#ef4444';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('N', nx, ny - 13);
    ctx.restore();

    try {
        return canvas.toDataURL('image/png');
    } catch (e) {
        console.warn('[AI Report] canvas.toDataURL error:', e);
        return null;
    }
}


// ── [보조 2] 연동구간 위치도 SVG 렌더링 (저장된 링크 반영 및 배경 그리드) ──
function renderGroupLocationMapSVG(members, links = []) {
    if (!members || members.length === 0) return '';
    const lats = members.map(m => parseFloat(m.lat)).filter(v => !isNaN(v));
    const lngs = members.map(m => parseFloat(m.lng)).filter(v => !isNaN(v));
    if (lats.length === 0 || lngs.length === 0) return '';

    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);

    const padLat = Math.max((maxLat - minLat) * 0.22, 0.0035);
    const padLng = Math.max((maxLng - minLng) * 0.22, 0.0035);

    const bMinLat = minLat - padLat, bMaxLat = maxLat + padLat;
    const bMinLng = minLng - padLng, bMaxLng = maxLng + padLng;

    const svgW = 920, svgH = 380;
    const pad = 45;

    const toX = (lng) => pad + ((lng - bMinLng) / (bMaxLng - bMinLng || 1)) * (svgW - pad * 2);
    const toY = (lat) => svgH - pad - ((lat - bMinLat) / (bMaxLat - bMinLat || 1)) * (svgH - pad * 2);

    const points = members.map(m => ({
        id: m.id,
        name: m.name || m.id,
        x: toX(parseFloat(m.lng)),
        y: toY(parseFloat(m.lat))
    }));

    let svg = `<svg viewBox="0 0 ${svgW} ${svgH}" style="width: 100%; height: auto; background: #0c1220; border: 1px solid rgba(0, 212, 255, 0.3); border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.6);" xmlns="http://www.w3.org/2000/svg">`;
    svg += `<defs>
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255, 255, 255, 0.04)" stroke-width="1"/>
        </pattern>
        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
    </defs>
    <rect width="${svgW}" height="${svgH}" fill="url(#grid)" />`;

    // 시그마앱에 저장된 실제 링크들만 정확히 렌더링 (단순 인덱스 연결 폐지)
    if (links && links.length > 0) {
        links.forEach(l => {
            if (!l.coords || l.coords.length < 2) return;
            let pts = l.coords.map(c => `${toX(c[1]).toFixed(1)},${toY(c[0]).toFixed(1)}`).join(' ');
            svg += `<polyline points="${pts}" fill="none" stroke="#0284c7" stroke-width="8" opacity="0.4" filter="url(#glow)"/>`;
            svg += `<polyline points="${pts}" fill="none" stroke="#00d4ff" stroke-width="3.8" stroke-linecap="round" stroke-linejoin="round"/>`;
        });
    }

    // 나침반 방위표
    svg += `<g transform="translate(${svgW - 50}, 45)">
        <circle cx="0" cy="0" r="16" fill="rgba(0,0,0,0.6)" stroke="rgba(255,255,255,0.2)"/>
        <path d="M 0 -12 L 5 4 L 0 1 L -5 4 Z" fill="#ef4444"/>
        <path d="M 0 12 L 5 4 L 0 1 L -5 4 Z" fill="#94a3b8"/>
        <text x="0" y="-14" fill="#ef4444" font-size="9" font-weight="bold" text-anchor="middle">N</text>
    </g>`;

    // 교차로 노드 마커 및 명칭
    points.forEach((p, idx) => {
        const isStart = (idx === 0);
        const isEnd = (idx === points.length - 1);
        const nodeColor = isStart ? '#10b981' : (isEnd ? '#f59e0b' : '#38bdf8');
        
        svg += `<circle cx="${p.x}" cy="${p.y}" r="11" fill="#080f1d" stroke="${nodeColor}" stroke-width="2.5" />`;
        svg += `<text x="${p.x}" y="${p.y + 4}" fill="#ffffff" font-size="10" font-weight="bold" text-anchor="middle">${idx + 1}</text>`;

        const labelText = p.name;
        const textWidth = Math.min(120, Math.max(54, labelText.length * 11 + 12));
        const yOffset = (idx % 2 === 0) ? -22 : 24;
        svg += `<rect x="${p.x - textWidth / 2}" y="${p.y + yOffset - 11}" width="${textWidth}" height="18" rx="4" fill="rgba(10, 18, 30, 0.9)" stroke="rgba(255,255,255,0.2)"/>`;
        svg += `<text x="${p.x}" y="${p.y + yOffset + 2}" fill="#f1f5f9" font-size="10" font-weight="bold" text-anchor="middle">${labelText}</text>`;

        if (isStart) {
            svg += `<text x="${p.x}" y="${p.y + yOffset - 16}" fill="#10b981" font-size="9" font-weight="bold" text-anchor="middle">🚩 기점 (START)</text>`;
        } else if (isEnd) {
            svg += `<text x="${p.x}" y="${p.y + yOffset - 16}" fill="#f59e0b" font-size="9" font-weight="bold" text-anchor="middle">🏁 종점 (END)</text>`;
        }
    });

    svg += `</svg>`;
    return svg;
}


// ── [보조 3] 교차로별 신호운영 현황 및 반응형 현시표 (Interactive Phase Diagrams) ──
function generateGroupPhaseTableHtml(members, dayIdx, pIdx) {
    let rowsHtml = '';
    let ipdCardsHtml = '';

    // 화살표 렌더링 헬퍼 (Miovision / NEMA 8현시 표준 화살표)
    const getMovArrowSvg = (mov) => {
        // mov: 1(WBL), 2(EBT), 3(NBL), 4(SBT), 5(EBL), 6(WBT), 7(SBL), 8(NBT)
        switch(parseInt(mov)) {
            case 2: // EBT (동향 직진 - 서에서 동으로)
                return '<svg width="28" height="28" viewBox="0 0 100 100"><line x1="15" y1="50" x2="80" y2="50" stroke="#0284c7" stroke-width="8" stroke-linecap="round"/><polyline points="65,35 85,50 65,65" fill="none" stroke="#0284c7" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
            case 6: // WBT (서향 직진 - 동에서 서로)
                return '<svg width="28" height="28" viewBox="0 0 100 100"><line x1="85" y1="50" x2="20" y2="50" stroke="#0284c7" stroke-width="8" stroke-linecap="round"/><polyline points="35,35 15,50 35,65" fill="none" stroke="#0284c7" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
            case 4: // SBT (남향 직진 - 북에서 남으로)
                return '<svg width="28" height="28" viewBox="0 0 100 100"><line x1="50" y1="15" x2="50" y2="80" stroke="#0284c7" stroke-width="8" stroke-linecap="round"/><polyline points="35,65 50,85 65,65" fill="none" stroke="#0284c7" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
            case 8: // NBT (북향 직진 - 남에서 북으로)
                return '<svg width="28" height="28" viewBox="0 0 100 100"><line x1="50" y1="85" x2="50" y2="20" stroke="#0284c7" stroke-width="8" stroke-linecap="round"/><polyline points="35,35 50,15 65,35" fill="none" stroke="#0284c7" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
            case 1: // WBL (서향 좌회전)
                return '<svg width="28" height="28" viewBox="0 0 100 100"><path d="M 85,60 L 50,60 Q 40,60 40,30" fill="none" stroke="#10b981" stroke-width="8" stroke-linecap="round"/><polyline points="25,45 40,25 55,45" fill="none" stroke="#10b981" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
            case 5: // EBL (동향 좌회전)
                return '<svg width="28" height="28" viewBox="0 0 100 100"><path d="M 15,40 L 50,40 Q 60,40 60,70" fill="none" stroke="#10b981" stroke-width="8" stroke-linecap="round"/><polyline points="45,55 60,75 75,55" fill="none" stroke="#10b981" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
            case 3: // NBL (북향 좌회전)
                return '<svg width="28" height="28" viewBox="0 0 100 100"><path d="M 60,85 L 60,50 Q 60,40 30,40" fill="none" stroke="#10b981" stroke-width="8" stroke-linecap="round"/><polyline points="45,25 25,40 45,55" fill="none" stroke="#10b981" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
            case 7: // SBL (남향 좌회전)
                return '<svg width="28" height="28" viewBox="0 0 100 100"><path d="M 40,15 L 40,50 Q 40,60 70,60" fill="none" stroke="#10b981" stroke-width="8" stroke-linecap="round"/><polyline points="55,45 75,60 55,75" fill="none" stroke="#10b981" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
            default:
                return '<div style="font-size:11px; color:#94a3b8; font-weight:bold;">-</div>';
        }
    };

    members.forEach((j, idx) => {
        const sm = typeof getEffectiveSignalMap === "function" ? getEffectiveSignalMap(j, dayIdx, pIdx) : (j.signalMaps ? j.signalMaps[0] : null);
        const tod = typeof getEffectiveDayPlan === "function" ? getEffectiveDayPlan(j, dayIdx, pIdx) : (j.dayPlans && j.dayPlans[dayIdx] ? j.dayPlans[dayIdx][pIdx] : null);
        
        const cycle = tod ? (tod.cycle || 120) : 120;
        const offset = tod ? (tod.offset || 0) : 0;
        const pedTime = (sm && sm.pedA && sm.pedA[0]) ? `${sm.pedA[0]}초` : '-';

        let activePhaseCount = 0;
        if (tod && tod.splitA) {
            activePhaseCount = tod.splitA.filter(sp => sp > 0).length;
        }

        // [사용자 요구 반영] 신호분할비율 컬럼 제거 -> 심플하고 가독성 높은 신호운영 현황표
        rowsHtml += `<tr style="border-bottom:1px solid #cbd5e1;">
            <td style="padding:8px 6px; text-align:center; font-weight:bold; color:#475569;">${idx + 1}</td>
            <td style="padding:8px 8px; font-weight:700; color:#0284c7;">${j.name || j.id}</td>
            <td style="padding:8px 6px; text-align:center; color:#64748b; font-size:11px;">${j.id}</td>
            <td style="padding:8px 6px; text-align:center; font-weight:600;">${cycle}초</td>
            <td style="padding:8px 6px; text-align:center; font-weight:bold; color:#d97706;">${offset}초</td>
            <td style="padding:8px 6px; text-align:center;">${j.controller || '표준형'}</td>
            <td style="padding:8px 6px; text-align:center;">${pedTime}</td>
            <td style="padding:8px 6px; text-align:center; font-weight:bold; color:#059669;">${activePhaseCount}현시</td>
        </tr>`;

        // 반응형 현시표 (Interactive Phase Diagram Card)
        let ringACells = '';
        let ringBCells = '';
        for (let p = 1; p <= 8; p++) {
            const spA = (tod && tod.splitA && tod.splitA[p - 1]) || 0;
            const movA = (sm && sm.movA && sm.movA[p - 1]) || 0;
            const spB = (tod && tod.splitB && tod.splitB[p - 1]) || 0;
            const movB = (sm && sm.movB && sm.movB[p - 1]) || 0;

            // A링 셀
            if (spA > 0) {
                ringACells += `<div style="flex:1; border:1px solid #cbd5e1; border-radius:4px; padding:4px 2px; text-align:center; background:#ffffff;">
                    <div style="font-size:9px; font-weight:bold; color:#64748b;">P${p}</div>
                    <div style="height:26px; display:flex; align-items:center; justify-content:center;">${getMovArrowSvg(movA)}</div>
                    <div style="font-size:10px; font-weight:bold; color:#0f172a;">${spA}s</div>
                </div>`;
            } else {
                ringACells += `<div style="flex:1; border:1px dashed #e2e8f0; border-radius:4px; padding:4px 2px; text-align:center; background:#f8fafc; opacity:0.6;">
                    <div style="font-size:9px; color:#cbd5e1;">P${p}</div>
                    <div style="height:26px; display:flex; align-items:center; justify-content:center; color:#cbd5e1; font-size:10px;">-</div>
                    <div style="font-size:9px; color:#cbd5e1;">-</div>
                </div>`;
            }

            // B링 셀
            if (spB > 0) {
                ringBCells += `<div style="flex:1; border:1px solid #cbd5e1; border-radius:4px; padding:4px 2px; text-align:center; background:#ffffff;">
                    <div style="font-size:9px; font-weight:bold; color:#64748b;">P${p}</div>
                    <div style="height:26px; display:flex; align-items:center; justify-content:center;">${getMovArrowSvg(movB)}</div>
                    <div style="font-size:10px; font-weight:bold; color:#0f172a;">${spB}s</div>
                </div>`;
            } else {
                ringBCells += `<div style="flex:1; border:1px dashed #e2e8f0; border-radius:4px; padding:4px 2px; text-align:center; background:#f8fafc; opacity:0.6;">
                    <div style="font-size:9px; color:#cbd5e1;">P${p}</div>
                    <div style="height:26px; display:flex; align-items:center; justify-content:center; color:#cbd5e1; font-size:10px;">-</div>
                    <div style="font-size:9px; color:#cbd5e1;">-</div>
                </div>`;
            }
        }

        ipdCardsHtml += `
        <div style="background:#ffffff; border:1px solid #cbd5e1; border-radius:6px; padding:10px 12px; margin-bottom:12px; box-shadow:0 1px 3px rgba(0,0,0,0.05); page-break-inside:avoid;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; border-bottom:1px solid #e2e8f0; padding-bottom:4px;">
                <span style="font-size:12px; font-weight:bold; color:#0f172a;">
                    <span style="display:inline-block; width:18px; height:18px; line-height:18px; background:#0284c7; color:#fff; border-radius:50%; text-align:center; font-size:10px; margin-right:6px;">${idx + 1}</span>
                    ${j.name || j.id} <span style="font-size:11px; font-weight:normal; color:#64748b;">(${j.id})</span>
                </span>
                <span style="font-size:11px; color:#0284c7; font-weight:bold;">
                    주기: ${cycle}초 | 옵셋: ${offset}초 | 제어기: ${j.controller || '표준형'}
                </span>
            </div>
            <div style="display:flex; flex-direction:column; gap:4px;">
                <div style="display:flex; align-items:center; gap:6px;">
                    <span style="width:38px; font-size:10px; font-weight:bold; color:#475569; background:#f1f5f9; padding:2px 4px; border-radius:3px; text-align:center;">A링</span>
                    <div style="flex:1; display:flex; gap:4px;">${ringACells}</div>
                </div>
                <div style="display:flex; align-items:center; gap:6px;">
                    <span style="width:38px; font-size:10px; font-weight:bold; color:#475569; background:#f1f5f9; padding:2px 4px; border-radius:3px; text-align:center;">B링</span>
                    <div style="flex:1; display:flex; gap:4px;">${ringBCells}</div>
                </div>
            </div>
        </div>`;
    });

    return `
    <div style="overflow-x: auto; margin-top: 6px;">
        <table class="ai-report-table" style="width: 100%; border-collapse: collapse; font-size: 11.5px; background: #ffffff; color: #1e293b; border: 1px solid #94a3b8;">
            <thead>
                <tr style="background: #e2e8f0; color: #0f172a; border-bottom: 2px solid #64748b; font-weight: bold;">
                    <th style="padding: 9px 6px; text-align: center; width: 45px;">순번</th>
                    <th style="padding: 9px 8px; text-align: left;">교차로명</th>
                    <th style="padding: 9px 6px; text-align: center; width: 85px;">교차로ID</th>
                    <th style="padding: 9px 6px; text-align: center; width: 65px;">주기(C)</th>
                    <th style="padding: 9px 6px; text-align: center; width: 75px;">옵셋(Offset)</th>
                    <th style="padding: 9px 6px; text-align: center; width: 65px;">제어기</th>
                    <th style="padding: 9px 6px; text-align: center; width: 65px;">보행신호</th>
                    <th style="padding: 9px 6px; text-align: center; width: 75px;">운영현시</th>
                </tr>
            </thead>
            <tbody>
                ${rowsHtml}
            </tbody>
        </table>
    </div>

    <!-- [사용자 요구 반영] 반응형 현시표 (Interactive Phase Diagrams) -->
    <div style="margin-top: 18px;">
        <div style="font-size: 13px; font-weight: bold; color: #0284c7; margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
            🚦 소속 교차로별 반응형 현시표 (Interactive Phase Diagrams)
        </div>
        <div style="font-size: 11px; color: #64748b; margin-bottom: 10px;">
            ※ 각 교차로의 A링 및 B링 이동류 방향(직진/좌회전) 화살표와 현시별 배분 시간(초)을 표기합니다.
        </div>
        <div style="display:flex; flex-direction:column; gap:2px;">
            ${ipdCardsHtml}
        </div>
    </div>`;
}



// ── [보조 4] 그룹 TOD 운영계획표 HTML ──
function generateGroupTODTableHtml(gid, group) {
    if (!group || !group.schedules) {
        return `<div style="color:#94a3b8; font-size:12px; padding:8px;">그룹 TOD 데이터가 존재하지 않습니다.</div>`;
    }
    const dayNames = ['일계획 1 (평일)', '일계획 2 (금요일)', '일계획 3 (토요일)', '일계획 4 (일요일)', '일계획 5 (특수일)'];
    let tablesHtml = '';

    for (let d = 0; d < Math.min(3, group.schedules.length); d++) {
        const slots = group.schedules[d] || [];
        const validSlots = slots.filter(s => s && s.h >= 0);
        if (validSlots.length === 0) continue;

        let slotRows = validSlots.map(s => {
            const timeStr = `${String(s.h).padStart(2,'0')}:${String(s.m).padStart(2,'0')}`;
            return `<tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
                <td style="padding:6px; text-align:center; font-weight:600;">${timeStr}</td>
                <td style="padding:6px; text-align:center; color:#38bdf8;">${s.cycle || 120}초</td>
                <td style="padding:6px; text-align:center;">패턴 #${s.idx || 1}</td>
            </tr>`;
        }).join('');

        tablesHtml += `
        <div style="flex:1; min-width:180px; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.08); border-radius:6px; padding:10px;">
            <div style="font-size:12px; font-weight:bold; color:#f59e0b; margin-bottom:8px;">📅 ${dayNames[d] || `일계획 ${d+1}`}</div>
            <table style="width:100%; border-collapse:collapse; font-size:11px;">
                <thead>
                    <tr style="color:#94a3b8; border-bottom:1px solid rgba(255,255,255,0.1);">
                        <th>시작시각</th><th>주기</th><th>현시맵</th>
                    </tr>
                </thead>
                <tbody>
                    ${slotRows}
                </tbody>
            </table>
        </div>`;
    }

    return `<div style="display:flex; gap:12px; flex-wrap:wrap; margin-top:8px;">${tablesHtml}</div>`;
}

// ── [보조 5] 클라이언트 폴백 AI 리포트 (그룹) ──
function generateClientGroupFallback(gid, gName, totalDistM, members, cycle, bandUp, bandDown, bandEfficiency) {
    const avgDist = Math.round(totalDistM / Math.max(1, members.length - 1));
    return `### 4. 그 외 수록 분석 및 수석 신호운영분석관 종합 진단 소견

#### 가. 연동 대역폭(Bandwidth) 및 양방향 진행파 품질 평가
- **연동 대역 분석**: 대표 주기 ${cycle}초 기준, 정방향 대역폭은 **${bandUp.bandwidth.toFixed(1)}초(${bandUp.ratio.toFixed(1)}%)**, 역방향 대역폭은 **${bandDown.bandwidth.toFixed(1)}초(${bandDown.ratio.toFixed(1)}%)**로 산출됨.
- **양방향 연동 대역 효율(Band Efficiency)**: **${bandEfficiency}%** 수준으로 평가되며, 설계속도 50 km/h 기준 간선도로의 원활한 주행 연속성이 확보됨.

#### 나. 구간별 이격 거리 및 대기행렬(Queue) 관리 분석
- **공간적 특성**: 총 연장 ${(totalDistM / 1000).toFixed(2)} km 구간 내 ${members.length}개 교차로가 배치되어 평균 간격은 **${avgDist} m**임.
- **병목 구간 진단**: 인접 교차로 간격이 250m 이하인 단거리 구간은 대기행렬 역류(Spillback) 방지를 위해 주방향 녹색 시작 시간 및 초기 큐 클리어링(Queue Clearing) 오프셋 미세조정이 권고됨.

#### 다. 시간대별 TOD 신호주기 전이(Transition) 적합성 검토
- 첨두 ↔ 비첨두 주기 전이 시 신호 분산 리스크를 최소화하기 위해 점진적 전이(Add/Subtract 기법) 적용이 타당함.

#### 라. 수석 신호운영 분석관의 종합 개선 권고사항
1. **옵셋 미세조정**: 상/하향 대역폭 균형성을 위해 기점/종점 인접 교차로의 옵셋 편차를 ±3~5초 범위에서 현장 실측 조정 권장.
2. **보행신호 적합성**: 주방향 보행신호 잔여시간과 차량 황색신호 간의 인터락 및 LPI(보행자 우선출발) 도입 검토 요망.
3. **감응신호 도입 검토**: 부도로 교통량이 적은 시간대(심야/주말)에는 비연동 독립 감응제어로 전환하여 간선 직진 차량의 불필요한 지체를 최소화할 것.`;
}

// ── [공통 렌더링 함수] ──
function renderAIReportMarkdown(rawReport, title) {
    const content = document.getElementById('ai-report-content');
    if (!content) return;

    let formattedText = typeof marked !== 'undefined' ? marked.parse(rawReport) : rawReport;
    formattedText = `<div class="ai-report-markdown">${formattedText}</div>`;

    window.__lastAIReportHTML = formattedText;
    window.__lastAIReportTitle = title;

    content.innerHTML = `
        <div style="display: flex; justify-content: flex-end; gap: 10px; margin-bottom: 15px;">
            <button onclick="printAIReport()" style="background: rgba(255,183,77,0.15); border: 1px solid #ffb74d; color: #ffb74d; padding: 4px 12px; border-radius: 4px; font-size: 11px; cursor: pointer; display: flex; align-items: center; gap: 4px;">🖨️ PDF 출력</button>
            <button onclick="generateAIReport()" style="background: none; border: 1px solid #4a90e2; color: #4a90e2; padding: 4px 12px; border-radius: 4px; font-size: 11px; cursor: pointer; display: flex; align-items: center; gap: 4px;">🔄 다시 분석하기</button>
        </div>
        ${formattedText}
    `;
}

function calculateStats(inters) {
    if (typeof renderAdvancedInsights === 'function') {
        const stats = renderAdvancedInsights(inters, true);
        if (stats) return stats;
    }
    return { error: "Stats engine unavailable" };
}
window.calculateStats = calculateStats;

// ── [인쇄 및 PDF 팝업] ──
function printAIReport() {
    const title = window.__lastAIReportTitle || 'SIGMA 교통운영 분석 리포트';
    const reportHtml = window.__lastAIReportHTML || '<p>출력할 리포트 데이터가 없습니다.</p>';

    const printWin = window.open('', '_blank', 'width=1050,height=920,scrollbars=yes');
    if (!printWin) {
        alert("팝업이 차단되었습니다. 팝업 허용 후 다시 시도해주세요.");
        return;
    }

    printWin.document.open();
    printWin.document.write(`
    <!DOCTYPE html>
    <html lang="ko">
    <head>
        <meta charset="UTF-8">
        <title>${title}</title>
        <style>
            @page { size: A4 portrait; margin: 12mm 10mm; }
            *, *:before, *:after {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                color-adjust: exact !important;
            }
            body {
                font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                background: #ffffff !important;
                color: #0f172a !important;
                line-height: 1.6;
                margin: 0;
                padding: 12px;
            }
            h1, h2, h3, h4 { color: #0284c7 !important; margin-top: 0; }
            
            /* 카드 및 컨테이너 흰색 고대비 강제 */
            .ai-group-report-container { color: #0f172a !important; }
            .report-section {
                background: #ffffff !important;
                border: 1px solid #cbd5e1 !important;
                border-radius: 8px;
                padding: 16px;
                margin-bottom: 20px;
                box-shadow: none !important;
                page-break-inside: avoid;
            }
            .report-section h3 {
                color: #0284c7 !important;
                border-left: 4px solid #0284c7 !important;
                padding-left: 10px;
                margin-top: 0;
                margin-bottom: 12px;
            }

            /* 개요 지표 카드 흰색 테마 변환 */
            .metric-card, div[style*="background:rgba(0,0,0,0.3)"] {
                background: #f8fafc !important;
                border: 1px solid #cbd5e1 !important;
                color: #0f172a !important;
            }
            div[style*="background:rgba(0,0,0,0.3)"] div {
                color: #0f172a !important;
            }

            /* 테이블 인쇄 최적화 */
            table {
                width: 100%;
                border-collapse: collapse;
                margin: 10px 0;
                font-size: 11px;
                background: #ffffff !important;
            }
            th {
                background: #e2e8f0 !important;
                color: #0f172a !important;
                font-weight: bold;
                border: 1px solid #94a3b8 !important;
                padding: 7px 6px;
            }
            td {
                border: 1px solid #cbd5e1 !important;
                color: #1e293b !important;
                padding: 6px 8px;
                background: #ffffff !important;
            }
            tr:nth-child(even) td {
                background: #f8fafc !important;
            }

            /* AI 마크다운 본문 고대비 잉크 블랙 강제 */
            .ai-report-markdown, .ai-report-markdown p, .ai-report-markdown li, .ai-report-markdown span, .ai-report-markdown div {
                color: #0f172a !important;
                font-size: 10.5pt !important;
                line-height: 1.7 !important;
            }
            .ai-report-markdown h4 {
                color: #0369a1 !important;
                font-size: 12pt !important;
                margin-top: 14px !important;
                margin-bottom: 6px !important;
            }
            .ai-report-markdown strong {
                color: #000000 !important;
                font-weight: bold !important;
            }

            img { max-width: 100%; height: auto; page-break-inside: avoid; }
            svg { max-width: 100%; height: auto; page-break-inside: avoid; }
            .no-print { margin-bottom: 18px; }

            @media print {
                .no-print { display: none !important; }
                body { padding: 0; color: #000 !important; }
                .report-section { page-break-inside: avoid; }
            }
        </style>
    </head>
    <body>
        <div class="no-print" style="text-align:right;">
            <button onclick="window.print()" style="padding: 8px 18px; background: #0284c7; color: #fff; border: none; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 13px; box-shadow: 0 2px 4px rgba(0,0,0,0.15);">
                🖨️ PDF 다운로드 / 인쇄
            </button>
            <button onclick="window.close()" style="padding: 8px 18px; background: #64748b; color: #fff; border: none; border-radius: 4px; font-weight: bold; cursor: pointer; margin-left: 8px; font-size: 13px;">
                닫기
            </button>
        </div>
        <div id="print-content">
            ${reportHtml}
        </div>
        <script>
            setTimeout(() => {
                window.focus();
            }, 300);
        </script>
    </body>
    </html>
    `);
    printWin.document.close();
}
window.printAIReport = printAIReport;


