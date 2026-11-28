/**
 * Time-Space Diagram (TSD) Engine v3.2 — Max Band Theory (Final)
 * - Max Band 전수 탐색 (0.25s 해상도)
 * - 듀얼 링(Dual-Ring) Miovision-style 시각화
 * - 하이브리드 렌더링: 밴드 폴리곤 + 비연동 궤적선
 * - 오프셋 드래그 → 실시간 밴드 이동
 * - 차량군(Platoon) 주행 및 대기행렬 실시간 시뮬레이션
 */

// ── [전역 안전 바인딩] 인라인 HTML onclick 이벤트 보호 및 조기 노출 ──
if (typeof window !== 'undefined') {
    window.toggleTsdPlatoonAnimation = function() {
        if (typeof TSD_ENGINE !== 'undefined' && TSD_ENGINE) {
            TSD_ENGINE.togglePlatoonAnimation();
        } else {
            console.warn('[TSD] TSD_ENGINE이 아직 초기화되지 않았습니다.');
        }
    };
    window.setTsdScaleMode = function(mode) {
        if (typeof TSD_ENGINE !== 'undefined' && TSD_ENGINE) {
            TSD_ENGINE.setScaleMode(mode);
        }
    };
    window.stepTsdOffset = function(delta) {
        if (typeof TSD_ENGINE !== 'undefined' && TSD_ENGINE) {
            TSD_ENGINE.stepOffset(delta);
        }
    };
    window.autoOptimizeTsdOffsets = function() {
        if (typeof TSD_ENGINE !== 'undefined' && TSD_ENGINE) {
            TSD_ENGINE.autoOptimizeOffsets();
        }
    };
    window.exportTsdEngineeringDiagram = function() {
        if (typeof TSD_ENGINE !== 'undefined' && TSD_ENGINE) {
            TSD_ENGINE.exportEngineeringDiagram();
        }
    };
}

// ── TSDAnalyzer: Max Band 대역폭 계산 엔진 ──
class TSDAnalyzer {

    /**
     * 특정 교차로의 연동 방향 녹색 시작/길이 반환
     * 폴백: 정확한 이동류가 없으면 Ring A의 최대 녹색 현시 선택
     */
    static getGreenWindow(j, axis, dir, dayIdx, pIdx, cycle, offsetOverride) {
        const sm = typeof getEffectiveSignalMap === "function" ? getEffectiveSignalMap(j, dayIdx, pIdx) : ((j.signalMaps && j.signalMaps[((j.dayPlanMapIds && j.dayPlanMapIds[dayIdx]) ? j.dayPlanMapIds[dayIdx] : 0)]) ? j.signalMaps[((j.dayPlanMapIds && j.dayPlanMapIds[dayIdx]) ? j.dayPlanMapIds[dayIdx] : 0)] : null);
        if (!sm) return [];

        const tod = typeof getEffectiveDayPlan === "function" ? getEffectiveDayPlan(j, dayIdx, pIdx) : ((j.dayPlans && j.dayPlans[dayIdx]) ? j.dayPlans[dayIdx][pIdx] : null);
        if (!tod) return [];
        const offset = (offsetOverride !== undefined) ? offsetOverride : (tod.offset || 0);

        const targetMov = (dir === 'up') ? (axis === 'ew' ? 2 : 4) : (axis === 'ew' ? 6 : 8);

        let targetRing = -1;
        if ((sm.movA || []).includes(targetMov)) targetRing = 0;
        else if ((sm.movB || []).includes(targetMov)) targetRing = 1;
        
        if (targetRing === -1) return [];

        const splits = (targetRing === 0) ? (tod.splitA || []) : (tod.splitB || []);
        const yellows = (targetRing === 0) ? (sm.yellowA || []) : (sm.yellowB || []);
        const movs = (targetRing === 0) ? (sm.movA || []) : (sm.movB || []);

        // 1. Build list of active blocks based on actual time
        let currentT = 0;
        const blocks = [];
        for (let i = 0; i < splits.length; i++) {
            const split = splits[i] || 0;
            if (split <= 0) {
                // If split is 0, time doesn't advance.
                continue;
            }
            if (movs[i] === targetMov) {
                blocks.push({
                    start: currentT,
                    end: currentT + split,
                    yellowTime: yellows[i] || 0
                });
            }
            currentT += split;
        }

        if (blocks.length === 0) return [];

        // 2. Merge contiguous blocks
        const mergedBlocks = [];
        let currentBlock = Object.assign({}, blocks[0]);

        for (let i = 1; i < blocks.length; i++) {
            const b = blocks[i];
            // If the next block starts EXACTLY when the current one ends, merge them!
            if (Math.abs(b.start - currentBlock.end) < 0.1) {
                currentBlock.end = b.end;
                currentBlock.yellowTime = b.yellowTime; // Only the LAST phase's yellow matters
            } else {
                mergedBlocks.push(currentBlock);
                currentBlock = Object.assign({}, b);
            }
        }
        mergedBlocks.push(currentBlock);

        // 3. Subtract yellow time and handle wrap-around if the first and last blocks connect across the cycle!
        // (e.g. if a movement is in the last phase and the first phase)
        if (mergedBlocks.length > 1) {
            const first = mergedBlocks[0];
            const last = mergedBlocks[mergedBlocks.length - 1];
            if (Math.abs(last.end - cycle) < 0.1 && Math.abs(first.start - 0) < 0.1) {
                // They connect across the cycle boundary!
                first.start = last.start - cycle;
                first.yellowTime = first.yellowTime; // The yellow time of the first block (which is chronologically the end)
                mergedBlocks.pop(); // Remove the last block since it's merged into the first
            }
        }

        // 4. Format into final windows
        const windows = [];
        for (const mb of mergedBlocks) {
            const gLen = Math.max(0, (mb.end - mb.start) - mb.yellowTime);
            if (gLen > 0) {
                const gStart = ((offset + mb.start) % cycle + cycle) % cycle;
                windows.push({ gStart, gLen });
            }
        }

        return windows;
    }

    /**
     * [신규] 특정 교차로에 도착 시각(arrT) 기준 신호 상태 및 대기 시간 계산
     * @returns { isGreen: boolean, waitTime: number, nextGreenT: number }
     */
    static checkSignalAtArrival(member, axis, dir, dayIdx, pIdx, cycle, arrT, offsetOverride) {
        const greens = this.getGreenWindow(member, axis, dir, dayIdx, pIdx, cycle, offsetOverride);
        if (!greens || greens.length === 0) {
            return { isGreen: true, waitTime: 0, nextGreenT: arrT };
        }

        const tMod = ((arrT % cycle) + cycle) % cycle;
        let isGreen = false;
        let minWait = cycle;

        for (const g of greens) {
            const gS = g.gStart;
            const gE = (gS + g.gLen) % cycle;

            const inWindow = (gS < gE)
                ? (tMod >= gS && tMod < gE)
                : (tMod >= gS || tMod < gE);

            if (inWindow) {
                isGreen = true;
                minWait = 0;
                break;
            }

            // 적색일 경우 이 녹색 창의 시작까지 대기해야 하는 시간
            let wait = (gS - tMod);
            if (wait <= 0) wait += cycle;
            if (wait < minWait) {
                minWait = wait;
            }
        }

        if (isGreen) {
            return { isGreen: true, waitTime: 0, nextGreenT: arrT };
        } else {
            return { isGreen: false, waitTime: minWait, nextGreenT: arrT + minWait };
        }
    }

    /**
     * [신규] 차량 1대의 전 구간 물리 주행 및 신호 대기 궤적 세그먼트 생성
     */
    static buildVehicleTrajectory(members, distances, segSpeeds, axis, dir, dayIdx, pIdx, cycle, depT0) {
        const N = members.length;
        const isUp = (dir === 'up');
        const sortedIndices = isUp
            ? members.map((_, i) => i)
            : members.map((_, i) => i).reverse();

        const segments = [];
        let curT = depT0;

        // 1. 기점 교차로 출발 신호 대기 체크
        const firstIdx = sortedIndices[0];
        const firstSig = this.checkSignalAtArrival(members[firstIdx], axis, dir, dayIdx, pIdx, cycle, curT);
        if (!firstSig.isGreen && firstSig.waitTime > 0) {
            segments.push({
                type: 'stop',
                t0: curT,
                t1: curT + firstSig.waitTime,
                nodeIdx: firstIdx,
                dist: distances[firstIdx]
            });
            curT += firstSig.waitTime;
        }

        // 2. 중간 교차로 순차 주행 및 적신호 정차 대기
        for (let step = 0; step < sortedIndices.length - 1; step++) {
            const fromIdx = sortedIndices[step];
            const toIdx = sortedIndices[step + 1];

            const segDist = Math.abs(distances[toIdx] - distances[fromIdx]);
            const segSpeedIdx = isUp ? fromIdx : toIdx;
            const spd = (segSpeeds && segSpeeds[segSpeedIdx]) ? segSpeeds[segSpeedIdx] : 50;
            const v = (spd / 3.6); // m/s
            const travelTime = (v > 0) ? (segDist / v) : 1;

            const tMoveStart = curT;
            const tMoveEnd = curT + travelTime;

            segments.push({
                type: 'move',
                t0: tMoveStart,
                t1: tMoveEnd,
                fromNode: fromIdx,
                toNode: toIdx,
                fromDist: distances[fromIdx],
                toDist: distances[toIdx],
                travelTime: travelTime
            });

            curT = tMoveEnd;

            // 목적지 교차로(toIdx) 도착 시 신호 체크 (마지막 교차로 직전까지 적용)
            if (step < sortedIndices.length - 1) {
                const sig = this.checkSignalAtArrival(members[toIdx], axis, dir, dayIdx, pIdx, cycle, curT);
                if (!sig.isGreen && sig.waitTime > 0) {
                    segments.push({
                        type: 'stop',
                        t0: curT,
                        t1: curT + sig.waitTime,
                        nodeIdx: toIdx,
                        dist: distances[toIdx]
                    });
                    curT += sig.waitTime;
                }
            }
        }

        return {
            depT: depT0,
            arrT: curT,
            segments: segments
        };
    }

    /**
     * [신규] 특정 시점(T_cur)에서의 차량 물리 상태(위치, Y좌표, 정차/주행 여부, 대기행렬) 산출
     */
    static getVehicleStateAtTime(traj, T_cur, getY, isUp, m = 0) {
        if (!traj || T_cur < traj.depT || T_cur > traj.arrT) return null;

        for (const seg of traj.segments) {
            if (T_cur >= seg.t0 && T_cur <= seg.t1) {
                if (seg.type === 'stop') {
                    // 적신호 정차 대기 중: 교차로 정지선 뒤에 차례로 대기행렬(Queue) 형성
                    const baseY = getY(seg.nodeIdx, seg.dist);
                    // 상행: 아래에서 올라오므로 정지선보다 아래(+Y), 하행: 위에서 내려오므로 정지선보다 위(-Y)
                    const queueY = baseY + (isUp ? (m * 8 + 3) : (-m * 8 - 3));
                    return {
                        isStopped: true,
                        nodeIdx: seg.nodeIdx,
                        dist: seg.dist,
                        y: queueY,
                        baseY: baseY,
                        waitTimeRem: Math.max(0, seg.t1 - T_cur),
                        totalWait: seg.t1 - seg.t0
                    };
                } else if (seg.type === 'move') {
                    // 정상 주행 중
                    const dur = seg.t1 - seg.t0;
                    const ratio = dur > 0 ? Math.min(1, Math.max(0, (T_cur - seg.t0) / dur)) : 0;
                    const curDist = seg.fromDist + ratio * (seg.toDist - seg.fromDist);
                    const interpNode = seg.fromNode + ratio * (seg.toNode - seg.fromNode);
                    const y = getY(interpNode, curDist);

                    // 꼬리 잔상용 이전 위치 (약 0.25초 또는 이동비율 기준)
                    const prevRatio = Math.max(0, ratio - 0.2);
                    const prevDist = seg.fromDist + prevRatio * (seg.toDist - seg.fromDist);
                    const prevInterpNode = seg.fromNode + prevRatio * (seg.toNode - seg.fromNode);
                    const prevY = getY(prevInterpNode, prevDist);

                    return {
                        isStopped: false,
                        fromNode: seg.fromNode,
                        toNode: seg.toNode,
                        dist: curDist,
                        y: y,
                        prevY: prevY,
                        ratio: ratio
                    };
                }
            }
        }
        return null;
    }

    /**
     * Max Band Brute-Force Sweep (유효 교차로만 대상)
     * null 교차로를 완전히 제외한 별도 배열로 계산
     */
    static calculateBandwidth(dir, axis, members, distances, totalDist, cycle, travelTimes, dayIdx, pIdx, offsets) {
        if (!members || members.length < 2 || cycle <= 0)
            return { width: 0, start: 0, validCount: 0 };

        const totalTT = travelTimes[travelTimes.length - 1] || 1;

        const validNodes = [];
        for (let i = 0; i < members.length; i++) {
            const off = (offsets && offsets[members[i].id]) ? offsets[members[i].id][pIdx] : undefined;
            const greens = this.getGreenWindow(members[i], axis, dir, dayIdx, pIdx, cycle, off);
            if (greens && greens.length > 0) {
                validNodes.push({ idx: i, tt: travelTimes[i], greens: greens });
            }
        }
        if (validNodes.length < 2) return { width: 0, start: 0, validCount: validNodes.length };

        let bestW = 0, bestS = 0;

        for (let t = 0; t < cycle; t += 0.25) {
            let minR = cycle, ok = true;

            for (const node of validNodes) {
                const travel = (dir === 'up') ? node.tt : (totalTT - node.tt);
                const arrival = ((t + travel) % cycle + cycle) % cycle;
                
                let maxRemForThisNode = -1;
                for (const g of node.greens) {
                    const gS = g.gStart;
                    const gE = (gS + g.gLen) % cycle;

                    const isGreen = (gS < gE)
                        ? (arrival >= gS && arrival < gE)
                        : (arrival >= gS || arrival < gE);
                    
                    if (isGreen) {
                        const rem = (gS < gE)
                            ? (gE - arrival)
                            : (arrival >= gS ? cycle - arrival + gE : gE - arrival);
                        if (rem > maxRemForThisNode) {
                            maxRemForThisNode = rem;
                        }
                    }
                }

                if (maxRemForThisNode < 0) { ok = false; break; }
                minR = Math.min(minR, maxRemForThisNode);
            }
            if (ok && minR > bestW) { bestW = minR; bestS = t; }
        }

        return { width: bestW, start: bestS, validCount: validNodes.length };
    }

    /**
     * Max Band 단일 인터페이스 래퍼 (ai_report 및 외부 호환용)
     */
    static findMaxBand(members, distances, travelTimes, dir, axis, dayIdx, pIdx, cycle, offsets) {
        if (!members || members.length < 2 || cycle <= 0) {
            return { bandwidth: 0, width: 0, t0: 0, start: 0, ratio: 0, validCount: 0 };
        }
        const totalDist = (distances && distances.length > 0) ? distances[distances.length - 1] : 0;
        const res = this.calculateBandwidth(dir, axis, members, distances, totalDist, cycle, travelTimes, dayIdx, pIdx, offsets);
        const w = (res && res.width) ? res.width : 0;
        const s = (res && res.start) ? res.start : 0;
        return {
            bandwidth: w,
            width: w,
            t0: s,
            start: s,
            ratio: cycle > 0 ? Math.round((w / cycle) * 1000) / 10 : 0,
            validCount: (res && res.validCount) ? res.validCount : 0
        };
    }

    /**
     * [신규] Max Band 양방향 연동 최적 오프셋 자동 산출 엔진
     * - 기준 교차로(0번) 오프셋 기준, 구간별 주행시간 및 양방향 위상 최적화
     * - 상행 대역폭 + 하행 대역폭 합계를 극대화하는 최적 오프셋 벡터 산출
     */
    static optimizeOffsets(members, distances, totalDist, cycle, travelTimes, dayIdx, pIdx, axis = 'ew') {
        if (!members || members.length < 2 || cycle <= 0) return null;
        
        const N = members.length;
        const currentOffsets = members.map(m => {
            const tod = typeof getEffectiveDayPlan === "function" ? getEffectiveDayPlan(m, dayIdx, pIdx) : (m.dayPlans && m.dayPlans[dayIdx] ? m.dayPlans[dayIdx][pIdx] : null);
            return tod ? (tod.offset || 0) : 0;
        });

        // 1. 초기 상태 점수 평가
        const initUp = this.calculateBandwidth('up', axis, members, distances, totalDist, cycle, travelTimes, dayIdx, pIdx, currentOffsets);
        const initDown = this.calculateBandwidth('down', axis, members, distances, totalDist, cycle, travelTimes, dayIdx, pIdx, currentOffsets);
        let bestScore = (initUp.width || 0) + (initDown.width || 0);
        let bestOffsets = [...currentOffsets];

        // 2. 주행시간 기반 이상적 오프셋 및 하프-사이클 교대 위상 후보군 탐색
        let candidate = [0];
        const step = cycle > 130 ? 3 : 2;

        for (let i = 1; i < N; i++) {
            let localBestOffset = 0;
            let localBestW = -1;
            
            for (let off = 0; off < cycle; off += step) {
                const testOffsets = [...candidate, off];
                for (let k = i + 1; k < N; k++) testOffsets.push(currentOffsets[k]);
                
                const up = this.calculateBandwidth('up', axis, members, distances, totalDist, cycle, travelTimes, dayIdx, pIdx, testOffsets);
                const down = this.calculateBandwidth('down', axis, members, distances, totalDist, cycle, travelTimes, dayIdx, pIdx, testOffsets);
                const score = (up.width || 0) + (down.width || 0);
                
                if (score > localBestW) {
                    localBestW = score;
                    localBestOffset = off;
                }
            }
            candidate.push(localBestOffset);
        }

        // 3. 로컬 힐클라이밍 미세조정 (+-1s, +-2s)
        for (let iter = 0; iter < 2; iter++) {
            for (let i = 1; i < N; i++) {
                const orig = candidate[i];
                for (let delta of [-2, -1, 1, 2]) {
                    const testOff = (orig + delta + cycle) % cycle;
                    candidate[i] = testOff;
                    const up = this.calculateBandwidth('up', axis, members, distances, totalDist, cycle, travelTimes, dayIdx, pIdx, candidate);
                    const down = this.calculateBandwidth('down', axis, members, distances, totalDist, cycle, travelTimes, dayIdx, pIdx, candidate);
                    const score = (up.width || 0) + (down.width || 0);
                    if (score > bestScore) {
                        bestScore = score;
                        bestOffsets = [...candidate];
                    } else {
                        candidate[i] = orig;
                    }
                }
            }
        }

        const finalUp = this.calculateBandwidth('up', axis, members, distances, totalDist, cycle, travelTimes, dayIdx, pIdx, bestOffsets);
        const finalDown = this.calculateBandwidth('down', axis, members, distances, totalDist, cycle, travelTimes, dayIdx, pIdx, bestOffsets);

        return {
            offsets: bestOffsets,
            upWidth: finalUp.width || 0,
            downWidth: finalDown.width || 0,
            totalScore: (finalUp.width || 0) + (finalDown.width || 0),
            initialScore: (initUp.width || 0) + (initDown.width || 0)
        };
    }
}

// ── TSDEngine: 렌더링 & 인터랙션 ──
class TSDEngine {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');

        this.config = {
            padding: { top: 32, bottom: 42, left: 185, right: 28 },
            colors: {
                bg: '#0a0f1d', // 딥 슬레이트 네이비
                sidebarBg: 'rgba(15, 23, 42, 0.96)',
                grid: 'rgba(148, 163, 184, 0.08)',
                gridMajor: 'rgba(56, 189, 248, 0.25)',
                accent: '#38bdf8',
                green: '#10b981',
                yellow: '#f59e0b',
                red: '#e11d48',
                bandUp: 'rgba(14, 165, 233, 0.30)',
                bandDown: 'rgba(16, 185, 129, 0.30)',
                bandUpStroke: '#38bdf8',
                bandDownStroke: '#34d399',
                trajUp: 'rgba(56, 189, 248, 0.85)',
                trajDown: 'rgba(52, 211, 153, 0.85)',
                wait: '#e11d48'
            },
            trajectories: { up: '#38bdf8', down: '#34d399' },
            font: {
                base: '12px "Outfit", "Inter", sans-serif',
                bold: 'bold 13px "Outfit", "Inter", sans-serif',
                mono: '11px "JetBrains Mono", monospace'
            }
        };

        this.state = {
            gid: null, members: [], totalDist: 0, distances: [],
            cycle: 100, viewOffsetT: 0,
            isDragging: false, isDraggingOffset: false,
            dragJid: null, lastX: 0,
            yCoords: [], todIdx: 0,
            segSpeeds: [],    // 구간별 속도 (km/h), 길이 = members.length - 1
            travelTimes: [],   // 누적 주행시간 (초), 길이 = members.length
            scaleMode: 'proportional', // 'proportional' (거리 비례) | 'schematic' (균등 간격)
            selectedJid: null,  // 오프셋 미세조정/선택 교차로 ID
            hoveredJid: null,   // 마우스 호버 교차로 ID (지도 연동용)
            isPlatoonSimActive: false, // [신규] 차량군 주행 시뮬레이션 애니메이션 여부
            simClock: 0,               // 시뮬레이션 가상 시계 (초)
            lastSimTimestamp: 0        // 프레임 델타 타임스탬프
        };

        this.animFrameId = null;
        this.initEvents();
                window.addEventListener('resize', () => this.render());

        // 툴팁 초기화
        this.tooltip = document.createElement('div');
        this.tooltip.style.position = 'absolute';
        this.tooltip.style.pointerEvents = 'none';
        this.tooltip.style.backgroundColor = 'rgba(20, 20, 20, 0.9)';
        this.tooltip.style.color = '#fff';
        this.tooltip.style.padding = '8px 12px';
        this.tooltip.style.borderRadius = '6px';
        this.tooltip.style.fontSize = '12px';
        this.tooltip.style.fontFamily = this.config.font.base;
        this.tooltip.style.zIndex = '9999';
        this.tooltip.style.display = 'none';
        this.tooltip.style.boxShadow = '0 4px 6px rgba(0,0,0,0.5)';
        this.tooltip.style.border = '1px solid rgba(255,255,255,0.1)';
        document.body.appendChild(this.tooltip);
    }

    initEvents() {
        const getHitJid = (e, includeLabelArea = false) => {
            const rect = this.canvas.getBoundingClientRect();
            const mx = e.clientX - rect.left;
            const my = (e.clientY - rect.top) / (window.devicePixelRatio || 1);
            if (!includeLabelArea && mx < this.config.padding.left) return null;
            
            // 좌측 라벨 카드 영역 히트 검출 (스마트 충돌완화 좌표 기준)
            if (mx < this.config.padding.left && this.state.labelCoords) {
                for (let item of this.state.labelCoords) {
                    if (Math.abs(my - item.y) < 16) return item.id;
                }
            }
            
            // 신호선 영역 히트 검출
            if (this.state.yCoords) {
                for (let item of this.state.yCoords) {
                    if (Math.abs(my - item.y) < 22) return item.id;
                }
            }
            return null;
        };

        this.canvas.addEventListener('mousemove', (e) => {
            if (this.state.isDragging || this.state.isDraggingOffset) {
                if(this.tooltip) this.tooltip.style.display = 'none';
                return;
            }
            const hitJid = getHitJid(e);
            this.canvas.style.cursor = hitJid ? 'ew-resize' : 'grab';
            
            // [신규] GIS 지도 동기화 호버링
            const hoverJid = getHitJid(e, true);
            if (this.state.hoveredJid !== hoverJid) {
                this.state.hoveredJid = hoverJid;
                if (typeof window.syncTsdHoverToMap === 'function') {
                    window.syncTsdHoverToMap(hoverJid);
                }
            }
            
            // 툴팁 처리 로직
            if (this.tooltip && this.state.hitRegions) {
                const rect = this.canvas.getBoundingClientRect();
                const mx = (e.clientX - rect.left) / (this.canvas.clientWidth / (this.canvas.width / (window.devicePixelRatio || 1)));
                const my = (e.clientY - rect.top) / (this.canvas.clientHeight / (this.canvas.height / (window.devicePixelRatio || 1)));
                
                // 역순으로 탐색 (나중에 그려진 것이 위쪽)
                let found = null;
                for (let i = this.state.hitRegions.length - 1; i >= 0; i--) {
                    const r = this.state.hitRegions[i];
                    if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) {
                        found = r;
                        break;
                    }
                }
                
                if (found && found.split > 0 && found.mov > 0) {
                    this.tooltip.style.display = 'block';
                    this.tooltip.style.left = (e.pageX + 15) + 'px';
                    this.tooltip.style.top = (e.pageY + 15) + 'px';
                    
                    let typeText = "차량";
                    if (found.mov >= 101 && found.mov <= 116) typeText = "보행";
                    
                    this.tooltip.innerHTML = `
                        <div><strong>이동류:</strong> ${found.mov === 100 ? 'W' : found.mov} (${typeText})</div>
                        <div><strong>총 현시:</strong> ${found.split}초</div>
                        <div><strong>녹색:</strong> <span style="color:#81c784">${found.green}초</span></div>
                        ${found.yellow > 0 ? `<div><strong>황색:</strong> <span style="color:#ffb74d">${found.yellow}초</span></div>` : ''}
                    `;
                } else {
                    this.tooltip.style.display = 'none';
                }
            }
        });

        this.canvas.addEventListener('mouseleave', () => { 
            if(this.tooltip) this.tooltip.style.display = 'none'; 
            if (this.state.hoveredJid) {
                this.state.hoveredJid = null;
                if (typeof window.syncTsdHoverToMap === 'function') window.syncTsdHoverToMap(null);
            }
        });
        this.canvas.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            const hitJid = getHitJid(e, true);
            this.state.lastX = e.clientX;
            if (hitJid) {
                this.state.selectedJid = hitJid;
                this.state.isDraggingOffset = true;
                this.state.dragJid = hitJid;
                this.canvas.style.cursor = 'ew-resize';
                this.render(); // 선택 교차로 하이라이트 즉시 갱신
            } else { 
                this.canvas.style.cursor = 'default'; 
            }
            e.preventDefault();
        });

        window.addEventListener('mousemove', (e) => {
            if (!this.state.isDragging && !this.state.isDraggingOffset) return;
            const deltaX = e.clientX - this.state.lastX;
            const chartW = this.canvas.clientWidth - this.config.padding.left - this.config.padding.right;
            const timeDelta = (deltaX / chartW) * (this.state.cycle * 4);

            if (this.state.isDraggingOffset) {
                const j = STATE.junctions[this.state.dragJid];
                const dayIdx = STATE.currentGroupDayTypeIdx || 0;
                const pIdx = this.state.todIdx;
                if (j && j.dayPlans && j.dayPlans[dayIdx] && j.dayPlans[dayIdx][pIdx]) {
                    const plan = typeof getEffectiveDayPlan === "function" ? getEffectiveDayPlan(j, dayIdx, pIdx) : j.dayPlans[dayIdx][pIdx];
                    let newOff = (plan.offset || 0) + timeDelta;
                    newOff = ((newOff % this.state.cycle) + this.state.cycle) % this.state.cycle;
                    plan.offset = Math.round(newOff * 10) / 10;
                    if (typeof renderGroupTODTable === 'function') renderGroupTODTable();
                }
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

    /**
     * [신규] 스마트 라벨 충돌 완화 알고리즘 (Smart Label Anti-Collision & Relaxation)
     * 거리비례 모드에서 교차로가 밀집될 때 라벨 카드들이 서로 겹치지 않도록 최소 간격(minGap)을 보장하고
     * 원래 물리적 신호선 Y좌표와 베지어 유도선(Leader Line)으로 매끄럽게 연결
     */
    _computeLabelYPositions(realYArray, minGap = 34, topBound = 32, bottomBound = 780) {
        const n = realYArray.length;
        if (n === 0) return [];
        if (n === 1) return [Math.max(topBound, Math.min(bottomBound, realYArray[0]))];

        // 1. 위에서 아래로(Y 오름차순) 정렬 인덱스
        const items = realYArray.map((y, idx) => ({ idx, origY: y, y }))
            .sort((a, b) => a.origY - b.origY);

        // 전체 필요 높이가 가용 범위를 초과할 경우 minGap을 동적으로 완화 (최소 26px까지)
        const availH = bottomBound - topBound;
        const reqH = (n - 1) * minGap;
        let actualGap = minGap;
        if (reqH > availH && n > 1) {
            actualGap = Math.max(26, availH / (n - 1));
        }

        // 2. 1차 순방향 패스: 위에서 아래로 밀어내기 (Downwards pass)
        items[0].y = Math.max(topBound, items[0].origY);
        for (let k = 1; k < n; k++) {
            if (items[k].y < items[k - 1].y + actualGap) {
                items[k].y = items[k - 1].y + actualGap;
            }
        }

        // 3. 2차 역방향 패스: 하단 경계 초과 시 위로 당기기 (Upwards pass)
        if (items[n - 1].y > bottomBound) {
            items[n - 1].y = bottomBound;
            for (let k = n - 2; k >= 0; k--) {
                if (items[k].y > items[k + 1].y - actualGap) {
                    items[k].y = items[k + 1].y - actualGap;
                }
            }
        }

        // 4. 상단 경계 보호
        if (items[0].y < topBound) {
            const shift = topBound - items[0].y;
            for (let k = 0; k < n; k++) {
                items[k].y += shift;
            }
        }

        // 5. 원래 인덱스 순서로 복원
        const result = new Array(n);
        for (let k = 0; k < n; k++) {
            result[items[k].idx] = items[k].y;
        }

        return result;
    }

    render() {
        if (!this.canvas) return;
        const container = this.canvas.parentElement;
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = container.clientWidth * dpr;
        this.canvas.height = container.clientHeight * dpr;
        this.ctx.scale(dpr, dpr);

        const w = container.clientWidth, h = container.clientHeight;
        this.state.hitRegions = [];
        const cfg = this.config, ctx = this.ctx;
        ctx.fillStyle = cfg.colors.bg;
        ctx.fillRect(0, 0, w, h);
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.fillRect(0, 0, cfg.padding.left, h);
        
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cfg.padding.left, 0);
        ctx.lineTo(cfg.padding.left, h);
        ctx.stroke();

        if (this.state.members.length < 2) {
            this.drawMessage("교차로 순서를 설정하거나 그룹을 선택하세요.");
            return;
        }

        const chartW = w - cfg.padding.left - cfg.padding.right;
        const chartH = h - cfg.padding.top - cfg.padding.bottom;
        const cycle = this.state.cycle;
        const timeHorizon = cycle * 4;
        
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

        // 좌표 변환 헬퍼 (거리비례 vs 균등간격 모식도 완벽 지원)
        const xF = chartW / timeHorizon;
        this.state.viewOffsetT = 0;
        const tToX = (t) => cfg.padding.left + (t - this.state.viewOffsetT) * xF;
        const ringMargin = 20; // 듀얼 링이 클리핑되지 않도록 상하 여백 확보
        
        const isSchematic = (this.state.scaleMode === 'schematic');
        const numMembers = this.state.members.length;
        const getY = (idx, dist) => {
            if (isSchematic && numMembers > 1) {
                // 균등 간격(모식도): 상단(0번 교차로, Y 작음) ~ 하단(마지막 교차로, Y 큼)
                const norm = (numMembers - 1 - idx) / (numMembers - 1);
                return cfg.padding.top + ringMargin + norm * (chartH - ringMargin * 2);
            }
            // 실제 거리 비례
            return cfg.padding.top + ringMargin + (1 - dist / (this.state.totalDist || 1)) * (chartH - ringMargin * 2);
        };
        const distToY = (d, idx = 0) => getY(idx, d);

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
            const y = getY(i, this.state.distances[i]);
            this.state.yCoords.push({ id: j.id, y, idx: i });
            ctx.strokeStyle = 'rgba(0,0,0,0.06)';
            ctx.beginPath(); ctx.moveTo(cfg.padding.left, y); ctx.lineTo(w - cfg.padding.right, y); ctx.stroke();
            this.drawDualRingBars(j, y, chartW, timeHorizon, xF, dayIdx, axis);
        });

        // 2) 밴드/궤적 오버레이
        this.drawHybridBand('up', bandUp, timeHorizon, xF, tToX, getY, dayIdx, axis);
        this.drawHybridBand('down', bandDown, timeHorizon, xF, tToX, getY, dayIdx, axis);

        ctx.restore();

        // 3) 라벨 (선택 및 GIS 호버 하이라이트 반영 - 스마트 충돌 완화 & 모던 글래스모피즘 카드)
        const realYList = this.state.members.map((j, i) => getY(i, this.state.distances[i]));
        const topBound = cfg.padding.top + 16;
        const bottomBound = h - cfg.padding.bottom - 16;
        const labelYList = this._computeLabelYPositions(realYList, 34, topBound, bottomBound);
        this.state.labelCoords = [];

        this.state.members.forEach((j, i) => {
            const realY = realYList[i];
            const labelY = labelYList[i];
            this.state.labelCoords.push({ id: j.id, y: labelY, realY, idx: i });

            const pIdx = this.state.todIdx;
            const _effPlan = typeof getEffectiveDayPlan === "function" ? getEffectiveDayPlan(j, dayIdx, pIdx) : (j.dayPlans && j.dayPlans[dayIdx] ? j.dayPlans[dayIdx][pIdx] : null);
            const curOffset = _effPlan ? (_effPlan.offset || 0) : 0;
            const isSelected = (this.state.selectedJid === j.id);
            const isHovered = (this.state.hoveredJid === j.id);

            const cardX = 6;
            const cardW = cfg.padding.left - 14; // 여백 확보
            const cardH = 30; // 슬림 콤팩트 카드
            const cardY = labelY - 15;

            // 1. 유도선(Leader Line) 그리기: 라벨 카드 우측에서 실제 신호 바 좌측 연결
            ctx.save();
            const startX = cardX + cardW;
            const startY = labelY;
            const endX = cfg.padding.left;
            const endY = realY;

            ctx.beginPath();
            if (Math.abs(labelY - realY) > 2) {
                // 부드러운 베지어 곡선 연결선
                const cp1x = startX + (endX - startX) * 0.45;
                const cp1y = startY;
                const cp2x = startX + (endX - startX) * 0.55;
                const cp2y = endY;
                ctx.moveTo(startX, startY);
                ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, endX, endY);
                ctx.strokeStyle = isSelected ? '#38bdf8' : (isHovered ? '#fbbf24' : 'rgba(56, 189, 248, 0.4)');
                ctx.lineWidth = isSelected ? 1.6 : (isHovered ? 1.4 : 1.0);
                ctx.stroke();

                // 신호선 시작점 핀 포인트 점 찍기
                ctx.fillStyle = isSelected ? '#38bdf8' : (isHovered ? '#fbbf24' : '#0284c7');
                ctx.beginPath();
                ctx.arc(endX, endY, 2.5, 0, Math.PI * 2);
                ctx.fill();
            } else {
                // 높이 차이가 거의 없을 때 직선 연결
                ctx.moveTo(startX, startY);
                ctx.lineTo(endX, endY);
                ctx.strokeStyle = isSelected ? '#38bdf8' : (isHovered ? '#fbbf24' : 'rgba(148, 163, 184, 0.25)');
                ctx.lineWidth = isSelected ? 1.4 : 0.8;
                ctx.stroke();
            }
            ctx.restore();

            // 2. 라벨 카드 배경 렌더링 (모던 글래스모피즘 슬림 카드)
            ctx.save();
            ctx.beginPath();
            if (typeof ctx.roundRect === 'function') {
                ctx.roundRect(cardX, cardY, cardW, cardH, 5);
            } else {
                ctx.rect(cardX, cardY, cardW, cardH);
            }

            if (isSelected) {
                ctx.fillStyle = 'rgba(2, 132, 199, 0.35)';
                ctx.fill();
                ctx.strokeStyle = '#38bdf8';
                ctx.lineWidth = 1.6;
                ctx.stroke();

                ctx.fillStyle = '#38bdf8';
                ctx.fillRect(cardX, cardY, 3.5, cardH);
            } else if (isHovered) {
                ctx.fillStyle = 'rgba(245, 158, 11, 0.25)';
                ctx.fill();
                ctx.strokeStyle = '#fbbf24';
                ctx.lineWidth = 1.4;
                ctx.stroke();

                ctx.fillStyle = '#fbbf24';
                ctx.fillRect(cardX, cardY, 3, cardH);
            } else {
                ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
                ctx.fill();
                ctx.strokeStyle = 'rgba(56, 189, 248, 0.2)';
                ctx.lineWidth = 1;
                ctx.stroke();
            }

            // 1행: 교차로명
            ctx.textAlign = 'left';
            ctx.fillStyle = isSelected ? '#38bdf8' : (isHovered ? '#fbbf24' : '#f8fafc');
            ctx.font = 'bold 11px "Outfit", "Inter", sans-serif';
            let name = j.name || j.id;
            if (name.length > 11) name = name.substring(0, 10) + '..';
            ctx.fillText(name, cardX + 8, cardY + 12.5);

            // 2행: 거리 표시 (좌측)
            ctx.fillStyle = isSchematic ? '#6ee7b7' : '#34d399';
            ctx.font = 'bold 9.5px "JetBrains Mono", monospace';
            ctx.fillText(`▸ ${Math.round(this.state.distances[i])}m`, cardX + 8, cardY + 24.5);

            // 2행: 오프셋 캡슐 뱃지 (우측 인라인 수납)
            const offW = 44;
            const offH = 13;
            const offX = cardX + cardW - offW - 6;
            const offY = cardY + 14;
            ctx.fillStyle = curOffset !== 0 ? 'rgba(245, 158, 11, 0.22)' : 'rgba(148, 163, 184, 0.12)';
            ctx.beginPath();
            if (typeof ctx.roundRect === 'function') {
                ctx.roundRect(offX, offY, offW, offH, 3);
            } else {
                ctx.rect(offX, offY, offW, offH);
            }
            ctx.fill();
            ctx.strokeStyle = curOffset !== 0 ? 'rgba(245, 158, 11, 0.55)' : 'rgba(148, 163, 184, 0.25)';
            ctx.lineWidth = 0.8;
            ctx.stroke();

            ctx.textAlign = 'center';
            ctx.fillStyle = curOffset !== 0 ? '#fbbf24' : '#94a3b8';
            ctx.font = 'bold 9px "JetBrains Mono", monospace';
            ctx.fillText(`⊕ ${Math.round(curOffset)}s`, offX + offW / 2, offY + 9.5);

            ctx.restore();
        });

        // 시간축 눈금 및 세로선 (주기 비율 기반)
        const subDivisions = 4; // 1/4 주기 단위
        const step = cycle / subDivisions;
        
        for (let t = 0; t <= timeHorizon; t += step) {
            const x = tToX(t);
            if (x >= cfg.padding.left && x <= w - cfg.padding.right) {
                const isCycleEnd = (Math.round(t) % cycle === 0);
                
                // 세로선
                if (isCycleEnd) {
                    ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
                    ctx.lineWidth = 1.5;
                } else {
                    ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)';
                    ctx.lineWidth = 1;
                }
                ctx.beginPath();
                ctx.moveTo(x, cfg.padding.top);
                ctx.lineTo(x, h - cfg.padding.bottom + 6);
                ctx.stroke();

                // 텍스트 (실제 시간 표시 배지)
                ctx.textAlign = 'center';
                if (isCycleEnd) {
                    const cNum = Math.round(t / cycle);
                    // 타임 배지
                    ctx.fillStyle = 'rgba(56, 189, 248, 0.18)';
                    ctx.beginPath();
                    if (typeof ctx.roundRect === 'function') {
                        ctx.roundRect(x - 30, h - cfg.padding.bottom + 10, 60, 20, 4);
                    } else {
                        ctx.rect(x - 30, h - cfg.padding.bottom + 10, 60, 20);
                    }
                    ctx.fill();
                    ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
                    ctx.lineWidth = 1;
                    ctx.stroke();

                    ctx.fillStyle = '#38bdf8';
                    ctx.font = 'bold 11px "JetBrains Mono", monospace';
                    ctx.fillText(`C${cNum} (${Math.round(t)}s)`, x, h - cfg.padding.bottom + 24);
                } else {
                    ctx.fillStyle = '#64748b';
                    ctx.font = '10px "JetBrains Mono", monospace';
                    ctx.fillText(`${Math.round(t)}s`, x, h - cfg.padding.bottom + 22);
                }
            }
        }

        // 4) [신규] 차량군 주행 시뮬레이션 애니메이션 렌더링
        if (this.state.isPlatoonSimActive) {
            this.drawPlatoonVehicles(bandUp, bandDown, chartW, chartH, cfg, tToX, getY, timeHorizon, cycle, dayIdx, axis);
        }

        // 5) 실시간 연동 대역폭 & 효율 HUD 카드 렌더링
        this.drawTsdMetricsHUD(bandUp, bandDown, w, h, chartW, chartH, cfg);

        this.updateInfoText(bandUp, bandDown);
    }

    // ── [신규] 차량군(Platoon) 주행 및 대기행렬 실시간 시뮬레이션 렌더링 (신호 연동/적신호 정차 물리 모델) ──
    drawPlatoonVehicles(bandUp, bandDown, chartW, chartH, cfg, tToX, getY, timeHorizon, cycle, dayIdx, axis) {
        const ctx = this.ctx;
        const T_cur = this.state.simClock;
        const curX = tToX(T_cur);
        const members = this.state.members;
        const distances = this.state.distances;
        const speeds = this.state.segSpeeds;
        const pIdx = this.state.todIdx || 0;
        const N = members.length;
        if (N < 2 || !distances || distances.length < N) return;

        ctx.save();
        ctx.beginPath();
        ctx.rect(cfg.padding.left, cfg.padding.top, chartW, chartH);
        ctx.clip();

        // 1. 현재 타임라인 수직 스위퍼 광선 바
        if (curX >= cfg.padding.left && curX <= cfg.padding.left + chartW) {
            ctx.save();
            ctx.strokeStyle = 'rgba(56, 189, 248, 0.75)';
            ctx.lineWidth = 1.5;
            ctx.shadowColor = '#38bdf8';
            ctx.shadowBlur = 12;
            ctx.beginPath();
            ctx.moveTo(curX, cfg.padding.top);
            ctx.lineTo(curX, cfg.padding.top + chartH);
            ctx.stroke();

            // 상단 타임 배지
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#0284c7';
            ctx.beginPath();
            if (typeof ctx.roundRect === 'function') {
                ctx.roundRect(curX - 26, cfg.padding.top - 22, 52, 18, 4);
            } else {
                ctx.rect(curX - 26, cfg.padding.top - 22, 52, 18);
            }
            ctx.fill();
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 1;
            ctx.stroke();

            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 10px "JetBrains Mono", monospace';
            ctx.textAlign = 'center';
            ctx.fillText(`T:${Math.round(T_cur)}s`, curX, cfg.padding.top - 9);
            ctx.restore();
        }

        // 개별 차량 렌더링 헬퍼 (차체 캡슐 + 헤드라이트 + 모션 블러 트레일 + 적신호 정차 대기행렬)
        const drawCar = (curX, curY, prevX, prevY, isUp, isStopped, waitRem, m) => {
            if (curX < cfg.padding.left - 25 || curX > cfg.padding.left + chartW + 25) return;

            // 1) 주행 중일 때만 모션 블러 네온 궤적 꼬리 (Light Tail)
            if (!isStopped && prevX !== undefined && prevY !== undefined) {
                ctx.save();
                const tailGrad = ctx.createLinearGradient(prevX, prevY, curX, curY);
                const tailColor = isUp ? 'rgba(56, 189, 248, ' : 'rgba(74, 222, 128, ';
                tailGrad.addColorStop(0, tailColor + '0)');
                tailGrad.addColorStop(1, tailColor + '0.75)');
                ctx.strokeStyle = tailGrad;
                ctx.lineWidth = 3;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(prevX, prevY);
                ctx.lineTo(curX, curY);
                ctx.stroke();
                ctx.restore();
            }

            // 2) 차량 본체
            ctx.save();
            ctx.translate(curX, curY);

            if (!isStopped) {
                // 주행 중: 전방 헤드라이트 빔
                const beamGrad = ctx.createRadialGradient(isUp ? 8 : -8, 0, 1, isUp ? 22 : -22, 0, 16);
                beamGrad.addColorStop(0, isUp ? 'rgba(56, 189, 248, 0.45)' : 'rgba(74, 222, 128, 0.45)');
                beamGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
                ctx.fillStyle = beamGrad;
                ctx.beginPath();
                ctx.arc(isUp ? 8 : -8, 0, 16, -Math.PI / 3, Math.PI / 3, !isUp);
                ctx.fill();
            }

            // 차체 (네온 발광 캡슐)
            ctx.shadowColor = isStopped ? '#ef4444' : (isUp ? '#38bdf8' : '#4ade80');
            ctx.shadowBlur = isStopped ? 14 : 10;
            ctx.fillStyle = isStopped ? '#b91c1c' : (isUp ? '#0284c7' : '#16a34a');
            ctx.strokeStyle = isStopped ? '#fca5a5' : '#ffffff';
            ctx.lineWidth = isStopped ? 1.5 : 1.2;

            ctx.beginPath();
            if (typeof ctx.roundRect === 'function') {
                ctx.roundRect(-8, -4.5, 16, 9, 3.5);
            } else {
                ctx.rect(-8, -4.5, 16, 9);
            }
            ctx.fill();
            ctx.stroke();

            // 윈도우 글래스
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(-3, -2.5, 6, 5);

            // 후방 브레이크등 (적신호 정차 시 강렬하게 점등)
            if (isStopped) {
                ctx.fillStyle = '#ff1744';
                ctx.fillRect(isUp ? -8 : 6, -4, 2.5, 8);
                // 브레이크등 발광 광원
                ctx.shadowColor = '#ff1744';
                ctx.shadowBlur = 8;
                ctx.fillRect(isUp ? -9 : 7, -3, 2, 6);
            }

            // 3) 적신호 정차 대기 시: 교차로 정지선 대기 뱃지 표시
            if (isStopped && waitRem !== undefined && m === 0) {
                ctx.shadowBlur = 0;
                ctx.fillStyle = 'rgba(239, 68, 68, 0.9)';
                ctx.beginPath();
                if (typeof ctx.roundRect === 'function') {
                    ctx.roundRect(10, -7, 44, 14, 3);
                } else {
                    ctx.rect(10, -7, 44, 14);
                }
                ctx.fill();
                ctx.strokeStyle = '#fca5a5';
                ctx.lineWidth = 0.8;
                ctx.stroke();

                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 8.5px "JetBrains Mono", monospace';
                ctx.textAlign = 'center';
                ctx.fillText(`대기 ${Math.ceil(waitRem)}s`, 32, 3);
            }

            ctx.restore();
        };

        // 2. 상행(Up) 소대 시뮬레이션
        // 1) 연동 녹색 밴드 소대 (Coordinated Platoons)
        const upBaseStart = (bandUp && bandUp.width > 0) ? bandUp.start : 15;
        for (let rep = -2; rep <= 5; rep++) {
            const platoonDepT = rep * cycle + upBaseStart;
            // 소대당 4대 (차량 간격 2.2초)
            for (let m = 0; m < 4; m++) {
                const depT = platoonDepT + m * 2.2;
                const traj = TSDAnalyzer.buildVehicleTrajectory(members, distances, speeds, axis, 'up', dayIdx, pIdx, cycle, depT);
                const st = TSDAnalyzer.getVehicleStateAtTime(traj, T_cur, getY, true, m);
                if (st) {
                    const carX = tToX(T_cur);
                    const prevX = st.isStopped ? carX : tToX(T_cur - 1.5);
                    drawCar(carX, st.y, prevX, st.prevY, true, st.isStopped, st.waitTimeRem, m);
                }
            }

            // 2) 비연동 / 적신호 걸림 소대 (Uncoordinated Platoons: 반대 위상에서 출발하여 적신호에 걸려 대기하는 차량들)
            if (bandUp && bandUp.width > 0) {
                const uncoordDepT = rep * cycle + ((upBaseStart + cycle * 0.5) % cycle);
                for (let m = 0; m < 3; m++) {
                    const depT = uncoordDepT + m * 2.5;
                    const traj = TSDAnalyzer.buildVehicleTrajectory(members, distances, speeds, axis, 'up', dayIdx, pIdx, cycle, depT);
                    const st = TSDAnalyzer.getVehicleStateAtTime(traj, T_cur, getY, true, m);
                    if (st) {
                        const carX = tToX(T_cur);
                        const prevX = st.isStopped ? carX : tToX(T_cur - 1.5);
                        drawCar(carX, st.y, prevX, st.prevY, true, st.isStopped, st.waitTimeRem, m);
                    }
                }
            }
        }

        // 3. 하행(Down) 소대 시뮬레이션
        const downBaseStart = (bandDown && bandDown.width > 0) ? bandDown.start : 25;
        for (let rep = -2; rep <= 5; rep++) {
            const platoonDepT = rep * cycle + downBaseStart;
            for (let m = 0; m < 4; m++) {
                const depT = platoonDepT + m * 2.2;
                const traj = TSDAnalyzer.buildVehicleTrajectory(members, distances, speeds, axis, 'down', dayIdx, pIdx, cycle, depT);
                const st = TSDAnalyzer.getVehicleStateAtTime(traj, T_cur, getY, false, m);
                if (st) {
                    const carX = tToX(T_cur);
                    const prevX = st.isStopped ? carX : tToX(T_cur - 1.5);
                    drawCar(carX, st.y, prevX, st.prevY, false, st.isStopped, st.waitTimeRem, m);
                }
            }

            // 비연동 / 적신호 걸림 소대
            if (bandDown && bandDown.width > 0) {
                const uncoordDepT = rep * cycle + ((downBaseStart + cycle * 0.5) % cycle);
                for (let m = 0; m < 3; m++) {
                    const depT = uncoordDepT + m * 2.5;
                    const traj = TSDAnalyzer.buildVehicleTrajectory(members, distances, speeds, axis, 'down', dayIdx, pIdx, cycle, depT);
                    const st = TSDAnalyzer.getVehicleStateAtTime(traj, T_cur, getY, false, m);
                    if (st) {
                        const carX = tToX(T_cur);
                        const prevX = st.isStopped ? carX : tToX(T_cur - 1.5);
                        drawCar(carX, st.y, prevX, st.prevY, false, st.isStopped, st.waitTimeRem, m);
                    }
                }
            }
        }

        // 4. 연동 대역(Band) 내부 연속 광자 펄스 (Band Flow Photons)
        // 유효한 녹색 연동 대역 내에서만 빛을 발하며 대각선으로 진행
        const totalTT = this.state.travelTimes[N - 1] || 1;
        const numPhotons = 8;
        const cycleProgress = ((T_cur % cycle) + cycle) % cycle / cycle;

        if (bandUp && bandUp.width > 0) {
            ctx.save();
            ctx.fillStyle = 'rgba(56, 189, 248, 0.85)';
            ctx.shadowColor = '#38bdf8';
            ctx.shadowBlur = 8;
            for (let rep = -1; rep <= 4; rep++) {
                for (let p = 0; p < numPhotons; p++) {
                    const frac = (p / numPhotons + cycleProgress) % 1.0;
                    const tau = frac * totalTT;
                    const depT = rep * cycle + bandUp.start + bandUp.width * 0.5;
                    const t = depT + tau;
                    // 보간 Y
                    let i = 0;
                    while (i < N - 2 && this.state.travelTimes[i + 1] < tau) i++;
                    const t0 = this.state.travelTimes[i], t1 = this.state.travelTimes[i + 1];
                    const ratio = (t1 > t0) ? Math.min(1, Math.max(0, (tau - t0) / (t1 - t0))) : 0;
                    const d = distances[i] + ratio * (distances[i + 1] - distances[i]);
                    const y = getY(i + ratio, d);

                    const x = tToX(t);
                    if (x >= cfg.padding.left && x <= cfg.padding.left + chartW) {
                        ctx.beginPath();
                        ctx.arc(x, y, 2.5, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }
            }
            ctx.restore();
        }

        if (bandDown && bandDown.width > 0) {
            ctx.save();
            ctx.fillStyle = 'rgba(74, 222, 128, 0.85)';
            ctx.shadowColor = '#4ade80';
            ctx.shadowBlur = 8;
            for (let rep = -1; rep <= 4; rep++) {
                for (let p = 0; p < numPhotons; p++) {
                    const frac = (p / numPhotons + cycleProgress) % 1.0;
                    const tau = frac * totalTT;
                    const depT = rep * cycle + bandDown.start + bandDown.width * 0.5;
                    const t = depT + tau;
                    let i = 0;
                    while (i < N - 2 && this.state.travelTimes[i + 1] < tau) i++;
                    const t0 = this.state.travelTimes[i], t1 = this.state.travelTimes[i + 1];
                    const ratio = (t1 > t0) ? Math.min(1, Math.max(0, (tau - t0) / (t1 - t0))) : 0;
                    const d = distances[i] + ratio * (distances[i + 1] - distances[i]);
                    const downNodeIdx = (N - 1) - (i + ratio);
                    const y = getY(downNodeIdx, distances[N - 1] - d);

                    const x = tToX(t);
                    if (x >= cfg.padding.left && x <= cfg.padding.left + chartW) {
                        ctx.beginPath();
                        ctx.arc(x, y, 2.5, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }
            }
            ctx.restore();
        }

        ctx.restore(); // 클리핑 해제
    }

    // ── 차량군 시뮬레이션 루프 컨트롤러 ──
    togglePlatoonAnimation() {
        if (!this.state.members || this.state.members.length < 2) {
            alert("시공도 차량군 주행 시뮬레이션을 실행할 연동 교차로(2개 이상)를 먼저 선택하십시오.");
            return;
        }
        this.state.isPlatoonSimActive = !this.state.isPlatoonSimActive;
        const btn = document.getElementById('btn-tsd-platoon');
        const icon = document.getElementById('tsd-platoon-icon');
        const txt = document.getElementById('tsd-platoon-text');
        
        if (this.state.isPlatoonSimActive) {
            if (btn) {
                btn.style.background = 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)';
                btn.style.color = '#ffffff';
                btn.style.borderColor = '#38bdf8';
                btn.style.boxShadow = '0 0 12px rgba(56, 189, 248, 0.6)';
            }
            if (icon) icon.innerText = '⏸';
            if (txt) txt.innerText = '주행 정지';
            this.state.lastSimTimestamp = performance.now();
            this.startPlatoonLoop();
        } else {
            if (btn) {
                btn.style.background = 'rgba(56, 189, 248, 0.15)';
                btn.style.color = '#38bdf8';
                btn.style.borderColor = 'rgba(56, 189, 248, 0.35)';
                btn.style.boxShadow = 'none';
            }
            if (icon) icon.innerText = '▶';
            if (txt) txt.innerText = '차량군 주행';
            this.stopPlatoonLoop();
            this.render(); // 정지 시 잔상 클리어
        }
    }

    startPlatoonLoop() {
        if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
        const loop = (ts) => {
            if (!this.state.isPlatoonSimActive) return;
            const delta = Math.min(0.1, (ts - this.state.lastSimTimestamp) / 1000);
            this.state.lastSimTimestamp = ts;

            // 시뮬레이션 가상 시계 진행 (실시간 4배속으로 부드러운 순환)
            const speedMultiplier = 4.0;
            this.state.simClock += delta * speedMultiplier;
            const timeHorizon = (this.state.cycle || 100) * 4;
            if (this.state.simClock > timeHorizon) {
                this.state.simClock = 0;
            }

            this.render();
            this.animFrameId = requestAnimationFrame(loop);
        };
        this.animFrameId = requestAnimationFrame(loop);
    }

    stopPlatoonLoop() {
        if (this.animFrameId) {
            cancelAnimationFrame(this.animFrameId);
            this.animFrameId = null;
        }
    }

    // ── 실시간 연동 대역폭 & 효율 메트릭 업데이트 (상단 분리형 HTML 스트립 연동, 캔버스 가림 원천 해결) ──
    drawTsdMetricsHUD(bandUp, bandDown, w, h, chartW, chartH, cfg) {
        const cycle = this.state.cycle || 100;
        const upW = bandUp ? (bandUp.width || 0) : 0;
        const downW = bandDown ? (bandDown.width || 0) : 0;
        const upEff = cycle > 0 ? (upW / cycle * 100).toFixed(1) : "0.0";
        const downEff = cycle > 0 ? (downW / cycle * 100).toFixed(1) : "0.0";
        const totEff = cycle > 0 ? ((upW + downW) / (2 * cycle) * 100).toFixed(1) : "0.0";
        const isSchematic = (this.state.scaleMode === 'schematic');

        // 1) 상단 분리형 HTML 메트릭 스트립 바 업데이트
        const elTot = document.getElementById('tsd-metric-tot');
        if (elTot) {
            elTot.innerText = `${totEff}%`;
            elTot.style.color = totEff > 30 ? '#38bdf8' : (totEff > 0 ? '#34d399' : '#f43f5e');
        }
        const elUp = document.getElementById('tsd-metric-up');
        if (elUp) elUp.innerText = `${upW.toFixed(1)}s`;
        const elUpPct = document.getElementById('tsd-metric-up-pct');
        if (elUpPct) elUpPct.innerText = `(${upEff}%)`;

        const elDown = document.getElementById('tsd-metric-down');
        if (elDown) elDown.innerText = `${downW.toFixed(1)}s`;
        const elDownPct = document.getElementById('tsd-metric-down-pct');
        if (elDownPct) elDownPct.innerText = `(${downEff}%)`;

        const elCycle = document.getElementById('tsd-metric-cycle');
        if (elCycle) elCycle.innerText = `C: ${cycle}s`;

        const elNodes = document.getElementById('tsd-metric-nodes');
        if (elNodes) {
            const vUp = bandUp ? (bandUp.validCount || 0) : 0;
            const vDown = bandDown ? (bandDown.validCount || 0) : 0;
            const total = this.state.members ? this.state.members.length : 0;
            elNodes.innerText = `${Math.max(vUp, vDown)}/${total}개`;
        }

        const elMode = document.getElementById('tsd-metric-mode');
        if (elMode) {
            elMode.innerText = isSchematic ? '균등모식도' : '거리비례';
            elMode.style.color = isSchematic ? '#6ee7b7' : '#38bdf8';
            elMode.style.borderColor = isSchematic ? 'rgba(110, 231, 183, 0.35)' : 'rgba(56, 189, 248, 0.35)';
        }

        // [핵심] 시공도 그래픽을 덮어 가리던 캔버스 내부 HUD 오버레이는 렌더링하지 않음!
    }

    // ── 듀얼 링(Dual-Ring) ──
    drawDualRingBars(j, y, chartW, timeHorizon, xF, dayIdx, axis) {
        const pIdx = this.state.todIdx, cycle = this.state.cycle;
        const tod = typeof getEffectiveDayPlan === "function" ? getEffectiveDayPlan(j, dayIdx, pIdx) : ((j.dayPlans && j.dayPlans[dayIdx]) ? j.dayPlans[dayIdx][pIdx] : null);
        if (!tod) return;
        const offset = tod.offset || 0;

        const sm = typeof getEffectiveSignalMap === "function" ? getEffectiveSignalMap(j, dayIdx, pIdx) : ((j.signalMaps && j.signalMaps[((j.dayPlanMapIds && j.dayPlanMapIds[dayIdx]) ? j.dayPlanMapIds[dayIdx] : 0)]) ? j.signalMaps[((j.dayPlanMapIds && j.dayPlanMapIds[dayIdx]) ? j.dayPlanMapIds[dayIdx] : 0)] : null);
        if (!sm) return;

        const proceedMovs = (axis === 'ew') ? [2, 6] : [4, 8];  // 진행 가능
        const blockedMovs = (axis === 'ew') ? [4, 8] : [2, 6];  // 진행 불가(교차 방향)
        const ringH = 10, gap = 0.5;
        const ctx = this.ctx, cfg = this.config;

        // 배경
        ctx.fillStyle = 'rgba(15, 23, 42, 0.65)';
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
                        ctx.fillStyle = isBottom ? '#0284c7' : '#10b981'; // vibrant neon green / cyan
                        if (isContinuous) {
                            // 연속 현시인 경우 황색 무시하고 전체 녹색
                            this.drawSegment(xS, yPos, xE - xS, ringH);
                        } else {
                            this.drawSegment(xS, yPos, xG - xS, ringH);
                            if (yellowTime > 0) {
                                ctx.fillStyle = '#f59e0b';
                                this.drawSegment(xG, yPos, xE - xG, ringH);
                            }
                        }
                    } else if (blockedMovs.includes(curMov)) {
                        // 교차 방향 이동류: 적색
                        ctx.fillStyle = '#e11d48'; // modern crimson red
                        this.drawSegment(xS, yPos, xE - xS, ringH);
                    } else if (curMov >= 1 && curMov <= 8) {
                        // 기타 차량(좌회전 등): 중성 인디고 블루
                        ctx.fillStyle = '#6366f1';
                        if (isContinuous) {
                            this.drawSegment(xS, yPos, xE - xS, ringH);
                        } else {
                            this.drawSegment(xS, yPos, xG - xS, ringH);
                            if (yellowTime > 0) {
                                ctx.fillStyle = '#f59e0b';
                                this.drawSegment(xG, yPos, xE - xG, ringH);
                            }
                        }
                    } else {
                        // 보행자/미설정
                        ctx.fillStyle = "rgba(225, 29, 72, 0.40)";
                        this.drawSegment(xS, yPos, xE - xS, ringH);
                    }

                    const segW = xE - xS;
                    if (segW > 14) this.drawPhaseArrow(xS + segW / 2, yPos + ringH / 2, curMov);
                    
                    // 툴팁용 hit region 등록
                    const dX = Math.max(cfg.padding.left, xS);
                    const dW = Math.min(cfg.padding.left + chartW, xE) - dX;
                    if (dW > 0 && this.state.hitRegions) {
                        this.state.hitRegions.push({
                            x: dX, y: yPos, w: dW, h: ringH,
                            mov: curMov, split: splitTime, green: greenTime, yellow: yellowTime
                        });
                    }

                    ctx.fillStyle = 'rgba(255,255,255,0.22)';
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
    drawHybridBand(dir, band, timeHorizon, xF, tToX, getY, dayIdx, axis) {
        const ctx = this.ctx, cfg = this.config, cycle = this.state.cycle;
        const members = this.state.members, distances = this.state.distances, totalDist = this.state.totalDist;
        const isUp = (dir === 'up');
        const distToY = (d, nodeIdx = 0) => getY(nodeIdx, d); // [안전 장치] 거리->Y 호환 헬퍼

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
                    const y = getY(i, dist);
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
                ctx.moveTo(tToX(baseT + firstTravel), getY(firstIdx, distances[firstIdx]));

                for (const idx of sortedIdx) {
                    const nodeDist = distances[idx];
                    const travel = isUp ? this.state.travelTimes[idx] : (totalTT - this.state.travelTimes[idx]);
                    let t = baseT + travel;
                    ctx.lineTo(tToX(t), getY(idx, nodeDist));

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
                        ctx.moveTo(tToX(t), getY(idx, nodeDist));
                        t += wait;
                        ctx.lineTo(tToX(t), getY(idx, nodeDist));
                        ctx.stroke(); ctx.setLineDash([]);

                        ctx.fillStyle = cfg.colors.wait;
                        ctx.beginPath(); ctx.arc(tToX(t - wait), getY(idx, nodeDist), 3, 0, Math.PI * 2); ctx.fill();

                        ctx.beginPath(); ctx.strokeStyle = trajColor; ctx.lineWidth = 1.5;
                        ctx.moveTo(tToX(t), getY(idx, nodeDist));
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
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = 'bold 10px "JetBrains Mono", monospace';
        this.ctx.textAlign = 'center'; this.ctx.textBaseline = 'middle';
        
        // Add text stroke for better visibility
        this.ctx.strokeStyle = 'rgba(0,0,0,0.7)';
        this.ctx.lineWidth = 2;
        this.ctx.strokeText(m >= 100 ? 'W' : m, x, y);
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
            <div style="background:rgba(100,181,246,0.15); color:#64b5f6; padding:2px 6px; border-radius:4px; font-size:10px;">[계획 ${dayNo} #${planNo}]</div>
            <div style="display:flex; align-items:center; gap:3px;"><span style="color:${this.config.trajectories.up}">●</span> 상:${upLabel}</div>
            <div style="display:flex; align-items:center; gap:3px;"><span style="color:${this.config.trajectories.down}">●</span> 하:${downLabel}</div>
            <div style="color:#aaa;">C:<span style="color:#fff;">${c}</span></div>
            <div style="color:#aaa;">V:<span style="color:#fff;">${speed}</span></div>
            <div style="opacity:0.6; font-size:9px;">${Math.max(vUp, vDown)}/${total}개</div>
        `;
    }

    // ── [신규 확장 메서드군] ──
    setScaleMode(mode) {
        this.state.scaleMode = mode;
        this.render();
    }

    stepOffset(delta) {
        if (!this.state.members || this.state.members.length === 0) return;
        const targetJid = this.state.selectedJid || this.state.members[0].id;
        const j = STATE.junctions[targetJid];
        if (!j) return;

        const daySelector = document.getElementById('tsd-day-plan');
        const dayIdx = daySelector ? parseInt(daySelector.value) : (STATE.currentGroupDayTypeIdx || 0);
        const pIdx = this.state.todIdx || 0;
        const cycle = this.state.cycle || 100;

        if (j.dayPlans && j.dayPlans[dayIdx] && j.dayPlans[dayIdx][pIdx]) {
            const cur = j.dayPlans[dayIdx][pIdx].offset || 0;
            const next = ((cur + delta) % cycle + cycle) % cycle;
            j.dayPlans[dayIdx][pIdx].offset = next;
            
            if (typeof renderGroupTODTable === 'function') renderGroupTODTable();
            this.render();
        }
    }

    autoOptimizeOffsets() {
        if (!this.state.members || this.state.members.length < 2) {
            alert("최적화할 교차로 데이터가 없습니다. 교차로가 2개 이상인 그룹을 먼저 선택하세요.");
            return;
        }

        const axisEl = document.querySelector('input[name="tsd-axis"]:checked');
        const axis = axisEl ? axisEl.value : 'ew';
        const daySelector = document.getElementById('tsd-day-plan');
        const dayIdx = daySelector ? parseInt(daySelector.value) : (STATE.currentGroupDayTypeIdx || 0);
        const pIdx = this.state.todIdx || 0;
        const cycle = this.state.cycle || 100;

        const res = TSDAnalyzer.optimizeOffsets(
            this.state.members,
            this.state.distances,
            this.state.totalDist,
            cycle,
            this.state.travelTimes,
            dayIdx,
            pIdx,
            axis
        );

        if (!res || !res.offsets) {
            alert("오프셋 최적화 연산에 실패했습니다.");
            return;
        }

        // 최적 오프셋 적용
        this.state.members.forEach((m, i) => {
            const newOff = res.offsets[i];
            if (m.dayPlans && m.dayPlans[dayIdx] && m.dayPlans[dayIdx][pIdx]) {
                m.dayPlans[dayIdx][pIdx].offset = newOff;
            }
        });

        if (typeof renderGroupTODTable === 'function') renderGroupTODTable();
        this.render();

        const effUp = cycle > 0 ? (res.upWidth / cycle * 100).toFixed(1) : 0;
        const effDown = cycle > 0 ? (res.downWidth / cycle * 100).toFixed(1) : 0;
        alert(`✨ MaxBand 자동 최적화 완료!\n\n• 상행 대역폭: ${res.upWidth.toFixed(1)}초 (${effUp}%)\n• 하행 대역폭: ${res.downWidth.toFixed(1)}초 (${effDown}%)\n• 양방향 총 대역폭: ${res.totalScore.toFixed(1)}초 (기존: ${res.initialScore.toFixed(1)}초)`);
    }

    exportEngineeringDiagram() {
        if (!this.state.members || this.state.members.length < 2) {
            alert("내보낼 시공도 데이터가 없습니다. 교차로가 2개 이상인 그룹을 먼저 선택하세요.");
            return;
        }

        const origCanvas = document.getElementById('tsd-canvas');
        if (!origCanvas) return;

        // 고해상도 오프스크린 캔버스 (1920x1080 Full HD)
        const expCanvas = document.createElement('canvas');
        const expW = 1920;
        const expH = 1080;
        expCanvas.width = expW;
        expCanvas.height = expH;
        const expCtx = expCanvas.getContext('2d');

        // 1. 도면 배경
        expCtx.fillStyle = '#0a0d14';
        expCtx.fillRect(0, 0, expW, expH);

        // 2. 상단 엔지니어링 타이틀 블록
        expCtx.fillStyle = 'rgba(255, 255, 255, 0.03)';
        expCtx.fillRect(24, 20, expW - 48, 80);
        expCtx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
        expCtx.lineWidth = 1.5;
        expCtx.strokeRect(24, 20, expW - 48, 80);

        expCtx.fillStyle = '#38bdf8';
        expCtx.font = 'bold 22px "Outfit", "Inter", sans-serif';
        expCtx.textAlign = 'left';
        expCtx.fillText('SIGMA 2.0 — 연동 시공도 분석 도면 (Time-Space Diagram)', 45, 54);

        const group = STATE.groups[this.state.gid];
        const gName = group ? (group.name || `그룹 ${group.id}`) : `그룹 ${this.state.gid}`;
        const daySelector = document.getElementById('tsd-day-plan');
        const dayName = daySelector ? daySelector.options[daySelector.selectedIndex]?.text : '일계획 1';
        const timeSelector = document.getElementById('tsd-time-slot');
        const timeName = timeSelector ? timeSelector.options[timeSelector.selectedIndex]?.text : '기본 시간대';
        const speed = document.getElementById('tsd-speed')?.value || '50';
        const cycle = this.state.cycle || 100;
        const modeText = this.state.scaleMode === 'schematic' ? '모식도(균등간격)' : '실제 거리비례';
        const nowStr = new Date().toLocaleString('ko-KR');

        expCtx.fillStyle = '#94a3b8';
        expCtx.font = '13px "JetBrains Mono", monospace';
        expCtx.fillText(`[분석대상: ${gName}]  |  [계획: ${dayName} - ${timeName}]  |  [주기: ${cycle}s]  |  [속도: ${speed}km/h]  |  [스케일: ${modeText}]  |  [출력: ${nowStr}]`, 45, 82);

        // 3. 메인 시공도 다이어그램 복사
        const diagX = 24;
        const diagY = 114;
        const diagW = expW - 48;
        const diagH = expH - 144;

        expCtx.drawImage(origCanvas, diagX, diagY, diagW, diagH);

        // 도면 외곽 테두리
        expCtx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
        expCtx.lineWidth = 1;
        expCtx.strokeRect(diagX, diagY, diagW, diagH);

        // 하단 서명 및 워터마크
        expCtx.fillStyle = '#64748b';
        expCtx.font = '11px "Outfit", sans-serif';
        expCtx.textAlign = 'right';
        expCtx.fillText('Generated by SIGMA Traffic Signal Coordination Engine (v3.2)', expW - 35, expH - 10);

        // 4. 자동 다운로드 트리거
        const link = document.createElement('a');
        link.download = `TSD_${gName.replace(/\s+/g, '_')}_${dayName}_${Date.now()}.png`;
        link.href = expCanvas.toDataURL('image/png');
        link.click();
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
        scaleMode: TSD_ENGINE.state.scaleMode || 'proportional',
        segSpeeds: TSD_ENGINE.state.segSpeeds || [],
        speed: parseFloat(document.getElementById('tsd-speed')?.value) || 50,
        axis: document.querySelector('input[name="tsd-axis"]:checked')?.value || 'ew',
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
        scaleMode: TSD_ENGINE.state.scaleMode || 'proportional',
        segSpeeds: TSD_ENGINE.state.segSpeeds || [],
        speed: parseFloat(document.getElementById('tsd-speed')?.value) || 50,
        axis: document.querySelector('input[name="tsd-axis"]:checked')?.value || 'ew',
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

// 전역 엔진 및 분석기 클래스 외부 노출 (AI 그룹 리포트 연동용)
if (typeof window !== 'undefined') {
    window.TSDAnalyzer = TSDAnalyzer;
    window.TSDEngine = TSDEngine;

    // [신규] 차량군(Platoon) 주행 애니메이션 재생/정지 토글
    window.toggleTsdPlatoonAnimation = function() {
        if (!TSD_ENGINE) return;
        TSD_ENGINE.togglePlatoonAnimation();
    };

    // [신규] 스케일 모드 토글 (거리비례 vs 균등간격 모식도)
    window.setTsdScaleMode = function(mode) {
        if (!TSD_ENGINE) return;
        TSD_ENGINE.setScaleMode(mode);
    };

    // [신규] 오프셋 1초/5초 단위 미세조정 스테퍼
    window.stepTsdOffset = function(delta) {
        if (!TSD_ENGINE) return;
        TSD_ENGINE.stepOffset(delta);
    };

    // [신규] 지능형 MaxBand 원클릭 오프셋 자동 최적화
    window.autoOptimizeTsdOffsets = function() {
        if (!TSD_ENGINE) return;
        TSD_ENGINE.autoOptimizeOffsets();
    };

    // [신규] GIS 지도 동기화 호버링 (시공도 -> 지도)
    window.syncTsdHoverToMap = function(jid) {
        if (!STATE || !STATE.junctions) return;
        if (window._tsdLastHoveredMarker) {
            try {
                window._tsdLastHoveredMarker.setStyle({
                    radius: window._tsdLastHoveredMarker._origRadius || 6,
                    color: window._tsdLastHoveredMarker._origColor || '#38bdf8',
                    weight: window._tsdLastHoveredMarker._origWeight || 1.5,
                    fillColor: window._tsdLastHoveredMarker._origFillColor || '#38bdf8'
                });
            } catch(e){}
            window._tsdLastHoveredMarker = null;
        }

        if (!jid) return;
        const j = STATE.junctions[jid];
        if (!j) return;

        const marker = j.marker || (window.markers && window.markers[jid]);
        if (marker && typeof marker.setStyle === 'function') {
            marker._origRadius = marker._origRadius || marker.getRadius?.() || 6;
            marker._origColor = marker.options?.color;
            marker._origWeight = marker.options?.weight;
            marker._origFillColor = marker.options?.fillColor;
            marker.setStyle({
                radius: 11,
                color: '#ffd700',
                weight: 3,
                fillColor: '#ffd700'
            });
            window._tsdLastHoveredMarker = marker;
        }
    };

    // [신규] 지도 클릭 -> 시공도 포커스 하이라이트 (지도 -> 시공도)
    window.highlightTsdJunction = function(jid) {
        if (!TSD_ENGINE) return;
        TSD_ENGINE.state.selectedJid = jid;
        TSD_ENGINE.render();
    };

    // [신규] 고해상도 정규 공학 시공도 도면(PNG) 내보내기
    window.exportTsdEngineeringDiagram = function() {
        if (!TSD_ENGINE) return;
        TSD_ENGINE.exportEngineeringDiagram();
    };
}


