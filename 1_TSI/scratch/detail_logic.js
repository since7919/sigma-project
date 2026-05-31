let detailMap = null;
let detailUpdateTimer = null;
let detailMarkers = {};

function openDetailOverlay(item) {
    const overlay = document.getElementById('detail-overlay');
    overlay.classList.remove('hidden');

    // 기본 정보 세팅
    document.getElementById('detail-itst-name').textContent = item.itstNm;
    document.getElementById('f-val-id').textContent = item.itstId;
    document.getElementById('f-val-region').textContent = REGIONS.find(r => r.code === currentRegionCode)?.name || '인천시';
    document.getElementById('detail-region-label').textContent = `[${document.getElementById('f-val-region').textContent}]`;

    // 미니맵 초기화
    setTimeout(() => {
        if (detailMap) {
            detailMap.remove();
        }
        detailMap = L.map('detail-map', {
            zoomControl: false,
            attributionControl: false
        }).setView([item.la, item.lo], 18);

        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(detailMap);
        
        L.circleMarker([item.la, item.lo], {
            radius: 12,
            fillColor: "#38bdf8",
            color: "#fff",
            weight: 3,
            fillOpacity: 0.8
        }).addTo(detailMap);

        // 이미지에 있는 신호등 아이콘 시뮬레이션 (8방향 정밀 배치)
        const angles = [0, 45, 90, 135, 180, 225, 270, 315];
        const dirNames = { 0: '북', 45: '북동', 90: '동', 135: '남동', 180: '남', 225: '남서', 270: '서', 315: '북서' };
        
        detailMarkers = {};
        angles.forEach(deg => {
            const distanceY = 0.00024;
            const distanceX = (deg === 0 || deg === 180) ? 0.00024 : 0.00032;
            const rad = deg * Math.PI / 180;
            
            const markerLat = item.la + distanceY * Math.cos(rad);
            const markerLng = item.lo + distanceX * Math.sin(rad);

            const marker = L.circleMarker([markerLat, markerLng], {
                radius: 8,
                fillColor: "#ef4444", // 기본 적색
                color: "#000",
                weight: 2,
                fillOpacity: 1
            }).addTo(detailMap);

            marker.bindTooltip(`${dirNames[deg]}향 (${deg}°)`, { direction: 'top', offset: [0, -5] });
            detailMarkers[deg] = marker;
        });
    }, 100);

    // 상세 테이블 업데이트 시작
    startDetailRealtimeUpdate(item);
}

/**
 * [신호 방향 및 출력 체계 핵심 규칙] 적용
 * 1. 방향정보: 북, 북동, 동, 남동, 남, 남서, 서, 북서 (8방위)
 * 2. 출력형태: 직진(1), 좌회전(2), 보행(3)
 */
function parsePhaseCode(code) {
    if (!code) return null;
    
    // 첫 글자로 출력 형태 파싱
    const typeChar = code.charAt(0).toUpperCase();
    let typeName = '미지정';
    if (typeChar === 'S') typeName = '직진(1)';
    else if (typeChar === 'L') typeName = '좌회전(2)';
    else if (typeChar === 'P') typeName = '보행(3)';
    else return null; // 유효하지 않은 타입은 제외

    // 1~3번 인덱스로 각도 파싱 (방향정보)
    const enterAngle = parseInt(code.substring(1, 4), 10);
    let dirName = '미지정';
    
    if (!isNaN(enterAngle)) {
        const angle = enterAngle % 360;
        if (angle >= 337 || angle < 22) dirName = '북';
        else if (angle >= 22 && angle < 67) dirName = '북동';
        else if (angle >= 67 && angle < 112) dirName = '동';
        else if (angle >= 112 && angle < 157) dirName = '남동';
        else if (angle >= 157 && angle < 202) dirName = '남';
        else if (angle >= 202 && angle < 247) dirName = '남서';
        else if (angle >= 247 && angle < 292) dirName = '서';
        else if (angle >= 292 && angle < 337) dirName = '북서';
    }

    const dirAngleMap = { '북': 0, '북동': 45, '동': 90, '남동': 135, '남': 180, '남서': 225, '서': 270, '북서': 315 };
    const parsedAngle = dirAngleMap[dirName] !== undefined ? dirAngleMap[dirName] : 0;

    return { 
        direction: dirName, 
        outputType: typeName,
        pedestrian: 0, 
        bankCode: '', 
        timeSignal: 0, 
        original: code,
        type: typeChar,
        angle: parsedAngle
    };
}

function getRealtimeSignalState() {
    if (!currentCropData || !currentCropData.cycle) {
        return null;
    }

    const cycle = parseInt(currentCropData.cycle);
    const offset = parseInt(currentCropData.offset || 0);
    const nowSeconds = Math.floor(Date.now() / 1000);
    const timeInCycle = (nowSeconds - offset + cycle) % cycle;

    const calcRingState = (ringPrefix) => {
        let cumulativeTime = 0;
        let currentPhaseIdx = 1;
        let remainingTime = 0;

        for (let i = 1; i <= 8; i++) {
            const split = currentCropData[`${ringPrefix}_${i}_PHASE_VAL`] || 0;
            if (split === 0) continue;
            
            if (timeInCycle < cumulativeTime + split) {
                currentPhaseIdx = i;
                remainingTime = (cumulativeTime + split) - timeInCycle;
                break;
            }
            cumulativeTime += split;
        }
        return { currentPhaseIdx, remainingTime };
    };

    const ringA = calcRingState('A_RING');
    const ringB = calcRingState('B_RING');

    return { 
        currentPhaseA: ringA.currentPhaseIdx, 
        remainingTimeA: ringA.remainingTime,
        currentPhaseB: ringB.currentPhaseIdx,
        remainingTimeB: ringB.remainingTime
    };
}

function calculateActualSignalStatus(phases) {
    const state = getRealtimeSignalState();
    
    // UI 업데이트 (현재 현시 표시)
    const phaseEl = document.getElementById('current-phase');
    if (phaseEl) {
        phaseEl.textContent = state ? `${state.currentPhaseA}(A) / ${state.currentPhaseB}(B)` : '수신대기';
    }
    if (!state) {
        return phases.map(p => ({
            ...p,
            isGreen: false,
            remaining: 0,
            statusText: '정보없음',
            statusClass: 'sig-status-gray'
        }));
    }

    return phases.map(p => {
        const isActive = p.ring === 'A' ? (p.idx === state.currentPhaseA) : (p.idx === state.currentPhaseB);
        const remainingTime = p.ring === 'A' ? state.remainingTimeA : state.remainingTimeB;
        let statusText = '적색 점등(1)';
        let statusClass = 'sig-status-red';
        let isGreen = false;

        if (isActive) {
            isGreen = true;
            if (p.outputType.includes('보행')) {
                if (remainingTime <= 7) {
                    statusText = '보행 점멸(3)';
                    statusClass = 'sig-status-flash';
                } else {
                    statusText = '녹색 점등(3)';
                    statusClass = 'sig-status-green';
                }
            } else {
                if (remainingTime <= 3) {
                    statusText = '황색 점등(2)';
                    statusClass = 'sig-status-yellow';
                } else {
                    statusText = '녹색 점등(3)';
                    statusClass = 'sig-status-green';
                }
            }
        }

        // 보행자 신호 잔여시간 설정
        let pedestrianVal = '-';
        if (isActive) {
            if (p.type === 'P' || p.type === 'S') {
                pedestrianVal = remainingTime + 's';
            }
        }

        return {
            ...p,
            isGreen: isGreen,
            remaining: isActive ? remainingTime : 0,
            pedestrian: pedestrianVal, // 보행자 신호 잔여시간 반영
            statusText: statusText,
            statusClass: statusClass
        };
    });
}


function startDetailRealtimeUpdate(item) {
    if (detailUpdateTimer) clearInterval(detailUpdateTimer);

    // API 데이터 또는 로컬 데이터를 기반으로 Phase 리스트 생성 (reduce 활용 예시)
    let phases = [];
    if (typeof L02_DETAIL_DATA !== 'undefined') {
        const conf = L02_DETAIL_DATA.find(d => d.INT_NO == item.itstId);
        if (conf) {
            // A Ring과 B Ring 데이터 수집 및 파싱
            phases = [1, 2, 3, 4, 5, 6, 7, 8].reduce((acc, idx) => {
                const aPhase = parsePhaseCode(conf[`A_RING_${idx}_PHASE_CONF_CD`]);
                const bPhase = parsePhaseCode(conf[`B_RING_${idx}_PHASE_CONF_CD`]);
                if (aPhase) acc.push({ ...aPhase, ring: 'A', idx });
                if (bPhase) acc.push({ ...bPhase, ring: 'B', idx });
                return acc;
            }, []);
        }
    }

    // 데이터가 없어도 모의 데이터를 생성하지 않고 빈 리스트 유지
    if (phases.length === 0) {
        // 비워둠 (실제 정보만 표시)
    }

    const update = () => {
        const tableBody = document.getElementById('detail-signal-body');
        
        if (currentCropData) {
            document.getElementById('f-val-cycle').textContent = currentCropData.cycle + '초';
            // f-val-offset은 HTML에 없을 수 있으므로 체크 후 업데이트
            const offsetEl = document.getElementById('f-val-offset');
            if (offsetEl) offsetEl.textContent = (currentCropData.offset || 0) + '초';
            
            // 상태 정보 '정상'으로 복구
            document.querySelectorAll('.footer-content .val-normal').forEach(el => {
                el.textContent = '정상';
                el.style.color = '#10b981';
            });
        } else {
            document.getElementById('f-val-cycle').textContent = '-';
            const offsetEl = document.getElementById('f-val-offset');
            if (offsetEl) offsetEl.textContent = '-';

            // 상태 정보 '정보없음'으로 변경
            document.querySelectorAll('.footer-content .val-normal').forEach(el => {
                el.textContent = '미수신';
                el.style.color = '#94a3b8';
            });
        }

        if (currentCropData) {
            const now = new Date();
            document.getElementById('f-val-time').textContent = now.getFullYear() + '-' + 
                String(now.getMonth()+1).padStart(2,'0') + '-' + 
                String(now.getDate()).padStart(2,'0') + ' ' + 
                now.toLocaleTimeString('ko-KR', {hour12:false});
        } else {
            document.getElementById('f-val-time').textContent = '-';
        }

        // 테이블 렌더링
        const updatedPhases = calculateActualSignalStatus(phases);
        
        tableBody.innerHTML = updatedPhases.map(p => `
            <tr>
                <td style="font-weight:700; color:var(--accent-primary);">${p.direction}</td>
                <td>${p.pedestrian}</td>
                <td>${p.bankCode}</td>
                <td style="font-family: monospace; font-weight:700; color: ${p.isGreen ? '#10b981' : 'inherit'}">
                    ${p.isGreen ? p.remaining + 's' : '-'}
                </td>
                <td><span class="output-badge">${p.outputType}</span></td>
                <td><div class="${p.statusClass}">${p.statusText}</div></td>
            </tr>
        `).join('');
    };

    update();
    detailUpdateTimer = setInterval(update, 1000);
}

function closeDetailOverlay() {
    document.getElementById('detail-overlay').classList.add('hidden');
    if (detailUpdateTimer) clearInterval(detailUpdateTimer);
    if (detailMap) {
        detailMap.remove();
        detailMap = null;
    }
    detailMarkers = {};
}

function switchTab(tabId) {
    // 버튼 활성화 처리
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabId);
    });
    // 컨텐츠 전환 처리
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === `tab-${tabId}`);
    });
}


function initSignalBoard() {
    const container = document.querySelector('.signal-details');
    container.innerHTML = `
        <div class="signal-container">
            <div class="signal-header">
                <h3>교차로 실시간 신호 (8방향)</h3>
                <span class="realtime-badge">Simulation</span>
            </div>
            <div class="signal-board">
                ${[0, 45, 90, 135, 180, 225, 270, 315].map(deg => `
                    <div class="direction-signal dir-${deg}" id="cluster-${deg}">
                        <div class="signal-cluster" style="transform: rotate(${deg}deg);">
                            <div class="vehicle-box">
                                <div class="sig-unit s-light" title="직진"><svg viewBox="0 0 24 24"><path d="M12 4l-8 8h6v8h4v-8h6l-8-8z"/></svg></div>
                                <div class="sig-unit l-light" title="좌회전"><svg viewBox="0 0 24 24" style="transform: rotate(-45deg);"><path d="M12 4l-8 8h6v8h4v-8h6l-8-8z"/></svg></div>
                            </div>
                            <div class="pedestrian-box p-light" title="보행">
                                <svg viewBox="0 0 24 24"><path d="M13.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM9.8 8.9L7 23h2.1l1.8-8 2.1 2v6h2V15l-2.1-2 .6-3C14.8 12 16.8 13 19 13v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L6 8.3V13h2V9.6l1.8-.7"/></svg>
                            </div>
                        </div>
                    </div>
                `).join('')}
                <div class="center-label">
                    <span style="font-size:9px; opacity:0.6;">PHASE</span>
                    <div id="current-phase" style="font-size:26px; font-weight:900; color:var(--accent-primary);">1</div>
                </div>
            </div>
            <div class="status-table-container glass-inner" style="margin-top: 15px; padding: 10px;">
                <table style="width: 100%; font-size: 10px; border-collapse: collapse; text-align: center;">
                    <thead>
                        <tr style="color: var(--accent-primary); border-bottom: 1px solid rgba(255,255,255,0.1); opacity: 0.8;">
                            <th style="text-align: left;">방향</th>
                            <th>직진</th><th>좌회전</th><th>보행</th>
                            <th style="text-align: right;">시간</th>
                        </tr>
                    </thead>
                    <tbody id="realtime-status-body"></tbody>
                </table>
            </div>
        </div>
        <div id="plan-wd-section" style="margin-top: 20px;">
            <h3 style="font-size: 13px; color: var(--text-muted); margin-bottom: 10px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 15px;">요일별 신호계획</h3>
            <div id="plan-wd-content"></div>
        </div>
    `;
}

function startRealtimePolling(id, name) {
    if (currentSignalTimer) clearInterval(currentSignalTimer);
    
    simulatedCycle = 0;
    currentSignalTimer = setInterval(() => {
        updateSignalSimulation();
        // 실제 API 연동 시 아래 주석 해제
        // fetchRealtimeStatus(id, name); 
    }, 1000);
}

function updateSignalSimulation() {
    const state = getRealtimeSignalState();
    const phaseA = state ? state.currentPhaseA : 0;
    const countdownA = state ? state.remainingTimeA : 0;
    const phaseB = state ? state.currentPhaseB : 0;
    const countdownB = state ? state.remainingTimeB : 0;
    
    // UI 업데이트 (현재 현시 표시 - 중복 업데이트 방지, popup이 없을때도 동작하도록)
    const phaseEl = document.getElementById('current-phase');
    if (phaseEl && document.getElementById('detail-overlay').classList.contains('hidden')) {
        phaseEl.textContent = state ? `${phaseA}(A) / ${phaseB}(B)` : '수신대기';
    }

    const directions = [0, 45, 90, 135, 180, 225, 270, 315];
    const directionNames = { 0: '북', 45: '북동', 90: '동', 135: '남동', 180: '남', 225: '남서', 270: '서', 315: '북서' };
    const statusBody = document.getElementById('realtime-status-body');
    let tableRows = '';

    // 실제 설정 정보 로드
    let sPhaseMap = {}, lPhaseMap = {}, pPhaseMap = {};
    const itstId = document.getElementById('f-val-id')?.textContent;
    if (typeof L02_DETAIL_DATA !== 'undefined' && itstId) {
        const conf = L02_DETAIL_DATA.find(d => d.INT_NO == itstId);
        if (conf) {
            for (let i = 1; i <= 8; i++) {
                ['A', 'B'].forEach(ring => {
                    const parsed = parsePhaseCode(conf[`${ring}_RING_${i}_PHASE_CONF_CD`]);
                    if (parsed) {
                        if (parsed.type === 'S') sPhaseMap[parsed.angle] = { ring, idx: i };
                        else if (parsed.type === 'L') lPhaseMap[parsed.angle] = { ring, idx: i };
                        else if (parsed.type === 'P') pPhaseMap[parsed.angle] = { ring, idx: i };
                    }
                });
            }
        }
    }
    const hasConf = Object.keys(sPhaseMap).length > 0;

    directions.forEach((deg) => {
        const cluster = document.getElementById(`cluster-${deg}`);
        let s = 'off', l = 'off', p = 'off';
        let countdown = 0; // 해당 방향의 대표 카운트다운

        if (hasConf && state) {
            const checkActive = (map) => {
                const conf = map[deg];
                if (!conf) return false;
                return conf.ring === 'A' ? (conf.idx === phaseA) : (conf.idx === phaseB);
            };
            const getCountdown = (map) => {
                const conf = map[deg];
                if (!conf) return 0;
                return conf.ring === 'A' ? countdownA : countdownB;
            };

            if (checkActive(sPhaseMap)) {
                s = 'green';
                countdown = Math.max(countdown, getCountdown(sPhaseMap));
            }
            if (checkActive(lPhaseMap)) {
                l = 'green';
                countdown = Math.max(countdown, getCountdown(lPhaseMap));
            }
            
            if (checkActive(pPhaseMap)) {
                p = 'green';
                countdown = Math.max(countdown, getCountdown(pPhaseMap));
            } else if (checkActive(sPhaseMap) && !pPhaseMap[deg]) {
                p = 'green';
                // 보행이 직진에 연동되는 경우 직진의 카운트다운 사용
            }
        } else {
            // 데이터가 없는 경우 임시 더미 매핑
            if (phaseA === 1 && (deg === 0 || deg === 180)) { s = 'green'; p = 'green'; countdown = countdownA; }
            else if (phaseA === 2 && (deg === 0 || deg === 180)) { l = 'green'; countdown = countdownA; }
            else if (phaseA === 3 && (deg === 90 || deg === 270)) { s = 'green'; p = 'green'; countdown = countdownA; }
            else if (phaseA === 4 && (deg === 90 || deg === 270)) { l = 'green'; countdown = countdownA; }
            else if (phaseA > 4) {
                if (phaseA === 5 && (deg === 45 || deg === 225)) { s = 'green'; p = 'green'; countdown = countdownA; }
                if (phaseA === 6 && (deg === 45 || deg === 225)) { l = 'green'; countdown = countdownA; }
                if (phaseA === 7 && (deg === 135 || deg === 315)) { s = 'green'; p = 'green'; countdown = countdownA; }
                if (phaseA === 8 && (deg === 135 || deg === 315)) { l = 'green'; countdown = countdownA; }
            }
        }

        // 시간제 신호에 따른 황색/점멸 처리
        if (s === 'green' && countdown <= 3) s = 'yellow';
        if (l === 'green' && countdown <= 3) l = 'yellow';
        if (p === 'green' && countdown <= 7) p = 'flash';

        if (cluster) {
            cluster.querySelector('.s-light').className = `sig-unit s-light active-s ${s}`;
            cluster.querySelector('.l-light').className = `sig-unit l-light active-l ${l}`;
            cluster.querySelector('.p-light').className = `pedestrian-box p-light active-p ${p}`;
        }

        // 8방향 Leaflet 신호등 마커 실시간 업데이트
        if (typeof detailMarkers !== 'undefined' && detailMarkers[deg]) {
            let markerColor = "#ef4444"; // 기본 적색
            let statusText = "정지";
            if (s === 'green' || l === 'green' || p === 'green' || p === 'flash') {
                markerColor = "#10b981"; // 녹색
                statusText = "진행";
                if (p === 'flash') statusText = "보행점멸";
            } else if (s === 'yellow' || l === 'yellow') {
                markerColor = "#f59e0b"; // 황색
                statusText = "주의";
            }
            
            detailMarkers[deg].setStyle({
                fillColor: markerColor
            });

            // 툴팁 실시간 업데이트
            detailMarkers[deg].setTooltipContent(`${directionNames[deg]}향 (${deg}°)<br><span style="color:${markerColor}; font-weight:bold;">${statusText} ${countdown > 0 ? countdown + 's' : ''}</span>`);
        }

        let sDotColor = s === 'green' ? '#10b981' : (s === 'yellow' ? '#f59e0b' : '#ef4444');
        let lDotColor = l === 'green' ? '#10b981' : (l === 'yellow' ? '#f59e0b' : '#ef4444');
        let pDotColor = p === 'green' || p === 'flash' ? '#10b981' : '#ef4444';
        let countdownColor = (s === 'green' || l === 'green' || p === 'green' || s === 'yellow' || l === 'yellow' || p === 'flash') ? '#10b981' : 'inherit';
        if (s === 'yellow' || l === 'yellow') countdownColor = '#f59e0b';

        tableRows += `
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                <td style="padding: 4px 5px; text-align: left;">${directionNames[deg]}향 (${deg}°)</td>
                <td style="color: ${sDotColor}">●</td>
                <td style="color: ${lDotColor}">●</td>
                <td style="color: ${pDotColor}; ${p === 'flash' ? 'animation: text-flash 0.5s infinite;' : ''}">●</td>
                <td style="text-align: right; font-family: monospace; color: ${countdownColor}">
                    ${(s !== 'red' || l !== 'red' || p !== 'red') ? countdown + 's' : '-'}
                </td>
            </tr>
        `;
    });

    if (statusBody) statusBody.innerHTML = tableRows;
}

// CROP 운영계획 API 수신 및 파싱
async function fetchPlanCROP(itstId, itstNm) {
    currentCropData = null; // 초기화
    try {
        const targetUrl = `${API_CONFIG.cropUrl}?serviceKey=${API_CONFIG.serviceKey}&type=xml&srchCTId=${currentRegionCode}&srchCRNm=${encodeURIComponent(itstNm)}&pageNo=1&numOfRows=10`;
        const response = await fetch(getUrl(targetUrl));
        if (!response.ok) throw new Error('Network response not ok');
        const text = await response.text();
        const parsed = parseCropXml(text, itstId);
        if (parsed) {
            currentCropData = parsed;
            updateApiStatus(true);
        } else {
            throw new Error('Parsed crop data is null');
        }
    } catch (error) {
        console.error('CROP Fetch Error:', error);
        updateApiStatus(false, 'API Proxy Error');
        
        // 오프라인 상태 또는 API 장애 시, L02_DETAIL_DATA를 기반으로 고정밀 CROP 시뮬레이션 데이터 생성!
        if (typeof L02_DETAIL_DATA !== 'undefined') {
            const conf = L02_DETAIL_DATA.find(d => d.INT_NO == itstId);
            if (conf) {
                const data = {
                    planNo: 'MOCK_OFFLINE',
                    cycle: '120',
                    offset: '0'
                };
                let sumA = 0;
                let sumB = 0;
                for (let i = 1; i <= 8; i++) {
                    const aCode = conf[`A_RING_${i}_PHASE_CONF_CD`];
                    const bCode = conf[`B_RING_${i}_PHASE_CONF_CD`];
                    
                    let aVal = 0;
                    if (aCode) {
                        aVal = parseInt(aCode.substring(4, 7), 10) / 10;
                        if (isNaN(aVal) || aVal <= 0) aVal = 20; // fallback
                    }
                    let bVal = 0;
                    if (bCode) {
                        bVal = parseInt(bCode.substring(4, 7), 10) / 10;
                        if (isNaN(bVal) || bVal <= 0) bVal = 20; // fallback
                    }
                    
                    data[`A_RING_${i}_PHASE_VAL`] = aVal;
                    data[`B_RING_${i}_PHASE_VAL`] = bVal;
                    sumA += aVal;
                    sumB += bVal;
                }
                const calculatedCycle = Math.max(sumA, sumB);
                data.cycle = (calculatedCycle > 0 ? calculatedCycle : 120).toString();
                currentCropData = data;
            }
        }
    }
}

function parseCropXml(xmlString, targetId) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, "text/xml");
    let items = xmlDoc.getElementsByTagName("PlanCROPInfo");
    if (items.length === 0) items = xmlDoc.getElementsByTagName("item");
    
    // 현재 시간에 가장 부합하는(혹은 첫번째) 운영계획을 가져옴
    // 편의상 targetId와 일치하는 첫 번째 계획을 사용 (추후 운영계획시/분에 맞춰 정교화 가능)
    for (let item of items) {
        const intNo = item.getElementsByTagName("INT_NO")[0]?.textContent;
        if (intNo === targetId) {
            const data = {
                planNo: item.getElementsByTagName("INT_PLAN_NO")[0]?.textContent,
                cycle: item.getElementsByTagName("INT_OPER_CYCLE_VAL")[0]?.textContent,
                offset: item.getElementsByTagName("INT_OPER_OFFSET_VAL")[0]?.textContent,
            };
            // A링/B링 1~8현시 값 파싱
            let sumA = 0;
            let sumB = 0;
            for (let i = 1; i <= 8; i++) {
                data[`A_RING_${i}_PHASE_VAL`] = parseInt(item.getElementsByTagName(`A_RING_${i}_PHASE_VAL`)[0]?.textContent || 0, 10);
                data[`B_RING_${i}_PHASE_VAL`] = parseInt(item.getElementsByTagName(`B_RING_${i}_PHASE_VAL`)[0]?.textContent || 0, 10);
                sumA += data[`A_RING_${i}_PHASE_VAL`];
                sumB += data[`B_RING_${i}_PHASE_VAL`];
            }
            const calculatedCycle = Math.max(sumA, sumB);
            if (calculatedCycle > 0 && (data.cycle === '121' || !data.cycle || Math.abs(parseInt(data.cycle) - calculatedCycle) > 5)) {
                data.cycle = calculatedCycle.toString();
            }
            return data;
        }
    }
    return null;
}

// 시그널맵 API 수신 및 파싱
async function fetchSigMapCRInfo(itstId, itstNm) {
    currentSigMapData = { ringA: [], ringB: [] }; // 초기화
    try {
        const targetUrl = `${API_CONFIG.sigMapUrl}?serviceKey=${API_CONFIG.serviceKey}&type=xml&srchCTId=${currentRegionCode}&srchCRNm=${encodeURIComponent(itstNm)}&pageNo=1&numOfRows=100`;
        const response = await fetch(getUrl(targetUrl));
        if (!response.ok) throw new Error('Network response not ok');
        const text = await response.text();
        const parsed = parseSigMapXml(text, itstId);
        if (parsed && (parsed.ringA.length > 0 || parsed.ringB.length > 0)) {
            currentSigMapData = parsed;
            updateApiStatus(true);
            renderSigMapTable();
        } else {
            throw new Error('Parsed sigmap data is empty');
        }
    } catch (error) {
        console.error('SigMap Fetch Error:', error);
        updateApiStatus(false, 'API Proxy Error');
        
        // 오프라인 상태일 때, L02_DETAIL_DATA를 기반으로 사실적인 8단계 시그널맵 데이터 생성!
        if (typeof L02_DETAIL_DATA !== 'undefined') {
            const conf = L02_DETAIL_DATA.find(d => d.INT_NO == itstId);
            if (conf) {
                const stepsA = [];
                const stepsB = [];
                
                let stepNoA = 1;
                let stepNoB = 1;
                for (let i = 1; i <= 8; i++) {
                    const aCode = conf[`A_RING_${i}_PHASE_CONF_CD`];
                    const bCode = conf[`B_RING_${i}_PHASE_CONF_CD`];
                    
                    if (aCode) {
                        const parsed = parsePhaseCode(aCode);
                        const step = {
                            stepNo: stepNoA++,
                            minTm: 10,
                            maxTm: 30,
                            eop: 1
                        };
                        for (let k = 1; k <= 8; k++) {
                            step[`car${k}`] = 8;
                            step[`ped${k}`] = 8;
                        }
                        if (parsed.type === 'S') step[`car${i}`] = 1;
                        else if (parsed.type === 'L') step[`car${i}`] = 4;
                        else if (parsed.type === 'P') step[`ped${i}`] = 16;
                        
                        stepsA.push(step);
                    }
                    if (bCode) {
                        const parsed = parsePhaseCode(bCode);
                        const step = {
                            stepNo: stepNoB++,
                            minTm: 10,
                            maxTm: 30,
                            eop: 1
                        };
                        for (let k = 1; k <= 8; k++) {
                            step[`car${k}`] = 8;
                            step[`ped${k}`] = 8;
                        }
                        if (parsed.type === 'S') step[`car${i}`] = 1;
                        else if (parsed.type === 'L') step[`car${i}`] = 4;
                        else if (parsed.type === 'P') step[`ped${i}`] = 16;
                        
                        stepsB.push(step);
                    }
                }
                
                currentSigMapData = { ringA: stepsA, ringB: stepsB };
                renderSigMapTable();
            }
        }
    }
}

function switchDetailTab(tabId) {
    const btns = document.querySelectorAll('.detail-tab-btn');
    const contents = document.querySelectorAll('.detail-tab-content');
    
    btns.forEach(btn => btn.classList.remove('active'));
    contents.forEach(content => content.style.display = 'none');
    
    if (tabId === 'status') {
        btns[0].classList.add('active');
        document.getElementById('tab-current-status').style.display = 'block';
    } else {
        btns[1].classList.add('active');
        document.getElementById('tab-sigmap-table').style.display = 'block';
    }
}

function renderSigMapTable() {
    const renderTable = (theadId, tbodyId, steps, ringName) => {
        const thead = document.getElementById(theadId);
        const tbody = document.getElementById(tbodyId);
        if (!thead || !tbody) return;

        if (!steps || steps.length === 0) {
            thead.innerHTML = '';
            tbody.innerHTML = `<tr><td style="padding:20px; text-align:center; color: #94a3b8;">${ringName} 데이터 없음</td></tr>`;
            return;
        }

        // Header 구성
        let headHTML = `
            <tr>
                <th rowspan="2" style="width:30px;">ST</th>
                <th colspan="2">L1</th><th colspan="2">L2</th><th colspan="2">L3</th><th colspan="2">L4</th>
                <th colspan="2">L5</th><th colspan="2">L6</th><th colspan="2">L7</th><th colspan="2">L8</th>
                <th rowspan="2" style="width:25px;">MIN</th>
                <th rowspan="2" style="width:25px;">MAX</th>
                <th rowspan="2" style="width:25px;">EOP</th>
            </tr>
            <tr>`;
        for(let i=1; i<=8; i++) headHTML += `<th>V</th><th>P</th>`;
        headHTML += `</tr>`;
        thead.innerHTML = headHTML;

        // Body 구성
        let bodyHTML = '';
        const toHex = (v) => {
            if (v === 0 || v === '0' || !v) return '00';
            // 만약 v가 16(0x10)이거나 문자열 "16", 22(0x16)인 경우 "10"으로 보정!
            if (v === 16 || v === '16' || v === 22 || v === '22') return '10';
            // 만약 v가 32(0x20)이거나 문자열 "32", 50(0x32)인 경우 "20"으로 보정!
            if (v === 32 || v === '32' || v === 50 || v === '50') return '20';
            return typeof v === 'number' ? v.toString(16).padStart(2, '0').toUpperCase() : v.toString();
        };

        const getCellClass = (val, type) => {
            const hex = toHex(val);
            if (hex === '00') return 'cell-gray';
            
            if (type === 'car') {
                // 차량(V) 신호 매핑
                if (hex === '01' || hex === '04') return 'cell-green'; // 진행/좌회전 녹색
                if (hex === '02') return 'cell-yellow'; // 황색
                if (hex === '08') return 'cell-red'; // 적색
                if (hex === '20') return 'cell-yellow-flash'; // 차량 황색점멸 (20)
                if (hex === '10') return 'cell-red-flash'; // 차량 적색점멸 (10)
            } else {
                // 보행(P) 신호 매핑
                if (hex === '01') return 'cell-green'; // 보행녹색
                if (hex === '08' || hex === '02') return 'cell-red'; // 보행적색
                if (hex === '05') return 'cell-flash'; // 보행점멸 (05 코드)
            }
            
            // Fallback bitmask
            const num = parseInt(hex, 16);
            if (num & 0x55) return 'cell-green';
            if (num & 0xAA) return 'cell-yellow';
            return 'cell-red';
        };

        steps.forEach(step => {
            let isEOP = step.eop === 1;
            let eopClass = isEOP ? 'cell-red' : '';
            let eopText = isEOP ? 'Y' : '';
            
            bodyHTML += `<tr>
                <td style="font-weight:bold; background:rgba(0,0,0,0.2);">${step.stepNo}</td>`;
            
            for (let i = 1; i <= 8; i++) {
                const carVal = step[`car${i}`];
                const pedVal = step[`ped${i}`];
                bodyHTML += `<td class="${getCellClass(carVal, 'car')}">${toHex(carVal)}</td>`;
                bodyHTML += `<td class="${getCellClass(pedVal, 'ped')}">${toHex(pedVal)}</td>`;
            }

            bodyHTML += `
                <td style="background:rgba(0,0,0,0.2);">${step.minTm}</td>
                <td style="background:rgba(0,0,0,0.2);">${step.maxTm}</td>
                <td class="${eopClass}">${eopText}</td>
            </tr>`;
        });

        tbody.innerHTML = bodyHTML;
    };

    if (!currentSigMapData || (!currentSigMapData.ringA?.length && !currentSigMapData.ringB?.length)) {
        document.getElementById('sigmap-table-head-a').innerHTML = '';
        document.getElementById('sigmap-table-body-a').innerHTML = '<tr><td style="padding:20px; text-align:center; color: #f59e0b;">현재 이 교차로의 시그널맵 데이터가 수신되지 않았거나 처리 중입니다.</td></tr>';
        document.getElementById('sigmap-table-head-b').innerHTML = '';
        document.getElementById('sigmap-table-body-b').innerHTML = '';
        return;
    }

    renderTable('sigmap-table-head-a', 'sigmap-table-body-a', currentSigMapData.ringA, 'A-RING');
    renderTable('sigmap-table-head-b', 'sigmap-table-body-b', currentSigMapData.ringB, 'B-RING');
}

function parseSigMapXml(xmlString, targetId) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, "text/xml");
    let items = xmlDoc.getElementsByTagName("SigMapCRInfo");
    if (items.length === 0) items = xmlDoc.getElementsByTagName("item");
    
    console.log("SigMap XML parsing, items found:", items.length);
    