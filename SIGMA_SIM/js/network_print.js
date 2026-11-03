/**
 * network_print.js - 연동 네트워크(교차로 및 연동망) PDF 도면 출력 & 라벨 충돌 방지 최적화 모듈
 * ─────────────────────────────────────────────────────────────
 * 주요 최적화 기능:
 * 1. AABB 스마트 라벨 충돌 방지 (연동 링크 연결된 핵심 교차로 우선 표기, 겹치는 글자 자동 숨김)
 * 2. 엔지니어링 표준 [번호 뱃지 + 하단 색인표] 모드 (지도 위 연동선 100% 완전 노출)
 * 3. 교차로 명칭 간소화(약칭) 및 반투명 뱃지 박스 (연동선 투과 및 가독성 확보)
 * 4. 연동 링크선 이중 글로우 렌더링 (글자 사이로도 연동망이 선명하게 관통)
 * 5. 인쇄 미리보기 화면 내 실시간 도면 옵션 컨트롤 (라벨모드, 글자크기, 선굵기 0.05초 즉시 반영)
 */

const SEOUL_DISTRICTS = [
    '강남구', '강동구', '강북구', '강서구', '관악구', '광진구', '구로구', '금천구',
    '노원구', '도봉구', '동대문구', '동작구', '마포구', '서대문구', '서초구', '성동구',
    '성북구', '송파구', '양천구', '영등포구', '용산구', '은평구', '종로구', '중구', '중랑구'
];

// 현재 인쇄 옵션 상태 (실시간 제어용)
let _currentPrintOpts = {
    targetDistrict: 'ALL',
    pageSize: 'A4',
    orientation: 'landscape',
    labelMode: 'smart',      // 'smart' (겹침방지) | 'index-table' (번호+색인표) | 'short' (약칭) | 'all' (전체) | 'none' (숨김)
    fontSize: 8.5,           // px
    lineWidth: 5.0,          // px
    showJid: true,
    showBoundary: true,
    theme: 'clean'           // 'clean' (화이트) | 'dark' (다크)
};

// Point-in-Polygon (Ray-casting Algorithm)
function _isPointInPoly(pt, vs) {
    const x = pt[0], y = pt[1];
    let inside = false;
    for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
        const xi = vs[i][0], yi = vs[i][1];
        const xj = vs[j][0], yj = vs[j][1];
        const intersect = ((yi > y) !== (yj > y)) &&
            (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

function _checkPointInFeature(lng, lat, feature) {
    if (!feature || !feature.geometry) return false;
    const geom = feature.geometry;
    if (geom.type === 'Polygon') {
        return _isPointInPoly([lng, lat], geom.coordinates[0]);
    } else if (geom.type === 'MultiPolygon') {
        for (const poly of geom.coordinates) {
            if (_isPointInPoly([lng, lat], poly[0])) return true;
        }
    }
    return false;
}

// 교차로 명칭 간소화 헬퍼
function sanitizeJunctionName(raw) {
    if (!raw) return '';
    return raw
        .replace(/\(연등\)\d*/g, '')
        .replace(/\(보\)\d*/g, '')
        .replace(/\(보행\)\d*/g, '')
        .replace(/^서울/, '')
        .replace(/입구지하차도/, '입구')
        .replace(/주민센터/, '동')
        .trim();
}

/**
 * 현재 로드된 지역에서 선택 가능한 자치구/행정구역 목록 추출
 */
async function getAvailablePrintDistricts() {
    const regionCode = window.CURRENT_REGION_CODE || 'L01';
    
    // 필요 시 바운더리 GeoJSON 로드 보장
    if (typeof STATE !== 'undefined' && !STATE.boundaryGeoJson) {
        try {
            const res = await fetch(`/api/sim/data?file=db_${regionCode}_poly.geojson`);
            if (res.ok) {
                const data = await res.json();
                if (data && data.features) STATE.boundaryGeoJson = data;
            }
        } catch(e) {}
    }

    const junctions = Object.values((typeof STATE !== 'undefined' && STATE.junctions) || {});
    const districtMap = new Map();

    // 서울시인 경우 25개 자치구 기본 등록
    if (regionCode === 'L01') {
        SEOUL_DISTRICTS.forEach(d => {
            districtMap.set(d, { name: d, count: 0, feature: null });
        });
    }

    // 1. GeoJSON 폴리곤 피쳐로부터 구 목록 수집 및 피쳐 매핑
    let geoFeatures = [];
    if (typeof STATE !== 'undefined' && STATE.boundaryGeoJson && STATE.boundaryGeoJson.features) {
        geoFeatures = STATE.boundaryGeoJson.features;
    } else if (typeof STATE !== 'undefined' && STATE.boundaryLayer && STATE.boundaryLayer.toGeoJSON) {
        try {
            const gj = STATE.boundaryLayer.toGeoJSON();
            if (gj && gj.features) geoFeatures = gj.features;
        } catch(e) {}
    }

    geoFeatures.forEach(f => {
        const name = (f.properties && (f.properties.SIG_KOR_NM || f.properties.sgg_nm || f.properties.name || f.properties.SIG_ENG_NM)) || '';
        if (name) {
            if (districtMap.has(name)) {
                districtMap.get(name).feature = f;
            } else {
                districtMap.set(name, { name, count: 0, feature: f });
            }
        }
    });

    // 2. 교차로 데이터와 매칭
    junctions.forEach(j => {
        const off = (j.office || j.police || '').trim();
        let matched = false;

        // 폴리곤 공간 매칭 우선
        for (const [dName, dObj] of districtMap.entries()) {
            if (dObj.feature && _checkPointInFeature(j.lng, j.lat, dObj.feature)) {
                dObj.count++;
                matched = true;
                break;
            }
        }

        // 폴리곤 미매칭 시 텍스트 매칭
        if (!matched && off) {
            for (const [dName, dObj] of districtMap.entries()) {
                const pureName = dName.replace(/구$/, '');
                if (off === pureName || off === dName || off.includes(pureName)) {
                    dObj.count++;
                    matched = true;
                    break;
                }
            }
        }

        // 추가 자치구/오피스 자동 등록
        if (!matched && off) {
            const cleanName = off.endsWith('구') ? off : (off + '구');
            if (!districtMap.has(cleanName)) {
                districtMap.set(cleanName, { name: cleanName, count: 0, feature: null });
            }
            districtMap.get(cleanName).count++;
        }
    });

    const list = Array.from(districtMap.values());
    list.sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.name.localeCompare(b.name, 'ko');
    });

    return list;
}

/**
 * [모달 열기] 연동 네트워크 도면 PDF 출력 설정 창
 */
window.openNetworkPrintModal = async function() {
    let modal = document.getElementById('network-print-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'network-print-modal';
        modal.className = 'overlay-fixed-full';
        modal.style.cssText = 'display:none; z-index:999999; backdrop-filter:blur(10px); background:rgba(10,15,25,0.85); align-items:center; justify-content:center;';
        document.body.appendChild(modal);
    }

    const currentRegion = (window.REGION_MAP && window.REGION_MAP[window.CURRENT_REGION_CODE]) || (window.CURRENT_REGION_CODE || '서울시');
    const districts = await getAvailablePrintDistricts();
    const totalJunctions = Object.keys((typeof STATE !== 'undefined' && STATE.junctions) || {}).length;

    let districtOptions = `<option value="ALL">🌐 ${currentRegion} 전역 (전체 ${totalJunctions}개 교차로)</option>`;
    districts.forEach(d => {
        districtOptions += `<option value="${d.name}">${d.name} (${d.count}개 교차로)</option>`;
    });

    modal.innerHTML = `
        <div class="glass-panel-premium" style="position:relative; width:550px; max-width:92vw; background:rgba(15,23,42,0.96); border:1px solid rgba(56,189,248,0.4); box-shadow:0 25px 60px rgba(0,0,0,0.8), 0 0 30px rgba(56,189,248,0.25); border-radius:14px; padding:24px 28px; color:#fff;">
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:12px; margin-bottom:18px;">
                <div style="display:flex; align-items:center; gap:8px;">
                    <span style="font-size:22px;">🖨️</span>
                    <h3 style="margin:0; font-size:17px; font-weight:700; color:#f8fafc;">연동 네트워크 도면 PDF 출력 설정</h3>
                </div>
                <button onclick="closeNetworkPrintModal()" style="background:none; border:none; color:#94a3b8; font-size:20px; cursor:pointer; line-height:1;">✕</button>
            </div>

            <div style="display:flex; flex-direction:column; gap:16px;">
                <!-- 1. 대상 구/지역 선택 -->
                <div>
                    <label style="display:block; font-size:12px; font-weight:600; color:#38bdf8; margin-bottom:6px;">
                        📍 대상 관할 구역 선택
                    </label>
                    <select id="sel-print-target-district" class="phase-select" style="width:100%; height:38px; background:#0f172a; border:1px solid #38bdf8; color:#fff; border-radius:6px; padding:0 10px; font-size:13px; font-weight:600;">
                        ${districtOptions}
                    </select>
                </div>

                <!-- 2. 라벨 겹침 방지 및 최적화 모드 (핵심 개선) -->
                <div style="background:rgba(56,189,248,0.06); border:1px solid rgba(56,189,248,0.25); border-radius:8px; padding:12px 14px;">
                    <label style="display:block; font-size:12px; font-weight:700; color:#38bdf8; margin-bottom:6px;">
                        ⚡ 교차로명 라벨 최적화 방식 (연동선 가림 방지)
                    </label>
                    <select id="sel-print-label-mode" class="phase-select" style="width:100%; height:36px; background:#0f172a; border:1px solid rgba(56,189,248,0.4); color:#fff; border-radius:6px; padding:0 8px; font-size:12.5px; font-weight:bold;">
                        <option value="smart" selected>🛡️ 스마트 겹침 방지 (연동 주교차로 우선 표기, 겹침 자동 제거 - 권장)</option>
                        <option value="index-table">🔢 번호 뱃지 도면 + 하단 교차로 색인표 (엔지니어링 표준 - 연동선 100% 완전 노출)</option>
                        <option value="short">🏷️ 간소화 명칭 표기 (연등/보행 접미사 축약)</option>
                        <option value="none">🚫 라벨 숨김 (순수 연동 도로망 네트워크만 선명하게)</option>
                        <option value="all">⚠️ 전체 강제 표기 (모든 교차로명 표기)</option>
                    </select>
                    <div style="font-size:11px; color:#94a3b8; margin-top:5px; line-height:1.4;">
                        * <b>스마트 겹침 방지</b>는 연동 링크가 연결된 중요 교차로 위주로 글자가 겹치지 않게 자동 선별합니다.
                    </div>
                </div>

                <!-- 3. 용지 및 디테일 설정 -->
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                    <div>
                        <label style="display:block; font-size:12px; font-weight:600; color:#cbd5e1; margin-bottom:6px;">용지 규격</label>
                        <select id="sel-print-page-size" class="phase-select" style="width:100%; height:36px; background:rgba(0,0,0,0.5); border:1px solid rgba(255,255,255,0.2); color:#fff; border-radius:6px; padding:0 8px; font-size:12px;">
                            <option value="A4" selected>A4 (표준 보고서용)</option>
                            <option value="A3">A3 (대형 도면 - 와이드)</option>
                        </select>
                    </div>
                    <div>
                        <label style="display:block; font-size:12px; font-weight:600; color:#cbd5e1; margin-bottom:6px;">용지 방향</label>
                        <select id="sel-print-orientation" class="phase-select" style="width:100%; height:36px; background:rgba(0,0,0,0.5); border:1px solid rgba(255,255,255,0.2); color:#fff; border-radius:6px; padding:0 8px; font-size:12px;">
                            <option value="landscape" selected>가로 (Landscape - 권장)</option>
                            <option value="portrait">세로 (Portrait)</option>
                        </select>
                    </div>
                </div>

                <!-- 4. 글자 크기 및 선 굵기 -->
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                    <div>
                        <label style="display:block; font-size:12px; font-weight:600; color:#cbd5e1; margin-bottom:6px;">교차로명 글자 크기</label>
                        <select id="sel-print-font-size" class="phase-select" style="width:100%; height:36px; background:rgba(0,0,0,0.5); border:1px solid rgba(255,255,255,0.2); color:#fff; border-radius:6px; padding:0 8px; font-size:12px;">
                            <option value="7.0">아주 작게 (7px - 밀집지역 추천)</option>
                            <option value="8.5" selected>보통 (8.5px - 기본)</option>
                            <option value="10.0">크게 (10px)</option>
                        </select>
                    </div>
                    <div>
                        <label style="display:block; font-size:12px; font-weight:600; color:#cbd5e1; margin-bottom:6px;">연동 링크선 굵기</label>
                        <select id="sel-print-line-width" class="phase-select" style="width:100%; height:36px; background:rgba(0,0,0,0.5); border:1px solid rgba(255,255,255,0.2); color:#fff; border-radius:6px; padding:0 8px; font-size:12px;">
                            <option value="3.5">보통 (3.5px)</option>
                            <option value="5.5" selected>굵게 (5.5px - 시인성 강화)</option>
                            <option value="7.5">매우 굵게 (7.5px - 도로망 강조)</option>
                        </select>
                    </div>
                </div>

                <!-- 5. 옵션 체크박스 및 테마 -->
                <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:10px 14px;">
                    <div style="display:flex; gap:14px;">
                        <label style="display:flex; align-items:center; gap:6px; font-size:12px; color:#f1f5f9; cursor:pointer;">
                            <input type="checkbox" id="chk-print-show-jid" checked style="accent-color:#38bdf8;">
                            <span>교차로 번호(ID) 포함</span>
                        </label>
                        <label style="display:flex; align-items:center; gap:6px; font-size:12px; color:#f1f5f9; cursor:pointer;">
                            <input type="checkbox" id="chk-print-show-boundary" checked style="accent-color:#38bdf8;">
                            <span>구역 경계선 포함</span>
                        </label>
                    </div>
                    <div style="display:flex; gap:8px;">
                        <label style="font-size:12px; color:#fff; display:flex; align-items:center; gap:4px; cursor:pointer;">
                            <input type="radio" name="print-theme" value="clean" checked style="accent-color:#38bdf8;"> 화이트
                        </label>
                        <label style="font-size:12px; color:#fff; display:flex; align-items:center; gap:4px; cursor:pointer;">
                            <input type="radio" name="print-theme" value="dark" style="accent-color:#38bdf8;"> 다크
                        </label>
                    </div>
                </div>

                <!-- 버튼 -->
                <div style="display:flex; gap:10px; margin-top:6px;">
                    <button onclick="closeNetworkPrintModal()" class="phase-action-btn phase-btn-gray" style="flex:1; height:40px; font-size:13px;">취소</button>
                    <button onclick="executeNetworkPrint()" class="phase-action-btn phase-btn-blue" style="flex:2; height:40px; font-size:13.5px; font-weight:bold; background:linear-gradient(135deg, #0284c7 0%, #0369a1 100%);">
                        🚀 최적화 도면 생성 및 PDF 출력
                    </button>
                </div>
            </div>
        </div>
    `;

    modal.style.display = 'flex';
};

window.closeNetworkPrintModal = function() {
    const modal = document.getElementById('network-print-modal');
    if (modal) modal.style.display = 'none';
};

/**
 * 모달 설정값 수집 후 인쇄 오버레이 실행
 */
window.executeNetworkPrint = async function() {
    const selDistrict = document.getElementById('sel-print-target-district');
    _currentPrintOpts = {
        targetDistrict: selDistrict ? selDistrict.value : 'ALL',
        pageSize: document.getElementById('sel-print-page-size').value || 'A4',
        orientation: document.getElementById('sel-print-orientation').value || 'landscape',
        labelMode: document.getElementById('sel-print-label-mode').value || 'smart',
        fontSize: parseFloat(document.getElementById('sel-print-font-size').value) || 8.5,
        lineWidth: parseFloat(document.getElementById('sel-print-line-width').value) || 5.5,
        showJid: document.getElementById('chk-print-show-jid').checked,
        showBoundary: document.getElementById('chk-print-show-boundary').checked,
        theme: (document.querySelector('input[name="print-theme"]:checked') || {}).value || 'clean'
    };

    closeNetworkPrintModal();
    await renderNetworkPrintOverlay(_currentPrintOpts);
};

/**
 * 인쇄 미리보기 화면 내 실시간 옵션 변경 핸들러
 */
window.updatePrintOption = async function(key, val) {
    _currentPrintOpts[key] = val;
    await renderNetworkPrintOverlay(_currentPrintOpts);
};

/**
 * AABB 기반 스마트 라벨 충돌 감지 및 가시성 필터링
 */
function computeSmartLabels(nodes, edges, opts, project) {
    if (opts.labelMode === 'none') {
        return nodes.map(n => {
            const [x, y] = project(n.lng, n.lat);
            return { node: n, x, y, labelText: '', showLabel: false, badgeIndex: null };
        });
    }

    // 1. 연동 링크 연결 차수(Degree) 계산
    const degreeMap = new Map();
    edges.forEach(e => {
        const uId = String(e.u.id);
        const vId = String(e.v.id);
        degreeMap.set(uId, (degreeMap.get(uId) || 0) + 1);
        degreeMap.set(vId, (degreeMap.get(vId) || 0) + 1);
    });

    // 2. 중요도 스코어 부여
    const scoredNodes = nodes.map((n, i) => {
        const degree = degreeMap.get(String(n.id)) || 0;
        const isMinor = (n.name && (n.name.includes('(연등)') || n.name.includes('(보)')));
        // 연동 링크가 연결되어 있고 주교차로인 경우 최우선
        const priority = (degree * 20) + (isMinor ? 0 : 10) - (i * 0.001);
        return { node: n, index: i, priority };
    });

    // [인덱스 테이블 모드]: 전원 번호 뱃지 부여
    if (opts.labelMode === 'index-table') {
        // 연동 링크가 많은 순서로 1번, 2번... 인덱스 부여
        scoredNodes.sort((a, b) => b.priority - a.priority);
        return scoredNodes.map((item, idx) => {
            const j = item.node;
            const [x, y] = project(j.lng, j.lat);
            return {
                node: j,
                x, y,
                badgeIndex: idx + 1,
                labelText: String(idx + 1),
                showLabel: true
            };
        });
    }

    // [스마트 겹침 방지 및 일반 모드]
    scoredNodes.sort((a, b) => b.priority - a.priority);

    const placedBoxes = [];
    const results = [];
    const fontSize = opts.fontSize || 8.5;

    for (const item of scoredNodes) {
        const j = item.node;
        const [x, y] = project(j.lng, j.lat);

        let labelText = (opts.labelMode === 'short') ? sanitizeJunctionName(j.name) : (j.name || '');
        if (opts.showJid) {
            const shortId = String(j.id).replace(/^[A-Za-z0-9]+-/, '');
            labelText = `[${shortId}] ${labelText}`;
        }

        // 라벨 바운딩 박스 계산 (패딩 포함)
        const charCount = labelText.length;
        const textWidth = charCount * (fontSize * 0.72) + 8;
        const textHeight = fontSize + 5;

        // 노드 우상단 배치
        const box = {
            left: x + 6,
            right: x + 6 + textWidth,
            top: y - textHeight - 2,
            bottom: y + 2
        };

        let overlap = false;
        if (opts.labelMode === 'smart') {
            for (const pb of placedBoxes) {
                // AABB 겹침 판정 (3px 마진)
                if (!(box.right + 3 < pb.left || box.left - 3 > pb.right || box.bottom + 3 < pb.top || box.top - 3 > pb.bottom)) {
                    overlap = true;
                    break;
                }
            }
        }

        if (!overlap || opts.labelMode === 'all') {
            placedBoxes.push(box);
            results.push({ node: j, x, y, labelText, showLabel: true, badgeIndex: null });
        } else {
            results.push({ node: j, x, y, labelText, showLabel: false, badgeIndex: null });
        }
    }

    return results;
}

/**
 * 인쇄용 오버레이 레이아웃 렌더링 및 SVG 도면 드로잉
 */
async function renderNetworkPrintOverlay(opts) {
    const junctions = Object.values((typeof STATE !== 'undefined' && STATE.junctions) || {});
    if (junctions.length === 0) {
        alert("교차로 데이터가 없습니다. 먼저 교차로 데이터를 불러와 주십시오.");
        return;
    }

    // 1. 구역 필터링
    const districts = await getAvailablePrintDistricts();
    const targetDistrictObj = districts.find(d => d.name === opts.targetDistrict);
    const targetFeature = targetDistrictObj ? targetDistrictObj.feature : null;
    const cleanTargetName = opts.targetDistrict.replace(/구$/, '');

    let filteredNodes = junctions;
    if (opts.targetDistrict !== 'ALL') {
        filteredNodes = junctions.filter(j => {
            if (targetFeature && _checkPointInFeature(j.lng, j.lat, targetFeature)) {
                return true;
            }
            const off = (j.office || j.police || '').trim();
            if (off && (off === cleanTargetName || off === opts.targetDistrict || off.includes(cleanTargetName))) {
                return true;
            }
            return false;
        });
    }

    if (filteredNodes.length === 0) {
        alert(`[${opts.targetDistrict}] 구역에 포함된 교차로가 없습니다.`);
        return;
    }

    // 2. 연동망 링크 추출 (연동망이 없으면 자동 생성)
    if (!window.RoadManager || !window.RoadManager.edges || window.RoadManager.edges.length === 0) {
        if (typeof RoadNetworkManager !== 'undefined') {
            if (!window.RoadManager) window.RoadManager = new RoadNetworkManager();
            window.RoadManager.generate(junctions);
        }
    }

    const nodeIdSet = new Set(filteredNodes.map(j => String(j.id)));
    const mgr = window.RoadManager;
    let filteredEdges = [];

    if (mgr && mgr.edges && mgr.nodes) {
        mgr.edges.forEach(pair => {
            const u = mgr.nodes[pair[0]];
            const v = mgr.nodes[pair[1]];
            if (u && v) {
                const uIn = nodeIdSet.has(String(u.id));
                const vIn = nodeIdSet.has(String(v.id));
                if (uIn && vIn) {
                    filteredEdges.push({ u, v, type: 'internal' });
                } else if (uIn || vIn) {
                    filteredEdges.push({ u, v, type: 'boundary' });
                }
            }
        });
    }

    // 3. 좌표 Bounding Box 계산
    let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
    filteredNodes.forEach(j => {
        if (j.lat < minLat) minLat = j.lat;
        if (j.lat > maxLat) maxLat = j.lat;
        if (j.lng < minLng) minLng = j.lng;
        if (j.lng > maxLng) maxLng = j.lng;
    });

    if (opts.showBoundary && targetFeature && targetFeature.geometry) {
        const extractCoords = (coords) => {
            if (typeof coords[0] === 'number') {
                const lng = coords[0], lat = coords[1];
                if (lat < minLat) minLat = lat;
                if (lat > maxLat) maxLat = lat;
                if (lng < minLng) minLng = lng;
                if (lng > maxLng) maxLng = lng;
            } else {
                coords.forEach(extractCoords);
            }
        };
        extractCoords(targetFeature.geometry.coordinates);
    }

    // 여백 추가 (10%)
    const latSpan = Math.max(maxLat - minLat, 0.01);
    const lngSpan = Math.max(maxLng - minLng, 0.01);
    minLat -= latSpan * 0.08;
    maxLat += latSpan * 0.08;
    minLng -= lngSpan * 0.08;
    maxLng += lngSpan * 0.08;

    // 4. SVG 뷰박스 스케일링 설정
    const isLandscape = opts.orientation === 'landscape';
    const svgWidth = isLandscape ? 1280 : 880;
    const svgHeight = isLandscape ? 760 : 1160;
    const margin = { top: 40, right: 50, bottom: 40, left: 50 };
    const innerW = svgWidth - margin.left - margin.right;
    const innerH = svgHeight - margin.top - margin.bottom;

    const midLat = (minLat + maxLat) / 2 * (Math.PI / 180);
    const latScale = 1.0;
    const lngScale = Math.cos(midLat);

    const dataWidth = (maxLng - minLng) * lngScale;
    const dataHeight = (maxLat - minLat) * latScale;

    const scale = Math.min(innerW / dataWidth, innerH / dataHeight);
    const offsetX = margin.left + (innerW - dataWidth * scale) / 2;
    const offsetY = margin.top + (innerH - dataHeight * scale) / 2;

    const project = (lng, lat) => {
        const x = offsetX + (lng - minLng) * lngScale * scale;
        const y = offsetY + (maxLat - lat) * latScale * scale;
        return [x, y];
    };

    // 5. 스마트 라벨 계산 (충돌 방지 필터링)
    const labelItems = computeSmartLabels(filteredNodes, filteredEdges, opts, project);
    const displayedLabelsCount = labelItems.filter(item => item.showLabel).length;

    // 6. SVG 그래픽 요소 생성
    let svgBoundary = '';
    let svgEdges = '';
    let svgNodes = '';
    let svgLabels = '';

    // A. 구 경계선 (Polygon)
    if (opts.showBoundary && targetFeature && targetFeature.geometry) {
        const geom = targetFeature.geometry;
        const renderPolygon = (coords) => {
            const pts = coords.map(c => project(c[0], c[1]).join(',')).join(' ');
            return `<polygon points="${pts}" fill="${opts.theme === 'dark' ? 'rgba(56,189,248,0.05)' : 'rgba(2,132,199,0.04)'}" stroke="${opts.theme === 'dark' ? '#38bdf8' : '#0284c7'}" stroke-width="2.2" stroke-dasharray="6,4" />`;
        };

        if (geom.type === 'Polygon') {
            svgBoundary += renderPolygon(geom.coordinates[0]);
        } else if (geom.type === 'MultiPolygon') {
            geom.coordinates.forEach(poly => {
                svgBoundary += renderPolygon(poly[0]);
            });
        }
    }

    // B. 연동망 링크선 (Edges - 이중 스트로크로 가시성 극대화!)
    const baseLineWidth = opts.lineWidth || 5.5;
    filteredEdges.forEach(edge => {
        const [x1, y1] = project(edge.u.lng, edge.u.lat);
        const [x2, y2] = project(edge.v.lng, edge.v.lat);
        const isInternal = (edge.type === 'internal');
        const strokeColor = isInternal 
            ? (opts.theme === 'dark' ? '#38bdf8' : '#0284c7') 
            : (opts.theme === 'dark' ? '#c084fc' : '#9333ea');
        const dashArray = isInternal ? '' : 'stroke-dasharray="6,4"';

        // 1) 외곽 글로우/화이트 백선 (글자 사이로도 선이 확실하게 관통되어 보이도록 처리)
        svgEdges += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${opts.theme === 'dark' ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.9)'}" stroke-width="${baseLineWidth + 2.5}" stroke-linecap="round" />`;
        // 2) 메인 컬러 링크선
        svgEdges += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${strokeColor}" stroke-width="${baseLineWidth}" stroke-linecap="round" ${dashArray} opacity="0.95" />`;
    });

    // C. 교차로 노드 & 라벨 생성
    const nodeColor = opts.theme === 'dark' ? '#f43f5e' : '#dc2626';
    const textColor = opts.theme === 'dark' ? '#f8fafc' : '#0f172a';
    const badgeBg = opts.theme === 'dark' ? 'rgba(15,23,42,0.85)' : 'rgba(255,255,255,0.88)';
    const badgeBorder = opts.theme === 'dark' ? '#38bdf8' : '#94a3b8';

    labelItems.forEach(item => {
        const { node: j, x, y, labelText, showLabel, badgeIndex } = item;

        // 노드 원형 마커
        svgNodes += `<circle cx="${x}" cy="${y}" r="4.5" fill="${nodeColor}" stroke="#ffffff" stroke-width="1.8" />`;

        // 라벨 렌더링
        if (showLabel && labelText) {
            if (opts.labelMode === 'index-table' && badgeIndex) {
                // [엔지니어링 표준] 동그라미 번호 뱃지 (지도 위를 가리지 않고 매우 컴팩트함!)
                svgLabels += `
                    <g transform="translate(${x + 8}, ${y - 8})">
                        <circle cx="0" cy="0" r="8" fill="${opts.theme === 'dark' ? '#0284c7' : '#0369a1'}" stroke="#ffffff" stroke-width="1.5" />
                        <text x="0" y="3.5" text-anchor="middle" font-family="'Pretendard', sans-serif" font-size="8.5px" font-weight="bold" fill="#ffffff">${badgeIndex}</text>
                    </g>
                `;
            } else {
                // 스마트 라벨 (둥근 반투명 뱃지 박스 + 선명한 텍스트)
                const charCount = labelText.length;
                const rectW = charCount * (opts.fontSize * 0.70) + 10;
                const rectH = opts.fontSize + 6;

                svgLabels += `
                    <g transform="translate(${x + 6}, ${y - rectH - 1})">
                        <rect width="${rectW}" height="${rectH}" rx="3" fill="${badgeBg}" stroke="${badgeBorder}" stroke-width="0.6" />
                        <text x="5" y="${rectH - 4}" 
                              font-family="'Pretendard', 'Noto Sans KR', sans-serif" 
                              font-size="${opts.fontSize}px" 
                              font-weight="700" 
                              fill="${textColor}">
                            ${labelText}
                        </text>
                    </g>
                `;
            }
        }
    });

    // 7. [인덱스 테이블 모드] 하단 색인표 HTML 생성
    let indexTableHtml = '';
    if (opts.labelMode === 'index-table') {
        const rows = labelItems.map(item => {
            const j = item.node;
            const shortId = String(j.id).replace(/^[A-Za-z0-9]+-/, '');
            const gName = j.group ? `그룹 ${j.group}` : '단독';
            return `
                <div style="display:flex; align-items:center; gap:6px; padding:3px 6px; border-bottom:1px solid ${opts.theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}; font-size:10.5px;">
                    <span style="display:inline-block; width:20px; height:20px; line-height:20px; text-align:center; border-radius:50%; background:#0284c7; color:#fff; font-weight:bold; font-size:9.5px; flex-shrink:0;">${item.badgeIndex}</span>
                    <span style="color:#64748b; font-weight:600; width:52px; flex-shrink:0;">[${shortId}]</span>
                    <span style="font-weight:700; color:${textColor}; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1;">${j.name}</span>
                    <span style="color:#0284c7; font-size:10px; flex-shrink:0;">${gName}</span>
                </div>
            `;
        }).join('');

        indexTableHtml = `
            <div style="margin-top:16px; border:1px solid ${opts.theme === 'dark' ? '#1e293b' : '#cbd5e1'}; border-radius:6px; padding:12px 14px; background:${opts.theme === 'dark' ? '#090d16' : '#ffffff'};">
                <div style="font-size:12px; font-weight:800; color:${opts.theme === 'dark' ? '#38bdf8' : '#0284c7'}; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
                    <span>📋 교차로 색인 일람표 (총 ${labelItems.length}개소 순차 정렬)</span>
                    <span style="font-size:11px; font-weight:normal; color:#64748b;">* 지도 상의 번호 뱃지와 매칭되는 교차로 목록입니다.</span>
                </div>
                <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(260px, 1fr)); gap:6px 14px; max-height:400px; overflow-y:auto;">
                    ${rows}
                </div>
            </div>
        `;
    }

    // 8. 메타정보 및 스타일
    const regionName = (window.REGION_MAP && window.REGION_MAP[window.CURRENT_REGION_CODE]) || (window.CURRENT_REGION_CODE || '서울시');
    const districtTitle = opts.targetDistrict === 'ALL' ? `${regionName} 전역` : `${regionName} [${opts.targetDistrict}]`;
    const nowStr = new Date().toLocaleString('ko-KR', { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' });

    const bgColor = opts.theme === 'dark' ? '#090d16' : '#ffffff';
    const cardBg = opts.theme === 'dark' ? '#0f172a' : '#f8fafc';
    const subColor = opts.theme === 'dark' ? '#94a3b8' : '#475569';
    const borderColor = opts.theme === 'dark' ? '#1e293b' : '#cbd5e1';

    // 9. 인쇄 전용 컨테이너 생성 또는 교체
    let container = document.getElementById('network-print-overlay');
    if (!container) {
        container = document.createElement('div');
        container.id = 'network-print-overlay';
        document.body.appendChild(container);
    }

    // 드롭다운 옵션 HTML
    const districtsList = await getAvailablePrintDistricts();
    let districtSelectHtml = `<option value="ALL"${opts.targetDistrict === 'ALL' ? ' selected' : ''}>${regionName} 전역</option>`;
    districtsList.forEach(d => {
        districtSelectHtml += `<option value="${d.name}"${opts.targetDistrict === d.name ? ' selected' : ''}>${d.name}</option>`;
    });

    container.innerHTML = `
        <style id="network-print-dynamic-style">
            #network-print-overlay {
                position: fixed;
                top: 0; left: 0; width: 100vw; height: 100vh;
                background: rgba(8,12,22,0.92);
                z-index: 1000000;
                overflow-y: auto;
                display: flex;
                flex-direction: column;
                align-items: center;
                padding: 16px;
                box-sizing: border-box;
            }
            .net-print-paper {
                background: ${bgColor};
                color: ${textColor};
                width: ${isLandscape ? '1320px' : '900px'};
                max-width: 98vw;
                padding: 24px 28px;
                border-radius: 8px;
                box-shadow: 0 10px 40px rgba(0,0,0,0.6);
                border: 1px solid ${borderColor};
                box-sizing: border-box;
                position: relative;
            }
            @media print {
                @page {
                    size: ${opts.pageSize} ${opts.orientation};
                    margin: 8mm;
                }
                body * {
                    visibility: hidden;
                }
                #network-print-overlay, #network-print-overlay * {
                    visibility: visible;
                }
                #network-print-overlay {
                    position: absolute;
                    top: 0; left: 0; width: 100%; height: auto;
                    background: transparent !important;
                    padding: 0 !important;
                    overflow: visible !important;
                }
                .net-print-paper {
                    box-shadow: none !important;
                    border: none !important;
                    width: 100% !important;
                    max-width: 100% !important;
                    padding: 0 !important;
                    background: ${bgColor} !important;
                }
                .net-no-print {
                    display: none !important;
                }
            }
        </style>

        <!-- 실시간 도면 최적화 툴바 (인쇄 시 자동 숨김) -->
        <div class="net-no-print" style="width:${isLandscape ? '1320px' : '900px'}; max-width:98vw; background:#0f172a; border:1px solid rgba(56,189,248,0.4); border-radius:10px; padding:12px 18px; margin-bottom:14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; box-shadow:0 8px 25px rgba(0,0,0,0.4);">
            <div style="display:flex; align-items:center; gap:14px; flex-wrap:wrap;">
                <div style="display:flex; align-items:center; gap:6px;">
                    <span style="font-size:12px; font-weight:bold; color:#38bdf8;">구역:</span>
                    <select onchange="updatePrintOption('targetDistrict', this.value)" style="background:#1e293b; color:#fff; border:1px solid #38bdf8; border-radius:4px; height:30px; font-size:12px; padding:0 6px;">
                        ${districtSelectHtml}
                    </select>
                </div>

                <div style="display:flex; align-items:center; gap:6px;">
                    <span style="font-size:12px; font-weight:bold; color:#38bdf8;">라벨 모드:</span>
                    <select onchange="updatePrintOption('labelMode', this.value)" style="background:#1e293b; color:#fff; border:1px solid #38bdf8; border-radius:4px; height:30px; font-size:12px; padding:0 6px; font-weight:bold;">
                        <option value="smart"${opts.labelMode === 'smart' ? ' selected' : ''}>🛡️ 스마트 겹침방지 (권장)</option>
                        <option value="index-table"${opts.labelMode === 'index-table' ? ' selected' : ''}>🔢 번호 뱃지 + 하단 색인표</option>
                        <option value="short"${opts.labelMode === 'short' ? ' selected' : ''}>🏷️ 간소화 명칭</option>
                        <option value="none"${opts.labelMode === 'none' ? ' selected' : ''}>🚫 라벨 숨김 (연동선만)</option>
                        <option value="all"${opts.labelMode === 'all' ? ' selected' : ''}>⚠️ 전체 표시</option>
                    </select>
                </div>

                <div style="display:flex; align-items:center; gap:6px;">
                    <span style="font-size:12px; font-weight:bold; color:#cbd5e1;">글자 크기:</span>
                    <select onchange="updatePrintOption('fontSize', parseFloat(this.value))" style="background:#1e293b; color:#fff; border:1px solid rgba(255,255,255,0.2); border-radius:4px; height:30px; font-size:12px; padding:0 6px;">
                        <option value="7.0"${opts.fontSize === 7.0 ? ' selected' : ''}>아주 작게 (7px)</option>
                        <option value="8.5"${opts.fontSize === 8.5 ? ' selected' : ''}>보통 (8.5px)</option>
                        <option value="10.0"${opts.fontSize === 10.0 ? ' selected' : ''}>크게 (10px)</option>
                    </select>
                </div>

                <div style="display:flex; align-items:center; gap:6px;">
                    <span style="font-size:12px; font-weight:bold; color:#cbd5e1;">연동선 굵기:</span>
                    <select onchange="updatePrintOption('lineWidth', parseFloat(this.value))" style="background:#1e293b; color:#fff; border:1px solid rgba(255,255,255,0.2); border-radius:4px; height:30px; font-size:12px; padding:0 6px;">
                        <option value="3.5"${opts.lineWidth === 3.5 ? ' selected' : ''}>보통 (3.5px)</option>
                        <option value="5.5"${opts.lineWidth === 5.5 ? ' selected' : ''}>굵게 (5.5px)</option>
                        <option value="7.5"${opts.lineWidth === 7.5 ? ' selected' : ''}>매우 굵게 (7.5px)</option>
                    </select>
                </div>
            </div>

            <div style="display:flex; gap:10px;">
                <button onclick="window.print()" class="phase-action-btn phase-btn-blue" style="height:34px; padding:0 18px; font-size:13px; font-weight:bold; background:linear-gradient(135deg, #0284c7 0%, #0369a1 100%);">
                    🖨️ PDF로 저장 / 인쇄
                </button>
                <button onclick="closeNetworkPrintOverlay()" class="phase-action-btn phase-btn-gray" style="height:34px; padding:0 14px; font-size:12.5px;">
                    닫기
                </button>
            </div>
        </div>

        <!-- 인쇄 도면 용지 본문 -->
        <div class="net-print-paper">
            <!-- 도면 헤더 -->
            <div style="display:flex; justify-content:space-between; align-items:flex-end; border-bottom:2.5px solid ${opts.theme === 'dark' ? '#38bdf8' : '#0284c7'}; padding-bottom:10px; margin-bottom:12px;">
                <div>
                    <div style="font-size:11px; font-weight:700; color:${opts.theme === 'dark' ? '#38bdf8' : '#0284c7'}; letter-spacing:1px; margin-bottom:3px;">
                        KOROAD SIGMA TRAFFIC SIGNAL MANAGEMENT SYSTEM
                    </div>
                    <h1 style="margin:0; font-size:22px; font-weight:800; letter-spacing:-0.5px; color:${textColor};">
                        ${districtTitle} 신호 연동 네트워크 현황도
                    </h1>
                </div>

                <!-- 우측 범례 및 통계 -->
                <div style="display:flex; gap:14px; align-items:center; font-size:11.5px; color:${subColor};">
                    <div style="display:flex; flex-direction:column; gap:3px; text-align:right;">
                        <div><b>관할:</b> ${regionName} | <b>발행일시:</b> ${nowStr}</div>
                        <div>
                            <b>총 대상 교차로:</b> <span style="color:${opts.theme === 'dark' ? '#38bdf8' : '#0284c7'}; font-weight:bold;">${filteredNodes.length}개소</span> | 
                            <b>연동 링크:</b> <span style="color:${opts.theme === 'dark' ? '#38bdf8' : '#0284c7'}; font-weight:bold;">${filteredEdges.length}구간</span> |
                            <b>표기 라벨:</b> <span style="color:#059669; font-weight:bold;">${displayedLabelsCount}개</span>
                        </div>
                    </div>
                    <div style="background:${cardBg}; border:1px solid ${borderColor}; border-radius:6px; padding:6px 12px; display:flex; flex-direction:column; gap:3px; font-size:11px;">
                        <div style="display:flex; align-items:center; gap:6px;">
                            <span style="display:inline-block; width:9px; height:9px; border-radius:50%; background:${nodeColor}; border:1px solid #fff;"></span>
                            <span style="font-weight:600;">신호제어 교차로</span>
                        </div>
                        <div style="display:flex; align-items:center; gap:6px;">
                            <span style="display:inline-block; width:16px; height:4px; background:${opts.theme === 'dark' ? '#38bdf8' : '#0284c7'}; border-radius:2px;"></span>
                            <span style="font-weight:600;">연동 링크 구간</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 중앙 고해상도 SVG 도면 캔버스 (연동 링크선이 확실하게 돋보이는 레이어 순서) -->
            <div style="position:relative; width:100%; border:1px solid ${borderColor}; border-radius:6px; overflow:hidden; background:${opts.theme === 'dark' ? '#050811' : '#fcfcfd'};">
                <svg viewBox="0 0 ${svgWidth} ${svgHeight}" style="width:100%; height:auto; display:block;">
                    <!-- 배경 격자망 -->
                    <defs>
                        <pattern id="net-grid-pattern" width="40" height="40" patternUnits="userSpaceOnUse">
                            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="${opts.theme === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'}" stroke-width="1" />
                        </pattern>
                    </defs>
                    <rect width="${svgWidth}" height="${svgHeight}" fill="url(#net-grid-pattern)" />

                    <!-- 1. 배경 구역 경계선 -->
                    ${svgBoundary}

                    <!-- 2. 교차로 라벨 (배경 처리) -->
                    ${svgLabels}

                    <!-- 3. 연동 링크선 (라벨 위/사이로 선명하게 관통하도록 렌더링!) -->
                    ${svgEdges}

                    <!-- 4. 교차로 노드 마커 -->
                    ${svgNodes}

                    <!-- 방위표 -->
                    <g transform="translate(${svgWidth - 60}, 50)">
                        <circle cx="0" cy="0" r="18" fill="${cardBg}" stroke="${borderColor}" stroke-width="1.5" />
                        <path d="M 0 -12 L 5 4 L 0 1 L -5 4 Z" fill="${opts.theme === 'dark' ? '#38bdf8' : '#0284c7'}" />
                        <text x="0" y="-14" text-anchor="middle" font-size="10px" font-weight="bold" fill="${textColor}">N</text>
                    </g>
                </svg>
            </div>

            <!-- 5. [번호 뱃지 모드] 교차로 색인표 출력 -->
            ${indexTableHtml}

            <!-- 하단 푸터 -->
            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px; font-size:10.5px; color:${subColor};">
                <div>* 본 도면은 SIGMA 교통신호 관제 시스템의 교차로 공간 좌표 및 최적 연동 네트워크 알고리즘에 의해 자동 생성된 도면입니다.</div>
                <div><b>SIGMA SIM</b> | Powered by Koroad & Advanced Agentic Signal Engine</div>
            </div>
        </div>
    `;

    container.style.display = 'flex';
}

window.closeNetworkPrintOverlay = function() {
    const container = document.getElementById('network-print-overlay');
    if (container) container.style.display = 'none';
};
