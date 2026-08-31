/**
 * ui.js
 * ─────────────────────────────────────────────
 * UI 제어, DOM 캐시, 탭/섹션 관리, 사이드바 리사이저,
 * 스케일/스타일 업데이트, 툴팁 관리, 편집 모드 UI
 * 의존: config.js, utils.js
 */

/* ══════════════════════════════════════════
 *  DOM 캐시 객체
 * ══════════════════════════════════════════ */
const UI = {
    clock: document.getElementById('clock'),
    timeSlider: document.getElementById('timeSlider'),
    stat: document.getElementById('stat'),
    simSpeed: document.getElementById('sim-speed-display'),
    editForm: document.getElementById('edit-form'),
    editor: document.getElementById('dual-ring-editor'),
    noSelectMsg: document.getElementById('no-select-msg'),
    planIdx: document.getElementById('current-plan-idx'),
    nodeSizeVal: document.getElementById('val-node-size-bottom'),
    arrowSizeVal: document.getElementById('val-arrow-size-bottom'),
    nameSizeVal: document.getElementById('val-name-size-bottom'),
    btnSignalMode: document.getElementById('btn-signal-mode'),
    btnCycleMode: document.getElementById('btn-cycle-mode'),
    btnMapTheme: document.getElementById('btn-map-theme'),
    todDisplayTime: document.getElementById('tod-display-time'),
    todInpCycle: document.getElementById('tod-inp-cycle'),
    todInpOffset: document.getElementById('tod-inp-offset'),
    movBody: document.getElementById('mov-combined-body'),
    btnToggleNames: document.getElementById('btn-toggle-names'),
    btnToggleCycles: document.getElementById('btn-toggle-cycles')
};

/* ══════════════════════════════════════════
 *  플랜 선택기 초기화
 * ══════════════════════════════════════════ */
const initPlanSelector = () => {
    if (!UI.planIdx) return;
    let html = '';
    for (let i = 0; i < 16; i++) {
        html += `<option value="${i}">Plan ${i + 1}</option>`;
    }
    UI.planIdx.innerHTML = html;
};

/* ══════════════════════════════════════════
 *  섹션 접기/펼치기
 * ══════════════════════════════════════════ */
function toggleSection(header) {
    const content = header.nextElementSibling;
    if (!content) return;
    content.classList.toggle('collapsed');
    header.classList.toggle('collapsed');
    const icon = header.querySelector('.fold-icon');
    if (icon) icon.textContent = content.classList.contains('collapsed') ? '▼' : '▲';
}

/* ══════════════════════════════════════════
 *  메인 컨트롤러 숨김/펼침 토글
 * ══════════════════════════════════════════ */
function toggleControls() {
    const controls = document.getElementById('sim-controls');
    const btn = document.getElementById('btn-toggle-controls');
    if (!controls || !btn) return;

    controls.classList.toggle('minimized');
    const isMinimized = controls.classList.contains('minimized');
    
    if (isMinimized) {
        btn.innerHTML = '<span class="handle-icon">🚦</span><span class="handle-text-bottom">신호 시뮬레이터</span>';
        btn.title = "신호 시뮬레이터 펼치기";
        // [연계] 시뮬레이터를 닫으면 신호등 모드도 종료 (이미 켜져 있는 경우만)
        if (STATE.showSignalArrows) {
            toggleSignalMode();
        }
    } else {
        btn.innerHTML = '<span class="handle-icon">🚦</span><span class="handle-text-bottom">신호 시뮬레이터</span>';
        btn.title = "신호 시뮬레이터 숨기기";
        // [연계] 시뮬레이터를 열면 신호등 모드 자동 활성화 (아직 꺼져 있는 경우만)
        if (!STATE.showSignalArrows) {
            toggleSignalMode();
        }
    }
}

/* ══════════════════════════════════════════
 *  탭 전환
 * ══════════════════════════════════════════ */
function openTab(evt, tabName) {
    const targetTab = document.getElementById(tabName);
    // [강제 규칙] 유효한 탭 대상이 없는 경우 전환을 무시하여 최소 하나 이상의 탭이 항상 열려있도록 보장
    if (!targetTab) return;

    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));

    targetTab.classList.add('active');

    if (evt && evt.currentTarget) {
        evt.currentTarget.classList.add('active');
    } else {
        document.querySelectorAll('.tabs .tab').forEach(btn => {
            if (btn.getAttribute('onclick')?.includes(tabName)) {
                btn.classList.add('active');
            }
        });
    }

    if (tabName === 'tab-home') { if (typeof renderHomeDashboard === 'function') renderHomeDashboard(); }
    if (tabName === 'tab-stats') renderStats();
    if (tabName === 'tab-group') { loadGroupInfo(); }
    if (tabName === 'tab-sigmap') {
        if (typeof renderSignalMapTab === 'function') renderSignalMapTab();
    }
    if (tabName === 'tab-phase') { 
        if (typeof renderRingTables === 'function') renderRingTables();
        if (typeof renderSummaryTable === 'function') renderSummaryTable();
    }
    if (tabName === 'tab-db') { 
        if(typeof refreshDBStats === 'function') refreshDBStats(); 
        setTimeout(() => { if(typeof renderDBFileNames === "function") renderDBFileNames(); }, 50);
        setTimeout(() => { if(typeof renderDBFileNames === "function") renderDBFileNames(); }, 250);
    }
    if (tabName === 'tab-civil') { 
        if (typeof renderCivilSummary === 'function') renderCivilSummary(); 
        if (STATE.activeJid && typeof renderCivilStats === 'function') renderCivilStats(STATE.activeJid);
    }
}

/**
 * 사이드바 확장/숨김 토글 (3단계: Normal -> Expanded -> Hidden)
 */
function toggleSidebarExpand() {
    const sidebar = document.querySelector('.sidebar');
    const textEl = document.getElementById('sidebar-expand-text');
    const iconEl = document.querySelector('.sidebar-expand-handle .handle-icon');
    if (!sidebar) return;

    // 현재 상태 파악
    const isExpanded = sidebar.classList.contains('expanded');
    const isCollapsed = sidebar.classList.contains('collapsed');

    // Body 클래스 초기화
    document.body.classList.remove('sidebar-expanded', 'sidebar-collapsed');

    if (!isExpanded && !isCollapsed) {
        // Normal -> Expanded
        sidebar.classList.add('expanded');
        document.body.classList.add('sidebar-expanded');
        // if (textEl) textEl.innerText = '축소'; // [사용자 요청] 텍스트 고정
        if (iconEl) iconEl.innerText = '≫';
    } else if (isExpanded) {
        // Expanded -> Hidden
        sidebar.classList.remove('expanded');
        sidebar.classList.add('collapsed');
        document.body.classList.add('sidebar-collapsed');
        // if (textEl) textEl.innerText = '표시'; // [사용자 요청] 텍스트 고정
        if (iconEl) iconEl.innerText = '≪';
    } else {
        // Hidden -> Normal
        sidebar.classList.remove('collapsed');
        // if (textEl) textEl.innerText = '확장'; // [사용자 요청] 텍스트 고정
        if (iconEl) iconEl.innerText = '≪';
    }

    // 지도 리사이즈 트리거
    setTimeout(() => {
        if (typeof map !== 'undefined' && map && map.invalidateSize) {
            map.invalidateSize();
        }
    }, 350);
}


/* ══════════════════════════════════════════
 *  App 상태 머신 (AppStateMachine)
 * ══════════════════════════════════════════ */
const AppStateMachine = {
    /** 모드 변경 메인 함수 */
    setMode: function (newMode) {
        if (STATE.appMode === newMode) return;

        console.log(`[AppStateMachine] Switching Mode: ${STATE.appMode} -> ${newMode}`);

        // 1. 이전 모드 정리 (Cleanup)
        this.exitMode(STATE.appMode);

        // 2. 상태 업데이트
        STATE.appMode = newMode;

        // 3. 새 모드 실행 (Init)
        this.enterMode(newMode);

        // 4. 전역 버튼 UI 업데이트
        this.updateGlobalUI(newMode);
    },

    /** 모드 진입 시 */
    enterMode: function (mode) {
        switch (mode) {
            case CONFIG.APP_MODE.SELECT:
                // 기본 선택 모드: 별도 초기화 없음 (Cleanup 후 순수 상태)
                break;

            case CONFIG.APP_MODE.NETWORK_EDIT:
                if (typeof window.RoadManager !== 'undefined') {
                    window.RoadManager.isEditMode = true;
                    // [최종 수정] 여기서 분석을 호출하던 잔여 로직 완전 삭제 (수동 제어권 확보)
                    window.RoadManager.render();
                }
                break;

            case CONFIG.APP_MODE.MAP_EDIT:
                STATE.isMapEditMode = true;
                this.refreshAllJunctions();
                break;

            case CONFIG.APP_MODE.ADD_NODE:
                STATE.isAddMode = true;
                map.getContainer().style.cursor = 'crosshair';
                break;
        }
    },

    /** 모드 이탈 시 (Cleanup) */
    exitMode: function (prevMode) {
        switch (prevMode) {
            case CONFIG.APP_MODE.NETWORK_EDIT:
                if (typeof window.RoadManager !== 'undefined') {
                    window.RoadManager.isEditMode = false;
                    window.RoadManager.selectedNode = null;
                    window.RoadManager.highlightGroupId = null;
                    window.RoadManager.render();
                }
                break;

            case CONFIG.APP_MODE.MAP_EDIT:
                STATE.isMapEditMode = false;
                STATE.focusedArrow = null;
                this.refreshAllJunctions();
                break;

            case CONFIG.APP_MODE.ADD_NODE:
                STATE.isAddMode = false;
                map.getContainer().style.cursor = '';
                break;
        }
    },

    /** 각 교차로 마커 재렌더링 (편집/해제 상태 반영용) */
    /** 모든 교차로 마커 재렌더링 (편집 모드 시 성능 최적화를 위한 분할 처리) */
    refreshAllJunctions: function () {
        if (typeof drawJunction !== 'function') return;
        const jids = Object.keys(STATE.junctions);
        let idx = 0;
        const chunkSize = 30; // 프레임당 처리할 교차로 수

        const process = () => {
            const limit = Math.min(idx + chunkSize, jids.length);
            for (; idx < limit; idx++) {
                drawJunction(jids[idx]);
            }
            if (idx < jids.length) {
                requestAnimationFrame(process);
            } else {
                // 가시 영역 화살표 최적화 호출
                if (typeof refreshVisibleArrows === 'function') refreshVisibleArrows();
            }
        };
        requestAnimationFrame(process);
    },

    /** 모드에 따른 전역 버튼 UI 상태 업데이트 */
    updateGlobalUI: function (mode) {
        const btnAdd = document.getElementById('btn-add-junction');
        const btnMapEdit = document.getElementById('btn-map-edit');
        const btnNetworkEdit = document.getElementById('btn-edit-network');
        const btnResetArrows = document.getElementById('btn-reset-arrows');

        // 모든 버튼 초기화
        if (btnAdd) { btnAdd.className = 'phase-action-btn phase-btn-green'; btnAdd.innerHTML = '➕ 교차로 추가'; }
        if (btnMapEdit) { btnMapEdit.className = 'phase-action-btn phase-btn-purple'; btnMapEdit.innerText = "🔧 신호등 편집"; }
        if (btnResetArrows) {
            btnResetArrows.disabled = true;
            btnResetArrows.style.opacity = '0.5';
            btnResetArrows.style.pointerEvents = 'none';
        }
        if (btnNetworkEdit) {
            btnNetworkEdit.className = 'phase-action-btn phase-btn-gray';
            btnNetworkEdit.textContent = '✏️ 편집 모드';
        }

        // 현재 모드 강조
        switch (mode) {
            case CONFIG.APP_MODE.ADD_NODE:
                if (btnAdd) { btnAdd.className = 'phase-action-btn phase-btn-red'; btnAdd.innerHTML = '⏹ 취소(종료)'; }
                break;
            case CONFIG.APP_MODE.MAP_EDIT:
                if (btnMapEdit) { btnMapEdit.className = 'phase-action-btn phase-btn-green'; btnMapEdit.innerText = "💾 편집 완료"; }
                if (btnResetArrows) {
                    btnResetArrows.disabled = false;
                    btnResetArrows.style.opacity = '1';
                    btnResetArrows.style.pointerEvents = 'auto';
                }
                break;
            case CONFIG.APP_MODE.NETWORK_EDIT:
                if (btnNetworkEdit) {
                    btnNetworkEdit.style.background = '#00f3ff';
                    btnNetworkEdit.style.color = '#000';
                    btnNetworkEdit.style.borderColor = '#00f3ff';
                    btnNetworkEdit.style.boxShadow = '0 0 10px #00f3ff';
                    btnNetworkEdit.textContent = '⏹️ 편집 종료';
                }
                break;
        }
    }
};

/* ══════════════════════════════════════════
 *  Phase/Split 편집 모드 토글
 * ══════════════════════════════════════════ */
function syncConfigEditUI() {
    const btnApply = document.getElementById('btn-config-apply');
    const dot = document.getElementById('editor-active-dot');

    // 입력 요소 활성/비활성 (항상 편집 가능 상태 유지)
    document.querySelectorAll('#tab-phase input, #tab-phase select').forEach(el => {
        el.disabled = false;
    });
    document.querySelectorAll('#tab-phase .editor-input').forEach(el => {
        el.disabled = false;
    });

    if (btnApply) {
        btnApply.style.opacity = '1';
        btnApply.style.pointerEvents = 'auto';
        btnApply.style.cursor = 'pointer';
    }
    if (dot) dot.style.display = 'block';
}

/* ══════════════════════════════════════════
 *  사이드바 리사이저
 * ══════════════════════════════════════════ */
let isResizing = false;

function initSidebarResizer() {
    const resizer = document.getElementById('resizer');
    if (!resizer) return;

    let rafId = null;

    const onMouseDown = (e) => {
        isResizing = true;
        document.body.classList.add('resizing');
        
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    };

    const onMouseMove = (e) => {
        if (!isResizing) return;
        
        // requestAnimationFrame으로 프레임당 한 번만 업데이트하여 부하 감소
        if (rafId) cancelAnimationFrame(rafId);
        
        rafId = requestAnimationFrame(() => {
            const newWidth = window.innerWidth - e.clientX;
            // [경계 설정] 좌측 사이드바(220px)와 핸들을 고려하여 최대 너비 제한
            const maxWidth = window.innerWidth - 250;
            if (newWidth > 320 && newWidth < maxWidth) {
                document.documentElement.style.setProperty('--sidebar-width', newWidth + 'px');
                if (typeof map !== 'undefined' && map.invalidateSize) {
                    map.invalidateSize({ animate: false });
                }
            }
        });
    };

    const onMouseUp = () => {
        isResizing = false;
        document.body.classList.remove('resizing');
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        
        if (typeof map !== 'undefined' && map.invalidateSize) {
            map.invalidateSize();
        }
    };

    resizer.addEventListener('mousedown', onMouseDown);
}

/* ══════════════════════════════════════════
 *  스케일(크기) 업데이트
 * ══════════════════════════════════════════ */
function updateScales() {
    syncScaleNode(STATE.nodeScale);
    syncScaleArrow(STATE.arrowScale);
}

function syncScaleNode(val) {
    if (val !== undefined) STATE.nodeScale = val;
    document.documentElement.style.setProperty('--node-scale', STATE.nodeScale);
    if (STATE.junctions) {
        Object.values(STATE.junctions).forEach(j => {
            if (j.marker && j.marker.setRadius) {
                const isSelected = (j.id === STATE.activeJid);
                j.marker.setRadius((isSelected ? 11 : 6) * STATE.nodeScale);
            }
        });
    }
}

function syncScaleArrow(val) {
    if (val !== undefined) STATE.arrowScale = val;
    document.documentElement.style.setProperty('--arrow-scale', STATE.arrowScale);
}

/* ══════════════════════════════════════════
 *  명칭 스타일 업데이트
 * ══════════════════════════════════════════ */
function updateNameStyles() {
    syncScaleName(window._currentNameSize || 11);
}

function syncScaleName(val) {
    if (val !== undefined) window._currentNameSize = val;
    else val = window._currentNameSize || 11;
    document.documentElement.style.setProperty('--name-size', val + 'px');
    document.querySelectorAll('.leaflet-tooltip-own').forEach(el => {
        el.style.fontSize = val + 'px';
    });
}
function syncColorName(val) {
    document.documentElement.style.setProperty('--name-color', val);
    document.querySelectorAll('.leaflet-tooltip-own').forEach(el => {
        el.style.color = val;
    });
}

/* ══════════════════════════════════════════
 *  툴팁 관리
 * ══════════════════════════════════════════ */
// refreshVisibleArrows → junction.js 정본 사용

function refreshVisibleTooltips() {
    const zoom = map.getZoom();
    const bounds = map.getBounds();

    STATE.showId = document.getElementById('chk-show-id')?.checked || false;
    STATE.showName = document.getElementById('chk-show-name')?.checked || false;
    STATE.showSeq = document.getElementById('chk-show-seq')?.checked || false;
    STATE.showPolice = document.getElementById('chk-show-police')?.checked || false;
    STATE.showOffice = document.getElementById('chk-show-office')?.checked || false;
    STATE.showCycle = document.getElementById('chk-show-cycle')?.checked || false;
    STATE.showOffset = document.getElementById('chk-show-offset')?.checked || false;
    STATE.showLatLng = document.getElementById('chk-show-latlng')?.checked || false;
    STATE.showGroup = document.getElementById('chk-show-group')?.checked || false;
    STATE.showController = document.getElementById('chk-show-controller')?.checked || false;

    // 현재 체크박스 상태를 강제로 STATE에 반영 (동기화 보장)
    Object.keys(STATE.junctions).forEach(jid => {
        const j = STATE.junctions[jid];
        if (!j.marker) return;

        // 주기 모드 시에는 더 낮은 줌 레벨(14)에서도 정보가 보이도록 허용 (성능 최적화 위해 13->14 상향)
        const minZoom = STATE.showCycleColors ? 14 : CONFIG.MIN_ZOOM_FOR_TEXT;
        const isVisible = bounds.contains([j.lat, j.lng]) && zoom >= minZoom;

        if (!isVisible && j.id !== STATE.activeJid) {
            j.marker.unbindTooltip();
            return;
        }
        refreshJunctionTooltip(jid);
    });
}

function refreshJunctionTooltip(jid) {
    const j = STATE.junctions[jid];
    if (!j || !j.marker) return;

    // [성능 극대화] 처음 생성 시점에 줌 레벨과 화면 영역을 무시하고 수만 개의 툴팁을 DOM에
    // 강제 주입하는 병목 현상을 막기 위해, 렌더링 전 최우선으로 가시성을 검사합니다.
    if (window.map) {
        const zoom = map.getZoom();
        const bounds = map.getBounds();
        const minZoom = STATE.showCycleColors ? 14 : CONFIG.MIN_ZOOM_FOR_TEXT;
        if ((zoom < minZoom || !bounds.contains([j.lat, j.lng])) && jid !== STATE.activeJid) {
            if (j.marker.getTooltip()) {
                j.marker.unbindTooltip();
                j.lastTooltipContent = null;
            }
            return; // 화면 밖이거나 줌아웃 상태면 아예 렌더링 연산을 수행하지 않음
        }
    }

    // [Fix] 주기 모드가 켜져 있으면 그룹ID와 주기를 강제로 표시
    const forceCycleInfo = STATE.showCycleColors;
    let { showId, showName, showSeq, showPolice, showOffice, showCycle, showOffset, showLatLng, showGroup, showController } = STATE;

    if (forceCycleInfo) {
        showGroup = true;
        showCycle = true;
    }

    if (!showId && !showName && !showSeq && !showPolice && !showOffice && !showCycle && !showOffset && !showLatLng && !showGroup && !showController) {
        j.marker.unbindTooltip();
        return;
    }

    const t = parseInt(UI.timeSlider.value);
    const simDayIdx = STATE.currentJunctionDayTypeIdx;
    const cycle = j._simCycle || getCurrentOperatingCycle(j, t, simDayIdx);

    let parts = [];
    if (showName) parts.push(`<span style="color:var(--name-color);">${j.name}</span>`);
    if (showId) parts.push(`ID: ${j.id}`);
    if (showSeq) parts.push(`SEQ: ${j.seq}`);
    if (showPolice) parts.push(`POL: ${j.police}`);
    if (showOffice) parts.push(`OFF: ${j.office}`);
    if (showGroup) parts.push(`GRP: ${j.group || 0}`);
    if (showCycle) {
        // [수정] 신호등 모드가 활성화되었을 때만 상세 잔여 시간(괄호 부분)을 표시함
        const cycleProgress = (j._simCycle && STATE.showSignalArrows) ? ` (${j._simPos || 0}/${j._simCycle}s)` : '';
        parts.push(`CYC: ${cycle}s${cycleProgress}`);
    }
    if (showOffset) parts.push(`OFS: ${getCurrentOperatingOffset(j, t, simDayIdx)}`);
    if (showController) parts.push(`CON: ${j.controller || '-'}`);
    if (showLatLng) parts.push(`${j.lat.toFixed(6)}, ${j.lng.toFixed(6)}`);

    const content = parts.join('<br>');

    // [성능최적화] 이전 내용과 동일하고 툴팁이 이미 존재하면 업데이트 건너뜀
    const z = window.map ? window.map.getZoom() : 18;
    const currentPermanent = (z >= 16 || jid === STATE.activeJid) && (STATE.showAllTooltips || jid === STATE.activeJid || STATE.showCycleColors || STATE.showName || STATE.showId || STATE.showSeq || STATE.showPolice || STATE.showOffice || STATE.showCycle || STATE.showOffset || STATE.showLatLng || STATE.showGroup || STATE.showController);
    const hasTooltip = !!j.marker.getTooltip();
    
    if (hasTooltip && j.lastTooltipContent === content && j.lastPermanentState === currentPermanent) {
        return;
    }
    j.lastTooltipContent = content;
    j.lastPermanentState = currentPermanent;

    if (j.marker.getTooltip()) {
        j.marker.setTooltipContent(content);
        if (j.marker.getTooltip().options.permanent !== j.lastPermanentState) {
            j.marker.unbindTooltip();
            bindNewTooltip(j, jid, content);
        }
    } else {
        bindNewTooltip(j, jid, content);
    }
}

function bindNewTooltip(j, jid, content) {
    const z = window.map ? window.map.getZoom() : 18;
    const isPermanent = (z >= 16 || jid === STATE.activeJid) && (STATE.showAllTooltips || jid === STATE.activeJid || STATE.showCycleColors || STATE.showName || STATE.showId || STATE.showSeq || STATE.showPolice || STATE.showOffice || STATE.showCycle || STATE.showOffset || STATE.showLatLng || STATE.showGroup || STATE.showController);
    j.marker.bindTooltip(content, {
        permanent: isPermanent,
        direction: 'top',
        className: 'leaflet-tooltip-own',
        offset: [0, -10],
        opacity: isPermanent ? 1 : 0.8
    });
}

function toggleAllTooltips() {
    STATE.showAllTooltips = !STATE.showAllTooltips;
    const btn = document.getElementById('btn-tooltip-all');
    if (btn) btn.classList.toggle('active', STATE.showAllTooltips);
    refreshVisibleTooltips();
}

/* ══════════════════════════════════════════
 *  신호등 / 주기 모드 토글
 * ══════════════════════════════════════════ */
function toggleSignalMode() {
    STATE.showSignalArrows = !STATE.showSignalArrows;
    UI.btnSignalMode.innerHTML = `🚦 신호등`;
    UI.btnSignalMode.classList.toggle('active', STATE.showSignalArrows);
    refreshVisibleArrows();

    // [New] 신호등 On 시 교차로 크기 1.5 확대, Off 시 0.5 축소
    const val = STATE.showSignalArrows ? 1.5 : 0.5;
    if (typeof syncScaleNode === 'function') {
        syncScaleNode(val);
        const labels = ['작게', '보통', '크게'];
        const step = (val === 1.5) ? 2 : 0;
        const valSpan = document.getElementById('val-node-size-bottom');
        if (valSpan) valSpan.innerText = labels[step];
        document.querySelectorAll('.step-slider').forEach(container => {
            const onclickAttr = container.getAttribute('onclick') || '';
            if (onclickAttr.includes("'node'") && typeof window.updateStepSliderUI === 'function') {
                window.updateStepSliderUI(container, step);
            }
        });
    }

    // [New] 신호등 On 시 컨트롤러(슬라이더) 표시, Off 시 숨김
    const controls = document.getElementById('sim-controls');
    if (controls) {
        const isMinimized = controls.classList.contains('minimized');
        if (STATE.showSignalArrows && isMinimized) {
            toggleControls(); // 펼치기
        } else if (!STATE.showSignalArrows && !isMinimized) {
            toggleControls(); // 숨기기
        }
    }

    // 신호등 On 시 자동 재생 & 4배속 기본값 설정, Off 시 자동 멈춤
    if (STATE.showSignalArrows) {
        if (typeof setSpeed === 'function') setSpeed(4); // [New] 기본 4배속 강제
        if (typeof startSim === 'function') startSim();
    } else {
        if (typeof pauseSim === 'function') pauseSim();
    }
}

function toggleCycleMode() {
    STATE.showCycleColors = !STATE.showCycleColors;
    UI.btnCycleMode.innerHTML = `🎨 주기`;
    UI.btnCycleMode.classList.toggle('active', STATE.showCycleColors);

    // [New] 주기 모드 활성화 시 체크박스 연동 및 STATE 강제 동기화
    if (STATE.showCycleColors) {
        const ids = ['chk-show-group', 'chk-show-cycle', 'chk-show-name'];
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.checked = true;
        });
        STATE.showGroup = true;
        STATE.showCycle = true;
        STATE.showName = true;
    }

    const leg = document.getElementById('legend-cycle-colors');
    if (leg) {
        leg.style.display = STATE.showCycleColors ? 'block' : 'none';
        if (STATE.showCycleColors) updateCycleLegend();
    }

    Object.keys(STATE.junctions).forEach(jid => drawJunction(jid, true));
    refreshVisibleTooltips(); // 강제 툴팁 갱신
}

function updateCycleLegend() {
    const leg = document.getElementById('legend-cycle-colors');
    let html = '<div style="font-weight:bold; margin-bottom:5px; border-bottom:1px solid #555; padding-bottom:3px;">신호주기 (초)</div>';
    [50, 100, 150, 200, 250].forEach(s => {
        html += `<div class="legend-item"><div class="legend-color" style="background:${getCycleColor(s)}"></div>${s}s</div>`;
    });
    leg.innerHTML = html;
}

/* ══════════════════════════════════════════
 *  TOD 모드 (현재 비활성 – 그룹 선택기 항상 표시)
 * ══════════════════════════════════════════ */
function toggleTodMode() {
    // 그룹 선택기는 항상 표시되도록 변경됨
}

/* ══════════════════════════════════════════
 *  주기 표시 업데이트 (Split 합계 vs 목표)
 * ══════════════════════════════════════════ */
function updateCycleDisplay(p, s) {
    const sA = p.splitA.reduce((a, b) => a + b, 0);
    const sB = p.splitB.reduce((a, b) => a + b, 0);
    const target = s.cycle || 100;
    const isMatch = (sA === target && sB === target);

    const cycInp = document.getElementById('tod-inp-cycle');
    if (cycInp) {
        cycInp.value = target;
        cycInp.style.color = isMatch ? '#00ff88' : '#ff4444';
    }

    const cycleInputInfo = document.getElementById('inp-cycle');
    if (cycleInputInfo) cycleInputInfo.value = isMatch ? target : 0;

    if (isMatch && STATE.junctions[STATE.activeJid]?.marker) {
        const color = getCycleColor(target);
        const inner = STATE.junctions[STATE.activeJid].marker.getElement()?.querySelector('div');
        if (inner) inner.style.backgroundColor = color;
    }
}

/* ══════════════════════════════════════════
 *  범용 데이터 테이블 뷰어 (Virtualized, Searchable, Editable)
 * ──────────────────────────────────────────
 *  Yearbook의 고성능 테이블 UI를 범용으로 확장
 * ══════════════════════════════════════════ */
/**
 * 범용 데이터 테이블 팝업 창 열기
 * @param {Object} options - { title, headers, data, type, onSync, existingIds }
 */
function goHome() {
    console.log("[UI] Resetting to post-load state...");

    // 1. 모든 선택 상태 해제
    if (typeof deselectJunction === 'function') deselectJunction();
    STATE.selectedJids = [];
    STATE.highlightedGroupId = null;

    // 2. 앱 모드 및 편집 상태 초기화
    if (typeof AppStateMachine !== 'undefined') {
        AppStateMachine.setMode(CONFIG.APP_MODE.SELECT);
    }
    STATE.isMapEditMode = false;
    STATE.isAddMode = false;
    STATE.isManualPlanView = false;

    // 3. 지도 및 시각화 레이어 초기화
    if (typeof map !== 'undefined') {
        if (CONFIG.DEFAULT_LATLNG) map.setView(CONFIG.DEFAULT_LATLNG, 13);
        
        // 연동 그룹 하이라이트 제거
        if (STATE.geoJsonLayer && typeof updateGeoJsonStyle === 'function') {
            updateGeoJsonStyle();
        }
    }

    // 4. 시간 및 시뮬레이션 초기화
    if (typeof goToCurrentTime === 'function') goToCurrentTime();
    if (typeof pauseSim === 'function') pauseSim();

    // 5. 탭 및 UI 패널 초기화
    openTab(null, 'tab-home');
    const leftSidebar = document.getElementById('left-search-sidebar');
    if (leftSidebar && !leftSidebar.classList.contains('hidden')) {
        if (typeof toggleLeftSidebar === 'function') toggleLeftSidebar();
    }

    // 6. 데이터 연동 UI 컴포넌트 강제 리프레시
    if (typeof refreshDBStats === 'function') refreshDBStats();
    if (typeof renderRingTables === 'function') renderRingTables();
    if (typeof renderSummaryTable === 'function') renderSummaryTable();
    if (typeof renderHomeDashboard === 'function') renderHomeDashboard();
    
    // 7. 지도 객체(마커/툴팁/화살표) 갱신
    if (typeof refreshVisibleTooltips === 'function') refreshVisibleTooltips();
    if (typeof refreshVisibleArrows === 'function') refreshVisibleArrows();
    
    // 8. 모든 마커 스타일 원복 (하이라이트 제거)
    Object.keys(STATE.junctions).forEach(jid => {
        if (typeof drawJunction === 'function') drawJunction(jid, true);
    });

    // 9. [추가] RoadManager (연동 도로망) 선택 및 하이라이트 초기화
    if (window.RoadManager) {
        window.RoadManager.selectedNode = null;
        window.RoadManager.highlightGroupId = null;
        if (typeof window.RoadManager.render === 'function') {
            window.RoadManager.render();
        }
    }

    // 10. [추가] Group TOD 탭의 멤버 하이라이트 제거
    if (typeof highlightGroupMembers === 'function') {
        highlightGroupMembers([]);
    }

    // 11. [추가] Yearbook (민원) 관련 가시 레이어 제거
    if (typeof clearCivilHighlight === 'function') {
        clearCivilHighlight();
    }
    if (STATE.showCivilMap && typeof toggleCivilMapLayer === 'function') {
        toggleCivilMapLayer(); // 맵 레이어 끄기
    }

    console.log("[UI] System successfully reset to home state.");
}
window.goHome = goHome;

/**
 * UTIC 신호 계획 동기화 트리거
 */
window.triggerUticPlanSync = async function() {
    if (!STATE.activeJid) {
        alert("선택된 교차로가 없습니다.");
        return;
    }
    const j = STATE.junctions[STATE.activeJid];
    if (!j) return;

    if (!confirm(`[${j.name}] 교차로의 TOD 운영 계획을 UTIC API로부터 가져와 DB에 반영하시겠습니까?`)) {
        return;
    }

    if (typeof showLoading === 'function') {
        showLoading("UTIC 신호 계획 동기화 중...");
    }

    try {
        const response = await fetch('/api/sim/sync-utic-plan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jid: j.id, itstNm: j.name })
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || "동기화 실패");
        }

        const resData = await response.json();
        if (resData.success) {
            alert(`[${j.name}] UTIC 신호 계획 동기화 성공! 분할 DB 파일에 실시간 업데이트되었습니다.`);
            // 데이터 재로딩
            if (typeof autoLoadFiles === 'function') {
                await autoLoadFiles();
            }
        } else {
            throw new Error("서버 응답 오류");
        }
    } catch (err) {
        alert("에러 발생: " + err.message);
    } finally {
        if (typeof hideLoading === 'function') {
            hideLoading();
        }
    }
};


window.handleStepSlider = function(e, container, paramType) {
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, x / rect.width));
    
    let step = 0;
    if (ratio < 0.33) step = 0;
    else if (ratio < 0.66) step = 1;
    else step = 2;
    
    window.updateStepSliderUI(container, step);
    
    const labels = ['작게', '보통', '크게'];
    if (paramType === 'node') {
        const vals = [0.5, 1.0, 1.5];
        document.getElementById('val-node-size-bottom').innerText = labels[step];
        if (typeof syncScaleNode === 'function') syncScaleNode(vals[step]);
    } else if (paramType === 'arrow') {
        const vals = [1.0, 1.5, 2.0]; 
        document.getElementById('val-arrow-size-bottom').innerText = labels[step];
        if (typeof syncScaleArrow === 'function') syncScaleArrow(vals[step]);
    } else if (paramType === 'weight') {
        const vals = [3, 8, 16]; 
        document.getElementById('txt-network-weight').innerText = labels[step];
        updateGroupLineWeight(vals[step]);
    } else if (paramType === 'name') {
        const vals = [9, 11, 14]; 
        document.getElementById('val-name-size-bottom').innerText = labels[step];
        if (typeof syncScaleName === 'function') syncScaleName(vals[step]);
    }
};

window.updateStepSliderUI = function(container, step) {
    const fill = container.querySelector('.step-slider-fill');
    const dots = container.querySelectorAll('.step-slider-dot');
    
    if (step === 0) fill.style.width = '0%';
    else if (step === 1) fill.style.width = '50%';
    else fill.style.width = 'calc(100% - 8px)';
    
    dots.forEach((dot, idx) => {
        if (idx <= step) {
            dot.style.background = '#38bdf8';
            if (idx === step) {
                dot.classList.add('active');
            } else {
                dot.classList.remove('active');
            }
        } else {
            dot.style.background = '#475569';
            dot.classList.remove('active');
        }
    });
};


window.updateGroupLineWeight = function(val) {
    if (typeof STATE !== 'undefined') {
        STATE.groupLineWeight = val;
        
        // CSS 변수로 강제 제어 (100% 확실한 반영)
        document.documentElement.style.setProperty('--group-line-weight', val + 'px');
        
        // 1. 일반 geoJsonLayer (기본 연동구간 표시) - Leaflet style 객체로도 업데이트
        if (STATE.geoJsonLayer && typeof STATE.geoJsonLayer.setStyle === 'function') {
            STATE.geoJsonLayer.setStyle({ weight: val });
        }
        
        // 2. RoadManager 에디터 캔버스 (우측 상단 '연동' 버튼 활성화 시 오버레이되는 라인)
        if (window.RoadManager) {
            window.RoadManager.baseWeight = val;
            if (window.RoadManager.isActive && typeof window.RoadManager.render === 'function') {
                window.RoadManager.render();
            }
        }
    }
};
