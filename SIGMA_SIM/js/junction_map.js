/* SIGMA_SIM Junction Map & Rendering Functions */

function drawJunction(jid, onlyStyle) {
    onlyStyle = onlyStyle || false;
    const j = STATE.junctions[jid];
    if (!j) return;

    const isSelected = (jid === STATE.activeJid);
    const isMultiSelected = STATE.selectedJids.includes(jid);
    const radius = (isMultiSelected ? 8 : 6) * STATE.nodeScale;
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
                    <div id="cycle-timer-${j.id}" style="display:${timerDisplay}; font-size:15px; font-weight:900; color:white; pointer-events:none; font-family:'Roboto Mono', monospace; text-shadow: 1px 1px 2px rgba(0,0,0,0.8);"></div>
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
              <button class="btn-detail" style="background:#e67e22; margin-top:3px;" onclick="STATE.activeJid='${jid}'; openStatsOverlay('${jid}'); map.closePopup();">운영통계</button>
              <button class="btn-detail" style="background:#27ae60; margin-top:3px;" onclick="STATE.activeJid='${jid}'; if(typeof openDbReportOverlay === 'function') openDbReportOverlay('${jid}'); else alert('준비중입니다.'); map.closePopup();">DB보기</button>
            </div>
          </div>
        `, { className: 'custom-popup', closeButton: true });

        j.marker.on('drag', (e) => {
            const pos = e.target.getLatLng();
            j.lat = pos.lat; j.lng = pos.lng;
            const inpLat = document.getElementById('inp-lat');
            const inpLng = document.getElementById('inp-lng');
            if (inpLat) inpLat.value = pos.lat.toFixed(9);
            if (inpLng) inpLng.value = pos.lng.toFixed(9);
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
              <button class="btn-detail" style="background:#e67e22; margin-top:3px;" onclick="STATE.activeJid='${jid}'; openStatsOverlay('${jid}'); map.closePopup();">운영통계</button>
              <button class="btn-detail" style="background:#27ae60; margin-top:3px;" onclick="STATE.activeJid='${jid}'; if(typeof openDbReportOverlay === 'function') openDbReportOverlay('${jid}'); else alert('준비중입니다.'); map.closePopup();">DB보기</button>
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

/* ══════════════════════════════════════════════════════════
 *  ArrowEditManager (신호등 편집 전용 샌드박스 레이어 관리자)
 * ──────────────────────────────────────────────────────────
 *  일반 시뮬레이션 레이어(j.arrows)와 완전히 분리된 전용 L.layerGroup()을
 *  사용하여, 시뮬레이션 루프나 뷰포트 최적화의 방해 없이 독립적인
 *  드래그, 회전, 복제, 삭제 인터랙션을 제공합니다.
 * ══════════════════════════════════════════════════════════ */
const ArrowEditManager = {
    layerGroup: null,
    activeJid: null,
    focusedArrow: null, // { m, idx }
    markers: {}, // key: `${m}-${idx}` => L.marker

    init() {
        if (!this.layerGroup && typeof L !== 'undefined') {
            this.layerGroup = L.layerGroup();
        }
    },

    isActive() {
        return !!(STATE.isMapEditMode && this.activeJid);
    },

    enter(jid) {
        if (!jid || !STATE.junctions || !STATE.junctions[jid]) return;
        this.init();

        if (this.activeJid && this.activeJid !== jid) {
            this.exit(true);
        }

        this.activeJid = jid;
        this.focusedArrow = null;
        this.markers = {};

        // 1. 해당 교차로의 일반 시뮬레이션 화살표는 숨김(제거) 처리
        if (typeof removeArrows === 'function') {
            removeArrows(jid);
        }

        // 2. 편집 전용 레이어를 Leaflet 맵에 마운트
        if (this.layerGroup && typeof map !== 'undefined') {
            if (!map.hasLayer(this.layerGroup)) {
                this.layerGroup.addTo(map);
            }
            this.layerGroup.clearLayers();
        }

        // 3. 편집 마커 렌더링
        this.render();

        const movContainer = document.getElementById('info-mov-combined-container');
        if (movContainer) movContainer.style.display = 'block';
    },

    exit(save = true) {
        if (!this.activeJid) return;
        const jid = this.activeJid;
        const j = STATE.junctions ? STATE.junctions[jid] : null;

        if (save && j) {
            j._isDirty = true;
        }

        // 편집 레이어 정리 및 맵에서 분리
        if (this.layerGroup) {
            this.layerGroup.clearLayers();
            if (typeof map !== 'undefined' && map.hasLayer(this.layerGroup)) {
                map.removeLayer(this.layerGroup);
            }
        }

        const movContainer = document.getElementById('info-mov-combined-container');
        if (movContainer) movContainer.style.display = 'none';

        this.activeJid = null;
        this.focusedArrow = null;
        this.markers = {};

        // 편집 종료 후 일반 시뮬레이션 화살표 복원
        if (STATE.showSignalArrows && typeof createArrows === 'function' && j) {
            createArrows(jid);
            if (typeof updateSim === 'function') updateSim();
        }
    },

    render() {
        if (!this.activeJid) return;
        const jid = this.activeJid;
        const j = STATE.junctions[jid];
        if (!j) return;

        this.init();
        if (this.layerGroup && typeof map !== 'undefined' && !map.hasLayer(this.layerGroup)) {
            this.layerGroup.addTo(map);
        }
        this.layerGroup.clearLayers();
        this.markers = {};

        // 편집 모드: 차량 1~16 및 보행 101~116을 전수 표출
        const vehicleRange = Array.from({ length: 16 }, (_, i) => i + 1);
        const pedRange = Array.from({ length: 16 }, (_, i) => i + 101);
        const configuredMovs = Object.keys(j.arrowConfigs || {}).map(Number);

        const smIdx = STATE.currentSignalMapIdx || 0;
        const sm = (j.signalMaps && j.signalMaps[smIdx]) ? j.signalMaps[smIdx] : {
            movA: j.movA || [0,0,0,0,0,0,0,0], movB: j.movB || [0,0,0,0,0,0,0,0],
            pedMovA: j.pedMovA || [0,0,0,0,0,0,0,0], pedMovB: j.pedMovB || [0,0,0,0,0,0,0,0]
        };
        const pMovA = sm.pedMovA || [0,0,0,0,0,0,0,0];
        const pMovB = sm.pedMovB || [0,0,0,0,0,0,0,0];
        const activeMapMovs = new Set([...(sm.movA || []), ...(sm.movB || []), ...pMovA, ...pMovB].map(Number).filter(x => x > 0));
        const pedSet = new Set([...pMovA, ...pMovB].filter(x => x > 0));

        const allMovs = [...new Set([...configuredMovs, ...vehicleRange, ...pedRange])].filter(m => m > 0);
        const defPosAngles = [90, 270, 180, 0, 270, 90, 0, 180, 45, 225, 135, 315, 225, 45, 315, 135];

        if (!j.arrowConfigs) j.arrowConfigs = {};

        allMovs.forEach(m => {
            const isPed = (m >= 101 && m <= 116) || pedSet.has(m);
            const arrowData = isPed ? { type: 'WALK', ang: 0 } : getVisualArrow(m);

            if (j.arrowConfigs[m] && !Array.isArray(j.arrowConfigs[m])) {
                j.arrowConfigs[m] = [j.arrowConfigs[m]];
            }
            let configs = j.arrowConfigs[m] || [];
            const validConfigs = configs.filter(c => c && typeof c.dLat === 'number' && typeof c.dLng === 'number' && !isNaN(c.dLat) && !isNaN(c.dLng) && !(c.dLat === 0 && c.dLng === 0));

            if (validConfigs.length === 0) {
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
                const cfg = { dLat: pos[0] - j.lat, dLng: pos[1] - j.lng, rot: arrowData.ang };
                j.arrowConfigs[m] = [cfg];
                configs = [cfg];
            } else {
                configs = validConfigs;
                j.arrowConfigs[m] = configs;
            }

            configs.forEach((config, idx) => {
                const pos = [j.lat + config.dLat, j.lng + config.dLng];
                const currentRot = config.rot !== undefined ? config.rot : arrowData.ang;
                const walkCls = isPed ? 'walk-mode' : '';
                const isFocused = this.focusedArrow && this.focusedArrow.m === m && this.focusedArrow.idx === idx;
                const isUsedMov = activeMapMovs.has(m);
                const defaultColor = isUsedMov ? 'G' : 'R';

                const icon = L.divIcon({
                    className: 'signal-arrow-container arrow-edit-marker-container',
                    html: `
                        <div id="edit-icon-${jid}-${m}-${idx}" class="signal-arrow ${defaultColor} ${walkCls} editing ${isFocused ? 'focused' : ''}" style="transform: translate(-50%, -50%) rotate(${currentRot}deg) scale(var(--arrow-scale)); cursor:move; font-size:${isPed ? '11px' : '24px'}; border:${isFocused ? '3px solid #00d4ff' : 'none'}; box-shadow:${isFocused ? '0 0 15px #00d4ff' : 'none'}; overflow:visible;">
                            ${isPed ? 'WALK' : arrowData.type}
                            <div class="mov-num-label">${m}</div>
                        </div>
                    `,
                    iconSize: [0, 0],
                    iconAnchor: [0, 0]
                });

                const arrowMarker = L.marker(pos, {
                    icon: icon,
                    draggable: true,
                    zIndexOffset: 3000,
                    interactive: true
                });

                this.bindMarkerEvents(arrowMarker, jid, m, idx, config, arrowData);

                arrowMarker.addTo(this.layerGroup);
                this.markers[`${m}-${idx}`] = arrowMarker;
            });
        });
    },

    bindMarkerEvents(arrowMarker, jid, m, idx, config, arrowData) {
        const j = STATE.junctions[jid];

        arrowMarker.on('click', (e) => {
            L.DomEvent.stopPropagation(e);
            if (this.focusedArrow && this.focusedArrow.m === m && this.focusedArrow.idx === idx) {
                this.focusedArrow = null;
                this.render();
            }
        });

        arrowMarker.on('dblclick', (e) => {
            L.DomEvent.stopPropagation(e);
            if (this.focusedArrow && this.focusedArrow.m === m && this.focusedArrow.idx === idx) {
                this.focusedArrow = null;
            } else {
                this.focusedArrow = { m, idx };
            }
            this.render();
        });

        arrowMarker.on('contextmenu', (e) => {
            L.DomEvent.preventDefault(e);
            L.DomEvent.stopPropagation(e);
        });

        arrowMarker.on('drag', (e) => {
            const newPos = e.target.getLatLng();
            config.dLat = newPos.lat - j.lat;
            config.dLng = newPos.lng - j.lng;
            j._isDirty = true;
            L.DomEvent.stopPropagation(e);
        });

        arrowMarker.on('mousedown', (e) => {
            // Ctrl + 좌클릭: 복제
            if (e.originalEvent.button === 0 && e.originalEvent.ctrlKey) {
                this.duplicate(m, idx);
                L.DomEvent.stopPropagation(e);
                return;
            }
            // Ctrl + 우클릭: 삭제
            if (e.originalEvent.button === 2 && e.originalEvent.ctrlKey) {
                this.delete(m, idx);
                L.DomEvent.stopPropagation(e);
                L.DomEvent.preventDefault(e);
                return;
            }

            // 우클릭 드래그: 회전
            if (e.originalEvent.button === 2) {
                L.DomEvent.preventDefault(e);
                L.DomEvent.stopPropagation(e);
                map.dragging.disable();

                const isFocused = (this.focusedArrow && this.focusedArrow.m === m && this.focusedArrow.idx === idx);
                let initialMouseAngle = 0;
                let initialSnapshot = JSON.parse(JSON.stringify(j.arrowConfigs));
                Object.keys(initialSnapshot).forEach(k => {
                    const kMov = parseInt(k);
                    const kData = (kMov >= 101 && kMov <= 116) ? { ang: 0 } : getVisualArrow(kMov);
                    initialSnapshot[k].forEach(cfg => {
                        if (cfg.rot === undefined) cfg.rot = kData.ang;
                    });
                });

                if (isFocused) {
                    const pivotPoint = map.latLngToContainerPoint([j.lat + config.dLat, j.lng + config.dLng]);
                    initialMouseAngle = Math.atan2(e.originalEvent.clientY - pivotPoint.y, e.originalEvent.clientX - pivotPoint.x);
                } else {
                    const pivotPoint = map.latLngToContainerPoint([j.lat, j.lng]);
                    initialMouseAngle = Math.atan2(e.originalEvent.clientY - pivotPoint.y, e.originalEvent.clientX - pivotPoint.x);
                }

                const onMouseMove = (me) => {
                    if (!this.isActive() || this.activeJid !== jid) return;

                    if (!isFocused) {
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

                                cfg.dLat = base.dLat * Math.cos(deltaRad) - base.dLng * Math.sin(deltaRad);
                                cfg.dLng = base.dLat * Math.sin(deltaRad) + base.dLng * Math.cos(deltaRad);
                                cfg.rot = (base.rot + deltaDeg) % 360;

                                const iconEl = document.getElementById(`edit-icon-${jid}-${mKey}-${cIdx}`);
                                if (iconEl) {
                                    iconEl.style.transform = `translate(-50%, -50%) rotate(${cfg.rot}deg) scale(var(--arrow-scale))`;
                                }
                            });
                        });
                        this.updateMarkerPositions();
                    } else {
                        const pivotPoint = map.latLngToContainerPoint([j.lat + config.dLat, j.lng + config.dLng]);
                        const currentAngle = Math.atan2(me.clientY - pivotPoint.y, me.clientX - pivotPoint.x);
                        const deltaRad = currentAngle - initialMouseAngle;
                        const deltaDeg = deltaRad * 180 / Math.PI;

                        const base = initialSnapshot[m]?.[idx];
                        if (base) {
                            config.rot = (base.rot + deltaDeg) % 360;
                            const iconEl = document.getElementById(`edit-icon-${jid}-${m}-${idx}`);
                            if (iconEl) {
                                iconEl.style.transform = `translate(-50%, -50%) rotate(${config.rot}deg) scale(var(--arrow-scale))`;
                            }
                        }
                    }
                    j._isDirty = true;
                };

                const onMouseUp = () => {
                    map.dragging.enable();
                    window.removeEventListener('mousemove', onMouseMove);
                    window.removeEventListener('mouseup', onMouseUp);
                    window.removeEventListener('blur', onMouseUp);
                };

                window.addEventListener('mousemove', onMouseMove);
                window.addEventListener('mouseup', onMouseUp);
                window.addEventListener('blur', onMouseUp);
            }
        });
    },

    updateMarkerPositions() {
        if (!this.markers || !this.activeJid) return;
        const j = STATE.junctions[this.activeJid];
        if (!j || !j.arrowConfigs) return;
        Object.keys(this.markers).forEach(key => {
            const [m, idx] = key.split('-').map(Number);
            const marker = this.markers[key];
            const cfg = j.arrowConfigs?.[m]?.[idx];
            if (marker && cfg) {
                marker.setLatLng([j.lat + cfg.dLat, j.lng + cfg.dLng]);
            }
        });
    },

    duplicate(m, idx) {
        if (!this.activeJid) return;
        const j = STATE.junctions[this.activeJid];
        if (!j || !j.arrowConfigs) return;
        if (!j.arrowConfigs[m]) j.arrowConfigs[m] = [];
        if (j.arrowConfigs[m].length >= 2) {
            alert("해당 번호의 신호등은 최대 2개까지만 설치할 수 있습니다.");
            return;
        }
        const original = j.arrowConfigs[m][idx] || { dLat: 0.0001, dLng: 0.0001, rot: 0 };
        j.arrowConfigs[m].push({
            dLat: (original.dLat || 0.0001) + 0.00002,
            dLng: (original.dLng || 0.0001) + 0.00002,
            rot: original.rot || 0
        });
        j._isDirty = true;

        const inp = document.querySelector(`.inp-arrow-count[data-mov="${m}"]`);
        if (inp) inp.value = j.arrowConfigs[m].length;

        this.render();
    },

    delete(m, idx) {
        if (!this.activeJid) return;
        const j = STATE.junctions[this.activeJid];
        if (!j || !j.arrowConfigs) return;
        if (!j.arrowConfigs[m] || j.arrowConfigs[m].length <= 1) {
            alert("마지막 하나 남은 화살표는 삭제할 수 없습니다.");
            return;
        }
        j.arrowConfigs[m].splice(idx, 1);
        j._isDirty = true;

        const inp = document.querySelector(`.inp-arrow-count[data-mov="${m}"]`);
        if (inp) inp.value = j.arrowConfigs[m].length;

        this.render();
    },

    rotateAll(angleDeg) {
        if (!this.activeJid) return;
        const j = STATE.junctions[this.activeJid];
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
        j._isDirty = true;
        this.render();
    },

    reset() {
        if (!this.activeJid) return;
        if (!confirm("현재 교차로의 모든 화살표 위치와 수량을 기본값(1개)으로 초기화하겠습니까?")) return;
        const j = STATE.junctions[this.activeJid];
        if (!j) return;
        j.arrowConfigs = {};
        j._isDirty = true;
        this.render();
        alert("화살표 위치 및 수량이 초기화되었습니다.");
    }
};

window.ArrowEditManager = ArrowEditManager;

/* ══════════════════════════════════════════════════════════
 *  createArrows (일반 신호 시뮬레이션 표출 전용 함수)
 * ──────────────────────────────────────────────────────────
 *  순수 시뮬레이션 상태(G/Y/R/F 등)를 표출하며 드래그나 편집 이벤트 없이
 *  최적화된 형태로 렌더링합니다.
 * ══════════════════════════════════════════════════════════ */
function createArrows(jid) {
    const j = STATE.junctions[jid];
    if (!j) return;

    // 만약 해당 교차로가 ArrowEditManager에 의해 편집 중이라면 편집 전용 레이어 갱신 후 시뮬레이션 화살표 생성 스킵
    if (window.ArrowEditManager && window.ArrowEditManager.isActive() && window.ArrowEditManager.activeJid === jid) {
        window.ArrowEditManager.render();
        return;
    }

    if (!STATE.showSignalArrows) return;
    if (map.getZoom() < CONFIG.MIN_ZOOM_FOR_ARROWS) return;

    // ── 현재 시간/시차맵(SignalMap) 데이터 추출 ──
    const t = parseInt(UI.timeSlider?.value) || 0;
    const simCtx = (typeof getSimContext === 'function') ? getSimContext(j, t) : { dayIdx: new Date().getDay(), pIdx: 0, mapIdx: 0 };
    const smIdx = (typeof getEffectiveSignalMapIdx === 'function') ? getEffectiveSignalMapIdx(j, simCtx.dayIdx, simCtx.pIdx) : simCtx.mapIdx;
    
    const sm = (j.signalMaps && j.signalMaps[smIdx]) ? j.signalMaps[smIdx] : {
        movA: j.movA || [0,0,0,0,0,0,0,0], movB: j.movB || [0,0,0,0,0,0,0,0],
        pedMovA: j.pedMovA || [0,0,0,0,0,0,0,0], pedMovB: j.pedMovB || [0,0,0,0,0,0,0,0]
    };

    const pMovA = sm.pedMovA || [0, 0, 0, 0, 0, 0, 0, 0];
    const pMovB = sm.pedMovB || [0, 0, 0, 0, 0, 0, 0, 0];
    const pedSet = new Set([...pMovA, ...pMovB].filter(x => x > 0));
    const mapMovs = [...(sm.movA || []), ...(sm.movB || []), ...pMovA, ...pMovB].map(Number);
    const configuredMovs = Object.keys(j.arrowConfigs || {}).map(Number).filter(m => m > 0);
    let allMovs = [...new Set([...mapMovs, ...configuredMovs])].filter(m => m > 0);
    if (allMovs.length === 0) {
        allMovs = [1, 2, 3, 4, 5, 6, 7, 8, 102, 104, 106, 108];
    }

    removeArrows(jid);
    j.arrows = {};

    if (!j.arrowConfigs) j.arrowConfigs = {};
    const defPosAngles = [90, 270, 180, 0, 270, 90, 0, 180, 45, 225, 135, 315, 225, 45, 315, 135];

    allMovs.forEach(m => {
        const isPed = (m >= 101 && m <= 116) || pedSet.has(m);
        const arrowData = isPed ? { type: 'WALK', ang: 0 } : getVisualArrow(m);

        if (j.arrowConfigs[m] && !Array.isArray(j.arrowConfigs[m])) {
            j.arrowConfigs[m] = [j.arrowConfigs[m]];
        }
        let configs = j.arrowConfigs[m] || [];
        const validConfigs = configs.filter(c => c && typeof c.dLat === 'number' && typeof c.dLng === 'number' && !isNaN(c.dLat) && !isNaN(c.dLng) && !(c.dLat === 0 && c.dLng === 0));

        if (validConfigs.length === 0) {
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
            const cfg = { dLat: pos[0] - j.lat, dLng: pos[1] - j.lng, rot: arrowData.ang };
            j.arrowConfigs[m] = [cfg];
            configs = [cfg];
        } else {
            configs = validConfigs;
            j.arrowConfigs[m] = configs;
        }

        j.arrows[m] = [];

        configs.forEach((config, idx) => {
            const pos = [j.lat + config.dLat, j.lng + config.dLng];
            const currentRot = config.rot !== undefined ? config.rot : arrowData.ang;
            const walkCls = isPed ? 'walk-mode' : '';

            const icon = L.divIcon({
                className: 'signal-arrow-container',
                html: `
                    <div id="icon-${jid}-${m}-${idx}" class="signal-arrow R ${walkCls}" style="transform: translate(-50%, -50%) rotate(${currentRot}deg) scale(var(--arrow-scale)); cursor:pointer; font-size:${isPed ? '11px' : '24px'}; overflow:visible;">
                            ${isPed ? 'WALK' : arrowData.type}
                            <div id="timer-${jid}-${m}-${idx}" class="signal-timer" style="display:none; transform: translateX(-50%) rotate(${-currentRot}deg);"></div>
                    </div>
                `,
                iconSize: [0, 0],
                iconAnchor: [0, 0]
            });

            const arrowMarker = L.marker(pos, {
                icon: icon,
                draggable: false,
                zIndexOffset: 500,
                interactive: true
            }).addTo(map);

            if (!j.elemCache) j.elemCache = {};
            const cacheKey = `${m}-${idx}`;
            j.elemCache[cacheKey] = {
                arrow: null,
                timer: null,
                lastState: null,
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
                selectJunction(jid);
            });

            j.arrows[m].push(arrowMarker);
        });
    });
}

function duplicateArrow(jid, m, idx) {
    if (window.ArrowEditManager && window.ArrowEditManager.isActive() && window.ArrowEditManager.activeJid === jid) {
        window.ArrowEditManager.duplicate(m, idx);
        return;
    }
    const j = STATE.junctions[jid];
    if (!j || !j.arrowConfigs) return;
    if (!j.arrowConfigs[m]) j.arrowConfigs[m] = [];
    if (j.arrowConfigs[m].length >= 2) {
        alert("해당 번호의 신호등은 최대 2개까지만 설치할 수 있습니다.");
        return;
    }
    const original = j.arrowConfigs[m][idx] || { dLat: 0.0001, dLng: 0.0001, rot: 0 };
    j.arrowConfigs[m].push({
        dLat: (original.dLat || 0.0001) + 0.00002,
        dLng: (original.dLng || 0.0001) + 0.00002,
        rot: original.rot || 0
    });
    j._isDirty = true;

    if (jid === STATE.activeJid) {
        const inp = document.querySelector(`.inp-arrow-count[data-mov="${m}"]`);
        if (inp) inp.value = j.arrowConfigs[m].length;
    }
    createArrows(jid);
}

function deleteArrow(jid, m, idx) {
    if (window.ArrowEditManager && window.ArrowEditManager.isActive() && window.ArrowEditManager.activeJid === jid) {
        window.ArrowEditManager.delete(m, idx);
        return;
    }
    const j = STATE.junctions[jid];
    if (!j || !j.arrowConfigs) return;
    if (!j.arrowConfigs[m] || j.arrowConfigs[m].length <= 1) {
        alert("마지막 하나 남은 화살표는 삭제할 수 없습니다.");
        return;
    }
    j.arrowConfigs[m].splice(idx, 1);
    j._isDirty = true;

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
    delete j._isRenderedEditMode;
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
            
            // [편집 전용 레이어 보호] 편집 중인 교차로는 ArrowEditManager 전용이므로 시뮬레이션 화살표 관리에서 완전 제외
            if (window.ArrowEditManager && window.ArrowEditManager.isActive() && window.ArrowEditManager.activeJid === j.id) {
                continue;
            }

            const isVisible = bounds && zoom >= CONFIG.MIN_ZOOM_FOR_ARROWS && bounds.contains([j.lat, j.lng]);
            const shouldShow = isVisible && STATE.showSignalArrows;
            const needsRecreate = !j.arrows || Object.keys(j.arrows).length === 0;

            if (shouldShow) {
                if (needsRecreate) {
                    createArrows(j.id);
                }
            } else {
                if (j.arrows && Object.keys(j.arrows).length > 0) {
                    removeArrows(j.id);
                }
            }
        }
        
        if (idx < junctions.length) {
            _arrowRefreshTask = requestAnimationFrame(processChunk);
        } else {
            _arrowRefreshTask = null;
            if (typeof refreshVisibleTooltips === 'function') refreshVisibleTooltips();
            if (typeof updateSim === 'function') updateSim();
        }
    }
    _arrowRefreshTask = requestAnimationFrame(processChunk);
}

function updateArrowsPosition(jid) {
    const j = STATE.junctions[jid];
    if (!j || !j.arrowConfigs) return;

    if (window.ArrowEditManager && window.ArrowEditManager.isActive() && window.ArrowEditManager.activeJid === jid) {
        window.ArrowEditManager.updateMarkerPositions();
        return;
    }

    if (!j.arrows) return;
    Object.keys(j.arrows).forEach(m => {
        const configs = j.arrowConfigs[m];
        if (configs && Array.isArray(configs)) {
            configs.forEach((config, idx) => {
                if (j.arrows[m] && j.arrows[m][idx]) {
                    j.arrows[m][idx].setLatLng([j.lat + config.dLat, j.lng + config.dLng]);
                }
            });
        }
    });
}

function rotateAllArrows(jid, angleDeg) {
    if (window.ArrowEditManager && window.ArrowEditManager.isActive() && window.ArrowEditManager.activeJid === jid) {
        window.ArrowEditManager.rotateAll(angleDeg);
        return;
    }
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
    j._isDirty = true;
    createArrows(jid);
}

function resetArrowPositions() {
    if (!STATE.activeJid) return;
    if (window.ArrowEditManager && window.ArrowEditManager.isActive()) {
        window.ArrowEditManager.reset();
        return;
    }
    if (!confirm("현재 교차로의 모든 화살표 위치와 수량을 초기 상태(1개)로 초기화하겠습니까?")) return;
    const j = STATE.junctions[STATE.activeJid];
    if (!j) return;
    j.arrowConfigs = {};
    j._isDirty = true;
    createArrows(STATE.activeJid);
    if (typeof updateSim === 'function') updateSim();
    alert("화살표 위치 및 수량이 초기화되었습니다.");
}


function createOverlayArrows(jid, targetMap) {
    const j = typeof STATE !== 'undefined' ? STATE.junctions[jid] : null;
    if (!j || !targetMap) return;

    const t = parseInt(typeof UI !== 'undefined' && UI.timeSlider ? UI.timeSlider.value : 0);
    let smIdx = 0;
    const simCtx2 = (typeof getSimContext === 'function') ? getSimContext(j, t) : { dayIdx: new Date().getDay(), pIdx: 0, mapIdx: 0 };
    if (typeof getEffectiveSignalMapIdx === 'function') {
        smIdx = getEffectiveSignalMapIdx(j, simCtx2.dayIdx, simCtx2.pIdx);
    } else {
        smIdx = simCtx2.mapIdx;
    }
    const sm = (j.signalMaps && j.signalMaps[smIdx]) ? j.signalMaps[smIdx] : {
        movA: j.movA || [0,0,0,0,0,0,0,0], movB: j.movB || [0,0,0,0,0,0,0,0],
        pedMovA: j.pedMovA || [0,0,0,0,0,0,0,0], pedMovB: j.pedMovB || [0,0,0,0,0,0,0,0]
    };

    const pMovA = sm.pedMovA || [0, 0, 0, 0, 0, 0, 0, 0];
    const pMovB = sm.pedMovB || [0, 0, 0, 0, 0, 0, 0, 0];
    const pedSet = new Set([...pMovA, ...pMovB].filter(x => x > 0));
    const mapMovs = [...(sm.movA || []), ...(sm.movB || []), ...pMovA, ...pMovB].map(Number);
    const configuredMovs = Object.keys(j.arrowConfigs || {}).map(Number).filter(m => m > 0);
    let allMovs = [...new Set([...mapMovs, ...configuredMovs])].filter(m => m > 0);
    if (allMovs.length === 0) {
        allMovs = [1, 2, 3, 4, 5, 6, 7, 8, 102, 104, 106, 108];
    }

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
            const validConfigs = configs.filter(c => c && typeof c.dLat === 'number' && typeof c.dLng === 'number' && !isNaN(c.dLat) && !isNaN(c.dLng) && !(c.dLat === 0 && c.dLng === 0));
            let renderConfigs = validConfigs;

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
                                <div id="timer-overlay-${jid}-${m}-${idx}" class="signal-timer" style="display:none; transform: translateX(-50%) rotate(${-currentRot}deg);"></div>
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
            html += '<div class="signal-mount-frame" id="veh-block-' + jid + '-' + key + '" onpointerdown="handleCompassPointerDown(event, \'' + jid + '\', \'' + key + '\')" style="pointer-events: auto; cursor: grab;">';
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
            html += '<div class="ped-mount-frame" id="ped-block-' + jid + '-' + key + '" onpointerdown="handleCompassPointerDown(event, \'' + jid + '\', \'' + key + '\')" style="pointer-events: auto; cursor: grab;">';
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
            
            // Dragging logic handled via window.handleCompassPointerDown
        });
    });
}

window.handleCompassPointerDown = function(e, jid, key) {
    e.preventDefault();
    e.stopPropagation();

    const j = STATE.junctions[jid];
    if (!j) return;

    // overlayMap is a global variable from overlay_ui.js
    const targetMap = window.overlayMap || (typeof overlayMap !== 'undefined' ? overlayMap : null);
    // overlayMap is static, no need to disable dragging

    const el = e.currentTarget;
    const compassOverlay = el.closest('.compass-center-overlay');
    if (!compassOverlay) return;

    const rect = compassOverlay.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const onPointerMove = (moveEvent) => {
        const dx = moveEvent.clientX - centerX;
        const dy = moveEvent.clientY - centerY;
        let angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
        if (angle < 0) angle += 360;

        if (typeof window.clampAngleForPfx === 'function') {
            angle = window.clampAngleForPfx(key, Math.round(angle));
        }

        if (!j.customAngles) j.customAngles = {};
        j.customAngles[key] = angle;

        const slotEl = compassOverlay.querySelector('.slot-' + key);
        if (slotEl) {
            slotEl.style.transform = 'rotate(' + angle + 'deg)';
        }
    };

    const onPointerUp = () => {
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);

        // overlayMap is static, do not re-enable dragging
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
};
