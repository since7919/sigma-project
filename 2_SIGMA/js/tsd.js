/**
 * Time-Space Diagram (TSD) Engine v3.2 — Max Band Theory (Final)
 * - Max Band 전수 탐색 (0.25s 해상도)
 * - 듀얼 링(Dual-Ring) Miovision-style 시각화
 * - 하이브리드 렌더링: 밴드 폴리곤 + 비연동 궤적선
 * - 오프셋 드래그 → 실시간 밴드 이동
 */

// ── TSDAnalyzer: Max Band 대역폭 계산 엔진 ──
class TSDAnalyzer {

    /**
     * 특정 교차로의 연동 방향 녹색 시작/길이 반환
     * 폴백: 정확한 이동류가 없으면 Ring A의 최대 녹색 현시 선택
     */
    static getGreenWindow(j, axis, dir, dayIdx, pIdx, cycle) {
        const smIdx = (j.dayPlanMapIds && j.dayPlanMapIds[dayIdx]) ? j.dayPlanMapIds[dayIdx] : 0;
        const sm = (j.signalMaps && j.signalMaps[smIdx]) ? j.signalMaps[smIdx] : null;
        if (!sm) return null;

        const tod = (j.dayPlans && j.dayPlans[dayIdx]) ? j.dayPlans[dayIdx][pIdx] : null;
        if (!tod) return null;
        const offset = tod.offset || 0;

        const targetMov = (dir === 'up') ? (axis === 'ew' ? 2 : 4) : (axis === 'ew' ? 6 : 8);

        // [개선] 특정 이동류가 포함된 모든 현시 인덱스 추출
        let ringIdx = -1;
        let targetIdxs = [];
        let splits = [];
        let yellows = [];

        const idxsA = [];
        (sm.movA || []).forEach((m, idx) => { if (m === targetMov) idxsA.push(idx); });
        const idxsB = [];
        (sm.movB || []).forEach((m, idx) => { if (m === targetMov) idxsB.push(idx); });

        if (idxsA.length > 0) {
            ringIdx = 0; targetIdxs = idxsA; splits = tod.splitA || []; yellows = sm.yellowA || [];
        } else if (idxsB.length > 0) {
            ringIdx = 1; targetIdxs = idxsB; splits = tod.splitB || []; yellows = sm.yellowB || [];
        }

        if (targetIdxs.length === 0) return null;

        // [핵심] 연속된 현시가 동일 이동류를 사용하는지 확인하여 밴드 확장
        // 분석 효율을 위해 첫 번째 나타나는 묶음(Consecutive Block)을 기준으로 연동 대역 설정
        const startPhaseIdx = targetIdxs[0];
        let accT = 0;
        for (let s = 0; s < startPhaseIdx; s++) accT += (splits[s] || 0);

        let totalGreenDuration = 0;
        for (let k = 0; k < targetIdxs.length; k++) {
            const currIdx = targetIdxs[k];
            
            // 비연속적인 경우(예: 1,2현시 후 5현시에서 다시 나옴)는 별개 대역으로 간주하여 첫 블록만 합산
            if (k > 0 && targetIdxs[k] !== targetIdxs[k-1] + 1) break;

            const sTime = splits[currIdx] || 0;
            const yTime = yellows[currIdx] || 0;

            // 다음 현시도 동일 이동류라면 황색 시간을 빼지 않고 전체 합산
            const isNextSame = (k < targetIdxs.length - 1 && targetIdxs[k+1] === currIdx + 1);
            if (isNextSame) {
                totalGreenDuration += sTime;
            } else {
                totalGreenDuration += Math.max(0, sTime - yTime);
            }
        }

        if (totalGreenDuration <= 0) return null;

        const gStart = ((offset + accT) % cycle + cycle) % cycle;
        return { gStart, gLen: totalGreenDuration };
    }

    /**
     * Max Band Brute-Force Sweep (유효 교차로만 대상)
     * null 교차로를 완전히 제외한 별도 배열로 계산
     */
    static calculateBandwidth(dir, axis, members, distances, totalDist, cycle, travelTimes, dayIdx, pIdx) {
        if (!members || members.length < 2 || cycle <= 0)
            return { width: 0, start: 0, validCount: 0 };

        const totalTT = travelTimes[travelTimes.length - 1] || 1;

        const validNodes = [];
        for (let i = 0; i < members.length; i++) {
            const g = this.getGreenWindow(members[i], axis, dir, dayIdx, pIdx, cycle);
            if (g) {
                validNodes.push({ idx: i, tt: travelTimes[i], green: g });
            }
        }
        if (validNodes.length < 2) return { width: 0, start: 0, validCount: validNodes.length };

        let bestW = 0, bestS = 0;

        for (let t = 0; t < cycle; t += 0.25) {
            let minR = cycle, ok = true;

            for (const node of validNodes) {
                const travel = (dir === 'up') ? node.tt : (totalTT - node.tt);
                const arrival = ((t + travel) % cycle + cycle) % cycle;
                const gS = node.green.gStart;
                const gE = (gS + node.green.gLen) % cycle;

                const isGreen = (gS < gE)
                    ? (arrival >= gS && arrival < gE)
                    : (arrival >= gS || arrival < gE);

                if (!isGreen) { ok = false; break; }

                const rem = (gS < gE)
                    ? (gE - arrival)
                    : (arrival >= gS ? cycle - arrival + gE : gE - arrival);
                minR = Math.min(minR, rem);
            }
            if (ok && minR > bestW) { bestW = minR; bestS = t; }
        }

        return { width: bestW, start: bestS, validCount: validNodes.length };
    }
}

// ── TSDEngine: 렌더링 & 인터랙션 ──
class TSDEngine {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');

        this.config = {
            padding: { top: 90, bottom: 60, left: 140, right: 60 },
            colors: {
                bg: '#f5f5f5',
                grid: 'rgba(0, 0, 0, 0.08)',
                accent: '#0088cc',
                green: '#22cc44',
                yellow: '#ddaa00',
                red: '#dd2222',
                bandUp: 'rgba(0, 100, 220, 0.15)',
                bandDown: 'rgba(0, 160, 220, 0.15)',
                bandUpStroke: 'rgba(0, 80, 200, 0.90)',
                bandDownStroke: 'rgba(0, 160, 220, 0.90)',
                trajUp: 'rgba(0, 80, 200, 0.85)',
                trajDown: 'rgba(0, 160, 220, 0.85)',
                wait: '#dd2222'
            },
            trajectories: { up: '#0050c8', down: '#00a0dc' },
            font: {
                base: '11px "Outfit", "Inter", sans-serif',
                bold: 'bold 12px "Outfit", "Inter", sans-serif',
                mono: '10px "JetBrains Mono", monospace'
            }
        };

        this.state = {
            gid: null, members: [], totalDist: 0, distances: [],
            cycle: 100, viewOffsetT: 0,
            isDragging: false, isDraggingOffset: false,
            dragJid: null, lastX: 0,
            yCoords: [], todIdx: 0,
            segSpeeds: [],    // 구간별 속도 (km/h), 길이 = members.length - 1
            travelTimes: []   // 누적 주행시간 (초), 길이 = members.length
        };

        this.initEvents();
        window.addEventListener('resize', () => this.render());
    }

    initEvents() {
        const getHitJid = (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const mx = e.clientX - rect.left;
            const my = (e.clientY - rect.top) / (window.devicePixelRatio || 1);
            if (mx < this.config.padding.left) return null;
            for (let item of this.state.yCoords) {
                if (Math.abs(my - item.y) < 20) return item.id;
            }
            return null;
        };

        this.canvas.addEventListener('mousemove', (e) => {
            if (this.state.isDragging || this.state.isDraggingOffset) return;
            this.canvas.style.cursor = getHitJid(e) ? 'ew-resize' : 'grab';
        });

        this.canvas.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            const hitJid = getHitJid(e);
            this.state.lastX = e.clientX;
            if (hitJid) {
                this.state.isDraggingOffset = true;
                this.state.dragJid = hitJid;
                this.canvas.style.cursor = 'ew-resize';
            } else {
                this.state.isDragging = true;
                this.canvas.style.cursor = 'grabbing';
            }
            e.preventDefault();
        });

        window.addEventListener('mousemove', (e) => {
            if (!this.state.isDragging && !this.state.isDraggingOffset) return;
            const deltaX = e.clientX - this.state.lastX;
            const chartW = this.canvas.clientWidth - this.config.padding.left - this.config.padding.right;
            const timeDelta = (deltaX / chartW) * (this.state.cycle * 2.5);

            if (this.state.isDraggingOffset) {
                const j = STATE.junctions[this.state.dragJid];
                const dayIdx = STATE.currentGroupDayTypeIdx || 0;
                const pIdx = this.state.todIdx;
                if (j && j.dayPlans && j.dayPlans[dayIdx] && j.dayPlans[dayIdx][pIdx]) {
                    const plan = j.dayPlans[dayIdx][pIdx];
                    let newOff = (plan.offset || 0) + timeDelta;
                    newOff = ((newOff % this.state.cycle) + this.state.cycle) % this.state.cycle;
                    plan.offset = Math.round(newOff * 10) / 10;
                    if (typeof renderGroupTODTable === 'function') renderGroupTODTable();
                }
            } else {
                this.state.viewOffsetT -= timeDelta;
            }
            this.state.lastX = e.clientX;
            this.render();
        });

        window.addEventListener('mouseup', () => {
            this.state.isDragging = false;
            this.state.isDraggingOffset = false;
            this.state.dragJid = null;
            this.canvas.style.cursor = 'grab';
        });

        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            this.state.viewOffsetT += e.deltaY * 0.1;
            this.render();
        });
    }

    update(gid) {
        if (!gid) return;
        this.state.gid = gid;
        
        // [신규] 선택된 설정 세트 인덱스 확인
        const setSelector = document.getElementById('tsd-config-set');
        const setIdx = setSelector ? parseInt(setSelector.value) : 0;
        const group = STATE.groups[gid];
        const config = (group && group.tsdConfigs) ? group.tsdConfigs[setIdx] : null;

        let members = [];
        let dists = [];
        let total = 0;

        // [A] 저장된 설정 세트가 활성화된 경우 (순서 및 거리 데이터 존재 시)
        if (config && config.enabled && config.order && config.order.length >= 2) {
            members = config.order.map(jid => STATE.junctions[jid]).filter(Boolean);
            
            if (members.length >= 2) {
                dists = [0];
                for (let i = 0; i < members.length - 1; i++) {
                    const d = parseFloat(config.distances[i]) || 0;
                    total += d;
                    dists.push(total);
                }
            }
        }

        // [B] 설정 세트가 없거나 유효하지 않은 경우: 기존 로직(자동 순서/거리) 사용
        if (members.length < 2) {
            members = Object.values(STATE.junctions).filter(j => String(j.group) === String(gid));
            const valid = members.filter(j => 
                j.extra && 
                j.extra.diagramOrder !== undefined && 
                j.extra.diagramOrder !== -1 && 
                !j.extra.excludeFromTsd
            );
            members = (valid.length >= 2)
                ? valid.sort((a, b) => (a.extra.diagramOrder || 0) - (b.extra.diagramOrder || 0))
                : members.sort((a, b) => String(a.id).localeCompare(String(b.id)));

            if (members.length >= 2) {
                dists = [0];
                for (let i = 1; i < members.length; i++) {
                    const m = members[i];
                    let d = (m.extra && m.extra.diagramDistDisp !== undefined && m.extra.diagramDistDisp !== null) 
                        ? m.extra.diagramDistDisp 
                        : getHaversineDistance(members[i - 1].lat, members[i - 1].lng, m.lat, m.lng);
                    total += d;
                    dists.push(total);
                }
            }
        }

        if (members.length < 2) {
            this.state.members = [];
            const info = document.getElementById('tsd-info-text');
            if (info) info.innerText = "교차로가 2개 이상인 그룹을 선택하세요.";
            this.render();
            return;
        }

        this.state.members = members;
        this.state.distances = dists;
        this.state.totalDist = total;

        // [개선] 콘솔의 선택기(Selectors) 값을 우선적으로 사용
        const daySelector = document.getElementById('tsd-day-plan');
        const timeSelector = document.getElementById('tsd-time-slot');
        
        const dayIdx = (daySelector) ? parseInt(daySelector.value) : (STATE.currentGroupDayTypeIdx || 0);
        const pIdx = (timeSelector && timeSelector.value !== "") ? parseInt(timeSelector.value) : ((typeof STATE !== 'undefined' && STATE.selectedTodPlanIdx !== undefined) ? STATE.selectedTodPlanIdx : 0);

        this.state.todIdx = pIdx;
        this.state.cycle = (members[0].schedules && members[0].schedules[dayIdx] && members[0].schedules[dayIdx][pIdx])
            ? (members[0].schedules[dayIdx][pIdx].cycle || 100) : 100;

        // 속도 설정을 segSpeeds에 반영하여 기울기(주행시간)가 변하도록 함
        const defaultSpd = parseFloat(document.getElementById('tsd-speed').value) || 50;
        this.state.segSpeeds = new Array(Math.max(0, members.length - 1)).fill(defaultSpd);
        
        this._updateTravelTimes();
        this.render();
    }

    /** [추가] 구간별 속도(segSpeeds)를 바탕으로 누적 주행시간(travelTimes) 계산 */
    _updateTravelTimes() {
        if (!this.state.members || this.state.members.length < 2) return;
        const dists = this.state.distances;
        const speeds = this.state.segSpeeds;
        const tt = [0];
        let acc = 0;
        for (let i = 1; i < dists.length; i++) {
            const d = dists[i] - dists[i - 1];
            const v = (speeds[i - 1] || 50) / 3.6; // km/h -> m/s
            acc += d / v;
            tt.push(acc);
        }
        this.state.travelTimes = tt;
    }

    render() {
        if (!this.canvas) return;
        const container = this.canvas.parentElement;
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = container.clientWidth * dpr;
        this.canvas.height = container.clientHeight * dpr;
        this.ctx.scale(dpr, dpr);

        const w = container.clientWidth, h = container.clientHeight;
        const cfg = this.config, ctx = this.ctx;
        ctx.fillStyle = cfg.colors.bg;
        ctx.fillRect(0, 0, w, h);

        if (this.state.members.length < 2) {
            this.drawMessage("교차로 순서를 설정하거나 그룹을 선택하세요.");
            return;
        }

        const chartW = w - cfg.padding.left - cfg.padding.right;
        const chartH = h - cfg.padding.top - cfg.padding.bottom;
        const cycle = this.state.cycle;
        const timeHorizon = cycle * 2.5;
        
        const daySelector = document.getElementById('tsd-day-plan');
        const dayIdx = (daySelector) ? parseInt(daySelector.value) : (STATE.currentGroupDayTypeIdx || 0);
        
        const axisEl = document.querySelector('input[name="tsd-axis"]:checked');
        const axis = axisEl ? axisEl.value : 'ew';

        // 구간별 주행시간 갱신
        this._updateTravelTimes();
        const travelTimes = this.state.travelTimes;

        // Max Band 계산 (구간별 속도 기반)
        const bandUp = TSDAnalyzer.calculateBandwidth('up', axis, this.state.members, this.state.distances, this.state.totalDist, cycle, travelTimes, dayIdx, this.state.todIdx);
        const bandDown = TSDAnalyzer.calculateBandwidth('down', axis, this.state.members, this.state.distances, this.state.totalDist, cycle, travelTimes, dayIdx, this.state.todIdx);

        // 좌표 변환 헬퍼
        const xF = chartW / timeHorizon;
        const tToX = (t) => cfg.padding.left + (t - this.state.viewOffsetT) * xF;
        const ringMargin = 20; // 듀얼 링이 클리핑되지 않도록 상하 여백 확보
        const distToY = (d) => cfg.padding.top + ringMargin + (1 - d / (this.state.totalDist || 1)) * (chartH - ringMargin * 2);

        // 클리핑
        ctx.save();
        ctx.beginPath();
        ctx.rect(cfg.padding.left, cfg.padding.top, chartW, chartH);
        ctx.clip();

        // 그리드
        ctx.strokeStyle = cfg.colors.grid; ctx.lineWidth = 1;
        for (let t = -cycle; t < timeHorizon + cycle; t += 20) {
            const x = tToX(t);
            ctx.beginPath(); ctx.moveTo(x, cfg.padding.top); ctx.lineTo(x, h - cfg.padding.bottom); ctx.stroke();
        }

        // 1) 듀얼 링 신호 바
        this.state.yCoords = [];
        this.state.members.forEach((j, i) => {
            const y = distToY(this.state.distances[i]);
            this.state.yCoords.push({ id: j.id, y });
            ctx.strokeStyle = 'rgba(0,0,0,0.06)';
            ctx.beginPath(); ctx.moveTo(cfg.padding.left, y); ctx.lineTo(w - cfg.padding.right, y); ctx.stroke();
            this.drawDualRingBars(j, y, chartW, timeHorizon, xF, dayIdx, axis);
        });

        // 2) 밴드/궤적 오버레이
        this.drawHybridBand('up', bandUp, timeHorizon, xF, tToX, distToY, dayIdx, axis);
        this.drawHybridBand('down', bandDown, timeHorizon, xF, tToX, distToY, dayIdx, axis);

        ctx.restore();

        // 3) 라벨
        this.state.members.forEach((j, i) => {
            const y = distToY(this.state.distances[i]);
            const pIdx = this.state.todIdx;
            const curOffset = (j.dayPlans && j.dayPlans[dayIdx] && j.dayPlans[dayIdx][pIdx]) ? (j.dayPlans[dayIdx][pIdx].offset || 0) : 0;

            // 라벨 배경
            ctx.fillStyle = 'rgba(245,245,245,0.95)';
            ctx.fillRect(0, y - 26, cfg.padding.left - 2, 52);

            // 교차로명
            ctx.textAlign = 'right';
            ctx.fillStyle = '#222222';
            ctx.font = 'bold 12px "Outfit", "Inter", sans-serif';
            let name = j.name || j.id;
            if (name.length > 9) name = name.substring(0, 8) + '..';
            ctx.fillText(name, cfg.padding.left - 8, y - 6);

            // 거리
            ctx.fillStyle = '#2e7d32';
            ctx.font = 'bold 10px "JetBrains Mono", monospace';
            ctx.fillText(`▸ ${Math.round(this.state.distances[i])}m`, cfg.padding.left - 8, y + 8);

            // 오프셋
            ctx.fillStyle = curOffset !== 0 ? '#c75000' : '#888';
            ctx.font = 'bold 10px "JetBrains Mono", monospace';
            ctx.fillText(`⊕ ${Math.round(curOffset)}s`, cfg.padding.left - 8, y + 22);
        });

        // 시간축 눈금
        ctx.fillStyle = '#555'; ctx.font = cfg.font.mono; ctx.textAlign = 'center';
        for (let t = 0; t < timeHorizon; t += 20) {
            const x = tToX(t);
            if (x > cfg.padding.left && x < w - cfg.padding.right) {
                ctx.fillText(`${Math.round(t)}s`, x, h - cfg.padding.bottom + 18);
            }
        }

        this.updateInfoText(bandUp, bandDown);
    }

    // ── 듀얼 링(Dual-Ring) ──
    drawDualRingBars(j, y, chartW, timeHorizon, xF, dayIdx, axis) {
        const pIdx = this.state.todIdx, cycle = this.state.cycle;
        const tod = (j.dayPlans && j.dayPlans[dayIdx]) ? j.dayPlans[dayIdx][pIdx] : null;
        if (!tod) return;
        const offset = tod.offset || 0;

        const smIdx = (j.dayPlanMapIds && j.dayPlanMapIds[dayIdx]) ? j.dayPlanMapIds[dayIdx] : 0;
        const sm = (j.signalMaps && j.signalMaps[smIdx]) ? j.signalMaps[smIdx] : null;
        if (!sm) return;

        const proceedMovs = (axis === 'ew') ? [2, 6] : [4, 8];  // 진행 가능
        const blockedMovs = (axis === 'ew') ? [4, 8] : [2, 6];  // 진행 불가(교차 방향)
        const ringH = 12, gap = 3;
        const ctx = this.ctx, cfg = this.config;

        // 배경
        ctx.fillStyle = "rgba(240,240,240,0.65)";
        ctx.fillRect(cfg.padding.left, y - ringH - gap - 1, chartW, (ringH + gap) * 2 + 2);

        const drawRing = (splits, yellows, movs, isBottom) => {
            if (!splits || splits.length === 0) return;
            const yPos = isBottom ? (y + gap) : (y - gap - ringH);
            let currentT = 0;

            splits.forEach((splitTime, idx) => {
                if (splitTime <= 0) { currentT += splitTime; return; }
                const yellowTime = (yellows && yellows[idx]) ? yellows[idx] : 0;
                const greenTime = Math.max(0, splitTime - yellowTime);
                const curMov = (movs && movs[idx]) ? movs[idx] : 0;
                
                // [개선] 다음 현시가 동일 이동류인지 체크 (연속 등화)
                const nextMov = (movs && movs[idx+1] !== undefined) ? movs[idx+1] : -1;
                const isContinuous = (curMov !== 0 && curMov === nextMov);

                for (let rep = -3; rep <= 3; rep++) {
                    const t0 = offset + currentT + rep * cycle - this.state.viewOffsetT;
                    const xS = cfg.padding.left + t0 * xF;
                    const xG = cfg.padding.left + (t0 + greenTime) * xF;
                    const xE = cfg.padding.left + (t0 + splitTime) * xF;

                    if (xE < cfg.padding.left || xS > cfg.padding.left + chartW) continue;

                    if (proceedMovs.includes(curMov)) {
                        // 진행 가능 이동류: 녹색/청록 + 황색
                        ctx.fillStyle = isBottom ? cfg.colors.accent : cfg.colors.green;
                        if (isContinuous) {
                            // 연속 현시인 경우 황색 무시하고 전체 녹색
                            this.drawSegment(xS, yPos, xE - xS, ringH);
                        } else {
                            this.drawSegment(xS, yPos, xG - xS, ringH);
                            if (yellowTime > 0) {
                                ctx.fillStyle = cfg.colors.yellow;
                                this.drawSegment(xG, yPos, xE - xG, ringH);
                            }
                        }
                    } else if (blockedMovs.includes(curMov)) {
                        // 교차 방향 이동류: 적색
                        ctx.fillStyle = "rgba(220, 30, 30, 0.85)";
                        this.drawSegment(xS, yPos, xE - xS, ringH);
                    } else if (curMov >= 1 && curMov <= 8) {
                        // 기타 차량(좌회전 등): 중성 청색
                        ctx.fillStyle = "rgba(60, 130, 200, 0.70)";
                        if (isContinuous) {
                            this.drawSegment(xS, yPos, xE - xS, ringH);
                        } else {
                            this.drawSegment(xS, yPos, xG - xS, ringH);
                            if (yellowTime > 0) {
                                ctx.fillStyle = "rgba(200, 170, 0, 0.75)";
                                this.drawSegment(xG, yPos, xE - xG, ringH);
                            }
                        }
                    } else {
                        // 보행자/미설정
                        ctx.fillStyle = "rgba(220, 30, 30, 0.40)";
                        this.drawSegment(xS, yPos, xE - xS, ringH);
                    }

                    const segW = xE - xS;
                    if (segW > 14) this.drawPhaseArrow(xS + segW / 2, yPos + ringH / 2, curMov);

                    ctx.fillStyle = 'rgba(0,0,0,0.15)';
                    ctx.fillRect(xE - 0.5, yPos, 1, ringH);
                }
                currentT += splitTime;
            });
        };

        drawRing(tod.splitA, sm.yellowA, sm.movA, false);
        drawRing(tod.splitB, sm.yellowB, sm.movB, true);

        // Barrier 구분선
        ctx.strokeStyle = 'rgba(0,0,0,0.12)';
        ctx.setLineDash([2, 3]);
        ctx.beginPath(); ctx.moveTo(cfg.padding.left, y); ctx.lineTo(cfg.padding.left + chartW, y); ctx.stroke();
        ctx.setLineDash([]);
    }

    // ── 하이브리드 밴드/궤적 렌더링 ──
    drawHybridBand(dir, band, timeHorizon, xF, tToX, distToY, dayIdx, axis) {
        const ctx = this.ctx, cfg = this.config, cycle = this.state.cycle;
        const members = this.state.members, distances = this.state.distances, totalDist = this.state.totalDist;
        const isUp = (dir === 'up');

        if (band.width > 0) {
            // ── 연동폭 밴드 폴리곤 ──
            const fillColor = isUp ? cfg.colors.bandUp : cfg.colors.bandDown;
            const strokeColor = isUp ? cfg.colors.bandUpStroke : cfg.colors.bandDownStroke;

            for (let rep = -3; rep <= 3; rep++) {
                const startT = band.start + rep * cycle;
                const fwdPts = [], bwdPts = [];

                // UP: 하단(1번)→상단 순서, DOWN: 상단(마지막)→하단 순서
                const indices = isUp
                    ? members.map((_, i) => i)
                    : members.map((_, i) => i).reverse();

                const totalTT = this.state.travelTimes[this.state.travelTimes.length - 1] || 1;

                for (const i of indices) {
                    const dist = distances[i];
                    const travel = isUp ? this.state.travelTimes[i] : (totalTT - this.state.travelTimes[i]);
                    const y = distToY(dist);
                    fwdPts.push({ x: tToX(startT + travel), y });
                    bwdPts.push({ x: tToX(startT + band.width + travel), y });
                }

                ctx.fillStyle = fillColor;
                ctx.beginPath();
                fwdPts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
                for (let i = bwdPts.length - 1; i >= 0; i--) ctx.lineTo(bwdPts[i].x, bwdPts[i].y);
                ctx.closePath();
                ctx.fill();

                // 윤곽선 (방향 기준점에서 출발)
                ctx.strokeStyle = strokeColor; ctx.lineWidth = 1.5;
                ctx.beginPath();
                fwdPts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
                ctx.stroke();
                ctx.beginPath();
                bwdPts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
                ctx.stroke();
            }
        } else {
            // ── 비연동: 궤적선 + 정차 표현 ──
            const pIdx = this.state.todIdx;
            const trajColor = isUp ? cfg.colors.trajUp : cfg.colors.trajDown;
            const sortedIdx = isUp
                ? members.map((_, i) => i)
                : members.map((_, i) => i).reverse();

            for (let rep = -1; rep <= 2; rep++) {
                const totalTT = this.state.travelTimes[this.state.travelTimes.length - 1] || 1;
                const baseT = rep * cycle + 10;

                ctx.beginPath(); ctx.strokeStyle = trajColor; ctx.lineWidth = 1.5;
                
                // 첫 시작점 설정
                const firstIdx = sortedIdx[0];
                const firstTravel = isUp ? this.state.travelTimes[firstIdx] : (totalTT - this.state.travelTimes[firstIdx]);
                ctx.moveTo(tToX(baseT + firstTravel), distToY(distances[firstIdx]));

                for (const idx of sortedIdx) {
                    const nodeDist = distances[idx];
                    const travel = isUp ? this.state.travelTimes[idx] : (totalTT - this.state.travelTimes[idx]);
                    let t = baseT + travel;
                    ctx.lineTo(tToX(t), distToY(nodeDist));

                    const g = TSDAnalyzer.getGreenWindow(members[idx], axis, dir, dayIdx, pIdx, cycle);
                    if (!g) continue;

                    const arr = ((t % cycle) + cycle) % cycle;
                    const gS = g.gStart, gE = (gS + g.gLen) % cycle;
                    const isGreen = (gS < gE) ? (arr >= gS && arr < gE) : (arr >= gS || arr < gE);

                    if (!isGreen) {
                        ctx.stroke();
                        let wait;
                        if (gS < gE) {
                            wait = (arr < gS) ? (gS - arr) : (cycle - arr + gS);
                        } else {
                            wait = (arr >= gE && arr < gS) ? (gS - arr) : 0;
                        }
                        if (wait <= 0) wait = 1;

                        // 정차 대기선
                        ctx.beginPath(); ctx.strokeStyle = cfg.colors.wait; ctx.lineWidth = 2;
                        ctx.setLineDash([3, 2]);
                        ctx.moveTo(tToX(t), distToY(nodeDist));
                        t += wait;
                        ctx.lineTo(tToX(t), distToY(nodeDist));
                        ctx.stroke(); ctx.setLineDash([]);

                        ctx.fillStyle = cfg.colors.wait;
                        ctx.beginPath(); ctx.arc(tToX(t - wait), distToY(nodeDist), 3, 0, Math.PI * 2); ctx.fill();

                        ctx.beginPath(); ctx.strokeStyle = trajColor; ctx.lineWidth = 1.5;
                        ctx.moveTo(tToX(t), distToY(nodeDist));
                    }
                }
                ctx.stroke();
            }
        }
    }

    // ── 유틸리티 ──
    drawPhaseArrow(x, y, m) {
        if (m <= 0) return;
        this.ctx.save();
        this.ctx.fillStyle = 'rgba(0,0,0,0.7)';
        this.ctx.font = 'bold 8px "JetBrains Mono", monospace';
        this.ctx.textAlign = 'center'; this.ctx.textBaseline = 'middle';
        this.ctx.fillText(m >= 100 ? 'W' : m, x, y);
        this.ctx.restore();
    }

    drawSegment(x, y, w, h) {
        if (w <= 0) return;
        const left = this.config.padding.left;
        const right = this.canvas.width / (window.devicePixelRatio || 1) - this.config.padding.right;
        const dX = Math.max(left, x);
        const dW = Math.min(right, x + w) - dX;
        if (dW > 0) this.ctx.fillRect(dX, y, dW, h);
    }

    drawMessage(msg) {
        const dpr = window.devicePixelRatio || 1;
        this.ctx.fillStyle = '#888'; this.ctx.font = this.config.font.base; this.ctx.textAlign = 'center';
        this.ctx.fillText(msg, this.canvas.width / (2 * dpr), this.canvas.height / (2 * dpr));
    }

    updateInfoText(bandUp, bandDown) {
        const info = document.getElementById('tsd-info-text');
        if (!info || this.state.members.length < 2) return;
        const c = this.state.cycle;
        const effUp = Math.round((bandUp.width / c) * 100);
        const effDown = Math.round((bandDown.width / c) * 100);
        const speed = document.getElementById('tsd-speed').value || '50';
        const total = this.state.members.length;
        const vUp = bandUp.validCount || 0;
        const vDown = bandDown.validCount || 0;

        const upLabel = bandUp.width > 0
            ? `<b>${Math.round(bandUp.width)}s (${effUp}%)</b>`
            : `<span style="color:${this.config.colors.wait}">비연동</span>`;
        const downLabel = bandDown.width > 0
            ? `<b>${Math.round(bandDown.width)}s (${effDown}%)</b>`
            : `<span style="color:${this.config.colors.wait}">비연동</span>`;

        const dayIdx = (document.getElementById('tsd-day-plan')) ? parseInt(document.getElementById('tsd-day-plan').value) : (STATE.currentGroupDayTypeIdx || 0);
        const dayNo = dayIdx + 1;
        const planNo = (this.state.todIdx || 0) + 1;

        info.innerHTML = `
            <span style="color:#0050c8;font-weight:700;">[일계획 ${dayNo} #${planNo}]</span>
            <span style="color:${this.config.trajectories.up}">●</span> 상행: ${upLabel} |
            <span style="color:${this.config.trajectories.down}">●</span> 하행: ${downLabel} |
            주기: ${c}s | 속도: ${speed}km/h |
            <span style="opacity:0.5">분석: ${Math.max(vUp, vDown)}/${total}개</span>
        `;
    }
}

const TSD_ENGINE = new TSDEngine('tsd-canvas');

// 초기 오프셋 스냅샷 저장소
let _tsdOffsetSnapshot = {};

/**
 * [추가] TSD 콘솔의 시간대(Time Slot) 선택기 업데이트
 */
function updateTsdTimeSlots() {
    if (typeof currentEditingGroup === 'undefined' || !currentEditingGroup) return;
    const gid = currentEditingGroup;
    const daySelector = document.getElementById('tsd-day-plan');
    const timeSelector = document.getElementById('tsd-time-slot');
    if (!daySelector || !timeSelector) return;

    const dayIdx = parseInt(daySelector.value);
    
    // 그룹 소속 교차로 중 스케줄이 있는 첫 번째 교차로 기준
    const members = Object.values(STATE.junctions).filter(j => String(j.group) === String(gid));
    if (members.length === 0) return;
    
    // [핵심 수정] 시간(h, m) 정보는 dayPlans가 아닌 schedules 배열에 저장되어 있음
    const referenceJ = members[0];
    const schedArr = (referenceJ.schedules && referenceJ.schedules[dayIdx]) ? referenceJ.schedules[dayIdx] : [];
    
    let html = '';
    schedArr.forEach((p, idx) => {
        // h가 -1이 아니면 유효한 시작 시간이 있는 슬롯임
        if (p.h !== undefined && p.h !== -1) {
            const label = `${String(p.h).padStart(2, '0')}:${String(p.m || 0).padStart(2, '0')}`;
            const selected = (idx === TSD_ENGINE.state.todIdx) ? 'selected' : '';
            html += `<option value="${idx}" ${selected}>${label} (#${idx+1})</option>`;
        }
    });
    
    if (html === '') html = '<option value="0">스케줄 없음</option>';
    timeSelector.innerHTML = html;
}

function renderTimeSpaceDiagram() {
    if (typeof currentEditingGroup === 'undefined' || !currentEditingGroup) {
        TSD_ENGINE.drawMessage("그룹을 먼저 선택하세요.");
        return;
    }

    const gid = String(currentEditingGroup);
    const daySelector = document.getElementById('tsd-day-plan');
    const dayIdx = daySelector ? parseInt(daySelector.value) : 0;

    // [개선] 그룹 또는 일계획이 변경된 경우 데이터 동기화 및 스냅샷 갱신 수행
    if (TSD_ENGINE.state.gid !== gid || TSD_ENGINE.state.lastDayIdx !== dayIdx) {
        
        // 1. 일계획이 바뀐 경우 시간대 목록 갱신 (선택 인덱스 보존 시도)
        const prevTodIdx = TSD_ENGINE.state.todIdx;
        updateTsdTimeSlots();
        
        // 2. 목록 갱신 후, 기존 인덱스가 유효한지 확인하여 재설정
        const timeSelector = document.getElementById('tsd-time-slot');
        if (timeSelector) {
            const options = Array.from(timeSelector.options);
            const hasPrev = options.find(opt => parseInt(opt.value) === prevTodIdx);
            if (hasPrev) {
                timeSelector.value = prevTodIdx;
            } else if (options.length > 0) {
                timeSelector.value = options[0].value;
            }
        }

        // 3. 오프셋 초기화용 스냅샷 갱신 (현재 요일 기준)
        _tsdOffsetSnapshot = {};
        const members = Object.values(STATE.junctions).filter(j => String(j.group) === gid);
        members.forEach(j => {
            if (j.dayPlans && j.dayPlans[dayIdx]) {
                _tsdOffsetSnapshot[j.id] = j.dayPlans[dayIdx].map(p => p.offset || 0);
            }
        });

        // 상태값 저장
        TSD_ENGINE.state.gid = gid;
        TSD_ENGINE.state.lastDayIdx = dayIdx;
    }

    // 엔진 업데이트 및 렌더링
    TSD_ENGINE.update(gid);
}

/**
 * 오프셋 초기화 (RESET 버튼)
 */
function resetTsdOffsets() {
    if (!currentEditingGroup || Object.keys(_tsdOffsetSnapshot).length === 0) {
        alert('초기화할 오프셋 정보가 없습니다. ANALYZE를 먼저 실행하세요.');
        return;
    }
    const dayIdx = STATE.currentGroupDayTypeIdx || 0;
    Object.entries(_tsdOffsetSnapshot).forEach(([jid, offsets]) => {
        const j = STATE.junctions[jid];
        if (!j || !j.dayPlans || !j.dayPlans[dayIdx]) return;
        offsets.forEach((off, pIdx) => {
            if (j.dayPlans[dayIdx][pIdx]) j.dayPlans[dayIdx][pIdx].offset = off;
        });
    });
    if (typeof renderGroupTODTable === 'function') renderGroupTODTable();
    TSD_ENGINE.render();
    console.log('[TSD] 오프셋 초기화 완료');
}

/**
 * 시공도 크게보기 (새 창)
 */
let _tsdPopupWindow = null;

function openTsdPopup() {
    // 이미 열려 있으면 최신 데이터 주입 후 포커스
    if (_tsdPopupWindow && !_tsdPopupWindow.closed) {
        _injectToPopup(_tsdPopupWindow);
        _tsdPopupWindow.focus();
        return;
    }

    const pw = Math.min(screen.width - 40, 1600);
    const ph = Math.min(screen.height - 80, 900);
    const pl = Math.round((screen.width  - pw) / 2);
    const pt = Math.round((screen.height - ph) / 2);

    _tsdPopupWindow = window.open(
        'tsd_popup.html', 'TSD_POPUP',
        `width=${pw},height=${ph},left=${pl},top=${pt},resizable=yes,scrollbars=no`
    );

    if (!_tsdPopupWindow) {
        alert('팝업이 차단되었습니다. 브라우저 팝업 허용 설정을 확인해주세요.');
        return;
    }

    // [보안 우회] 직접 함수 호출 대신 localStorage를 통해 데이터 전달 (file:// 프로토콜 대응)
    const cleanMembers = TSD_ENGINE.state.members.map(m => {
        const { marker, ...rest } = m;
        return rest;
    });

    const transferData = {
        gid: TSD_ENGINE.state.gid,
        dayIdx: STATE.currentGroupDayTypeIdx || 0,
        todIdx: TSD_ENGINE.state.todIdx || 0,
        cycle: TSD_ENGINE.state.cycle,
        members: cleanMembers,
        distances: TSD_ENGINE.state.distances,
        totalDist: TSD_ENGINE.state.totalDist,
        travelTimes: TSD_ENGINE.state.travelTimes,
        offsets: _tsdOffsetSnapshot,
        timestamp: Date.now()
    };
    try {
        localStorage.setItem('SIGMA_TSD_TRANSFER', JSON.stringify(transferData));
    } catch(e) { console.error('TSD Data Transfer Failed:', e); }
}

function _injectToPopup(popup) {
    const cleanMembers = TSD_ENGINE.state.members.map(m => {
        const { marker, ...rest } = m; // marker 제외
        return rest;
    });

    const transferData = {
        gid: TSD_ENGINE.state.gid,
        dayIdx: STATE.currentGroupDayTypeIdx || 0,
        todIdx: TSD_ENGINE.state.todIdx || 0,
        cycle: TSD_ENGINE.state.cycle,
        members: cleanMembers,
        distances: TSD_ENGINE.state.distances,
        totalDist: TSD_ENGINE.state.totalDist,
        travelTimes: TSD_ENGINE.state.travelTimes,
        offsets: _tsdOffsetSnapshot,
        timestamp: Date.now()
    };
    try {
        localStorage.setItem('SIGMA_TSD_TRANSFER', JSON.stringify(transferData));
    } catch(e) {
        console.error('[TSD Popup] Data Serialization Failed (possibly circular reference):', e);
    }
}

/** [보안 대응] 팝업창에서 수정한 오프셋을 부모 창의 STATE에 반영하는 리스너 (file:// 대응) */
window.addEventListener('storage', (e) => {
    if (e.key === 'SIGMA_TSD_APPLY' && e.newValue) {
        try {
            const data = JSON.parse(e.newValue);
            const dayIdx = data.dayIdx;
            Object.entries(data.offsets).forEach(([jid, offsets]) => {
                const j = STATE.junctions[jid];
                if (!j || !j.dayPlans || !j.dayPlans[dayIdx]) return;
                offsets.forEach((off, pIdx) => {
                    if (j.dayPlans[dayIdx][pIdx]) j.dayPlans[dayIdx][pIdx].offset = off;
                });
            });
            console.log('[TSD] 팝업으로부터 오프셋 반영 완료');
            if (typeof renderGroupTODTable === 'function') renderGroupTODTable();
            if (typeof TSD_ENGINE !== 'undefined') TSD_ENGINE.render();
        } catch(err) {
            console.error('[TSD Apply Error]', err);
        }
    }
});

