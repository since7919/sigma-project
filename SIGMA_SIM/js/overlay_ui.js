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
    const title = document.getElementById('overlay-title');
    
    // 교차로명 및 ID 세팅 (기존 STATE 객체가 있다면 참조)
    if (typeof STATE !== 'undefined' && STATE.junctions && STATE.junctions[jid]) {
        title.innerText = `${STATE.junctions[jid].name || '이름 없음'} (${jid})`;
    } else {
        title.innerText = `교차로 상세 (${jid})`;
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
            attributionControl: false
        }).setView([STATE.junctions[jid].lat, STATE.junctions[jid].lng], 19);
        L.tileLayer('http://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
            maxZoom: 22
        }).addTo(overlayMap);
    } else {
        overlayMap.setView([STATE.junctions[jid].lat, STATE.junctions[jid].lng], 19);
    }
    setTimeout(() => {
        if (overlayMap) overlayMap.invalidateSize();
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

// DOM 로드 시 렌즈 요소 자동 생성
document.addEventListener('DOMContentLoaded', () => {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    directions.forEach(dir => {
        const mount = document.getElementById(`compass-${dir}`);
        if (mount) {
            mount.innerHTML = `
                <div class="component-block">
                    <div class="car-housing-box">
                        <div class="lens c-green"></div>
                        <div class="lens c-arrow"></div>
                        <div class="lens c-yellow"></div>
                        <div class="lens c-red"></div>
                    </div>
                </div>
            `;
        }
    });

    const pedDirs = ['N', 'E', 'S', 'W'];
    pedDirs.forEach(dir => {
        const mount = document.getElementById(`ped-${dir}`);
        if (mount) {
            mount.innerHTML = `
                <div class="component-block">
                    <div class="ped-housing-box">
                        <div class="ped-lens p-green"></div>
                        <div class="ped-lens p-red on"></div>
                    </div>
                </div>
            `;
        }
    });
});

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
        <table class="detail-grid-table" style="width: 100%; text-align: center; font-size: 12px; border-collapse: collapse;">
            <thead>
                <tr style="background: rgba(255,255,255,0.05); color: #94a3b8;">
                    <th style="padding: 5px; border: 1px solid #334155;">방향정보</th>
                    <th style="padding: 5px; border: 1px solid #334155;">출력형태</th>
                    <th style="padding: 5px; border: 1px solid #334155;">현시</th>
                </tr>
            </thead>
            <tbody>
    `;
    const dirs = ['북', '동', '남', '서'];
    dirs.forEach(dir => {
        leftHTML += `
            <tr style="border-top: 1px solid #334155;">
                <td style="padding: 5px; border-right: 1px solid #334155; font-weight: bold;">${dir}측</td>
                <td style="padding: 5px;">차량, 보행</td>
                <td style="padding: 5px; color: #10b981; font-family: monospace;">-</td>
            </tr>
        `;
    });
    leftHTML += `</tbody></table>`;

    leftHTML += `
        <div style="margin-top: 15px; padding-top: 10px; border-top: 2px solid #1e293b;">
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
        <div style="display: flex; flex-direction: column; gap: 15px;">
            <div>
                <span style="color: #38bdf8; font-weight: bold; font-size: 13px; border-bottom: 2px solid #38bdf8; padding-bottom: 2px;">운영정보</span>
                <table style="width: 100%; margin-top: 10px; border-collapse: collapse; text-align: center; font-size: 10px;">
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
                            <td style="padding: 5px; border: 1px solid #334155; color: #38bdf8; font-weight: bold;">${sched ? sched.cycle : '-'}초</td>
                            <td style="padding: 5px; border: 1px solid #334155; color: #e2e8f0;">${mainPhase}</td>
                            <td style="padding: 5px; border: 1px solid #334155; color: #e2e8f0; font-weight: bold;">${plan ? plan.offset : '-'}초</td>
                            <td style="padding: 5px; border: 1px solid #334155; color: #f472b6; font-weight: bold;">${dayIdx + 1}</td>
                            <td style="padding: 5px; border: 1px solid #334155; color: #f472b6; font-weight: bold;">${pIdx + 1}</td>
                            <td style="padding: 5px; border: 1px solid #334155; color: #f472b6; font-weight: bold;">${sched && sched.h !== -1 ? String(sched.h).padStart(2,'0')+':'+String(sched.m).padStart(2,'0') : '-'}</td>
                            <td style="padding: 5px; border: 1px solid #334155; color: #2dd4bf; font-weight: bold;">${sched ? sched.idx : '-'}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div>
                <span style="color: #38bdf8; font-weight: bold; font-size: 13px;">주간 일계획표</span>
                <table style="width: 100%; margin-top: 8px; border-collapse: collapse; text-align: center; font-size: 12px;">
                    <thead>
                        <tr style="background: rgba(255,255,255,0.1);">
                            ${['월', '화', '수', '목', '금', '토', '일'].map(d => `<th style="padding: 3px; border: 1px solid #334155; color: #94a3b8;">${d}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            ${weekPlanArr.map((dp, i) => `<td style="padding: 5px; border: 1px solid #334155; color: ${i === currentDayIndex ? '#000' : '#fff'}; background: ${i === currentDayIndex ? '#10b981' : 'transparent'}; font-weight: bold;">${dp}</td>`).join('')}
                        </tr>
                    </tbody>
                </table>
            </div>

            <div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: #38bdf8; font-weight: bold; font-size: 13px;">TOD 계획정보 (현재 실행: 일계획 ${dayIdx + 1})</span>
                    <div>
                        <button id="btn-tod-group-1" style="background: #0ea5e9; color: white; border: none; padding: 2px 8px; font-size: 11px; cursor: pointer; border-radius: 3px; margin-right: 4px;">일반맵(1~5)</button>
                        <button id="btn-tod-group-2" style="background: transparent; color: #94a3b8; border: 1px solid #334155; padding: 2px 8px; font-size: 11px; cursor: pointer; border-radius: 3px;">시차맵(6~10)</button>
                    </div>
                </div>
                
                <table id="tod-table-group-1" style="width: 100%; margin-top: 8px; border-collapse: collapse; text-align: center; font-size: 10px; table-layout: fixed;">
                    <thead>
                        <tr style="background: rgba(255,255,255,0.05); color: #94a3b8;">
                            <th rowspan="2" style="border: 1px solid #334155; width: 15px; padding: 2px;">#</th>
                            ${[0,1,2,3,4].map(idx => `<th colspan="3" style="border: 1px solid #334155; padding: 2px; color: ${dayIdx === idx ? '#38bdf8' : '#94a3b8'}; ${dayIdx === idx ? 'background: rgba(14, 165, 233, 0.1);' : ''}">일계획 ${idx+1}</th>`).join('')}
                        </tr>
                        <tr style="background: rgba(255,255,255,0.05); color: #94a3b8;">
                            ${[0,1,2,3,4].map(idx => `<th style="border: 1px solid #334155; padding: 1px; ${dayIdx === idx ? 'background: rgba(14, 165, 233, 0.1);' : ''}">TIME</th><th style="border: 1px solid #334155; padding: 1px; ${dayIdx === idx ? 'background: rgba(14, 165, 233, 0.1);' : ''}">CYC</th><th style="border: 1px solid #334155; padding: 1px; ${dayIdx === idx ? 'background: rgba(14, 165, 233, 0.1);' : ''}">IDX</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${Array.from({length: 16}).map((_, rIdx) => `
                            <tr>
                                <td style="border: 1px solid #334155; color: #94a3b8; padding: 1px;">${rIdx + 1}</td>
                                ${[0,1,2,3,4].map(idx => {
                                    const sc = (j.schedules && j.schedules[idx]) ? j.schedules[idx][rIdx] : null;
                                    if (!sc || sc.h === -1) return `<td style="border: 1px solid #334155; padding: 1px;">-</td><td style="border: 1px solid #334155; padding: 1px;">-</td><td style="border: 1px solid #334155; padding: 1px;">-</td>`;
                                    const isCurrent = (dayIdx === idx && pIdx === rIdx);
                                    const bg = isCurrent ? 'background: rgba(16, 185, 129, 0.2);' : (dayIdx === idx ? 'background: rgba(14, 165, 233, 0.05);' : '');
                                    const hl = isCurrent ? 'color: #10b981;' : '';
                                    return `
                                        <td style="border: 1px solid #334155; color: #e2e8f0; font-family: monospace; padding: 1px; ${bg} ${hl}">${String(sc.h).padStart(2,'0')}:${String(sc.m).padStart(2,'0')}</td>
                                        <td style="border: 1px solid #334155; color: #38bdf8; padding: 1px; ${bg}">${sc.cycle}</td>
                                        <td style="border: 1px solid #334155; color: #fff; font-weight: bold; padding: 1px; ${bg}">${sc.idx}</td>
                                    `;
                                }).join('')}
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                
                <table id="tod-table-group-2" style="width: 100%; margin-top: 8px; border-collapse: collapse; text-align: center; font-size: 10px; table-layout: fixed; display: none;">
                    <thead>
                        <tr style="background: rgba(255,255,255,0.05); color: #94a3b8;">
                            <th rowspan="2" style="border: 1px solid #334155; width: 15px; padding: 2px;">#</th>
                            ${[5,6,7,8,9].map(idx => `<th colspan="3" style="border: 1px solid #334155; padding: 2px; color: ${dayIdx === idx ? '#38bdf8' : '#94a3b8'}; ${dayIdx === idx ? 'background: rgba(14, 165, 233, 0.1);' : ''}">시차맵 ${idx+1}</th>`).join('')}
                        </tr>
                        <tr style="background: rgba(255,255,255,0.05); color: #94a3b8;">
                            ${[5,6,7,8,9].map(idx => `<th style="border: 1px solid #334155; padding: 1px; ${dayIdx === idx ? 'background: rgba(14, 165, 233, 0.1);' : ''}">TIME</th><th style="border: 1px solid #334155; padding: 1px; ${dayIdx === idx ? 'background: rgba(14, 165, 233, 0.1);' : ''}">CYC</th><th style="border: 1px solid #334155; padding: 1px; ${dayIdx === idx ? 'background: rgba(14, 165, 233, 0.1);' : ''}">IDX</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${Array.from({length: 16}).map((_, rIdx) => `
                            <tr>
                                <td style="border: 1px solid #334155; color: #94a3b8; padding: 1px;">${rIdx + 1}</td>
                                ${[5,6,7,8,9].map(idx => {
                                    const sc = (j.schedules && j.schedules[idx]) ? j.schedules[idx][rIdx] : null;
                                    if (!sc || sc.h === -1) return `<td style="border: 1px solid #334155; padding: 1px;">-</td><td style="border: 1px solid #334155; padding: 1px;">-</td><td style="border: 1px solid #334155; padding: 1px;">-</td>`;
                                    const isCurrent = (dayIdx === idx && pIdx === rIdx);
                                    const bg = isCurrent ? 'background: rgba(16, 185, 129, 0.2);' : (dayIdx === idx ? 'background: rgba(14, 165, 233, 0.05);' : '');
                                    const hl = isCurrent ? 'color: #10b981;' : '';
                                    return `
                                        <td style="border: 1px solid #334155; color: #e2e8f0; font-family: monospace; padding: 1px; ${bg} ${hl}">${String(sc.h).padStart(2,'0')}:${String(sc.m).padStart(2,'0')}</td>
                                        <td style="border: 1px solid #334155; color: #38bdf8; padding: 1px; ${bg}">${sc.cycle}</td>
                                        <td style="border: 1px solid #334155; color: #fff; font-weight: bold; padding: 1px; ${bg}">${sc.idx}</td>
                                    `;
                                }).join('')}
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            
            <div>
                <span style="color: #38bdf8; font-weight: bold; font-size: 13px;">플랜 인덱스별 현시계획표 (Plan ${sched ? sched.idx : '-'})</span>
                <table style="width: 100%; margin-top: 8px; border-collapse: collapse; text-align: center; font-size: 11px;">
                    <thead>
                        <tr style="background: rgba(255,255,255,0.05); color: #94a3b8;">
                            <th style="padding: 2px; border: 1px solid #334155;">링</th>
                            ${[1,2,3,4,5,6,7,8].map(i => `<th style="padding: 2px; border: 1px solid #334155;">${i}현시</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td style="padding: 2px; border: 1px solid #334155; color: #10b981; font-weight: bold;">A링</td>
                            ${[1,2,3,4,5,6,7,8].map(i => `<td style="padding: 2px; border: 1px solid #334155; color: #fff;">${plan && plan.splitA ? plan.splitA[i-1] : '-'}</td>`).join('')}
                        </tr>
                        <tr>
                            <td style="padding: 2px; border: 1px solid #334155; color: #3b82f6; font-weight: bold;">B링</td>
                            ${[1,2,3,4,5,6,7,8].map(i => `<td style="padding: 2px; border: 1px solid #334155; color: #fff;">${plan && plan.splitB ? plan.splitB[i-1] : '-'}</td>`).join('')}
                        </tr>
                    </tbody>
                </table>
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
            btnGroup1.style.background = '#0ea5e9'; btnGroup1.style.color = 'white'; btnGroup1.style.border = 'none';
            btnGroup2.style.background = 'transparent'; btnGroup2.style.color = '#94a3b8'; btnGroup2.style.border = '1px solid #334155';
        };
        btnGroup2.onclick = () => {
            tableGroup2.style.display = 'table';
            tableGroup1.style.display = 'none';
            btnGroup2.style.background = '#0ea5e9'; btnGroup2.style.color = 'white'; btnGroup2.style.border = 'none';
            btnGroup1.style.background = 'transparent'; btnGroup1.style.color = '#94a3b8'; btnGroup1.style.border = '1px solid #334155';
        };
        if (dayIdx >= 5) btnGroup2.onclick();
    }
}
