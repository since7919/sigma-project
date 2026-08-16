// overlay_ui.js
// 교차로 상세보기 창(Glassmorphism Overlay)의 순수 UI 조작(열기, 닫기, 탭 전환) 기능만 포함합니다.
// 실제 데이터 연동 로직은 기존 SIGMA_SIM의 연산 엔진과 별도로 연동하셔야 합니다.

let overlayMap = null;

function openDetailOverlay(jid) {
    if (!jid) {
        if (typeof STATE !== 'undefined' && STATE.activeJid) {
            jid = STATE.activeJid;
        } else {
            console.warn("열고자 하는 교차로 ID가 제공되지 않았습니다.");
            return;
        }
    }

    const modal = document.getElementById('detail-overlay-modal');
    const titleName = document.getElementById('overlay-title-name');
    const titleId = document.getElementById('overlay-title-id');
    
    // 교차로명 및 ID 세팅
    if (typeof STATE !== 'undefined' && STATE.junctions && STATE.junctions[jid]) {
        if(titleName) titleName.innerText = STATE.junctions[jid].name || '이름 없음';
        if(titleId) titleId.innerText = `ID: ${jid}`;
    } else {
        if(titleName) titleName.innerText = `교차로 상세`;
        if(titleId) titleId.innerText = `ID: ${jid}`;
    }

    // SIM 데이터 컨테이너를 모달 내부로 이동시켜 기존 렌더링 로직 유지 (Data Binding)
    const sigmapTab = document.getElementById('overlay-tab-sigmap');
    const sigmapContainer = document.getElementById('sigmap-table-container');

    if (sigmapContainer && !sigmapTab.contains(sigmapContainer)) {
        sigmapTab.appendChild(sigmapContainer);
    }

    modal.style.display = 'flex';
    
    // Google Satellite Map 초기화 및 이동
    if (!overlayMap) {
        overlayMap = L.map('overlay-leaflet-map', {
            zoomControl: false,
            attributionControl: false,
            dragging: false,
            touchZoom: false,
            doubleClickZoom: false,
            scrollWheelZoom: false,
            boxZoom: false,
            keyboard: false
        }).setView([STATE.junctions[jid].lat, STATE.junctions[jid].lng], 19);
        L.tileLayer('http://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
            maxZoom: 22
        }).addTo(overlayMap);
    } else {
        overlayMap.setView([STATE.junctions[jid].lat, STATE.junctions[jid].lng], 19);
    }
    setTimeout(() => {
        if (overlayMap) {
            overlayMap.invalidateSize();
            if (typeof createOverlayArrows === 'function') {
                createOverlayArrows(jid, overlayMap);
                if (typeof updateSim === 'function') updateSim();
            }
        }
    }, 100);

    // 신호계획정보 탭(API UI) 렌더링
    if (typeof renderOverlayPlanInfo === 'function') {
        renderOverlayPlanInfo(jid);
    }
    
    // 모달 열 때 기본 탭(신호계획정보) 활성화
    switchOverlayTab('phase');
}

function closeDetailOverlay() {
    document.getElementById('detail-overlay-modal').style.display = 'none';
}

function switchOverlayTab(tabName) {
    // 모든 탭 내용 숨기기
    document.querySelectorAll('.detail-tab-content').forEach(el => el.style.display = 'none');
    // 모든 탭 버튼 활성화 클래스 제거
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    
    // 선택된 탭 보이기 및 활성화
    const targetContent = document.getElementById(`overlay-tab-${tabName}`);
    if (targetContent) {
        if (tabName === 'phase') {
            targetContent.style.display = 'flex';
        } else {
            targetContent.style.display = 'block';
        }
    }
    
    const targetBtn = document.getElementById(`tab-btn-${tabName}`);
    if (targetBtn) targetBtn.classList.add('active');
}

// 나침반 신호등 UI 렌더링 예시 함수 (UI 테스트용)
// 사용법: setCompassSignal('N', 'green', true) -> 북쪽 차량 신호 초록색, 점멸 켬
function setCompassSignal(direction, color, isFlashing = false) {
    // 방향 예: 'N', 'E', 'S', 'W', 'NE', 'NW', 'SE', 'SW'
    const mount = document.getElementById(`compass-${direction}`);
    if(!mount) return;

    // 기존 클래스 초기화
    const lenses = mount.querySelectorAll('.lens');
    lenses.forEach(l => {
        l.classList.remove('on', 'flash');
    });

    if (!color || color === 'off') return;

    const targetLens = mount.querySelector(`.c-${color}`);
    if (targetLens) {
        targetLens.classList.add('on');
        if (isFlashing) targetLens.classList.add('flash');
    }
}

// 지도 팝업이나 패널에서 이 UI를 호출할 수 있도록 글로벌에 노출
window.openDetailOverlay = openDetailOverlay;
window.closeDetailOverlay = closeDetailOverlay;
window.switchOverlayTab = switchOverlayTab;
window.setCompassSignal = setCompassSignal;


function renderOverlayPlanInfo(jid) {
    const j = typeof STATE !== 'undefined' ? STATE.junctions[jid] : null;
    if (!j) return;
    
    const leftCol = document.getElementById('overlay-phase-left');
    const rightCol = document.getElementById('overlay-phase-right');
    if (!leftCol || !rightCol) return;

    const t = parseInt(typeof UI !== 'undefined' && UI.timeSlider ? UI.timeSlider.value : 25200);
    const context = (typeof getSimContext === 'function') ? getSimContext(j, t) : null;
    const weekPlanArr = j.weeklyPlan ? String(j.weeklyPlan).split(';') : [1, 1, 1, 1, 1, 2, 3];
    const pIdx = context ? context.pIdx : 0;
    const dayIdx = context ? context.dayIdx : (parseInt(weekPlanArr[0]) - 1 || 0);
    const plan = (j.dayPlans && j.dayPlans[dayIdx]) ? j.dayPlans[dayIdx][pIdx] : null;
    const sched = (j.schedules && j.schedules[dayIdx]) ? j.schedules[dayIdx][pIdx] : null;
    const dayOfWeek = (typeof STATE !== 'undefined' && STATE.simDayOfWeek !== undefined) ? STATE.simDayOfWeek : new Date().getDay();
    const jsToWeeklyMap = [6, 0, 1, 2, 3, 4, 5];
    const currentDayIndex = jsToWeeklyMap[dayOfWeek];
    
    let mainPhase = '2현시';
    if (j.signalMaps && j.signalMaps[0] && j.signalMaps[0].mainMovements && j.signalMaps[0].mainMovements.length > 0) {
        const pNum = String(j.signalMaps[0].mainMovements[0]).replace(/[^0-9]/g, '');
        mainPhase = pNum ? `${pNum}현시` : '2현시';
    }

    let leftHTML = `<h3 style="color: #38bdf8; font-weight: bold; font-size: 13px; margin: 0 0 8px 0;">신호계획정보</h3>`;
    
    leftHTML += `
        <div style="background: #0f172a; padding: 15px; border-radius: 8px; border: 1px solid #1e293b; margin-bottom: 15px;">
            <table class="detail-grid-table" style="width: 100%; text-align: center; font-size: 12px; border-collapse: collapse;">
                <thead>
                    <tr style="background: rgba(255,255,255,0.02); color: #94a3b8;">
                        <th style="padding: 6px 12px; border-bottom: 1px solid #1e293b; font-weight: 600;">방향정보</th>
                        <th style="padding: 6px 12px; border-bottom: 1px solid #1e293b; font-weight: 600;">출력형태</th>
                        <th style="padding: 6px 12px; border-bottom: 1px solid #1e293b; font-weight: 600;">현시</th>
                    </tr>
                </thead>
                <tbody>
    `;
    const dirs = ['북', '동', '남', '서'];
    dirs.forEach(dir => {
        leftHTML += `
            <tr>
                <td style="padding: 6px 12px; border-bottom: 1px solid rgba(255,255,255,0.02); font-weight: bold; color: #fff;">${dir}측</td>
                <td style="padding: 6px 12px; border-bottom: 1px solid rgba(255,255,255,0.02); color: #e2e8f0;">차량, 보행</td>
                <td style="padding: 6px 12px; border-bottom: 1px solid rgba(255,255,255,0.02); color: #10b981; font-family: monospace;">-</td>
            </tr>
        `;
    });
    leftHTML += `</tbody></table></div>`;

    leftHTML += `
        <div style="margin-top: 15px; padding-top: 10px;">
            <div style="color: #38bdf8; font-weight: bold; font-size: 13px; margin-bottom: 8px;">현시표 (Phase Diagram)</div>
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 5px;">
    `;
    
    for (let i = 1; i <= 8; i++) {
        const isRingA = (plan && plan.splitA && plan.splitA[i - 1] > 0);
        const isRingB = (plan && plan.splitB && plan.splitB[i - 1] > 0);
        const isActive = isRingA || isRingB;
        
        let splitTimeA = isRingA ? plan.splitA[i-1] : '-';
        let splitTimeB = isRingB ? plan.splitB[i-1] : '-';
        let timeStr = isActive ? (isRingA && isRingB ? `A:${splitTimeA}s B:${splitTimeB}s` : (isRingA ? `${splitTimeA}s` : `${splitTimeB}s`)) : '';

        leftHTML += `
            <div style="border: ${isActive ? '2px solid #10b981' : '1px solid #334155'}; border-radius: 4px; background: ${isActive ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255,255,255,0.02)'}; text-align: center;">
                <div style="background: ${isActive ? '#10b981' : '#1e293b'}; padding: 2px 3px; font-size: 11px; font-weight: bold; color: ${isActive ? '#0f172a' : '#cbd5e1'}; display: flex; justify-content: space-between;">
                    <span>${i}현시</span>
                    ${isActive ? `<span style="font-size: 10px; background: rgba(0,0,0,0.4); color: #fff; padding: 1px 4px; border-radius: 3px;">${timeStr}</span>` : ''}
                </div>
                <div style="padding: 6px 4px; display: flex; flex-direction: column; gap: 4px; font-size: 10px; font-weight: bold;">
                    <div style="display: flex; gap: 5px; align-items: center;"><span style="color: ${isRingA ? '#10b981' : '#64748b'}; width:10px;">A</span> <span style="color:#e2e8f0;">${isRingA ? splitTimeA+'s' : '-'}</span></div>
                    <div style="display: flex; gap: 5px; align-items: center;"><span style="color: ${isRingB ? '#3b82f6' : '#64748b'}; width:10px;">B</span> <span style="color:#e2e8f0;">${isRingB ? splitTimeB+'s' : '-'}</span></div>
                </div>
            </div>
        `;
    }
    leftHTML += `</div></div>`;
    leftCol.innerHTML = leftHTML;

    let rightHTML = `
            <div>
                <span style="color: #38bdf8; font-weight: bold; font-size: 13px; border-bottom: 2px solid #38bdf8; padding-bottom: 2px;">운영정보</span>
                <table style="width: 100%; margin-top: 10px; border-collapse: collapse; text-align: center; font-size: 12px;">
                    <thead>
                        <tr style="background: rgba(255,255,255,0.05); color: #94a3b8;">
                            <th style="padding: 3px; border: 1px solid #334155;">주기(Cycle)</th>
                            <th style="padding: 3px; border: 1px solid #334155;">주현시</th>
                            <th style="padding: 3px; border: 1px solid #334155;">연동값(Offset)</th>
                            <th style="padding: 3px; border: 1px solid #334155;">요일계획(Day plan)</th>
                            <th style="padding: 3px; border: 1px solid #334155;">시간계획(Time plan)</th>
                            <th style="padding: 3px; border: 1px solid #334155;">시간(Time)</th>
                            <th style="padding: 3px; border: 1px solid #334155;">시차계획(Plan)</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td style="padding: 3px; border: 1px solid #334155; color: #38bdf8; font-weight: bold;">${sched ? sched.cycle : '-'}초</td>
                            <td style="padding: 3px; border: 1px solid #334155; color: #fff;">${mainPhase}</td>
                            <td style="padding: 3px; border: 1px solid #334155; color: #fff; font-weight: bold;">${plan ? plan.offset : '-'}초</td>
                            <td style="padding: 3px; border: 1px solid #334155; color: #f472b6; font-weight: bold;">${dayIdx + 1}</td>
                            <td style="padding: 3px; border: 1px solid #334155; color: #f472b6; font-weight: bold;">${pIdx + 1}</td>
                            <td style="padding: 3px; border: 1px solid #334155; color: #f472b6; font-weight: bold;">${sched && sched.h !== -1 ? String(sched.h).padStart(2,'0')+':'+String(sched.m).padStart(2,'0') : '-'}</td>
                            <td style="padding: 3px; border: 1px solid #334155; color: #10b981; font-weight: bold;">${sched && sched.idx !== undefined ? sched.idx : '-'}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div>
                <span style="color: #38bdf8; font-weight: bold; font-size: 13px;">주간 일계획표</span>
                <table style="width: 100%; margin-top: 8px; border-collapse: collapse; text-align: center; font-size: 12px;">
                    <thead>
                        <tr style="background: rgba(255,255,255,0.1);">
                            ${['월', '화', '수', '목', '금', '토', '일'].map((d, i) => `<th style="padding: 3px; color: ${i === currentDayIndex ? '#10b981' : '#94a3b8'}; border: 1px solid #334155;">${d}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            ${weekPlanArr.map((dp, i) => {
                                const isToday = i === currentDayIndex;
                                return `<td style="padding: 3px; font-weight: bold; color: ${isToday ? '#10b981' : '#fff'}; border: 1px solid #334155; background: ${isToday ? 'rgba(16, 185, 129, 0.1)' : 'transparent'};">${dp}</td>`
                            }).join('')}
                        </tr>
                    </tbody>
                </table>
            </div>

            <div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <span style="color: #38bdf8; font-weight: bold; font-size: 13px;">TOD 계획정보 (현재 실행: 일계획 ${dayIdx + 1})</span>
                    <div style="display: flex; gap: 5px;">
                        <button id="btn-tod-group-1" style="background: #0ea5e9; color: #fff; border: none; padding: 2px 4px; border-radius: 4px; font-size: 11px; cursor: pointer;">일반맵 (1~5)</button>
                        <button id="btn-tod-group-2" style="background: #334155; color: #fff; border: none; padding: 2px 4px; border-radius: 4px; font-size: 11px; cursor: pointer;">시차맵 (6~10)</button>
                    </div>
                </div>
                
                <div style="overflow-x: auto; background: #0f172a; padding: 1px; border-radius: 6px; border: 1px solid #1e293b;">
                <table id="tod-table-group-1" style="width: 100%; border-collapse: collapse; text-align: center; font-size: 11px;">
                    <thead>
                        <tr style="background: rgba(255,255,255,0.05);">
                            <th style="padding: 6px 4px; border-bottom: 1px solid #334155; width: 30px; color: #94a3b8;">#</th>
                            ${[0,1,2,3,4].map(idx => `<th colspan="3" style="padding: 6px 4px; border-bottom: 1px solid #334155; border-left: 1px solid #334155; color: ${dayIdx === idx ? '#10b981' : '#94a3b8'};">일계획 ${idx+1}</th>`).join('')}
                        </tr>
                        <tr style="background: rgba(255,255,255,0.05);">
                            <th style="padding: 4px; border-bottom: 1px solid #334155;"></th>
                            ${[0,1,2,3,4].map(idx => `<th style="padding: 4px; border-bottom: 1px solid #334155; border-left: 1px solid #334155; font-weight: normal; color: #cbd5e1;">TIME</th><th style="padding: 4px; border-bottom: 1px solid #334155; font-weight: normal; color: #cbd5e1;">CYC</th><th style="padding: 4px; border-bottom: 1px solid #334155; font-weight: normal; color: #cbd5e1;">IDX</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${Array.from({length: 16}).map((_, rIdx) => `
                            <tr style="border-bottom: 1px solid #1e293b;">
                                <td style="padding: 4px; font-weight: bold; color: #64748b;">${rIdx + 1}</td>
                                ${[0,1,2,3,4].map(idx => {
                                    const sc = (j.schedules && j.schedules[idx]) ? j.schedules[idx][rIdx] : null;
                                    const isActive = (dayIdx === idx && pIdx === rIdx && sc && sc.h !== -1);
                                    const bg = isActive ? 'rgba(16, 185, 129, 0.2)' : 'transparent';
                                    const fontColor = isActive ? '#10b981' : '#cbd5e1';
                                    
                                    if (!sc || sc.h === -1) return `<td style="padding: 4px; border-left: 1px solid #334155; background: ${bg}; color: ${fontColor};">-</td><td style="padding: 4px; background: ${bg}; color: ${fontColor};">-</td><td style="padding: 4px; background: ${bg}; color: ${fontColor}; font-weight: bold;">-</td>`;
                                    return `
                                        <td style="padding: 4px; border-left: 1px solid #334155; background: ${bg}; color: ${fontColor}; font-family: monospace;">${String(sc.h).padStart(2,'0')}:${String(sc.m).padStart(2,'0')}</td>
                                        <td style="padding: 4px; background: ${bg}; color: ${fontColor};">${sc.cycle}</td>
                                        <td style="padding: 4px; background: ${bg}; color: ${fontColor}; font-weight: bold;">${sc.idx !== undefined ? sc.idx : '-'}</td>
                                    `;
                                }).join('')}
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                
                <table id="tod-table-group-2" style="width: 100%; border-collapse: collapse; text-align: center; font-size: 11px; display: none;">
                    <thead>
                        <tr style="background: rgba(255,255,255,0.05);">
                            <th style="padding: 6px 4px; border-bottom: 1px solid #334155; width: 30px; color: #94a3b8;">#</th>
                            ${[5,6,7,8,9].map(idx => `<th colspan="3" style="padding: 6px 4px; border-bottom: 1px solid #334155; border-left: 1px solid #334155; color: ${dayIdx === idx ? '#10b981' : '#94a3b8'};">시차맵 ${idx+1}</th>`).join('')}
                        </tr>
                        <tr style="background: rgba(255,255,255,0.05);">
                            <th style="padding: 4px; border-bottom: 1px solid #334155;"></th>
                            ${[5,6,7,8,9].map(idx => `<th style="padding: 4px; border-bottom: 1px solid #334155; border-left: 1px solid #334155; font-weight: normal; color: #cbd5e1;">TIME</th><th style="padding: 4px; border-bottom: 1px solid #334155; font-weight: normal; color: #cbd5e1;">CYC</th><th style="padding: 4px; border-bottom: 1px solid #334155; font-weight: normal; color: #cbd5e1;">IDX</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${Array.from({length: 16}).map((_, rIdx) => `
                            <tr style="border-bottom: 1px solid #1e293b;">
                                <td style="padding: 4px; font-weight: bold; color: #64748b;">${rIdx + 1}</td>
                                ${[5,6,7,8,9].map(idx => {
                                    const sc = (j.schedules && j.schedules[idx]) ? j.schedules[idx][rIdx] : null;
                                    const isActive = (dayIdx === idx && pIdx === rIdx && sc && sc.h !== -1);
                                    const bg = isActive ? 'rgba(16, 185, 129, 0.2)' : 'transparent';
                                    const fontColor = isActive ? '#10b981' : '#cbd5e1';
                                    
                                    if (!sc || sc.h === -1) return `<td style="padding: 4px; border-left: 1px solid #334155; background: ${bg}; color: ${fontColor};">-</td><td style="padding: 4px; background: ${bg}; color: ${fontColor};">-</td><td style="padding: 4px; background: ${bg}; color: ${fontColor}; font-weight: bold;">-</td>`;
                                    return `
                                        <td style="padding: 4px; border-left: 1px solid #334155; background: ${bg}; color: ${fontColor}; font-family: monospace;">${String(sc.h).padStart(2,'0')}:${String(sc.m).padStart(2,'0')}</td>
                                        <td style="padding: 4px; background: ${bg}; color: ${fontColor};">${sc.cycle}</td>
                                        <td style="padding: 4px; background: ${bg}; color: ${fontColor}; font-weight: bold;">${sc.idx !== undefined ? sc.idx : '-'}</td>
                                    `;
                                }).join('')}
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                </div>
            </div>
            
            <div style="margin-top: 15px;">
                <span style="color: #38bdf8; font-weight: bold; font-size: 13px; margin-bottom: 8px; display: inline-block;">플랜 인덱스별 현시계획표 (전체 통합)</span>
                <div style="overflow-x: auto; background: #0f172a; padding: 1px; border-radius: 6px; border: 1px solid #1e293b;">
                    <table style="width: 100%; border-collapse: collapse; text-align: center; font-size: 11px;">
                        <thead>
                            <tr style="background: rgba(255,255,255,0.05);">
                                <th style="padding: 6px 4px; border-bottom: 1px solid #334155; color: #94a3b8;">인덱스</th>
                                <th style="padding: 6px 4px; border-bottom: 1px solid #334155; color: #94a3b8;">주기(C)</th>
                                <th style="padding: 6px 4px; border-bottom: 1px solid #334155; color: #94a3b8;">연동(O)</th>
                                ${[1,2,3,4,5,6,7,8].map(i => `<th style="padding: 6px 4px; border-bottom: 1px solid #334155; border-left: 1px solid #334155; color: #10b981;">A${i}</th>`).join('')}
                                ${[1,2,3,4,5,6,7,8].map(i => `<th style="padding: 6px 4px; border-bottom: 1px solid #334155; border-left: 1px solid #334155; color: #38bdf8;">B${i}</th>`).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            ${Array.from({length: 16}).map((_, rIdx) => {
                                const p = (j.dayPlans && j.dayPlans[dayIdx]) ? j.dayPlans[dayIdx][rIdx] : null;
                                const s = (j.schedules && j.schedules[dayIdx]) ? j.schedules[dayIdx][rIdx] : null;
                                const hasData = p && p.splitA && (p.splitA.reduce((a,b)=>a+b,0) > 0 || (p.splitB && p.splitB.reduce((a,b)=>a+b,0) > 0));
                                const isActive = (sched && sched.idx === rIdx + 1);
                                const bg = isActive ? 'rgba(16, 185, 129, 0.2)' : 'transparent';
                                const fontColor = isActive ? '#10b981' : '#cbd5e1';
                                
                                if (!hasData) {
                                    return `
                                        <tr style="border-bottom: 1px solid #1e293b; background: ${bg}; color: ${fontColor};">
                                            <td style="padding: 4px; font-weight: bold; color: ${isActive ? '#10b981' : '#64748b'};">${rIdx + 1}</td>
                                            <td colspan="18" style="padding: 4px; color: #475569;">데이터 없음</td>
                                        </tr>
                                    `;
                                }
                                
                                const cycle = (s && s.cycle) ? s.cycle : (p.splitA ? p.splitA.reduce((a,b)=>a+b,0) : '-');
                                const offset = p.offset !== undefined ? p.offset : '-';
                                
                                return `
                                    <tr style="border-bottom: 1px solid #1e293b; background: ${bg}; color: ${fontColor};">
                                        <td style="padding: 4px; font-weight: bold;">${rIdx + 1}</td>
                                        <td style="padding: 4px;">${cycle}</td>
                                        <td style="padding: 4px;">${offset}</td>
                                        ${[0,1,2,3,4,5,6,7].map(i => `<td style="padding: 4px; border-left: 1px solid #334155;">${p.splitA ? p.splitA[i] : 0}</td>`).join('')}
                                        ${[0,1,2,3,4,5,6,7].map(i => `<td style="padding: 4px; border-left: 1px solid #334155;">${p.splitB ? p.splitB[i] : 0}</td>`).join('')}
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
    rightCol.innerHTML = rightHTML;

    // TOD 버튼 이벤트 리스너 등록
    const btnGroup1 = document.getElementById('btn-tod-group-1');
    const btnGroup2 = document.getElementById('btn-tod-group-2');
    const tableGroup1 = document.getElementById('tod-table-group-1');
    const tableGroup2 = document.getElementById('tod-table-group-2');
    
    if (btnGroup1 && btnGroup2 && tableGroup1 && tableGroup2) {
        btnGroup1.onclick = () => {
            tableGroup1.style.display = 'table';
            tableGroup2.style.display = 'none';
            btnGroup1.style.background = '#0ea5e9';
            btnGroup2.style.background = '#334155';
        };
        btnGroup2.onclick = () => {
            tableGroup2.style.display = 'table';
            tableGroup1.style.display = 'none';
            btnGroup2.style.background = '#0ea5e9';
            btnGroup1.style.background = '#334155';
        };
        if (dayIdx >= 5) btnGroup2.onclick();
    }
}

 f u n c t i o n   t o g g l e O v e r l a y M a p E x p a n d ( )   { 
         c o n s t   c o n t e n t   =   d o c u m e n t . q u e r y S e l e c t o r ( ' . d e t a i l - m o d a l - c o n t e n t ' ) ; 
         i f   ( c o n t e n t )   { 
                 c o n t e n t . c l a s s L i s t . t o g g l e ( ' e x p a n d e d - m a p ' ) ; 
                 s e t T i m e o u t ( ( )   = >   { 
                         i f   ( o v e r l a y M a p )   o v e r l a y M a p . i n v a l i d a t e S i z e ( ) ; 
                 } ,   3 0 0 ) ; 
         } 
 } 
 
 f u n c t i o n   t o g g l e O v e r l a y S i g n a l M o d e ( )   { 
         i f   ( t y p e o f   S T A T E   = = =   ' u n d e f i n e d ' )   r e t u r n ; 
         S T A T E . o v e r l a y D i s p l a y M o d e   =   S T A T E . o v e r l a y D i s p l a y M o d e   = = =   ' a r r o w '   ?   ' c o m p a s s '   :   ' a r r o w ' ; 
         i f   ( w i n d o w . _ c u r r e n t O v e r l a y J i d )   { 
                 i f   ( t y p e o f   c r e a t e O v e r l a y A r r o w s   = = =   ' f u n c t i o n ' )   { 
                         c r e a t e O v e r l a y A r r o w s ( w i n d o w . _ c u r r e n t O v e r l a y J i d ,   o v e r l a y M a p ) ; 
                 } 
         } 
 } 
  
 