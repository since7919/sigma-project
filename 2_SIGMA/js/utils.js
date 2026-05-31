/**
 * utils.js
 * ─────────────────────────────────────────────
 * 순수 유틸리티 함수 + 통합 DOM 헬퍼
 * 의존: config.js (STATE, CONFIG)
 */

/** 외부 JS 라이브러리 동적 로드 (Promise 기반) */
function loadScript(url) {
    if (window[url]) return Promise.resolve(); // 간단한 중복 방지
    return new Promise((resolve, reject) => {
        const sc = document.createElement('script');
        sc.src = url;
        sc.onload = resolve;
        sc.onerror = () => reject(new Error(`Script load failed: ${url}`));
        document.head.appendChild(sc);
    });
}

/* ══════════════════════════════════════════
 *  로딩 오버레이
 * ══════════════════════════════════════════ */

function showLoading(text = 'Loading Data...') {
    const overlay = document.getElementById('loading-overlay');
    const textEl = document.getElementById('loading-text');
    if (overlay && textEl) {
        textEl.innerText = text;
        overlay.style.display = 'flex';
    }
}

function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.style.display = 'none';
}

/* ══════════════════════════════════════════
 *  시간 관련 유틸
 * ══════════════════════════════════════════ */

/** HH:MM 형식의 시작/종료 범위에 현재 초(cur)가 포함되는지 확인 */
function isTimeInRange(start, end, cur) {
    if (!start || !end) return false;
    const parse = (str) => {
        const parts = String(str).split(':');
        const h = parseInt(parts[0]) || 0;
        const m = parseInt(parts[1]) || 0;
        return h * 3600 + m * 60;
    };
    const sSec = parse(start);
    const eSec = parse(end);
    return sSec < eSec ? (cur >= sSec && cur < eSec) : (cur >= sSec || cur < eSec);
}

/**
 * 스케줄 배열에서 주어진 시간(초)에 해당하는 활성 TOD 인덱스를 찾는다.
 * ─ 6곳 이상 중복되던 active schedule finder 패턴 통합 ─
 * @param {Array} sched  - [{h, m, cycle}, ...] 16개 아이템
 * @param {number} timeSec - 0~86399
 * @returns {number} activeIdx
 */
function findActiveSchedIdx(sched, timeSec) {
    let activeIdx = 0, maxSec = -1;
    sched.forEach((sc, idx) => {
        if (sc && sc.h !== -1) {
            const total = sc.h * 3600 + sc.m * 60;
            if (timeSec >= total && total > maxSec) {
                maxSec = total;
                activeIdx = idx;
            }
        }
    });
    return activeIdx;
}

/**
 * 그룹 연동을 고려하여 교차로의 유효 스케줄 배열을 반환한다.
 * ─ 4곳 이상 반복되던 패턴 통합 ─
 * @param {object} j       - junction object
 * @param {number} dayIdx  - 요일 인덱스 (0~4)
 * @returns {Array} schedule array (16개)
 */
function getLinkedSchedule(j, dayIdx) {
    const individual = j.schedules ? j.schedules[dayIdx] : null;
    const group = (j.group && STATE.groups[j.group] && STATE.groups[j.group].schedules) 
                  ? STATE.groups[j.group].schedules[dayIdx] : null;

    if (!group) return individual;
    if (!individual) return group;

    // [신뢰성 강화] 그룹 스케줄이 단순 플레이스홀더(계획 1개 이하)이고 개별 스케줄이 더 상세하면 개별 사용
    const groupValidCount = group.filter(s => s && s.h !== -1).length;
    const indivValidCount = individual.filter(s => s && s.h !== -1).length;

    if (groupValidCount <= 1 && indivValidCount > groupValidCount) {
        return individual;
    }

    return group;
}

/* ══════════════════════════════════════════
 *  운영 주기/옵셋 계산
 * ══════════════════════════════════════════ */

/** 특정 교차로의 특정 시간/요일 기준 운영 주기값 가져오기 */
function getCurrentOperatingCycle(j, t, dayIdx) {
    if (!j) return 100;
    
    // 1. 운영자 개입 우선
    if (j.opIntervention?.enable && j.opIntervention.rows) {
        const row = j.opIntervention.rows.find(r => isTimeInRange(r.s, r.e, t));
        if (row) return row.cycle || 100;
    }

    // 2. 현재 상황에 맞는 SimDayIdx 판별
    let simDayIdx = (dayIdx !== undefined) ? dayIdx : getSimDayIdx(j, t);

    const sched = getLinkedSchedule(j, simDayIdx);
    if (!sched) return 100;

    const activeIdx = findActiveSchedIdx(sched, t);
    return sched[activeIdx].cycle || 100;
}

/** 특정 교차로의 특정 시간/요일 기준 옵셋값 가져오기 */
function getCurrentOperatingOffset(j, t, dayIdx) {
    if (!j) return 0;
    
    let simDayIdx = (dayIdx !== undefined) ? dayIdx : getSimDayIdx(j, t);

    const sched = getLinkedSchedule(j, simDayIdx);
    if (!sched) return 0;

    const activeIdx = findActiveSchedIdx(sched, t);
    const p = (j.dayPlans && j.dayPlans[simDayIdx]) ? j.dayPlans[simDayIdx][activeIdx] : null;
    return p ? (p.offset || 0) : 0;
}

/* ══════════════════════════════════════════
 *  색상 유틸
 * ══════════════════════════════════════════ */

/** Cycle(50~250) → HSL 컬러 */
function getCycleColor(cycle) {
    if (cycle <= 0) return "#555";
    const minC = 50, maxC = 250;
    const val = Math.max(minC, Math.min(maxC, cycle));
    const ratio = (val - minC) / (maxC - minC);
    const hue = 180 - (ratio * 180);
    return `hsl(${hue}, 70%, 50%)`;
}

/** Group ID → 고유한 HSL 컬러 생성 (전역 공통) */
function getGroupColor(gid) {
    if (gid === undefined || gid === null || gid === '' || gid === 'default' || gid === 0 || gid === '0') return '#00d4ff';
    const str = String(gid);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
    }
    // 채도 75%, 명도 65%의 선명하고 조화로운 컬러 조합
    return `hsl(${(Math.abs(hash) * 137.5) % 360}, 75%, 65%)`;
}

/* ══════════════════════════════════════════
 *  직렬화 / 역직렬화
 * ══════════════════════════════════════════ */

/** 교차로 전체 속성(Global) 직렬화: 체크된 인덱스만 기록 */
function serializeOpGlobal(obj) {
    if (!obj) return "";
    const indices = [];
    OP_MASTER_KEYS.GLOBAL.forEach((key, idx) => {
        if (obj[key] === true || obj[key] === 1 || obj[key] === "true") indices.push(idx);
    });
    return indices.join(',');
}

/** 교차로 전체 속성 역직렬화 */
function parseOpGlobal(str) {
    const res = {};
    if (!str) return res;
    // 이전 방식(key:1;...)인지 인덱스 방식(0,1,2,...)인지 판단
    if (str.includes(':')) {
        str.split(';').forEach(pair => {
            const [k, v] = pair.split(':');
            if (k) res[k] = (v === '1' || v === 'true');
        });
    } else {
        str.split(',').forEach(idxStr => {
            const idx = parseInt(idxStr);
            if (!isNaN(idx) && OP_MASTER_KEYS.GLOBAL[idx]) {
                res[OP_MASTER_KEYS.GLOBAL[idx]] = true;
            }
        });
    }
    return res;
}

/** 방향별 속성(Directional) 직렬화: 방향별로 "idx|key:val" 혼합 */
function serializeOpDir(obj) {
    if (!obj) return "";
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const dirChunks = [];

    directions.forEach(d => {
        const flagIndices = [];
        const numPairs = [];

        // 1. Boolean 플래그 인덱스화
        OP_MASTER_KEYS.DIR_FLAGS.forEach((fKey, fIdx) => {
            const fullKey = `${fKey}-${d}`;
            if (obj[fullKey] === true || obj[fullKey] === 1 || obj[fullKey] === "true") {
                flagIndices.push(fIdx);
            }
        });

        // 2. 수치 데이터 (lane, cwV 등) 처리
        ['laneLA', 'laneLB', 'laneSA', 'laneSB', 'laneRA', 'laneRB', 'cwVA', 'cwVB'].forEach(nKey => {
            const fullKey = `${nKey}-${d}`;
            const val = obj[fullKey];
            if (val !== undefined && val !== 0 && val !== "") {
                numPairs.push(`${nKey}:${val}`);
            }
        });

        if (flagIndices.length > 0 || numPairs.length > 0) {
            dirChunks.push(`${d}:${flagIndices.join(',')}|${numPairs.join(',')}`);
        }
    });
    return dirChunks.join(';');
}

/** 방향별 속성 역직렬화 */
function parseOpDir(str) {
    const res = {};
    if (!str) return res;

    // 하위 호환성: 이전 방식(key-N:val;...)
    if (str.includes('-') && str.includes(':') && !str.includes('|')) {
        str.split(';').forEach(pair => {
            const [k, v] = pair.split(':');
            if (!k) return;
            const isBool = k.includes('Prot') || k.includes('Unprot') || k.includes('Act') || k.includes('Pplt') ||
                k.includes('cwTwo') || k.includes('cwLag') || k.includes('cwLpi') || k.includes('cwMulti') ||
                k.includes('spaceWait') || k.includes('spaceCongest') || k.includes('cwAux') || k.includes('cwDiag') ||
                k.includes('cwSpd') || k.includes('cwChild') || k.includes('cwOld') || k.includes('cwDis');
            if (isBool) res[k] = (v === '1' || v === 'true');
            else res[k] = isNaN(parseFloat(v)) ? v : parseFloat(v);
        });
        return res;
    }

    // 새로운 압축 방식: "D:idx,idx|key:val,key:val;..."
    str.split(';').forEach(chunk => {
        const [dPart, dataPart] = chunk.split(':');
        if (!dPart || !dataPart) return;
        const dir = dPart;
        const [flagsStr, numsStr] = dataPart.split('|');

        // 플래그 복원
        if (flagsStr) {
            flagsStr.split(',').forEach(idxStr => {
                const idx = parseInt(idxStr);
                if (!isNaN(idx) && OP_MASTER_KEYS.DIR_FLAGS[idx]) {
                    res[`${OP_MASTER_KEYS.DIR_FLAGS[idx]}-${dir}`] = true;
                }
            });
        }
        // 수치 복원
        if (numsStr) {
            numsStr.split(',').forEach(pair => {
                const [k, v] = pair.split(':');
                if (k && v) res[`${k}-${dir}`] = isNaN(parseFloat(v)) ? v : parseFloat(v);
            });
        }
    });
    return res;
}

/** 
 * OptimizerState(8지 교차로 상세 설정) 압축 직렬화 
 * Format: "D1{act:1|A:val...|B:val...|f:idx...|a:L:type...|l:ss,se...};;summary{...}"
 */
function serializeOptimizer(state) {
    if (!state) return "";
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const chunks = [];

    directions.forEach(d => {
        const s = state[d];
        if (!s) return;
        const sub = [];
        sub.push(`act:${s.active ? 1 : 0}`);
        const typeKeys = ['C', 'U', 'LU', 'L', 'LT', 'T', 'TR', 'R', 'R_D', 'CW', 'CW_D', 'SPD'];
        if (s.A) sub.push(`A:${typeKeys.map(k => s.A[k] || 0).join(',')}`);
        if (s.B) sub.push(`B:${typeKeys.map(k => s.B[k] || 0).join(',')}`);

        if (s.op) {
            const flagIndices = [];
            OP_MASTER_KEYS.DIR_FLAGS.forEach((key, idx) => {
                if (s.op[key] === true) flagIndices.push(idx);
            });
            if (flagIndices.length > 0) sub.push(`f:${flagIndices.join(',')}`);

            if (s.op.act) {
                const actArr = [];
                ['left', 'grid', 'ped'].forEach(key => {
                    const a = s.op.act[key];
                    if (!a) return;
                    const parts = [a.sType, a.tType, (a.memo || "").replace(/[:;|]/g, ' ')];
                    if (key === 'ped') parts.push(a.spg, a.spy, a.spr, a.tpg, a.tpy, a.tpr);
                    parts.push(a.sS, a.sE, a.tS, a.tE);
                    actArr.push(`${key.charAt(0)}:${parts.join(',')}`);
                });
                if (actArr.length > 0) sub.push(`a:${actArr.join(';')}`);
            }
            const lag = [s.op.pedLagSS, s.op.pedLagSE, s.op.pedLagTS, s.op.pedLagTE].filter(x => x).join(',');
            if (lag) sub.push(`l:${lag}`);
        }
        chunks.push(`${d}{${sub.join('|')}}`);
    });

    const sum = state.summary;
    if (sum) {
        const flashIndices = [];
        ['항시녹색', '항시점멸', '시간제점멸'].forEach((v, i) => { if ((sum.flash || []).includes(v)) flashIndices.push(i); });
        const etcFlags = [];
        ['emgFireSt', 'emgFireTr', 'etcOper', 'etcSpare1'].forEach((k, i) => { if (sum[k]) etcFlags.push(i); });
        chunks.push(`summary{c:${(sum.controller || "").replace(/[:;|{}]/g, '')}|f:${flashIndices.join(',')}|e:${etcFlags.join(',')}}`);
    }
    return chunks.join(';;');
}

/** OptimizerState 역직렬화 */
function parseOptimizer(str) {
    if (!str) return {};
    if (str.trim().startsWith('{')) {
        try { return JSON.parse(str); } catch (e) { return {}; }
    }
    const res = {};
    const FLASH_MAP = ['항시녹색', '항시점멸', '시간제점멸'];
    const ETC_KEYS = ['emgFireSt', 'emgFireTr', 'etcOper', 'etcSpare1'];
    const OPT_TYPE_KEYS = ['C', 'U', 'LU', 'L', 'LT', 'T', 'TR', 'R', 'R_D', 'CW', 'CW_D', 'SPD'];

    str.split(';;').forEach(chunk => {
        const match = chunk.match(/^(\w+)\{(.*)\}$/);
        if (!match) return;
        const key = match[1], content = match[2];

        if (key === 'summary') {
            const sum = { controller: '', flash: [] };
            content.split('|').forEach(p => {
                const [k, v] = p.split(':');
                if (k === 'c') sum.controller = v;
                else if (k === 'f' && v) v.split(',').forEach(i => sum.flash.push(FLASH_MAP[i]));
                else if (k === 'e' && v) v.split(',').forEach(i => sum[ETC_KEYS[i]] = true);
            });
            res.summary = sum;
        } else {
            const s = { active: false, A: {}, B: {}, op: { act: { left: {}, grid: {}, ped: {} } } };
            content.split('|').forEach(p => {
                const [k, v] = p.split(':');
                if (k === 'act') s.active = (v === '1');
                else if (k === 'A' || k === 'B') {
                    const vals = v.split(',');
                    OPT_TYPE_KEYS.forEach((tk, ti) => s[k][tk] = parseInt(vals[ti]) || 0);
                } else if (k === 'f' && v) {
                    v.split(',').forEach(idx => {
                        const fk = OP_MASTER_KEYS.DIR_FLAGS[idx];
                        if (fk) s.op[fk] = true;
                    });
                } else if (k === 'l' && v) {
                    const l = v.split(',');
                    s.op.pedLagSS = l[0] || ''; s.op.pedLagSE = l[1] || '';
                    s.op.pedLagTS = l[2] || ''; s.op.pedLagTE = l[3] || '';
                } else if (k === 'a' && v) {
                    v.split(';').forEach(actChunk => {
                        if (!actChunk.includes(':')) return;
                        const [ak, av] = actChunk.split(':');
                        if (!av) return;
                        const aVals = av.split(',');
                        const target = (ak === 'l' ? s.op.act.left : (ak === 'g' ? s.op.act.grid : s.op.act.ped));
                        target.sType = (isNaN(parseInt(aVals[0])) || aVals[0] === "") ? aVals[0] : parseInt(aVals[0]);
                        target.tType = (isNaN(parseInt(aVals[1])) || aVals[1] === "") ? aVals[1] : parseInt(aVals[1]);
                        target.memo = aVals[2] || '';
                        let timeIdx = 3;
                        if (ak === 'p') {
                            target.spg = parseInt(aVals[3]) || 0; target.spy = parseInt(aVals[4]) || 0; target.spr = parseInt(aVals[5]) || 0;
                            target.tpg = parseInt(aVals[6]) || 0; target.tpy = parseInt(aVals[7]) || 0; target.tpr = parseInt(aVals[8]) || 0;
                            timeIdx = 9;
                        }
                        target.sS = aVals[timeIdx] || ''; target.sE = aVals[timeIdx + 1] || '';
                        target.tS = aVals[timeIdx + 2] || ''; target.tE = aVals[timeIdx + 3] || '';
                    });
                }
            });
            res[key] = s;
        }
    });
    return res;
}

/** A링|B링 형태의 문자열을 파싱 */
function parseRing(str) {
    const rings = (str || "").replace(/"/g, '').split('|');
    return {
        A: (rings[0] || "").split(';').map(v => parseInt(v.trim()) || 0),
        B: (rings[1] || "").split(';').map(v => parseInt(v.trim()) || 0)
    };
}

/* ══════════════════════════════════════════
 *  시각적 화살표 매핑
 * ══════════════════════════════════════════ */

function getVisualArrow(m) {
    if (m <= 0) return { type: '•', ang: 0 };
    if (m >= 100) return { type: 'WALK', ang: 0 };
    const movementMap = {
        1: { type: '↰', ang: 270 }, 2: { type: '↗', ang: 45 },
        3: { type: '↰', ang: 0 }, 4: { type: '↙', ang: 315 },
        5: { type: '↰', ang: 90 }, 6: { type: '↙', ang: 45 },
        7: { type: '↰', ang: 180 }, 8: { type: '↖', ang: 45 },
        9: { type: '↰', ang: 225 }, 10: { type: '↗', ang: 0 },
        11: { type: '↰', ang: 315 }, 12: { type: '↘', ang: 0 },
        13: { type: '↰', ang: 45 }, 14: { type: '↙', ang: 0 },
        15: { type: '↰', ang: 135 }, 16: { type: '↖', ang: 0 }
    };
    return movementMap[m] || { type: '•', ang: 0 };
}

/* ══════════════════════════════════════════
 *  통합 DOM 헬퍼 (중복 생성 패턴 제거)
 * ══════════════════════════════════════════ */

/**
 * 숫자 입력 HTML 생성
 */
function createStyledNumInput(className, rowKey, dirKey, value, label, width) {
    label = label || "";
    width = width || "35px";
    return `
        <div style="display:flex; align-items:center; gap:3px;">
            ${label ? `<span style="font-size:10px; color:#7f8c8d; min-width:21px; text-align:right;">${label}</span>` : ''}
            <input type="number" class="${className}" data-row="${rowKey}" data-dir="${dirKey}" value="${value}"
                   style="width:${width}; border:none; background:rgba(45, 52, 54, 0.6); color:#ced4da; text-align:center; font-size:11px; height:20px; outline:none; border-radius:3px;">
        </div>`;
}

/**
 * 체크박스 입력 HTML 생성
 */
function createStyledChkInput(className, rowKey, dirKey, label, checked, title) {
    const isChecked = (checked === true || checked === 1 || checked === "true") ? 'checked' : '';
    title = title || label;
    return `
        <label title="${title}" style="display:flex; align-items:center; gap:4px; white-space:nowrap; font-size:11px; cursor:pointer; color:#95a5a6; padding:2px 4px; border-bottom:1px solid rgba(255,255,255,0.02); transition: color 0.2s;">
            <input type="checkbox" class="${className}" data-row="${rowKey}" data-dir="${dirKey}" ${isChecked} style="width:13px; height:13px; opacity: 0.7;">${label}
        </label>`;
}

/** 교차로의 optimizerState를 기반으로 opStats(요약 통계 플래그) 동기화 */
function syncJunctionOpStats(j) {
    if (!j || !j.optimizerState) return;
    const opt = j.optimizerState;
    if (!j.opStats) j.opStats = Array(16).fill(false);

    const activeDirs = Object.keys(opt).filter(id => id !== 'summary' && opt[id]?.active);
    const count = activeDirs.length;

    // 0:단일, 1:3지, 2:4지, 3:5지, 4:6지+
    [0, 1, 2, 3, 4].forEach(i => j.opStats[i] = false);
    if (count <= 2) j.opStats[0] = true;
    else if (count === 3) j.opStats[1] = true;
    else if (count === 4) j.opStats[2] = true;
    else if (count === 5) j.opStats[3] = true;
    else j.opStats[4] = true;

    // 보호구역: 5:어린이, 6:노인, 7:장애인
    j.opStats[5] = activeDirs.some(id => opt[id].children);
    j.opStats[6] = activeDirs.some(id => opt[id].elderly);
    j.opStats[7] = activeDirs.some(id => opt[id].disabled);

    // 보행/기타: 8:대각선, 9:동시보행, 10:이단, 11:LPI, 12:항시(전일)점멸, 13:시간제점멸
    j.opStats[8] = activeDirs.some(id => opt[id].diagonal);
    j.opStats[9] = activeDirs.some(id => opt[id].op?.pedSimul);
    j.opStats[10] = activeDirs.some(id => opt[id].cwTwo);
    j.opStats[11] = activeDirs.some(id => opt[id].op?.pedLpi);

    const flashList = (opt.summary && opt.summary.flash) ? opt.summary.flash : [];
    j.opStats[12] = flashList.includes('항시점멸');
    j.opStats[13] = flashList.includes('시간제점멸');
}

/** 현재 시간 기준 활성 시차맵(MapIdx 0~5) 가져오기 */
function getActiveSignalMapIdx(j, t) {
    if (!j || !j.signalMaps) return 0;
    for (let k = 1; k <= 5; k++) {
        const sm = j.signalMaps[k];
        if (sm && isTimeInRange(sm.startTime, sm.endTime, t)) {
            // [Fix] 시차맵에 실제 데이터(이동류)가 담겨 있을 때만 활성화 (빈 맵 방지)
            const hasMov = (sm.movA && sm.movA.some(v => v > 0)) || (sm.movB && sm.movB.some(v => v > 0));
            if (hasMov) return k;
        }
    }
    return 0;
}

/** 
 * 현재 시뮬레이션 시간(t)과 교차로 설정에 따라 사용할 요일 인덱스(0~9)와 시그널맵 인덱스(0~5)를 계산합니다.
 */
function getSimContext(j, t) {
    // 1. 요일정보 (선택된 요일 우선, 없으면 오늘 요일 0:일 ~ 6:토)
    const dayOfWeek = (STATE.simDayOfWeek !== undefined) ? STATE.simDayOfWeek : new Date().getDay(); 
    
    // 2. 주간계획(Weekly Plan)에 맞는 요일 계획 유형(1~10) 찾음
    const weeklyIdxs = (j.weeklyPlan || "1;1;1;1;1;2;3").split(';').map(v => parseInt(v) || 1);
    const jsToWeeklyMap = [6, 0, 1, 2, 3, 4, 5]; // Sun(0)->index 6, Mon(1)->index 0...
    const baseDayType = weeklyIdxs[jsToWeeklyMap[dayOfWeek]] || 1;
    
    let useDayIdx = (baseDayType - 1); // 0-indexed (0:평일, 1:토, 2:일...)
    
    // 3. 해당 일계획(TOD)에 설정된 기본 시그널맵 인덱스 찾기
    let activeSignalMapIdx = (j.dayPlanMapIds && j.dayPlanMapIds[useDayIdx] !== undefined) ? j.dayPlanMapIds[useDayIdx] : 0;

    // 4. 시차맵(1-5) 시간 범위(startTime/endTime)에 따른 Override 체크
    const timedMapIdx = getActiveSignalMapIdx(j, t);
    if (timedMapIdx > 0) {
        activeSignalMapIdx = timedMapIdx;
        // 시차맵이 활성화된 경우 일계획도 해당 시차일계획(Day 6-10)으로 전환
        useDayIdx = timedMapIdx + 4; 
    }

    return { dayIdx: useDayIdx, mapIdx: activeSignalMapIdx };
}

/** 하위 호환성을 위한 단일 인덱스 반환 함수 */
function getSimDayIdx(j, t) {
    return getSimContext(j, t).dayIdx;
}

/**
 * 두 좌표 사이의 구면 거리(Haversine)를 미터 단위로 계산
 */
function getHaversineDistance(lat1, lon1, lat2, lon2) {
    const l1 = parseFloat(lat1), o1 = parseFloat(lon1);
    const l2 = parseFloat(lat2), o2 = parseFloat(lon2);
    if (isNaN(l1) || isNaN(o1) || isNaN(l2) || isNaN(o2)) return 0;

    const R = 6371000; // 미터
    const dLat = (l2 - l1) * Math.PI / 180;
    const dLon = (o2 - o1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(l1 * Math.PI / 180) * Math.cos(l2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
}
