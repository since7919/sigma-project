/**
 * junction.js
 * ─────────────────────────────────────────────
 * 교차로 CRUD, 선택/해제, 마커 그리기, 화살표 관리
 * 의존: config.js, utils.js, ui.js, map.js
 */

let _arrowRefreshTask = null; // [성능 최적화] 화살표 렌더링 테스크 관리용

/* ══════════════════════════════════════════
 *  교차로 마커 그리기
 * ══════════════════════════════════════════ */


/* ══════════════════════════════════════════
 *  화살표 생성
 * ══════════════════════════════════════════ */


/* ══════════════════════════════════════════
 *  화살표 복제 / 삭제 / 제거
 * ══════════════════════════════════════════ */






/* ══════════════════════════════════════════
 *  화살표 위치 갱신 / 가시성 관리
 * ══════════════════════════════════════════ */








/* ══════════════════════════════════════════
 *  교차로 선택
 * ══════════════════════════════════════════ */
function selectJunction(jid, isMulti = false) {
    if (!jid || !STATE.junctions[jid]) {
        deselectJunction();
        return;
    }

    // [On-Demand 로딩] 상세 데이터가 없으면 백엔드에서 비동기로 가져옵니다.
    if (!STATE.junctions[jid]._detailLoaded) {
        document.body.style.cursor = 'wait';
        fetchJunctionDetail(jid).then(() => {
            document.body.style.cursor = 'default';
            // 재귀 호출하여 이후 로직(사이드바 렌더링 등)을 수행합니다.
            selectJunction(jid, isMulti);
        });
        return; // 데이터가 로드된 후 다시 실행되므로 여기서 일시 중지
    }


    // [추가] 새로운 교차로 선택 시 기존의 민원 강조(지도 상의 원형 표시)를 제거하여 가독성 확보
    if (typeof clearCivilHighlight === 'function') clearCivilHighlight();
    const oldJids = [...STATE.selectedJids];
    
    if (!isMulti) {
        STATE.selectedJids = [jid];
    } else {
        if (!STATE.selectedJids.includes(jid)) STATE.selectedJids.push(jid);
    }
    
    STATE.activeJid = jid;

    // 이전 선택된 마커들 스타일 갱신 및 화살표 가시성 처리
    oldJids.forEach(oid => {
        if (!STATE.selectedJids.includes(oid)) {
            drawJunction(oid);
            removeArrows(oid);
        } else {
            drawJunction(oid, true); // 보더 컬러 등 스타일만 갱신
        }
    });

    // 현재 선택된 목록들 갱신
    STATE.selectedJids.forEach(sjid => {
        drawJunction(sjid);
        createArrows(sjid);
    });

    // Sidebar List Highlight
    document.querySelectorAll('.j-list-item').forEach(el => {
        el.classList.toggle('active', STATE.selectedJids.includes(el.dataset.id));
    });

    if (UI.editor) UI.editor.style.display = 'block';

    const j = STATE.junctions[jid];

    // [신규] 편집기 제목 업데이트
    const titleEl = document.getElementById('phase-editor-title');
    if (titleEl) {
        const displayName = (j.name && j.name.trim() !== "") ? j.name : `교차로 #${j.id}`;
        console.log(`[selectJunction] ID: ${jid}, Name: ${j.name}, Display: ${displayName}`);
        titleEl.innerHTML = `<span style="opacity:0.6; font-size:12px; margin-right:5px;">EDITING:</span> ${displayName}`;
    }

    // 10일 데이터 구조 초기화 및 마이그레이션 (일계획 1~10 대응)
    if (!j.dayPlans || j.dayPlans.length < 10) {
        const oldPlans = (j.dayPlans && j.dayPlans.length > 0) ? j.dayPlans : (j.plans || Array.from({ length: 16 }, () => ({
            offset: 0, splitA: [0, 0, 0, 0, 0, 0, 0, 0], splitB: [0, 0, 0, 0, 0, 0, 0, 0],
            yellowA: [3, 3, 3, 3, 0, 0, 0, 0], yellowB: [3, 3, 3, 3, 0, 0, 0, 0],
            allredA: [2, 2, 2, 2, 0, 0, 0, 0], allredB: [2, 2, 2, 2, 0, 0, 0, 0],
            pedA: [0, 0, 0, 0, 0, 0, 0, 0], pedB: [0, 0, 0, 0, 0, 0, 0, 0],
            pedDelayA: [0, 0, 0, 0, 0, 0, 0, 0], pedDelayB: [0, 0, 0, 0, 0, 0, 0, 0]
        })));
        
        j.dayPlans = Array.from({ length: 10 }, (_, i) => {
            const src = Array.isArray(oldPlans[0]) ? oldPlans[i % oldPlans.length] : oldPlans;
            return JSON.parse(JSON.stringify(src));
        });
        delete j.plans;
    }
    if (!j.schedules || j.schedules.length < 10) {
        const oldSched = (j.schedules && j.schedules.length > 0) ? j.schedules : (j.schedule || Array.from({ length: 16 }, (_, i) => ({ h: i === 0 ? 0 : -1, m: 0, cycle: 100 })));
        j.schedules = Array.from({ length: 10 }, (_, i) => {
            const src = Array.isArray(oldSched[0]) ? oldSched[i % oldSched.length] : oldSched;
            return JSON.parse(JSON.stringify(src));
        });
        delete j.schedule;
    }
    if (!j.dayPlanMapIds || j.dayPlanMapIds.length < 10) {
        j.dayPlanMapIds = new Array(10).fill(0);
    }

    // 정보 채우기
    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val ?? ''; };
    const setChk = (id, checked) => { const el = document.getElementById(id); if (el) el.checked = !!checked; };

    setVal('inp-id', j.id);
    setVal('inp-name', j.name);
    setVal('inp-seq', j.seq);
    setVal('inp-police', j.police);
    setVal('inp-office', j.office);
    setVal('inp-controller', j.controller || "");
    setVal('inp-api-int-no', (j.apiIntNo !== undefined && j.apiIntNo !== null) ? j.apiIntNo : "");



    const dayIdx = STATE.currentJunctionDayTypeIdx;
    const pIdx = parseInt(UI.planIdx ? UI.planIdx.value : 0) || 0;
    const p = (j.dayPlans && j.dayPlans[dayIdx]) ? j.dayPlans[dayIdx][pIdx] || {} : {};

    let s = (j.schedules && j.schedules[dayIdx]) ? j.schedules[dayIdx][pIdx] : null;
    if (j.group && STATE.groups[j.group] && STATE.groups[j.group].schedules) {
        s = STATE.groups[j.group].schedules[dayIdx][pIdx];
    }

    const t = parseInt(UI.timeSlider?.value) || 25200;
    const currentOpCycle = getCurrentOperatingCycle(j, t, dayIdx);
    const selectedPlanCycle = (p.splitA || []).reduce((a, b) => a + b, 0);

    setVal('tod-inp-cycle', selectedPlanCycle);
    setVal('inp-cycle', currentOpCycle);
    setVal('inp-offset', getCurrentOperatingOffset(j, t, dayIdx));
    setVal('tod-inp-offset', p.offset ?? 0);
    setVal('inp-lat', j.lat ? j.lat.toFixed(9) : '');
    setVal('inp-lng', j.lng ? j.lng.toFixed(9) : '');
    setVal('inp-group-id', j.group || 0);
    setVal('inp-group-assign', j.group || 0);

    // 플래시 설정 로드
    setChk('flash-enable', j.flashEnable);

    // 3개 시간 로드
    const fTimes = j.flashTimes || [];
    for (let k = 1; k <= 3; k++) {
        const tObj = fTimes[k - 1] || { s: "", e: "" };
        const startEl = document.getElementById(`flash-start-${k}`);
        const endEl = document.getElementById(`flash-end-${k}`);
        if (startEl) startEl.value = tObj.s || "";
        if (endEl) endEl.value = tObj.e || "";
    }

    // 이동류 텍스트 필드 로드
    const ylEl = document.getElementById('inp-flash-yellows');
    const rdEl = document.getElementById('inp-flash-reds');
    if (ylEl) ylEl.value = (j.flashYellows || []).join(', ');
    if (rdEl) rdEl.value = (j.flashReds || []).join(', ');

    // 운영자 개입 제어 로드
    const opTop = j.opIntervention || { enable: false, rows: [] };
    if (document.getElementById('op-enable')) document.getElementById('op-enable').checked = !!opTop.enable;

    const opRows = opTop.rows || [];
    for (let k = 1; k <= 3; k++) {
        const r = opRows[k - 1] || { s: "", e: "", cycle: 100, offset: 0, splitA: [], splitB: [] };
        const sEl = document.getElementById(`op-start-${k}`);
        const eEl = document.getElementById(`op-end-${k}`);
        const cEl = document.getElementById(`op-cycle-${k}`);
        const oEl = document.getElementById(`op-offset-${k}`);
        const spEl = document.getElementById(`op-splits-${k}`);

        if (sEl) sEl.value = r.s || "";
        if (eEl) eEl.value = r.e || "";
        if (cEl) cEl.value = r.cycle || 100;
        if (oEl) oEl.value = r.offset || 0;
        const spAEl = document.getElementById(`op-splits-a-${k}`);
        const spBEl = document.getElementById(`op-splits-b-${k}`);
        if (spAEl) spAEl.value = (r.splitA || []).join(',');
        if (spBEl) spBEl.value = (r.splitB || []).join(',');
    }

    SigmaUI.renderArrowCountGrid('arrow-count-grid', j);

    // [공지] Group TOD탭 활성화 시 연동 그룹ID 자동 입력 및 조회
    const groupTabEl = document.getElementById('tab-group');
    if (groupTabEl && groupTabEl.classList.contains('active')) {
        if (j.group && j.group !== "0" && j.group !== 0) {
            if (typeof currentEditingGroup !== 'undefined' && String(currentEditingGroup) !== String(j.group)) {
                if (typeof loadGroupInfo === 'function') loadGroupInfo(true, j.group);
            }
        }
    }

    // 운영 통계 로드
    // 8지 교차로 최적화 & 운영 요약 로드
    if (typeof loadOptStateFromJunction === 'function') {
        loadOptStateFromJunction(j);
    } else {
        renderOpStatsTable();
        renderJunctionStatsTable();
    }

    renderCivilStats(jid);

    updateNameStyles();
    
    if (j.marker) {
        console.log(`[Popup] Opening popup for ${jid}`);
        j.marker.bindPopup(`
          <div class="popup-content">
            <h3>${j.name}</h3>
            <div style="display:flex; flex-direction:column; gap:5px; margin-top:10px;">
              <button class="btn-detail" onclick="STATE.activeJid='${jid}'; openDetailOverlay('${jid}'); map.closePopup();">상세보기</button>
              <button class="btn-detail" style="background:#e67e22; margin-top:3px;" onclick="STATE.activeJid='${jid}'; openStatsOverlay('${jid}'); map.closePopup();">운영통계</button>
              <button class="btn-detail" style="background:#27ae60; margin-top:3px;" onclick="STATE.activeJid='${jid}'; if(typeof openDbReportOverlay === 'function') openDbReportOverlay('${jid}'); else alert('준비중입니다.'); map.closePopup();">DB보기</button>
            </div>
          </div>
        `, { className: 'custom-popup', closeButton: true });
        
        setTimeout(() => {
            j.marker.openPopup();
        }, 50);
    }
    
    // [Fix] UI 갱신을 100ms 지연 실행하여 데이터 로드 및 DOM 안정성 확보
    setTimeout(() => {
        console.log(`[selectJunction] Executing Delayed Robust Sync for JID: ${jid}`);
        
        // 1. 현재 시간 기준 컨텍스트 감지
        if (typeof getSimContext === 'function') {
            const context = getSimContext(j, t);
            STATE.currentJunctionDayTypeIdx = context.dayIdx;
        }

        const tasks = [
            { name: 'Group Info', fn: () => {
                const groupTabEl = document.getElementById('tab-group');
                if (groupTabEl && groupTabEl.classList.contains('active')) {
                    if (j.group && j.group !== "0" && j.group !== 0) {
                        if (typeof loadGroupInfo === 'function') loadGroupInfo(true, j.group);
                    }
                }
            }},
            { name: 'Optimizer Info', fn: () => {
                if (typeof loadOptStateFromJunction === 'function') {
                    loadOptStateFromJunction(j);
                } else {
                    if (typeof renderOpStatsTable === 'function') renderOpStatsTable();
                    if (typeof renderJunctionStatsTable === 'function') renderJunctionStatsTable();
                }
            }},
            { name: 'Civil Stats', fn: () => {
                if (typeof renderCivilStats === 'function') renderCivilStats(jid);
            }},
            { name: 'Name Styles', fn: () => {
                if (typeof updateNameStyles === 'function') updateNameStyles();
            }},
            { name: 'Phase/Split Sync', fn: () => {
                if (typeof changeJunctionDayType === 'function') {
                    changeJunctionDayType(STATE.currentJunctionDayTypeIdx);
                } else {
                    if (typeof renderRingTables === 'function') renderRingTables();
                    if (typeof renderSummaryTable === 'function') renderSummaryTable();
                    if (typeof updateJunctionDayUI === 'function') updateJunctionDayUI();
                }
            }},
            { name: 'Signal Map Sync', fn: () => {
                if (typeof renderSignalMapTab === 'function') renderSignalMapTab();
            }}
        ];

        tasks.forEach(task => {
            try { task.fn(); } 
            catch (e) { console.error(`[selectJunction] Task Failed: ${task.name}`, e); }
        });
        
        if (typeof syncConfigEditUI === 'function') {
            try { syncConfigEditUI(); } catch(e) {}
        }

        // [추가] 현재 활성화된 탭이 있으면 해당 탭의 렌더링 함수를 한번 더 호출 (강제 리프레시)
        const activeTabBtn = document.querySelector('.tabs .tab.active, .menu-item.active');
        if (activeTabBtn) {
            const onclickStr = activeTabBtn.getAttribute('onclick') || "";
            const match = onclickStr.match(/openTab\([^,]+,\s*'([^']+)'\)/);
            if (match && match[1]) {
                const tabName = match[1];
                console.log(`[selectJunction] Forcing final refresh for active tab: ${tabName}`);
                if (typeof openTab === 'function') openTab(null, tabName);
            }
        }
    }, 100);
}

/* ══════════════════════════════════════════
 *  교차로 선택 해제
 * ══════════════════════════════════════════ */
function deselectJunction() {
    const oldJids = [...STATE.selectedJids];
    STATE.activeJid = null;
    STATE.selectedJids = [];
    
    oldJids.forEach(jid => {
        if (STATE.junctions[jid]) {
            drawJunction(jid);
            if (!STATE.showSignalArrows) {
                removeArrows(jid);
            }
        }
    });

    ['inp-id', 'inp-name', 'inp-seq', 'inp-police', 'inp-office', 'inp-cycle', 'inp-lat', 'inp-lng', 'inp-group-id', 'inp-api-int-no'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = "";
    });

    const titleEl = document.getElementById('phase-editor-title');
    if (titleEl) {
        titleEl.innerHTML = `<span style="opacity:0.6; font-size:12px; margin-right:5px;">EDITING:</span> 교차로 미선택`;
    }

    const grid = document.getElementById('arrow-count-grid');
    if (grid) grid.innerHTML = '<div style="grid-column: span 8; color:#555; font-size:11.5px; padding:10px;">교차로를 선택하면 나타납니다.</div>';

    document.querySelectorAll('.inp-op-det-num').forEach(el => el.value = 0);
    document.querySelectorAll('.inp-op-det-chk').forEach(el => el.checked = false);
    document.querySelectorAll('.inp-op-global').forEach(el => el.checked = false);

    if (typeof loadOptStateFromJunction === 'function') {
        loadOptStateFromJunction(null);
    } else {
        if (typeof renderOpStatsTable === 'function') renderOpStatsTable();
        if (typeof renderJunctionStatsTable === 'function') renderJunctionStatsTable();
    }
    if (typeof renderCivilStats === 'function') renderCivilStats(null);
    if (typeof renderCivilSummary === 'function') renderCivilSummary();
    
    // [추가] 선택 해제 시 민원 강조 레이어도 함께 제거
    if (typeof clearCivilHighlight === 'function') clearCivilHighlight();

    renderRingTables();
}

/** [New] 다중 선택 토글 (Shift + Click) */
function toggleSelectJunction(jid) {
    if (!jid || !STATE.junctions[jid]) return;
    
    const idx = STATE.selectedJids.indexOf(jid);
    if (idx !== -1) {
        // 이미 선택된 경우 제거
        STATE.selectedJids.splice(idx, 1);
        drawJunction(jid);
        removeArrows(jid);
        
        if (STATE.activeJid === jid) {
            STATE.activeJid = STATE.selectedJids.length > 0 ? STATE.selectedJids[STATE.selectedJids.length - 1] : null;
            if (STATE.activeJid) selectJunction(STATE.activeJid, true);
            else deselectJunction();
        }
    } else {
        // 새로 추가
        selectJunction(jid, true);
    }
}

/* ══════════════════════════════════════════
 *  교차로 추가 / 삭제
 * ══════════════════════════════════════════ */
function toggleAddMode() {
    if (STATE.appMode === CONFIG.APP_MODE.MAP_EDIT) {
        alert("신호등 편집을 먼저 종료하세요.");
        return;
    }
    
    if (STATE.appMode === CONFIG.APP_MODE.ADD_NODE) {
        AppStateMachine.setMode(CONFIG.APP_MODE.SELECT);
    } else {
        AppStateMachine.setMode(CONFIG.APP_MODE.ADD_NODE);
    }
}

function deleteJunction() {
    if (!STATE.activeJid) return;
    if (confirm("삭제하시겠습니까?")) {
        const jid = STATE.activeJid;
        const j = STATE.junctions[jid];
        if (j.marker) map.removeLayer(j.marker);
        removeArrows(jid);
        delete STATE.junctions[jid];
        deselectJunction();
        if (typeof sendToDashboard === 'function') sendToDashboard();
    }
}

/* ══════════════════════════════════════════
 *  교차로 정보 적용
 * ══════════════════════════════════════════ */
/**
 * 현재 활성화된 교차로의 UI 입력값을 STATE에 동기화 (저장 전 호출)
 */
function syncActiveJunctionData() {
    if (!STATE.activeJid) return;
    const j = STATE.junctions[STATE.activeJid];

    // 기본 정보 동기화
    const elId = document.getElementById('inp-id');
    const elName = document.getElementById('inp-name');
    const elSeq = document.getElementById('inp-seq');
    const elPolice = document.getElementById('inp-police');
    const elOffice = document.getElementById('inp-office');
    const elController = document.getElementById('inp-controller');
    const elCycle = document.getElementById('inp-cycle');
    const elLat = document.getElementById('inp-lat');
    const elLng = document.getElementById('inp-lng');
    const elApiIntNo = document.getElementById('inp-api-int-no');

    if (elId) j.id = elId.value;
    if (elName) {
        if (j.name !== elName.value) {
            j.name = elName.value;
            if (typeof STATE !== 'undefined') STATE.sortedJunctions = null;
        }
    }
    if (elSeq) j.seq = elSeq.value;
    if (elPolice) j.police = elPolice.value;
    if (elOffice) j.office = elOffice.value;
    if (elController) j.controller = elController.value;
    if (elCycle) j.cycle = parseInt(elCycle.value) || 100;
    if (elLat) j.lat = parseFloat(elLat.value) || 37.5;
    if (elLng) j.lng = parseFloat(elLng.value) || 127.0;
    if (elApiIntNo) {
        const val = elApiIntNo.value.trim();
        j.apiIntNo = val !== "" ? val : null;
    }

    // 점멸 설정 동기화
    const flEnable = document.getElementById('flash-enable');
    if (flEnable) j.flashEnable = flEnable.checked;

    j.flashTimes = [];
    for (let k = 1; k <= 3; k++) {
        const s = document.getElementById(`flash-start-${k}`)?.value || "";
        const e = document.getElementById(`flash-end-${k}`)?.value || "";
        if (s || e) j.flashTimes.push({ s, e });
    }

    const yStr = document.getElementById('inp-flash-yellows')?.value || "";
    const rStr = document.getElementById('inp-flash-reds')?.value || "";
    j.flashYellows = yStr.split(/[,; ]+/).filter(x => x).map(Number);
    j.flashReds = rStr.split(/[,; ]+/).filter(x => x).map(Number);

    // 운영자 개입 제어 동기화
    const opEn = document.getElementById('op-enable');
    const opTopData = { enable: opEn ? opEn.checked : false, rows: [] };
    for (let k = 1; k <= 3; k++) {
        const s = document.getElementById(`op-start-${k}`)?.value || "";
        const e = document.getElementById(`op-end-${k}`)?.value || "";
        const c = parseInt(document.getElementById(`op-cycle-${k}`)?.value) || 100;
        const o = parseInt(document.getElementById(`op-offset-${k}`)?.value) || 0;
        const spA = document.getElementById(`op-splits-a-${k}`)?.value || "";
        const spB = document.getElementById(`op-splits-b-${k}`)?.value || "";

        if (s || e || spA || spB) {
            const sA = spA.split(/[,; ]+/).filter(x => x).map(Number);
            const sB = spB.split(/[,; ]+/).filter(x => x).map(Number);
            opTopData.rows.push({ s, e, cycle: c, offset: o, splitA: sA, splitB: sB });
        }
    }
    j.opIntervention = opTopData;

    // 화살표 개수(위치 설정) 동기화
    document.querySelectorAll('.inp-arrow-count').forEach(el => {
        const m = parseInt(el.dataset.mov);
        const targetCount = parseInt(el.value) || 0;
        if (!j.arrowConfigs[m]) j.arrowConfigs[m] = [];
        if (!Array.isArray(j.arrowConfigs[m])) j.arrowConfigs[m] = [j.arrowConfigs[m]];

        const currentCount = j.arrowConfigs[m].length;
        if (targetCount > currentCount) {
            for (let k = 0; k < targetCount - currentCount; k++) {
                const last = j.arrowConfigs[m][j.arrowConfigs[m].length - 1] || { dLat: 0.0001, dLng: 0.0001, rot: 0 };
                j.arrowConfigs[m].push({ dLat: last.dLat + 0.00005, dLng: last.dLng + 0.00005, rot: last.rot });
            }
        } else if (targetCount < currentCount) {
            j.arrowConfigs[m].splice(targetCount);
        }
    });

    // Optimizer 및 상세 운영 통계 동기화
    if (typeof saveOptToActiveJunction === 'function') {
        saveOptToActiveJunction();
    }

    if (!j.opStatsDetailed) j.opStatsDetailed = { directional: {}, global: {} };
    const opData = j.opStatsDetailed;

    document.querySelectorAll('.inp-op-det-num').forEach(el => {
        const key = `${el.dataset.row}-${el.dataset.dir}`;
        opData.directional[key] = parseInt(el.value) || 0;
    });
    document.querySelectorAll('.inp-op-det-chk').forEach(el => {
        const key = `${el.dataset.row}-${el.dataset.dir}`;
        opData.directional[key] = el.checked;
    });
    document.querySelectorAll('.inp-op-global').forEach(el => {
        opData.global[el.dataset.key] = el.checked;
    });
}

function applyInfo() {
    if (!STATE.activeJid) return;

    syncActiveJunctionData();

    const savedJid = STATE.activeJid;
    drawJunction(savedJid);
    createArrows(savedJid);
    if (typeof sendToDashboard === 'function') sendToDashboard();
    alert("정보가 적용되었습니다.");
}

/* ══════════════════════════════════════════
 *  교차로 선택 + 줌 이동
 * ══════════════════════════════════════════ */
/**
 * 교차로 선택 + 줌 이동
 */
function selectJunctionAndZoom(jid, noSwitchTab) {
    if (!jid || !STATE.junctions[jid]) return;
    
    if (typeof flyToIntersection === 'function') {
        flyToIntersection(jid);
    } else {
        const j = STATE.junctions[jid];
        map.flyTo([j.lat, j.lng], 17);
        selectJunction(jid);
    }
    
    if (!noSwitchTab) openTab(null, 'tab-info');
}

/* ══════════════════════════════════════════
 *  그룹 TOD 적용
 * ══════════════════════════════════════════ */
function applyGroupTOD() {
    if (!STATE.activeJid) return;
    const gid = parseInt(document.getElementById('inp-group-assign').value);

    if (gid === 0) {
        if (!confirm("현재 교차로를 그룹에서 해제하시겠습니까?")) return;
        STATE.junctions[STATE.activeJid].group = 0;
        document.getElementById('inp-group-id').value = 0;
        alert("그룹 해제되었습니다.");
        return;
    }

    if (!gid || !STATE.groups[gid]) {
        alert("존재하지 않는 그룹입니다.\nGroup TOD 탭에서 그룹을 먼저 생성한 후 그룹번호를 지정하세요.");
        return;
    }
    if (!confirm(`${gid}번 그룹(${STATE.groups[gid].name || ''})의 모든 요일 TOD 시간표를 현재 교차로에 적용하고 그룹을 지정하시겠습니까?`)) return;

    const j = STATE.junctions[STATE.activeJid];
    j.group = gid;
    document.getElementById('inp-group-id').value = gid;
    j.schedules = JSON.parse(JSON.stringify(STATE.groups[gid].schedules));
    renderRingTables();
    if (typeof sendToDashboard === 'function') sendToDashboard();
    alert(`그룹 ${gid}번으로 지정 및 5일 TOD 일괄 적용되었습니다.`);
}

/**
 * 위치정보(lat, lng)를 기반으로 백엔드에서 가장 가까운 API 교차로를 조회하여
 * API 매칭번호(api_int_no) 입력창에 자동으로 입력한다.
 */
async function autoMatchNearestAPIIntersection() {
    const jid = STATE.activeJid;
    if (!jid || !STATE.junctions[jid]) {
        alert("교차로를 먼저 선택해 주세요.");
        return;
    }

    const j = STATE.junctions[jid];
    if (!j.lat || !j.lng) {
        alert("교차로의 위도와 경도가 유효하지 않습니다.");
        return;
    }

    const region = j.region || (jid.startsWith("L02-") ? "L02" : "L01");

    try {
        const response = await fetch(`/api/intersections/nearest?lat=${j.lat}&lng=${j.lng}&regionCode=${region}`);
        const result = await response.json();
        
        if (result.success && result.int_no !== undefined) {
            if (result.distance <= 0.03) { // 30m 이내
                if (confirm(`가장 가까운 유틱 교차로를 찾았습니다.\n\n교차로명: ${result.int_nm} (${result.origin_type})\n번호: ${result.int_no}\n거리: ${(result.distance * 1000).toFixed(1)} m\n\n이 교차로 번호로 매칭하시겠습니까?`)) {
                    
                    const el = document.getElementById('inp-api-int-no');
                    if (el) {
                        el.value = result.int_no;
                        // 모델 데이터 동기화
                        j.apiIntNo = result.int_no;
                        syncActiveJunctionData();
                        alert(`✅ 유틱 교차로 번호 [${result.int_no}]가 정상 매칭되었습니다.`);
                    }
                }
            } else {
                alert("30m 이내에 유틱 교차로가 없습니다.");
            }
        } else {
            alert("30m 이내에 유틱 교차로가 없습니다.");
        }
    } catch (e) {
        console.error("자동 매칭 중 오류 발생:", e);
        alert("자동 매칭 요청 중 오류가 발생했습니다. 백엔드 서버 상태를 확인해 주세요.");
    }
}
