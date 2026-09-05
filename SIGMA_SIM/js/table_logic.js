/**
 * table_logic.js
 * ─────────────────────────────────────────────
 * 테이블 입력 성능 최적화 (Debounce, Direct DOM Update)
 * 및 방향키 셀 이동 (Navigation) 로직
 */

const tableEventInitialized = {
    tod: false,
    mov: false,
    summary: false,
    groupTod: false
};

function initTableEventHandlers() {
    console.log("[TableLogic] Initializing Event Handlers...");

    // 0 값 흐리게 처리 (테마용 클래스 토글)
    document.addEventListener('input', (e) => {
        if (e.target.classList.contains('sigma-input')) {
            let isZeroOrEmpty = false;
            if (e.target.type === 'number') {
                isZeroOrEmpty = (parseFloat(e.target.value) || 0) === 0;
            } else if (e.target.type === 'text') {
                isZeroOrEmpty = e.target.value.trim() === '' || e.target.value === '0';
            } else {
                return;
            }
            e.target.classList.toggle('val-zero', isZeroOrEmpty);
            e.target.classList.toggle('val-non-zero', !isZeroOrEmpty);
        }
    });

    // 1. Phase/Split 테이블 (Split, AllRed, Yellow 등)
    const todContainer = document.getElementById('tod-container');
    if (todContainer && !tableEventInitialized.tod) {
        todContainer.addEventListener('input', (e) => {
            if (e.target.classList.contains('sigma-input')) handleTableInput(e.target);
        });
        todContainer.addEventListener('keydown', (e) => {
            if (e.target.classList.contains('sigma-input')) handleTableKeyNavigation(e);
        });
        tableEventInitialized.tod = true;
    }

    // 2. 이동류 구성 테이블 (movA, movB, pedMov 등)
    const movContainer = document.getElementById('mov-combined-container');
    if (movContainer && !tableEventInitialized.mov) {
        movContainer.addEventListener('input', (e) => {
            if (e.target.dataset.type === 'mov') handleMovInput(e.target);
        });
        movContainer.addEventListener('keydown', (e) => {
            if (e.target.classList.contains('sigma-input')) handleTableKeyNavigation(e);
        });
        tableEventInitialized.mov = true;
    }

    // 3. 요약 테이블 (TOD Schedule & Pattern)
    const summaryContainer = document.getElementById('tod-summary-container');
    if (summaryContainer && !tableEventInitialized.summary) {
        summaryContainer.addEventListener('input', (e) => {
            const type = e.target.dataset.type;
            if (type === 'sched') handleSchedInput(e.target);
            else if (type === 'pattern-cycle') handlePatternCycleInput(e.target);
            else if (type === 'offset') handleOffsetInput(e.target);
            else if (type === 'split-cell') handleSplitInput(e.target);
        });
        summaryContainer.addEventListener('keydown', (e) => {
            if (e.target.classList.contains('sigma-input')) handleTableKeyNavigation(e);
        });
        tableEventInitialized.summary = true;
    }

    // 4. 그룹 TOD 테이블
    const groupTodContainer = document.getElementById('group-tod-table-container');
    if (groupTodContainer && !tableEventInitialized.groupTod) {
        groupTodContainer.addEventListener('input', (e) => {
            if (e.target.dataset.type === 'group-sched') handleGroupSchedInput(e.target);
        });
        groupTodContainer.addEventListener('keydown', (e) => {
            if (e.target.classList.contains('sigma-input')) handleTableKeyNavigation(e);
        });
        tableEventInitialized.groupTod = true;
    }
}

/**
 * [Phase/Split] 테이블 입력 처리
 */
function handleTableInput(el) {
    const key = el.dataset.key; // splitA, yellowA 등
    const idx = parseInt(el.dataset.index);
    const val = parseInt(el.value) || 0;

    // [Fix] ID 체계 일원화 (krd- 기반 직접 조회)
    let jid = STATE.activeJid;
    if (!jid) return;
    
    const j = STATE.junctions[jid];
    if (!j) {
        console.error(`[DataSync] Cannot find junction: ${jid}`);
        return;
    }

    const dayIdx = STATE.currentJunctionDayTypeIdx;
    const pIdx = parseInt(UI.planIdx?.value) || 0;
    const p = (j.dayPlans && j.dayPlans[dayIdx]) ? j.dayPlans[dayIdx][pIdx] : null;

    const smIdx = STATE.currentSignalMapIdx || 0;
    const sm = (j.signalMaps) ? j.signalMaps[smIdx] : null;

    const isSplit = key.startsWith('split');
    const target = isSplit ? p : sm;

    if (key && target && target[key]) {
        target[key][idx] = val;
        console.log(`[Sync] Updated: ${jid} -> ${key}[${idx}] = ${val}`);
    }

    // Dual 모드 아닐 때 동기화 로직
    const chkDual = document.getElementById('chk-dual-ring');
    const isDual = chkDual ? chkDual.checked : true;
    if (!isDual && key && key.endsWith('A')) {
        const bKey = key.replace(/A$/, 'B');
        if (target[bKey]) {
            target[bKey][idx] = val;
            const bEl = document.querySelector(`.sigma-input[data-key="${bKey}"][data-index="${idx}"]`);
            if (bEl) {
                bEl.value = val;
                bEl.classList.toggle('val-zero', val === 0);
                bEl.classList.toggle('val-non-zero', val !== 0);
            }
        }
    }

    // Auto-calculate pedA and pedB
    if (['pedGreenA', 'pedFlashA', 'pedGreenB', 'pedFlashB'].includes(key)) {
        if (!sm.pedA) sm.pedA = [0,0,0,0,0,0,0,0];
        if (!sm.pedB) sm.pedB = [0,0,0,0,0,0,0,0];
        
        if (key.endsWith('A')) {
            sm.pedA[idx] = (sm.pedGreenA?.[idx] || 0) + (sm.pedFlashA?.[idx] || 0);
            const pedAEl = document.querySelector(`.sigma-input[data-key="pedA"][data-index="${idx}"]`);
            if (pedAEl) {
                pedAEl.value = sm.pedA[idx];
                pedAEl.classList.toggle('val-zero', sm.pedA[idx] === 0);
                pedAEl.classList.toggle('val-non-zero', sm.pedA[idx] !== 0);
            }

            if (!isDual && sm.pedB) {
                sm.pedB[idx] = (sm.pedGreenB?.[idx] || 0) + (sm.pedFlashB?.[idx] || 0);
                const pedBEl = document.querySelector(`.sigma-input[data-key="pedB"][data-index="${idx}"]`);
                if (pedBEl) {
                    pedBEl.value = sm.pedB[idx];
                    pedBEl.classList.toggle('val-zero', sm.pedB[idx] === 0);
                    pedBEl.classList.toggle('val-non-zero', sm.pedB[idx] !== 0);
                }
            }
        } else {
            sm.pedB[idx] = (sm.pedGreenB?.[idx] || 0) + (sm.pedFlashB?.[idx] || 0);
            const pedBEl = document.querySelector(`.sigma-input[data-key="pedB"][data-index="${idx}"]`);
            if (pedBEl) {
                pedBEl.value = sm.pedB[idx];
                pedBEl.classList.toggle('val-zero', sm.pedB[idx] === 0);
                pedBEl.classList.toggle('val-non-zero', sm.pedB[idx] !== 0);
            }
        }
    }

    updateDependentCells(idx, p, sm);
    updateCycleDisplayLocally(p);
}

/**
 * [Mov] 이동류 설정 입력 처리
 */
function handleMovInput(el) {
    const key = el.dataset.key; // movA, movB 등
    const idx = parseInt(el.dataset.index);
    const val = parseInt(el.value) || 0;

    const j = STATE.junctions[STATE.activeJid];
    if (!j) return;

    // 현재 선택된 시차맵 혹은 글로벌 데이터에 저장
    const smIdx = STATE.currentSignalMapIdx || 0;
    const sm = j.signalMaps ? j.signalMaps[smIdx] : null;

    if (sm) {
        if (!sm[key]) sm[key] = [0,0,0,0,0,0,0,0];
        sm[key][idx] = val;
        // 0번 맵인 경우 루트 레벨도 동기화
        if (smIdx === 0) { if (!j[key]) j[key] = [0,0,0,0,0,0,0,0]; j[key][idx] = val; }
        if (window.ipdInstance) window.ipdInstance.loadFromSignalMap(sm);
        // ※ 현시계획(Map)은 A/B 링 독립 입력 - Dual 동기화 불필요
    } else { if (!j[key]) j[key] = [0,0,0,0,0,0,0,0]; j[key][idx] = val; }

    if (typeof refreshVisibleArrows === 'function') refreshVisibleArrows();
    // 방향(Dir) 이미지 갱신을 위해 디바운싱 리렌더링
    debounceUpdateRingTables();
}


/**
 * [Sched] 요약 테이블 스케줄(시:분, 주기) 입력 처리
 */
function handlePatternCycleInput(el) {
    const idx = parseInt(el.dataset.index);
    const val = parseInt(el.value) || 0;
    
    const j = STATE.junctions[STATE.activeJid];
    if (!j) return;
    const dayIdx = STATE.currentJunctionDayTypeIdx;
    
    if (j.dayPlans && j.dayPlans[dayIdx] && j.dayPlans[dayIdx][idx]) {
        j.dayPlans[dayIdx][idx].cycle = val;
    }
    
    // 만약 현재 다이어그램(Ring Table)이 이 패턴을 보여주고 있다면 업데이트
    if (typeof UI !== 'undefined' && UI.planIdx) {
        // UI.planIdx.value는 선택된 "타임 슬롯" 인덱스
        const sIdx = parseInt(UI.planIdx.value) || 0;
        const s = j.schedules && j.schedules[dayIdx] ? j.schedules[dayIdx][sIdx] : null;
        if (s && s.idx === (idx + 1)) {
            debounceUpdateRingTables();
        }
    }
    
    debounceUpdateHeavyUI();
}

function handleSchedInput(el) {
    const field = el.dataset.field; // h, m, cycle
    const idx = parseInt(el.dataset.index);
    const val = parseInt(el.value) || 0;

    const j = STATE.junctions[STATE.activeJid];
    const dayIdx = STATE.currentJunctionDayTypeIdx;
    const schedules = (j.group && STATE.groups[j.group])
        ? STATE.groups[j.group].schedules[dayIdx]
        : j.schedules[dayIdx];

    if (schedules && schedules[idx]) {
        schedules[idx][field] = val;
    }

    // 현재 보고 있는 플랜의 주기가 바뀌었다면 화면 갱신의 필요성 확인
    if (idx === parseInt(UI.planIdx.value)) {
        debounceUpdateRingTables();
    }
    debounceUpdateHeavyUI();
}

function handleOffsetInput(el) {
    const idx = parseInt(el.dataset.index);
    const val = parseInt(el.value) || 0;

    STATE.junctions[STATE.activeJid].dayPlans[STATE.currentJunctionDayTypeIdx][idx].offset = val;

    if (idx === parseInt(UI.planIdx.value)) {
        if (UI.todInpOffset) UI.todInpOffset.value = val;
    }
    debounceUpdateHeavyUI();
    if (typeof renderTimeSpaceDiagram === 'function') renderTimeSpaceDiagram();
}


function handleSplitInput(el) {
    const idx = parseInt(el.dataset.index);
    const ring = el.dataset.ring; // "A" or "B"
    const col = parseInt(el.dataset.col); // 0 to 7
    const val = parseInt(el.value, 10) || 0;
    
    if (typeof STATE !== 'undefined' && STATE.activeJid) {
        const j = STATE.junctions[STATE.activeJid];
        if (j && j.dayPlans && j.dayPlans[STATE.currentJunctionDayTypeIdx]) {
            if (ring === 'A') {
                j.dayPlans[STATE.currentJunctionDayTypeIdx][idx].splitA[col] = val;
                // Auto-update cycle based on Ring A sum (User Request)
                const sumA = j.dayPlans[STATE.currentJunctionDayTypeIdx][idx].splitA.reduce((a, b) => a + b, 0);
                j.dayPlans[STATE.currentJunctionDayTypeIdx][idx].cycle = Math.round(sumA);
                if (j.schedules && j.schedules[STATE.currentJunctionDayTypeIdx] && j.schedules[STATE.currentJunctionDayTypeIdx][idx]) {
                    j.schedules[STATE.currentJunctionDayTypeIdx][idx].cycle = Math.round(sumA);
                }
                // Update UI instantly
                const cycleInput = document.querySelector(`input[data-type="pattern-cycle"][data-index="${idx}"]`);
                if (cycleInput) {
                    cycleInput.value = Math.round(sumA);
                    cycleInput.style.background = '';
                    cycleInput.style.border = '';
                    cycleInput.style.color = 'var(--accent)';
                }
            } else if (ring === 'B') {
                j.dayPlans[STATE.currentJunctionDayTypeIdx][idx].splitB[col] = val;
            }
            
            // 만약 편집중인 슬롯이 현재 상단에 로드된 슬롯과 같다면, 상단 UI(링 테이블)도 즉시 동기화
            if (typeof UI !== 'undefined' && UI.planIdx && parseInt(UI.planIdx.value) === idx) {
                if (typeof renderRingTables === 'function') renderRingTables();
            }
        }
    }
    
    debounceUpdateHeavyUI();
    if (typeof renderTimeSpaceDiagram === 'function') renderTimeSpaceDiagram();
}


/**
 * [GroupSched] 그룹 TOD 테이블 입력 처리
 */
function handleGroupSchedInput(el) {
    const field = el.dataset.field; // h, m, cycle
    const idx = parseInt(el.dataset.idx);
    const dayIdx = parseInt(el.dataset.day);
    const val = parseInt(el.value) || 0;

    if (typeof currentEditingGroup === 'undefined' || !currentEditingGroup) return;
    const group = STATE.groups[currentEditingGroup];
    if (!group || !group.schedules) return;

    group.schedules[dayIdx][idx][field] = val;

    // [중요] 개별 교차로가 선택된 상태라면 해당 교차로의 schedule에도 즉시 동기화
    if (typeof STATE !== 'undefined' && STATE.activeJid && STATE.junctions[STATE.activeJid]) {
        const j = STATE.junctions[STATE.activeJid];
        if (String(j.group) === String(currentEditingGroup)) {
            if (j.schedules && j.schedules[dayIdx] && j.schedules[dayIdx][idx]) {
                j.schedules[dayIdx][idx][field] = val;
            }
        }
    }

    // 차트 및 기타 UI 업데이트 (디바운싱)
    debounceUpdateGroupUI();

    // 현재 보고 있는 요일이 편집 중인 요일이라면 통계 등도 갱신 필요할 수 있음
    if (dayIdx === STATE.currentGroupDayTypeIdx) {
        debounceUpdateHeavyUI();
    }
}

let groupUiTimeout = null;
function debounceUpdateGroupUI() {
    if (groupUiTimeout) clearTimeout(groupUiTimeout);
    groupUiTimeout = setTimeout(() => {
        if (typeof renderGroupCycleChart === 'function') renderGroupCycleChart();
        if (document.getElementById('tab-stats').classList.contains('active') && typeof renderStats === 'function') {
            renderStats();
        }
    }, 1000);
}

/**
 * Green 실시간 업데이트
 */
function updateDependentCells(i, p, sm) {
    const greenA = p.splitA[i] - (p.allredA[i] || 0) - (p.yellowA[i] || 0);
    const greenB = p.splitB[i] - (p.allredB[i] || 0) - (p.yellowB[i] || 0);

    const gAEl = document.getElementById(`val-greenA-${i}`);
    const gBEl = document.getElementById(`val-greenB-${i}`);

    if (gAEl) gAEl.innerText = greenA;
    if (gBEl) gBEl.innerText = greenB;

    // [New] 실시간 안전 감사 (MG 체크)
    if (!sm) return;
    ['A', 'B'].forEach(ring => {
        const splitKey = 'split' + ring;
        const val = p[splitKey][i];
        if (val <= 0) return; // 미사용 현시는 제외

        const ped = sm['ped' + ring]?.[i] || 0;
        const arr = sm['allred' + ring]?.[i] || 0;
        const dly = sm['pedDelay' + ring]?.[i] || 0;
        const yel = sm['yellow' + ring]?.[i] || 0;

        const mg = ped > 0 ? ped + dly + arr : 7 + arr;
        const mgWithYellow = mg + yel;

        const el = document.querySelector(`.sigma-input.inp-${splitKey}[data-index="${i}"]`);
        if (el) {
            if (val < mg) {
                // [1단계] 위기 (Red)
                el.style.border = '2px solid #ff4d4d';
                el.style.boxShadow = '0 0 10px rgba(255,77,77,0.5)';
                el.style.background = 'rgba(255,77,77,0.15)';
                el.style.color = '#ff4d4d';
                el.style.fontWeight = 'bold';
                el.title = `안전감사 위기! 최소녹색시간(${mg}초) 미달`;
            } else if (val < mgWithYellow) {
                // [2단계] 주의 (Yellow)
                el.style.border = '2px solid #ffcc00';
                el.style.boxShadow = '0 0 10px rgba(255,204,0,0.5)';
                el.style.background = 'rgba(255,204,0,0.1)';
                el.style.color = '#ffcc00';
                el.style.fontWeight = 'bold';
                el.title = `안전감사 주의! 최소녹색+황색(${mgWithYellow}초) 미달`;
            } else {
                // [3단계] 정상
                el.style.border = '';
                el.style.boxShadow = '';
                el.style.background = '';
                el.style.color = '';
                el.style.fontWeight = '';
                el.title = '';
            }
        }
    });
}

/**
 * 주기 일치 여부 실시간 업데이트
 */
function updateCycleDisplayLocally(p) {
    const sA = p.splitA.reduce((a, b) => a + b, 0);
    const sB = p.splitB.reduce((a, b) => a + b, 0);

    const j = STATE.junctions[STATE.activeJid];
    const dayIdx = STATE.currentJunctionDayTypeIdx;
    const pIdx = parseInt(UI.planIdx?.value) || 0;
    const s = (j && j.schedules) ? (getLinkedSchedule(j, dayIdx)?.[pIdx] || { cycle: 100 }) : { cycle: 100 };
    const target = s.cycle || 100;

    const isMatch = (sA === target && sB === target);
    const cycInp = document.getElementById('tod-inp-cycle');
    if (cycInp) cycInp.style.color = isMatch ? '#00ff88' : '#ff4444';
}

let heavyUiTimeout = null;
function debounceUpdateHeavyUI() {
    if (heavyUiTimeout) clearTimeout(heavyUiTimeout);
    heavyUiTimeout = setTimeout(() => {
        // [수정] 현재 포커스가 요약 테이블 내부의 입력창에 있다면 리렌더링을 한 번 더 지연 (입력 방해 방지)
        const activeEl = document.activeElement;
        if (activeEl && activeEl.closest('#tod-summary-container')) {
            debounceUpdateHeavyUI();
            return;
        }

        renderSummaryTable();
        if (document.getElementById('tab-stats').classList.contains('active') && typeof renderStats === 'function') {
            renderStats();
        }
    }, 1000); // 1초로 약간 늘림
}

let ringTableTimeout = null;
function debounceUpdateRingTables() {
    if (ringTableTimeout) clearTimeout(ringTableTimeout);
    ringTableTimeout = setTimeout(() => {
        // renderRingTables()를 호출하되, 다시 init 핸들러를 중복실행하지 않도록 내부 flag가 관리함
        if (typeof renderRingTables === 'function') renderRingTables();
    }, 1500);
}

/**
 * 방향키 내비게이션 (값 변경 금지 및 셀 이동)
 */
function handleTableKeyNavigation(e) {
    const key = e.key;
    const input = e.target;
    const td = input.closest('td');
    if (!td) return;

    const tr = td.closest('tr');
    if (!tr) return;

    // 현재 행의 모든 입력을 배열로 가져옴 (좌/우 이동용)
    const inputsInRow = Array.from(tr.querySelectorAll('input.sigma-input'));
    const currentInputIdx = inputsInRow.indexOf(input);

    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
        e.preventDefault(); // 기본 값 변경 동작 방지

        let targetInput = null;

        if (key === 'ArrowLeft') {
            if (currentInputIdx > 0) {
                targetInput = inputsInRow[currentInputIdx - 1];
            }
        } else if (key === 'ArrowRight') {
            if (currentInputIdx < inputsInRow.length - 1) {
                targetInput = inputsInRow[currentInputIdx + 1];
            }
        } else if (key === 'ArrowUp' || key === 'ArrowDown') {
            // 위/아래 이동은 동일한 TD 내의 몇 번째 input인지 파악하여 이동
            const inputsInCell = Array.from(td.querySelectorAll('input.sigma-input'));
            const inputIdxInCell = inputsInCell.indexOf(input);
            const colIdx = Array.from(tr.cells).indexOf(td);

            const targetTr = (key === 'ArrowUp') ? tr.previousElementSibling : tr.nextElementSibling;
            if (targetTr) {
                const targetTd = targetTr.cells[colIdx];
                if (targetTd) {
                    const targetCellInputs = Array.from(targetTd.querySelectorAll('input.sigma-input'));
                    targetInput = targetCellInputs[inputIdxInCell] || targetCellInputs[0];
                }
            }
        }

        if (targetInput) {
            targetInput.focus();
            targetInput.select();
        }
    }
}
