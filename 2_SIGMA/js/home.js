/**
 * js/home.js
 * ─────────────────────────────────────────────
 * 대시보드(한눈에보기) 요약 정보 및 미니 통계 관리
 */

function renderHomeDashboard() {
    console.log("[Home] Rendering Dashboard...");
    
    if (typeof STATE === 'undefined') return;

    // 1. 기본 통계 업데이트 (DB 통계 엔진과 동기화)
    const jids = Object.keys(STATE.junctions);
    const groups = STATE.groups ? Object.keys(STATE.groups).length : 0;
    
    let totalPlanCount = 0;
    let activePlanCount = 0;
    
    jids.forEach(jid => {
        const j = STATE.junctions[jid];
        if (j.schedules) {
            j.schedules.forEach(day => {
                if (Array.isArray(day)) {
                    totalPlanCount += day.length;
                    day.forEach(slot => { if (slot.h !== -1) activePlanCount++; });
                }
            });
        }
    });

    const yearbookCount = (STATE.civilData && Array.isArray(STATE.civilData)) ? STATE.civilData.length : 0;

    // DOM 반영
    const updateEl = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.innerText = (typeof val === 'number') ? val.toLocaleString() : val;
    };

    updateEl('home-stat-junctions', jids.length);
    updateEl('home-stat-groups', groups);
    updateEl('home-stat-plans', `${activePlanCount.toLocaleString()} / ${totalPlanCount.toLocaleString()}`);
    updateEl('home-stat-yearbook', yearbookCount);

    // 2. 미니 차트/인사이트 생성
    renderHomeMiniChart(jids);
}

/**
 * 그룹별 교차로 분포 미니 차트 (Simple HTML/CSS Bar Chart)
 */
function renderHomeMiniChart(jids) {
    const container = document.getElementById('home-dashboard-chart');
    if (!container) return;

    if (jids.length === 0) {
        container.innerHTML = "데이터가 로드되지 않았습니다.";
        return;
    }

    // 그룹별 교차로 수 집계
    const groupMap = {};
    jids.forEach(jid => {
        const g = STATE.junctions[jid].group || 0;
        groupMap[g] = (groupMap[g] || 0) + 1;
    });

    const groupEntries = Object.entries(groupMap).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const maxVal = Math.max(...Object.values(groupMap));

    let html = '<div style="display:flex; align-items:flex-end; gap:15px; height:100px; width:100%; padding: 0 10px;">';
    groupEntries.forEach(([gid, count]) => {
        const height = (count / maxVal) * 80;
        const color = gid === "0" ? "#555" : `hsl(${(parseInt(gid) * 137) % 360}, 70%, 60%)`;
        html += `
            <div style="flex:1; display:flex; flex-direction:column; align-items:center; gap:5px;">
                <div style="font-size:9px; color:#aaa;">${count}</div>
                <div style="width:100%; height:${height}px; background:${color}; border-radius:4px 4px 0 0; opacity:0.8; box-shadow:0 0 10px ${color}44;"></div>
                <div style="font-size:9px; color:#777; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; width:100%; text-align:center;">G-${gid}</div>
            </div>
        `;
    });
    html += '</div>';

    container.innerHTML = html;

    // 인사이트 텍스트
    const insightEl = document.getElementById('home-dashboard-insight');
    if (insightEl) {
        const topGroup = groupEntries[0];
        if (topGroup) {
            insightEl.innerHTML = `
                💡 <b>분석 결과:</b> 현재 <b>그룹 ${topGroup[0]}</b>에 가장 많은 교차로(${topGroup[1]}개)가 배정되어 있습니다. 
                전체 운영 계획 중 톤다운된 미사용 슬롯은 제외하고 검토하시기 바랍니다.
            `;
        }
    }
}
