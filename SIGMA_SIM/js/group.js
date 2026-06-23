/**
 * group.js
 * ─────────────────────────────────────────────
 * 그룹 편집, TOD 테이블, 요일별 주기 차트,
 * 그룹 목록, 그룹 CSV 저장/불러오기
 * 의존: config.js, utils.js, ui.js
 */

let currentEditingGroup = null;
let selectedGroupDays = [0];
let groupCycleChart = null;

let groupHighlightMarkers = [];

/** 시공도 도면 순서 업데이트 */
function updateJunctionDiagramOrder(jid, val) {
    if (!STATE.junctions[jid]) return;
    if (!STATE.junctions[jid].extra) STATE.junctions[jid].extra = {};
    STATE.junctions[jid].extra.diagramOrder = parseInt(val);
    console.log(`[DiagramOrder] Junction ${jid} set to ${STATE.junctions[jid].extra.diagramOrder}`);

    // 순서 변경 시 목록 재정렬 및 렌더링 (차트 리프레시는 불필요하므로 false 전달)
    loadGroupInfo(false);
}

/** 시공도 포함 여부 토글 */
function toggleJunctionTsdInclusion(jid, isChecked) {
    if (!STATE.junctions[jid]) return;
    if (!STATE.junctions[jid].extra) STATE.junctions[jid].extra = {};
    
    // Checked 상태면 제외 플래그를 false로, Unchecked면 true로 설정
    STATE.junctions[jid].extra.excludeFromTsd = !isChecked;
    console.log(`[TSD Exclusion] Junction ${jid} is now ${!isChecked ? 'Excluded' : 'Included'}`);
    
    // 리스트 가독성을 위해 즉시 재렌더링
    loadGroupInfo(false);
}

/** [사용자 요청] 소속 교차로(시공도 설정) 정렬 기능 */
function sortGroupMembers(type) {
    const gid = currentEditingGroup;
    if (!gid) return;

    let members = Object.values(STATE.junctions).filter(j => String(j.group) === String(gid));
    // 체크된 교차로(excludeFromTsd가 true가 아닌 것)만 대상
    let included = members.filter(j => !(j.extra && j.extra.excludeFromTsd));
    
    if (type === 'SN') {
        // S-N: 위도(lat)가 낮은 순 (오름차순)
        included.sort((a, b) => (a.lat || 0) - (b.lat || 0));
    } else if (type === 'EW') {
        // E-W: 경도(lng)가 높은 순 (내림차순)
        included.sort((a, b) => (b.lng || 0) - (a.lng || 0));
    }
    
    // 순서 재부여 (1번부터)
    included.forEach((m, idx) => {
        if (!m.extra) m.extra = {};
        m.extra.diagramOrder = idx + 1;
    });
    
    // 다시 렌더링
    loadGroupInfo(false);
}

/** 일계획 별칭 업데이트 (전역 노출) */
function updatePlanAlias(dayIdx, name) {
    const gid = currentEditingGroup;
    if (!gid || !STATE.groups[gid]) return;
    if (!STATE.groups[gid].planAliases) STATE.groups[gid].planAliases = Array(10).fill("");
    STATE.groups[gid].planAliases[dayIdx] = name;
    
    // UI 즉시 갱신 (라디오 버튼 명칭 등)
    updateGroupDayUI();
}
window.updatePlanAlias = updatePlanAlias;

/** 그룹 탭 내 패널 리사이저 설정 */
function initGroupTabResizer() {
    const resizer = document.getElementById('group-tab-resizer');
    const leftPanel = document.getElementById('group-detail-panel');
    const container = document.getElementById('group-tab-resizable-container');
    if (!resizer || !leftPanel || !container) return;

    let isResizing = false;
    resizer.addEventListener('mousedown', (e) => {
        isResizing = true;
        document.body.style.cursor = 'col-resize';
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;
        const containerRect = container.getBoundingClientRect();
        const offsetX = e.clientX - containerRect.left;
        const totalWidth = containerRect.width;
        let flexLeft = offsetX / totalWidth * 2; // flex 합이 2 (1.4+0.6)
        if (flexLeft < 0.3) flexLeft = 0.3;
        if (flexLeft > 1.7) flexLeft = 1.7;
        leftPanel.style.flex = flexLeft;
        document.getElementById('group-list-panel').style.flex = 2 - flexLeft;
    });

    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            document.body.style.cursor = '';
        }
    });
}

/* ══════════════════════════════════════════
 *  그룹 멤버 하이라이트 (지도)
 * ══════════════════════════════════════════ */
function highlightGroupMembers(members) {
    groupHighlightMarkers.forEach(m => map.removeLayer(m));
    groupHighlightMarkers = [];
    if (!members || members.length === 0) return;

    const latlngs = [];
    members.forEach(j => {
        // [수정] 시공도 포함 여부(체크박스) 확인. 제외된 경우 하이라이트와 순서 번호 생략
        const isExcluded = (j.extra && j.extra.excludeFromTsd === true);
        
        if (!isExcluded) {
            // 1. 하이라이트 원형 마커
            const hMarker = L.circleMarker([j.lat, j.lng], {
                radius: 15,
                color: '#00d4ff',
                weight: 3,
                fillColor: '#00d4ff',
                fillOpacity: 0.15,
                interactive: false,
                className: 'neon-pulse'
            }).addTo(map);
            groupHighlightMarkers.push(hMarker);

            // 2. 도면 순서 번호 표시 (있을 경우만)
            const diagOrder = (j.extra && j.extra.diagramOrder !== undefined) ? j.extra.diagramOrder : -1;
            if (diagOrder !== -1) {
                const seqIcon = L.divIcon({
                    className: 'group-seq-marker',
                    html: `<div style="background:var(--accent); color:#000; font-weight:bold; font-size:11px; border-radius:50%; width:18px; height:18px; display:flex; align-items:center; justify-content:center; border:1px solid #fff; box-shadow:0 0 5px rgba(0,0,0,0.5);">${diagOrder}</div>`,
                    iconSize: [18, 18],
                    iconAnchor: [9, 9]
                });
                const sMarker = L.marker([j.lat, j.lng], { icon: seqIcon, interactive: false, zIndexOffset: 1500 }).addTo(map);
                groupHighlightMarkers.push(sMarker);
            }
            // 3. 교차로 명칭 표시 (사용자 요청: 선택된 그룹은 이름 상시 노출)
            const nameIcon = L.divIcon({
                className: 'group-name-marker',
                html: `<div style="color:var(--accent); font-weight:700; font-size:12px; text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000, 0 0 8px rgba(0,0,0,0.8); white-space:nowrap; margin-top:22px; text-align:center; transform:translateX(-50%);">${j.name || j.id}</div>`,
                iconSize: [0, 0],
                iconAnchor: [0, 0]
            });
            const nMarker = L.marker([j.lat, j.lng], { icon: nameIcon, interactive: false, zIndexOffset: 1500 }).addTo(map);
            groupHighlightMarkers.push(nMarker);
        }
        
        // 지도의 자동 줌(Bounds) 범위에는 포함
        latlngs.push([j.lat, j.lng]);
    });

    if (latlngs.length > 0) {
        const bounds = L.latLngBounds(latlngs);
        // [사용자 요청] 이동 속도 단축 (duration: 0.8)
        map.flyToBounds(bounds, { padding: [100, 100], maxZoom: 16, duration: 0.8 });
    }
}

function clearHighlightGroupMembers() {
    groupHighlightMarkers.forEach(m => map.removeLayer(m));
    groupHighlightMarkers = [];
}

/**
 * 그룹 정보 로드
 * @param {boolean} refreshChart - 차트 재렌더링 여부 (기본 true)
 */
function loadGroupInfo(refreshChart = true, targetGid = null) {
    const gidValue = targetGid !== null ? targetGid : document.getElementById('inp-edit-group-id').value;
    const gid = parseInt(gidValue);
    
    if (!gid || isNaN(gid)) return;
    currentEditingGroup = gid;
    
    // UI ID 동기화
    const inpEdit = document.getElementById('inp-edit-group-id');
    if (inpEdit) inpEdit.value = gid;

    // 데이터가 없는 경우 빈 데이터 구조라도 생성 (강제 렌더링을 위해)
    if (!STATE.groups[gid]) {
        STATE.groups[gid] = {
            name: `그룹 ${gid}`,
            schedules: Array.from({ length: 10 }, () => 
                Array.from({ length: 16 }, () => ({ h: -1, m: 0, cycle: 100 }))
            ),
            planAliases: ["평일", "토요일", "일요일", "특수일", "", "", "", "", "", ""] // [New] 일계획별 별칭 기본값 설정
        };
    }

    const group = STATE.groups[gid];

    // [사용자 요청] 일계획 별칭 UI 동기화
    if (!group.planAliases) group.planAliases = Array(10).fill("");
    document.querySelectorAll('.inp-plan-alias').forEach(inp => {
        const d = parseInt(inp.getAttribute('data-day'));
        inp.value = group.planAliases[d] || "";
    });
    
    // [사용자 규칙] db_groups.csv는 별도 관리되므로 교차로 정보를 통해 그룹 스케줄을 자동으로 채우지 않음
    if (!group.schedules) {
        group.schedules = Array.from({ length: 10 }, () => 
            Array.from({ length: 16 }, () => ({ h: -1, m: 0, cycle: 100 }))
        );
    }

    const nameInp = document.getElementById('inp-group-name');
    if (nameInp) nameInp.value = (group.name || `그룹 ${gid}`).trim();

    // 1. 테이블 즉시 렌더링 (지연 시간 없이)
    renderGroupTODTable();

    // 2. 소속 교차로 목록 갱신
    // [사용자 요청] 교차로 목록 및 순서/거리 자동 계산
    let members = Object.values(STATE.junctions).filter(j => String(j.group) === String(gid));
    
    // [사용자 규칙] 순서가 지정되지 않은 항목(-1)들에 대해 위도(Lat)가 낮은 순으로 자동 순서 부여
    let maxOrder = 0;
    const unorderedMembers = [];
    
    members.forEach(m => {
        let ord = (m.extra && m.extra.diagramOrder !== undefined) ? parseInt(m.extra.diagramOrder) : -1;
        if (ord > 0) {
            if (ord > maxOrder) maxOrder = ord;
        } else {
            unorderedMembers.push(m);
        }
    });

    // 위도(Lat) 오름차순 정렬 (남쪽 -> 북쪽)
    unorderedMembers.sort((a, b) => (a.lat || 0) - (b.lat || 0));

    unorderedMembers.forEach(m => {
        if (!m.extra) m.extra = {};
        maxOrder++;
        m.extra.diagramOrder = maxOrder;
    });

    // 순서대로 정렬 (체크 해제된 항목은 하단으로, 나머지는 지정된 순서대로)
    members.sort((a, b) => {
        const aExcluded = a.extra && a.extra.excludeFromTsd === true;
        const bExcluded = b.extra && b.extra.excludeFromTsd === true;
        if (aExcluded !== bExcluded) return aExcluded ? 1 : -1;
        return (a.extra.diagramOrder || 0) - (b.extra.diagramOrder || 0);
    });

    // 거리(m) 계산
    members.forEach((m, idx) => {
        if (idx === 0) {
            m.extra.diagramDistDisp = 0;
        } else {
            const prev = members[idx - 1];
            let autoDist = getHaversineDistance(prev.lat, prev.lng, m.lat, m.lng);
            if (isNaN(autoDist)) autoDist = 0;
            
            // 수동 입력값(diagramDist)이 유효한 숫자인지 확인
            const manualDist = parseInt(m.extra.diagramDist);
            if (!isNaN(manualDist) && m.extra.diagramDist !== undefined && m.extra.diagramDist !== null) {
                m.extra.diagramDistDisp = manualDist;
            } else {
                m.extra.diagramDistDisp = autoDist;
            }
        }
    });

    document.getElementById('group-member-count').innerText = members.length;

    // [검증] 소속 교차로들의 일계획(TOD) 데이터가 동일한지 확인
    const statusEl = document.getElementById('group-validation-status');
    if (statusEl) {
        if (members.length > 1) {
            statusEl.style.display = 'block';
            const baseSched = JSON.stringify(members[0].schedules);
            let mismatchCount = 0;
            members.forEach((m, idx) => {
                const mSched = JSON.stringify(m.schedules);
                if (mSched !== baseSched) {
                    mismatchCount++;
                    m._todMismatch = true; // 플래그 설정
                } else {
                    m._todMismatch = false;
                }
            });

            if (mismatchCount === 0) {
                statusEl.innerHTML = '✅ 모든 교차로 일계획 일치';
                statusEl.style.background = 'rgba(46, 204, 113, 0.1)';
                statusEl.style.color = '#2ecc71';
                statusEl.style.borderColor = 'rgba(46, 204, 113, 0.3)';
            } else {
                statusEl.innerHTML = `⚠️ 일계획 불일치: ${mismatchCount}개소`;
                statusEl.style.background = 'rgba(230, 126, 34, 0.1)';
                statusEl.style.color = '#e67e22';
                statusEl.style.borderColor = 'rgba(230, 126, 34, 0.3)';
            }
        } else {
            statusEl.style.display = 'none';
        }
    }

    highlightGroupMembers(members);

    const listContainer = document.getElementById('group-member-list');
    if (members.length === 0) {
        listContainer.innerHTML = `<div style="font-size: 10px; color: #555; text-align: center; padding: 10px;">소속 교차로 없음</div>`;
    } else {
        listContainer.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; padding:0 2px;">
                <span style="font-size:11px; color:#aaa; font-weight:bold;">📍 소속 교차로 (시공도 설정)</span>
                <div style="display:flex; gap:4px;">
                    <button class="sigma-btn-secondary" style="padding:2px 5px; font-size:9px;" onclick="sortGroupMembers('SN')">S-N 정렬</button>
                    <button class="sigma-btn-secondary" style="padding:2px 5px; font-size:9px;" onclick="sortGroupMembers('EW')">E-W 정렬</button>
                </div>
            </div>
            <div style="display:flex; gap:6px; font-size:9px; color:#666; margin-bottom:4px; padding:0 8px;">
                <span style="width:15px; text-align:center;">✓</span>
                <span style="width:35px; text-align:left;">ID</span>
                <span style="flex:1;">교차로명</span>
                <span style="width:32px; text-align:center;">순번</span>
                <span style="width:42px; text-align:center;">거리(m)</span>
            </div>
            ${members.map((j, idx) => {
            const diagOrder = j.extra.diagramOrder;
            const diagDist = j.extra.diagramDistDisp;
            const mismatchIcon = j._todMismatch ? `<span style="color:#e67e22; font-size:10px; margin-right:4px;" title="그룹 기준 일계획과 불일치">⚠️</span>` : '';
            const isExcluded = j.extra.excludeFromTsd === true;
            
            return `
                <div class="group-member-item" draggable="true"
                     ondragstart="handleJunctionDragStart(event, '${j.id}')"
                     ondragover="handleJunctionDragOver(event)"
                     ondrop="handleJunctionDrop(event, '${j.id}')"
                     style="font-size:11.5px; padding:4px 8px; border-radius:4px; margin-bottom:3px; background:rgba(255,255,255,0.03); border:1px solid ${j._todMismatch ? 'rgba(230, 126, 34, 0.4)' : 'rgba(255,255,255,0.05)'}; cursor:grab; display:flex; justify-content:space-between; align-items:center; transition: all 0.2s; opacity: ${isExcluded ? 0.4 : 1};">
                    
                    <div style="display:flex; align-items:center; gap:6px; flex:1; overflow:hidden;">
                        <input type="checkbox" ${isExcluded ? '' : 'checked'} 
                               onchange="toggleJunctionTsdInclusion('${j.id}', this.checked)"
                               style="cursor:pointer; width:13px; height:13px; accent-color:var(--accent); flex-shrink:0;"
                               title="시공도 포함 여부">
                        <span style="color:rgba(255,255,255,0.4); font-size:9.5px; font-family:monospace; min-width:35px; text-align:left;">#${j.id}</span>
                        <span onclick="viewJunctionTODInGroup('${j.id}')" 
                              style="color:#eee; cursor:pointer; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; padding: 2px 0;">
                            ${mismatchIcon}${j.name || j.id}
                        </span>
                    </div>

                    <div style="display:flex; align-items:center; gap:4px;">
                        <input type="number" value="${diagOrder}" 
                               onchange="updateJunctionDiagramOrder('${j.id}', this.value)"
                               style="width:32px; height:18px; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.1); color:var(--accent); text-align:center; font-size:10px; border-radius:2px; outline:none;"
                               title="순서">
                        <input type="number" value="${diagDist}" 
                               onchange="updateJunctionDiagramDist('${j.id}', this.value)"
                               style="width:42px; height:18px; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.1); color:#fff; text-align:center; font-size:10px; border-radius:2px; outline:none;"
                               title="앞 교차로와의 거리 (자동계산됨, 수동수정 가능)">
                    </div>
                </div>`;
        }).join('')}
        `;
    }

    renderGroupList();
    
    // [신규] TSD 설정 세트 UI 렌더링
    renderGroupTsdSets(gid);

    // [추가] 시공도(Time-Space Diagram) 자동 렌더링
    if (typeof renderTimeSpaceDiagram === 'function') {
        renderTimeSpaceDiagram();
    }

    setTimeout(() => {
        const listDiv = document.getElementById('group-list-container');
        const targetRow = listDiv.querySelector(`tr[data-gid="${gid}"]`);
        if (targetRow) targetRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);

    if (refreshChart) {
        renderGroupCycleChart();
    }
}

/** 
 * [사용자 요청] 특정 교차로의 TOD 데이터를 그룹 편집기(테이블/차트)에 로드 
 */
function viewJunctionTODInGroup(jid) {
    const j = STATE.junctions[jid];
    if (!j || !j.schedules) return;
    
    // 1. 해당 교차로가 속한 그룹 ID 가져오기
    const gid = String(j.group);
    if (gid === "0" || !STATE.groups[gid]) {
        console.warn(`Junction ${jid} has no valid group assigned.`);
        return;
    }
    
    // 2. 현재 편집 그룹 컨텍스트 업데이트
    currentEditingGroup = gid;
    
    // 3. 그룹 버퍼 스케줄을 선택한 교차로의 스케줄로 교체 (일괄 적용 시 이 데이터를 사용하게 됨)
    STATE.groups[gid].schedules = JSON.parse(JSON.stringify(j.schedules));
    
    // 4. UI 컨트롤 요소 동기화
    const inpEdit = document.getElementById('inp-edit-group-id');
    if (inpEdit) inpEdit.value = gid;
    
    const nameInp = document.getElementById('inp-group-name');
    if (nameInp) nameInp.value = (STATE.groups[gid].name || `그룹 ${gid}`).trim();
    
    // 5. 테이블 및 차트 즉시 갱신
    renderGroupTODTable();
    renderGroupCycleChart();
    
    // 6. 교차로 선택 처리 (맵 이동/줌 생략하여 그룹 화면 유지)
    if (typeof selectJunction === 'function') {
        selectJunction(jid);
    }
    
    // 7. 목록 내 선택 항목 하이라이트 처리
    document.querySelectorAll('.group-member-item').forEach(el => {
        el.style.borderColor = 'rgba(255,255,255,0.05)';
        el.style.background = 'rgba(255,255,255,0.03)';
    });
    const items = document.querySelectorAll('.group-member-item');
    for (let item of items) {
        if (item.innerText.includes(`#${jid}`)) {
            item.style.borderColor = 'var(--accent)';
            item.style.background = 'rgba(241, 196, 15, 0.1)';
            break;
        }
    }
    console.log(`[GroupView] Editor switched to Junction ${jid}'s TOD plan. Ready for batch apply.`);
}



/* ══════════════════════════════════════════
 *  그룹 요일 선택 UI
 * ══════════════════════════════════════════ */
function updateGroupDayUI() {
    const editContainer = document.getElementById('group-day-selector');
    const chartContainer = document.getElementById('group-chart-day-selector');
    if (!editContainer || !chartContainer) return;

    // 1. Edit Selector (Radio)
    const renderBtn = (lab, i) => {
        const isActive = (STATE.currentGroupDayTypeIdx === i);
        const group = STATE.groups[currentEditingGroup];
        const alias = (group && group.planAliases && group.planAliases[i]) ? group.planAliases[i] : "";
        const displayLabel = alias ? `${alias}` : lab;

        return `
            <label style="display:flex; align-items:center; gap:5px; font-size:11px; cursor:pointer; 
                          padding:3px 8px; border-radius:5px; border:1px solid ${isActive ? 'var(--accent)' : 'rgba(255,255,255,0.1)'};
                          background: ${isActive ? 'rgba(241,196,15,0.15)' : 'rgba(255,255,255,0.03)'};
                          color: ${isActive ? 'white' : '#888'}; transition: all 0.2s; flex:1; justify-content:center;"
                          title="${lab}${alias ? ': ' + alias : ''}">
                <input type="radio" name="edit-group-day" style="width:13px; height:13px; margin:0;" 
                       ${isActive ? 'checked' : ''} onchange="setEditGroupDay(${i})">
                <span style="${isActive ? 'font-weight:bold; color:var(--accent);' : 'color:#ccc; font-size:10px;'}">${displayLabel}</span>
            </label>
        `;
    };

    let editHtml = '<div style="display:flex; flex-direction:column; gap:6px; width:100%;">';
    
    // 1행: 일반
    editHtml += '<div style="display:flex; align-items:center; gap:8px;">';
    editHtml += '<span style="font-size:10px; color:#aaa; min-width:35px; font-weight:bold;">[일반]</span>';
    
    // [추가] 테이블 헤더 하이라이트 동기화
    for (let d = 0; d < 10; d++) {
        const head = document.getElementById(`day-header-${d}`);
        if (head) {
            if (STATE.currentGroupDayTypeIdx === d) head.classList.add('gtod-th-active');
            else head.classList.remove('gtod-th-active');
        }
    }
    editHtml += '<div style="display:flex; gap:4px; flex:1;">';
    for (let i = 0; i < 5; i++) editHtml += renderBtn(DAY_LABELS[i], i);
    editHtml += '</div></div>';

    // 2행: 시차
    editHtml += '<div style="display:flex; align-items:center; gap:8px;">';
    editHtml += '<span style="font-size:10px; color:var(--accent); min-width:35px; font-weight:bold;">[시차]</span>';
    editHtml += '<div style="display:flex; gap:4px; flex:1;">';
    for (let i = 5; i < 10; i++) editHtml += renderBtn(DAY_LABELS[i], i);
    editHtml += '</div></div>';


    editHtml += '</div>';
    editContainer.innerHTML = editHtml;

    // 2. Chart Comparison Selector (Checkbox)
    // 2. Chart Comparison Selector (Checkbox)
    let chartHtml = '<span style="color:#aaa; font-weight:bold; margin-right:4px;">일계획:</span>'; 

    DAY_LABELS.forEach((lab, i) => {
        const isSelected = selectedGroupDays.includes(i);
        chartHtml += `
            <label style="display:flex; align-items:center; gap:2px; font-size:11px; cursor:pointer; color: ${isSelected ? 'white' : '#666'};">
                <input type="checkbox" style="width:12px; height:12px; margin:0;" 
                       ${isSelected ? 'checked' : ''} onchange="toggleChartGroupDay(${i})">
                <span style="border-bottom: 2px solid ${isSelected ? DAY_COLORS[i] : 'transparent'}; padding-bottom:1px; min-width:14px; text-align:center;">${i + 1}</span>
            </label>
        `;
    });
    chartContainer.innerHTML = `<div style="display:flex; align-items:center; gap:6px;">${chartHtml}</div>`;
}

function toggleChartGroupDay(idx) {
    if (selectedGroupDays.includes(idx)) {
        if (selectedGroupDays.length > 1) selectedGroupDays = selectedGroupDays.filter(d => d !== idx);
    } else {
        selectedGroupDays.push(idx);
    }
    updateGroupDayUI();
    renderGroupCycleChart();
}

/** 편집 요일 선택 (라디오) */
function setEditGroupDay(idx) {
    STATE.currentGroupDayTypeIdx = idx;
    // 이제 체크박스(그래프 비교)와 연동하지 않음
    updateGroupDayUI();
    renderGroupTODTable();
    renderGroupCycleChart();

    // 선택한 요일 컬럼으로 자동 스크롤
    setTimeout(() => {
        const header = document.getElementById(`day-header-${idx}`);
        const container = document.getElementById('group-tod-table-container');
        if (header && container) {
            const headerLeft = header.offsetLeft;
            // 앞의 '#' 컬럼 width가 대략 30px이므로 조금 여유를 두고 스크롤
            container.scrollTo({ left: headerLeft - 40, behavior: 'smooth' });
        }
    }, 50);
}

function changeGroupDayType(idx) { setEditGroupDay(idx); }

/* ══════════════════════════════════════════
 *  그룹 TOD 복사
 * ══════════════════════════════════════════ */
function copyGroupTODDay() {
    if (!currentEditingGroup || !STATE.groups[currentEditingGroup]) return;
    const fromIdx = parseInt(document.getElementById('copy-from-day').value);
    const toIdx = STATE.currentGroupDayTypeIdx;

    if (fromIdx === toIdx) { alert("출발지와 목적지가 같습니다."); return; }
    if (!confirm(`${DAY_LABELS[fromIdx]} TOD 데이터를 ${DAY_LABELS[toIdx]}로 복사하시겠습니까?`)) return;

    const fromData = STATE.groups[currentEditingGroup].schedules[fromIdx];
    STATE.groups[currentEditingGroup].schedules[toIdx] = JSON.parse(JSON.stringify(fromData));

    renderGroupTODTable();
    renderGroupCycleChart();
    alert("복사 완료되었습니다.");
}

/* ══════════════════════════════════════════
 *  그룹 TOD 테이블 렌더링
 * ══════════════════════════════════════════ */
function renderGroupTODTable() {
    const gid = currentEditingGroup;
    if (!gid || !STATE.groups[gid]) return;

    const group = STATE.groups[gid];

    let html = '';
    // 주기를 한 번에 보기 위해 16줄 모두 출력 (좌우 2단 대신 1단으로 하고 요일 5개를 가로로 배치하도록 변경 가능하지만, 
    // 사용자가 '한 번에 보게' 해달라고 했으므로 16줄 전체를 요일별 컬럼으로 구성)
    for (let i = 0; i < 16; i++) {
        const isSelected = (STATE.selectedTodPlanIdx === i);
        const rowBg = isSelected ? 'background:rgba(0,100,220,0.15);' : '';
        html += `<tr style="border-bottom: 1px solid #222; height: 18px; cursor:pointer; ${rowBg}" 
                     class="tod-row" data-plan-idx="${i}" 
                     onclick="selectTodPlan(${i})" 
                     title="클릭: ${i+1}번 시간계획으로 시공도 분석">`;
        html += `<td style="text-align:center; color:${isSelected ? '#33aaff' : '#555'}; border-right:1px solid #333; padding:0; font-size:10px; font-weight:${isSelected ? '800' : 'normal'};">${i + 1}</td>`;

        for (let d = 0; d < 10; d++) {
            const sched = (group.schedules && group.schedules[d]) ? group.schedules[d] : [];
            const s = (sched && sched[i]) ? sched[i] : { h: -1, m: 0, cycle: 100 };
            if (s.cycle === undefined) s.cycle = 100;

            const isCurrentDay = (STATE.currentGroupDayTypeIdx === d);
            const activeClass = isCurrentDay ? 'gtod-td-active' : '';
            
            // 시간이 -1인 경우(미사용) 톤다운 효과 적용
            const isUnused = (s.h === -1);
            const unusedStyle = isUnused ? 'opacity: 0.35; filter: grayscale(1);' : '';

            html += `<td style="text-align:center; border-right:1px solid #333; padding:0; ${unusedStyle}" class="${activeClass}">
                <div style="display:flex; justify-content:center; align-items:center; height: 100%;">
                    <input type="number" class="sigma-input input-mini" value="${s.h}" min="-1" max="23" 
                           style="width:24px; height:16px; line-height:1; padding:0; text-align:center; font-size:9.5px; background:transparent; border:none;" 
                           data-type="group-sched" data-field="h" data-idx="${i}" data-day="${d}">
                    <span style="color:#444; margin:0; scale: 0.8; height:16px; line-height:16px;">:</span>
                    <input type="number" class="sigma-input input-mini" value="${s.m}" min="0" max="59" 
                           style="width:24px; height:16px; line-height:1; padding:0; text-align:center; font-size:9.5px; background:transparent; border:none;" 
                           data-type="group-sched" data-field="m" data-idx="${i}" data-day="${d}">
                </div>
            </td>`;
            html += `<td style="text-align:center; border-right:1px solid #333; padding:0; ${unusedStyle}" class="${activeClass}">
                <input type="number" class="sigma-input input-mini" value="${s.cycle}" min="0" max="999" 
                       style="width:34px; height:16px; line-height:1; padding:0; text-align:center; color:var(--accent); font-size:10px; background:transparent; border-color:transparent;" 
                       data-type="group-sched" data-field="cycle" data-idx="${i}" data-day="${d}">
            </td>`;
            html += `<td style="text-align:center; border-right:${d === 9 ? 'none' : '1px solid #555'}; padding:0; ${unusedStyle}" class="${activeClass}">
                <input type="number" class="sigma-input input-mini" value="${s.idx || 1}" min="1" max="16" 
                       style="width:26px; height:16px; line-height:1; padding:0; text-align:center; color:#888; font-size:10px; background:transparent; border-color:transparent;" 
                       data-type="group-sched" data-field="idx" data-idx="${i}" data-day="${d}">
            </td>`;
        }
        html += `</tr>`;
    }
    document.getElementById('group-tod-body').innerHTML = html;
    updateGroupDayUI();
}

/**
 * TOD 행 선택 → 시공도 연동
 */
function selectTodPlan(idx) {
    STATE.selectedTodPlanIdx = idx;
    renderGroupTODTable();  // 하이라이트 갱신
    if (typeof renderTimeSpaceDiagram === 'function') renderTimeSpaceDiagram();
}

/* ══════════════════════════════════════════
 *  그룹 주기 차트
 * ══════════════════════════════════════════ */
function renderGroupCycleChart() {
    const gid = currentEditingGroup;
    if (!gid || !STATE.groups[gid]) return;
    const group = STATE.groups[gid];

    const labels = [];
    for (let i = 0; i < 144; i++) {
        const totalMinutes = i * 10;
        const hh = Math.floor(totalMinutes / 60);
        const mm = totalMinutes % 60;
        labels.push(mm === 0 ? `${hh}h` : "");
    }

    const datasets = selectedGroupDays.map(dIdx => {
        const sched = group.schedules[dIdx];
        const chartData = [];
        for (let i = 0; i < 144; i++) {
            const totalMinutes = i * 10;
            let activeCycle = 100, maxTotal = -1;
            sched.forEach(s => {
                if (s.h !== -1) {
                    const sTotal = s.h * 60 + s.m;
                    if (totalMinutes >= sTotal && sTotal > maxTotal) { maxTotal = sTotal; activeCycle = s.cycle || 0; }
                }
            });
            chartData.push(activeCycle);
        }
        const isActive = (STATE.currentGroupDayTypeIdx === dIdx);
        return {
            label: DAY_LABELS[dIdx], data: chartData, borderColor: DAY_COLORS[dIdx],
            backgroundColor: isActive ? 'rgba(241,196,15,0.05)' : 'transparent',
            borderWidth: isActive ? 3 : 1.5, stepped: true, fill: isActive,
            pointRadius: 0, pointHitRadius: 10, tension: 0
        };
    });

    const ctx = document.getElementById('group-cycle-chart').getContext('2d');
    if (groupCycleChart) groupCycleChart.destroy();

    groupCycleChart = new Chart(ctx, {
        type: 'line',
        data: { labels: labels, datasets: datasets },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: {
                y: { min: 0, grid: { color: '#222' }, ticks: { color: '#666', font: { size: 10 }, stepSize: 50 } },
                x: {
                    grid: { color: (ctx) => (ctx.index % 6 === 0 ? '#333' : '#111'), lineWidth: (ctx) => (ctx.index % 6 === 0 ? 1 : 0) },
                    ticks: { color: '#666', font: { size: 10 }, autoSkip: false, maxRotation: 0 }
                }
            },
            plugins: {
                legend: { display: selectedGroupDays.length > 1, labels: { color: '#ccc', font: { size: 10 }, boxWidth: 12 } },
                tooltip: {
                    callbacks: {
                        title: (items) => {
                            const idx = items[0].dataIndex;
                            const h = Math.floor((idx * 10) / 60), m = (idx * 10) % 60;
                            return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                        }
                    }
                }
            }
        }
    });
}

/* ══════════════════════════════════════════
 *  그룹 목록 렌더링
 * ══════════════════════════════════════════ */
function renderGroupList() {
    const listDiv = document.getElementById('group-list-container');
    if (!listDiv) return;

    // [Fix] junctions 데이터에서 그룹 ID를 추출하여 STATE.groups에 동기화 (CSV 미로드 시에도 표시 보장)
    Object.values(STATE.junctions).forEach(j => {
        if (j.group && j.group !== "0" && j.group !== 0) {
            const gid = String(j.group);
            if (!STATE.groups[gid]) {
                const emptyScheds = Array.from({ length: 10 }, () => 
                    Array.from({ length: 16 }, () => ({ h: -1, m: 0, cycle: 100 }))
                );
                STATE.groups[gid] = { id: gid, name: `그룹 ${gid}`, schedules: emptyScheds };
            }
        }
    });

    const gids = Object.keys(STATE.groups).sort((a, b) => Number(a) - Number(b));
    if (gids.length === 0) {
        listDiv.innerHTML = '<div style="color:#666; font-size:13px; padding:30px; text-align:center;">저장된 그룹 데이터가 없습니다.</div>';
        return;
    }

    // 최적화: 모든 교차로를 순회하여 그룹별 소속 정보 및 일계획 일치성 파악
    const groupMeta = {};
    Object.values(STATE.junctions).forEach(j => {
        const g = String(j.group);
        if (!groupMeta[g]) groupMeta[g] = { count: 0, firstSched: null, hasMismatch: false };
        
        groupMeta[g].count++;
        const currentSched = JSON.stringify(j.schedules);
        
        if (groupMeta[g].firstSched === null) {
            groupMeta[g].firstSched = currentSched;
        } else if (!groupMeta[g].hasMismatch && groupMeta[g].firstSched !== currentSched) {
            groupMeta[g].hasMismatch = true;
        }
    });

    let html = `
    <table class="group-list-table" style="width:100%; border-collapse:collapse; font-size:11.5px; table-layout: fixed;">
        <thead style="position: sticky; top: 0; background: #1a1a1a; z-index: 5;">
            <tr style="background:#2a2a2a; border-bottom:1px solid #444;">
                <th style="padding:6px 10px; text-align:center; width:45px; color:#aaa; font-size:11px;">ID</th>
                <th style="padding:6px 10px; text-align:left; color:#aaa; font-size:11px;">그룹명 (Description)</th>
                <th style="padding:6px 10px; text-align:center; width:65px; color:#aaa; font-size:11px;">교차로</th>
            </tr>
        </thead>
        <tbody>
    `;

    gids.forEach(gid => {
        const group = STATE.groups[gid];
        const meta = groupMeta[String(gid)] || { count: 0, hasMismatch: false };
        const isEditing = (gid === currentEditingGroup);
        const bg = isEditing ? 'rgba(0, 212, 255, 0.15)' : 'transparent';
        const color = isEditing ? 'var(--accent)' : '#eee';
        const weight = isEditing ? '700' : '400';
        const gName = (group.name || `그룹 ${gid}`).trim();
        
        // 일계획 불일치 아이콘 설정
        const mismatchIcon = meta.hasMismatch ? `<span style="color:#e67e22; margin-left:5px; font-size:10px;" title="교차로 간 일계획 데이터 불일치">⚠️</span>` : '';

        html += `
            <tr data-gid="${gid}" onclick="setEditingGroup(${gid})"
                style="cursor:pointer; background:${bg}; color:${color}; font-weight:${weight}; border-bottom:1px solid #2a2a2a; border-left: 3px solid ${meta.hasMismatch ? '#e67e22' : 'transparent'}; transition: all 0.2s;">
                <td style="padding:5px 10px; text-align:center; color:var(--accent);">${gid}</td>
                <td style="padding:5px 10px; text-align:left; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${gName}${mismatchIcon}</td>
                <td style="padding:5px 10px; text-align:center; opacity:0.8;">${meta.count}</td>
            </tr>
            `;
    });

    html += `</tbody></table>`;
    listDiv.innerHTML = html;
}

function setEditingGroup(gid) {
    document.getElementById('inp-edit-group-id').value = gid;
    loadGroupInfo();
}

/* ══════════════════════════════════════════
 *  그룹 스케줄/이름 업데이트
 * ══════════════════════════════════════════ */
function updateGroupSched(idx, f, v, dayIdx = null) {
    if (!currentEditingGroup || !STATE.groups[currentEditingGroup]) return;
    const targetDayIdx = (dayIdx !== null) ? dayIdx : STATE.currentGroupDayTypeIdx;
    STATE.groups[currentEditingGroup].schedules[targetDayIdx][idx][f] = parseInt(v) || 0;

    // 차트 업데이트 (이전 최적화 유지 - TOD 데이터 변경 시에만 redraw)
    renderGroupCycleChart();
    if (document.getElementById('tab-stats').classList.contains('active')) renderStats();
}

function updateGroupName(val) {
    if (!currentEditingGroup || !STATE.groups[currentEditingGroup]) return;
    STATE.groups[currentEditingGroup].name = val;
    renderGroupList();
    updateGroupDayUI();
}

function applyGroupToMembers() {
    try {
        if (!currentEditingGroup || !STATE.groups[currentEditingGroup]) {
            alert("편집할 그룹이 선택되지 않았습니다.");
            return;
        }
        if (!confirm(`그룹 ${currentEditingGroup}의 모든 10일 설정을 소속된 모든 교차로에 일괄 적용하시겠습니까?`)) return;

        const groupSchedules = STATE.groups[currentEditingGroup].schedules;
        let count = 0;
        Object.values(STATE.junctions).forEach(j => {
            if (String(j.group) === String(currentEditingGroup)) {
                j.schedules = JSON.parse(JSON.stringify(groupSchedules));
                count++;
            }
        });
        
        loadGroupInfo(true);
        if (STATE.activeJid && String(STATE.junctions[STATE.activeJid].group) === String(currentEditingGroup)) {
            renderRingTables();
        }
        alert(`${count}개 교차로에 그룹 TOD 설정 적용 완료되었습니다.`);
    } catch (e) {
        console.error("Apply Error:", e);
        alert("적용 중 오류가 발생했습니다: " + e.message);
    }
}

/* ══════════════════════════════════════════
 *  그룹 CSV 저장/불러오기
 * ══════════════════════════════════════════ */
/* ══════════════════════════════════════════
 *  그룹 CSV 저장/불러오기 (통합 핸들러)
 * ══════════════════════════════════════════ */
function generateGroupCSV() {
    if (Object.keys(STATE.groups).length === 0) return "";

    let csv = "GroupID,Region,GroupName,Weekday,Friday,Saturday,Sunday,Special,Flextime1,Flextime2,Flextime3,Flextime4,Flextime5,TSD_SET1,TSD_SET2,TSD_SET3,PlanAliases\n";

    Object.keys(STATE.groups).forEach(gid => {
        const group = STATE.groups[gid];
        const gName = (group.name || `그룹 ${gid}`).replace(/,/g, ' ');
        
        let region = group.region;
        if (!region) {
            const member = Object.values(STATE.junctions).find(j => String(j.group) === String(gid));
            region = member ? (member.region || (member.id.startsWith("L02-") ? "L02" : "L01")) : "L01";
        }

        const schedStrs = Array.from({ length: 10 }, (_, d) => {
            const sched = (group.schedules && group.schedules[d]) ? group.schedules[d] : [];
            return sched.map(s => {
                const timePart = s.h === -1 ? "-1" : `${String(s.h).padStart(2, '0')}:${String(s.m).padStart(2, '0')}`;
                return `${timePart}|${s.cycle || 100}|${s.idx || 1}`;
            }).join(';');
        });

        // [신규] TSD 설정 세트 직렬화 (3개)
        const tsdSets = Array.from({ length: 3 }, (_, i) => {
            const config = (group.tsdConfigs && group.tsdConfigs[i]) ? group.tsdConfigs[i] : { enabled: 0, order: [], distances: [] };
            return `${config.enabled}|${(config.order || []).join(';')}|${(config.distances || []).join(';')}`;
        });

        const aliases = (group.planAliases || Array(10).fill("")).join(';');

        csv += `${gid},${region},${gName},${schedStrs.join(',')},${tsdSets.join(',')},${aliases}\n`;
    });
    return csv;
}



/** 그룹 TOD CSV 데이터 처리 핵심 로직 (db_tod_plans.csv 규격 호환 추가) */
function processGroupCSV(csvString, isAutoLoad = false) {
    showLoading("그룹 데이터 분석 중...");
    setTimeout(() => {
        const lines = csvString.trim().split(/\r?\n/);
        if (lines.length < 2) { 
            alert("불러오기 실패: 파일이 비어있습니다."); 
            hideLoading(); 
            return; 
        }

        const header = lines[0].toLowerCase();
        const isTodPlansFile = header.includes('day_plan') && header.includes('time_plan1');

        if (isTodPlansFile) {
            // [A] 새 규격: db_tod_plans.csv (교차로당 10행)
            handleTodPlansAsGroup(csvString);
        } else {
            // [B] 기존 규격: sigma_group.csv (그룹당 1행)
            handleLegacyGroupCSV(lines, isAutoLoad);
        }
        hideLoading();
    }, 10);
}

/** [신규] db_tod_plans.csv 파일을 읽어 현재 그룹의 스케줄로 매핑 */
function handleTodPlansAsGroup(csvString) {
    const gid = currentEditingGroup;
    if (!gid) {
        alert("먼저 편집할 그룹을 목록에서 선택하세요.");
        return;
    }

    const rows = parseCSV(csvString); // utils.js의 파서 사용
    const targetMembers = Object.values(STATE.junctions).filter(j => String(j.group) === String(gid));
    
    if (targetMembers.length === 0) {
        alert(`그룹 ${gid}에 속한 교차로가 없습니다. 교차로 정보에서 그룹 ID를 먼저 설정하세요.`);
        return;
    }

    // 그룹에 속한 첫 번째 교차로의 데이터를 기준(Template)으로 가져옴
    const refJid = targetMembers[0].id;
    const junctionRows = rows.filter(r => (r["ID"] || r["IntersectionID"]) === refJid);

    if (junctionRows.length === 0) {
        alert(`파일 내에 그룹 멤버인 교차로(${refJid})의 데이터가 없습니다.`);
        return;
    }

    // [개선] 그룹 템플릿만 업데이트하는 것이 아니라, 전체 교차로의 개별 데이터를 모두 업데이트합니다.
    if (typeof processTodPlanCSV === 'function') {
        processTodPlanCSV(csvString);
    }

    // 그룹 스케줄 초기화 및 데이터 주입 (그룹 기준 템플릿은 UI 렌더링용으로 유지)
    if (!STATE.groups[gid]) STATE.groups[gid] = { name: `그룹 ${gid}`, schedules: Array.from({length:10}, () => createEmptySched()) };
    const groupScheds = STATE.groups[gid].schedules;

    junctionRows.forEach(row => {
        const d_plan = parseInt(row["Day_plan"]);
        if (isNaN(d_plan) || d_plan < 1 || d_plan > 10) return;

        const dIdx = d_plan - 1;
        for (let sIdx = 0; sIdx < 16; sIdx++) {
            const slotData = row[`Time_plan${sIdx + 1}`];
            if (!slotData) continue;

            const p = slotData.split('|');
            if (p.length < 2) continue;

            // 시작시간 파싱
            const timeStr = p[0];
            if (timeStr === "-1") {
                groupScheds[dIdx][sIdx].h = -1;
            } else if (timeStr.includes(':')) {
                const [h, m] = timeStr.split(':').map(Number);
                groupScheds[dIdx][sIdx].h = h;
                groupScheds[dIdx][sIdx].m = m;
            }
            // 주기 파싱
            groupScheds[dIdx][sIdx].cycle = parseInt(p[1]) || 100;
        }
    });

    alert(`해당 파일의 교차로 개별 데이터가 모두 적용되었으며, 그룹 ${gid}의 기준 스케줄은 교차로(${refJid}) 데이터를 기반으로 업데이트되었습니다.`);
    loadGroupInfo();
}

/** 기존 레거시 그룹 CSV 처리 로직 분리 */
function handleLegacyGroupCSV(lines, isAutoLoad) {
    const newGroups = {};
    let count = 0;
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
        if (cols.length < 3) continue;
        const gid = parseInt(cols[0]);
        if (isNaN(gid)) continue;
        
        const region = cols[1];
        let gName = cols[2] || `그룹 ${gid}`;
        const schedules = Array.from({ length: 10 }, () => createEmptySched());

        const parseSched = (str, targetSched) => {
            const items = (str || "").split(';');
            items.forEach((item, idx) => {
                if (idx >= 16 || !item) return;
                const parts = item.split('|');
                if (parts[0].includes(':')) {
                    const bits = parts[0].split(':').map(Number);
                    targetSched[idx] = { h: bits[0], m: bits[1], cycle: parseInt(parts[1]) || 100, idx: parseInt(parts[2]) || 1 };
                } else if (parts[0] === "-1") {
                    targetSched[idx] = { h: -1, m: 0, cycle: parseInt(parts[1]) || 100, idx: parseInt(parts[2]) || 1 };
                }
            });
        };

        if (cols.length >= 8) { 
            const numDays = Math.min(cols.length - 3, 10);
            for (let d = 0; d < numDays; d++) parseSched(cols[d + 3], schedules[d]); 
        }
        else if (cols.length >= 4) parseSched(cols[3], schedules[0]);

        // [신규] TSD 설정 세트 파싱 (Index 13, 14, 15)
        const tsdConfigs = [];
        for (let i = 0; i < 3; i++) {
            const colIdx = 13 + i;
            if (cols[colIdx]) {
                const parts = cols[colIdx].split('|');
                tsdConfigs.push({
                    enabled: parseInt(parts[0]) || 0,
                    order: (parts[1] && parts[1] !== "") ? parts[1].split(';') : [],
                    distances: (parts[2] && parts[2] !== "") ? parts[2].split(';').map(val => parseFloat(val) || 0) : []
                });
            } else {
                tsdConfigs.push({ enabled: 0, order: [], distances: [] });
            }
        }

        const planAliases = (cols[16]) ? cols[16].split(';') : Array(10).fill("");
        newGroups[gid] = { id: gid, region: region, name: gName, schedules: schedules, tsdConfigs: tsdConfigs, planAliases: planAliases };
        count++;
    }

    if (isAutoLoad || confirm(`총 ${count}개의 그룹 정보를 불러왔습니다. 적용하시겠습니까?`)) {
        Object.assign(STATE.groups, newGroups);
        if (currentEditingGroup) loadGroupInfo();
        renderGroupList();
    }
}

function updateJunctionDiagramOrder(jid, val) {
    const j = STATE.junctions[jid];
    if (!j) return;
    if (!j.extra) j.extra = {};
    j.extra.diagramOrder = parseInt(val);
    loadGroupInfo(true, j.group); // UI 전체 갱신 (순서 변경에 따른 거리 재계산 필요)
}

function updateJunctionDiagramDist(jid, val) {
    const j = STATE.junctions[jid];
    if (!j) return;
    if (!j.extra) j.extra = {};
    const dist = parseInt(val);
    // 수동 입력값 저장
    j.extra.diagramDist = dist;
    loadGroupInfo(true, j.group);
}

// --- [신규] 교차로 순서 조정을 위한 드래그 앤 드롭 핸들러 ---
function handleJunctionDragStart(e, jid) {
    e.dataTransfer.setData('text/plain', jid);
    e.currentTarget.style.opacity = '0.4';
    e.currentTarget.style.border = '1px dashed var(--accent)';
}

function handleJunctionDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
}

function handleJunctionDrop(e, targetJid) {
    e.preventDefault();
    const draggedJid = e.dataTransfer.getData('text/plain');
    if (draggedJid === targetJid) {
        loadGroupInfo(true);
        return;
    }

    const draggedJ = STATE.junctions[draggedJid];
    const targetJ = STATE.junctions[targetJid];
    if (!draggedJ || !targetJ) return;

    const gid = String(draggedJ.group);
    let members = Object.values(STATE.junctions).filter(j => String(j.group) === gid);
    members.sort((a, b) => {
        const aExcluded = a.extra && a.extra.excludeFromTsd === true;
        const bExcluded = b.extra && b.extra.excludeFromTsd === true;
        if (aExcluded !== bExcluded) return aExcluded ? 1 : -1;
        return (a.extra.diagramOrder || 0) - (b.extra.diagramOrder || 0);
    });

    const draggedIdx = members.findIndex(m => m.id === draggedJid);
    const targetIdx = members.findIndex(m => m.id === targetJid);

    if (draggedIdx !== -1 && targetIdx !== -1) {
        // 배열에서 옮기기
        const [movedItem] = members.splice(draggedIdx, 1);
        members.splice(targetIdx, 0, movedItem);

        // 순서(diagramOrder) 순차적으로 재부여
        members.forEach((m, i) => {
            if (!m.extra) m.extra = {};
            m.extra.diagramOrder = i + 1;
        });

        loadGroupInfo(true, gid);
    }
}

/**
 * 그룹 목록 드래그 스크롤 초기화
 */
(function initGroupListDragScroll() {
    document.addEventListener('DOMContentLoaded', () => {
        const el = document.getElementById('group-list-container');
        if (!el) return;

        let isDragging = false, startY = 0, startScroll = 0;

        el.addEventListener('mousedown', (e) => {
            isDragging = true;
            startY = e.clientY;
            startScroll = el.scrollTop;
            el.style.cursor = 'grabbing';
            el.style.userSelect = 'none';
        });

        window.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const delta = e.clientY - startY;
            el.scrollTop = startScroll - delta;
        });

        window.addEventListener('mouseup', () => {
            if (!isDragging) return;
            isDragging = false;
            el.style.cursor = 'grab';
            el.style.userSelect = '';
        });

        el.style.cursor = 'grab';
    });
})();
/** [신규] 그룹별 TSD 설정 세트 UI 렌더링 */
function renderGroupTsdSets(gid) {
    const group = STATE.groups[gid];
    if (!group) return;

    for (let i = 0; i < 3; i++) {
        const config = (group.tsdConfigs && group.tsdConfigs[i]) ? group.tsdConfigs[i] : { enabled: 0, order: [], distances: [] };
        const checkEl = document.getElementById(`tsd-set-enable-${i}`);
        const infoEl = document.getElementById(`tsd-set-info-${i}`);
        
        if (checkEl) checkEl.checked = (config.enabled === 1);
        if (infoEl) {
            if (config.order && config.order.length > 0) {
                const totalDist = config.distances.reduce((a, b) => a + b, 0);
                infoEl.innerHTML = `
                    <div style="color:var(--neon-cyan);">교차로: ${config.order.length}개</div>
                    <div style="color:#aaa;">총 거리: ${Math.round(totalDist).toLocaleString()}m</div>
                `;
            } else {
                infoEl.innerHTML = '<span style="color:#444;">데이터 없음</span>';
            }
        }
    }
}

/** [신규] 현재 구성을 특정 TSD 세트에 캡처하여 저장 */
function captureCurrentTsdToSet(setIdx) {
    if (!currentEditingGroup) { alert("그룹을 먼저 선택하세요."); return; }
    const gid = currentEditingGroup;
    const group = STATE.groups[gid];

    // 현재 화면(멤버 리스트)의 구성을 수집
    let members = Object.values(STATE.junctions).filter(j => String(j.group) === String(gid));
    const valid = members.filter(j => j.extra && !j.extra.excludeFromTsd);
    valid.sort((a, b) => (a.extra.diagramOrder || 0) - (b.extra.diagramOrder || 0));

    if (valid.length < 2) {
        alert("시공도에 포함된 교차로가 2개 이상이어야 저장할 수 있습니다.");
        return;
    }

    if (!group.tsdConfigs) group.tsdConfigs = Array.from({ length: 3 }, () => ({ enabled: 0, order: [], distances: [] }));

    const order = valid.map(m => m.id);
    const distances = [];
    for (let i = 1; i < valid.length; i++) {
        // diagramDistDisp: 수동 입력이 있으면 수동값, 없으면 자동계산값
        distances.push(valid[i].extra.diagramDistDisp || 0);
    }

    group.tsdConfigs[setIdx] = {
        enabled: 1, // 저장 시 자동 활성화
        order: order,
        distances: distances
    };

    renderGroupTsdSets(gid);
    alert(`현재 구성이 SET ${setIdx + 1}에 저장되었습니다.`);
}

/** [신규] TSD 설정 세트 활성화 여부 업데이트 */
function updateGroupTsdConfig(setIdx) {
    if (!currentEditingGroup) return;
    const gid = currentEditingGroup;
    const group = STATE.groups[gid];
    if (!group.tsdConfigs) return;

    const checkEl = document.getElementById(`tsd-set-enable-${setIdx}`);
    if (checkEl && group.tsdConfigs[setIdx]) {
        group.tsdConfigs[setIdx].enabled = checkEl.checked ? 1 : 0;
    }
}
