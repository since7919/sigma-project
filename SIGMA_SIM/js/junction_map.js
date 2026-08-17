/* SIGMA_SIM Junction Map & Rendering Functions */

function drawJunction(jid, onlyStyle) {
    onlyStyle = onlyStyle || false;
    const j = STATE.junctions[jid];
    if (!j) return;

    const isSelected = (jid === STATE.activeJid);
    const isMultiSelected = STATE.selectedJids.includes(jid);
    const radius = (isMultiSelected ? 11 : 6) * STATE.nodeScale;
    const t = parseInt(UI.timeSlider?.value) || 25200;
    const currentViewDay = (jid === STATE.activeJid) ? STATE.currentJunctionDayTypeIdx : 0;
    const cycle = getCurrentOperatingCycle(j, t, currentViewDay);
    const color = STATE.showCycleColors ? getCycleColor(cycle) : (isSelected ? '#f1c40f' : (isMultiSelected ? '#00d4ff' : '#3498db'));

    // 스타일만 업데이트
    if (onlyStyle && j.marker) {
        if (j.marker.setStyle) {
            j.marker.setStyle({
                fillColor: color,
                color: isSelected ? '#f1c40f' : (isMultiSelected ? '#00d4ff' : 'rgba(255,255,255,0.3)'),
                weight: isMultiSelected ? 3 : 1,
                fillOpacity: isMultiSelected ? 0.9 : 0.6
            });
            j.marker.setRadius(radius);
        } else if (j.marker.getElement) {
            const inner = j.marker.getElement().querySelector('.junction-inner');
            if (inner) {
                inner.style.backgroundColor = color;
                inner.style.borderColor = isSelected ? '#f1c40f' : (isMultiSelected ? '#00d4ff' : 'transparent');
                inner.style.boxShadow = isMultiSelected ? `0 0 10px ${isSelected ? '#f1c40f' : '#00d4ff'}` : 'none';
            }
        }
        return;
    }

    if (j.marker) map.removeLayer(j.marker);

    if (isMultiSelected) {
        const size = radius * 2;
        const bColor = isSelected ? '#f1c40f' : '#00d4ff';
        const timerDisplay = STATE.showSignalArrows ? 'block' : 'none';
        const jIcon = L.divIcon({
            className: 'junction-icon selected',
            html: `<div class="junction-inner" style="background-color:${color}; width:${size}px; height:${size}px; border:3px solid ${bColor}; border-radius:50%; box-shadow: 0 0 10px ${bColor}; display:flex; align-items:center; justify-content:center;">
                    <div id="cycle-timer-${j.id}" style="display:${timerDisplay}; font-size:12px; font-weight:900; color:white; pointer-events:none; font-family:'Roboto Mono', monospace; text-shadow: 1px 1px 2px rgba(0,0,0,0.8);"></div>
                   </div>`,
            iconSize: [0, 0],
            iconAnchor: [0, 0]
        });
        j.marker = L.marker([j.lat, j.lng], { icon: jIcon, draggable: STATE.isMapEditMode, zIndexOffset: 2000 }).addTo(map);

        // SIGMA_API style popup
        j.marker.bindPopup(`
          <div class="popup-content">
            <h3>${j.name}</h3>
            <div style="display:flex; flex-direction:column; gap:5px; margin-top:10px;">
              <button class="btn-detail" onclick="STATE.activeJid='${jid}'; openDetailOverlay('${jid}'); map.closePopup();">상세보기</button>
            </div>
          </div>
        `, { className: 'custom-popup', closeButton: true });

        j.marker.on('drag', (e) => {
            const pos = e.target.getLatLng();
            j.lat = pos.lat; j.lng = pos.lng;
            document.getElementById('inp-lat').value = pos.lat.toFixed(9);
            document.getElementById('inp-lng').value = pos.lng.toFixed(9);
            updateArrowsPosition(jid);
        });
        j.marker.on('dragend', refreshVisibleArrows);
    } else {
        j.marker = L.circleMarker([j.lat, j.lng], {
            radius: radius,
            fillColor: color,
            color: '#fff',
            weight: 1,
            opacity: 1,
            fillOpacity: 0.9,
            className: 'junction-marker',
            pane: 'markerPane'
        }).addTo(map);
        
        // SIGMA_API style popup
        j.marker.bindPopup(`
          <div class="popup-content">
            <h3>${j.name}</h3>
            <div style="display:flex; flex-direction:column; gap:5px; margin-top:10px;">
              <button class="btn-detail" onclick="STATE.activeJid='${jid}'; openDetailOverlay('${jid}'); map.closePopup();">상세보기</button>
            </div>
          </div>
        `, { className: 'custom-popup', closeButton: true });
    }

    // 툴팁(이름 등) 표시
    refreshJunctionTooltip(jid);

    j.marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        // [복구] 편집 모드일 경우 RoadManager의 로직으로 즉시 전달 (안전장치)
        if (STATE.appMode === CONFIG.APP_MODE.NETWORK_EDIT && window.RoadManager) {
            window.RoadManager.handleNodeClick(j);
        } else {
            // [수정] 이미 선택된 경우라도 selectJunction을 다시 호출하여 UI와 민원 탭 상태가 항상 동기화되도록 함
            selectJunction(jid);
        }
    });
    j.marker.on('dblclick', (e) => {
        L.DomEvent.stopPropagation(e);
        selectJunction(jid);
    });
}

function createArrows(jid) {
    const j = STATE.junctions[jid];
    if (!j) return;
    const isEditing = (jid === STATE.activeJid && STATE.isMapEditMode);
    const defPosAngles = [90, 270, 180, 0, 270, 90, 0, 180, 45, 225, 135, 315, 225, 45, 315, 135];

    // ── [신규모드] 현재 인맥/상황에 맞는 시차맵(SignalMap) 데이터 추출 ──
    const t = parseInt(UI.timeSlider?.value) || 0;
    const isEditingMode = (jid === STATE.activeJid && STATE.isMapEditMode);
    const smIdx = isEditingMode ? (STATE.currentSignalMapIdx || 0) : getActiveSignalMapIdx(j, t);
    const sm = (j.signalMaps && j.signalMaps[smIdx]) ? j.signalMaps[smIdx] : {
        movA: j.movA || [0,0,0,0,0,0,0,0], movB: j.movB || [0,0,0,0,0,0,0,0],
        pedMovA: j.pedMovA || [0,0,0,0,0,0,0,0], pedMovB: j.pedMovB || [0,0,0,0,0,0,0,0]
    };

    const pMovA = sm.pedMovA || [0, 0, 0, 0, 0, 0, 0, 0];
    const pMovB = sm.pedMovB || [0, 0, 0, 0, 0, 0, 0, 0];
    const pedSet = new Set([...pMovA, ...pMovB].filter(x => x > 0));

    // [개량] 편집 모드에서는 데이터 유무와 상관없이 1~16(차량) 및 101~116(보행) 화살표를 전수 노출
    let allMovs;
    if (isEditingMode) {
        const vehicleRange = Array.from({ length: 16 }, (_, i) => i + 1); // 1-16
        const pedRange = Array.from({ length: 16 }, (_, i) => i + 101); // 101-116
        const configuredMovs = Object.keys(j.arrowConfigs || {}).map(Number);
        const mapMovs = [...(sm.movA || []), ...(sm.movB || []), ...pMovA, ...pMovB].map(Number);
        allMovs = [...new Set([...mapMovs, ...configuredMovs, ...vehicleRange, ...pedRange])].filter(m => m > 0);
    } else {
        // 일반 등화 모드: 무브먼트가 기록된(메모리 관리용) 화살표만 나타남
        const mapMovs = [...(sm.movA || []), ...(sm.movB || []), ...pMovA, ...pMovB].map(Number);
        allMovs = [...new Set(mapMovs)].filter(m => m > 0);
    }

    removeArrows(jid);
    j.arrows = {};

    if (!STATE.showSignalArrows && !isEditing) return;
    if (map.getZoom() < CONFIG.MIN_ZOOM_FOR_ARROWS && !isEditing) return;

    if (!j.arrowConfigs) j.arrowConfigs = {};

    allMovs.forEach(m => {
        const isPed = (m >= 101 && m <= 116) || pedSet.has(m);
        const arrowData = isPed ? { type: 'WALK', ang: 0 } : getVisualArrow(m);

        if (j.arrowConfigs[m] && !Array.isArray(j.arrowConfigs[m])) {
            j.arrowConfigs[m] = [j.arrowConfigs[m]];
        }
        const configs = j.arrowConfigs[m] || [];

        if (configs.length === 0) {
            let ang = 0;
            if (isPed && m > 100 && m <= 116) {
                // 보행신호(101~108...)는 대응하는 차량신호(1~8...)의 각도를 기준으로 배치
                const pedAngMap = { 102: 180, 104: 90, 106: 0, 108: 270, 110: 225, 112: 315, 114: 45, 116: 135 };
                if (pedAngMap[m] !== undefined) {
                    ang = pedAngMap[m];
                } else {
                    const pedAngMap = { 102: 180, 104: 90, 106: 0, 108: 270, 110: 225, 112: 315, 114: 45, 116: 135 };
                    if (pedAngMap[m] !== undefined) {
                        ang = pedAngMap[m];
                    } else {
                        const refM = m - 100;
                        ang = defPosAngles[(refM - 1) % 16] || 0;
                        if (refM % 2 !== 0) ang += 22;
                        else ang -= 22;
                    }
                }
            } else {
                ang = defPosAngles[(m - 1) % 16] || 0;
                // 차량신호: 좌회전(홀수 1,3,7...)은 왼쪽(+7), 직진(짝수 2,4,8...)은 오른쪽(-7)
                if (!isPed && m <= 16) {
                    if (m % 2 !== 0) ang += 7;
                    else ang -= 7;
                }
            }
            const offset = isPed ? 0.00022 : ((m > 8) ? 0.00018 : 0.00014);
            const pos = [j.lat + Math.cos(ang * Math.PI / 180) * offset, j.lng + Math.sin(ang * Math.PI / 180) * offset];
            const cfg = { dLat: pos[0] - j.lat, dLng: pos[1] - j.lng, rot: arrowData.ang };
            j.arrowConfigs[m] = [cfg];
            configs.push(cfg);
        }

        j.arrows[m] = [];

        configs.forEach((config, idx) => {
            const pos = [j.lat + config.dLat, j.lng + config.dLng];
            const currentRot = config.rot !== undefined ? config.rot : arrowData.ang;
            const walkCls = isPed ? 'walk-mode' : '';
            const isFocused = STATE.focusedArrow && STATE.focusedArrow.jid === jid && STATE.focusedArrow.m === m && STATE.focusedArrow.idx === idx;

            const labelHtml = isEditing ? `<div class="mov-num-label">${m}</div>` : '';

            const icon = L.divIcon({
                className: 'signal-arrow-container',
                html: `
                    <div id="icon-${jid}-${m}-${idx}" class="signal-arrow R ${walkCls} ${isEditing ? 'editing' : ''} ${isFocused ? 'focused' : ''}" style="transform: translate(-50%, -50%) rotate(${currentRot}deg) scale(var(--arrow-scale)); cursor:${isEditing ? 'move' : 'pointer'}; font-size:${isPed ? '11px' : '24px'}; border:${isFocused ? '3px solid #00d4ff' : 'none'}; box-shadow:${isFocused ? '0 0 15px #00d4ff' : 'none'}; overflow:visible; ${!isEditing ? 'display:none;' : ''}">
                            ${isPed ? 'WALK' : arrowData.type}
                            ${labelHtml}
                            <div id="timer-${jid}-${m}-${idx}" class="signal-timer" style="display:none;"></div>
                    </div>
                `,
                iconSize: [0, 0],
                iconAnchor: [0, 0]
            });

            const arrowMarker = L.marker(pos, {
                icon: icon,
                draggable: STATE.isMapEditMode,
                zIndexOffset: STATE.isMapEditMode ? 1100 : 500,
                interactive: true
            }).addTo(map);

            // [성능최적화] 엘리먼트 캐시 초기화
            if (!j.elemCache) j.elemCache = {};
            const cacheKey = `${m}-${idx}`;
            j.elemCache[cacheKey] = {
                arrow: null,
                timer: null,
                lastState: null, // [성능 최적화] 이전 상태 비교값 (null로 초기화하여 첫 업데이트 강제)
                lastTimer: null
            };

            arrowMarker.on('add', () => {
                const el = document.getElementById(`icon-${jid}-${m}-${idx}`);
                const tm = document.getElementById(`timer-${jid}-${m}-${idx}`);
                if (j.elemCache[cacheKey]) {
                    j.elemCache[cacheKey].arrow = el;
                    j.elemCache[cacheKey].timer = tm;
                }
            });

            arrowMarker.on('click', (e) => {
                L.DomEvent.stopPropagation(e);
                if (!STATE.isMapEditMode) { selectJunction(jid); return; }
                if (STATE.focusedArrow && STATE.focusedArrow.m === m && STATE.focusedArrow.idx === idx) {
                    STATE.focusedArrow = null;
                    createArrows(jid);
                }
            });

            arrowMarker.on('dblclick', (e) => {
                L.DomEvent.stopPropagation(e);
                if (!STATE.isMapEditMode) return;
                if (STATE.focusedArrow && STATE.focusedArrow.m === m && STATE.focusedArrow.idx === idx) {
                    STATE.focusedArrow = null;
                } else {
                    STATE.focusedArrow = { jid, m, idx };
                }
                createArrows(jid);
            });

            // 우클릭 메뉴(contextmenu) 차단
            arrowMarker.on('contextmenu', (e) => {
                if (STATE.isMapEditMode) L.DomEvent.preventDefault(e);
            });

            // 회전 / 복제 / 삭제 마우스 핸들러
            let isGlobalRotating = false;
            let isIndivRotating = false;
            let initialMouseAngle = 0;
            let initialSnapshot = null;

            arrowMarker.on('mousedown', (e) => {
                if (!STATE.isMapEditMode) return;

                // Ctrl + 좌클릭: 복제
                if (e.originalEvent.button === 0 && e.originalEvent.ctrlKey) {
                    duplicateArrow(jid, m, idx);
                    L.DomEvent.stopPropagation(e);
                    return;
                }
                // Ctrl + 우클릭: 삭제
                if (e.originalEvent.button === 2 && e.originalEvent.ctrlKey) {
                    deleteArrow(jid, m, idx);
                    L.DomEvent.stopPropagation(e);
                    L.DomEvent.preventDefault(e);
                    return;
                }

                // 우클릭 드래그: 회전
                if (e.originalEvent.button === 2) {
                    L.DomEvent.preventDefault(e);
                    L.DomEvent.stopPropagation(e);
                    map.dragging.disable();

                    if (isFocused) {
                        isIndivRotating = true;
                        const pivotPoint = map.latLngToContainerPoint([j.lat + config.dLat, j.lng + config.dLng]);
                        initialMouseAngle = Math.atan2(e.originalEvent.clientY - pivotPoint.y, e.originalEvent.clientX - pivotPoint.x);
                    } else {
                        isGlobalRotating = true;
                        const pivotPoint = map.latLngToContainerPoint([j.lat, j.lng]);
                        initialMouseAngle = Math.atan2(e.originalEvent.clientY - pivotPoint.y, e.originalEvent.clientX - pivotPoint.x);
                    }
                    
                    // 현재 상태 딥카피 (초기값 보장)
                    initialSnapshot = JSON.parse(JSON.stringify(j.arrowConfigs));
                    // 각 설정에 rot 값이 없으면 기본값(arrowData.ang) 대입
                    Object.keys(initialSnapshot).forEach(k => {
                        initialSnapshot[k].forEach(cfg => {
                            if (cfg.rot === undefined) cfg.rot = arrowData.ang;
                        });
                    });

                    const onMouseMove = (me) => {
                        if (!STATE.isMapEditMode || STATE.activeJid !== jid) return;

                        if (isGlobalRotating) {
                            const pivotPoint = map.latLngToContainerPoint([j.lat, j.lng]);
                            const currentAngle = Math.atan2(me.clientY - pivotPoint.y, me.clientX - pivotPoint.x);
                            const deltaRad = currentAngle - initialMouseAngle;
                            const deltaDeg = deltaRad * 180 / Math.PI;

                            Object.keys(j.arrowConfigs).forEach(mStr => {
                                const mKey = parseInt(mStr);
                                if (!initialSnapshot[mStr]) return;
                                
                                j.arrowConfigs[mKey].forEach((cfg, cIdx) => {
                                    const base = initialSnapshot[mStr][cIdx];
                                    if (!base) return;
                                    
                                    // 위치 회전
                                    cfg.dLat = base.dLat * Math.cos(deltaRad) - base.dLng * Math.sin(deltaRad);
                                    cfg.dLng = base.dLat * Math.sin(deltaRad) + base.dLng * Math.cos(deltaRad);
                                    // 각도 회전
                                    cfg.rot = (base.rot + deltaDeg) % 360;
                                    
                                    const iconEl = document.getElementById(`icon-${jid}-${mKey}-${cIdx}`);
                                    if (iconEl) {
                                        iconEl.style.transform = `translate(-50%, -50%) rotate(${cfg.rot}deg) scale(var(--arrow-scale))`;
                                    }
                                });
                            });
                            updateArrowsPosition(jid);
                        }

                        if (isIndivRotating && isFocused) {
                            const pivotPoint = map.latLngToContainerPoint([j.lat + config.dLat, j.lng + config.dLng]);
                            const currentAngle = Math.atan2(me.clientY - pivotPoint.y, me.clientX - pivotPoint.x);
                            const deltaRad = currentAngle - initialMouseAngle;
                            const deltaDeg = deltaRad * 180 / Math.PI;

                            const base = initialSnapshot[m][idx];
                            if (base) {
                                config.rot = (base.rot + deltaDeg) % 360;
                                const iconEl = document.getElementById(`icon-${jid}-${m}-${idx}`);
                                if (iconEl) {
                                    iconEl.style.transform = `translate(-50%, -50%) rotate(${config.rot}deg) scale(var(--arrow-scale))`;
                                }
                            }
                        }
                    };

                    const onMouseUp = () => {
                        isGlobalRotating = false;
                        isIndivRotating = false;
                        map.dragging.enable();
                        window.removeEventListener('mousemove', onMouseMove);
                        window.removeEventListener('mouseup', onMouseUp);
                    };

                    window.addEventListener('mousemove', onMouseMove);
                    window.addEventListener('mouseup', onMouseUp);
                }
            });

            arrowMarker.on('drag', (e) => {
                const newPos = e.target.getLatLng();
                config.dLat = newPos.lat - j.lat;
                config.dLng = newPos.lng - j.lng;
                L.DomEvent.stopPropagation(e);
            });

            arrowMarker.on('contextmenu click mousedown', (e) => { 
                if (STATE.isMapEditMode) L.DomEvent.stopPropagation(e); 
            });
            j.arrows[m].push(arrowMarker);
        });
    });
}

function duplicateArrow(jid, m, idx) {
    const j = STATE.junctions[jid];
    if (j.arrowConfigs[m].length >= 2) {
        alert("해당 번호의 신호등은 최대 2개까지만 설치할 수 있습니다.");
        return;
    }
    const original = j.arrowConfigs[m][idx];
    j.arrowConfigs[m].push({
        dLat: original.dLat + 0.00002,
        dLng: original.dLng + 0.00002,
        rot: original.rot
    });

    if (jid === STATE.activeJid) {
        const inp = document.querySelector(`.inp-arrow-count[data-mov="${m}"]`);
        if (inp) inp.value = j.arrowConfigs[m].length;
    }
    createArrows(jid);
}

function deleteArrow(jid, m, idx) {
    const j = STATE.junctions[jid];
    if (j.arrowConfigs[m].length <= 1) {
        alert("마지막 하나 남은 화살표는 삭제할 수 없습니다.");
        return;
    }
    j.arrowConfigs[m].splice(idx, 1);

    if (jid === STATE.activeJid) {
        const inp = document.querySelector(`.inp-arrow-count[data-mov="${m}"]`);
        if (inp) inp.value = j.arrowConfigs[m].length;
    }
    createArrows(jid);
}

function removeArrows(jid) {
    const j = STATE.junctions[jid];
    if (!j || !j.arrows) return;
    Object.values(j.arrows).forEach(instances => {
        if (Array.isArray(instances)) instances.forEach(a => map.removeLayer(a));
        else map.removeLayer(instances);
    });
    j.arrows = {};
    j.elemCache = {};
}

function refreshVisibleArrows() {
    if (_arrowRefreshTask) cancelAnimationFrame(_arrowRefreshTask);

    const zoom = (typeof map !== 'undefined') ? map.getZoom() : 0;
    const bounds = (typeof map !== 'undefined') ? map.getBounds() : null;
    const junctions = Object.values(STATE.junctions);
    let idx = 0;
    const chunkSize = 25; // 한 프레임당 처리할 교차로 개수 (프리징 방지)

    function processChunk() {
        const nextLimit = Math.min(idx + chunkSize, junctions.length);
        for (; idx < nextLimit; idx++) {
            const j = junctions[idx];
            const isSelected = STATE.selectedJids.includes(j.id);
            const isVisible = bounds && zoom >= CONFIG.MIN_ZOOM_FOR_ARROWS && bounds.contains([j.lat, j.lng]);
            const shouldShow = isVisible && (STATE.showSignalArrows || (isSelected && STATE.isMapEditMode));

            if (shouldShow) {
                // 이미 그려져 있는 경우 중복 생성 방지
                if (!j.arrows || Object.keys(j.arrows).length === 0) {
                    createArrows(j.id);
                }
            } else {
                // 제거 대상 (화면 밖이거나 기능 꺼짐)
                if (j.arrows && Object.keys(j.arrows).length > 0) {
                    if (!isSelected || !isVisible || (!STATE.showSignalArrows && !STATE.isMapEditMode)) {
                        removeArrows(j.id);
                    }
                }
            }
        }
        
        if (idx < junctions.length) {
            _arrowRefreshTask = requestAnimationFrame(processChunk);
        } else {
            _arrowRefreshTask = null;
            if (typeof refreshVisibleTooltips === 'function') refreshVisibleTooltips();
            // [성능 최적화] 모든 화살표 생성이 완료된 후 즉시 신호 상태 업데이트
            if (typeof updateSim === 'function') updateSim();
        }
    }
    _arrowRefreshTask = requestAnimationFrame(processChunk);
}

function updateArrowsPosition(jid) {
    const j = STATE.junctions[jid];
    if (!j || !j.arrows || !j.arrowConfigs) return;
    Object.keys(j.arrows).forEach(m => {
        const configs = j.arrowConfigs[m];
        if (configs && Array.isArray(configs)) {
            configs.forEach((config, idx) => {
                if (j.arrows[m][idx]) {
                    j.arrows[m][idx].setLatLng([j.lat + config.dLat, j.lng + config.dLng]);
                }
            });
        }
    });
}

function rotateAllArrows(jid, angleDeg) {
    const j = STATE.junctions[jid];
    if (!j || !j.arrowConfigs) return;
    const rad = angleDeg * Math.PI / 180;

    Object.keys(j.arrowConfigs).forEach(m => {
        const configs = j.arrowConfigs[m];
        if (configs && Array.isArray(configs)) {
            configs.forEach(cfg => {
                const oldDLat = cfg.dLat;
                const oldDLng = cfg.dLng;
                cfg.dLat = oldDLat * Math.cos(rad) - oldDLng * Math.sin(rad);
                cfg.dLng = oldDLat * Math.sin(rad) + oldDLng * Math.cos(rad);
                if (cfg.rot !== undefined) cfg.rot = (cfg.rot + angleDeg) % 360;
            });
        }
    });
    createArrows(jid);
}

function resetArrowPositions() {
    if (!STATE.activeJid) return;
    if (!confirm("현재 교차로의 모든 화살표 위치와 수량을 초기 상태(1개)로 초기화하겠습니까?")) return;
    const j = STATE.junctions[STATE.activeJid];
    j.arrowConfigs = {};
    createArrows(STATE.activeJid);
    selectJunction(STATE.activeJid);
    alert("화살표 위치 및 수량이 초기화되었습니다.");
}


function createOverlayArrows(jid, targetMap) {
    const j = typeof STATE !== 'undefined' ? STATE.junctions[jid] : null;
    if (!j || !targetMap) return;

    const t = parseInt(typeof UI !== 'undefined' && UI.timeSlider ? UI.timeSlider.value : 0);
    const smIdx = (typeof getActiveSignalMapIdx === 'function') ? getActiveSignalMapIdx(j, t) : 0;
    const sm = (j.signalMaps && j.signalMaps[smIdx]) ? j.signalMaps[smIdx] : {
        movA: j.movA || [0,0,0,0,0,0,0,0], movB: j.movB || [0,0,0,0,0,0,0,0],
        pedMovA: j.pedMovA || [0,0,0,0,0,0,0,0], pedMovB: j.pedMovB || [0,0,0,0,0,0,0,0]
    };

    const pMovA = sm.pedMovA || [0, 0, 0, 0, 0, 0, 0, 0];
    const pMovB = sm.pedMovB || [0, 0, 0, 0, 0, 0, 0, 0];
    const pedSet = new Set([...pMovA, ...pMovB].filter(x => x > 0));
    const mapMovs = [...(sm.movA || []), ...(sm.movB || []), ...pMovA, ...pMovB].map(Number);
    const allMovs = [...new Set(mapMovs)].filter(m => m > 0);

    if (window._currentOverlayJid && window._currentOverlayJid !== jid) {
        const oldJ = STATE.junctions[window._currentOverlayJid];
        if (oldJ && oldJ.overlayArrows) {
            Object.values(oldJ.overlayArrows).forEach(a => {
                if (Array.isArray(a)) a.forEach(marker => targetMap.removeLayer(marker));
                else targetMap.removeLayer(a);
            });
            oldJ.overlayArrows = {};
            oldJ.overlayElemCache = {};
        }
    }
    window._currentOverlayJid = jid;

    if (j.overlayArrows) {
        Object.values(j.overlayArrows).forEach(a => {
            if (Array.isArray(a)) a.forEach(marker => targetMap.removeLayer(marker));
            else targetMap.removeLayer(a);
        });
    }
    j.overlayArrows = {};
    j.overlayElemCache = {};

    const displayMode = (typeof STATE !== 'undefined' && STATE.overlayDisplayMode) ? STATE.overlayDisplayMode : 'compass';
    const defPosAngles = [90, 270, 180, 0, 270, 90, 0, 180, 45, 225, 135, 315, 225, 45, 315, 135];

    if (displayMode === 'arrow') {
        allMovs.forEach(m => {
            const isPed = (m >= 101 && m <= 116) || pedSet.has(m);
            const arrowData = isPed ? { type: 'WALK', ang: 0 } : getVisualArrow(m);

            const configs = j.arrowConfigs && j.arrowConfigs[m] ? (Array.isArray(j.arrowConfigs[m]) ? j.arrowConfigs[m] : [j.arrowConfigs[m]]) : [];
            let renderConfigs = configs;

            if (renderConfigs.length === 0) {
                let ang = 0;
                if (isPed && m > 100 && m <= 116) {
                    const pedAngMap = { 102: 180, 104: 90, 106: 0, 108: 270, 110: 225, 112: 315, 114: 45, 116: 135 };
                    if (pedAngMap[m] !== undefined) {
                        ang = pedAngMap[m];
                    } else {
                        const refM = m - 100;
                        ang = defPosAngles[(refM - 1) % 16] || 0;
                        if (refM % 2 !== 0) ang += 22;
                        else ang -= 22;
                    }
                } else {
                    ang = defPosAngles[(m - 1) % 16] || 0;
                    if (!isPed && m <= 16) {
                        if (m % 2 !== 0) ang += 7;
                        else ang -= 7;
                    }
                }
                const offset = isPed ? 0.00022 : ((m > 8) ? 0.00018 : 0.00014);
                const pos = [j.lat + Math.cos(ang * Math.PI / 180) * offset, j.lng + Math.sin(ang * Math.PI / 180) * offset];
                renderConfigs = [{ dLat: pos[0] - j.lat, dLng: pos[1] - j.lng, rot: arrowData.ang }];
            }

            j.overlayArrows[m] = [];

            renderConfigs.forEach((config, idx) => {
                const pos = [j.lat + config.dLat, j.lng + config.dLng];
                const currentRot = config.rot !== undefined ? config.rot : arrowData.ang;
                const walkCls = isPed ? 'walk-mode' : '';

                const icon = L.divIcon({
                    className: 'signal-arrow-container',
                    html: `
                        <div id="icon-overlay-${jid}-${m}-${idx}" class="signal-arrow overlay-arrow R ${walkCls}" style="transform: translate(-50%, -50%) rotate(${currentRot}deg) scale(var(--arrow-scale)); font-size:${isPed ? '11px' : '24px'}; overflow:visible;">
                                ${isPed ? 'WALK' : arrowData.type}
                                <div id="timer-overlay-${jid}-${m}-${idx}" class="signal-timer" style="display:none;"></div>
                        </div>
                    `,
                    iconSize: [0, 0],
                    iconAnchor: [0, 0]
                });

                const arrowMarker = L.marker(pos, {
                    icon: icon,
                    interactive: false
                }).addTo(targetMap);

                const cacheKey = `${m}-${idx}`;
                j.overlayElemCache[cacheKey] = {
                    arrow: null,
                    timer: null,
                    lastState: null,
                    lastTimer: null
                };

                arrowMarker.on('add', () => {
                    const el = document.getElementById(`icon-overlay-${jid}-${m}-${idx}`);
                    const tm = document.getElementById(`timer-overlay-${jid}-${m}-${idx}`);
                    if (j.overlayElemCache[cacheKey]) {
                        j.overlayElemCache[cacheKey].arrow = el;
                        j.overlayElemCache[cacheKey].timer = tm;
                    }
                });

                j.overlayArrows[m].push(arrowMarker);
            });
        });
        return;
    }

    // Compass Mode
    const directions = [
        { key: 'N', deg: 0, mS: 4, mL: 7, mP: 104 },
        { key: 'NE', deg: 45, mS: 14, mL: 9, mP: 114 },
        { key: 'E', deg: 90, mS: 6, mL: 1, mP: 106 },
        { key: 'SE', deg: 135, mS: 16, mL: 11, mP: 116 },
        { key: 'S', deg: 180, mS: 8, mL: 3, mP: 108 },
        { key: 'SW', deg: 225, mS: 10, mL: 13, mP: 110 },
        { key: 'W', deg: 270, mS: 2, mL: 5, mP: 102 },
        { key: 'NW', deg: 315, mS: 12, mL: 15, mP: 112 }
    ];

    const directionLabels = {
        'N': '북', 'E': '동', 'S': '남', 'W': '서',
        'NE': '북동', 'SE': '남동', 'SW': '남서', 'NW': '북서'
    };

    const movSet = new Set(allMovs);
    let hasAnyData = false;

    const slotsHtml = directions.map(dir => {
        const { key, deg, mS, mL, mP } = dir;
        const vehHasData = movSet.has(mS) || movSet.has(mL);
        const pedHasData = movSet.has(mP) || pedSet.has(mP);
        if (!vehHasData && !pedHasData) return '';
        hasAnyData = true;
        
        let customAngle = (j.customAngles && j.customAngles[key] !== undefined) ? j.customAngles[key] : deg;
        
        let html = '<div class="signal-slot slot-' + key + '" id="slot-' + key + '" style="transform: rotate(' + customAngle + 'deg);">';
        if (vehHasData) {
            html += '<div class="signal-mount-frame" id="veh-block-' + key + '" style="pointer-events: none; cursor: default;">';
            html += '<div class="component-block">';
            html += '<div style="font-size: 10px; color: #38bdf8; font-weight: bold; margin-bottom: 2px; text-align: center; text-shadow: 0 0 3px #000; white-space: nowrap;">';
            html += directionLabels[key] + ' <span id="car-timer-overlay-' + jid + '-' + key + '" style="color:#fff"></span>';
            html += '</div>';
            html += '<div class="car-housing-box">';
            html += '<div id="lens-r-' + jid + '-' + key + '" class="lens c-red"></div>';
            html += '<div id="lens-y-' + jid + '-' + key + '" class="lens c-yellow"></div>';
            html += '<div id="lens-a-' + jid + '-' + key + '" class="lens c-arrow"></div>';
            html += '<div id="lens-g-' + jid + '-' + key + '" class="lens c-green"></div>';
            html += '</div></div></div>';
        }
        if (pedHasData) {
            html += '<div class="ped-mount-container">';
            html += '<div class="ped-mount-frame" id="ped-block-' + key + '" style="pointer-events: none; cursor: default;">';
            html += '<div class="ped-housing-box">';
            html += '<div id="ped-lens-r-' + jid + '-' + key + '" class="ped-lens p-red"></div>';
            html += '<div id="ped-lens-g-' + jid + '-' + key + '" class="ped-lens p-green"></div>';
            html += '</div>';
            html += '<div id="ped-timer-overlay-' + jid + '-' + key + '" class="micro-timer ped-timer" style="color: #fff; font-size: 10px; text-align: center; font-weight: bold; margin-top:2px;">-</div>';
            html += '</div></div>';
        }
        html += '</div>';
        return html;
    }).join('');

    if (!hasAnyData) return;

    const compassHtml = '<div class="compass-center-overlay-wrapper" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); zoom: 1; transform-origin: center; pointer-events: none; z-index: 9999; width: 180px; height: 180px;"><div class="compass-center-overlay">' + slotsHtml + '</div></div>';

    const marker = L.marker([j.lat, j.lng], {
        icon: L.divIcon({
            className: 'compass-overlay-container',
            html: compassHtml,
            iconSize: [180, 180],
            iconAnchor: [90, 90]
        }),
        zIndexOffset: 500,
        interactive: false
    });

    marker.addTo(targetMap);
    j.overlayArrows['compass'] = marker;

    directions.forEach(dir => {
        const key = dir.key;
        if (!movSet.has(dir.mS) && !movSet.has(dir.mL) && !movSet.has(dir.mP) && !pedSet.has(dir.mP)) return;

        j.overlayElemCache[key] = {
            mS: dir.mS,
            mL: dir.mL,
            mP: dir.mP
        };

        marker.on('add', () => {
            if (j.overlayElemCache[key]) {
                j.overlayElemCache[key].lensR = document.getElementById('lens-r-' + jid + '-' + key);
                j.overlayElemCache[key].lensY = document.getElementById('lens-y-' + jid + '-' + key);
                j.overlayElemCache[key].lensA = document.getElementById('lens-a-' + jid + '-' + key);
                j.overlayElemCache[key].lensG = document.getElementById('lens-g-' + jid + '-' + key);
                j.overlayElemCache[key].timerC = document.getElementById('car-timer-overlay-' + jid + '-' + key);
                j.overlayElemCache[key].lensPR = document.getElementById('ped-lens-r-' + jid + '-' + key);
                j.overlayElemCache[key].lensPG = document.getElementById('ped-lens-g-' + jid + '-' + key);
                j.overlayElemCache[key].timerP = document.getElementById('ped-timer-overlay-' + jid + '-' + key);
            }
            
            // Dragging logic removed (handled by UI sliders now)
        });
    });
}
