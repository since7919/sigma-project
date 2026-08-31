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

    const sIdx = parseInt(UI.planIdx?.value) || 0;
    
    let s = { h: 0, m: 0, cycle: 100, idx: sIdx + 1 };
    if (jid && j.schedules) {
        s = j.schedules[dayIdx]?.[sIdx] || s; // 개별 스케줄 데이터 우선 참조
    }
    
    // 현재 타임 슬롯이 가리키는 패턴 번호 (1~16)를 이용해 패턴(dayPlans)을 조회
    const patternIdx = s.idx || 1;
    const p = j.dayPlans ? j.dayPlans[dayIdx][patternIdx - 1] : DEFAULT_PLAN_CACHE.dayPlans[0][0];

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



    const movRows = [];

    const categories = [
        { id: 'dir', label: 'Dir' },
        { id: 'mov', label: 'Mov' },
        { id: 'ped', label: '보행ID' },
        { id: 'main', label: '주현시' }
    ];

    categories.forEach(cat => {
        ['A', 'B'].forEach((ring, idx) => {
            const movs = idx === 0 ? sm.movA : sm.movB;
            const movKey = idx === 0 ? 'movA' : 'movB';
            const pedKey = idx === 0 ? 'pedMovA' : 'pedMovB';
            const mainMovs = sm.mainMovements || [];

            const cells = [];
            
            if (idx === 0) {
                cells.push({ content: cat.label, className: 'row-label', attr: { rowspan: 2 }, style: 'vertical-align:middle; text-align:center; font-weight:bold; background:rgba(0,0,0,0.2); width:40px;' });
            }
            
            if (cat.id === 'dir') {
                cells.push({ content: `${ring}링`, className: 'row-label', style: 'width:40px;' });
                movs.forEach(m => {
                    const a = getVisualArrow(m);
                    cells.push({ content: `<div class="visual-arrow-icon" style="transform: rotate(${a.ang}deg); color: var(--accent)">${a.type}</div>` });
                });
            } else if (cat.id === 'mov') {
                cells.push({ content: `${ring}링`, className: 'row-label', style: 'width:40px;' });
                (sm[movKey] || [0, 0, 0, 0, 0, 0, 0, 0]).forEach((v, i) => {
                    cells.push({ content: `<input type="number" class="sigma-input inp-${movKey}" data-type="mov" data-key="${movKey}" data-index="${i}" value="${v}">` });
                });
            } else if (cat.id === 'ped') {
                cells.push({ content: `${ring}링`, className: 'row-label', style: 'width:40px;' });
                (sm[pedKey] || [0, 0, 0, 0, 0, 0, 0, 0]).forEach((v, i) => {
                    cells.push({ content: `<input type="number" class="sigma-input inp-${pedKey}" data-type="mov" data-key="${pedKey}" data-index="${i}" value="${v}">` });
                });
            } else if (cat.id === 'main') {
                cells.push({ content: `${ring}링`, className: 'row-label', attr: { title: '최대 2개 선택' }, style: 'width:40px;' });
                [0, 1, 2, 3, 4, 5, 6, 7].forEach(i => {
                    cells.push({ content: `<input type="checkbox" class="inp-main-mov" value="${ring}${i}" ${mainMovs.includes(ring + i) ? 'checked' : ''} onchange="limitCheck(this)">` });
                });
            }
            
            movRows.push({ cells });
        });
    });

    SigmaUI.renderTable('mov-combined-container', {
        tableId: 'mov-combined-table',
        className: 'sigma-table',
        head: [{label: '구분', colspan: 2}, 'P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8'],
        rows: movRows
    });

    // ── Phase/Split 테이블 (SigmaUI 사용) ──

    // ── Phase/Split 테이블: B링 숨김은 Split 계열에만 적용 ──
    // 현시계획(Map)의 Yellow/AllRed/Ped 등은 항상 A/B 모두 표시
    const phaseCategories = [
        { id: 'split', label: 'Split', keyA: 'splitA', keyB: 'splitB', clsA: '', clsB: '', isDetail: false },
        { id: 'mg', label: 'MG (최소녹색)', keyA: 'minGreenA', keyB: 'minGreenB', clsA: 'c-green', clsB: 'c-green', isDetail: true,
          calcA: (i) => { const pA = sm.pedA?.[i] || 0; const arA = sm.allredA?.[i] || 0; const dlyA = sm.pedDelayA?.[i] || 0; return pA > 0 ? pA + arA + dlyA : 7 + arA; },
          calcB: (i) => { const pB = sm.pedB?.[i] || 0; const arB = sm.allredB?.[i] || 0; const dlyB = sm.pedDelayB?.[i] || 0; return pB > 0 ? pB + arB + dlyB : 7 + arB; },
          calcTitle: '최소녹색시간 = 보행합계+전적색+보행지연 (또는 최소 7초+전적색)'
        },
        { id: 'allred', label: 'AllRed', keyA: 'allredA', keyB: 'allredB', clsA: 'c-red', clsB: 'c-red', isDetail: true },
        { id: 'yellow', label: 'Yellow', keyA: 'yellowA', keyB: 'yellowB', clsA: 'c-yellow', clsB: 'c-yellow', isDetail: true },
        { id: 'peddly', label: 'PedDly', keyA: 'pedDelayA', keyB: 'pedDelayB', clsA: '', clsB: '', isDetail: true },
        { id: 'pedgreen', label: '보행녹색', keyA: 'pedGreenA', keyB: 'pedGreenB', clsA: '', clsB: '', isDetail: true },
        { id: 'pedflash', label: '보행점멸', keyA: 'pedFlashA', keyB: 'pedFlashB', clsA: 'c-orange', clsB: 'c-orange', isDetail: true },
        { id: 'pedtotal', label: '보행합계', keyA: 'pedA', keyB: 'pedB', clsA: 'c-green-bold', clsB: 'c-green-bold', isDetail: true,
          calcA: (i) => { return (sm.pedGreenA?.[i] || 0) + (sm.pedFlashA?.[i] || 0); },
          calcB: (i) => { return (sm.pedGreenB?.[i] || 0) + (sm.pedFlashB?.[i] || 0); },
          calcTitle: '자동 계산 (보행녹색 + 보행점멸)'
        }
    ];

    const finalPhaseRows = [];

    phaseCategories.forEach(cat => {
        if (cat.isDetail && onlySplits) return;

        const rings = isDual ? ['A', 'B'] : ['A'];
        
        rings.forEach((ring, idx) => {
            const cells = [];
            
            if (idx === 0) {
                cells.push({ content: cat.label, className: 'row-label', attr: rings.length > 1 ? { rowspan: 2 } : {}, style: 'vertical-align:middle; text-align:center; font-weight:bold; background:rgba(0,0,0,0.2); width:80px;' });
            }
            
            const isB = (ring === 'B');
            const key = isB ? cat.keyB : cat.keyA;
            const cls = isB ? cat.clsB : cat.clsA;
            const calc = isB ? cat.calcB : cat.calcA;

            cells.push({ content: `${ring}링`, className: `row-label ${cls}`, style: 'width:40px; text-align:center;' });

            [0, 1, 2, 3, 4, 5, 6, 7].forEach(i => {
                const isDisabled = (isB && !isDual) ? 'disabled' : '';
                const source = (key.startsWith('split')) ? p : sm;
                const val = (source[key] || [])[i] || 0;
                
                let extraStyle = '';
                let tooltip = '';
                if (key === 'splitA' || key === 'splitB') {
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

                cells.push({
                    content: calc
                        ? `<input type="text" class="sigma-input" value="${calc(i)}" readonly 
                            style="color:#10b981 !important; font-weight:bold; cursor:default; border-color:rgba(16,185,129,0.15) !important;" 
                            title="${cat.calcTitle || ''}">`
                        : `<input type="number" class="sigma-input ${cls} inp-${key}" data-key="${key}" data-index="${i}" value="${val}" style="${extraStyle}" title="${tooltip}" ${isDisabled}>`,
                    className: cls
                });
            });

            finalPhaseRows.push({ cells });
        });
    });

    SigmaUI.renderTable('tod-container', {
        tableId: 'tod-table',
        className: 'sigma-table',
        head: [{label: '항목', colspan: 2}, 'P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8'],
        rows: finalPhaseRows
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
            <span style="font-size:12px; font-weight:bold; color:var(--accent);">🚦 현시계획(Map) 설정</span>
            <div style="display:flex; align-items:center; gap:4px;">
                <button class="phase-action-btn phase-btn-purple" onclick="copySignalMap()" title="다른 현시계획 데이터 복사해오기">📋 가져오기</button>
            </div>
        </div>`;

    // 본문: 3열 그리드 배치
    html += '<div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:5px;">';
    labels.forEach((lab, i) => {
        const isActive = (STATE.currentSignalMapIdx === i);

        html += `
            <div style="display:flex; flex-direction:column; gap:2px; background:rgba(255,255,255,0.02); padding:2px; border-radius:6px; ${isActive ? 'outline:1px solid var(--accent);' : ''}">
                <button class="btn-sm" onclick="changeSignalMap(${i})" 
                    style="width:100%; font-size:10px; border:none; height:26px; line-height:26px;
                    background:${isActive ? 'var(--accent)' : 'rgba(255,255,255,0.05)'};
                    color:${isActive ? '#000' : '#888'}; font-weight:${isActive ? 'bold' : 'normal'}; border-radius:4px;">
                    ${lab}
                </button>
            </div>`;
    });
    html += '</div></div>';
    container.innerHTML = html;
}



/** 현시계획(Signal Map) 데이터 복사 */
function copySignalMap() {
    const jid = STATE.activeJid;
    if (!jid || !STATE.junctions[jid]) return;

    const toIdx = STATE.currentSignalMapIdx || 0;
    const labels = ["일반", "시차1", "시차2", "시차3", "시차4", "시차5"];
    
    let input = prompt(`현재 [${labels[toIdx]}] 화면입니다.\n\n데이터를 덮어쓸 원본 '현시계획 번호(0~5)'를 입력하세요:\n(0: 일반, 1: 시차1, 2: 시차2, 3: 시차3, 4: 시차4, 5: 시차5)`);
    if (!input) return;
    
    const fromIdx = parseInt(input, 10);
    if (isNaN(fromIdx) || fromIdx < 0 || fromIdx > 5) {
        alert("올바른 현시계획 번호(0~5)를 입력해주세요.");
        return;
    }

    if (fromIdx === toIdx) { alert("현재 보고 있는 현시계획과 동일합니다."); return; }
    if (!confirm(`'${labels[fromIdx]}'의 현시 데이터를 '${labels[toIdx]}' 화면으로 복사하여 덮어쓰시겠습니까?`)) return;

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
    const schedules = j.schedules ? j.schedules[dayIdx] : null;

    const selectedPatternIdx = (schedules && schedules[cur]) ? (schedules[cur].idx || 1) : 1;

    const generateTableHTML = (startIdx, endIdx) => {
        const rows = [];
        for (let i = startIdx; i < endIdx; i++) {
            const p = (plans && plans[i]) ? plans[i] : { cycle: 100, offset: 0, splitA: Array(8).fill(0), splitB: Array(8).fill(0) };
            const patternNum = i + 1;
            
            // 모든 일계획(1~10)을 뒤져서 이 패턴(patternNum)이 한 번이라도 사용되었는지 확인 (유저 요청: 공통 적용)
            let isUsedAnywhere = false;
            let firstGlobalSched = null;
            if (j.schedules) {
                for (let d = 0; d < 10; d++) {
                    const dSch = j.schedules[d];
                    if (dSch) {
                        const found = dSch.find(sch => sch && sch.idx === patternNum && sch.h !== -1);
                        if (found) {
                            isUsedAnywhere = true;
                            if (!firstGlobalSched) firstGlobalSched = found;
                            break;
                        }
                    }
                }
            }
            const isUnused = !isUsedAnywhere;
            const firstUsedSched = firstGlobalSched;
            const targetCycle = p.cycle || (firstUsedSched ? (firstUsedSched.cycle || 100) : 100);

            const sumA = (p.splitA || []).reduce((a, b) => a + b, 0);
            const sumB = (p.splitB || []).reduce((a, b) => a + b, 0);
            
            const isMatchA = (Math.round(sumA) === Math.round(targetCycle));
            const isMatchB = (Math.round(sumB) === Math.round(targetCycle));
            const isActive = (patternNum === selectedPatternIdx);
            
            const hasMismatch = !isUnused && (targetCycle > 0) && (!isMatchA || !isMatchB);

            const unusedStyle = isUnused ? 'opacity: 0.45; filter: grayscale(0.5);' : '';
            const mismatchStyle = hasMismatch ? 'background:rgba(255,68,68,0.15);' : '';
            const activeStyle = isActive ? 'background:rgba(0, 242, 254, 0.2); border: 2px solid #00f2fe; box-shadow: inset 0 0 15px rgba(0, 242, 254, 0.4);' : '';
            const rowStyle = (isActive ? activeStyle : mismatchStyle) + unusedStyle;

            const cycleWarningStyle = hasMismatch ? 'border: 1px solid #ff4444; background: rgba(255,68,68,0.4) !important; color: #fff !important; font-weight:900; box-shadow: 0 0 8px rgba(255,68,68,0.4);' : 'color:var(--accent); font-weight:bold;';
            const cycleTooltip = hasMismatch ? `주기 불일치 (A합계:${Math.round(sumA)}, B합계:${Math.round(sumB)}, 목표:${targetCycle})` : `목표 주기: ${targetCycle}s`;

            let idCell = null;
            if (i === 0) idCell = { content: '1', style: 'font-weight:bold; color:#cbd5e1; border-right: 1px solid rgba(255,255,255,0.05); background: rgba(255,255,255,0.02);', attr: { rowspan: 1 } };
            else if (i === 1) idCell = { content: '2', style: 'font-weight:bold; color:#cbd5e1; border-right: 1px solid rgba(255,255,255,0.05); background: rgba(255,255,255,0.02);', attr: { rowspan: 3 } };
            else if (i === 4) idCell = { content: '3', style: 'font-weight:bold; color:#cbd5e1; border-right: 1px solid rgba(255,255,255,0.05); background: rgba(255,255,255,0.02);', attr: { rowspan: 3 } };
            else if (i === 7) idCell = { content: '4', style: 'font-weight:bold; color:#cbd5e1; border-right: 1px solid rgba(255,255,255,0.05); background: rgba(255,255,255,0.02);', attr: { rowspan: 3 } };
            else if (i === 10) idCell = { content: '5', style: 'font-weight:bold; color:#cbd5e1; border-right: 1px solid rgba(255,255,255,0.05); background: rgba(255,255,255,0.02);', attr: { rowspan: 3 } };
            else if (i === 13) idCell = { content: '6', style: 'font-weight:bold; color:#cbd5e1; border-right: 1px solid rgba(255,255,255,0.05); background: rgba(255,255,255,0.02);', attr: { rowspan: 3 } };

            let rowCells = [];
            if (idCell) rowCells.push(idCell);

            rowCells.push(
                {
                    content: i + 1,
                    className: 'row-num',
                    style: `cursor:pointer; font-weight:600; color:${isActive ? 'var(--accent)' : (isUnused ? '#555' : '#fff')}`,
                    attr: { onclick: `jumpToTOD(${i})` }
                },
                {
                    content: `<input type="number" class="sigma-input input-mini" value="${targetCycle}" style="${cycleWarningStyle}; width: 45px; text-align: center;" title="${cycleTooltip}" data-type="pattern-cycle" data-index="${i}">`
                },
                {
                    content: `<input type="number" class="sigma-input input-mini" value="${p.offset}" data-type="offset" style="width: 35px; text-align: center;" data-index="${i}">`
                },
                {
                    style: "text-align:left; padding:5px 10px; font-family:'Outfit', monospace; font-size:11.5px; line-height:1.3;",
                    content: `
                        <div style="display:flex; align-items:center; margin-bottom:2px; gap:4px;">
                            <span style="color:${isMatchA ? 'var(--accent)' : '#ff4444'}; font-weight:700; width:12px; cursor:pointer;" onclick="jumpToTOD(${i})" title="${!isMatchA ? `A링 합계(${sumA})가 목표(${targetCycle})와 불일치` : ''}">A</span> 
                            ${ Array.from({length: 8}).map((_, k) => `<input type="text" class="sigma-input" style="width:20px; text-align:center; background:rgba(0,0,0,0.2); border:1px solid #333; border-radius:3px; color:${isMatchA ? '#eee' : '#ff4444'}; font-family:inherit; font-size:11px; padding:2px 0;" value="${p.splitA[k] || 0}" data-type="split-cell" data-ring="A" data-index="${i}" data-col="${k}">`).join('') }
                        </div>
                        <div style="display:flex; align-items:center; gap:4px;">
                            <span style="color:${isMatchB ? '#888' : '#ff4444'}; font-weight:700; width:12px; cursor:pointer;" onclick="jumpToTOD(${i})" title="${!isMatchB ? `B링 합계(${sumB})가 목표(${targetCycle})와 불일치` : ''}">B</span> 
                            ${ Array.from({length: 8}).map((_, k) => `<input type="text" class="sigma-input" style="width:20px; text-align:center; background:rgba(0,0,0,0.2); border:1px solid #333; border-radius:3px; color:${isMatchB ? '#888' : '#ff4444'}; font-family:inherit; font-size:11px; padding:2px 0;" value="${p.splitB[k] || 0}" data-type="split-cell" data-ring="B" data-index="${i}" data-col="${k}">`).join('') }
                        </div>`
                }
            );

            rows.push({
                style: rowStyle,
                cells: rowCells
            });
        }

        let html = `
            <div style="flex: 1; min-width: 320px; overflow-x: auto; background: #0f172a; border-radius: 6px; border: 1px solid rgba(255,255,255,0.08);">
                <table style="width: 100%; border-collapse: collapse; text-align: center; font-size: 11px;">
                    <thead>
                        <tr style="background: rgba(255,255,255,0.05);">
                            <th style="padding: 6px 4px; border-bottom: 1px solid rgba(255,255,255,0.08); width: 25px; color: #94a3b8;">No</th>
                            <th style="padding: 6px 4px; border-bottom: 1px solid rgba(255,255,255,0.08); width: 35px; color: #94a3b8;">Index</th>
                            <th style="padding: 6px 4px; border-bottom: 1px solid rgba(255,255,255,0.08); width: 55px; color: #94a3b8;">주기${startIdx === 0 ? ` <button class="btn-xs" style="padding:1px 3px; font-size:9px; background:var(--accent); color:#000; border:none; border-radius:2px; cursor:pointer; margin-left:3px;" onclick="autoFillCycleFromSplits()" title="모든 슬롯의 주기를 스플릿 합계로 자동 채움">합계</button>` : ''}</th>
                            <th style="padding: 6px 4px; border-bottom: 1px solid rgba(255,255,255,0.08); width: 40px; color: #94a3b8;">연동</th>
                            <th style="padding: 6px 4px; border-bottom: 1px solid rgba(255,255,255,0.08); color: #94a3b8;">신호시간 (Split A / B)</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        rows.forEach(r => {
            html += `<tr style="border-bottom: 1px solid rgba(255,255,255,0.03); ${r.style}">`;
            r.cells.forEach(c => {
                html += `<td style="padding: 2px; ${c.style || ''}" ${c.attr ? Object.entries(c.attr).map(([k,v])=>`${k}="${v}"`).join(' ') : ''}>${c.content}</td>`;
            });
            html += `</tr>`;
        });

        html += `
                    </tbody>
                </table>
            </div>
        `;
        return html;
    };

    const finalHtml = `
        <div style="width: 100%; align-items: flex-start;">
            ${generateTableHTML(0, 16)}
        </div>
    `;

    document.getElementById('tod-summary-container').innerHTML = finalHtml;
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
            p.cycle = Math.round(sumA);
            if (s) s.cycle = Math.round(sumA);
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

    // [Sync Logic] Auto-calculate pedA and pedB
    if (['pedGreenA', 'pedFlashA', 'pedGreenB', 'pedFlashB'].includes(k)) {
        if (!sm.pedA) sm.pedA = [0,0,0,0,0,0,0,0];
        if (!sm.pedB) sm.pedB = [0,0,0,0,0,0,0,0];
        
        if (k.endsWith('A')) {
            sm.pedA[i] = (sm.pedGreenA?.[i] || 0) + (sm.pedFlashA?.[i] || 0);
            if (!isDual) {
                sm.pedB[i] = (sm.pedGreenB?.[i] || 0) + (sm.pedFlashB?.[i] || 0);
            }
        } else {
            sm.pedB[i] = (sm.pedGreenB?.[i] || 0) + (sm.pedFlashB?.[i] || 0);
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
        let labelEl = document.getElementById('j-current-day-label');
        if (labelEl) {
            const planNum = idx + 1;
            const mapType = planNum <= 5 ? "일반맵" : "시차맵";
            labelEl.innerText = `${mapType} : 시간계획(${planNum})`;
            labelEl.style.color = '#38bdf8';
            labelEl.style.fontWeight = 'bold';
            labelEl.style.fontSize = '13px';
            labelEl.style.fontFamily = 'inherit';
        }
        let viewSel = document.getElementById('j-view-day-select');
        if (viewSel) viewSel.value = idx;
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
    const toIdx = STATE.currentJunctionDayTypeIdx;
    
    let input = prompt(`현재 [${DAY_LABELS[toIdx]}] 화면입니다.\n\n데이터를 덮어쓸 원본 '일계획 번호(1~10)'를 입력하세요:`);
    if (!input) return;
    
    const fromIdx = parseInt(input, 10) - 1;
    if (isNaN(fromIdx) || fromIdx < 0 || fromIdx > 9) {
        alert("올바른 일계획 번호(1~10)를 입력해주세요.");
        return;
    }

    if (fromIdx === toIdx) { alert("현재 보고 있는 일계획과 같은 번호입니다."); return; }
    if (!confirm(`'${DAY_LABELS[fromIdx]}'의 모든 TOD 데이터(시작시간, 주기, 연동, 스플릿)를 '${DAY_LABELS[toIdx]}' 화면으로 복사하여 덮어쓰시겠습니까?`)) return;

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

function updateJunctionDayUI() {
    renderWeeklyPlanTable();
    // 현재 포커스된 입력창 정보 저장 (스핀박스 클릭 등으로 onchange 발생 시 포커스 유지)
    let activeDay = null, activeSlot = null, activeField = null;
    if (document.activeElement && document.activeElement.hasAttribute('data-day')) {
        activeDay = document.activeElement.getAttribute('data-day');
        activeSlot = document.activeElement.getAttribute('data-slot');
        activeField = document.activeElement.getAttribute('data-field');
    }

    renderTodPlanInfoTable();
    if (STATE.currentJunctionDayTypeIdx === dayIdx && parseInt(UI.planIdx?.value || 0) === slotIdx) {
        renderRingTables();
        if (typeof renderSummaryTable === 'function') renderSummaryTable();
    }
    if (typeof updatePlanMap === 'function') updatePlanMap();

    // 포커스 복구
    if (activeDay !== null) {
        setTimeout(() => {
            const inputToFocus = document.querySelector(`input[data-day="${activeDay}"][data-slot="${activeSlot}"][data-field="${activeField}"]`);
            if (inputToFocus) {
                inputToFocus.focus();
                if (inputToFocus.type === 'text') {
                    const len = inputToFocus.value.length;
                    inputToFocus.setSelectionRange(len, len);
                }
            }
        }, 10);
    }
};

window.toggleTodPlanGroup = function(group) {
    if (typeof STATE !== 'undefined') {
        STATE._todPlanGroup = group;
        renderTodPlanInfoTable();
    }
};

window.selectTodPlanCell = function(dayIdx, slotIdx) {
    if (STATE.currentJunctionDayTypeIdx === dayIdx && parseInt(UI.planIdx.value || 0) === slotIdx) {
        return; // 불필요한 재렌더링 방지 (포커스 탈취 원인)
    }

    // 현재 포커스된 입력창 정보 저장
    let activeDay = null, activeSlot = null, activeField = null;
    if (document.activeElement && document.activeElement.hasAttribute('data-day')) {
        activeDay = document.activeElement.getAttribute('data-day');
        activeSlot = document.activeElement.getAttribute('data-slot');
        activeField = document.activeElement.getAttribute('data-field');
    }

    STATE.currentJunctionDayTypeIdx = dayIdx;
    UI.planIdx.value = slotIdx;
    let labelEl = document.getElementById('j-current-day-label');
    if (labelEl) {
        const planNum = dayIdx + 1;
        const mapType = planNum <= 5 ? "일반맵" : "시차맵";
        labelEl.innerText = `${mapType} : 시간계획(${planNum})`;
        labelEl.style.color = '#38bdf8';
        labelEl.style.fontWeight = 'bold';
        labelEl.style.fontSize = '13px';
        labelEl.style.fontFamily = 'inherit';
    }
    renderRingTables();
    renderSummaryTable();
    updateJunctionDayUI();

    // 포커스 복구
    if (activeDay !== null) {
        setTimeout(() => {
            const inputToFocus = document.querySelector(`input[data-day="${activeDay}"][data-slot="${activeSlot}"][data-field="${activeField}"]`);
            if (inputToFocus) {
                inputToFocus.focus();
                if (inputToFocus.type === 'text') {
                    const len = inputToFocus.value.length;
                    inputToFocus.setSelectionRange(len, len);
                }
            }
        }, 10);
    }
};

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

