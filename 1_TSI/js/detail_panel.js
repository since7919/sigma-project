
class DetailPanel {
    constructor(slot, item) {
        this.slot = slot;
        this.item = item;
        this.detailMap = null;
        this.detailUpdateTimer = null;
        this.detailMarkers = {};
        this.currentCropData = null;
        this.currentSigMapData = { ringA: [], ringB: [] };
        
        this.init();
    }
    
    $(id) {
        return document.getElementById(id + '-' + this.slot);
    }
    
    destroy() {
        if (this.detailUpdateTimer) clearInterval(this.detailUpdateTimer);
        if (this.detailMap) {
            this.detailMap.remove();
            this.detailMap = null;
        }
        this.detailMarkers = {};
    }

    init() {
        const item = this.item;
        
        // 기본 정보 세팅
        if(this.$('detail-itst-name')) this.$('detail-itst-name').textContent = item.itstNm;
        let displayRegion = REGIONS.find(r => r.code === currentRegionCode)?.name;
        if (!displayRegion && typeof currentSeoulGuCode !== 'undefined' && currentSeoulGuCode) {
            displayRegion = `서울시 ${SEOUL_DISTRICTS[currentSeoulGuCode] || ''}`;
        }
        if(this.$('f-val-region')) this.$('f-val-region').textContent = displayRegion || '서울시';
        if(this.$('detail-region-label')) this.$('detail-region-label').textContent = `[${this.$('f-val-region').textContent}]`;

        const btnDownloadPlan = this.$('btn-download-plan');
        if (btnDownloadPlan) {
            btnDownloadPlan.onclick = () => this.downloadPlanData();
        }

        // 미니맵 초기화
        setTimeout(() => {
            if (this.detailMap) {
                this.detailMap.remove();
            }
            this.detailMap = L.map('detail-map-' + this.slot, {
                zoomControl: false,
                attributionControl: false,
                dragging: false,
                touchZoom: false,
                doubleClickZoom: false,
                scrollWheelZoom: false,
                boxZoom: false,
                keyboard: false
            }).setView([item.la, item.lo], 18); // Set a fixed detailed scale

            const googleSat = L.tileLayer('https://mt0.google.com/vt/lyrs=s&hl=ko&x={x}&y={y}&z={z}', {
                maxZoom: 22,
                maxNativeZoom: 20
            });
            googleSat.addTo(this.detailMap);
            
            // 전역 markers 배열을 통해 모든 교차로 마커 표시
            if (window.markers && window.markers.length > 0) {
                window.markers.forEach(m => {
                    const it = m.options.item;
                    if (!it) return;
                    
                    const isCurrent = it.itstId === item.itstId;
                    if (!isCurrent) return; // 선택된 교차로 외의 노드는 표시하지 않음
                    
                    let statInfo = null;
                    if (window.getIntersectionStatusAndColor) {
                        statInfo = window.getIntersectionStatusAndColor(it.itstId, it.isSeoul);
                    }
                    
                    const fillColor = isCurrent ? "#38bdf8" : (statInfo ? statInfo.style.fillColor : "#475569");
                    const color = isCurrent ? "#fff" : (statInfo ? statInfo.style.color : "#1e293b");
                    const weight = isCurrent ? 3 : (statInfo ? statInfo.style.weight : 2);
                    const fillOpacity = isCurrent ? 0.8 : (statInfo ? statInfo.style.fillOpacity : 0.6);

                    const marker = L.circleMarker([it.la, it.lo], {
                        radius: isCurrent ? 12 : 7,
                        fillColor: fillColor,
                        color: color,
                        weight: weight,
                        fillOpacity: fillOpacity
                    }).addTo(this.detailMap);
                    
                    if (!isCurrent) {
                        marker.bindTooltip(it.itstNm, { 
                            permanent: false, 
                            direction: 'top', 
                            offset: [0, -7],
                            className: 'detail-map-label'
                        });
                    }

                    if (!isCurrent) {
                        marker.on('click', () => {
                            if (window.openDetailOverlay) {
                                window.openDetailOverlay(it);
                            }
                        });
                    }
                });
            } else {
                const marker = L.circleMarker([item.la, item.lo], {
                    radius: 12,
                    fillColor: "#38bdf8",
                    color: "#fff",
                    weight: 3,
                    fillOpacity: 0.8
                }).addTo(this.detailMap);

                // 현재 교차로 중앙 라벨 생략 (신호등 UI 가림 방지)
            }

            const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
            let html = `<div id="compass-${this.slot}" class="compass-center-overlay compass-slot-${this.slot}" style="transform: scale(1.5); transform-origin: center;">`;
            directions.forEach(dir => {
                html += `
                    <div class="signal-slot slot-${dir}" id="slot-${this.slot}-${dir}">
                        <div class="signal-mount-frame">
                            <!-- 차량등 컴포넌트 -->
                            <div class="component-block" id="veh-block-${this.slot}-${dir}">
                                <div class="car-housing-box">
                                    <div class="lens c-red" id="cr-${this.slot}-${dir}"></div>
                                    <div class="lens c-yellow" id="cy-${this.slot}-${dir}"></div>
                                    <div class="lens c-arrow" id="ca-${this.slot}-${dir}"></div>
                                    <div class="lens c-green" id="cg-${this.slot}-${dir}"></div>
                                </div>
                                <div class="micro-timer car-timer" id="tc-${this.slot}-${dir}">-</div>
                            </div>
                        </div>
                        <!-- 보행등 컨테이너 (-45도 시각적 회전) -->
                        <div class="ped-mount-container">
                            <div class="ped-mount-frame" id="ped-block-${this.slot}-${dir}">
                                <div class="ped-housing-box">
                                    <div class="ped-lens p-red" id="pr-${this.slot}-${dir}"></div>
                                    <div class="ped-lens p-green" id="pg-${this.slot}-${dir}"></div>
                                </div>
                                <div class="micro-timer ped-timer" id="tp-${this.slot}-${dir}">-</div>
                            </div>
                        </div>
                    </div>`;
            });
            html += `</div>`;

            if (this.compassMarker) {
                this.detailMap.removeLayer(this.compassMarker);
            }
            
            const compassIcon = L.divIcon({
                html: html,
                className: '',
                iconSize: [155, 155], 
                iconAnchor: [77.5, 77.5] 
            });

            this.compassMarker = L.marker([item.la, item.lo], { 
                icon: compassIcon,
                zIndexOffset: 1000,
                interactive: false // 마우스 이벤트 통과
            }).addTo(this.detailMap);
            
        }, 100);

        this.startDetailRealtimeUpdate();
        this.fetchPlanCROP(item.itstId, item.itstNm);
        this.fetchSigMapCRInfo(item.itstId, item.itstNm);
    }
    
    parsePhaseCode(code) {
        if (!code) return null;
        const typeChar = code.charAt(0).toUpperCase();
        let typeName = '미지정';
        if (typeChar === 'S') typeName = '직진(1)';
        else if (typeChar === 'L') typeName = '좌회전(2)';
        else if (typeChar === 'P') typeName = '보행(3)';
        else return null;

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

    getRealtimeSignalState() {
        if (!this.currentCropData || !this.currentCropData.cycle) return null;
        const cycle = parseInt(this.currentCropData.cycle);
        const offset = parseInt(this.currentCropData.offset || 0);
        const now = new Date();
        const kstNow = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Seoul"}));
        const midnight = new Date(kstNow.getFullYear(), kstNow.getMonth(), kstNow.getDate());
        const secondsSinceMidnight = Math.floor((kstNow.getTime() - midnight.getTime()) / 1000);
        
        const timeInCycle = (secondsSinceMidnight - offset + cycle) % cycle;

        const calcRingState = (ringPrefix) => {
            let cumulativeTime = 0;
            let currentPhaseIdx = 1;
            let remainingTime = 0;
            for (let i = 1; i <= 8; i++) {
                const split = this.currentCropData[`${ringPrefix}_${i}_PHASE_VAL`] || 0;
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

    downloadPlanData() {
        if (!this.currentCropData && (!this.currentSigMapData || (this.currentSigMapData.ringA.length === 0 && this.currentSigMapData.ringB.length === 0))) {
            alert('다운로드할 신호 계획정보가 없습니다.');
            return;
        }
        
        const data = {
            intersectionInfo: this.item,
            timestamp: new Date().toISOString(),
            todPlan: this.currentCropData || null,
            signalMap: this.currentSigMapData || null
        };
        
        const jsonStr = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonStr], {type: "application/json"});
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `SIGMA_Plan_${this.item.itstNm}_${this.item.itstId}_${new Date().getTime()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    calculateActualSignalStatus(phases) {
        const state = this.getRealtimeSignalState();
        if (!state) {
            return phases.map(p => ({
                ...p,
                isGreen: false,
                remaining: 0,
                statusText: 'none',
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
                pedestrian: pedestrianVal,
                statusText: statusText,
                statusClass: statusClass
            };
        });
    }

    startDetailRealtimeUpdate() {
        if (this.detailUpdateTimer) clearInterval(this.detailUpdateTimer);

        let phases = [];
        let isSeoulData = !!this.item.isSeoul;

        if (typeof L02_DETAIL_DATA !== 'undefined' && !isSeoulData) {
            const conf = L02_DETAIL_DATA.find(d => d.INT_NO == this.item.itstId);
            if (conf) {
                phases = [1, 2, 3, 4, 5, 6, 7, 8].reduce((acc, idx) => {
                    const aPhase = this.parsePhaseCode(conf[`A_RING_${idx}_PHASE_CONF_CD`]);
                    const bPhase = this.parsePhaseCode(conf[`B_RING_${idx}_PHASE_CONF_CD`]);
                    if (aPhase) acc.push({ ...aPhase, ring: 'A', idx });
                    if (bPhase) acc.push({ ...bPhase, ring: 'B', idx });
                    return acc;
                }, []);
            }
        }

        if (isSeoulData && phases.length === 0) {
            const mockConf = {
                'A_RING_1_PHASE_CONF_CD': 'S0000300', // 북향 직진
                'A_RING_2_PHASE_CONF_CD': 'L0450200', // 북동향 좌회전
                'A_RING_3_PHASE_CONF_CD': 'S1800300', // 남향 직진
                'A_RING_4_PHASE_CONF_CD': 'L2250200', // 남서향 좌회전
                'A_RING_5_PHASE_CONF_CD': 'P0000200', // 북향 보행
                'B_RING_5_PHASE_CONF_CD': 'P0900200', // 동향 보행
            };
            
            phases = [1, 2, 3, 4, 5, 6, 7, 8].reduce((acc, idx) => {
                const aPhase = this.parsePhaseCode(mockConf[`A_RING_${idx}_PHASE_CONF_CD`]);
                const bPhase = this.parsePhaseCode(mockConf[`B_RING_${idx}_PHASE_CONF_CD`]);
                if (aPhase) acc.push({ ...aPhase, ring: 'A', idx });
                if (bPhase) acc.push({ ...bPhase, ring: 'B', idx });
                return acc;
            }, []);
        }

        const update = () => {
            const tableBody = this.$('detail-signal-body');
            if(!tableBody) return;
            
            // Update manual status badge in map overlay
            if (window.getIntersectionStatusAndColor) {
                const statInfo = window.getIntersectionStatusAndColor(this.item.itstId, this.item.isSeoul);
                const badgeEl = document.getElementById('manual-status-badge-' + this.slot);
                if (badgeEl) {
                    if (isSeoulData) {
                        const hasData = window.SEOUL_SPAT_MAP && window.SEOUL_SPAT_MAP[this.item.itstId];
                        const valueEl = badgeEl.querySelector('.status-value');
                        const iconEl = badgeEl.querySelector('.status-icon');
                        if (valueEl) {
                            valueEl.textContent = hasData ? '실시간 연동 중' : 'API 연동 대기 중';
                            valueEl.style.color = hasData ? '#10b981' : '#94a3b8';
                            valueEl.style.textShadow = hasData ? '0 0 10px #10b981' : '0 0 10px #94a3b8';
                        }
                        if (iconEl) iconEl.textContent = hasData ? '📡' : '⏳';
                        badgeEl.style.display = 'flex';
                    } else {
                        const isManual = statInfo.opMode === '수동' || statInfo.statusText === '수동' || statInfo.manual === 'ON';
                        const valueEl = badgeEl.querySelector('.status-value');
                        const iconEl = badgeEl.querySelector('.status-icon');
                        if (isManual) {
                            if (valueEl) {
                                valueEl.textContent = '수동 제어';
                                valueEl.style.color = '#06b6d4';
                                valueEl.style.textShadow = '0 0 10px #06b6d4';
                            }
                            if (iconEl) iconEl.textContent = '🕹️';
                        } else {
                            if (valueEl) {
                                valueEl.textContent = '일반 제어 (TOD)';
                                valueEl.style.color = '#10b981';
                                valueEl.style.textShadow = '0 0 10px #10b981';
                            }
                            if (iconEl) iconEl.textContent = '🚦';
                        }
                    }
                }
            }

            // Update header status dot and region text
            const dot = document.querySelector(`#detail-container-${this.slot} .detail-header .status-dot`);
            if (dot) {
                if (isSeoulData) {
                    dot.className = 'status-dot'; // remove online/offline class
                    dot.style.backgroundColor = '#64748b';
                    dot.style.boxShadow = '0 0 8px #64748b';
                } else {
                    dot.className = 'status-dot online';
                    dot.style.backgroundColor = '';
                    dot.style.boxShadow = '';
                }
            }
            
            if (this.currentCropData && !isSeoulData) {
                if(this.$('f-val-cycle')) this.$('f-val-cycle').textContent = this.currentCropData.cycle + '초';
                const offsetEl = this.$('f-val-offset');
                if (offsetEl) offsetEl.textContent = (this.currentCropData.offset || 0) + '초';
                
                const container = document.getElementById('detail-container-' + this.slot);
                if(container) {
                    container.querySelectorAll('.footer-content .val-normal').forEach(el => {
                        el.textContent = '정상';
                        el.style.color = '#10b981';
                    });
                }
            } else {
                if(this.$('f-val-cycle')) this.$('f-val-cycle').textContent = '미연동';
                if(this.$('f-val-offset')) this.$('f-val-offset').textContent = '-';
                const container = document.getElementById('detail-container-' + this.slot);
                if(container) {
                    container.querySelectorAll('.footer-content .val-normal').forEach(el => {
                        el.textContent = isSeoulData ? '대기 중' : '미수신';
                        el.style.color = '#94a3b8';
                    });
                }
            }

            if (this.currentCropData && !isSeoulData) {
                const now = new Date();
                if(this.$('f-val-time')) this.$('f-val-time').textContent = now.getFullYear() + '-' + 
                    String(now.getMonth()+1).padStart(2,'0') + '-' + 
                    String(now.getDate()).padStart(2,'0') + ' ' + 
                    now.toLocaleTimeString('ko-KR', {hour12:false});
            } else if (isSeoulData && window.SEOUL_SPAT_LAST_UPDATE && window.SEOUL_SPAT_MAP && window.SEOUL_SPAT_MAP[this.item.itstId]) {
                const upd = window.SEOUL_SPAT_LAST_UPDATE;
                if(this.$('f-val-time')) this.$('f-val-time').textContent = upd.getFullYear() + '-' + 
                    String(upd.getMonth()+1).padStart(2,'0') + '-' + 
                    String(upd.getDate()).padStart(2,'0') + ' ' + 
                    upd.toLocaleTimeString('ko-KR', {hour12:false});
            } else {
                if(this.$('f-val-time')) this.$('f-val-time').textContent = '-';
            }

            let updatedPhases = [];
            if (isSeoulData) {
                let spat = window.SEOUL_SPAT_MAP && window.SEOUL_SPAT_MAP[this.item.itstId];
                updatedPhases = phases.map(p => {
                    let pfx = '';
                    if (p.angle === 0) pfx = 'nt';
                    else if (p.angle === 45) pfx = 'ne';
                    else if (p.angle === 90) pfx = 'et';
                    else if (p.angle === 135) pfx = 'se';
                    else if (p.angle === 180) pfx = 'st';
                    else if (p.angle === 225) pfx = 'sw';
                    else if (p.angle === 270) pfx = 'wt';
                    else if (p.angle === 315) pfx = 'nw';
                    
                    let isGreen = false;
                    let statText = spat ? '소등' : '대기 중';
                    let statClass = 'sig-status-gray';
                    
                    if (spat && pfx) {
                        // 보행신호등은 차량진행 방향의 우측(시계방향 +90도)에 위치
                        let pedPfxMap = { 'nt': 'wt', 'ne': 'nw', 'et': 'nt', 'se': 'ne', 'st': 'et', 'sw': 'se', 'wt': 'st', 'nw': 'sw' };
                        let field = pfx + 'StsgStatNm';
                        if (p.type === 'L') field = pfx + 'LtsgStatNm';
                        if (p.type === 'P') field = pedPfxMap[pfx] + 'PdsgStatNm';
                        const val = spat[field];
                        
                        if (val === 'protected-Movement-Allowed' || val === 'permissive-Movement-Allowed') {
                            isGreen = true;
                            statText = '진행';
                            statClass = 'sig-status-green';
                        } else if (val === 'stop-And-Remain') {
                            statText = '정지';
                            statClass = 'sig-status-red';
                        } else if (val === 'protected-clearance' || val === 'permissive-clearance') {
                            statText = '주의';
                            statClass = 'sig-status-yellow';
                        }
                    }
                    
                    return {
                        ...p,
                        isGreen: isGreen,
                        remaining: '-',
                        pedestrian: '-',
                        bankCode: '-',
                        statusText: statText,
                        statusClass: statClass
                    };
                });
            } else {
                updatedPhases = this.calculateActualSignalStatus(phases);
            }
            
            // 방향(angle) 순 정렬 후 직진(S) -> 좌회전(L) -> 보행(P) 순 정렬
            updatedPhases.sort((a, b) => {
                if (a.angle !== b.angle) return a.angle - b.angle;
                const typeWeight = { 'S': 1, 'L': 2, 'P': 3 };
                const weightA = typeWeight[a.type] || 4;
                const weightB = typeWeight[b.type] || 4;
                return weightA - weightB;
            });
            
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

            // Also update markers
            const state = isSeoulData ? null : this.getRealtimeSignalState();
            const phaseA = state ? state.currentPhaseA : 0;
            const phaseB = state ? state.currentPhaseB : 0;
            const directions = [0, 45, 90, 135, 180, 225, 270, 315];
            const directionNames = { 0: '북', 45: '북동', 90: '동', 135: '남동', 180: '남', 225: '남서', 270: '서', 315: '북서' };

            let sPhaseMap = {}, lPhaseMap = {}, pPhaseMap = {};
            if (typeof L02_DETAIL_DATA !== 'undefined' && this.item.itstId && !isSeoulData) {
                const conf = L02_DETAIL_DATA.find(d => d.INT_NO == this.item.itstId);
                if (conf) {
                    for (let i = 1; i <= 8; i++) {
                        ['A', 'B'].forEach(ring => {
                            const parsed = this.parsePhaseCode(conf[`${ring}_RING_${i}_PHASE_CONF_CD`]);
                            if (parsed) {
                                if (parsed.type === 'S') sPhaseMap[parsed.angle] = { ring, idx: i };
                                else if (parsed.type === 'L') lPhaseMap[parsed.angle] = { ring, idx: i };
                                else if (parsed.type === 'P') pPhaseMap[parsed.angle] = { ring, idx: i };
                            }
                        });
                    }
                }
            }
            
            const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
            const dirMap = { 'N': 0, 'NE': 45, 'E': 90, 'SE': 135, 'S': 180, 'SW': 225, 'W': 270, 'NW': 315 };
            
            const hasConf = Object.keys(sPhaseMap).length > 0;
            dirs.forEach((dir) => {
                const deg = dirMap[dir];
                
                const cr = document.getElementById(`cr-${this.slot}-${dir}`);
                const cy = document.getElementById(`cy-${this.slot}-${dir}`);
                const ca = document.getElementById(`ca-${this.slot}-${dir}`);
                const cg = document.getElementById(`cg-${this.slot}-${dir}`);
                const pr = document.getElementById(`pr-${this.slot}-${dir}`);
                const pg = document.getElementById(`pg-${this.slot}-${dir}`);
                const tc = document.getElementById(`tc-${this.slot}-${dir}`);
                const tp = document.getElementById(`tp-${this.slot}-${dir}`);

                if (!cr || !cy || !ca || !cg || !pr || !pg) return;

                cr.classList.remove('on'); cy.classList.remove('on'); ca.classList.remove('on'); cg.classList.remove('on');
                pr.classList.remove('on'); pg.classList.remove('on');
                if (tc) tc.innerText = '-';
                if (tp) tp.innerText = '-';
                
                if (isSeoulData) {
                    let spat = window.SEOUL_SPAT_MAP && window.SEOUL_SPAT_MAP[this.item.itstId];
                    if (spat) {
                        const prefixMap = { 'N': 'nt', 'NE': 'ne', 'E': 'et', 'SE': 'se', 'S': 'st', 'SW': 'sw', 'W': 'wt', 'NW': 'nw' };
                        const pfx = prefixMap[dir];
                        
                        const stsg = spat[pfx + 'StsgStatNm']; // 직진
                        const ltsg = spat[pfx + 'LtsgStatNm']; // 좌회전
                        const pdsg = spat[pfx + 'PdsgStatNm']; // 보행
                        
                        // 데이터 유무에 따른 개별 컴포넌트 숨김 처리
                        const vehBlock = document.getElementById(`veh-block-${this.slot}-${dir}`);
                        const pedBlock = document.getElementById(`ped-block-${this.slot}-${dir}`);
                        const slotEl = document.getElementById(`slot-${this.slot}-${dir}`);
                        
                        const vehHasData = !!(stsg || ltsg);
                        // 보행 데이터가 없더라도 해당 방향의 직진 차량 신호가 존재하면 보행등 UI(껍데기) 표출
                        const pedHasData = !!(pdsg || spat[pfx + 'StsgStatNm']);
                        
                        if (vehBlock) vehBlock.style.display = vehHasData ? '' : 'none';
                        if (pedBlock) pedBlock.style.display = pedHasData ? '' : 'none';
                        if (slotEl) slotEl.style.display = (vehHasData || pedHasData) ? '' : 'none';
                        
                        let stOn = false, ltOn = false;
                        
                        if (stsg === 'protected-Movement-Allowed' || stsg === 'permissive-Movement-Allowed') {
                            cg.classList.add('on'); stOn = true;
                        }
                        if (stsg === 'protected-clearance' || stsg === 'permissive-clearance') {
                            cy.classList.add('on'); stOn = true;
                        }
                        
                        if (ltsg === 'protected-Movement-Allowed') {
                            ca.classList.add('on'); ltOn = true;
                        }
                        if (ltsg === 'protected-clearance') {
                            cy.classList.add('on'); ltOn = true;
                        }
                        
                        if (!stOn && !ltOn && (stsg === 'stop-And-Remain' || ltsg === 'stop-And-Remain')) {
                            cr.classList.add('on');
                        }
                        
                        if (pdsg === 'protected-Movement-Allowed' || pdsg === 'permissive-Movement-Allowed') {
                            pg.classList.add('on');
                        } else if (pdsg === 'stop-And-Remain' || pdsg === 'protected-clearance') {
                            pr.classList.add('on');
                        }
                    }
                } else {
                    let s = 'off', l = 'off', p = 'off';
                    let countdown = 0;
                    
                    // UTIC 데이터 유무에 따른 개별 컴포넌트 숨김 처리
                    const vehBlock = document.getElementById(`veh-block-${this.slot}-${dir}`);
                    const pedBlock = document.getElementById(`ped-block-${this.slot}-${dir}`);
                    const slotEl = document.getElementById(`slot-${this.slot}-${dir}`);
                    
                    const vehHasData = hasConf && (sPhaseMap[deg] || lPhaseMap[deg]);
                    // 보행 데이터가 없더라도 해당 방향의 직진 차량 신호가 존재하면 보행등 UI 표출
                    const pedHasData = hasConf && (pPhaseMap[deg] || sPhaseMap[deg]);
                    
                    if (vehBlock) vehBlock.style.display = vehHasData ? '' : 'none';
                    if (pedBlock) pedBlock.style.display = pedHasData ? '' : 'none';
                    if (slotEl) slotEl.style.display = (vehHasData || pedHasData) ? '' : 'none';
                    
                    if (hasConf && state) {
                        const checkActive = (map) => {
                            const conf = map[deg];
                            if (!conf) return false;
                            return conf.ring === 'A' ? (conf.idx === phaseA) : (conf.idx === phaseB);
                        };
                        const getCountdown = (map) => {
                            const conf = map[deg];
                            if (!conf) return 0;
                            return conf.ring === 'A' ? state.remainingTimeA : state.remainingTimeB;
                        };
                        
                        if (checkActive(sPhaseMap)) { s = 'green'; countdown = Math.max(countdown, getCountdown(sPhaseMap)); }
                        if (checkActive(lPhaseMap)) { l = 'green'; countdown = Math.max(countdown, getCountdown(lPhaseMap)); }
                        if (checkActive(pPhaseMap)) { p = 'green'; countdown = Math.max(countdown, getCountdown(pPhaseMap)); }
                        else if (checkActive(sPhaseMap) && !pPhaseMap[deg]) { p = 'green'; }
                    }

                    if (s === 'green' && countdown <= 3) s = 'yellow';
                    if (l === 'green' && countdown <= 3) l = 'yellow';
                    if (p === 'green' && countdown <= 7) p = 'flash';

                    let activeCount = 0;
                    if (s === 'green') { cg.classList.add('on'); activeCount++; }
                    else if (s === 'yellow') { cy.classList.add('on'); activeCount++; }

                    if (l === 'green') { ca.classList.add('on'); activeCount++; }
                    else if (l === 'yellow') { cy.classList.add('on'); activeCount++; }
                    
                    if (activeCount === 0 && (hasConf && (sPhaseMap[deg] || lPhaseMap[deg]))) {
                        cr.classList.add('on');
                    }
                    
                    if (p === 'green') pg.classList.add('on');
                    else if (hasConf && pPhaseMap[deg]) pr.classList.add('on');
                    
                    if (countdown > 0) {
                        if (tc && (s !== 'off' || l !== 'off')) tc.innerText = countdown + 's';
                        if (tp && p !== 'off') tp.innerText = countdown + 's';
                    }
                }
            });
        };

        update();
        this.detailUpdateTimer = setInterval(update, 1000);
    }

    async fetchPlanCROP(itstId, itstNm) {
        let isSeoulData = !!this.item.isSeoul;
        
        if (isSeoulData) {
            this.currentCropData = null; // No mock CROP data for Seoul
            return;
        }

        try {
            const targetUrl = `${API_CONFIG.cropUrl}?type=xml&srchCTId=${currentRegionCode}&srchCRNm=${encodeURIComponent(itstNm)}&pageNo=1&numOfRows=10`;
            const response = await window.fetchData(targetUrl);
            if (!response.ok) throw new Error('Network response not ok');
            const text = await response.text();
            
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(text, "text/xml");
            let items = xmlDoc.getElementsByTagName("PlanCROPInfo");
            if (items.length === 0) items = xmlDoc.getElementsByTagName("item");
            
            let data = null;
            for (let item of items) {
                const intNo = item.getElementsByTagName("INT_NO")[0]?.textContent;
                if (intNo === itstId) {
                    data = {
                        planNo: item.getElementsByTagName("INT_PLAN_NO")[0]?.textContent,
                        cycle: item.getElementsByTagName("INT_OPER_CYCLE_VAL")[0]?.textContent,
                        offset: item.getElementsByTagName("INT_OPER_OFFSET_VAL")[0]?.textContent,
                    };
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
                    break;
                }
            }
            if (data) this.currentCropData = data;
            else throw new Error('Parsed crop data is null');
        } catch (error) {
            console.error('CROP Fetch Error for slot ' + this.slot + ':', error);
            this.currentCropData = null; // Do not generate mock data if API is disconnected
        }
    }

    async fetchSigMapCRInfo(itstId, itstNm) {
        let isSeoulData = !!this.item.isSeoul;
        
        if (isSeoulData) {
            this.currentSigMapData = { ringA: [], ringB: [] }; // No mock SigMap
            this.renderSigMapTable();
            return;
        }

        try {
            const targetUrl = `${API_CONFIG.sigMapUrl}?type=xml&srchCTId=${currentRegionCode}&srchCRNm=${encodeURIComponent(itstNm)}&pageNo=1&numOfRows=100`;
            const response = await window.fetchData(targetUrl);
            if (!response.ok) throw new Error('Network response not ok');
            const text = await response.text();
            
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(text, "text/xml");
            let items = xmlDoc.getElementsByTagName("SigMapCRInfo");
            if (items.length === 0) items = xmlDoc.getElementsByTagName("item");

            const ringA = [];
            const ringB = [];
            for (let item of items) {
                const intNo = item.getElementsByTagName("INT_NO")[0]?.textContent;
                if (intNo === itstId) {
                    const ringNo = parseInt(item.getElementsByTagName("RING_NO")[0]?.textContent || 0, 10);
                    const step = {
                        stepNo: parseInt(item.getElementsByTagName("STEP_NO")[0]?.textContent || 0, 10),
                        minTm: parseInt(item.getElementsByTagName("MIN_TM")[0]?.textContent || 0, 10),
                        maxTm: parseInt(item.getElementsByTagName("MAX_TM")[0]?.textContent || 0, 10),
                        eop: parseInt(item.getElementsByTagName("EOP")[0]?.textContent || 0, 10),
                    };
                    for (let i = 1; i <= 8; i++) {
                        step[`car${i}`] = parseInt(item.getElementsByTagName(`CAR${i}`)[0]?.textContent || 0, 10);
                        step[`ped${i}`] = parseInt(item.getElementsByTagName(`PED${i}`)[0]?.textContent || 0, 10);
                    }
                    if (ringNo === 1) ringA.push(step);
                    else if (ringNo === 2) ringB.push(step);
                }
            }
            ringA.sort((a, b) => a.stepNo - b.stepNo);
            ringB.sort((a, b) => a.stepNo - b.stepNo);

            if (ringA.length > 0 || ringB.length > 0) {
                this.currentSigMapData = { ringA, ringB };
                this.renderSigMapTable();
            } else throw new Error('Parsed sigmap data is empty');
        } catch (error) {
            console.error('SigMap Fetch Error for slot ' + this.slot + ':', error);
            if (typeof L02_DETAIL_DATA !== 'undefined') {
                const conf = L02_DETAIL_DATA.find(d => d.INT_NO == itstId);
                if (conf) {
                    const stepsA = []; const stepsB = [];
                    let stepNoA = 1; let stepNoB = 1;
                    for (let i = 1; i <= 8; i++) {
                        const aCode = conf[`A_RING_${i}_PHASE_CONF_CD`];
                        const bCode = conf[`B_RING_${i}_PHASE_CONF_CD`];
                        if (aCode) {
                            const parsed = this.parsePhaseCode(aCode);
                            const step = { stepNo: stepNoA++, minTm: 10, maxTm: 30, eop: 1 };
                            for (let k = 1; k <= 8; k++) { step[`car${k}`] = 8; step[`ped${k}`] = 8; }
                            if (parsed.type === 'S') step[`car${i}`] = 1;
                            else if (parsed.type === 'L') step[`car${i}`] = 4;
                            else if (parsed.type === 'P') step[`ped${i}`] = 16;
                            stepsA.push(step);
                        }
                        if (bCode) {
                            const parsed = this.parsePhaseCode(bCode);
                            const step = { stepNo: stepNoB++, minTm: 10, maxTm: 30, eop: 1 };
                            for (let k = 1; k <= 8; k++) { step[`car${k}`] = 8; step[`ped${k}`] = 8; }
                            if (parsed.type === 'S') step[`car${i}`] = 1;
                            else if (parsed.type === 'L') step[`car${i}`] = 4;
                            else if (parsed.type === 'P') step[`ped${i}`] = 16;
                            stepsB.push(step);
                        }
                    }
                    this.currentSigMapData = { ringA: stepsA, ringB: stepsB };
                    this.renderSigMapTable();
                }
            }
        }
    }

    renderSigMapTable() {
        const renderTable = (theadId, tbodyId, steps, ringName) => {
            const thead = this.$(theadId);
            const tbody = this.$(tbodyId);
            if (!thead || !tbody) return;

            if (!steps || steps.length === 0) {
                thead.innerHTML = '';
                tbody.innerHTML = `<tr><td style="padding:20px; text-align:center; color: #94a3b8;">${ringName} 데이터 없음</td></tr>`;
                return;
            }

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

            let bodyHTML = '';
            const toHex = (v) => {
                if (v === 0 || v === '0' || !v) return '00';
                if (v === 16 || v === '16' || v === 22 || v === '22') return '10';
                if (v === 32 || v === '32' || v === 50 || v === '50') return '20';
                return typeof v === 'number' ? v.toString(16).padStart(2, '0').toUpperCase() : v.toString();
            };

            const getCellClass = (val, type) => {
                const hex = toHex(val);
                if (hex === '00') return 'cell-gray';
                if (type === 'car') {
                    if (hex === '01' || hex === '04') return 'cell-green';
                    if (hex === '02') return 'cell-yellow';
                    if (hex === '08') return 'cell-red';
                    if (hex === '20') return 'cell-yellow-flash';
                    if (hex === '10') return 'cell-red-flash';
                } else {
                    if (hex === '01') return 'cell-green';
                    if (hex === '08' || hex === '02') return 'cell-red';
                    if (hex === '05') return 'cell-flash';
                }
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

        if (!this.currentSigMapData || (!this.currentSigMapData.ringA?.length && !this.currentSigMapData.ringB?.length)) {
            if(this.$('sigmap-table-head-a')) this.$('sigmap-table-head-a').innerHTML = '';
            if(this.$('sigmap-table-body-a')) this.$('sigmap-table-body-a').innerHTML = '<tr><td style="padding:20px; text-align:center; color: #f59e0b;">현재 이 교차로의 시그널맵 데이터가 수신되지 않았거나 처리 중입니다.</td></tr>';
            if(this.$('sigmap-table-head-b')) this.$('sigmap-table-head-b').innerHTML = '';
            if(this.$('sigmap-table-body-b')) this.$('sigmap-table-body-b').innerHTML = '';
            return;
        }

        renderTable('sigmap-table-head-a', 'sigmap-table-body-a', this.currentSigMapData.ringA, 'A-RING');
        renderTable('sigmap-table-head-b', 'sigmap-table-body-b', this.currentSigMapData.ringB, 'B-RING');
    }
}

window.DetailPanel = DetailPanel;
