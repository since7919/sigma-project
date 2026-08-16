/**
 * simulation.js
 * ─────────────────────────────────────────────
 * 신호 시뮬레이션 엔진 (타임슬라이더 연동 및 실시간 API 수신)
 * 각 교차로의 현재 시간별 상태(신호등 색상, 타이머) 계산
 */

console.log("%c[SIGMA] Simulation Engine v2024.04.22.0805 Loaded", "color: #00d4ff; font-weight: bold;");

STATE.signalSource = 'SIMULATION'; // 'SIMULATION' or 'REALTIME'
let realtimeInterval = null;

window.toggleSignalSource = function() {
    STATE.signalSource = (STATE.signalSource === 'REALTIME') ? 'SIMULATION' : 'REALTIME';
    const btn = document.getElementById('btn-signal-source');
    const bottomPanel = document.getElementById('bottom-detail-panel');
    
    if (btn) {
        if (STATE.signalSource === 'REALTIME') {
            btn.innerHTML = '🔴 실시간 API';
            btn.style.borderColor = '#ff003c';
            btn.style.color = '#ff003c';
            btn.style.textShadow = '0 0 5px #ff003c';
            if (bottomPanel) bottomPanel.classList.add('active');
            
            startRealtimePolling();
            
            // [추가] 실시간 모드일 때 매초 화면을 강제 갱신하도록 타이머 설정
            if (window._realtimeRenderInterval) clearInterval(window._realtimeRenderInterval);
            window._realtimeRenderInterval = setInterval(updateSim, 1000);
            
            console.log("[API] 실시간 신호 모드 활성화 및 강제 갱신 시작");
        } else {
            btn.innerHTML = '🔄 시뮬레이터';
            btn.style.borderColor = '#00d4ff';
            btn.style.color = '#00d4ff';
            btn.style.textShadow = '0 0 5px #00d4ff';
            if (bottomPanel) bottomPanel.classList.remove('active');
            
            stopRealtimePolling();
            
            // [추가] 실시간 강제 갱신 타이머 중단
            if (window._realtimeRenderInterval) {
                clearInterval(window._realtimeRenderInterval);
                window._realtimeRenderInterval = null;
            }
            
            console.log("[API] 시뮬레이터 모드 전환");
        }
    }
};

window.onRegionChange = async function() {
    const regionCode = document.getElementById('api-region-select').value;
    console.log(`[Region] 지역 변경: ${regionCode}`);
    
    // 외부 교차로 API 레이어 초기화
    if (window.ApiLayers) {
        window.ApiLayers.onRegionChanged(regionCode);
    }
    
    // [Clean up] 기존 교차로 마커 지도에서 모두 제거
    if (typeof STATE !== 'undefined' && STATE.junctions) {
        Object.values(STATE.junctions).forEach(j => {
            if (j.marker && window.map) {
                window.map.removeLayer(j.marker);
            }
        });
        STATE.junctions = {};
    }

    // 기존 연동구간 및 행정경계 레이어 제거
    if (typeof STATE !== 'undefined') {
        if (STATE.geoJsonLayer && window.map) {
            window.map.removeLayer(STATE.geoJsonLayer);
            STATE.geoJsonLayer = null;
        }
        if (STATE.boundaryLayer && window.map) {
            window.map.removeLayer(STATE.boundaryLayer);
            STATE.boundaryLayer = null;
        }
        // 메모리 초기화
        STATE.groups = {};
        STATE.civilData = [];
    }

    // [Reload] 선택한 지역 코드로 분할된 데이터 비동기 일괄 로드 실행
    if (typeof autoLoadFiles === 'function') {
        await autoLoadFiles();
    }
};

async function fetchRealtimeSignals() {
    if (STATE.signalSource !== 'REALTIME' || !STATE.junctions) return;
    
    // 지도 화면 내에 위치한 교차로만 가져와 부하 감소
    const bounds = (typeof map !== 'undefined') ? map.getBounds() : null;
    const n = bounds ? bounds.getNorth() : 90, s = bounds ? bounds.getSouth() : -90, e = bounds ? bounds.getEast() : 180, w = bounds ? bounds.getWest() : -180;
    
    let inView = Object.values(STATE.junctions).filter(j => j.lat < n && j.lat > s && j.lng < e && j.lng > w);
    const targets = inView.slice(0, 5); // UTIC 과부하 방지를 위해 화면 내 5개로 제한
    
    for (const j of targets) {
        if (!j.name) continue;
        const itstNm = encodeURIComponent(j.name);
        
        // 선택된 지역코드 또는 저장된 지역코드 사용
        let regionCode = j.region || j.regionCode || document.getElementById('api-region-select').value || 'L01';
        
        // 정확한 필터링 파라미터 적용 (srchCTId, srchCRNm) 및 SigMap API 사용
        const originalUrl = `http://tsihub.utic.go.kr/tsi/api/SigMapCrossRoadInfoService/getSigMapCRInfo?srchCTId=${regionCode}&srchCRNm=${itstNm}&type=json`;
        
        // 통합 백엔드의 보안 프록시 API 사용
        const proxyUrl = `/api/proxy/utic?url=${encodeURIComponent(originalUrl)}`;
        
        try {
            const response = await fetch(proxyUrl);
            if (response.ok) {
                const data = await response.json();
                
                // [디버깅 추가]
                console.log(`[API 통신 응답] ${j.name}:`, data);
                
                const items = Array.isArray(data) ? data : (data.body && data.body.items ? data.body.items : null);
                if (items && items.length > 0) {
                    j._realtimeItems = items;
                    j._realtimeUpdate = Date.now();
                    
                    // 수신 성공 여부를 화면에 표시하기 위한 로그
                    if (!STATE.hasNotifiedAPI) {
                        STATE.hasNotifiedAPI = true;
                        const keys = Object.keys(items[1] || items[0]).join(', '); // 메타데이터 제외하고 키 확인
                        console.log(`[API 수신 성공] 데이터 키값들: ${keys}`);
                        if (typeof addMessageToUI === 'function') {
                            addMessageToUI(`🌐 **[실시간 API 연동 성공]** 데이터 수신 완료 (${items.length}건). 수신 속성: ${keys}`);
                        }
                    }
                }
            }
        } catch (err) {
            console.warn(`[API 통신 실패] ${j.name}:`, err.message);
        }
    }
}

function startRealtimePolling() {
    if (realtimeInterval) clearInterval(realtimeInterval);
    fetchRealtimeSignals();
    realtimeInterval = setInterval(fetchRealtimeSignals, 5000); // 5초 주기
}

function stopRealtimePolling() {
    if (realtimeInterval) clearInterval(realtimeInterval);
    realtimeInterval = null;
}

/** 요일별 시뮬레이션 설정 (주간계획 연동) */
function setSimDay(day) {
    STATE.simDayOfWeek = day;
    
    // UI 버튼 상태 업데이트
    document.querySelectorAll('.btn-day').forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.getAttribute('data-day')) === day);
    });
    
    updateSim();
    console.log(`[Simulation] Day changed to ${day} (0:Sun-6:Sat)`);
}
window.setSimDay = setSimDay; // 전역 명시적 할당

function updateSim() {
    const t = parseInt(UI.timeSlider.value);
    const editing = (STATE.activeJid && STATE.isMapEditMode);
    const isOpActiveGlobal = false; // 전역 운영자 개입 (필요 시 확장)

    // 시간 표시 갱신
    if (UI.clock) {
        const h = Math.floor(t / 3600);
        const m = Math.floor((t % 3600) / 60);
        const s = t % 60;
        UI.clock.innerText = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }

    const bounds = (typeof map !== 'undefined') ? map.getBounds() : null;
    const n = bounds ? bounds.getNorth() : 90, s = bounds ? bounds.getSouth() : -90, e = bounds ? bounds.getEast() : 180, w = bounds ? bounds.getWest() : -180;

    Object.values(STATE.junctions).forEach(j => {
        // [성능 최적화] 화면 밖 교차로는 연산에서 제외 (단, 현재 선택된 교차로는 예외)
        const isInView = (j.lat < n && j.lat > s && j.lng < e && j.lng > w);
        if (!isInView && j.id !== STATE.activeJid) return;

        // 1. 점멸 상태 체크
        let isFlashActive = false;
        if (j.flashEnable && j.flashTimes) {
            isFlashActive = j.flashTimes.some(tf => isTimeInRange(tf.s, tf.e, t));
        }

        // 2. 운영자 개입 활성 체크
        let opRow = null; // activeOpRow -> opRow로 변경
        if (j.opIntervention?.enable && j.opIntervention.rows) {
            opRow = j.opIntervention.rows.find(row => isTimeInRange(row.s, row.e, t));
        }
        const isOpActive = !!opRow; // isOpActive 변수는 유지

        let p = null;
        
        // [수정] getSimContext를 사용하여 사용자의 계층적 선택 로직(오늘 요일 -> 주간계획 -> 맵)을 적용
        const simCtx = getSimContext(j, t);
        let activeSignalMapIdx = simCtx.mapIdx;
        let useDayIdx = editing ? STATE.currentJunctionDayTypeIdx : simCtx.dayIdx;

        if (!isFlashActive) {
            // 시차맵 변경 감지 시 화살표 재생성
            if (activeSignalMapIdx !== j._lastMapIdx) {
                if (typeof createArrows === 'function') createArrows(j.id);
                j._lastMapIdx = activeSignalMapIdx;
            }
        }

        const activeMap = (j.signalMaps && j.signalMaps[activeSignalMapIdx]) ? j.signalMaps[activeSignalMapIdx] : { 
            movA: [], movB: [], pedMovA: [], pedMovB: [],
            pedGreenA: [], pedGreenB: [], pedFlashA: [], pedFlashB: []
        };

        if (!isFlashActive) {
            if (isOpActive) {
                p = {
                    splitA: opRow.splitA, splitB: opRow.splitB, offset: opRow.offset,
                    yellowA: activeMap.yellowA, yellowB: activeMap.yellowB,
                    allredA: activeMap.allredA, allredB: activeMap.allredB,
                    pedA: activeMap.pedA, pedB: activeMap.pedB,
                    pedGreenA: activeMap.pedGreenA, pedGreenB: activeMap.pedGreenB,
                    pedFlashA: activeMap.pedFlashA, pedFlashB: activeMap.pedFlashB,
                    pedDelayA: activeMap.pedDelayA, pedDelayB: activeMap.pedDelayB
                };
            } else {
                const sched = getLinkedSchedule(j, useDayIdx) || (j.schedules ? j.schedules[useDayIdx] : null);
                const activeIdx = (sched && Array.isArray(sched)) ? findActiveSchedIdx(sched, t) : 0;
                
                // [신뢰성 강화] 시작시간이 -1인 경우 등화 연산 제외
                const isSchedValid = (sched?.[activeIdx] && sched[activeIdx].h !== -1);
                
                const currentPlanIdx = (editing && STATE.isManualPlanView) ? (parseInt(UI.planIdx?.value) || 0) : activeIdx;
                const targetP = (j.dayPlans && j.dayPlans[useDayIdx]) ? j.dayPlans[useDayIdx][currentPlanIdx] : null;
                
                // [신뢰성 강화] 스플릿 합계가 0인 경우 등화 제외 (절대 타 계획으로 폴백 금지)
                const splitSum = (targetP?.splitA || []).reduce((a, b) => a + b, 0);
                
                if (isSchedValid && targetP && splitSum > 0) {
                    p = targetP;
                    j._simCycle = splitSum;
                } else {
                    p = null; // 등화 안 함
                    j._simCycle = (sched?.[activeIdx]?.cycle || 0);
                }
            }
        }

        // 툴팁 정보 업데이트 (명칭, 주기 등 표시 상태 반영)
        if (j.marker && isInView && (STATE.showId || STATE.showName || STATE.showCycle)) {
            if (!j.lastTooltipUpdate || j.lastTooltipUpdate !== t) {
                if (typeof refreshJunctionTooltip === 'function') refreshJunctionTooltip(j.id);
                j.lastTooltipUpdate = t;
            }
        }

        // [추가] 실시간 API 모드일 때, 통신에 성공한 마커만 지도에서 시각적으로 두드러지게(위치 표시) 처리
        if (j.marker && j.marker._icon) {
            if (STATE.signalSource === 'REALTIME') {
                if (j._realtimeItems && j._realtimeItems.length > 0) {
                    j.marker._icon.style.filter = 'drop-shadow(0 0 10px #00ffea) contrast(1.5)';
                    j.marker._icon.style.opacity = '1';
                } else {
                    j.marker._icon.style.filter = 'grayscale(100%)';
                    j.marker._icon.style.opacity = '0.3'; // 수신 대기 중이거나 실패한 교차로는 흐리게
                }
            } else {
                j.marker._icon.style.filter = ''; // 시뮬레이터 모드 시 원래 상태 복원
                j.marker._icon.style.opacity = '1';
            }
        }

        // 화살표/신호등 갱신 (핵심 최적화 구간)
        if (!j.arrows || !j.elemCache) return;

        const activeStates = {}; // { movID: stateObj }
        
        // 1. 모든 신호 방향을 기본적으로 'R'로 초기화
        Object.keys(j.arrows).forEach(mStr => {
            activeStates[parseInt(mStr)] = { st: 'R', rem: 0 };
        });

        // 2. 현재 상태(점멸/정상/편집)에 따른 현시별 상태 계산
        if (isFlashActive) {
            (j.flashYellows || []).forEach(m => activeStates[m] = { st: 'Y-flash', rem: 0 });
            (j.flashReds || []).forEach(m => activeStates[m] = { st: 'R-flash', rem: 0 });
        } else if (editing && STATE.isMapEditMode) {
            // [추가] 신호등 편집 모드 시에는 모든 화살표를 적색으로 고정 (위치 조정 편의)
            Object.keys(j.arrows).forEach(mStr => {
                activeStates[parseInt(mStr)] = { st: 'R', rem: 0 };
            });
        } else if (STATE.signalSource === 'REALTIME' && j._realtimeItems && j._realtimeItems.length > 0) {
            // [API 연동] UTIC 실시간 시그널맵 데이터 반영 (PLAN_TP: "0" 기준)
            const steps = j._realtimeItems.filter(item => item.PLAN_TP === "0" && parseInt(item.MIN_TM) > 0);
            
            // [핵심 수정] 실시간 모드일 때는 시뮬레이터 시간(t)이 아닌 실제 현재 시각(초) 사용
            const realSeconds = Math.floor(Date.now() / 1000);
            
            // [추가] API 수신 데이터를 하단 상세 정보 패널(이미지 스타일)에 출력
            if (typeof renderDetailedAPIPanel === 'function') {
                renderDetailedAPIPanel(j, steps, realSeconds);
            }
            
            if (steps.length > 0) {
                // 전체 주기(Cycle) 계산
                const cycle = steps.reduce((sum, item) => sum + parseInt(item.MIN_TM), 0);
                j._simCycle = cycle; 
                j._simPos = 0;
                
                // 실제 시각을 주기로 나눈 나머지로 현재 위치 계산
                const currentPos = realSeconds % cycle;
                let accum = 0;
                let activeStep = null;
                
                // 현재 시간에 해당하는 스텝 찾기
                for (const step of steps) {
                    accum += parseInt(step.MIN_TM);
                    if (currentPos < accum) {
                        activeStep = step;
                        break;
                    }
                }
                
                if (activeStep) {
                    for (let i = 1; i <= 8; i++) {
                        if (activeStep[`CAR${i}`] === "1") {
                            activeStates[i] = { st: 'G', rem: accum - currentPos };
                        }
                    }
                }
            } else {
                // 유효한 스텝 데이터가 없을 때의 폴백 표출 로직
                j._simCycle = 100;
                j._simPos = 0;
                const mapIdx = j._lastMapIdx || 0;
                const sm = j.signalMaps?.[mapIdx];
                if (sm) {
                    const dummyPhase = Math.floor((t % 80) / 10);
                    if (sm.movA && sm.movA[dummyPhase] > 0) activeStates[sm.movA[dummyPhase]] = { st: 'G', rem: 99 };
                    if (sm.movB && sm.movB[dummyPhase] > 0) activeStates[sm.movB[dummyPhase]] = { st: 'G', rem: 99 };
                }
            }
        } else if (p && j._simCycle > 0) {
            const mainMovs = activeMap.mainMovements || [];
            let mainOS = 0;
            if (mainMovs.length > 0) {
                const getRT = (id) => {
                    const r = id[0], idx = parseInt(id.substring(1));
                    const s = (r === 'A' ? p.splitA : p.splitB);
                    const ar = (r === 'A' ? activeMap.allredA : activeMap.allredB);
                    let sum = 0; for(let i=0; i<idx; i++) sum += (s?.[i]||0);
                    return sum + (ar?.[idx]||0);
                };
                mainOS = mainMovs.length === 1 ? getRT(mainMovs[0]) : Math.max(getRT(mainMovs[0]), getRT(mainMovs[1]));
            }
            // [보완] Cycle이 0이면 신호가 나올 수 없으므로 최소 100초로 강제
            let currentCycle = (p && p.splitA) ? (p.splitA.reduce((a, b) => a + b, 0)) : (j._simCycle || 100);
            if (currentCycle <= 0) currentCycle = 100;
            j._simCycle = currentCycle;
            
            const finalCycle = j._simCycle;
            const pos = ((t + (p?.offset || 0) + (mainOS || 0)) % finalCycle + finalCycle) % finalCycle;

            // 교차로 전체 주기 진행률 저장 (툴팁용)
            j._simPos = Math.floor(pos);

            // [추가] 점멸 신호 블링킹을 위한 전역 상태 제어 (500ms 주기)
            const flashOn = (Math.floor(Date.now() / 500) % 2 === 0);
            document.body.classList.toggle('global-flash-on', flashOn);

            const calc = (splits, yellows, allreds, movs, peds, pdlys, pmovs, pedGreens, pedFlashes) => {
                let elap = 0;
                let useSplits = [...(splits || [])];
                if (useSplits.reduce((a, b) => a + b, 0) === 0 && finalCycle > 0) {
                    useSplits = [Math.floor(finalCycle/4), Math.floor(finalCycle/4), Math.floor(finalCycle/4), Math.floor(finalCycle/4), 0, 0, 0, 0];
                }

                for (let i = 0; i < 8; i++) {
                    const sv = useSplits[i] || 0; 
                    if (sv <= 0) continue;
                    
                    if (pos >= elap && pos < elap + sv) {
                        const sub = pos - elap;
                        const rl = allreds?.[i] || 0;
                        const yl = yellows?.[i] || 0;
                        const gl = Math.max(0, sv - yl - rl);

                        let st = 'R', rem = 0;
                        const movId = (movs && movs[i] > 0) ? movs[i] : 0;
                        const prevIdx = (i - 1 + 8) % 8;
                        const nextIdx = (i + 1) % 8;
                        
                        // [핵심] 연속 이동류 판정: 이전/다음 현시와 번호가 같으면 간격 생략
                        const isSameAsPrev = (movId > 0 && movId === movs[prevIdx] && useSplits[prevIdx] > 0);
                        const isSameAsNext = (movId > 0 && movId === movs[nextIdx] && useSplits[nextIdx] > 0);

                        if (sub < rl) {
                            // 현시 시작 간격 (All-Red 구간)
                            if (isSameAsPrev) {
                                st = 'G';
                                rem = Math.ceil(rl + gl - sub);
                            } else {
                                st = 'R';
                                rem = Math.ceil(rl - sub);
                            }
                        } else if (sub < rl + gl) {
                            // 현시 녹색 구간
                            st = 'G';
                            rem = Math.ceil(rl + gl - sub);
                        } else {
                            // 현시 종료 간격 (Yellow 구간)
                            if (isSameAsNext) {
                                st = 'G';
                                rem = Math.ceil(sv - sub);
                            } else {
                                st = 'Y';
                                rem = Math.ceil(sv - sub);
                            }
                        }

                        // [업그레이드] 잔여 시간 합산: 연속된 다음 현시들의 시간을 더함
                        if (st === 'G' && movId > 0) {
                            let nextI = nextIdx;
                            let safety = 0;
                            while (movs[nextI] === movId && useSplits[nextI] > 0 && safety < 8) {
                                rem += useSplits[nextI];
                                nextI = (nextI + 1) % 8;
                                safety++;
                            }
                        }

                        if (movId > 0) activeStates[movId] = { st, rem };
                        
                        if (pmovs && pmovs[i] > 0) {
                            const pDelay = pdlys?.[i] || 0;
                            const pGreen = pedGreens?.[i] || 0;
                            const pFlash = pedFlashes?.[i] || 0;
                            const pTime = peds?.[i] || (pGreen + pFlash); // peds가 있으면 우선, 없으면 g+f
                            
                            let pSt = 'R';
                            if (sub >= pDelay && sub < pDelay + pGreen) {
                                pSt = 'G'; // 보행녹색
                            } else if (sub >= pDelay + pGreen && sub < pDelay + pTime) {
                                pSt = 'F'; // 보행점멸
                            } else {
                                pSt = 'R';
                            }

                            activeStates[pmovs[i]] = {
                                st: pSt,
                                rem: pSt !== 'R' ? Math.ceil(pDelay + pTime - sub) : (sub < pDelay ? Math.ceil(pDelay - sub) : Math.ceil(sv - sub))
                            };
                        }
                    }
                    elap += sv;
                }
            };
            calc(p.splitA, p.yellowA || activeMap.yellowA, p.allredA || activeMap.allredA, activeMap.movA, activeMap.pedA, activeMap.pedDelayA, activeMap.pedMovA, activeMap.pedGreenA, activeMap.pedFlashA);
            calc(p.splitB, p.yellowB || activeMap.yellowB, p.allredB || activeMap.allredB, activeMap.movB, activeMap.pedB, activeMap.pedDelayB, activeMap.pedMovB, activeMap.pedGreenB, activeMap.pedFlashB);
        }

        // 3. 캐시를 사용한 실제 DOM 업데이트 (변경된 경우만)
        Object.entries(j.elemCache).forEach(([key, cache]) => {
            const m = parseInt(key.split('-')[0]);
            const idx = parseInt(key.split('-')[1]);
            
            // [보완] 캐시에 엘리먼트가 없으면 재검색 시도
            if (!cache.arrow) {
                cache.arrow = document.getElementById(`icon-${j.id}-${m}-${idx}`);
                cache.timer = document.getElementById(`timer-${j.id}-${m}-${idx}`);
            }
            if (!cache || !cache.arrow) return;

            // [수정] activeStates가 {st, rem} 객체 구조임에 유의
            const stateObj = activeStates[m] || { st: 'R', rem: 0 };
            const st = stateObj.st;
            const rem = stateObj.rem;
            const walk = m >= 100 ? 'walk-mode' : '';
            
            // 클래스 업데이트 (성능을 위해 변경 시에만)
            if (cache.lastState !== st) {
                cache.arrow.className = `signal-arrow ${st} ${walk} ${editing ? 'editing' : ''}`;
                
                // [추가] 대기 중인 적색 신호(R)는 편집 모드가 아니면 숨겨서 DOM 렌더링 부하 방지
                if (st === 'R' && !editing) {
                    cache.arrow.style.display = 'none';
                } else {
                    cache.arrow.style.display = '';
                }
                
                cache.lastState = st;
            }

            // [수정] 잔여시간 타이머 업데이트 (신호 모드 ON + 선택된 교차로의 녹색/황색/점멸 신호만 표시)
            if (cache.timer) {
                const isSelected = STATE.selectedJids.includes(j.id);
                const showTimer = STATE.showSignalArrows && (isSelected || editing) && (st === 'G' || st === 'Y' || st === 'F');
                cache.timer.style.display = showTimer ? 'block' : 'none';
                if (showTimer) {
                    cache.timer.innerText = rem > 0 ? rem : '';
                }
            }
        });

        // 4. 오버레이(상세보기) 캐시 업데이트 로직
        if (j.overlayElemCache) {
            Object.entries(j.overlayElemCache).forEach(([key, cache]) => {
                if (cache.mS !== undefined) {
                    if (!cache.lensR) {
                        cache.lensR = document.getElementById(`lens-r-${j.id}-${key}`);
                        cache.lensY = document.getElementById(`lens-y-${j.id}-${key}`);
                        cache.lensA = document.getElementById(`lens-a-${j.id}-${key}`);
                        cache.lensG = document.getElementById(`lens-g-${j.id}-${key}`);
                        cache.timerC = document.getElementById(`car-timer-overlay-${j.id}-${key}`);
                        cache.lensPR = document.getElementById(`ped-lens-r-${j.id}-${key}`);
                        cache.lensPG = document.getElementById(`ped-lens-g-${j.id}-${key}`);
                        cache.timerP = document.getElementById(`ped-timer-overlay-${j.id}-${key}`);
                    }
                    
                    const sObj = activeStates[cache.mS] || { st: 'R', rem: 0 };
                    const lObj = activeStates[cache.mL] || { st: 'R', rem: 0 };
                    const pObj = activeStates[cache.mP] || { st: 'R', rem: 0 };

                    let sigS = sObj.st === 'G' ? 'green' : (sObj.st === 'Y' || sObj.st === 'F' ? (sObj.st === 'Y' ? 'yellow' : 'flash') : 'red');
                    let sigL = lObj.st === 'G' ? 'green' : (lObj.st === 'Y' || lObj.st === 'F' ? (lObj.st === 'Y' ? 'yellow' : 'flash') : 'red');
                    let sigP = pObj.st === 'G' ? 'green' : (pObj.st === 'Y' || pObj.st === 'F' ? 'flash' : 'red');

                    let carCountdown = Math.max(sObj.st !== 'R' ? sObj.rem : 0, lObj.st !== 'R' ? lObj.rem : 0);
                    if (carCountdown === 0) carCountdown = Math.max(sObj.rem, lObj.rem);
                    let pedCountdown = pObj.rem;

                    let isAnyVehActive = (sigS === 'green' || sigS === 'yellow' || sigS === 'flash' || sigL === 'green' || sigL === 'yellow' || sigL === 'flash');
                    let crOn = !isAnyVehActive;
                    let cyOn = sigS === 'yellow' || sigL === 'yellow' || sigS === 'flash' || sigL === 'flash';
                    let caOn = sigL === 'green';
                    let cgOn = sigS === 'green';

                    let prOn = sigP === 'red';
                    let pgOn = sigP === 'green' || sigP === 'flash';

                    if (cache.lensR) cache.lensR.classList.toggle('on', crOn);
                    if (cache.lensY) cache.lensY.classList.toggle('on', cyOn);
                    if (cache.lensA) cache.lensA.classList.toggle('on', caOn);
                    if (cache.lensG) cache.lensG.classList.toggle('on', cgOn);

                    if (cache.lensPR) cache.lensPR.classList.toggle('on', prOn);
                    if (cache.lensPG) cache.lensPG.classList.toggle('on', pgOn);

                    if (cache.timerC) {
                        cache.timerC.innerText = carCountdown > 0 ? carCountdown + 's' : '';
                        let carColor = '#fff';
                        if (cgOn || caOn) carColor = '#10b981';
                        else if (cyOn) carColor = '#f59e0b';
                        else if (crOn) carColor = '#ef4444';
                        cache.timerC.style.color = carColor;
                    }
                    
                    if (cache.timerP) {
                        cache.timerP.innerText = pedCountdown > 0 ? pedCountdown + 's' : '-';
                        let pedColor = '#fff';
                        if (pgOn) pedColor = '#10b981';
                        else if (prOn) pedColor = '#ef4444';
                        cache.timerP.style.color = pedColor;
                    }
                } else {
                    const m = parseInt(key.split('-')[0]);
                    const idx = parseInt(key.split('-')[1]);
                    
                    if (!cache.arrow) {
                        cache.arrow = document.getElementById(`icon-overlay-${j.id}-${m}-${idx}`);
                        cache.timer = document.getElementById(`timer-overlay-${j.id}-${m}-${idx}`);
                    }
                    if (!cache || !cache.arrow) return;

                    const stateObj = activeStates[m] || { st: 'R', rem: 0 };
                    const st = stateObj.st;
                    const rem = stateObj.rem;
                    const walk = m >= 100 ? 'walk-mode' : '';
                    
                    if (cache.lastState !== st) {
                        cache.arrow.className = `signal-arrow overlay-arrow ${st} ${walk}`;
                        cache.arrow.style.display = '';
                        cache.lastState = st;
                    }

                    if (cache.timer) {
                        const showTimer = (st === 'G' || st === 'Y' || st === 'F');
                        cache.timer.style.display = showTimer ? 'block' : 'none';
                        if (showTimer) {
                            cache.timer.innerText = rem > 0 ? rem : '';
                        }
                    }
                }
            });
        }

        // 4. 메인 마커 색상 동기화 (신호주기 모드 시에만 주기 색상 적용)
        if (j.marker) {
            const isSelected = (j.id === STATE.activeJid);
            const isMultiSelected = STATE.selectedJids.includes(j.id);
            const editing = (isSelected && STATE.isMapEditMode);
            
            // [수정] junction.js의 drawJunction 로직과 동일하게 맞춤 (주기 모드 우선)
            let markerColor = '#3498db'; // 기본 파랑
            if (isFlashActive) {
                markerColor = '#555';
            } else if (STATE.showCycleColors) {
                markerColor = getCycleColor(displayCycle);
            } else if (isSelected || editing) {
                markerColor = '#f1c40f'; // 선택됨/편집 중 (노랑)
            } else if (isMultiSelected) {
                markerColor = '#00d4ff'; // 다중 선택됨 (하늘색)
            }

            if (j._lastMarkerColor !== markerColor) {
                if (j.marker instanceof L.CircleMarker) {
                    j.marker.setStyle({ 
                        fillColor: markerColor, 
                        fillOpacity: (isMultiSelected ? 0.9 : 0.6) 
                    });
                } else if (j.marker.getElement) {
                    const inner = j.marker.getElement().querySelector('.junction-inner');
                    if (inner) inner.style.backgroundColor = markerColor;
                }
                j._lastMarkerColor = markerColor;
            }

            // [추가] 신호 모드가 실행 중(STATE.showSignalArrows)일 때만 주기 잔여 시간(Cycle Countdown) 표시
            const cTimer = document.getElementById(`cycle-timer-${j.id}`);
            if (cTimer) {
                // STATE.showSignalArrows 조건이 참일 때만 표시하도록 함
                if (STATE.showSignalArrows && isMultiSelected && !isFlashActive && j._simCycle > 0) {
                    const remCycle = Math.max(0, j._simCycle - (j._simPos || 0));
                    cTimer.innerText = Math.round(remCycle);
                    cTimer.style.display = 'block';
                } else {
                    cTimer.style.display = 'none';
                    cTimer.innerText = '';
                }
            }
        }
    });

    // [New] 현재 선택된 교차로의 정보 필드 실시간 갱신 (주기, 연동값 등)
    if (STATE.activeJid) {
        const j = STATE.junctions[STATE.activeJid];
        if (j) {
            const elCycle = document.getElementById('inp-cycle');
            const elOffset = document.getElementById('inp-offset');
            const dayIdx = editing ? STATE.currentJunctionDayTypeIdx : (getSimContext(j, t).dayIdx);
            
            // 시뮬레이션 기반 실제 주기값 우선 표시 (반올림 처리)
            if (elCycle) elCycle.value = Math.round(j._simCycle || 0);
            
            if (elOffset && typeof getCurrentOperatingOffset === 'function') {
                elOffset.value = getCurrentOperatingOffset(j, t, dayIdx);
            }
        }
    }

    // [New] 툴팁 가시성 모드인 경우 주기 등 텍스트 실시간 갱신 (성능 고려하여 툴팁 활성화 시에만)
    if (STATE.showAllTooltips || STATE.showCycleColors) {
        if (typeof refreshVisibleTooltips === 'function') refreshVisibleTooltips();
    }
}

function updateRealTime() {
    const now = new Date();
    const h = now.getHours(), m = now.getMinutes(), s = now.getSeconds();
    const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    const totalSec = h * 3600 + m * 60 + s;
    const realTimeEl = document.getElementById('real-time-display');
    if (realTimeEl) {
        realTimeEl.innerHTML = `<span style="width:8px;height:8px;background:#ff4444;border-radius:50%;box-shadow:0 0 8px #ff4444;animation:blink-signal 1.5s infinite;margin-right:5px;"></span>NOW: <span style="color:#fff;font-weight:700;font-family:'Roboto Mono',monospace;">${timeStr}</span>`;
    }
    const marker = document.getElementById('real-time-marker');
    if (marker) marker.style.left = `${(totalSec / 86400) * 100}%`;
}

function goToCurrentTime() {
    const now = new Date();
    const totalSec = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
    UI.timeSlider.value = totalSec;
    updateSim();
}

/** 10초 앞/뒤 이동 기능 */
function skipTime(seconds) {
    let t = parseInt(UI.timeSlider.value);
    t = (t + seconds + 86400) % 86400; // 24시간 범위 내 순환
    UI.timeSlider.value = t;
    updateSim();
    console.log(`[Simulation] Time skipped by ${seconds}s (Current: ${t})`);
}

/** ── 시뮬레이션 실행 / 정지 제어 ── */

/** 시뮬레이션 시작 (배속 반영) */
function startSim() {
    if (STATE.simTimer) return;

    const tick = () => {
        // 시간은 항상 1초씩 증가 (부드러운 연속성)
        let currentT = (parseInt(UI.timeSlider.value) + 1) % 86400;
        UI.timeSlider.value = currentT;
        updateSim();

        // 현재 속도 배율에 따라 다음 실행 딜레이 결정
        const delay = 1000 / (STATE.currentSpeedScale || 1);
        STATE.simTimer = setTimeout(tick, delay);
    };

    // 첫 실행 예약
    const initialDelay = 1000 / (STATE.currentSpeedScale || 1);
    STATE.simTimer = setTimeout(tick, initialDelay);

    const btn = document.getElementById('btn-play-pause');
    if (btn) btn.innerHTML = '|| PAUSE';

    const topBtn = document.getElementById('btn-signal-mode');
    if (topBtn) topBtn.classList.add('active');
    
    if (UI.stat) {
        UI.stat.innerText = "RUNNING";
        UI.stat.style.color = "#00ff88";
    }
}

/** 시뮬레이션 일시정지 */
function pauseSim() {
    if (STATE.simTimer) {
        clearTimeout(STATE.simTimer);
        STATE.simTimer = null;
    }

    const btn = document.getElementById('btn-play-pause');
    if (btn) btn.innerHTML = '▶ PLAY';

    if (UI.stat) {
        UI.stat.innerText = "PAUSED";
        UI.stat.style.color = "#ff4444";
    }
    console.log("SIGMA - Simulation Paused.");
}

/** [인터페이스] 재생/정지 토글 (하단 버튼용) */
function toggleSim() {
    if (STATE.simTimer) pauseSim();
    else startSim();
}

/** [인터페이스] 시뮬레이션 속도 설정 */
function setSpeed(val) {
    const wasRunning = !!STATE.simTimer;
    if (wasRunning) pauseSim(); // 기존 타이머 중지
    
    STATE.currentSpeedScale = val;
    
    // UI 버튼 상태 업데이트
    document.querySelectorAll('.btn-speed').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // 선택된 버튼 강조 (ID 기반: sp-1, sp-4, sp-8)
    const idMap = { 1: 'sp-1', 4: 'sp-4', 8: 'sp-8' };
    const targetId = idMap[val];
    if (targetId) {
        const targetBtn = document.getElementById(targetId);
        if (targetBtn) targetBtn.classList.add('active');
    }
    
    if (UI.simSpeed) {
        const labels = { 1: '1.0x (Real)', 4: '4.0x', 8: '8.0x' };
        UI.simSpeed.innerText = `SPEED: ${labels[val] || (val + 'x')}`;
    }
    
    console.log(`SIGMA - Speed set to ${val}x`);
    
    if (wasRunning) startSim(); // 즉시 새로운 속도로 재개
}

/**
 * [고도화] 이미지 기반 실시간 신호 상세 패널 렌더링
 */
function renderDetailedAPIPanel(j, steps, t) {
    const tableBody = document.getElementById('api-table-body');
    const titleText = document.getElementById('panel-title-text');
    const statIntNo = document.getElementById('stat-int-no');
    const statCycle = document.getElementById('stat-cycle');
    const statTime = document.getElementById('stat-time');
    
    if (!tableBody || steps.length === 0) return;

    // 타이틀 및 기본 스탯 업데이트
    const regionName = document.getElementById('api-region-select').options[document.getElementById('api-region-select').selectedIndex].text;
    titleText.innerText = `[${regionName}] ${j.name || j.id}`;
    statIntNo.innerText = j.id;
    
    const cycle = steps.reduce((sum, item) => sum + parseInt(item.MIN_TM), 0);
    statCycle.innerText = `${cycle}s`;
    statTime.innerText = new Date().toLocaleString();

    // 현재 스텝 계산
    const currentPos = t % cycle;
    let accum = 0;
    let activeStep = null;
    for (const step of steps) {
        accum += parseInt(step.MIN_TM);
        if (currentPos < accum) {
            activeStep = step;
            break;
        }
    }

    if (!activeStep) return;

    // [수정] UTIC 표준 8방향 고정 매핑 (접근로 기준: 북은 북에서 남으로 진행하는 방향)
    const directionNames = [
        "북 (북→남)",   // CAR1
        "북동 (북동→남서)", // CAR2
        "동 (동→서)",   // CAR3
        "남동 (남동→북서)", // CAR4
        "남 (남→북)",   // CAR5
        "남서 (남서→북동)", // CAR6
        "서 (서→동)",   // CAR7
        "북서 (북서→남동)"  // CAR8
    ];
    
    // 출력형태 매핑 (API에서 제공되는 정보가 없을 시 기본값)
    const typeNames = ["직진/좌회전", "직진/좌회전", "직진/좌회전", "직진/좌회전", "직진/좌회전", "직진/좌회전", "직진/좌회전", "직진/좌회전"];


    let html = "";
    for (let i = 1; i <= 8; i++) {
        const isOn = activeStep[`CAR${i}`] === "1";
        const statusText = isOn ? "녹색 점등(3)" : "적색 점등(1)";
        const statusColor = isOn ? "#2ecc71" : "#e74c3c";
        const remaining = isOn ? (accum - currentPos) : "-"; // 잔여시간 계산

        html += `
            <tr>
                <td>${directionNames[i-1] || i}</td>
                <td>${typeNames[i-1] || "-"}</td>
                <td style="color:${statusColor}; font-weight:bold;">${statusText}</td>
                <td style="color:#00f3ff;">${remaining}</td>
                <td>${activeStep.MIN_TM}</td>
            </tr>
        `;
    }
    tableBody.innerHTML = html;
}

window.toggleBottomPanel = function() {
    const panel = document.getElementById('bottom-detail-panel');
    if (panel) panel.classList.toggle('active');
};

/**
 * [추가] 지역별 교차로 목록 로드 및 사이드바 갱신
 */
window.updateJunctionListByRegion = async function(regionCode) {
    // 기존 UTIC API 기반 목록 생성을 중단하고 로컬 CSV(STATE.junctions) 기반 렌더링 사용
    if (typeof renderJunctionList === 'function') {
        renderJunctionList();
    }
};

/**
 * [추가] 사이드바 아이템 클릭 시 교차로 선택 및 지도 이동
 */
window.selectApiJunction = function(id, name, lat, lng) {
    console.log(`[API] 교차로 선택: ${name} (${id})`);
    
    // 1. 해당 위치로 지도 이동
    if (typeof map !== 'undefined') {
        map.flyTo([lat, lng], 18);
    }
    
    // 2. STATE.junctions에 임시 등록 (기존에 없으면)
    const regionCode = document.getElementById('api-region-select').value;
    if (!STATE.junctions[id]) {
        STATE.junctions[id] = {
            id: id,
            name: name,
            lat: lat,
            lng: lng,
            regionCode: regionCode,
            _realtimeItems: []
        };
    } else {
        STATE.junctions[id].regionCode = regionCode; // 지역코드 업데이트
    }
    
    // 3. API 수신 강제 트리거
    if (STATE.signalSource === 'REALTIME') {
        fetchRealtimeSignals();
    }
    
    // 4. 하단 패널 활성화
    const panel = document.getElementById('bottom-detail-panel');
    if (panel) panel.classList.add('active');
};


