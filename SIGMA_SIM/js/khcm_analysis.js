/**
 * ==============================================================================
 * SIGMA_SIM - KHCM 2026 Signalized Intersection Analysis Module
 * (한국도로용량편람 2026 신호교차로 용량 및 서비스수준 분석 모듈)
 * 
 * @file khcm_analysis.js
 * @description 
 * - 각 접근로(동향, 서향, 남향, 북향)별 도로조건, 교통조건, 신호조건 정밀 입력
 * - 차로 진행방향 7x4 체크박스 매트릭스 및 도류화, 안전표지, 신호등 상세 사양 지원
 * - 2026 KHCM 차로군 분류, 포화교통류율(s), 용량(c), v/c, 지체도(d1, d2, d3), LOS A~F 산출
 * - 접근로별 및 교차로 종합 서비스수준(LOS) 실시간 평가 엔진
 * - 교차로 신호/현시 데이터 자동 연동 및 영구 캐시/저장
 * ==============================================================================
 */

(function () {
    'use strict';

    // 전역 네임스페이스
    window.KHCM = window.KHCM || {};

    const KHCM = window.KHCM;

    // 접근로 정의
    KHCM.APPROACHES = [
        { id: 'EB', name: '동향 (Eastbound)', shortName: '동향', icon: '➡️' },
        { id: 'WB', name: '서향 (Westbound)', shortName: '서향', icon: '⬅️' },
        { id: 'SB', name: '남향 (Southbound)', shortName: '남향', icon: '⬇️' },
        { id: 'NB', name: '북향 (Northbound)', shortName: '북향', icon: '⬆️' }
    ];

    // 기본 접근로 데이터 팩토리
    KHCM.createDefaultApproachData = function (dirId) {
        // 동향/서향 샘플 프리셋 (첨부 이미지 기준)
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
    KHCM.dataStore = {}; // { [jid]: { EB: {...}, WB: {...}, SB: {...}, NB: {...} } }
    KHCM.currentJid = null;
    KHCM.currentDir = 'EB';
    KHCM.activeView = 'tab'; // 'tab' | 'split' (동서나란히/전체)

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

        // 3. 기본값 생성
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
                // 기본 녹색시간 비율 추정 (직진 35%, 좌회전 25%)
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

        // 중차량 승용차 환산계수 E_T (평지 1.5, 오르막 경사 보정)
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
            if (totalVol <= 0 && m.id === 'u') return; // 유턴 교통량 없으면 스킵 가능

            totalApproachVol += totalVol;

            // 중차량 비율 Pt 및 중차량 보정계수 fHV
            const Pt = totalVol > 0 ? (m.volHvy / totalVol) : 0;
            const fHV = 1.0 / (1.0 + Pt * (Et - 1.0));

            // 분석교통량 v (pcph)
            const v = Math.round(totalVol / (phf * fHV));

            // 회전 보정계수 f_LT, f_RT
            let fTurn = 1.0;
            if (m.isTurn === 'left') {
                fTurn = signal.safetySigns.unprotectedLeft ? 0.80 : 0.95; // 비보호 시 용량 감소
            } else if (m.isTurn === 'right') {
                fTurn = geom.channelization.hasIsland ? 0.95 : 0.85; // 교통섬 유무
            }

            // 이상 포화교통류율 s0 = 2,200 pcphgpl (2026 KHCM 기준)
            const s0 = 2200;
            const N = laneCounts[m.id] || 1.0;
            const s = Math.round(s0 * N * fw * fg * fHV * fTurn);

            // 유효녹색시간비 g/C
            const g = Math.max(5, m.g);
            const gC = g / cycle;

            // 차로군 용량 c (pcph)
            const c = Math.max(1, Math.round(s * gC));

            // 포화도 X = v / c
            const X = Number((v / c).toFixed(2));
            if (X > maxVC) maxVC = X;

            // 1. 균일지체 d1 (초/대)
            const num1 = 0.5 * cycle * Math.pow(1.0 - gC, 2);
            const den1 = 1.0 - (Math.min(1.0, X) * gC);
            const d1 = num1 / Math.max(0.01, den1);

            // 도착군 보정계수 PF (도착률 pGreen 적용)
            const PF = Math.max(0.4, Math.min(1.5, (1.0 - pGreen) / Math.max(0.05, 1.0 - gC)));

            // 2. 증분지체 d2 (초/대) - k=0.5, I=1.0, T=0.25hr
            const T = 0.25;
            const k = 0.5;
            const I = 1.0;
            const termA = X - 1.0;
            const termB = Math.sqrt(Math.max(0, Math.pow(X - 1.0, 2) + (8.0 * k * I * X) / (c * T)));
            const d2 = 900.0 * T * (termA + termB);

            // 3. 초기대기행렬지체 d3
            const initialQ = (traffic.initialQueue || []).reduce((a, b) => a + b, 0);
            const d3 = (initialQ * 3600.0) / Math.max(10, c);

            // 총 평균 제어지체 d = d1 * PF + d2 + d3
            const d = Number((d1 * PF + d2 + d3).toFixed(1));

            // LOS 판정
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

    /**
     * 2026 KHCM 신호교차로 서비스수준 (LOS) 판정 기준표
     * - A: d <= 15.0 초/대
     * - B: 15.0 < d <= 30.0 초/대
     * - C: 30.0 < d <= 50.0 초/대
     * - D: 50.0 < d <= 70.0 초/대
     * - E: 70.0 < d <= 100.0 초/대
     * - F: d > 100.0 초/대 또는 v/c > 1.0 (과포화)
     */
    KHCM.getLOS = function (delay, vc) {
        if (vc && vc > 1.0) return 'F';
        if (delay <= 15.0) return 'A';
        if (delay <= 30.0) return 'B';
        if (delay <= 50.0) return 'C';
        if (delay <= 70.0) return 'D';
        if (delay <= 100.0) return 'E';
        return 'F';
    };

    /**
     * LOS 배지 색상 매핑
     */
    KHCM.getLOSColor = function (los) {
        switch (los) {
            case 'A': return '#10b981'; // green
            case 'B': return '#06b6d4'; // cyan
            case 'C': return '#3b82f6'; // blue
            case 'D': return '#f59e0b'; // amber
            case 'E': return '#f97316'; // orange
            case 'F': return '#ef4444'; // red
            default: return '#94a3b8';
        }
    };

    /**
     * =========================================================================
     * UI 렌더링 및 인터페이스 생성 (첨부 이미지 1:1 매핑)
     * =========================================================================
     */

    // CSS 스타일 동적 주입
    KHCM.injectStyles = function () {
        if (document.getElementById('khcm-styles')) return;
        const style = document.createElement('style');
        style.id = 'khcm-styles';
        style.textContent = `
            .khcm-container {
                display: flex;
                flex-direction: column;
                gap: 16px;
                color: #e2e8f0;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Malgun Gothic", sans-serif;
            }
            .khcm-header-bar {
                display: flex;
                justify-content: space-between;
                align-items: center;
                flex-wrap: wrap;
                gap: 10px;
                background: linear-gradient(135deg, rgba(30, 41, 59, 0.8), rgba(15, 23, 42, 0.9));
                padding: 12px 16px;
                border-radius: 8px;
                border: 1px solid rgba(56, 189, 248, 0.2);
            }
            .khcm-app-tabs {
                display: flex;
                gap: 6px;
            }
            .khcm-app-btn {
                background: rgba(15, 23, 42, 0.6);
                border: 1px solid #334155;
                color: #94a3b8;
                padding: 6px 14px;
                border-radius: 6px;
                font-size: 13px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s;
            }
            .khcm-app-btn:hover {
                border-color: #38bdf8;
                color: #f8fafc;
            }
            .khcm-app-btn.active {
                background: #0284c7;
                border-color: #38bdf8;
                color: #ffffff;
                box-shadow: 0 0 10px rgba(56, 189, 248, 0.4);
            }
            .khcm-actions {
                display: flex;
                gap: 8px;
            }
            .khcm-btn {
                background: #1e293b;
                border: 1px solid #475569;
                color: #f1f5f9;
                padding: 6px 12px;
                border-radius: 6px;
                font-size: 12px;
                font-weight: 600;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                gap: 6px;
                transition: all 0.2s;
            }
            .khcm-btn:hover {
                background: #334155;
                border-color: #94a3b8;
            }
            .khcm-btn-primary {
                background: linear-gradient(135deg, #0284c7, #2563eb);
                border-color: #38bdf8;
                color: #ffffff;
            }
            .khcm-btn-primary:hover {
                background: linear-gradient(135deg, #0369a1, #1d4ed8);
            }
            .khcm-btn-success {
                background: linear-gradient(135deg, #059669, #10b981);
                border-color: #34d399;
                color: #ffffff;
            }

            /* 정통 KHCM 테이블 스타일 */
            .khcm-table-wrap {
                width: 100%;
                overflow-x: auto;
                background: #0f172a;
                border: 1px solid #334155;
                border-radius: 8px;
                padding: 2px;
            }
            .khcm-table {
                width: 100%;
                border-collapse: collapse;
                font-size: 12px;
                text-align: center;
                color: #f1f5f9;
            }
            .khcm-table th, .khcm-table td {
                border: 1px solid #334155;
                padding: 6px 4px;
            }
            .khcm-table th {
                background: #1e293b;
                color: #94a3b8;
                font-weight: 700;
            }
            .khcm-table .sec-title {
                writing-mode: vertical-rl;
                text-orientation: upright;
                letter-spacing: 4px;
                background: #1e293b;
                font-weight: 800;
                width: 32px;
                color: #38bdf8;
                border-right: 2px solid #475569;
            }
            .khcm-table .th-sub {
                background: rgba(30, 41, 59, 0.7);
                text-align: left;
                padding-left: 10px;
                font-weight: 600;
                color: #cbd5e1;
                width: 130px;
            }
            .khcm-input {
                background: rgba(15, 23, 42, 0.9);
                border: 1px solid #475569;
                color: #38bdf8;
                border-radius: 4px;
                padding: 3px 6px;
                font-size: 12px;
                font-family: inherit;
                text-align: center;
                box-sizing: border-box;
                width: 100%;
                max-width: 90px;
            }
            .khcm-input:focus {
                border-color: #38bdf8;
                outline: none;
                box-shadow: 0 0 5px rgba(56, 189, 248, 0.5);
            }
            .khcm-checkbox {
                accent-color: #0284c7;
                cursor: pointer;
                width: 16px;
                height: 16px;
                vertical-align: middle;
            }
            .khcm-label {
                display: inline-flex;
                align-items: center;
                gap: 5px;
                font-size: 11.5px;
                cursor: pointer;
                color: #cbd5e1;
            }

            /* 결과 카드 및 대시보드 */
            .khcm-dashboard {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 12px;
            }
            .khcm-kpi-card {
                background: #1e293b;
                border: 1px solid #334155;
                border-radius: 8px;
                padding: 12px 16px;
                display: flex;
                flex-direction: column;
                gap: 4px;
                position: relative;
                overflow: hidden;
            }
            .khcm-kpi-title {
                font-size: 11px;
                font-weight: 600;
                color: #94a3b8;
                text-transform: uppercase;
            }
            .khcm-kpi-val {
                font-size: 24px;
                font-weight: 800;
                color: #f8fafc;
                display: flex;
                align-items: baseline;
                gap: 4px;
            }
            .khcm-kpi-unit {
                font-size: 12px;
                font-weight: normal;
                color: #64748b;
            }
            .khcm-los-badge {
                display: inline-block;
                padding: 2px 10px;
                border-radius: 6px;
                font-size: 16px;
                font-weight: 800;
                color: #ffffff;
            }
        `;
        document.head.appendChild(style);
    };

    /**
     * 메인 렌더링 함수
     */
    KHCM.render = function (containerId, jid) {
        KHCM.injectStyles();

        const container = (typeof containerId === 'string') ? document.getElementById(containerId) : containerId;
        if (!container) return;

        if (jid) KHCM.currentJid = jid;
        if (!KHCM.currentJid) {
            if (typeof STATE !== 'undefined' && STATE.activeJid) {
                KHCM.currentJid = STATE.activeJid;
            }
        }
        if (!KHCM.currentJid) {
            container.innerHTML = `<div style="padding:40px; text-align:center; color:#94a3b8;">교차로를 먼저 선택해 주십시오.</div>`;
            return;
        }

        const data = KHCM.getJunctionData(KHCM.currentJid);
        const analysis = KHCM.calculate(KHCM.currentJid);

        let html = `
            <div class="khcm-container">
                <!-- 상단 컨트롤 툴바 -->
                <div class="khcm-header-bar">
                    <div class="khcm-app-tabs">
        `;

        KHCM.APPROACHES.forEach(app => {
            const isActive = (KHCM.activeView === 'tab' && KHCM.currentDir === app.id);
            const appRes = analysis ? analysis.approaches[app.id] : null;
            const losBadge = appRes ? `<span style="display:inline-block; margin-left:4px; padding:1px 6px; border-radius:4px; font-size:10px; font-weight:800; background:${KHCM.getLOSColor(appRes.los)}; color:#fff;">${appRes.los}</span>` : '';
            html += `
                <button class="khcm-app-btn ${isActive ? 'active' : ''}" onclick="KHCM.selectApproach('${app.id}')">
                    ${app.icon} ${app.shortName} ${losBadge}
                </button>
            `;
        });

        // 분할 비교 모드 버튼
        html += `
                <button class="khcm-app-btn ${KHCM.activeView === 'split' ? 'active' : ''}" onclick="KHCM.toggleSplitView()">
                    📊 동·서 비교표
                </button>
            </div>
            <div class="khcm-actions">
                <button class="khcm-btn" onclick="KHCM.syncFromJunction('${KHCM.currentJid}')" title="현재 신호/현시 주기 자동 동기화">
                    🔄 신호정보 동기화
                </button>
                <button class="khcm-btn khcm-btn-primary" onclick="KHCM.runCalculation()">
                    ⚡ 2026 KHCM 분석
                </button>
                <button class="khcm-btn khcm-btn-success" onclick="KHCM.saveData()">
                    💾 설정 저장
                </button>
            </div>
        </div>
        `;

        // 요약 KPI 대시보드
        if (analysis) {
            const intLos = analysis.intersection.los;
            const intDelay = analysis.intersection.weightedDelay;
            const intVC = analysis.intersection.maxVC;
            const intVol = analysis.intersection.totalVolume;

            html += `
                <div class="khcm-dashboard">
                    <div class="khcm-kpi-card" style="border-left: 4px solid ${KHCM.getLOSColor(intLos)};">
                        <span class="khcm-kpi-title">교차로 종합 서비스수준</span>
                        <div class="khcm-kpi-val">
                            <span class="khcm-los-badge" style="background:${KHCM.getLOSColor(intLos)}; font-size:20px;">LOS ${intLos}</span>
                        </div>
                    </div>
                    <div class="khcm-kpi-card">
                        <span class="khcm-kpi-title">평균 제어지체 (d)</span>
                        <div class="khcm-kpi-val">
                            ${intDelay} <span class="khcm-kpi-unit">초/대 (KHCM 2026)</span>
                        </div>
                    </div>
                    <div class="khcm-kpi-card">
                        <span class="khcm-kpi-title">최대 임계 V/C (v/c max)</span>
                        <div class="khcm-kpi-val" style="color:${intVC > 1.0 ? '#ef4444' : (intVC > 0.85 ? '#f59e0b' : '#38bdf8')};">
                            ${intVC} <span class="khcm-kpi-unit">${intVC > 1.0 ? '(과포화)' : (intVC > 0.85 ? '(혼잡)' : '(여유)')}</span>
                        </div>
                    </div>
                    <div class="khcm-kpi-card">
                        <span class="khcm-kpi-title">분석 첨두 총교통량</span>
                        <div class="khcm-kpi-val">
                            ${intVol.toLocaleString()} <span class="khcm-kpi-unit">대/시</span>
                        </div>
                    </div>
                </div>
            `;
        }

        // 입력 테이블 영역 (단일 접근로 탭 뷰 또는 동/서 나란히 분할 뷰)
        if (KHCM.activeView === 'split') {
            html += KHCM.renderSplitTableHtml(data, ['EB', 'WB']);
        } else {
            html += KHCM.renderSingleTableHtml(data, KHCM.currentDir);
        }

        // 하단 차로군별 상세 계산 보고서 표
        if (analysis) {
            html += KHCM.renderAnalysisReportHtml(analysis);
        }

        html += `</div>`;
        container.innerHTML = html;
    };

    /**
     * 단일 접근로 입력 테이블 HTML 생성 (첨부 이미지 서식 1:1)
     */
    KHCM.renderSingleTableHtml = function (data, dirId) {
        return KHCM.renderTableGenericHtml(data, [dirId]);
    };

    /**
     * 분할 비교 입력 테이블 HTML 생성 (동향, 서향 2열 병렬)
     */
    KHCM.renderSplitTableHtml = function (data, dirIds) {
        return KHCM.renderTableGenericHtml(data, dirIds);
    };

    /**
     * 범용 테이블 렌더러 (1개 또는 N개 접근로 컬럼 렌더링)
     */
    KHCM.renderTableGenericHtml = function (data, dirIds) {
        const appInfoMap = {};
        KHCM.APPROACHES.forEach(a => { appInfoMap[a.id] = a; });

        let html = `
            <div class="khcm-table-wrap">
                <table class="khcm-table">
                    <thead>
                        <tr>
                            <th colspan="2" style="width:170px;">접근로</th>
        `;

        dirIds.forEach(dirId => {
            const info = appInfoMap[dirId];
            html += `<th style="background:#0f2b48; color:#38bdf8; font-size:14px; font-weight:800;">${info.name}</th>`;
        });

        html += `
                        </tr>
                    </thead>
                    <tbody>
                        <!-- [1. 도로조건] -->
                        <tr>
                            <td rowspan="10" class="sec-title">도로조건</td>
                            <td class="th-sub">접근경사</td>
        `;
        dirIds.forEach(dirId => {
            const geom = data[dirId].geom;
            html += `
                <td>
                    <input type="number" step="0.1" class="khcm-input" value="${geom.grade}" 
                        onchange="KHCM.updateField('${dirId}', 'geom.grade', parseFloat(this.value))"> %
                </td>
            `;
        });
        html += `</tr>`;

        // 횡단보도
        html += `
            <tr>
                <td class="th-sub">횡단보도</td>
        `;
        dirIds.forEach(dirId => {
            const geom = data[dirId].geom;
            html += `
                <td>
                    <label class="khcm-label">
                        <input type="radio" name="crosswalk_${dirId}" class="khcm-checkbox" ${geom.crosswalk ? 'checked' : ''} 
                            onchange="KHCM.updateField('${dirId}', 'geom.crosswalk', true)"> 있음
                    </label>
                    <label class="khcm-label" style="margin-left:10px;">
                        <input type="radio" name="crosswalk_${dirId}" class="khcm-checkbox" ${!geom.crosswalk ? 'checked' : ''} 
                            onchange="KHCM.updateField('${dirId}', 'geom.crosswalk', false)"> 없음
                    </label>
                </td>
            `;
        });
        html += `</tr>`;

        // 차로수
        html += `
            <tr>
                <td class="th-sub">차로수</td>
        `;
        dirIds.forEach(dirId => {
            const geom = data[dirId].geom;
            html += `
                <td>
                    <input type="number" min="1" max="7" class="khcm-input" value="${geom.lanes}" 
                        onchange="KHCM.updateField('${dirId}', 'geom.lanes', parseInt(this.value, 10))">
                </td>
            `;
        });
        html += `</tr>`;

        // 차로폭 (1~7차로)
        html += `
            <tr>
                <td class="th-sub">차로폭 (m)</td>
        `;
        dirIds.forEach(dirId => {
            const geom = data[dirId].geom;
            html += `
                <td>
                    <div style="display:grid; grid-template-columns:repeat(7, 1fr); gap:2px; font-size:11px;">
                        ${[1, 2, 3, 4, 5, 6, 7].map(lane => `<div style="color:#94a3b8; font-weight:600;">${lane}</div>`).join('')}
                        ${[0, 1, 2, 3, 4, 5, 6].map(idx => `
                            <div>
                                <input type="number" step="0.1" class="khcm-input" style="padding:2px 1px; font-size:11px;" 
                                    value="${geom.laneWidths[idx] !== undefined ? geom.laneWidths[idx] : 3.0}" 
                                    ${idx >= geom.lanes ? 'disabled style="opacity:0.3;"' : ''}
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
                <td class="th-sub">차로 진행방향</td>
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
                    <table style="width:100%; border-collapse:collapse; font-size:11px;">
                        <tr style="background:#1e293b;">
                            <th style="padding:2px; width:22px; color:#cbd5e1;"></th>
                            ${[1, 2, 3, 4, 5, 6, 7].map(l => `<th style="padding:2px; color:#94a3b8;">${l}</th>`).join('')}
                        </tr>
                        ${movLabels.map(m => `
                            <tr>
                                <td style="padding:2px; font-weight:700; color:#38bdf8;">${m.label}</td>
                                ${[0, 1, 2, 3, 4, 5, 6].map(lIdx => {
                                    const isChecked = geom.movements[lIdx] && geom.movements[lIdx][m.key];
                                    const isDisabled = (lIdx >= geom.lanes);
                                    return `
                                        <td style="padding:2px; text-align:center;">
                                            <input type="checkbox" class="khcm-checkbox" ${isChecked ? 'checked' : ''} ${isDisabled ? 'disabled style="opacity:0.25;"' : ''}
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
                <td class="th-sub">유턴구간길이</td>
        `;
        dirIds.forEach(dirId => {
            const geom = data[dirId].geom;
            html += `
                <td style="text-align:left; padding-left:12px;">
                    <div style="font-size:11px; color:#94a3b8; margin-bottom:3px;">(유·좌 공용차로가 있는 경우)</div>
                    유턴가능구간 길이: 
                    <input type="number" class="khcm-input" style="width:70px;" value="${geom.uTurnPocketLength || ''}" placeholder="0"
                        onchange="KHCM.updateField('${dirId}', 'geom.uTurnPocketLength', parseFloat(this.value) || 0)"> m
                </td>
            `;
        });
        html += `</tr>`;

        // 도류화시설 (유턴부가차로, 우회전부가차로, 교통섬)
        html += `
            <tr>
                <td class="th-sub" rowspan="3">도류화시설</td>
        `;
        dirIds.forEach(dirId => {
            const ch = data[dirId].geom.channelization;
            html += `
                <td style="text-align:left; padding-left:12px;">
                    유턴 부가차로 &nbsp; 길이: 
                    <input type="number" class="khcm-input" style="width:70px;" value="${ch.uTurnAuxLength || ''}" placeholder="0"
                        onchange="KHCM.updateField('${dirId}', 'geom.channelization.uTurnAuxLength', parseFloat(this.value) || 0)"> m
                </td>
            `;
        });
        html += `</tr><tr>`;
        dirIds.forEach(dirId => {
            const ch = data[dirId].geom.channelization;
            html += `
                <td style="text-align:left; padding-left:12px;">
                    우회전부가차로 &nbsp; 차로수: 
                    <input type="number" class="khcm-input" style="width:50px;" value="${ch.rightTurnAuxLanes || ''}" placeholder="0"
                        onchange="KHCM.updateField('${dirId}', 'geom.channelization.rightTurnAuxLanes', parseInt(this.value, 10) || 0)"> &nbsp; 
                    길이: 
                    <input type="number" class="khcm-input" style="width:70px;" value="${ch.rightTurnAuxLength || ''}" placeholder="0"
                        onchange="KHCM.updateField('${dirId}', 'geom.channelization.rightTurnAuxLength', parseFloat(this.value) || 0)"> m
                </td>
            `;
        });
        html += `</tr><tr>`;
        dirIds.forEach(dirId => {
            const ch = data[dirId].geom.channelization;
            html += `
                <td style="text-align:left; padding-left:12px;">
                    <label class="khcm-label">
                        <input type="checkbox" class="khcm-checkbox" ${ch.hasIsland ? 'checked' : ''}
                            onchange="KHCM.updateField('${dirId}', 'geom.channelization.hasIsland', this.checked)"> 교통섬
                    </label>
                    &nbsp;&nbsp;&nbsp; 대기공간길이: 
                    <input type="number" class="khcm-input" style="width:70px;" value="${ch.islandPocketLength || ''}" placeholder="0"
                        onchange="KHCM.updateField('${dirId}', 'geom.channelization.islandPocketLength', parseFloat(this.value) || 0)"> m
                </td>
            `;
        });
        html += `</tr>`;

        // 대향진출로 (곡선반경, 대향차로수)
        html += `
            <tr>
                <td class="th-sub">대향진출로<br><span style="font-size:10px; color:#64748b;">(접근로)</span></td>
        `;
        dirIds.forEach(dirId => {
            const op = data[dirId].geom.opposing;
            html += `
                <td style="text-align:left; padding-left:12px;">
                    곡선반경: 
                    <input type="number" class="khcm-input" style="width:70px;" value="${op.curveRadius || ''}" placeholder="0"
                        onchange="KHCM.updateField('${dirId}', 'geom.opposing.curveRadius', parseFloat(this.value) || 0)"> m
                    &nbsp;&nbsp;&nbsp; 대향차로수: 
                    <input type="number" class="khcm-input" style="width:50px;" value="${op.opposingLanes || 2}"
                        onchange="KHCM.updateField('${dirId}', 'geom.opposing.opposingLanes', parseInt(this.value, 10) || 2)">
                </td>
            `;
        });
        html += `</tr>`;

        // <!-- [2. 교통조건] -->
        html += `
            <tr style="border-top:2px solid #475569;">
                <td rowspan="4" class="sec-title" style="color:#10b981;">교통조건</td>
                <td class="th-sub">첨두시간계수</td>
        `;
        dirIds.forEach(dirId => {
            const tr = data[dirId].traffic;
            html += `
                <td>
                    PHF = <input type="number" step="0.01" min="0.5" max="1.0" class="khcm-input" value="${tr.phf}" style="width:70px;"
                        onchange="KHCM.updateField('${dirId}', 'traffic.phf', parseFloat(this.value))">
                </td>
            `;
        });
        html += `</tr>`;

        // 교통량 (승용차 / 중차량 x 유, 좌, 직, 우)
        html += `
            <tr>
                <td class="th-sub">교통량 (대/시)</td>
        `;
        dirIds.forEach(dirId => {
            const vols = data[dirId].traffic.volumes;
            html += `
                <td>
                    <table style="width:100%; border-collapse:collapse; font-size:11px;">
                        <tr style="background:#1e293b;">
                            <th style="padding:2px; color:#cbd5e1;"></th>
                            <th style="padding:2px; color:#94a3b8;">유</th>
                            <th style="padding:2px; color:#94a3b8;">좌</th>
                            <th style="padding:2px; color:#94a3b8;">직</th>
                            <th style="padding:2px; color:#94a3b8;">우</th>
                        </tr>
                        <tr>
                            <td style="padding:2px; font-weight:600; color:#cbd5e1;">승용차</td>
                            <td><input type="number" class="khcm-input" style="width:50px;" value="${vols.car.u || ''}" placeholder="-" onchange="KHCM.updateField('${dirId}', 'traffic.volumes.car.u', parseInt(this.value, 10) || 0)"></td>
                            <td><input type="number" class="khcm-input" style="width:50px;" value="${vols.car.l || ''}" onchange="KHCM.updateField('${dirId}', 'traffic.volumes.car.l', parseInt(this.value, 10) || 0)"></td>
                            <td><input type="number" class="khcm-input" style="width:50px;" value="${vols.car.t || ''}" onchange="KHCM.updateField('${dirId}', 'traffic.volumes.car.t', parseInt(this.value, 10) || 0)"></td>
                            <td><input type="number" class="khcm-input" style="width:50px;" value="${vols.car.r || ''}" onchange="KHCM.updateField('${dirId}', 'traffic.volumes.car.r', parseInt(this.value, 10) || 0)"></td>
                        </tr>
                        <tr>
                            <td style="padding:2px; font-weight:600; color:#cbd5e1;">중차량</td>
                            <td><input type="number" class="khcm-input" style="width:50px;" value="${vols.heavy.u || ''}" placeholder="-" onchange="KHCM.updateField('${dirId}', 'traffic.volumes.heavy.u', parseInt(this.value, 10) || 0)"></td>
                            <td><input type="number" class="khcm-input" style="width:50px;" value="${vols.heavy.l || ''}" onchange="KHCM.updateField('${dirId}', 'traffic.volumes.heavy.l', parseInt(this.value, 10) || 0)"></td>
                            <td><input type="number" class="khcm-input" style="width:50px;" value="${vols.heavy.t || ''}" onchange="KHCM.updateField('${dirId}', 'traffic.volumes.heavy.t', parseInt(this.value, 10) || 0)"></td>
                            <td><input type="number" class="khcm-input" style="width:50px;" value="${vols.heavy.r || ''}" onchange="KHCM.updateField('${dirId}', 'traffic.volumes.heavy.r', parseInt(this.value, 10) || 0)"></td>
                        </tr>
                    </table>
                </td>
            `;
        });
        html += `</tr>`;

        // 녹색신호 도착률 (P_G)
        html += `
            <tr>
                <td class="th-sub">녹색신호 도착률</td>
        `;
        dirIds.forEach(dirId => {
            const tr = data[dirId].traffic;
            html += `
                <td>
                    <i>P<sub>G</sub></i> = 
                    <input type="number" step="0.01" min="0" max="1.0" class="khcm-input" style="width:70px;" value="${tr.pGreen}" 
                        onchange="KHCM.updateField('${dirId}', 'traffic.pGreen', parseFloat(this.value))">
                    <span style="font-size:11px; color:#94a3b8; margin-left:4px;">(G/C)</span>
                </td>
            `;
        });
        html += `</tr>`;

        // 초기대기행렬 (승용차)
        html += `
            <tr>
                <td class="th-sub">초기대기행렬<br><span style="font-size:10px; color:#64748b;">(승용차)</span></td>
        `;
        dirIds.forEach(dirId => {
            const q = data[dirId].traffic.initialQueue || [0, 0, 0, 0, 0, 0, 0];
            const lanes = data[dirId].geom.lanes;
            html += `
                <td>
                    <div style="display:grid; grid-template-columns:repeat(7, 1fr); gap:2px; font-size:11px;">
                        ${[1, 2, 3, 4, 5, 6, 7].map(lane => `<div style="color:#94a3b8; font-weight:600;">${lane}</div>`).join('')}
                        ${[0, 1, 2, 3, 4, 5, 6].map(idx => `
                            <div>
                                <input type="number" min="0" class="khcm-input" style="padding:2px 1px; font-size:11px;" 
                                    value="${q[idx] !== undefined ? q[idx] : 0}" 
                                    ${idx >= lanes ? 'disabled style="opacity:0.3;"' : ''}
                                    onchange="KHCM.updateArrayField('${dirId}', 'traffic.initialQueue', ${idx}, parseInt(this.value, 10) || 0)">
                            </div>
                        `).join('')}
                    </div>
                </td>
            `;
        });
        html += `</tr>`;

        // <!-- [3. 신호조건] -->
        html += `
            <tr style="border-top:2px solid #475569;">
                <td rowspan="5" class="sec-title" style="color:#f59e0b;">신호조건</td>
                <td class="th-sub">차량신호등</td>
        `;
        dirIds.forEach(dirId => {
            const sig = data[dirId].signal;
            html += `
                <td style="text-align:left; padding-left:12px;">
                    <div style="display:flex; flex-direction:column; gap:6px;">
                        <label class="khcm-label">
                            <input type="radio" name="sighead_${dirId}" class="khcm-checkbox" ${sig.signalHeadType === '4color' ? 'checked' : ''}
                                onchange="KHCM.updateField('${dirId}', 'signal.signalHeadType', '4color')"> 4색 차량신호등
                        </label>
                        <div style="display:flex; align-items:center; gap:12px;">
                            <label class="khcm-label">
                                <input type="radio" name="sighead_${dirId}" class="khcm-checkbox" ${sig.signalHeadType === '3color' ? 'checked' : ''}
                                    onchange="KHCM.updateField('${dirId}', 'signal.signalHeadType', '3color')"> 3색 차량신호등
                            </label>
                            <label class="khcm-label" style="font-size:11px; color:#94a3b8;">
                                <input type="checkbox" class="khcm-checkbox" ${sig.threeColorDetail.circleGreen ? 'checked' : ''}
                                    onchange="KHCM.updateField('${dirId}', 'signal.threeColorDetail.circleGreen', this.checked)"> 원형 녹색등
                            </label>
                            <label class="khcm-label" style="font-size:11px; color:#94a3b8;">
                                <input type="checkbox" class="khcm-checkbox" ${sig.threeColorDetail.arrowGreen ? 'checked' : ''}
                                    onchange="KHCM.updateField('${dirId}', 'signal.threeColorDetail.arrowGreen', this.checked)"> 화살표 녹색등
                            </label>
                        </div>
                        <label class="khcm-label">
                            <input type="radio" name="sighead_${dirId}" class="khcm-checkbox" ${sig.signalHeadType === 'other' ? 'checked' : ''}
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
                <td class="th-sub">보행자신호등</td>
        `;
        dirIds.forEach(dirId => {
            const sig = data[dirId].signal;
            html += `
                <td>
                    <label class="khcm-label">
                        <input type="radio" name="pedsig_${dirId}" class="khcm-checkbox" ${sig.pedSignal ? 'checked' : ''}
                            onchange="KHCM.updateField('${dirId}', 'signal.pedSignal', true)"> 있음
                    </label>
                    <label class="khcm-label" style="margin-left:12px;">
                        <input type="radio" name="pedsig_${dirId}" class="khcm-checkbox" ${!sig.pedSignal ? 'checked' : ''}
                            onchange="KHCM.updateField('${dirId}', 'signal.pedSignal', false)"> 없음
                    </label>
                </td>
            `;
        });
        html += `</tr>`;

        // 우회전신호등
        html += `
            <tr>
                <td class="th-sub">우회전신호등</td>
        `;
        dirIds.forEach(dirId => {
            const sig = data[dirId].signal;
            html += `
                <td>
                    <label class="khcm-label">
                        <input type="radio" name="rightsig_${dirId}" class="khcm-checkbox" ${sig.rightSignal ? 'checked' : ''}
                            onchange="KHCM.updateField('${dirId}', 'signal.rightSignal', true)"> 있음
                    </label>
                    <label class="khcm-label" style="margin-left:12px;">
                        <input type="radio" name="rightsig_${dirId}" class="khcm-checkbox" ${!sig.rightSignal ? 'checked' : ''}
                            onchange="KHCM.updateField('${dirId}', 'signal.rightSignal', false)"> 없음
                    </label>
                </td>
            `;
        });
        html += `</tr>`;

        // 유턴허용
        html += `
            <tr>
                <td class="th-sub">유턴허용</td>
        `;
        dirIds.forEach(dirId => {
            const sig = data[dirId].signal;
            html += `
                <td style="text-align:left; padding-left:12px;">
                    <div style="display:flex; align-items:center; gap:16px;">
                        <label class="khcm-label">
                            <input type="checkbox" class="khcm-checkbox" ${sig.uTurnAllowed ? 'checked' : ''}
                                onchange="KHCM.updateField('${dirId}', 'signal.uTurnAllowed', this.checked)"> 유턴 허용
                        </label>
                        <div style="display:flex; flex-direction:column; gap:4px;">
                            <label class="khcm-label" style="font-size:11px;">
                                <input type="checkbox" class="khcm-checkbox" ${sig.uTurnCondition.onLeftTurn ? 'checked' : ''}
                                    onchange="KHCM.updateField('${dirId}', 'signal.uTurnCondition.onLeftTurn', this.checked)"> 좌회전시
                            </label>
                            <label class="khcm-label" style="font-size:11px;">
                                <input type="checkbox" class="khcm-checkbox" ${sig.uTurnCondition.onPedSignal ? 'checked' : ''}
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
                <td class="th-sub">교통안전표지</td>
        `;
        dirIds.forEach(dirId => {
            const signs = data[dirId].signal.safetySigns;
            html += `
                <td style="text-align:left; padding-left:12px;">
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px;">
                        <label class="khcm-label">
                            <input type="checkbox" class="khcm-checkbox" ${signs.noLeftTurn ? 'checked' : ''}
                                onchange="KHCM.updateField('${dirId}', 'signal.safetySigns.noLeftTurn', this.checked)"> 좌회전 금지
                        </label>
                        <label class="khcm-label">
                            <input type="checkbox" class="khcm-checkbox" ${signs.unprotectedLeft ? 'checked' : ''}
                                onchange="KHCM.updateField('${dirId}', 'signal.safetySigns.unprotectedLeft', this.checked)"> 비보호 좌회전 허용
                        </label>
                        <label class="khcm-label">
                            <input type="checkbox" class="khcm-checkbox" ${signs.noRightTurn ? 'checked' : ''}
                                onchange="KHCM.updateField('${dirId}', 'signal.safetySigns.noRightTurn', this.checked)"> 우회전 금지
                        </label>
                        <label class="khcm-label">
                            <input type="checkbox" class="khcm-checkbox" ${signs.noRightOnRed ? 'checked' : ''}
                                onchange="KHCM.updateField('${dirId}', 'signal.safetySigns.noRightOnRed', this.checked)"> 적신호시 우회전금지
                        </label>
                    </div>
                </td>
            `;
        });
        html += `</tr>`;

        html += `
                    </tbody>
                </table>
            </div>
        `;

        return html;
    };

    /**
     * 차로군별 2026 KHCM 상세 분석 결과 보고서 테이블 생성
     */
    KHCM.renderAnalysisReportHtml = function (analysis) {
        let html = `
            <div style="margin-top:16px;">
                <div style="font-size:14px; font-weight:800; color:#38bdf8; margin-bottom:8px; display:flex; align-items:center; gap:8px;">
                    📋 2026 KHCM 신호교차로 차로군별 용량 및 지체도 분석표
                </div>
                <div class="khcm-table-wrap">
                    <table class="khcm-table">
                        <thead>
                            <tr style="background:#1e293b;">
                                <th>접근로</th>
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
                        ${idx === 0 ? `<td rowspan="${groupCount}" style="background:rgba(30,41,59,0.8); font-weight:700; color:#cbd5e1;">${app.shortName}<br><span style="font-size:11px; color:#38bdf8;">(${res.averageDelay}초 / ${res.los})</span></td>` : ''}
                        <td style="font-weight:600; color:#f8fafc;">${lg.name}</td>
                        <td>${lg.volumeTotal}</td>
                        <td style="color:#38bdf8; font-weight:600;">${lg.v}</td>
                        <td>${lg.N}</td>
                        <td>${lg.s.toLocaleString()}</td>
                        <td>${lg.g}s</td>
                        <td>${lg.gC}</td>
                        <td>${lg.c.toLocaleString()}</td>
                        <td style="font-weight:700; color:${lg.vc > 1.0 ? '#ef4444' : (lg.vc > 0.85 ? '#f59e0b' : '#10b981')};">${lg.vc}</td>
                        <td>${lg.d1}</td>
                        <td>${lg.d2}</td>
                        <td style="font-weight:700; color:#f8fafc;">${lg.d}</td>
                        <td>
                            <span class="khcm-los-badge" style="background:${KHCM.getLOSColor(lg.los)}; padding:1px 8px; font-size:12px;">
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
            </div>
        `;
        return html;
    };

    /**
     * 필드 업데이트 핸들러
     */
    KHCM.updateField = function (dirId, path, value) {
        const data = KHCM.getJunctionData(KHCM.currentJid);
        if (!data || !data[dirId]) return;

        const keys = path.split('.');
        let obj = data[dirId];
        for (let i = 0; i < keys.length - 1; i++) {
            if (!obj[keys[i]]) obj[keys[i]] = {};
            obj = obj[keys[i]];
        }
        obj[keys[keys.length - 1]] = value;

        // 재계산 및 부분 리프레시
        KHCM.render('khcm-analysis-container');
    };

    /**
     * 배열 필드 업데이트 핸들러
     */
    KHCM.updateArrayField = function (dirId, path, index, value) {
        const data = KHCM.getJunctionData(KHCM.currentJid);
        if (!data || !data[dirId]) return;

        const keys = path.split('.');
        let obj = data[dirId];
        for (let i = 0; i < keys.length; i++) {
            obj = obj[keys[i]];
        }
        if (Array.isArray(obj)) {
            obj[index] = value;
        }

        KHCM.render('khcm-analysis-container');
    };

    /**
     * 차로 진행방향 7x4 매트릭스 업데이트
     */
    KHCM.updateMovementMatrix = function (dirId, laneIndex, movKey, checked) {
        const data = KHCM.getJunctionData(KHCM.currentJid);
        if (!data || !data[dirId]) return;

        if (!data[dirId].geom.movements[laneIndex]) {
            data[dirId].geom.movements[laneIndex] = { u: false, l: false, t: false, r: false };
        }
        data[dirId].geom.movements[laneIndex][movKey] = checked;

        KHCM.render('khcm-analysis-container');
    };

    /**
     * 접근로 탭 선택
     */
    KHCM.selectApproach = function (dirId) {
        KHCM.activeView = 'tab';
        KHCM.currentDir = dirId;
        KHCM.render('khcm-analysis-container');
    };

    /**
     * 분할 뷰 토글
     */
    KHCM.toggleSplitView = function () {
        KHCM.activeView = (KHCM.activeView === 'split') ? 'tab' : 'split';
        KHCM.render('khcm-analysis-container');
    };

    /**
     * 신호정보 동기화 실행
     */
    KHCM.syncFromJunction = function (jid) {
        if (!jid) jid = KHCM.currentJid;
        KHCM.autoFillFromJunctionState(jid);
        KHCM.saveJunctionData(jid);
        KHCM.render('khcm-analysis-container');
        alert('현재 교차로의 신호주기 및 현시 시간이 성공적으로 동기화되었습니다.');
    };

    /**
     * 즉시 분석 실행
     */
    KHCM.runCalculation = function () {
        KHCM.render('khcm-analysis-container');
    };

    /**
     * 설정 저장
     */
    KHCM.saveData = function () {
        KHCM.saveJunctionData(KHCM.currentJid);
        alert('2026 KHCM 교차로 분석 설정이 저장되었습니다.');
    };

    /**
     * =========================================================================
     * 운영통계 모달 통합 연동 함수 (Overlay UI 연계)
     * =========================================================================
     */
    KHCM.mountToOverlay = function (jid) {
        KHCM.currentJid = jid;

        // 1. 운영통계 오버레이 영역 내에 전용 컨테이너 생성 또는 확인
        const optTab = document.getElementById('overlay-tab-optstats');
        if (!optTab) return;

        let khcmContainer = document.getElementById('khcm-analysis-container');
        if (!khcmContainer) {
            // 운영통계 상단에 서브 탭 네비게이션 생성
            let subNav = document.getElementById('optstats-subnav');
            if (!subNav) {
                subNav = document.createElement('div');
                subNav.id = 'optstats-subnav';
                subNav.style.cssText = 'display:flex; gap:10px; margin-bottom:15px; border-bottom:1px solid #334155; padding-bottom:8px;';
                subNav.innerHTML = `
                    <button id="opt-subtab-basic" class="khcm-btn" style="background:#0284c7; color:#fff;" onclick="KHCM.switchSubTab('basic')">
                        🛠️ 기본 차로 및 운영속성
                    </button>
                    <button id="opt-subtab-khcm" class="khcm-btn" style="background:#1e293b; color:#94a3b8;" onclick="KHCM.switchSubTab('khcm')">
                        🚦 2026 KHCM 신호교차로 분석
                    </button>
                `;
                optTab.insertBefore(subNav, optTab.firstChild);
            }

            // KHCM 컨테이너 생성 (초기에는 숨김)
            khcmContainer = document.createElement('div');
            khcmContainer.id = 'khcm-analysis-container';
            khcmContainer.style.display = 'none';
            optTab.appendChild(khcmContainer);
        }

        // 2. 상단 탭 헤더에 독립 탭 버튼도 지원 (선택 시 바로 KHCM 진입)
        const tabsHeader = document.querySelector('#detail-overlay-modal .tabs-header');
        if (tabsHeader && !document.getElementById('tab-btn-khcm')) {
            const khcmTabBtn = document.createElement('button');
            khcmTabBtn.className = 'tab-btn';
            khcmTabBtn.id = 'tab-btn-khcm';
            khcmTabBtn.textContent = '🚦 2026 KHCM 분석';
            khcmTabBtn.style.display = 'none';
            khcmTabBtn.onclick = function () {
                if (typeof window.switchOverlayTab === 'function') {
                    window.switchOverlayTab('optstats');
                    KHCM.switchSubTab('khcm');
                }
            };
            tabsHeader.appendChild(khcmTabBtn);
        }

        // 3. 렌더링 호출
        KHCM.render(khcmContainer, jid);
    };

    /**
     * 운영통계 서브 탭 전환
     */
    KHCM.switchSubTab = function (tab) {
        const basicControls = document.querySelectorAll('#overlay-tab-optstats > .sigma-panel, #overlay-tab-optstats > div:not(#optstats-subnav):not(#khcm-analysis-container)');
        const khcmContainer = document.getElementById('khcm-analysis-container');
        const btnBasic = document.getElementById('opt-subtab-basic');
        const btnKhcm = document.getElementById('opt-subtab-khcm');

        if (tab === 'khcm') {
            basicControls.forEach(el => el.style.display = 'none');
            if (khcmContainer) khcmContainer.style.display = 'block';
            if (btnBasic) { btnBasic.style.background = '#1e293b'; btnBasic.style.color = '#94a3b8'; }
            if (btnKhcm) { btnKhcm.style.background = '#0284c7'; btnKhcm.style.color = '#ffffff'; }
            KHCM.render('khcm-analysis-container');
        } else {
            basicControls.forEach(el => el.style.display = '');
            if (khcmContainer) khcmContainer.style.display = 'none';
            if (btnBasic) { btnBasic.style.background = '#0284c7'; btnBasic.style.color = '#ffffff'; }
            if (btnKhcm) { btnKhcm.style.background = '#1e293b'; btnKhcm.style.color = '#94a3b8'; }
        }
    };

    // 글로벌 노출
    window.KHCM = KHCM;

})();
