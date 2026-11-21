/**
 * ==============================================================================
 * SIGMA_SIM - KHCM 2026 Signalized Intersection Analysis Module
 * (한국도로용량편람 2026 신호교차로 용량 및 서비스수준 분석 모듈)
 * 
 * @file khcm_analysis.js
 * @description 
 * - 북동남서 (North, East, South, West) 4개 접근로 도로·교통·신호조건 한눈에 통합 4열 표출
 * - 차로 진행방향 7x4 체크박스 매트릭스 및 도류화, 안전표지, 신호등 상세 사양 지원
 * - 2026 KHCM 차로군 분류, 포화교통류율(s), 용량(c), v/c, 지체도(d1, d2, d3), LOS A~F 산출
 * - 북·동·남·서 접근로별 및 교차로 종합 서비스수준(LOS) 실시간 평가 엔진
 * - 교차로 신호/현시 데이터 자동 연동 및 영구 캐시/저장
 * ==============================================================================
 */

(function () {
    'use strict';

    window.KHCM = window.KHCM || {};
    const KHCM = window.KHCM;

    // 접근로 정의: 북 -> 동 -> 남 -> 서 순서 (사용자 명시 요구사항 반영)
    KHCM.APPROACHES = [
        { id: 'NB', name: '북향 (Northbound)', shortName: '북향', icon: '⬆️' },
        { id: 'EB', name: '동향 (Eastbound)', shortName: '동향', icon: '➡️' },
        { id: 'SB', name: '남향 (Southbound)', shortName: '남향', icon: '⬇️' },
        { id: 'WB', name: '서향 (Westbound)', shortName: '서향', icon: '⬅️' }
    ];

    // 기본 접근로 데이터 팩토리
    KHCM.createDefaultApproachData = function (dirId) {
        const isEastOrWest = (dirId === 'EB' || dirId === 'WB');
        return {
            geom: {
                grade: 0.0,              // 접근경사 (%)
                crosswalk: true,          // 횡단보도 (있음: true, 없음: false)
                lanes: 3,                 // 차로수 (1~7)
                laneWidths: [3.0, 3.0, 3.0, 3.0, 3.0, 3.0, 3.0], // 1~7차로 차로폭 (m)
                // 1~7차로 진행방향 (유턴 u, 좌회전 l, 직진 t, 우회전 r)
                movements: [
                    { u: false, l: true,  t: false, r: false }, // 1차로: 좌
                    { u: false, l: false, t: true,  r: false }, // 2차로: 직
                    { u: false, l: false, t: true,  r: true  }, // 3차로: 직우
                    { u: false, l: false, t: false, r: false }, // 4차로
                    { u: false, l: false, t: false, r: false }, // 5차로
                    { u: false, l: false, t: false, r: false }, // 6차로
                    { u: false, l: false, t: false, r: false }  // 7차로
                ],
                uTurnPocketLength: 0,     // (유·좌 공용차로) 유턴가능구간 길이 (m)
                channelization: {
                    uTurnAuxLength: 0,       // 유턴 부가차로 길이 (m)
                    rightTurnAuxLanes: 0,    // 우회전 부가차로 차로수
                    rightTurnAuxLength: 0,   // 우회전 부가차로 길이 (m)
                    hasIsland: false,        // 교통섬
                    islandPocketLength: 0    // 대기공간길이 (m)
                },
                opposing: {
                    curveRadius: 0,          // 곡선반경 (m)
                    opposingLanes: 2         // 대향차로수
                }
            },
            traffic: {
                phf: 1.0,                 // 첨두시간계수
                volumes: {
                    car:   { u: 0, l: isEastOrWest ? 150 : 120, t: isEastOrWest ? 250 : 200, r: isEastOrWest ? 200 : 150 },
                    heavy: { u: 0, l: isEastOrWest ? 25 : 15,   t: isEastOrWest ? 50 : 30,   r: isEastOrWest ? 30 : 20   }
                },
                pGreen: (dirId === 'WB') ? 0.40 : 0.27, // 녹색신호 도착률 (P_G)
                initialQueue: [0, 0, 0, 0, 0, 0, 0]    // 초기대기행렬 (승용차 대수)
            },
            signal: {
                signalHeadType: '4color', // '4color' | '3color' | 'other'
                threeColorDetail: {
                    circleGreen: false,   // 원형 녹색등
                    arrowGreen: false     // 화살표 녹색등
                },
                pedSignal: true,          // 보행자신호등
                rightSignal: false,       // 우회전신호등
                uTurnAllowed: false,      // 유턴 허용
                uTurnCondition: {
                    onLeftTurn: false,    // 좌회전시
                    onPedSignal: false    // 보행신호시
                },
                safetySigns: {
                    noLeftTurn: false,       // 좌회전 금지
                    unprotectedLeft: false,  // 비보호 좌회전 허용
                    noRightTurn: false,      // 우회전 금지
                    noRightOnRed: false      // 적신호시 우회전금지
                },
                // 신호시간 파라미터 (교차로에서 동기화 가능)
                cycle: 100,               // 주기 C (초)
                greenTime: { u: 20, l: 25, t: 35, r: 35 }, // 이동류별 유효녹색시간 (초)
                yellowTime: 3,
                allRedTime: 2
            }
        };
    };

    // 상태 저장소
    KHCM.dataStore = {}; // { [jid]: { NB: {...}, EB: {...}, SB: {...}, WB: {...} } }
    KHCM.currentJid = null;

    /**
     * 교차로 데이터 가져오기 (메모리 -> 로컬스토리지 -> 기본값)
     */
    KHCM.getJunctionData = function (jid) {
        if (!jid) return null;
        if (KHCM.dataStore[jid]) return KHCM.dataStore[jid];

        // 1. STATE.junctions 확인
        if (typeof STATE !== 'undefined' && STATE.junctions && STATE.junctions[jid] && STATE.junctions[jid].khcm) {
            KHCM.dataStore[jid] = JSON.parse(JSON.stringify(STATE.junctions[jid].khcm));
            return KHCM.dataStore[jid];
        }

        // 2. localStorage 확인
        try {
            const saved = localStorage.getItem(`sigma_khcm_${jid}`);
            if (saved) {
                KHCM.dataStore[jid] = JSON.parse(saved);
                return KHCM.dataStore[jid];
            }
        } catch (e) {
            console.warn('[KHCM] LocalStorage read failed:', e);
        }

        // 3. 기본값 생성 (북, 동, 남, 서 4개 접근로)
        const initial = {};
        KHCM.APPROACHES.forEach(app => {
            initial[app.id] = KHCM.createDefaultApproachData(app.id);
        });

        // 현재 교차로의 신호정보가 있으면 자동 반영
        KHCM.autoFillFromJunctionState(jid, initial);

        KHCM.dataStore[jid] = initial;
        return initial;
    };

    /**
     * 교차로 신호/차로 상태로부터 KHCM 파라미터 자동 추출
     */
    KHCM.autoFillFromJunctionState = function (jid, targetData) {
        if (typeof STATE === 'undefined' || !STATE.junctions || !STATE.junctions[jid]) return;
        const j = STATE.junctions[jid];
        const data = targetData || KHCM.getJunctionData(jid);
        if (!data) return;

        // 주기 추출
        let cycle = 100;
        if (j.cycle && Number(j.cycle) > 0) {
            cycle = Number(j.cycle);
        } else if (j.offset && Array.isArray(j.offset) && j.offset[0] && j.offset[0].cycle) {
            cycle = Number(j.offset[0].cycle);
        }

        // 각 접근로에 주기 및 신호시간 배분
        KHCM.APPROACHES.forEach(app => {
            if (data[app.id] && data[app.id].signal) {
                data[app.id].signal.cycle = cycle;
                const tGreen = Math.max(10, Math.round(cycle * 0.35));
                const lGreen = Math.max(8, Math.round(cycle * 0.25));
                data[app.id].signal.greenTime = {
                    u: lGreen,
                    l: lGreen,
                    t: tGreen,
                    r: tGreen
                };
                data[app.id].traffic.pGreen = Number((tGreen / cycle).toFixed(2));
            }
        });
    };

    /**
     * 데이터 저장 (메모리 + localStorage + STATE)
     */
    KHCM.saveJunctionData = function (jid) {
        if (!jid) jid = KHCM.currentJid;
        if (!jid || !KHCM.dataStore[jid]) return;

        try {
            const jsonStr = JSON.stringify(KHCM.dataStore[jid]);
            localStorage.setItem(`sigma_khcm_${jid}`, jsonStr);

            if (typeof STATE !== 'undefined' && STATE.junctions && STATE.junctions[jid]) {
                STATE.junctions[jid].khcm = JSON.parse(jsonStr);
            }
            console.log(`[KHCM] Saved data for junction ${jid}`);
        } catch (e) {
            console.error('[KHCM] Save error:', e);
        }
    };

    /**
     * =========================================================================
     * 2026 KHCM 신호교차로 용량 및 서비스수준(LOS) 계산 엔진
     * =========================================================================
     */
    KHCM.calculate = function (jid) {
        if (!jid) jid = KHCM.currentJid;
        const jData = KHCM.getJunctionData(jid);
        if (!jData) return null;

        const results = {
            approaches: {},
            intersection: {
                totalVolume: 0,
                totalCapacity: 0,
                weightedDelay: 0,
                maxVC: 0,
                los: 'A'
            }
        };

        let sumVolDelay = 0;
        let sumTotalVol = 0;
        let maxVCAll = 0;

        // 북 -> 동 -> 남 -> 서 순서로 계산
        KHCM.APPROACHES.forEach(app => {
            const appData = jData[app.id];
            const appRes = KHCM.calculateApproach(appData);
            results.approaches[app.id] = appRes;

            if (appRes && appRes.totalVolume > 0) {
                sumVolDelay += (appRes.averageDelay * appRes.totalVolume);
                sumTotalVol += appRes.totalVolume;
                if (appRes.maxVC > maxVCAll) maxVCAll = appRes.maxVC;
            }
        });

        const intDelay = sumTotalVol > 0 ? (sumVolDelay / sumTotalVol) : 0;
        results.intersection.totalVolume = sumTotalVol;
        results.intersection.weightedDelay = Number(intDelay.toFixed(1));
        results.intersection.maxVC = Number(maxVCAll.toFixed(2));
        results.intersection.los = KHCM.getLOS(intDelay, maxVCAll);

        return results;
    };

    /**
     * 단일 접근로 용량 및 지체도 계산
     */
    KHCM.calculateApproach = function (appData) {
        if (!appData) return null;

        const geom = appData.geom;
        const traffic = appData.traffic;
        const signal = appData.signal;

        const cycle = Math.max(30, signal.cycle || 100);
        const phf = Math.max(0.5, Math.min(1.0, traffic.phf || 1.0));
        const grade = geom.grade || 0.0;
        const pGreen = traffic.pGreen || 0.3;

        // 중차량 승용차 환산계수 E_T (평지 1.5, 구배 보정)
        const Et = grade > 0 ? (1.5 + grade * 0.1) : (grade < 0 ? (1.5 + grade * 0.05) : 1.5);

        // 차로폭 보정계수 fw (3.0m 기준)
        const avgLaneWidth = geom.laneWidths.slice(0, geom.lanes).reduce((a, b) => a + b, 0) / Math.max(1, geom.lanes);
        const fw = 1.0 + (avgLaneWidth - 3.0) / 30.0;

        // 구배 보정계수 fg
        const fg = 1.0 - (grade * 0.01);

        // 이동류별 분석 (좌회전, 직진, 우회전, 유턴)
        const movements = [
            { id: 'l', name: '좌회전', volCar: traffic.volumes.car.l || 0, volHvy: traffic.volumes.heavy.l || 0, g: signal.greenTime.l || 25, isTurn: 'left' },
            { id: 't', name: '직진',   volCar: traffic.volumes.car.t || 0, volHvy: traffic.volumes.heavy.t || 0, g: signal.greenTime.t || 35, isTurn: 'thru' },
            { id: 'r', name: '우회전', volCar: traffic.volumes.car.r || 0, volHvy: traffic.volumes.heavy.r || 0, g: signal.greenTime.r || 35, isTurn: 'right' },
            { id: 'u', name: '유턴',   volCar: traffic.volumes.car.u || 0, volHvy: traffic.volumes.heavy.u || 0, g: signal.greenTime.u || 20, isTurn: 'uturn' }
        ];

        // 차로수 배분 계산
        let leftLanes = 0, thruLanes = 0, rightLanes = 0, uTurnLanes = 0;
        for (let i = 0; i < geom.lanes; i++) {
            const m = geom.movements[i] || { u: false, l: false, t: false, r: false };
            let count = (m.u ? 1 : 0) + (m.l ? 1 : 0) + (m.t ? 1 : 0) + (m.r ? 1 : 0);
            if (count === 0) count = 1; // 기본 직진
            if (m.u) uTurnLanes += (1 / count);
            if (m.l) leftLanes += (1 / count);
            if (m.t) thruLanes += (1 / count);
            if (m.r) rightLanes += (1 / count);
        }
        if (thruLanes === 0 && geom.lanes > 0) thruLanes = Math.max(1, geom.lanes - leftLanes - rightLanes);

        const laneCounts = { l: Math.max(0.5, leftLanes), t: Math.max(1.0, thruLanes), r: Math.max(0.5, rightLanes), u: Math.max(0.5, uTurnLanes) };

        const groups = [];
        let totalApproachVol = 0;
        let sumVolDelay = 0;
        let maxVC = 0;

        movements.forEach(m => {
            const totalVol = m.volCar + m.volHvy;
            if (totalVol <= 0 && m.id === 'u') return;

            totalApproachVol += totalVol;

            const Pt = totalVol > 0 ? (m.volHvy / totalVol) : 0;
            const fHV = 1.0 / (1.0 + Pt * (Et - 1.0));
            const v = Math.round(totalVol / (phf * fHV));

            let fTurn = 1.0;
            if (m.isTurn === 'left') {
                fTurn = signal.safetySigns.unprotectedLeft ? 0.80 : 0.95;
            } else if (m.isTurn === 'right') {
                fTurn = geom.channelization.hasIsland ? 0.95 : 0.85;
            }

            const s0 = 2200;
            const N = laneCounts[m.id] || 1.0;
            const s = Math.round(s0 * N * fw * fg * fHV * fTurn);

            const g = Math.max(5, m.g);
            const gC = g / cycle;
            const c = Math.max(1, Math.round(s * gC));

            const X = Number((v / c).toFixed(2));
            if (X > maxVC) maxVC = X;

            const num1 = 0.5 * cycle * Math.pow(1.0 - gC, 2);
            const den1 = 1.0 - (Math.min(1.0, X) * gC);
            const d1 = num1 / Math.max(0.01, den1);

            const PF = Math.max(0.4, Math.min(1.5, (1.0 - pGreen) / Math.max(0.05, 1.0 - gC)));

            const T = 0.25;
            const k = 0.5;
            const I = 1.0;
            const termA = X - 1.0;
            const termB = Math.sqrt(Math.max(0, Math.pow(X - 1.0, 2) + (8.0 * k * I * X) / (c * T)));
            const d2 = 900.0 * T * (termA + termB);

            const initialQ = (traffic.initialQueue || []).reduce((a, b) => a + b, 0);
            const d3 = (initialQ * 3600.0) / Math.max(10, c);

            const d = Number((d1 * PF + d2 + d3).toFixed(1));
            const los = KHCM.getLOS(d, X);

            sumVolDelay += (d * totalVol);

            groups.push({
                id: m.id,
                name: m.name,
                volumeTotal: totalVol,
                volumeCar: m.volCar,
                volumeHeavy: m.volHvy,
                v: v,
                N: Number(N.toFixed(1)),
                s: s,
                g: g,
                gC: Number(gC.toFixed(2)),
                c: c,
                vc: X,
                d1: Number(d1.toFixed(1)),
                d2: Number(d2.toFixed(1)),
                d3: Number(d3.toFixed(1)),
                d: d,
                los: los
            });
        });

        const avgAppDelay = totalApproachVol > 0 ? (sumVolDelay / totalApproachVol) : 0;
        const appLOS = KHCM.getLOS(avgAppDelay, maxVC);

        return {
            totalVolume: totalApproachVol,
            averageDelay: Number(avgAppDelay.toFixed(1)),
            maxVC: Number(maxVC.toFixed(2)),
            los: appLOS,
            laneGroups: groups,
            params: {
                fw: Number(fw.toFixed(3)),
                fg: Number(fg.toFixed(3)),
                Et: Number(Et.toFixed(2)),
                cycle: cycle
            }
        };
    };

    KHCM.getLOS = function (delay, vc) {
        if (vc && vc > 1.0) return 'F';
        if (delay <= 15.0) return 'A';
        if (delay <= 30.0) return 'B';
        if (delay <= 50.0) return 'C';
        if (delay <= 70.0) return 'D';
        if (delay <= 100.0) return 'E';
        return 'F';
    };

    KHCM.getLOSColor = function (los) {
        switch (los) {
            case 'A': return '#10b981';
            case 'B': return '#06b6d4';
            case 'C': return '#3b82f6';
            case 'D': return '#f59e0b';
            case 'E': return '#f97316';
            case 'F': return '#ef4444';
            default: return '#94a3b8';
        }
    };

    /**
     * =========================================================================
     * UI 렌더링 및 인터페이스 (북동남서 4열 동시 일괄 표출)
     * =========================================================================
     */
    KHCM.injectStyles = function () {
        if (document.getElementById('khcm-styles')) return;
        const style = document.createElement('style');
        style.id = 'khcm-styles';
        style.textContent = `
            /* 운영통계 일체화 테마 스타일 */
            .khcm-table-scroll {
                width: 100%;
                overflow-x: auto;
                padding-bottom: 5px;
            }
            .khcm-unified-table {
                width: 100%;
                min-width: 900px;
                border-collapse: collapse;
                background: rgba(0, 0, 0, 0.2);
                border: 1px solid #333;
                font-size: 11px;
                color: #f1f5f9;
                margin-bottom: 5px;
            }
            .khcm-unified-table th {
                border: 1px solid #444;
                padding: 6px 4px;
                background: rgba(255, 255, 255, 0.05);
                color: #888;
                font-size: 10.5px;
                font-weight: normal;
                text-align: center;
            }
            .khcm-unified-table th.col-app-header {
                background: rgba(0, 0, 0, 0.3);
                color: #38bdf8;
                font-size: 12px;
                font-weight: bold;
                padding: 6px 4px;
            }
            .khcm-unified-table td {
                border: 1px solid #444;
                padding: 4px;
                text-align: center;
                background: rgba(0, 0, 0, 0.1);
            }
            .khcm-unified-table td.sec-label {
                background: rgba(0, 0, 0, 0.3);
                color: #38bdf8;
                font-weight: bold;
                font-size: 11px;
                padding: 4px 8px;
                text-align: center;
            }
            .khcm-unified-table td.th-sub-label {
                background: rgba(0, 0, 0, 0.2);
                color: #cbd5e1;
                font-weight: 600;
                font-size: 11px;
                padding: 4px 8px;
                text-align: left;
                width: 125px;
            }
            .khcm-unified-input {
                height: 22px;
                font-size: 11px;
                background: #333;
                color: #fff;
                border: 1px solid #555;
                border-radius: 3px;
                outline: none;
                text-align: center;
                padding: 2px 4px;
                box-sizing: border-box;
                width: 100%;
                max-width: 75px;
            }
            .khcm-unified-input:focus {
                border-color: #38bdf8;
                box-shadow: 0 0 5px rgba(56, 189, 248, 0.4);
            }
            .khcm-btn-compact {
                height: 28px;
                padding: 0 12px;
                font-size: 11px;
                font-weight: bold;
                border-radius: 4px;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                gap: 5px;
                transition: all 0.2s;
                background: #1e293b;
                border: 1px solid #475569;
                color: #f1f5f9;
            }
            .khcm-btn-compact:hover {
                background: #334155;
                border-color: #94a3b8;
            }
            .khcm-mini-kpi {
                background: rgba(15, 23, 42, 0.8);
                border: 1px solid rgba(255, 255, 255, 0.08);
                border-radius: 6px;
                padding: 8px 12px;
                display: flex;
                flex-direction: column;
                gap: 2px;
            }
        `;
        document.head.appendChild(style);
    };

    /**
     * 운영통계 공통 상단 액션 바 렌더러
     */
    KHCM.renderCommonActionBar = function (jid) {
        return `
            <div style="margin-bottom:15px; display:flex; justify-content:space-between; align-items:center;">
                <div style="display:flex; gap:8px;">
                    <button class="khcm-btn-compact" style="color:#38bdf8; border-color:rgba(56,189,248,0.4);" onclick="KHCM.syncFromJunction('${jid}')">
                        🔄 신호정보 동기화
                    </button>
                    <button class="khcm-btn-compact" style="color:#34d399; border-color:rgba(52,211,153,0.4);" onclick="KHCM.runCalculation()">
                        ⚡ 실시간 분석
                    </button>
                </div>
                <button class="btn-neon magenta" style="height:32px; padding:0 20px; font-weight:bold; cursor:pointer;" onclick="if(typeof updateActiveJunctionToDB==='function') updateActiveJunctionToDB();">
                    ☁️ 클라우드 저장
                </button>
            </div>
        `;
    };

    /**
     * 운영통계 스타일 4개 접근로 thead 생성
     */
    function getAppTableHeaderHtml(dirIds) {
        const appInfoMap = {};
        KHCM.APPROACHES.forEach(a => { appInfoMap[a.id] = a; });
        let html = `
            <thead>
                <tr>
                    <th colspan="2" style="width:145px; background:rgba(0,0,0,0.3); color:#888; font-size:11px; font-weight:bold; border:1px solid #444;">구분</th>
        `;
        dirIds.forEach(dirId => {
            const info = appInfoMap[dirId];
            html += `
                <th class="col-app-header" style="border:1px solid #444;">
                    ${info.icon} ${info.name}
                </th>
            `;
        });
        html += `
                </tr>
            </thead>
        `;
        return html;
    }

    /**
     * [1. 도로조건] 전용 테이블 렌더러 (운영통계 스타일)
     */
    KHCM.renderRoadTableHtml = function (data, dirIds) {
        let html = `
            <table class="khcm-unified-table">
                ${getAppTableHeaderHtml(dirIds)}
                <tbody>
                    <!-- 접근경사 -->
                    <tr>
                        <td rowspan="8" class="sec-label">도로조건</td>
                        <td class="th-sub-label">접근경사</td>
        `;
        dirIds.forEach(dirId => {
            const geom = data[dirId].geom;
            html += `
                <td>
                    <div style="display:inline-flex; align-items:center; gap:3px;">
                        <input type="number" step="0.1" class="khcm-unified-input" style="width:50px;" value="${geom.grade}" 
                            onchange="KHCM.updateField('${dirId}', 'geom.grade', parseFloat(this.value))">
                        <span style="font-size:10px; color:#aaa;">%</span>
                    </div>
                </td>
            `;
        });
        html += `</tr>`;

        // 횡단보도
        html += `
            <tr>
                <td class="th-sub-label">횡단보도</td>
        `;
        dirIds.forEach(dirId => {
            const geom = data[dirId].geom;
            html += `
                <td>
                    <label style="display:inline-flex; align-items:center; gap:3px; font-size:11px; color:#cbd5e1; cursor:pointer;">
                        <input type="radio" name="crosswalk_${dirId}" style="accent-color:#38bdf8;" ${geom.crosswalk ? 'checked' : ''} 
                            onchange="KHCM.updateField('${dirId}', 'geom.crosswalk', true)"> 있음
                    </label>
                    <label style="display:inline-flex; align-items:center; gap:3px; font-size:11px; color:#cbd5e1; cursor:pointer; margin-left:8px;">
                        <input type="radio" name="crosswalk_${dirId}" style="accent-color:#38bdf8;" ${!geom.crosswalk ? 'checked' : ''} 
                            onchange="KHCM.updateField('${dirId}', 'geom.crosswalk', false)"> 없음
                    </label>
                </td>
            `;
        });
        html += `</tr>`;

        // 차로수
        html += `
            <tr>
                <td class="th-sub-label">차로수</td>
        `;
        dirIds.forEach(dirId => {
            const geom = data[dirId].geom;
            html += `
                <td>
                    <input type="number" min="1" max="7" class="khcm-unified-input" style="width:45px;" value="${geom.lanes}" 
                        onchange="KHCM.updateField('${dirId}', 'geom.lanes', parseInt(this.value, 10))">
                </td>
            `;
        });
        html += `</tr>`;

        // 차로폭 (1~7차로)
        html += `
            <tr>
                <td class="th-sub-label">차로폭 (m)</td>
        `;
        dirIds.forEach(dirId => {
            const geom = data[dirId].geom;
            html += `
                <td>
                    <div style="display:grid; grid-template-columns:repeat(7, 1fr); gap:1px; font-size:9.5px;">
                        ${[1, 2, 3, 4, 5, 6, 7].map(lane => `<div style="color:#888; font-weight:600;">${lane}</div>`).join('')}
                        ${[0, 1, 2, 3, 4, 5, 6].map(idx => `
                            <div>
                                <input type="number" step="0.1" class="khcm-unified-input" style="padding:1px 0; font-size:10px; width:100%; max-width:28px;" 
                                    value="${geom.laneWidths[idx] !== undefined ? geom.laneWidths[idx] : 3.0}" 
                                    ${idx >= geom.lanes ? 'disabled style="opacity:0.2;"' : ''}
                                    onchange="KHCM.updateArrayField('${dirId}', 'geom.laneWidths', ${idx}, parseFloat(this.value))">
                            </div>
                        `).join('')}
                    </div>
                </td>
            `;
        });
        html += `</tr>`;

        // 차로 진행방향 7x4 매트릭스
        html += `
            <tr>
                <td class="th-sub-label">차로 진행방향</td>
        `;
        dirIds.forEach(dirId => {
            const geom = data[dirId].geom;
            const movLabels = [
                { key: 'u', label: '유' },
                { key: 'l', label: '좌' },
                { key: 't', label: '직' },
                { key: 'r', label: '우' }
            ];

            html += `
                <td>
                    <table style="width:100%; border-collapse:collapse; font-size:10px;">
                        <tr style="background:rgba(255,255,255,0.03);">
                            <th style="padding:1px; width:16px; color:#888; border:1px solid #444;"></th>
                            ${[1, 2, 3, 4, 5, 6, 7].map(l => `<th style="padding:1px; color:#888; border:1px solid #444;">${l}</th>`).join('')}
                        </tr>
                        ${movLabels.map(m => `
                            <tr>
                                <td style="padding:1px; font-weight:700; color:#38bdf8; border:1px solid #444;">${m.label}</td>
                                ${[0, 1, 2, 3, 4, 5, 6].map(lIdx => {
                                    const isChecked = geom.movements[lIdx] && geom.movements[lIdx][m.key];
                                    const isDisabled = (lIdx >= geom.lanes);
                                    return `
                                        <td style="padding:1px; text-align:center; border:1px solid #444;">
                                            <input type="checkbox" style="accent-color:#38bdf8; cursor:pointer;" ${isChecked ? 'checked' : ''} ${isDisabled ? 'disabled style="opacity:0.2;"' : ''}
                                                onchange="KHCM.updateMovementMatrix('${dirId}', ${lIdx}, '${m.key}', this.checked)">
                                        </td>
                                    `;
                                }).join('')}
                            </tr>
                        `).join('')}
                    </table>
                </td>
            `;
        });
        html += `</tr>`;

        // 유턴구간길이
        html += `
            <tr>
                <td class="th-sub-label">유턴구간길이</td>
        `;
        dirIds.forEach(dirId => {
            const geom = data[dirId].geom;
            html += `
                <td style="text-align:center;">
                    <div style="font-size:9.5px; color:#888;">(유·좌 공용차로)</div>
                    <div style="display:inline-flex; align-items:center; gap:3px;">
                        <input type="number" class="khcm-unified-input" style="width:50px;" value="${geom.uTurnPocketLength || ''}" placeholder="0"
                            onchange="KHCM.updateField('${dirId}', 'geom.uTurnPocketLength', parseFloat(this.value) || 0)">
                        <span style="font-size:10px; color:#aaa;">m</span>
                    </div>
                </td>
            `;
        });
        html += `</tr>`;

        // 도류화시설 (유턴부가차로, 우회전부가차로, 교통섬)
        html += `
            <tr>
                <td class="th-sub-label">도류화시설</td>
        `;
        dirIds.forEach(dirId => {
            const ch = data[dirId].geom.channelization;
            html += `
                <td style="text-align:left; padding:4px 8px; font-size:10.5px;">
                    <div style="margin-bottom:2px;">
                        유턴부가: 
                        <input type="number" class="khcm-unified-input" style="width:45px;" value="${ch.uTurnAuxLength || ''}" placeholder="0"
                            onchange="KHCM.updateField('${dirId}', 'geom.channelization.uTurnAuxLength', parseFloat(this.value) || 0)"> m
                    </div>
                    <div style="margin-bottom:2px;">
                        우회전부가: 
                        <input type="number" class="khcm-unified-input" style="width:34px;" value="${ch.rightTurnAuxLanes || ''}" placeholder="0"
                            onchange="KHCM.updateField('${dirId}', 'geom.channelization.rightTurnAuxLanes', parseInt(this.value, 10) || 0)"> 차로 / 
                        <input type="number" class="khcm-unified-input" style="width:45px;" value="${ch.rightTurnAuxLength || ''}" placeholder="0"
                            onchange="KHCM.updateField('${dirId}', 'geom.channelization.rightTurnAuxLength', parseFloat(this.value) || 0)"> m
                    </div>
                    <div>
                        <label style="display:inline-flex; align-items:center; gap:3px; cursor:pointer;">
                            <input type="checkbox" style="accent-color:#38bdf8;" ${ch.hasIsland ? 'checked' : ''}
                                onchange="KHCM.updateField('${dirId}', 'geom.channelization.hasIsland', this.checked)"> 교통섬
                        </label>
                        (대기: <input type="number" class="khcm-unified-input" style="width:45px;" value="${ch.islandPocketLength || ''}" placeholder="0"
                            onchange="KHCM.updateField('${dirId}', 'geom.channelization.islandPocketLength', parseFloat(this.value) || 0)"> m)
                    </div>
                </td>
            `;
        });
        html += `</tr>`;

        // 대향진출로 (곡선반경, 대향차로수)
        html += `
            <tr>
                <td class="th-sub-label">대향진출로<br><span style="font-size:9.5px; color:#888;">(접근로)</span></td>
        `;
        dirIds.forEach(dirId => {
            const op = data[dirId].geom.opposing;
            html += `
                <td style="text-align:center; font-size:10.5px;">
                    곡선반경: 
                    <input type="number" class="khcm-unified-input" style="width:45px;" value="${op.curveRadius || ''}" placeholder="0"
                        onchange="KHCM.updateField('${dirId}', 'geom.opposing.curveRadius', parseFloat(this.value) || 0)"> m
                    &nbsp;차로수: 
                    <input type="number" class="khcm-unified-input" style="width:34px;" value="${op.opposingLanes || 2}"
                        onchange="KHCM.updateField('${dirId}', 'geom.opposing.opposingLanes', parseInt(this.value, 10) || 2)">
                </td>
            `;
        });
        html += `</tr>
                </tbody>
            </table>
        `;
        return html;
    };

    /**
     * [2. 교통조건] 전용 테이블 렌더러 (운영통계 스타일)
     */
    KHCM.renderTrafficTableHtml = function (data, dirIds) {
        let html = `
            <table class="khcm-unified-table">
                ${getAppTableHeaderHtml(dirIds)}
                <tbody>
                    <!-- 첨두시간계수 -->
                    <tr>
                        <td rowspan="4" class="sec-label" style="color:#10b981;">교통조건</td>
                        <td class="th-sub-label">첨두시간계수 (PHF)</td>
        `;
        dirIds.forEach(dirId => {
            const tr = data[dirId].traffic;
            html += `
                <td>
                    PHF = <input type="number" step="0.01" min="0.5" max="1.0" class="khcm-unified-input" value="${tr.phf}" style="width:52px;"
                        onchange="KHCM.updateField('${dirId}', 'traffic.phf', parseFloat(this.value))">
                </td>
            `;
        });
        html += `</tr>`;

        // 교통량 (승용차 / 중차량 x 유, 좌, 직, 우)
        html += `
            <tr>
                <td class="th-sub-label">교통량 (대/시)</td>
        `;
        dirIds.forEach(dirId => {
            const vols = data[dirId].traffic.volumes;
            html += `
                <td>
                    <table style="width:100%; border-collapse:collapse; font-size:10px;">
                        <tr style="background:rgba(255,255,255,0.03);">
                            <th style="padding:1px; color:#888; border:1px solid #444;"></th>
                            <th style="padding:1px; color:#888; border:1px solid #444;">유</th>
                            <th style="padding:1px; color:#888; border:1px solid #444;">좌</th>
                            <th style="padding:1px; color:#888; border:1px solid #444;">직</th>
                            <th style="padding:1px; color:#888; border:1px solid #444;">우</th>
                        </tr>
                        <tr>
                            <td style="padding:1px; font-weight:600; color:#cbd5e1; border:1px solid #444;">승용</td>
                            <td style="border:1px solid #444;"><input type="number" class="khcm-unified-input" style="width:36px; padding:1px;" value="${vols.car.u || ''}" placeholder="-" onchange="KHCM.updateField('${dirId}', 'traffic.volumes.car.u', parseInt(this.value, 10) || 0)"></td>
                            <td style="border:1px solid #444;"><input type="number" class="khcm-unified-input" style="width:36px; padding:1px;" value="${vols.car.l || ''}" onchange="KHCM.updateField('${dirId}', 'traffic.volumes.car.l', parseInt(this.value, 10) || 0)"></td>
                            <td style="border:1px solid #444;"><input type="number" class="khcm-unified-input" style="width:36px; padding:1px;" value="${vols.car.t || ''}" onchange="KHCM.updateField('${dirId}', 'traffic.volumes.car.t', parseInt(this.value, 10) || 0)"></td>
                            <td style="border:1px solid #444;"><input type="number" class="khcm-unified-input" style="width:36px; padding:1px;" value="${vols.car.r || ''}" onchange="KHCM.updateField('${dirId}', 'traffic.volumes.car.r', parseInt(this.value, 10) || 0)"></td>
                        </tr>
                        <tr>
                            <td style="padding:1px; font-weight:600; color:#cbd5e1; border:1px solid #444;">중차</td>
                            <td style="border:1px solid #444;"><input type="number" class="khcm-unified-input" style="width:36px; padding:1px;" value="${vols.heavy.u || ''}" placeholder="-" onchange="KHCM.updateField('${dirId}', 'traffic.volumes.heavy.u', parseInt(this.value, 10) || 0)"></td>
                            <td style="border:1px solid #444;"><input type="number" class="khcm-unified-input" style="width:36px; padding:1px;" value="${vols.heavy.l || ''}" onchange="KHCM.updateField('${dirId}', 'traffic.volumes.heavy.l', parseInt(this.value, 10) || 0)"></td>
                            <td style="border:1px solid #444;"><input type="number" class="khcm-unified-input" style="width:36px; padding:1px;" value="${vols.heavy.t || ''}" onchange="KHCM.updateField('${dirId}', 'traffic.volumes.heavy.t', parseInt(this.value, 10) || 0)"></td>
                            <td style="border:1px solid #444;"><input type="number" class="khcm-unified-input" style="width:36px; padding:1px;" value="${vols.heavy.r || ''}" onchange="KHCM.updateField('${dirId}', 'traffic.volumes.heavy.r', parseInt(this.value, 10) || 0)"></td>
                        </tr>
                    </table>
                </td>
            `;
        });
        html += `</tr>`;

        // 녹색신호 도착률 (P_G)
        html += `
            <tr>
                <td class="th-sub-label">녹색신호 도착률 (P<sub>G</sub>)</td>
        `;
        dirIds.forEach(dirId => {
            const tr = data[dirId].traffic;
            html += `
                <td>
                    <div style="display:inline-flex; align-items:center; gap:3px;">
                        <i>P<sub>G</sub></i> = 
                        <input type="number" step="0.01" min="0" max="1.0" class="khcm-unified-input" style="width:52px;" value="${tr.pGreen}" 
                            onchange="KHCM.updateField('${dirId}', 'traffic.pGreen', parseFloat(this.value))">
                        <span style="font-size:10px; color:#888;">(G/C)</span>
                    </div>
                </td>
            `;
        });
        html += `</tr>`;

        // 초기대기행렬 (승용차)
        html += `
            <tr>
                <td class="th-sub-label">초기대기행렬<br><span style="font-size:9.5px; color:#888;">(승용차)</span></td>
        `;
        dirIds.forEach(dirId => {
            const q = data[dirId].traffic.initialQueue || [0, 0, 0, 0, 0, 0, 0];
            const lanes = data[dirId].geom.lanes;
            html += `
                <td>
                    <div style="display:grid; grid-template-columns:repeat(7, 1fr); gap:1px; font-size:9.5px;">
                        ${[1, 2, 3, 4, 5, 6, 7].map(lane => `<div style="color:#888; font-weight:600;">${lane}</div>`).join('')}
                        ${[0, 1, 2, 3, 4, 5, 6].map(idx => `
                            <div>
                                <input type="number" min="0" class="khcm-unified-input" style="padding:1px 0; font-size:10px; width:100%; max-width:28px;" 
                                    value="${q[idx] !== undefined ? q[idx] : 0}" 
                                    ${idx >= lanes ? 'disabled style="opacity:0.2;"' : ''}
                                    onchange="KHCM.updateArrayField('${dirId}', 'traffic.initialQueue', ${idx}, parseInt(this.value, 10) || 0)">
                            </div>
                        `).join('')}
                    </div>
                </td>
            `;
        });
        html += `</tr>
                </tbody>
            </table>
        `;
        return html;
    };

    /**
     * [3. 신호조건] 전용 테이블 렌더러 (운영통계 스타일)
     */
    KHCM.renderSignalTableHtml = function (data, dirIds) {
        let html = `
            <table class="khcm-unified-table">
                ${getAppTableHeaderHtml(dirIds)}
                <tbody>
                    <!-- 차량신호등 -->
                    <tr>
                        <td rowspan="5" class="sec-label" style="color:#f59e0b;">신호조건</td>
                        <td class="th-sub-label">차량신호등</td>
        `;
        dirIds.forEach(dirId => {
            const sig = data[dirId].signal;
            html += `
                <td style="text-align:left; padding-left:10px;">
                    <div style="display:flex; flex-direction:column; gap:4px; font-size:11px;">
                        <label style="display:inline-flex; align-items:center; gap:4px; cursor:pointer;">
                            <input type="radio" name="sighead_${dirId}" style="accent-color:#38bdf8;" ${sig.signalHeadType === '4color' ? 'checked' : ''}
                                onchange="KHCM.updateField('${dirId}', 'signal.signalHeadType', '4color')"> 4색 차량신호등
                        </label>
                        <div style="display:flex; align-items:center; gap:8px;">
                            <label style="display:inline-flex; align-items:center; gap:4px; cursor:pointer;">
                                <input type="radio" name="sighead_${dirId}" style="accent-color:#38bdf8;" ${sig.signalHeadType === '3color' ? 'checked' : ''}
                                    onchange="KHCM.updateField('${dirId}', 'signal.signalHeadType', '3color')"> 3색
                            </label>
                            <label style="font-size:10px; color:#94a3b8; display:inline-flex; align-items:center; gap:2px; cursor:pointer;">
                                <input type="checkbox" style="accent-color:#38bdf8;" ${sig.threeColorDetail.circleGreen ? 'checked' : ''}
                                    onchange="KHCM.updateField('${dirId}', 'signal.threeColorDetail.circleGreen', this.checked)"> 원형
                            </label>
                            <label style="font-size:10px; color:#94a3b8; display:inline-flex; align-items:center; gap:2px; cursor:pointer;">
                                <input type="checkbox" style="accent-color:#38bdf8;" ${sig.threeColorDetail.arrowGreen ? 'checked' : ''}
                                    onchange="KHCM.updateField('${dirId}', 'signal.threeColorDetail.arrowGreen', this.checked)"> 화살표
                            </label>
                        </div>
                        <label style="display:inline-flex; align-items:center; gap:4px; cursor:pointer;">
                            <input type="radio" name="sighead_${dirId}" style="accent-color:#38bdf8;" ${sig.signalHeadType === 'other' ? 'checked' : ''}
                                onchange="KHCM.updateField('${dirId}', 'signal.signalHeadType', 'other')"> 기타
                        </label>
                    </div>
                </td>
            `;
        });
        html += `</tr>`;

        // 보행자신호등
        html += `
            <tr>
                <td class="th-sub-label">보행자신호등</td>
        `;
        dirIds.forEach(dirId => {
            const sig = data[dirId].signal;
            html += `
                <td>
                    <label style="display:inline-flex; align-items:center; gap:3px; font-size:11px; cursor:pointer;">
                        <input type="radio" name="pedsig_${dirId}" style="accent-color:#38bdf8;" ${sig.pedSignal ? 'checked' : ''} 
                            onchange="KHCM.updateField('${dirId}', 'signal.pedSignal', true)"> 있음
                    </label>
                    <label style="display:inline-flex; align-items:center; gap:3px; font-size:11px; cursor:pointer; margin-left:8px;">
                        <input type="radio" name="pedsig_${dirId}" style="accent-color:#38bdf8;" ${!sig.pedSignal ? 'checked' : ''} 
                            onchange="KHCM.updateField('${dirId}', 'signal.pedSignal', false)"> 없음
                    </label>
                </td>
            `;
        });
        html += `</tr>`;

        // 우회전신호등
        html += `
            <tr>
                <td class="th-sub-label">우회전신호등</td>
        `;
        dirIds.forEach(dirId => {
            const sig = data[dirId].signal;
            html += `
                <td>
                    <label style="display:inline-flex; align-items:center; gap:3px; font-size:11px; cursor:pointer;">
                        <input type="radio" name="rightsig_${dirId}" style="accent-color:#38bdf8;" ${sig.rightSignal ? 'checked' : ''} 
                            onchange="KHCM.updateField('${dirId}', 'signal.rightSignal', true)"> 있음
                    </label>
                    <label style="display:inline-flex; align-items:center; gap:3px; font-size:11px; cursor:pointer; margin-left:8px;">
                        <input type="radio" name="rightsig_${dirId}" style="accent-color:#38bdf8;" ${!sig.rightSignal ? 'checked' : ''} 
                            onchange="KHCM.updateField('${dirId}', 'signal.rightSignal', false)"> 없음
                    </label>
                </td>
            `;
        });
        html += `</tr>`;

        // 유턴허용
        html += `
            <tr>
                <td class="th-sub-label">유턴허용</td>
        `;
        dirIds.forEach(dirId => {
            const sig = data[dirId].signal;
            html += `
                <td style="text-align:left; padding-left:10px;">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <label style="display:inline-flex; align-items:center; gap:3px; cursor:pointer; font-size:11px;">
                            <input type="checkbox" style="accent-color:#38bdf8;" ${sig.uTurnAllowed ? 'checked' : ''} 
                                onchange="KHCM.updateField('${dirId}', 'signal.uTurnAllowed', this.checked)"> 허용
                        </label>
                        <div style="display:flex; flex-direction:column; gap:2px; font-size:10px;">
                            <label style="display:inline-flex; align-items:center; gap:2px; cursor:pointer;">
                                <input type="checkbox" style="accent-color:#38bdf8;" ${sig.uTurnCondition.onLeftTurn ? 'checked' : ''} 
                                    onchange="KHCM.updateField('${dirId}', 'signal.uTurnCondition.onLeftTurn', this.checked)"> 좌회전시
                            </label>
                            <label style="display:inline-flex; align-items:center; gap:2px; cursor:pointer;">
                                <input type="checkbox" style="accent-color:#38bdf8;" ${sig.uTurnCondition.onPedSignal ? 'checked' : ''} 
                                    onchange="KHCM.updateField('${dirId}', 'signal.uTurnCondition.onPedSignal', this.checked)"> 보행신호시
                            </label>
                        </div>
                    </div>
                </td>
            `;
        });
        html += `</tr>`;

        // 교통안전표지
        html += `
            <tr>
                <td class="th-sub-label">교통안전표지</td>
        `;
        dirIds.forEach(dirId => {
            const signs = data[dirId].signal.safetySigns;
            html += `
                <td style="text-align:left; padding:4px 8px;">
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:3px; font-size:10px;">
                        <label style="display:inline-flex; align-items:center; gap:2px; cursor:pointer;">
                            <input type="checkbox" style="accent-color:#38bdf8;" ${signs.noLeftTurn ? 'checked' : ''} 
                                onchange="KHCM.updateField('${dirId}', 'signal.safetySigns.noLeftTurn', this.checked)"> 좌회전 금지
                        </label>
                        <label style="display:inline-flex; align-items:center; gap:2px; cursor:pointer;">
                            <input type="checkbox" style="accent-color:#38bdf8;" ${signs.unprotectedLeft ? 'checked' : ''} 
                                onchange="KHCM.updateField('${dirId}', 'signal.safetySigns.unprotectedLeft', this.checked)"> 비보호좌회전
                        </label>
                        <label style="display:inline-flex; align-items:center; gap:2px; cursor:pointer;">
                            <input type="checkbox" style="accent-color:#38bdf8;" ${signs.noRightTurn ? 'checked' : ''} 
                                onchange="KHCM.updateField('${dirId}', 'signal.safetySigns.noRightTurn', this.checked)"> 우회전 금지
                        </label>
                        <label style="display:inline-flex; align-items:center; gap:2px; cursor:pointer;">
                            <input type="checkbox" style="accent-color:#38bdf8;" ${signs.noRightOnRed ? 'checked' : ''} 
                                onchange="KHCM.updateField('${dirId}', 'signal.safetySigns.noRightOnRed', this.checked)"> 적신호우회전금지
                        </label>
                    </div>
                </td>
            `;
        });
        html += `</tr>
                </tbody>
            </table>
        `;
        return html;
    };

    /**
     * 운영통계 스타일 각 탭별 전체 페이지 생성기 (sigma-panel 일체화)
     */
    KHCM.renderRoadPageHtml = function (data, analysis, dirIds) {
        return `
            ${KHCM.renderCommonActionBar(KHCM.currentJid)}
            <div class="sigma-panel">
                <div class="card-title">
                    <span>🛣️ 접근로 도로조건 (기하구조 / 차로폭 / 진행방향 / 도류화시설)</span>
                </div>
                <div class="foldable-content">
                    <div class="khcm-table-scroll custom-scroll">
                        ${KHCM.renderRoadTableHtml(data, dirIds)}
                    </div>
                </div>
            </div>
        `;
    };

    KHCM.renderTrafficPageHtml = function (data, analysis, dirIds) {
        return `
            ${KHCM.renderCommonActionBar(KHCM.currentJid)}
            <div class="sigma-panel">
                <div class="card-title">
                    <span>🚗 접근로 교통조건 (첨두시간계수 / 차종별 교통량 / 도착률 / 초기대기행렬)</span>
                </div>
                <div class="foldable-content">
                    <div class="khcm-table-scroll custom-scroll">
                        ${KHCM.renderTrafficTableHtml(data, dirIds)}
                    </div>
                </div>
            </div>
        `;
    };

    KHCM.renderSignalPageHtml = function (data, analysis, dirIds) {
        return `
            ${KHCM.renderCommonActionBar(KHCM.currentJid)}
            <div class="sigma-panel mb-15">
                <div class="card-title">
                    <span>🚦 접근로 신호조건 (신호등 유형 / 보행신호 / 우회전신호 / 교통안전표지)</span>
                </div>
                <div class="foldable-content">
                    <div class="khcm-table-scroll custom-scroll">
                        ${KHCM.renderSignalTableHtml(data, dirIds)}
                    </div>
                </div>
            </div>

            <!-- 종합 분석 결과 패널 (운영통계 sigma-panel 일체형) -->
            <div class="sigma-panel" id="khcm-signal-report-container">
                <div class="card-title">
                    <span>📊 2026 KHCM 차로군별 용량 및 지체도 분석 결과</span>
                </div>
                <div class="foldable-content">
                    ${analysis ? KHCM.renderAnalysisReportHtml(analysis) : ''}
                </div>
            </div>
        `;
    };

    /**
     * 특정 탭 렌더링 함수
     */
    KHCM.renderTab = function (tabName, jid) {
        KHCM.injectStyles();
        if (jid) KHCM.currentJid = jid;
        if (!KHCM.currentJid && typeof STATE !== 'undefined') {
            KHCM.currentJid = STATE.activeJid;
        }
        if (!KHCM.currentJid) return;

        const data = KHCM.getJunctionData(KHCM.currentJid);
        const analysis = KHCM.calculate(KHCM.currentJid);
        const dirIds = ['NB', 'EB', 'SB', 'WB'];

        if (tabName === 'khcm-road') {
            const container = document.getElementById('overlay-tab-khcm-road');
            if (container) container.innerHTML = KHCM.renderRoadPageHtml(data, analysis, dirIds);
        } else if (tabName === 'khcm-traffic') {
            const container = document.getElementById('overlay-tab-khcm-traffic');
            if (container) container.innerHTML = KHCM.renderTrafficPageHtml(data, analysis, dirIds);
        } else if (tabName === 'khcm-signal') {
            const container = document.getElementById('overlay-tab-khcm-signal');
            if (container) container.innerHTML = KHCM.renderSignalPageHtml(data, analysis, dirIds);
        }
    };

    /**
     * 메인/단일 컨테이너 렌더링 함수 (호환용)
     */
    KHCM.render = function (containerId, jid) {
        KHCM.injectStyles();
        const container = (typeof containerId === 'string') ? document.getElementById(containerId) : containerId;
        if (!container) return;

        if (jid) KHCM.currentJid = jid;
        if (!KHCM.currentJid && typeof STATE !== 'undefined') {
            KHCM.currentJid = STATE.activeJid;
        }
        if (!KHCM.currentJid) {
            container.innerHTML = `<div style="padding:40px; text-align:center; color:#94a3b8;">교차로를 먼저 선택해 주십시오.</div>`;
            return;
        }

        const data = KHCM.getJunctionData(KHCM.currentJid);
        const analysis = KHCM.calculate(KHCM.currentJid);
        const dirIds = ['NB', 'EB', 'SB', 'WB'];

        container.innerHTML = KHCM.renderSignalPageHtml(data, analysis, dirIds);
    };

    /**
     * 차로군별 2026 KHCM 상세 분석 결과 보고서 테이블 (운영통계 스타일 일체화)
     */
    KHCM.renderAnalysisReportHtml = function (analysis) {
        if (!analysis) return '';
        const intLos = analysis.intersection.los;
        const intDelay = analysis.intersection.weightedDelay;
        const intVC = analysis.intersection.maxVC;
        const intVol = analysis.intersection.totalVolume;

        let html = `
            <!-- KPI 미니 요약 바 -->
            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap:10px; margin-bottom:12px;">
                <div class="khcm-mini-kpi" style="border-left: 3px solid ${KHCM.getLOSColor(intLos)};">
                    <span style="font-size:10px; color:#888; font-weight:600;">종합 서비스수준</span>
                    <span style="font-size:16px; font-weight:bold; color:${KHCM.getLOSColor(intLos)};">LOS ${intLos}</span>
                </div>
                <div class="khcm-mini-kpi">
                    <span style="font-size:10px; color:#888; font-weight:600;">평균 제어지체 (d)</span>
                    <span style="font-size:16px; font-weight:bold; color:#fff;">${intDelay} <span style="font-size:10.5px; font-weight:normal; color:#888;">초/대</span></span>
                </div>
                <div class="khcm-mini-kpi">
                    <span style="font-size:10px; color:#888; font-weight:600;">최대 임계 V/C</span>
                    <span style="font-size:16px; font-weight:bold; color:${intVC > 1.0 ? '#ef4444' : (intVC > 0.85 ? '#f59e0b' : '#38bdf8')};">${intVC}</span>
                </div>
                <div class="khcm-mini-kpi">
                    <span style="font-size:10px; color:#888; font-weight:600;">분석 총교통량</span>
                    <span style="font-size:16px; font-weight:bold; color:#fff;">${intVol.toLocaleString()} <span style="font-size:10.5px; font-weight:normal; color:#888;">대/시</span></span>
                </div>
            </div>

            <!-- 차로군별 용량 및 지체도 분석표 -->
            <div class="khcm-table-scroll custom-scroll">
                <table class="khcm-unified-table">
                    <thead>
                        <tr>
                            <th style="width:100px;">접근로</th>
                            <th>차로군</th>
                            <th>교통량 (V)</th>
                            <th>분석교통량 (v)</th>
                            <th>차로수 (N)</th>
                            <th>포화교통류율 (s)</th>
                            <th>녹색시간 (g)</th>
                            <th>신호비 (g/C)</th>
                            <th>용량 (c)</th>
                            <th>포화도 (v/c)</th>
                            <th>균일지체 (d1)</th>
                            <th>증분지체 (d2)</th>
                            <th>제어지체 (d)</th>
                            <th>LOS</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        KHCM.APPROACHES.forEach(app => {
            const res = analysis.approaches[app.id];
            if (!res || !res.laneGroups || res.laneGroups.length === 0) return;

            const groupCount = res.laneGroups.length;
            res.laneGroups.forEach((lg, idx) => {
                html += `
                    <tr>
                        ${idx === 0 ? `<td rowspan="${groupCount}" style="background:rgba(0,0,0,0.3); font-weight:700; color:#cbd5e1; border:1px solid #444;">${app.icon} ${app.shortName}<br><span style="font-size:10px; color:#38bdf8;">(${res.averageDelay}s / ${res.los})</span></td>` : ''}
                        <td style="font-weight:600; color:#f8fafc; border:1px solid #444;">${lg.name}</td>
                        <td style="border:1px solid #444;">${lg.volumeTotal}</td>
                        <td style="color:#38bdf8; font-weight:600; border:1px solid #444;">${lg.v}</td>
                        <td style="border:1px solid #444;">${lg.N}</td>
                        <td style="border:1px solid #444;">${lg.s.toLocaleString()}</td>
                        <td style="border:1px solid #444;">${lg.g}s</td>
                        <td style="border:1px solid #444;">${lg.gC}</td>
                        <td style="border:1px solid #444;">${lg.c.toLocaleString()}</td>
                        <td style="font-weight:700; border:1px solid #444; color:${lg.vc > 1.0 ? '#ef4444' : (lg.vc > 0.85 ? '#f59e0b' : '#10b981')};">${lg.vc}</td>
                        <td style="border:1px solid #444;">${lg.d1}</td>
                        <td style="border:1px solid #444;">${lg.d2}</td>
                        <td style="font-weight:700; color:#f8fafc; border:1px solid #444;">${lg.d}</td>
                        <td style="border:1px solid #444;">
                            <span style="display:inline-block; padding:1px 6px; border-radius:4px; font-weight:bold; font-size:10.5px; background:${KHCM.getLOSColor(lg.los)}; color:#fff;">
                                ${lg.los}
                            </span>
                        </td>
                    </tr>
                `;
            });
        });

        html += `
                    </tbody>
                </table>
            </div>
        `;
        return html;
    };

    KHCM.mountToOverlay = function (jid) {
        KHCM.currentJid = jid;

        // 1. 기존 임시 서브탭 네비게이션이 남아있다면 완전히 제거 (운영통계 탭 원상 복원)
        const oldNav = document.getElementById('optstats-subnav');
        if (oldNav) oldNav.remove();
        const oldKhcm = document.getElementById('khcm-analysis-container');
        if (oldKhcm) oldKhcm.remove();

        // 2. 운영통계 탭 내부의 기본 컨트롤들 표시 복원
        const optTab = document.getElementById('overlay-tab-optstats');
        if (optTab) {
            optTab.querySelectorAll('.sigma-panel, div').forEach(el => {
                if (el.id !== 'opt-controls' && el.id !== 'lane-fields-unified') {
                    if (el.style.display === 'none' && !el.classList.contains('foldable-content')) {
                        el.style.display = '';
                    }
                }
            });
        }

        // 3. 도로조건, 교통조건, 신호조건 3개 컨테이너에 각각 선제적 렌더링
        KHCM.renderTab('khcm-road', jid);
        KHCM.renderTab('khcm-traffic', jid);
        KHCM.renderTab('khcm-signal', jid);
    };

    // 글로벌 노출
    window.KHCM = KHCM;

    // 자동 후킹 및 마운트 감지기
    function installHooks() {
        if (typeof window.openStatsOverlay === 'function' && !window.openStatsOverlay.__khcmHooked) {
            const origStats = window.openStatsOverlay;
            window.openStatsOverlay = function (jid) {
                origStats.apply(this, arguments);
                const activeJid = jid || (typeof STATE !== 'undefined' ? STATE.activeJid : null) || window._currentOverlayJid;
                
                // 4개 탭 버튼('운영통계', '도로조건', '교통조건', '신호조건') 활성화
                ['optstats', 'khcm-road', 'khcm-traffic', 'khcm-signal'].forEach(t => {
                    const btn = document.getElementById('tab-btn-' + t);
                    if (btn) btn.style.display = '';
                });
                ['phase', 'sigmap', 'baseinfo', 'khcm'].forEach(t => {
                    const btn = document.getElementById('tab-btn-' + t);
                    if (btn) btn.style.display = 'none';
                });

                setTimeout(() => {
                    if (KHCM && typeof KHCM.mountToOverlay === 'function') {
                        KHCM.mountToOverlay(activeJid);
                    }
                }, 50);
            };
            window.openStatsOverlay.__khcmHooked = true;
        }

        if (typeof window.switchOverlayTab === 'function' && !window.switchOverlayTab.__khcmHooked) {
            const origSwitch = window.switchOverlayTab;
            window.switchOverlayTab = function (tabName) {
                origSwitch.apply(this, arguments);
                if (tabName.startsWith('khcm-')) {
                    const activeJid = (typeof STATE !== 'undefined' ? STATE.activeJid : null) || window._currentOverlayJid;
                    setTimeout(() => {
                        if (KHCM && typeof KHCM.renderTab === 'function') {
                            KHCM.renderTab(tabName, activeJid);
                        }
                    }, 20);
                }
            };
            window.switchOverlayTab.__khcmHooked = true;
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', installHooks);
    } else {
        installHooks();
    }
    setInterval(installHooks, 1000);

})();
