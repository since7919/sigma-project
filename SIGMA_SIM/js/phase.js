/**
 * phase.js
 * ─────────────────────────────────────────────
 * Phase/Split 테이블 렌더링, TOD 관리, 요일 전환,
 * 일괄 저장(saveSettingsAndApply), 요약 테이블
 * 의존: config.js, utils.js, ui.js
 */

/* ══════════════════════════════════════════
 *  듀얼링 테이블 렌더링
 * ══════════════════════════════════════════ */
function renderRingTables() {
    const jid = STATE.activeJid;
    const dayIdx = STATE.currentJunctionDayTypeIdx;

    // 교차로 선택 여부에 따른 DB 버튼 제어
    const btnUpdate = document.getElementById('btn-junction-db-update');
    const btnRevert = document.getElementById('btn-junction-db-revert');
    if (btnUpdate && btnRevert) {
        if (jid) {
            btnUpdate.disabled = false;
            btnUpdate.style.opacity = "1";
            btnUpdate.style.cursor = "pointer";
            btnRevert.disabled = false;
            btnRevert.style.opacity = "1";
            btnRevert.style.cursor = "pointer";
        } else {
            btnUpdate.disabled = true;
            btnUpdate.style.opacity = "0.5";
            btnUpdate.style.cursor = "not-allowed";
            btnRevert.disabled = true;
            btnRevert.style.opacity = "0.5";
            btnRevert.style.cursor = "not-allowed";
        }
    }

    // 체크박스 상태 먼저 확인 (하단에서 사용됨)
    const onlySplits = document.getElementById('chk-show-split-details')?.checked;
    const isDual = document.getElementById('chk-dual-ring')?.checked;

    const j = jid ? STATE.junctions[jid] : {
        movA: [0, 0, 0, 0, 0, 0, 0, 0], movB: [0, 0, 0, 0, 0, 0, 0, 0],
        pedMovA: [0, 0, 0, 0, 0, 0, 0, 0], pedMovB: [0, 0, 0, 0, 0, 0, 0, 0],
        dayPlans: JSON.parse(JSON.stringify(DEFAULT_PLAN_CACHE.dayPlans)),
        schedules: JSON.parse(JSON.stringify(DEFAULT_PLAN_CACHE.schedules))
    };

    const pIdx = parseInt(UI.planIdx?.value) || 0;
    const p = j.dayPlans ? j.dayPlans[dayIdx][pIdx] : DEFAULT_PLAN_CACHE.dayPlans[0][0];

    let s = { h: 0, m: 0, cycle: 100 };
    if (jid && j.schedules) {
        s = j.schedules[dayIdx]?.[pIdx] || s; // [수정] 그룹연동보다 개별 CSV 데이터를 우선 표시 (사용자 요청)
    }

    UI.todDisplayTime.innerText = s.h === -1 ? "M/F (미사용)" : `${String(s.h).padStart(2, '0')}:${String(s.m).padStart(2, '0')}`;
    UI.todInpCycle.value = s.cycle || 100;
    UI.todInpOffset.value = p.offset;

    // ── [Migration] signalMaps가 없으면 생성 ──
    if (j.id && !j.signalMaps) {
        // 기존 Plan 데이터에서 전적색, 황색 등 초기값 추출 (첫날 첫플랜 기준)
        const refP = (j.dayPlans && j.dayPlans[0]) ? j.dayPlans[0][0] : DEFAULT_PLAN_CACHE.dayPlans[0][0];

        j.signalMaps = Array.from({ length: 6 }, () => ({
            movA: [0, 0, 0, 0, 0, 0, 0, 0],
            movB: [0, 0, 0, 0, 0, 0, 0, 0],
            pedMovA: [0, 0, 0, 0, 0, 0, 0, 0],
            pedMovB: [0, 0, 0, 0, 0, 0, 0, 0],
            yellowA: [...(refP.yellowA || [3, 3, 3, 3, 0, 0, 0, 0])],
            yellowB: [...(refP.yellowB || [3, 3, 3, 3, 0, 0, 0, 0])],
            allredA: [...(refP.allredA || [2, 2, 2, 2, 0, 0, 0, 0])],
            allredB: [...(refP.allredB || [2, 2, 2, 2, 0, 0, 0, 0])],
            pedA: [...(refP.pedA || [0, 15, 0, 15, 0, 0, 0, 0])],
            pedB: [...(refP.pedB || [0, 15, 0, 15, 0, 0, 0, 0])],
            pedDelayA: [...(refP.pedDelayA || [0, 2, 0, 2, 0, 0, 0, 0])],
            pedDelayB: [...(refP.pedDelayB || [0, 2, 0, 2, 0, 0, 0, 0])],
            mainMovements: ['A0', 'B0']
        }));
        // 기존 0번 맵에 데이터 복사
        j.signalMaps[0].movA = [...(j.movA || [0, 0, 0, 0, 0, 0, 0, 0])];
        j.signalMaps[0].movB = [...(j.movB || [0, 0, 0, 0, 0, 0, 0, 0])];
        j.signalMaps[0].pedMovA = [...(j.pedMovA || [0, 0, 0, 0, 0, 0, 0, 0])];
        j.signalMaps[0].pedMovB = [...(j.pedMovB || [0, 0, 0, 0, 0, 0, 0, 0])];
        j.signalMaps[0].mainMovements = [...(j.mainMovements || ['A0', 'B0'])];
    }

    const smIdx = STATE.currentSignalMapIdx || 0;
    const fallbackMap = {
        movA: [0, 0, 0, 0, 0, 0, 0, 0], movB: [0, 0, 0, 0, 0, 0, 0, 0],
        pedMovA: [0, 0, 0, 0, 0, 0, 0, 0], pedMovB: [0, 0, 0, 0, 0, 0, 0, 0],
        yellowA: [3, 3, 3, 3, 0, 0, 0, 0], yellowB: [3, 3, 3, 3, 0, 0, 0, 0],
        allredA: [2, 2, 2, 2, 0, 0, 0, 0], allredB: [2, 2, 2, 2, 0, 0, 0, 0],
        pedA: [0, 0, 0, 0, 0, 0, 0, 0], pedB: [0, 0, 0, 0, 0, 0, 0, 0],
        pedDelayA: [0, 0, 0, 0, 0, 0, 0, 0], pedDelayB: [0, 0, 0, 0, 0, 0, 0, 0],
        mainMovements: ['A0', 'B0']
    };
    const sm = (j.signalMaps && j.signalMaps[smIdx]) ? j.signalMaps[smIdx] : fallbackMap;



    const movRows = [
        { label: 'A링 (Mov)', key: 'movA', src: sm },
        { label: 'B링 (Mov)', key: 'movB', src: sm },
        { label: 'A링 보행ID', key: 'pedMovA', src: sm },
        { label: 'B링 보행ID', key: 'pedMovB', src: sm }
    ].map(r => ({
        cells: [
            { content: r.label, className: 'row-label' },
            ...(r.src[r.key] || [0, 0, 0, 0, 0, 0, 0, 0]).map((v, i) => ({
                content: `<input type="number" class="sigma-input inp-${r.key}" data-type="mov" data-key="${r.key}" data-index="${i}" value="${v}">`
            }))
        ]
    }));

    // 방향 및 주현시 데이터 추가
    ['A', 'B'].forEach((ring, idx) => {
        const movs = idx === 0 ? sm.movA : sm.movB;
        movRows.push({
            cells: [
                { content: `${ring}링 (Dir)`, className: 'row-label' },
                ...movs.map(m => {
                    const a = getVisualArrow(m);
                    return { content: `<div class="visual-arrow-icon" style="transform: rotate(${a.ang}deg); color: var(--accent)">${a.type}</div>` };
                })
            ]
        });
    });

    ['A', 'B'].forEach(ring => {
        const mainMovs = sm.mainMovements || [];
        movRows.push({
            cells: [
                { content: `주현시 ${ring}`, className: 'row-label', attr: { title: '최대 2개 선택' } },
                ...[0, 1, 2, 3, 4, 5, 6, 7].map(i => ({
                    content: `<input type="checkbox" class="inp-main-mov" value="${ring}${i}" ${mainMovs.includes(ring + i) ? 'checked' : ''} onchange="limitCheck(this)">`
                }))
            ]
        });
    });

    SigmaUI.renderTable('mov-combined-container', {
        tableId: 'mov-combined-table',
        className: 'sigma-table',
        head: ['구분', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8'],
        rows: movRows
    });

    // ── Phase/Split 테이블 (SigmaUI 사용) ──

    // ── Phase/Split 테이블: B링 숨김은 Split 계열에만 적용 ──
    // 현시계획(Map)의 Yellow/AllRed/Ped 등은 항상 A/B 모두 표시
    const phaseRows = [
        { lab: 'Split A', key: 'splitA', cls: '', isDetail: false, isSplit: true },
        { lab: 'Split B', key: 'splitB', cls: '', isDetail: false, ring: 'B', isSplit: true },
        { lab: 'MG A (최소녹색)', key: 'minGreenA', cls: 'c-green', isDetail: true, isSplit: false, calc: (i) => {
            const pA = sm.pedA?.[i] || 0; const arA = sm.allredA?.[i] || 0; const dlyA = sm.pedDelayA?.[i] || 0;
            return pA > 0 ? pA + arA + dlyA : 7 + arA;
        }},
        { lab: 'MG B (최소녹색)', key: 'minGreenB', cls: 'c-green', isDetail: true, ring: 'B', isSplit: false, calc: (i) => {
            const pB = sm.pedB?.[i] || 0; const arB = sm.allredB?.[i] || 0; const dlyB = sm.pedDelayB?.[i] || 0;
            return pB > 0 ? pB + arB + dlyB : 7 + arB;
        }},
        { lab: 'AllRed A', key: 'allredA', cls: 'c-red', isDetail: true, isSplit: false },
        { lab: 'AllRed B', key: 'allredB', cls: 'c-red', isDetail: true, ring: 'B', isSplit: false },
        { lab: 'Yellow A', key: 'yellowA', cls: 'c-yellow', isDetail: true, isSplit: false },
        { lab: 'Yellow B', key: 'yellowB', cls: 'c-yellow', isDetail: true, ring: 'B', isSplit: false },
        { lab: 'PedDly A', key: 'pedDelayA', cls: '', isDetail: true, isSplit: false },
        { lab: 'PedDly B', key: 'pedDelayB', cls: '', isDetail: true, ring: 'B', isSplit: false },
        { lab: '보행녹색 A', key: 'pedGreenA', cls: 'c-green', isDetail: true, isSplit: false },
        { lab: '보행녹색 B', key: 'pedGreenB', cls: 'c-green', isDetail: true, ring: 'B', isSplit: false },
        { lab: '보행점멸 A', key: 'pedFlashA', cls: 'c-orange', isDetail: true, isSplit: false },
        { lab: '보행점멸 B', key: 'pedFlashB', cls: 'c-orange', isDetail: true, ring: 'B', isSplit: false },
        { lab: '보행합계 A', key: 'pedA', cls: 'c-green-bold', isDetail: true, isSplit: false },
        { lab: '보행합계 B', key: 'pedB', cls: 'c-green-bold', isDetail: true, ring: 'B', isSplit: false }
    ]
        // B링 숨김: 모든 ring:'B' 행은 isDual 체크 상태에 따름
        .filter(r => (!r.isDetail || !onlySplits) && (r.ring !== 'B' || isDual))
        .map(r => ({
            cells: [
                { content: r.lab, className: `row-label ${r.cls}` },
                ...[0, 1, 2, 3, 4, 5, 6, 7].map(i => {
                    const isDisabled = (r.ring === 'B' && !isDual) ? 'disabled' : '';
                    const source = (r.key.startsWith('split')) ? p : sm;
                    const val = (source[r.key] || [])[i] || 0;
                    
                    let extraStyle = '';
                    let tooltip = '';
                    if (r.key === 'splitA' || r.key === 'splitB') {
                        const isB = r.key === 'splitB';
                        const ped = isB ? sm.pedB?.[i] : sm.pedA?.[i];
                        const arr = isB ? sm.allredB?.[i] : sm.allredA?.[i];
                        const dly = isB ? sm.pedDelayB?.[i] : sm.pedDelayA?.[i];
                        const yel = isB ? sm.yellowB?.[i] : sm.yellowA?.[i];
                        
                        const mg = (ped || 0) > 0 ? (ped || 0) + (dly || 0) + (arr || 0) : 7 + (arr || 0);
                        const mgWithYellow = mg + (yel || 0);
                        
                        if (val > 0 && val < mg) {
                            extraStyle = 'border: 2px solid #ff4d4d; box-shadow: 0 0 10px rgba(255,77,77,0.5); background: rgba(255,77,77,0.15); color: #ffffff !important; font-weight: bold;';
                            tooltip = `안전감사 위기! 최소녹색시간(${mg}초) 미달`;
                        } else if (val > 0 && val < mgWithYellow) {
                            extraStyle = 'border: 2px solid #ffcc00; box-shadow: 0 0 10px rgba(255,204,0,0.5); background: rgba(255,204,0,0.1); color: #ffffff !important; font-weight: bold;';
                            tooltip = `안전감사 주의! 최소녹색+황색(${mgWithYellow}초) 미달`;
                        }
                    }

                    return {
                        content: r.calc
                            ? `<input type="text" class="sigma-input" value="${r.calc(i)}" readonly 
                                style="color:#10b981 !important; font-weight:bold; cursor:default; border-color:rgba(16,185,129,0.15) !important;" 
                                title="최소녹색시간 = 보행합계+전적색+보행지연 (또는 최소 7초+전적색)">`
                            : `<input type="number" class="sigma-input ${r.cls} inp-${r.key}" data-key="${r.key}" data-index="${i}" value="${val}" style="${extraStyle}" title="${tooltip}" ${isDisabled}>`,
                        className: r.cls
                    };
                })
            ]
        }));

    SigmaUI.renderTable('tod-container', {
        tableId: 'tod-table',
        className: 'sigma-table',
        head: ['항목', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8'],
        rows: phaseRows
    });

    updateCycleDisplay(p, s);
    renderSummaryTable();
    syncConfigEditUI();
    updateJunctionDayUI();
    renderSignalMapButtons();

    // 입력 이벤트 위임 및 내비게이션 초기화 (table_logic.js에서 처리)
    if (typeof initTableEventHandlers === 'function') initTableEventHandlers();
}

/** 플렉스타임맵 선택 버튼 렌더링 */
function renderSignalMapButtons() {
    const container = document.getElementById('signal-map-selector');
    if (!container) return;

    const jid = STATE.activeJid;
    const j = jid ? STATE.junctions[jid] : null;
    const labels = ["일반", "시차1", "시차2", "시차3", "시차4", "시차5"];

    let html = '<div style="background:rgba(0,0,0,0.2); padding:6px 8px; border-radius:10px; border:1px solid rgba(255,255,255,0.08); margin-bottom:12px;">';

    // 헤더: 타이틀 + 복사 UI 통합 (높이 축소)
    html += `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; padding-bottom:4px; border-bottom:1px solid rgba(255,255,255,0.05);">
            <span style="font-size:11px; font-weight:bold; color:var(--accent);">🚦 현시계획(Map) 설정</span>
            <div style="display:flex; align-items:center; gap:4px;">
                <select id="sm-copy-from" class="input-dark" style="width:55px; height:18px; font-size:10px; border-radius:3px; padding:0 2px;">
                    ${labels.map((l, idx) => `<option value="${idx}">${l}</option>`).join('')}
                </select>
                <button class="btn-sm" onclick="copySignalMap()" 
                        style="background:#8e44ad; padding:0 6px; font-size:10px; border-radius:3px; height:18px;">복사</button>
            </div>
        </div>`;

    // 본문: 3열 그리드 배치
    html += '<div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:5px;">';
    labels.forEach((lab, i) => {
        const isActive = (STATE.currentSignalMapIdx === i);
        const mapData = j ? j.signalMaps[i] : { startTime: "", endTime: "" };
        const startTime = mapData.startTime || "";
        const endTime = mapData.endTime || "";

        html += `
            <div style="display:flex; flex-direction:column; gap:2px; background:rgba(255,255,255,0.02); padding:2px; border-radius:6px; ${isActive ? 'outline:1px solid var(--accent);' : ''}">
                <button class="btn-sm" onclick="changeSignalMap(${i})" 
                    style="width:100%; font-size:10px; border:none; height:18px; line-height:18px;
                    background:${isActive ? 'var(--accent)' : 'rgba(255,255,255,0.05)'};
                    color:${isActive ? '#000' : '#888'}; font-weight:${isActive ? 'bold' : 'normal'}; border-radius:4px;">
                    ${lab}
                </button>`;

        if (i === 0) {
            html += `<span style="font-size:9px; color:#444; text-align:center; height:16px; line-height:16px;">상시 운영</span>`;
        } else {
            html += `
                <div style="display:flex; align-items:center; gap:0px; justify-content:center; height:16px;">
                    <input type="text" class="input-dark inp-sm-start" data-index="${i}" value="${startTime}" placeholder="00:00" onchange="updateSignalMapTime(${i}, 'startTime', this.value)"
                           style="width:42px; height:14px; font-size:9px; text-align:center; border:none; background:rgba(0,0,0,0.3); padding:0; border-radius:2px;">
                    <span style="color:#444; font-size:8px; margin:0 1px;">~</span>
                    <input type="text" class="input-dark inp-sm-end" data-index="${i}" value="${endTime}" placeholder="00:00" onchange="updateSignalMapTime(${i}, 'endTime', this.value)"
                           style="width:42px; height:14px; font-size:9px; text-align:center; border:none; background:rgba(0,0,0,0.3); padding:0; border-radius:2px;">
                </div>`;
        }
        html += `</div>`;
    });
    html += '</div></div>';
    container.innerHTML = html;
}

/** 현시계획(Signal Map) 데이터 복사 */
function copySignalMap() {
    const jid = STATE.activeJid;
    if (!jid || !STATE.junctions[jid]) return;

    const fromIdx = parseInt(document.getElementById('sm-copy-from').value);
    const toIdx = STATE.currentSignalMapIdx || 0;

    if (fromIdx === toIdx) { alert("출발지와 목적지가 동일합니다."); return; }

window.updateSignalMapTime = function(mapIdx, field, val) {
    const jid = STATE.activeJid;
    if (!jid || !STATE.junctions[jid]) return;
    const j = STATE.junctions[jid];
    if (j.signalMaps && j.signalMaps[mapIdx]) {
        j.signalMaps[mapIdx][field] = val;
    }
};

    /* ══════════════════════════════════════════
 *  실시간 동기화 (saveSettingsAndApply 삭제됨)
 * ══════════════════════════════════════════ */
// [개정] 버튼 기반의 saveSettingsAndApply를 삭제하고 
// table_logic.js의 실시간 핸들러가 모든 데이터 업데이트를 담당합니다.

    const labels = ["일반", "플렉스1", "플렉스2", "플렉스3", "플렉스4", "플렉스5"];
    if (!confirm(`${labels[fromIdx]}의 현시 데이터를 ${labels[toIdx]}로 복사하시겠습니까?`)) return;

    const j = STATE.junctions[jid];
    const fromMap = j.signalMaps[fromIdx];
    const toMap = j.signalMaps[toIdx];

    // 주요 현시 데이터 복사 (시간 제외)
    toMap.movA = [...fromMap.movA];
    toMap.movB = [...fromMap.movB];
    toMap.pedMovA = [...fromMap.pedMovA];
    toMap.pedMovB = [...fromMap.pedMovB];
    toMap.mainMovements = [...(fromMap.mainMovements || [])];

    // 0번(일반)으로 복사된 경우 루트 필드도 동기화
    if (toIdx === 0) {
        j.movA = [...toMap.movA];
        j.movB = [...toMap.movB];
        j.pedMovA = [...toMap.pedMovA];
        j.pedMovB = [...toMap.pedMovB];
        j.mainMovements = [...toMap.mainMovements];
    }

    renderRingTables();
    refreshVisibleArrows();
    alert(`복사가 완료되었습니다. '변경사항 적용'을 눌러 저장하세요.`);
}

/* ══════════════════════════════════════════
            if (!isDual && key.endsWith('A')) {
                p[key.replace(/A$/, 'B')] = [...vals];
            }
        }
    });

    // 4. 연동 값 (Plan 레벨)
    const todOffsetEl = document.getElementById('tod-inp-offset');
    if (todOffsetEl) p.offset = parseInt(todOffsetEl.value) || 0;

    // 5. 점멸 설정 (Junction 레벨)
    const flashEnableEl = document.getElementById('flash-enable');
    if (flashEnableEl) {
        j.flashEnable = flashEnableEl.checked;
        j.flashYellows = (document.getElementById('inp-flash-yellows')?.value || "").split(',').map(s => s.trim()).filter(s => s);
        j.flashReds = (document.getElementById('inp-flash-reds')?.value || "").split(',').map(s => s.trim()).filter(s => s);

        j.flashTimes = [];
        for (let i = 1; i <= 3; i++) {
            const start = document.getElementById(`flash-start-${i}`)?.value;
            const end = document.getElementById(`flash-end-${i}`)?.value;
            if (start || end) j.flashTimes.push({ s: start || "", e: end || "" });
        }
    }

    // 6. 운영자 개입 (Junction 레벨)
    const opEnableEl = document.getElementById('op-enable');
    if (opEnableEl) {
        j.opIntervention = {
            enable: opEnableEl.checked,
            rows: []
        };
        for (let i = 1; i <= 3; i++) {
            const start = document.getElementById(`op-start-${i}`)?.value;
            const end = document.getElementById(`op-end-${i}`)?.value;
            if (start || end) {
                j.opIntervention.rows.push({
                    s: start || "",
                    e: end || "",
                    cycle: parseInt(document.getElementById(`op-cycle-${i}`)?.value) || 0,
                    offset: parseInt(document.getElementById(`op-offset-${i}`)?.value) || 0,
                    splitA: (document.getElementById(`op-splits-a-${i}`)?.value || "").split(',').map(v => parseInt(v.trim()) || 0),
                    splitB: (document.getElementById(`op-splits-b-${i}`)?.value || "").split(',').map(v => parseInt(v.trim()) || 0)
                });
            }
        }
    }

    // 7. 주간계획 저장
    const wpInputs = document.querySelectorAll('.inp-weekly-plan');
    if (wpInputs.length > 0) {
        const wpArr = Array.from(wpInputs)
            .sort((a, b) => (parseInt(a.dataset.index) || 0) - (parseInt(b.dataset.index) || 0))
            .map(el => el.value || "1");
        j.weeklyPlan = wpArr.join(';');
    }

    renderRingTables();
    renderSummaryTable();
    refreshVisibleArrows();

    alert("현재 교차로의 모든 변경사항이 엔진(STATE)에 적용되었습니다.\n전체 DB에 영구 반영하려면 'DB 업데이트' 또는 'DB 통합 저장'을 클릭하세요.");
}

/* ══════════════════════════════════════════
 *  주현시 제한 체크
 * ══════════════════════════════════════════ */
function limitCheck(el) {
    const checked = document.querySelectorAll('.inp-main-mov:checked');
    if (checked.length > 2) {
        el.checked = false;
        alert("주현시는 최대 2개 이동류까지 선택할 수 있습니다.");
    }
}

/**
 * 요약 테이블 렌더링 (SigmaUI 사용)
 */
function renderSummaryTable() {
    const jid = STATE.activeJid;
    const j = jid ? STATE.junctions[jid] : {
        dayPlans: JSON.parse(JSON.stringify(DEFAULT_PLAN_CACHE.dayPlans)),
        schedules: JSON.parse(JSON.stringify(DEFAULT_PLAN_CACHE.schedules))
    };
    const cur = parseInt(UI.planIdx?.value) || 0;
    const dayIdx = STATE.currentJunctionDayTypeIdx;
    const plans = j.dayPlans[dayIdx];
    // [사용자 요청] 신호주기 및 시간은 그룹 스케줄 대신 교차로 개별 데이터(db_tod_plans.csv)를 강제 참조
    const schedules = j.schedules ? j.schedules[dayIdx] : null;

    const rows = [];
    for (let i = 0; i < 16; i++) {
        const p = (plans && plans[i]) ? plans[i] : { offset: 0, splitA: Array(8).fill(0), splitB: Array(8).fill(0) };
        const s = (schedules && schedules[i]) ? schedules[i] : { h: -1, m: 0, cycle: 100 };

        const sumA = (p.splitA || []).reduce((a, b) => a + b, 0);
        const sumB = (p.splitB || []).reduce((a, b) => a + b, 0);
        const targetCycle = s.cycle || 100;
        
        // [보완] 소수점 오차 방지를 위해 반올림 후 비교
        const isMatchA = (Math.round(sumA) === Math.round(targetCycle));
        const isMatchB = (Math.round(sumB) === Math.round(targetCycle));
        
        const isActive = (i === cur);
        const isUnused = (s.h === -1);
        
        // [사용자 요청] 미사용 슬롯이라도 목표 주기가 설정되어 있다면 합계 불일치 여부를 모두 표시
        const hasMismatch = (targetCycle > 0) && (!isMatchA || !isMatchB);

        const unusedStyle = isUnused ? 'opacity: 0.45; filter: grayscale(0.5);' : '';
        const mismatchStyle = hasMismatch ? 'background:rgba(255,68,68,0.15);' : '';
        const rowStyle = (isActive ? 'background:rgba(0,212,255,0.12); border-left: 3px solid var(--accent);' : '') + unusedStyle + mismatchStyle;

        const cycleWarningStyle = hasMismatch ? 'border: 1px solid #ff4444; background: rgba(255,68,68,0.4) !important; color: #fff !important; font-weight:900; box-shadow: 0 0 8px rgba(255,68,68,0.4);' : 'color:var(--accent); font-weight:bold;';
        const cycleTooltip = hasMismatch ? `주기 불일치! (A합계:${Math.round(sumA)}, B합계:${Math.round(sumB)}, 목표:${targetCycle})` : `목표 주기: ${targetCycle}s`;

        rows.push({
            style: rowStyle,
            cells: [
                {
                    content: i + 1,
                    className: 'row-num',
                    style: `cursor:pointer; font-weight:600; color:${isActive ? 'var(--accent)' : '#888'}`,
                    attr: { onclick: `jumpToTOD(${i})` }
                },
                {
                    content: `
                        <div style="display:flex; justify-content:center; align-items:center; gap:2px;">
                            <input type="number" class="sigma-input input-mini" value="${s.h}" min="-1" max="23" data-type="sched" data-field="h" data-index="${i}">
                            <span style="color:#666;">:</span>
                            <input type="number" class="sigma-input input-mini" value="${s.m}" min="0" max="59" data-type="sched" data-field="m" data-index="${i}">
                        </div>`
                },
                {
                    content: `<input type="number" class="sigma-input input-mini" value="${targetCycle}" style="${cycleWarningStyle}" title="${cycleTooltip}" data-type="sched" data-field="cycle" data-index="${i}">`
                },
                {
                    content: `<input type="number" class="sigma-input input-mini" value="${p.offset}" data-type="offset" data-index="${i}">`
                },
                {
                    style: "text-align:left; padding:5px 10px; font-family:'Outfit', monospace; font-size:11.5px; line-height:1.3; cursor:pointer;",
                    attr: { onclick: `jumpToTOD(${i})` },
                    content: `
                        <span style="color:${isMatchA ? 'var(--accent)' : '#ff4444'}; font-weight:700;" title="${!isMatchA ? `A링 합계(${sumA})가 목표(${targetCycle})와 불일치` : ''}">A</span> <span style="color:${isMatchA ? '#eee' : '#ff4444'}">${(p.splitA || []).join(' ')}</span><br>
                        <span style="color:${isMatchB ? '#888' : '#ff4444'}; font-weight:700;" title="${!isMatchB ? `B링 합계(${sumB})가 목표(${targetCycle})와 불일치` : ''}">B</span> <span style="color:${isMatchB ? '#888' : '#ff4444'}">${(p.splitB || []).join(' ')}</span>`
                }
            ]
        });
    }

    SigmaUI.renderTable('tod-summary-container', {
        tableId: 'tod-summary-table',
        className: 'sigma-table',
        head: [
            { label: '№', style: 'width:25px;' },
            { label: '시작시간', style: 'width:85px;' },
            { 
                label: `주기 <button class="btn-xs" style="padding:1px 3px; font-size:9px; background:var(--accent); color:#000; border:none; border-radius:2px; cursor:pointer; margin-left:3px;" onclick="autoFillCycleFromSplits()" title="모든 슬롯의 주기를 스플릿 합계로 자동 채움">합계</button>`, 
                style: 'width:55px;' 
            },
            { label: '연동', style: 'width:40px;' },
            { label: '신호시간 (Split A / B)' }
        ],
        rows: rows
    });
}


/**
 * [사용자 요청] 모든 TOD 슬롯의 주기를 스플릿 합계(A링 기준)로 자동 동기화
 */
function autoFillCycleFromSplits() {
    const jid = STATE.activeJid;
    if (!jid) return;
    const j = STATE.junctions[jid];
    const dayIdx = STATE.currentJunctionDayTypeIdx;
    
    if (!confirm("모든 슬롯의 주기를 현재 스플릿 합계로 변경하시겠습니까?")) return;

    for (let i = 0; i < 16; i++) {
        const p = j.dayPlans[dayIdx][i];
        const s = j.schedules[dayIdx][i];
        if (!p || !s) continue;

        const sumA = (p.splitA || []).reduce((a, b) => a + b, 0);
        if (sumA > 0) {
            s.cycle = Math.round(sumA);
        }
    }
    
    renderSummaryTable();
    // 현재 선택된 슬롯의 UI도 갱신
    const curIdx = parseInt(UI.planIdx.value);
    const curSumA = (j.dayPlans[dayIdx][curIdx].splitA || []).reduce((a, b) => a + b, 0);
    if (curSumA > 0 && document.getElementById('tod-inp-cycle')) {
        document.getElementById('tod-inp-cycle').value = Math.round(curSumA);
    }
    
    alert("모든 슬롯의 주기가 스플릿 합계와 동기화되었습니다.");
}

/* ══════════════════════════════════════════
 *  TOD 헬퍼 함수들
 * ══════════════════════════════════════════ */
function jumpToTOD(idx) { UI.planIdx.value = idx; renderRingTables(); }

function updateSched(idx, f, v) {
    const j = STATE.junctions[STATE.activeJid];
    const dayIdx = STATE.currentJunctionDayTypeIdx;
    j.schedules[dayIdx][idx][f] = parseInt(v) || 0;
    if (idx === parseInt(UI.planIdx.value)) renderRingTables();
    renderSummaryTable();
    if (document.getElementById('tab-stats').classList.contains('active')) renderStats();
}

function updateTargetCycle(v) {
    const j = STATE.junctions[STATE.activeJid];
    const idx = parseInt(UI.planIdx.value);
    const dayIdx = STATE.currentJunctionDayTypeIdx;
    j.schedules[dayIdx][idx].cycle = parseInt(v) || 0;
    renderRingTables();
    if (document.getElementById('tab-stats').classList.contains('active')) renderStats();
}

function updateOffsetTable(idx, v) {
    STATE.junctions[STATE.activeJid].dayPlans[STATE.currentJunctionDayTypeIdx][idx].offset = parseInt(v) || 0;
    if (idx === parseInt(UI.planIdx.value)) renderRingTables();
    renderSummaryTable();
    if (typeof renderTimeSpaceDiagram === 'function') renderTimeSpaceDiagram();
}

function updateOffset(v) {
    const idx = parseInt(UI.planIdx.value);
    STATE.junctions[STATE.activeJid].dayPlans[STATE.currentJunctionDayTypeIdx][idx].offset = parseInt(v) || 0;
    renderSummaryTable();
    if (typeof renderTimeSpaceDiagram === 'function') renderTimeSpaceDiagram();
}

function updateMov(k, i, v) {
    const j = STATE.junctions[STATE.activeJid];
    const isDual = document.getElementById('chk-dual-ring')?.checked;
    const smIdx = STATE.currentSignalMapIdx || 0;
    const sm = (j.signalMaps && j.signalMaps[smIdx]) ? j.signalMaps[smIdx] : null;

    if (!sm) return;

    sm[k][i] = parseInt(v) || 0;

    // [Sync Logic] Dual(각각입력)이 체크해제(!isDual) 상태에서 A링 데이터를 변경하면 B링도 자동으로 따라감
    if (!isDual && k.endsWith('A')) {
        const keyB = k.replace(/A$/, 'B');
        if (sm[keyB]) {
            sm[keyB][i] = parseInt(v) || 0;
        }
    }

    renderRingTables();
    refreshVisibleArrows();
}

function updatePlanVal(k, i, v) {
    const idx = parseInt(UI.planIdx.value);
    const dayIdx = STATE.currentJunctionDayTypeIdx;
    const j = STATE.junctions[STATE.activeJid];
    const isDual = document.getElementById('chk-dual-ring')?.checked; // Dual(각각입력) 체크 상태

    // 현재 값 저장
    j.dayPlans[dayIdx][idx][k][i] = parseInt(v) || 0;

    // [Sync Logic] Dual(각각입력)이 체크해제(!isDual) 상태에서 A링 데이터를 변경하면 B링도 자동으로 따라감
    if (!isDual && k.endsWith('A')) {
        const keyB = k.replace(/A$/, 'B');
        if (j.dayPlans[dayIdx][idx][keyB]) {
            j.dayPlans[dayIdx][idx][keyB][i] = parseInt(v) || 0;
        }
    }

    renderRingTables();
    renderSummaryTable();
}

/* ══════════════════════════════════════════
 *  요일 타입 전환
 * ══════════════════════════════════════════ */
function changeJunctionDayType(idx) {
    STATE.currentJunctionDayTypeIdx = idx;

    const jid = STATE.activeJid;
    const j = (jid && STATE.junctions[jid]) ? STATE.junctions[jid] : null;

    // [수정] 현시계획 맵의 기본 디폴트를 항상 '일반(0)'으로 설정 (사용자 요청)
    let targetMapIdx = 0;
    STATE.currentSignalMapIdx = targetMapIdx;

    try {
        document.getElementById('j-current-day-label').innerText = `📅 현재 조회: ${DAY_LABELS[idx]} TOD (TOD SLOT 1~16)`;
    } catch(e) { console.warn("Day label update failed", e); }

    try {
        renderRingTables();
        renderSummaryTable();
        updateJunctionDayUI();
    } catch(e) {
        console.error("[changeJunctionDayType] Rendering failed", e);
    }

    // UI 업데이트
    const selMap = document.getElementById('sel-signal-map');
    if (selMap) selMap.value = STATE.currentSignalMapIdx;
}

/** 플렉스타임맵(현시맵) 전환 */
function changeSignalMap(idx) {
    const mapVal = parseInt(idx);
    STATE.currentSignalMapIdx = mapVal;

    // [Fix] 현재 선택된 교차로의 특정 요일(DayIdx)에 이 맵 번호를 영구 매핑
    const jid = STATE.activeJid;
    if (jid && STATE.junctions[jid]) {
        const j = STATE.junctions[jid];
        if (!j.dayPlanMapIds) j.dayPlanMapIds = new Array(10).fill(0);
        j.dayPlanMapIds[STATE.currentJunctionDayTypeIdx] = mapVal;
    }

    renderRingTables();
    refreshVisibleArrows();
}

function copyJunctionTODDay() {
    const jid = STATE.activeJid;
    if (!jid || !STATE.junctions[jid]) return;
    const fromIdx = parseInt(document.getElementById('j-copy-from-day').value);
    const toIdx = STATE.currentJunctionDayTypeIdx;

    if (fromIdx === toIdx) { alert("출발지와 목적지가 같습니다."); return; }
    if (!confirm(`${DAY_LABELS[fromIdx]}의 모든 TOD 데이터(시작시간, 주기, 연동, 스플릿)를 ${DAY_LABELS[toIdx]}로 복사하시겠습니까?`)) return;

    const j = STATE.junctions[jid];

    // 1. DayPlans 복사 (연동/스플릿 등)
    j.dayPlans[toIdx] = JSON.parse(JSON.stringify(j.dayPlans[fromIdx]));

    // 2. Schedules 복사 (시작시간/주기)
    if (j.group && STATE.groups[j.group]) {
        // 그룹인 경우 그룹 스케줄 데이터 복사
        const groupScheds = STATE.groups[j.group].schedules;
        groupScheds[toIdx] = JSON.parse(JSON.stringify(groupScheds[fromIdx]));
    } else {
        // 단독인 경우 로컬 스케줄 데이터 복사
        j.schedules[toIdx] = JSON.parse(JSON.stringify(j.schedules[fromIdx]));
    }

    renderRingTables();
    renderSummaryTable();
    alert("복사 완료되었습니다.");
}

/** 요일 타입 전환 UI (주간계획 포함) */
/** 교차로 TOD 상세 섹션 렌더링 (주간계획 포함) */
function updateJunctionDayUI() {
    const container = document.getElementById('j-day-type-buttons');
    if (!container) return;

    const jid = STATE.activeJid;
    const j = jid ? STATE.junctions[jid] : null;
    const weeklyPlan = (j && j.weeklyPlan) ? j.weeklyPlan.split(';') : ["1", "1", "1", "1", "1", "2", "3"];

    const renderBtn = (lab, i) => {
        const isActive = (STATE.currentJunctionDayTypeIdx === i);
        return `
            <label style="display:flex; align-items:center; gap:4px; font-size:10px; cursor:pointer; 
                          padding:3px 6px; border-radius:4px; border:1px solid ${isActive ? 'var(--accent)' : 'rgba(255,255,255,0.08)'};
                          background: ${isActive ? 'rgba(241,196,15,0.12)' : 'rgba(255,255,255,0.02)'};
                          color: ${isActive ? 'white' : '#777'}; transition: all 0.2s; flex:1; justify-content:center;">
                <input type="radio" name="edit-junction-day" style="width:11px; height:11px; margin:0;" 
                       ${isActive ? 'checked' : ''} onchange="changeJunctionDayType(${i})">
                <span style="${isActive ? 'font-weight:bold; color:var(--accent);' : ''}">${lab}</span>
            </label>
        `;
    };

    let html = '<div style="display:flex; flex-direction:column; gap:6px; width:100%;">';

    // ── 1행: 주간계획 (Weekly Plan) ──
    const weekLabels = ["월", "화", "수", "목", "금", "토", "일"];
    html += `
        <div id="weekly-plan-panel" style="background:rgba(255,255,255,0.02); padding:6px 8px; border-radius:8px; border:1px solid rgba(255,255,255,0.05); display:flex; align-items:center; gap:10px;">
            <div style="font-size:10px; font-weight:bold; color:var(--accent); width:45px; text-align:center;">주간계획</div>
            <div style="display:flex; gap:2px; flex:1;">
                ${weekLabels.map((w, idx) => {
        const planNum = parseInt(weeklyPlan[idx] || 1);
        return `
                        <div style="display:flex; flex-direction:column; align-items:center; flex:1; padding:2px 0; border-radius:4px; background:rgba(0,0,0,0.25);">
                            <span style="font-size:9px; color:${idx >= 5 ? '#e74c3c' : '#777'}; font-weight:bold; line-height:1;">${w}</span>
                            <input type="number" class="sigma-input inp-weekly-plan" data-index="${idx}" min="1" max="10" 
                                   value="${planNum}" onchange="updateWeeklyPlanData(${idx}, this.value)"
                                   style="width:100%; height:16px; font-size:10.5px; font-weight:bold; text-align:center; color:var(--accent); background:transparent; border:none; padding:0; margin-top:1px;">
                        </div>
                    `;
    }).join('')}
            </div>
        </div>
    `;

    // 2행: 일계획 버튼군 (일반/시차 통합 스타일)
    html += `
        <div style="display:flex; flex-direction:column; gap:4px; background:rgba(0,0,0,0.1); padding:6px 8px; border-radius:8px; border:1px solid rgba(255,255,255,0.03);">
            <div style="display:flex; align-items:center; gap:10px;">
                <span style="font-size:10px; color:#aaa; width:45px; font-weight:bold; text-align:center;">일계획 1~5</span>
                <div style="display:flex; gap:2px; flex:1;">
                    ${Array.from({ length: 5 }, (_, i) => renderBtn(DAY_LABELS[i], i)).join('')}
                </div>
            </div>
            <div style="display:flex; align-items:center; gap:10px;">
                <span style="font-size:10px; color:var(--accent); width:45px; font-weight:bold; opacity:0.7; text-align:center;">시차 6~10</span>
                <div style="display:flex; gap:2px; flex:1;">
                    ${Array.from({ length: 5 }, (_, i) => renderBtn(DAY_LABELS[i + 5], i + 5)).join('')}
                </div>
            </div>
        </div>
    `;

    html += '</div>';
    container.innerHTML = html;
}

/** [신규] DB 파일 관리 전용 패널 렌더링 (최상단 고정) */
function renderDBManagementPanel() {
    const container = document.getElementById('db-management-container');
    if (!container) return;

    container.innerHTML = `
        <div class="card-neon neon-border" style="padding:10px 12px; background:linear-gradient(135deg, rgba(52,152,219,0.1), rgba(15,15,15,0.3)); border:1px solid rgba(52,152,219,0.3);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <div style="font-size:12px; font-weight:800; color:#3498db; display:flex; align-items:center; gap:6px; font-family:'Outfit'; letter-spacing:0.5px;">
                    📂 DB 파일 관리 (Maps & Plans)
                </div>
                <div style="display:flex; gap:6px;">
                     <button onclick="saveNormalizedDBFiles()" 
                            style="height:24px; padding:0 12px; background:rgba(241,196,15,0.25); color:var(--accent); border:1px solid rgba(241,196,15,0.5); border-radius:4px; font-size:11px; font-weight:bold; cursor:pointer; transition:all 0.2s;">
                        💾 작업 내용 내부 저장
                    </button>
                </div>
            </div>
            <div style="display:flex; gap:8px;">
                <button onclick="document.getElementById('file-load-inter').click()" 
                        style="flex:1; height:28px; background:rgba(52,152,219,0.1); color:#3498db; border:1px solid rgba(52,152,219,0.2); border-radius:5px; font-size:11px; font-weight:bold; cursor:pointer;"
                        onmouseover="this.style.background='rgba(52,152,219,0.2)'" onmouseout="this.style.background='rgba(52,152,219,0.1)'">
                    📤 교차로 로드
                </button>
                <button onclick="document.getElementById('file-load-maps').click()" 
                        style="flex:1; height:28px; background:rgba(255,255,255,0.04); color:#bbb; border:1px solid rgba(255,255,255,0.1); border-radius:5px; font-size:11px; font-weight:bold; cursor:pointer;"
                        onmouseover="this.style.background='rgba(255,255,255,0.08)'" onmouseout="this.style.background='rgba(255,255,255,0.04)'">
                    📤 신호맵 로드
                </button>
                <button onclick="document.getElementById('file-load-plans').click()" 
                        style="flex:1; height:28px; background:rgba(255,255,255,0.04); color:#bbb; border:1px solid rgba(255,255,255,0.1); border-radius:5px; font-size:11px; font-weight:bold; cursor:pointer;"
                        onmouseover="this.style.background='rgba(255,255,255,0.08)'" onmouseout="this.style.background='rgba(255,255,255,0.04)'">
                    📤 TOD계획 로드
                </button>
            </div>
            <input type="file" id="file-load-inter" style="display:none;" onchange="handleDBFileLoad(this, 'inter')">
            <input type="file" id="file-load-maps" style="display:none;" onchange="handleDBFileLoad(this, 'maps')">
            <input type="file" id="file-load-plans" style="display:none;" onchange="handleDBFileLoad(this, 'plans')">
        </div>
    `;
}

/** 주간계획 데이터 실시간 모델 반영 */
function updateWeeklyPlanData(idx, val) {
    const jid = STATE.activeJid;
    if (!jid || !STATE.junctions[jid]) return;
    const j = STATE.junctions[jid];

    let wp = (j.weeklyPlan || "1;1;1;1;1;2;3").split(';');
    wp[idx] = val;
    j.weeklyPlan = wp.join(';');

    // 라벨 갱신
    const label = document.getElementById(`wp-label-${idx}`);
    if (label) label.innerText = DAY_LABELS[parseInt(val) - 1] || `일계획${val}`;

    console.log(`Weekly Plan Updated [${idx}]: ${val}`);
}


/* handleDBFileLoad 함수가 js/data.js로 이동되었습니다. */


/**
 * 템플릿 기반 현시 정보 적용
 */
function applyPhaseTemplate(type) {
    if (!STATE.activeJid) {
        alert("교차로를 먼저 선택하세요.");
        return;
    }
    const templateNames = {
        'cross': '4지_동서', 'cross_v': '4지_남북',
        't_bottom': '3지_북', 't_left': '3지_동', 't_top': '3지_남', 't_right': '3지_서',
        'h_line': '단일_동서', 'v_line': '단일_남북'
    };
    const templateName = templateNames[type] || type;

    if (!confirm(`${templateName} 템플릿을 적용하시겠습니까? 기존 현시 구성 데이터가 덮어씌워집니다.`)) return;

    const j = STATE.junctions[STATE.activeJid];
    const smIdx = STATE.currentSignalMapIdx || 0;
    const sm = (j.signalMaps && j.signalMaps[smIdx]) ? j.signalMaps[smIdx] : { movA: [], movB: [], pedMovA: [], pedMovB: [] };

    // 기본 값 초기화
    sm.movA = [0, 0, 0, 0, 0, 0, 0, 0];
    sm.movB = [0, 0, 0, 0, 0, 0, 0, 0];
    sm.pedMovA = [0, 0, 0, 0, 0, 0, 0, 0];
    sm.pedMovB = [0, 0, 0, 0, 0, 0, 0, 0];

    // 템플릿별 데이터 정의 (사용자 요청: 6,5,8,7 / 2,1,4,3 구조)
    switch (type) {
        case 'cross': // 4지 (+, 동서주방향)
            sm.movA = [6, 5, 8, 7, 0, 0, 0, 0];
            sm.movB = [2, 1, 4, 3, 0, 0, 0, 0];
            sm.pedMovA = [106, 0, 108, 0, 0, 0, 0, 0];
            sm.pedMovB = [102, 0, 104, 0, 0, 0, 0, 0];
            break;
        case 'cross_v': // 4지 (+, 남북주방향)
            sm.movA = [8, 7, 6, 5, 0, 0, 0, 0];
            sm.movB = [4, 3, 2, 1, 0, 0, 0, 0];
            sm.pedMovA = [108, 0, 106, 0, 0, 0, 0, 0];
            sm.pedMovB = [104, 0, 102, 0, 0, 0, 0, 0];
            break;
        case 't_bottom': // 3지 (ㅗ)
            sm.movA = [6, 5, 7, 0, 0, 0, 0, 0];
            sm.movB = [2, 18, 18, 0, 0, 0, 0, 0];
            sm.pedMovA = [106, 105, 107, 0, 0, 0, 0, 0];
            sm.pedMovB = [0, 0, 0, 0, 0, 0, 0, 0];
            break;
        case 't_left': // 3지 (ㅏ)
            sm.movA = [8, 7, 18, 0, 0, 0, 0, 0];
            sm.movB = [4, 18, 1, 0, 0, 0, 0, 0];
            sm.pedMovA = [108, 107, 0, 0, 0, 0, 0, 0];
            sm.pedMovB = [0, 0, 101, 0, 0, 0, 0, 0];
            break;
        case 't_top': // 3지 (ㅜ)
            sm.movA = [6, 18, 18, 0, 0, 0, 0, 0];
            sm.movB = [2, 1, 3, 0, 0, 0, 0, 0];
            sm.pedMovA = [0, 0, 0, 0, 0, 0, 0, 0];
            sm.pedMovB = [102, 101, 103, 0, 0, 0, 0, 0];
            break;
        case 't_right': // 3지 (ㅓ)
            sm.movA = [8, 18, 5, 0, 0, 0, 0, 0];
            sm.movB = [4, 3, 18, 0, 0, 0, 0, 0];
            sm.pedMovA = [0, 0, 105, 0, 0, 0, 0, 0];
            sm.pedMovB = [104, 103, 0, 0, 0, 0, 0, 0];
            break;
        case 'h_line': // 단일 (ㅡ)
            sm.movA = [6, 17, 0, 0, 0, 0, 0, 0];
            sm.movB = [2, 17, 0, 0, 0, 0, 0, 0];
            sm.pedMovA = [0, 108, 0, 0, 0, 0, 0, 0];
            sm.pedMovB = [0, 104, 0, 0, 0, 0, 0, 0];
            break;
        case 'v_line': // 단일 (ㅣ)
            sm.movA = [8, 17, 0, 0, 0, 0, 0, 0];
            sm.movB = [4, 17, 0, 0, 0, 0, 0, 0];
            sm.pedMovA = [0, 106, 0, 0, 0, 0, 0, 0];
            sm.pedMovB = [0, 102, 0, 0, 0, 0, 0, 0];
            break;
    }

    // 0번(일반)인 경우 루트 값도 동기화 (하위 호환성)
    if (smIdx === 0) {
        j.movA = [...sm.movA];
        j.movB = [...sm.movB];
        j.pedMovA = [...sm.pedMovA];
        j.pedMovB = [...sm.pedMovB];
    }

    renderRingTables();
    refreshVisibleArrows();
    alert(`${DAY_LABELS[smIdx]}에 ${templateName} 템플릿 데이터가 설정되었습니다. '변경사항 적용' 버튼을 눌러 확정하세요.`);
}

