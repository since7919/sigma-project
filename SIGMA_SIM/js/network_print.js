/**
 * network_print.js - 연동 네트워크 PDF 도면 출력 & 지시선 분산 라벨링 & 배경 지도 연동 모듈
 * ─────────────────────────────────────────────────────────────
 * 핵심 기능:
 * 1. 실제 화면 배경지도(ArcGIS Dark/Light 타일맵) 연동 렌더링
 * 2. 미니멀 노드 마커(r=2.2px) & 초고시인성 이중 글로우 연동 링크선 (연동구간 100% 완전 노출)
 * 3. 지시선(Leader Line) 기반 방사형 분산 라벨링 (밀집 교차로의 모든 명칭을 여백으로 연결하여 100% 가독)
 * 4. 밀집구역 상세 확대 인셋 맵 (200% Zoom Detail Inset Map)
 * 5. 엔지니어링 표준 인쇄 레이아웃 & 실시간 옵션 컨트롤러
 */

const SEOUL_DISTRICTS = [
    '강남구', '강동구', '강북구', '강서구', '관악구', '광진구', '구로구', '금천구',
    '노원구', '도봉구', '동대문구', '동작구', '마포구', '서대문구', '서초구', '성동구',
    '성북구', '송파구', '양천구', '영등포구', '용산구', '은평구', '종로구', '중구', '중랑구'
];

let _currentPrintOpts = {
    targetDistrict: 'ALL',
    pageSize: 'A4',
    orientation: 'landscape',
    labelMode: 'leader',     // 'leader' (지시선 분산 - 모든 교차로명 표기) | 'smart' (스마트 겹침방지) | 'inset' (밀집구역 확대도 포함) | 'badge' (번호 뱃지+색인표)
    fontSize: 8.0,           // px
    lineWidth: 4.5,          // px
    nodeSize: 2.4,           // px (연동선 가림 방지 미니멀 노드)
    showInsetMap: true,      // 밀집지역 상세 확대창 표기 여부
    showJid: true,
    showBoundary: true,
    theme: 'dark'            // 'dark' (화면과 동일한 다크 배경지도) | 'clean' (라이트 배경지도)
};

let _activePrintMap = null;
let _activeInsetMap = null;

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

function sanitizeJunctionName(raw) {
    if (!raw) return '';
    return raw
        .replace(/\(연등\)\d*/g, '')
        .replace(/\(보\)\d*/g, '')
        .replace(/\(보행\)\d*/g, '')
        .replace(/^서울/, '')
        .trim();
}

/**
 * 선택 가능한 관할 구역 목록 추출
 */
async function getAvailablePrintDistricts() {
    const regionCode = window.CURRENT_REGION_CODE || 'L01';
    
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

    if (regionCode === 'L01') {
        SEOUL_DISTRICTS.forEach(d => {
            districtMap.set(d, { name: d, count: 0, feature: null });
        });
    }

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

    junctions.forEach(j => {
        const off = (j.office || j.police || '').trim();
        let matched = false;

        for (const [dName, dObj] of districtMap.entries()) {
            if (dObj.feature && _checkPointInFeature(j.lng, j.lat, dObj.feature)) {
                dObj.count++;
                matched = true;
                break;
            }
        }

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
        modal.style.cssText = 'display:none; z-index:999999; backdrop-filter:blur(12px); background:rgba(8,12,22,0.88); align-items:center; justify-content:center;';
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
        <div class="glass-panel-premium" style="position:relative; width:560px; max-width:92vw; background:rgba(15,23,42,0.96); border:1px solid rgba(56,189,248,0.4); box-shadow:0 25px 60px rgba(0,0,0,0.8), 0 0 30px rgba(56,189,248,0.25); border-radius:14px; padding:24px 28px; color:#fff;">
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:12px; margin-bottom:18px;">
                <div style="display:flex; align-items:center; gap:8px;">
                    <span style="font-size:22px;">🖨️</span>
                    <h3 style="margin:0; font-size:17px; font-weight:700; color:#f8fafc;">연동 네트워크 도면 PDF 출력 (배경지도 포함)</h3>
                </div>
                <button onclick="closeNetworkPrintModal()" style="background:none; border:none; color:#94a3b8; font-size:20px; cursor:pointer; line-height:1;">✕</button>
            </div>

            <div style="display:flex; flex-direction:column; gap:16px;">
                <!-- 1. 대상 구역 선택 -->
                <div>
                    <label style="display:block; font-size:12px; font-weight:600; color:#38bdf8; margin-bottom:6px;">
                        📍 대상 관할 구역 선택
                    </label>
                    <select id="sel-print-target-district" class="phase-select" style="width:100%; height:38px; background:#0f172a; border:1px solid #38bdf8; color:#fff; border-radius:6px; padding:0 10px; font-size:13px; font-weight:600;">
                        ${districtOptions}
                    </select>
                </div>

                <!-- 2. 라벨 표기 및 밀집구역 확대 옵션 -->
                <div style="background:rgba(56,189,248,0.06); border:1px solid rgba(56,189,248,0.25); border-radius:8px; padding:12px 14px;">
                    <label style="display:block; font-size:12.5px; font-weight:700; color:#38bdf8; margin-bottom:6px;">
                        🏷️ 모든 교차로명 표기 & 밀집지역 최적화 방식
                    </label>
                    <select id="sel-print-label-mode" class="phase-select" style="width:100%; height:36px; background:#0f172a; border:1px solid rgba(56,189,248,0.4); color:#fff; border-radius:6px; padding:0 8px; font-size:12.5px; font-weight:bold;">
                        <option value="leader" selected>🎯 지시선(Leader Line) 여백 분산 표기 (모든 교차로명 표기 + 연동선 100% 확보 - 권장)</option>
                        <option value="inset">🔍 밀집지역 상세 확대도(Inset Map) 포함 표기</option>
                        <option value="badge">🔢 번호 뱃지 도면 + 하단 교차로 일람표</option>
                        <option value="smart">🛡️ 스마트 겹침 방지 (간소화 필터링)</option>
                    </select>
                    <div style="font-size:11px; color:#94a3b8; margin-top:5px; line-height:1.4;">
                        * <b>지시선 분산 표기</b>는 밀집된 교차로의 글자를 바깥 여백으로 지시선과 함께 빼내어 <b>연동선과 모든 교차로명을 동시에</b> 선명하게 나타냅니다.
                    </div>
                </div>

                <!-- 3. 배경 지도 스타일 및 테마 -->
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                    <div>
                        <label style="display:block; font-size:12px; font-weight:600; color:#cbd5e1; margin-bottom:6px;">배경 지도 스타일</label>
                        <select id="sel-print-theme" class="phase-select" style="width:100%; height:36px; background:rgba(0,0,0,0.5); border:1px solid rgba(255,255,255,0.2); color:#fff; border-radius:6px; padding:0 8px; font-size:12px; font-weight:bold;">
                            <option value="dark" selected>🌌 화면과 동일한 다크 지도 (고대비)</option>
                            <option value="clean">📄 화이트 라이트 지도 (잉크 절약)</option>
                        </select>
                    </div>
                    <div>
                        <label style="display:block; font-size:12px; font-weight:600; color:#cbd5e1; margin-bottom:6px;">용지 규격 및 방향</label>
                        <select id="sel-print-page-size" class="phase-select" style="width:100%; height:36px; background:rgba(0,0,0,0.5); border:1px solid rgba(255,255,255,0.2); color:#fff; border-radius:6px; padding:0 8px; font-size:12px;">
                            <option value="A4" selected>A4 가로 (표준 도면)</option>
                            <option value="A3">A3 가로 (대형 고해상도)</option>
                        </select>
                    </div>
                </div>

                <!-- 4. 연동선 및 노드 크기 미세 설정 -->
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                    <div>
                        <label style="display:block; font-size:12px; font-weight:600; color:#cbd5e1; margin-bottom:6px;">교차로 노드 점 크기</label>
                        <select id="sel-print-node-size" class="phase-select" style="width:100%; height:36px; background:rgba(0,0,0,0.5); border:1px solid rgba(255,255,255,0.2); color:#fff; border-radius:6px; padding:0 8px; font-size:12px;">
                            <option value="2.2" selected>초미니 (2.2px - 연동구간 완벽 가시화)</option>
                            <option value="3.0">보통 (3.0px)</option>
                        </select>
                    </div>
                    <div>
                        <label style="display:block; font-size:12px; font-weight:600; color:#cbd5e1; margin-bottom:6px;">연동 링크선 굵기</label>
                        <select id="sel-print-line-width" class="phase-select" style="width:100%; height:36px; background:rgba(0,0,0,0.5); border:1px solid rgba(255,255,255,0.2); color:#fff; border-radius:6px; padding:0 8px; font-size:12px;">
                            <option value="4.5" selected>굵게 (4.5px - 추천)</option>
                            <option value="6.0">매우 굵게 (6.0px)</option>
                        </select>
                    </div>
                </div>

                <!-- 버튼 -->
                <div style="display:flex; gap:10px; margin-top:8px;">
                    <button onclick="closeNetworkPrintModal()" class="phase-action-btn phase-btn-gray" style="flex:1; height:40px; font-size:13px;">취소</button>
                    <button onclick="executeNetworkPrint()" class="phase-action-btn phase-btn-blue" style="flex:2; height:40px; font-size:13.5px; font-weight:bold; background:linear-gradient(135deg, #0284c7 0%, #0369a1 100%);">
                        🚀 배경지도 포함 도면 생성 및 PDF 출력
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
 * 모달 설정값 수집 후 실행
 */
window.executeNetworkPrint = async function() {
    const selDistrict = document.getElementById('sel-print-target-district');
    _currentPrintOpts = {
        targetDistrict: selDistrict ? selDistrict.value : 'ALL',
        pageSize: document.getElementById('sel-print-page-size').value || 'A4',
        orientation: 'landscape',
        labelMode: document.getElementById('sel-print-label-mode').value || 'leader',
        theme: document.getElementById('sel-print-theme').value || 'dark',
        nodeSize: parseFloat(document.getElementById('sel-print-node-size').value) || 2.2,
        lineWidth: parseFloat(document.getElementById('sel-print-line-width').value) || 4.5,
        fontSize: 8.0,
        showInsetMap: true,
        showJid: true,
        showBoundary: true
    };

    closeNetworkPrintModal();
    await renderNetworkPrintOverlay(_currentPrintOpts);
};

window.updatePrintOption = async function(key, val) {
    _currentPrintOpts[key] = val;
    await renderNetworkPrintOverlay(_currentPrintOpts);
};

/**
 * 지시선(Leader Line) 방사형 분산 라벨링 계산
 * - 밀집된 교차로의 텍스트를 바깥 여백으로 지시선과 함께 빼내어 연동선과 모든 교차로명을 100% 살림
 */
function computeLeaderDispersedLabels(nodes, edges, opts, mapInstance) {
    const totalCount = nodes.length;
    const points = nodes.map((n, idx) => {
        const pt = mapInstance.latLngToContainerPoint([n.lat, n.lng]);
        return {
            node: n,
            origX: pt.x,
            origY: pt.y,
            index: idx
        };
    });

    // 1. 노드 간 거리 기반 밀집도(Density) 계산
    const densityRadius = 24; // px
    points.forEach(p => {
        let neighborCount = 0;
        let sumX = 0, sumY = 0;
        points.forEach(other => {
            const dx = other.origX - p.origX;
            const dy = other.origY - p.origY;
            const dist = Math.hypot(dx, dy);
            if (dist < densityRadius) {
                neighborCount++;
                sumX += other.origX;
                sumY += other.origY;
            }
        });
        p.neighborCount = neighborCount;
        p.clusterCenterX = sumX / neighborCount;
        p.clusterCenterY = sumY / neighborCount;
    });

    // 2. 라벨 위치 및 지시선 결정
    const placedBoxes = [];
    const results = [];
    const fontSize = opts.fontSize || 8.0;

    // 분산 오프셋 각도 (8방향 회전)
    const angles = [
        -Math.PI / 4, Math.PI / 4, -3 * Math.PI / 4, 3 * Math.PI / 4,
        0, Math.PI / 2, Math.PI, -Math.PI / 2
    ];

    points.forEach((p, i) => {
        const j = p.node;
        const shortId = String(j.id).replace(/^[A-Za-z0-9]+-/, '');
        let cleanName = sanitizeJunctionName(j.name);
        let labelText = opts.showJid ? `[${shortId}] ${cleanName}` : cleanName;

        const charCount = labelText.length;
        const rectW = charCount * (fontSize * 0.72) + 8;
        const rectH = fontSize + 5;

        let targetX = p.origX + 6;
        let targetY = p.origY - rectH / 2;
        let hasLeader = false;

        // 밀집 지역인 경우(이웃 2개 이상) 여백 방향으로 지시선 확장
        if (p.neighborCount > 1 && opts.labelMode === 'leader') {
            hasLeader = true;
            // 군집 중심에서 바깥쪽으로 향하는 벡터
            let dirX = p.origX - p.clusterCenterX;
            let dirY = p.origY - p.clusterCenterY;
            if (Math.hypot(dirX, dirY) < 1) {
                // 중심과 거의 같은 경우 인덱스 기반 각도 분산
                const ang = angles[i % angles.length];
                dirX = Math.cos(ang);
                dirY = Math.sin(ang);
            }
            const norm = Math.hypot(dirX, dirY) || 1;
            const dist = 28 + (i % 3) * 16; // 지시선 거리 다변화로 라벨 분산

            targetX = p.origX + (dirX / norm) * dist;
            targetY = p.origY + (dirY / norm) * dist;
        }

        results.push({
            node: j,
            origX: p.origX,
            origY: p.origY,
            labelX: targetX,
            labelY: targetY,
            rectW: rectW,
            rectH: rectH,
            labelText: labelText,
            hasLeader: hasLeader,
            showLabel: true
        });
    });

    return results;
}

/**
 * 인쇄용 오버레이 렌더링 & 실제 배경지도 및 SVG 마운트
 */
async function renderNetworkPrintOverlay(opts) {
    const junctions = Object.values((typeof STATE !== 'undefined' && STATE.junctions) || {});
    if (junctions.length === 0) {
        alert("교차로 데이터가 없습니다. 먼저 교차로 데이터를 불러와 주십시오.");
        return;
    }

    // 1. 관할 구역 필터링
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

    // 2. 연동망 링크 추출
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

    // 3. 지도의 LatLng Bounds 계산
    let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
    filteredNodes.forEach(j => {
        if (j.lat < minLat) minLat = j.lat;
        if (j.lat > maxLat) maxLat = j.lat;
        if (j.lng < minLng) minLng = j.lng;
        if (j.lng > maxLng) maxLng = j.lng;
    });

    const bounds = L.latLngBounds([minLat, minLng], [maxLat, maxLng]);

    // 4. 오버레이 컨테이너 생성
    let container = document.getElementById('network-print-overlay');
    if (!container) {
        container = document.createElement('div');
        container.id = 'network-print-overlay';
        document.body.appendChild(container);
    }

    const regionName = (window.REGION_MAP && window.REGION_MAP[window.CURRENT_REGION_CODE]) || (window.CURRENT_REGION_CODE || '서울시');
    const districtTitle = opts.targetDistrict === 'ALL' ? `${regionName} 전역` : `${regionName} [${opts.targetDistrict}]`;
    const nowStr = new Date().toLocaleString('ko-KR', { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' });

    const isDark = (opts.theme === 'dark');
    const bgColor = isDark ? '#080c16' : '#ffffff';
    const cardBg = isDark ? '#0f172a' : '#f8fafc';
    const textColor = isDark ? '#f8fafc' : '#0f172a';
    const subColor = isDark ? '#94a3b8' : '#475569';
    const borderColor = isDark ? '#1e293b' : '#cbd5e1';

    let districtSelectHtml = `<option value="ALL"${opts.targetDistrict === 'ALL' ? ' selected' : ''}>${regionName} 전역</option>`;
    districts.forEach(d => {
        districtSelectHtml += `<option value="${d.name}"${opts.targetDistrict === d.name ? ' selected' : ''}>${d.name}</option>`;
    });

    // 기존 맵 인스턴스 정리
    if (_activePrintMap) {
        try { _activePrintMap.remove(); } catch(e) {}
        _activePrintMap = null;
    }
    if (_activeInsetMap) {
        try { _activeInsetMap.remove(); } catch(e) {}
        _activeInsetMap = null;
    }

    container.innerHTML = `
        <style id="network-print-dynamic-style">
            #network-print-overlay {
                position: fixed;
                top: 0; left: 0; width: 100vw; height: 100vh;
                background: rgba(6,9,18,0.94);
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
                width: 1360px;
                max-width: 98vw;
                padding: 22px 26px;
                border-radius: 8px;
                box-shadow: 0 10px 45px rgba(0,0,0,0.7);
                border: 1px solid ${borderColor};
                box-sizing: border-box;
                position: relative;
            }
            @media print {
                @page {
                    size: ${opts.pageSize} landscape;
                    margin: 6mm;
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
                .leaflet-tile {
                    visibility: visible !important;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                }
            }
        </style>

        <!-- 상단 실시간 도면 최적화 툴바 -->
        <div class="net-no-print" style="width:1360px; max-width:98vw; background:#0f172a; border:1px solid rgba(56,189,248,0.4); border-radius:10px; padding:12px 18px; margin-bottom:12px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; box-shadow:0 8px 25px rgba(0,0,0,0.4);">
            <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
                <div style="display:flex; align-items:center; gap:6px;">
                    <span style="font-size:12px; font-weight:bold; color:#38bdf8;">구역:</span>
                    <select onchange="updatePrintOption('targetDistrict', this.value)" style="background:#1e293b; color:#fff; border:1px solid #38bdf8; border-radius:4px; height:30px; font-size:12px; padding:0 6px;">
                        ${districtSelectHtml}
                    </select>
                </div>

                <div style="display:flex; align-items:center; gap:6px;">
                    <span style="font-size:12px; font-weight:bold; color:#38bdf8;">라벨 최적화:</span>
                    <select onchange="updatePrintOption('labelMode', this.value)" style="background:#1e293b; color:#fff; border:1px solid #38bdf8; border-radius:4px; height:30px; font-size:12px; padding:0 6px; font-weight:bold;">
                        <option value="leader"${opts.labelMode === 'leader' ? ' selected' : ''}>🎯 지시선 여백 분산 (모든 교차로명 표기 - 권장)</option>
                        <option value="inset"${opts.labelMode === 'inset' ? ' selected' : ''}>🔍 밀집구역 확대도 포함 모드</option>
                        <option value="smart"${opts.labelMode === 'smart' ? ' selected' : ''}>🛡️ 스마트 겹침방지 모드</option>
                        <option value="badge"${opts.labelMode === 'badge' ? ' selected' : ''}>🔢 번호 뱃지 + 하단 색인표</option>
                    </select>
                </div>

                <div style="display:flex; align-items:center; gap:6px;">
                    <span style="font-size:12px; font-weight:bold; color:#cbd5e1;">배경지도:</span>
                    <select onchange="updatePrintOption('theme', this.value)" style="background:#1e293b; color:#fff; border:1px solid rgba(255,255,255,0.2); border-radius:4px; height:30px; font-size:12px; padding:0 6px;">
                        <option value="dark"${isDark ? ' selected' : ''}>🌌 화면 다크 지도</option>
                        <option value="clean"${!isDark ? ' selected' : ''}>📄 화이트 라이트 지도</option>
                    </select>
                </div>

                <div style="display:flex; align-items:center; gap:6px;">
                    <span style="font-size:12px; font-weight:bold; color:#cbd5e1;">노드 크기:</span>
                    <select onchange="updatePrintOption('nodeSize', parseFloat(this.value))" style="background:#1e293b; color:#fff; border:1px solid rgba(255,255,255,0.2); border-radius:4px; height:30px; font-size:12px; padding:0 6px;">
                        <option value="2.2"${opts.nodeSize === 2.2 ? ' selected' : ''}>초미니 2.2px (연동선 강조)</option>
                        <option value="3.2"${opts.nodeSize === 3.2 ? ' selected' : ''}>보통 3.2px</option>
                    </select>
                </div>

                <div style="display:flex; align-items:center; gap:6px;">
                    <span style="font-size:12px; font-weight:bold; color:#cbd5e1;">연동선:</span>
                    <select onchange="updatePrintOption('lineWidth', parseFloat(this.value))" style="background:#1e293b; color:#fff; border:1px solid rgba(255,255,255,0.2); border-radius:4px; height:30px; font-size:12px; padding:0 6px;">
                        <option value="4.5"${opts.lineWidth === 4.5 ? ' selected' : ''}>굵게 4.5px (권장)</option>
                        <option value="6.5"${opts.lineWidth === 6.5 ? ' selected' : ''}>매우 굵게 6.5px</option>
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
            <!-- 헤더 -->
            <div style="display:flex; justify-content:space-between; align-items:flex-end; border-bottom:2.5px solid ${isDark ? '#38bdf8' : '#0284c7'}; padding-bottom:10px; margin-bottom:12px;">
                <div>
                    <div style="font-size:11px; font-weight:700; color:${isDark ? '#38bdf8' : '#0284c7'}; letter-spacing:1px; margin-bottom:3px;">
                        KOROAD SIGMA TRAFFIC SIGNAL MANAGEMENT SYSTEM
                    </div>
                    <h1 style="margin:0; font-size:22px; font-weight:800; letter-spacing:-0.5px; color:${textColor};">
                        ${districtTitle} 신호 연동 네트워크 현황도
                    </h1>
                </div>

                <!-- 통계 및 범례 -->
                <div style="display:flex; gap:14px; align-items:center; font-size:11.5px; color:${subColor};">
                    <div style="display:flex; flex-direction:column; gap:3px; text-align:right;">
                        <div><b>관할:</b> ${regionName} | <b>발행일시:</b> ${nowStr}</div>
                        <div>
                            <b>총 대상 교차로:</b> <span style="color:${isDark ? '#38bdf8' : '#0284c7'}; font-weight:bold;">${filteredNodes.length}개소</span> | 
                            <b>연동 링크:</b> <span style="color:${isDark ? '#38bdf8' : '#0284c7'}; font-weight:bold;">${filteredEdges.length}구간</span>
                        </div>
                    </div>
                    <div style="background:${cardBg}; border:1px solid ${borderColor}; border-radius:6px; padding:6px 12px; display:flex; flex-direction:column; gap:3px; font-size:11px;">
                        <div style="display:flex; align-items:center; gap:6px;">
                            <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#ef4444; border:1px solid #fff;"></span>
                            <span style="font-weight:600;">신호제어 교차로 (미니멀 노드)</span>
                        </div>
                        <div style="display:flex; align-items:center; gap:6px;">
                            <span style="display:inline-block; width:16px; height:4.5px; background:${isDark ? '#38bdf8' : '#0284c7'}; border-radius:2px;"></span>
                            <span style="font-weight:600;">연동 링크 구간 (고시인성)</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 중앙 맵 영역: Leaflet 배경지도 타일 + 고해상도 SVG 오버레이 -->
            <div id="net-print-map-wrapper" style="position:relative; width:100%; height:750px; border:1.5px solid ${borderColor}; border-radius:6px; overflow:hidden; background:${isDark ? '#050811' : '#f8fafc'};">
                <!-- 1. Leaflet 실제 배경지도 타일 레이어 -->
                <div id="net-print-leaflet-map" style="position:absolute; top:0; left:0; width:100%; height:100%; z-index:1;"></div>

                <!-- 2. SVG 벡터 그래픽 레이어 (지시선, 연동선, 라벨) -->
                <svg id="net-print-svg-overlay" style="position:absolute; top:0; left:0; width:100%; height:100%; z-index:2; pointer-events:none;">
                </svg>

                <!-- 3. 방위표 -->
                <div style="position:absolute; top:18px; right:18px; z-index:10; background:${cardBg}; border:1px solid ${borderColor}; border-radius:50%; width:34px; height:34px; display:flex; align-items:center; justify-content:center; box-shadow:0 4px 10px rgba(0,0,0,0.3);">
                    <span style="font-size:11px; font-weight:bold; color:${isDark ? '#38bdf8' : '#0284c7'};">▲ N</span>
                </div>

                <!-- 4. [옵션] 밀집구역 상세 확대 인셋 맵 (Inset Map) -->
                <div id="net-print-inset-container" style="display:${(opts.labelMode === 'inset' || opts.showInsetMap) ? 'block' : 'none'}; position:absolute; bottom:14px; right:14px; width:340px; height:240px; z-index:10; background:${bgColor}; border:2px solid ${isDark ? '#38bdf8' : '#0284c7'}; border-radius:8px; box-shadow:0 8px 25px rgba(0,0,0,0.6); overflow:hidden;">
                    <div style="background:${isDark ? '#0f172a' : '#0284c7'}; color:#fff; font-size:10.5px; font-weight:bold; padding:4px 8px; display:flex; justify-content:space-between; align-items:center;">
                        <span>🔍 밀집구역 상세 확대도 (200% Zoom Detail)</span>
                        <span style="font-size:9.5px; opacity:0.8;">상세 연동망 식별</span>
                    </div>
                    <div id="net-print-inset-map" style="width:100%; height:214px; position:relative;"></div>
                </div>
            </div>

            <!-- 하단 푸터 -->
            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px; font-size:10.5px; color:${subColor};">
                <div>* 본 도면은 실제 도로 배경 지도와 SIGMA 최적 연동 네트워크 알고리즘에 의해 자동 생성된 공식 도면입니다.</div>
                <div><b>SIGMA SIM</b> | Powered by Koroad & Advanced Agentic Signal Engine</div>
            </div>
        </div>
    `;

    container.style.display = 'flex';

    // 5. Leaflet 맵 초기화 및 실제 타일 로딩
    setTimeout(() => {
        const mapEl = document.getElementById('net-print-leaflet-map');
        if (!mapEl) return;

        const printMap = L.map('net-print-leaflet-map', {
            zoomControl: false,
            attributionControl: false,
            boxZoom: false,
            doubleClickZoom: false,
            dragging: false,
            scrollWheelZoom: false
        });
        _activePrintMap = printMap;

        // 실제 배경 타일 레이어 적용
        const tileUrl = isDark
            ? 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}'
            : 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}';

        L.tileLayer(tileUrl, { maxZoom: 19 }).addTo(printMap);

        // 영역 자동 피팅
        printMap.fitBounds(bounds, { padding: [55, 55], animate: false });

        // 타일맵 로딩 후 SVG 렌더링 실행
        printMap.whenReady(() => {
            renderSvgOnMap(printMap, filteredNodes, filteredEdges, targetFeature, opts);

            // 밀집지역 상세 확대 인셋 맵 렌더링
            if (opts.labelMode === 'inset' || opts.showInsetMap) {
                renderInsetDetailMap(filteredNodes, filteredEdges, opts, isDark, tileUrl);
            }
        });
    }, 50);
}

/**
 * 맵 좌표계를 투영하여 SVG 그래픽(연동망, 미니멀 노드, 지시선 라벨) 드로잉
 */
function renderSvgOnMap(printMap, nodes, edges, targetFeature, opts) {
    const svgEl = document.getElementById('net-print-svg-overlay');
    if (!svgEl) return;

    const isDark = (opts.theme === 'dark');
    const nodeR = opts.nodeSize || 2.2;
    const lineWidth = opts.lineWidth || 4.5;
    const textColor = isDark ? '#f8fafc' : '#0f172a';
    const badgeBg = isDark ? 'rgba(15,23,42,0.92)' : 'rgba(255,255,255,0.94)';
    const badgeBorder = isDark ? '#38bdf8' : '#64748b';
    const leaderColor = isDark ? '#94a3b8' : '#475569';

    // 1. 구 행정경계선 (Polygon)
    let svgBoundary = '';
    if (opts.showBoundary && targetFeature && targetFeature.geometry) {
        const geom = targetFeature.geometry;
        const renderPolygon = (coords) => {
            const pts = coords.map(c => {
                const pt = printMap.latLngToContainerPoint([c[1], c[0]]);
                return `${pt.x},${pt.y}`;
            }).join(' ');
            return `<polygon points="${pts}" fill="${isDark ? 'rgba(56,189,248,0.04)' : 'rgba(2,132,199,0.03)'}" stroke="${isDark ? '#38bdf8' : '#0284c7'}" stroke-width="2.5" stroke-dasharray="6,4" />`;
        };

        if (geom.type === 'Polygon') {
            svgBoundary += renderPolygon(geom.coordinates[0]);
        } else if (geom.type === 'MultiPolygon') {
            geom.coordinates.forEach(poly => {
                svgBoundary += renderPolygon(poly[0]);
            });
        }
    }

    // 2. 연동 링크선 (Edges - 이중 스트로크 글로우로 연동구간 최우선 가시화)
    let svgEdges = '';
    edges.forEach(edge => {
        const p1 = printMap.latLngToContainerPoint([edge.u.lat, edge.u.lng]);
        const p2 = printMap.latLngToContainerPoint([edge.v.lat, edge.v.lng]);
        const isInternal = (edge.type === 'internal');
        const strokeColor = isInternal 
            ? (isDark ? '#38bdf8' : '#0284c7') 
            : (isDark ? '#c084fc' : '#9333ea');
        const dashArray = isInternal ? '' : 'stroke-dasharray="6,4"';

        // 하부 글로우 베이스 (배경 지도 및 라벨 사이로 연동선이 명확하게 뚫고 보이도록 처리)
        svgEdges += `<line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" stroke="${isDark ? '#000000' : '#ffffff'}" stroke-width="${lineWidth + 3.0}" stroke-linecap="round" opacity="0.8" />`;
        // 상부 메인 컬러 연동선
        svgEdges += `<line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" stroke="${strokeColor}" stroke-width="${lineWidth}" stroke-linecap="round" ${dashArray} opacity="0.95" />`;
    });

    // 3. 지시선(Leader Line) 및 라벨 분산 계산
    const labelItems = computeLeaderDispersedLabels(nodes, edges, opts, printMap);

    let svgLeaders = '';
    let svgLabels = '';
    let svgNodes = '';

    labelItems.forEach((item, idx) => {
        const { origX, origY, labelX, labelY, rectW, rectH, labelText, hasLeader } = item;

        // A. 지시선 (꺾은선 / 직선)
        if (hasLeader) {
            svgLeaders += `<polyline points="${origX},${origY} ${labelX},${labelY + rectH / 2}" stroke="${leaderColor}" stroke-width="0.9" stroke-dasharray="3,2" fill="none" opacity="0.85" />`;
        }

        // B. 라벨 뱃지 및 텍스트
        svgLabels += `
            <g transform="translate(${labelX}, ${labelY})">
                <rect width="${rectW}" height="${rectH}" rx="3" fill="${badgeBg}" stroke="${badgeBorder}" stroke-width="0.7" />
                <text x="4" y="${rectH - 4}" 
                      font-family="'Pretendard', 'Noto Sans KR', sans-serif" 
                      font-size="${opts.fontSize}px" 
                      font-weight="700" 
                      fill="${textColor}">
                    ${labelText}
                </text>
            </g>
        `;

        // C. 미니멀 노드 점 (r=2.2px - 연동선을 전혀 가리지 않는 깔끔한 마커)
        svgNodes += `<circle cx="${origX}" cy="${origY}" r="${nodeR}" fill="#ef4444" stroke="#ffffff" stroke-width="1.2" />`;
    });

    svgEl.innerHTML = `
        ${svgBoundary}
        ${svgEdges}
        ${svgLeaders}
        ${svgLabels}
        ${svgNodes}
    `;
}

/**
 * 밀집지역 상세 확대 인셋 맵 (200% Zoom Detail Inset Map)
 */
function renderInsetDetailMap(nodes, edges, opts, isDark, tileUrl) {
    const insetEl = document.getElementById('net-print-inset-map');
    if (!insetEl) return;

    // 1. 교차로 밀집도 최고 중심점(Hotspot Centroid) 탐색
    let maxNeighbors = -1;
    let hotspotNode = nodes[0];

    nodes.forEach(n => {
        let count = 0;
        nodes.forEach(other => {
            const d = Math.hypot(other.lat - n.lat, other.lng - n.lng);
            if (d < 0.008) count++; // 약 800m 반경
        });
        if (count > maxNeighbors) {
            maxNeighbors = count;
            hotspotNode = n;
        }
    });

    if (!hotspotNode) return;

    // 인셋 맵 생성
    const insetMap = L.map('net-print-inset-map', {
        zoomControl: false,
        attributionControl: false,
        boxZoom: false,
        doubleClickZoom: false,
        dragging: false,
        scrollWheelZoom: false
    }).setView([hotspotNode.lat, hotspotNode.lng], 16); // 2단계 확대(Zoom 16)
    _activeInsetMap = insetMap;

    L.tileLayer(tileUrl, { maxZoom: 19 }).addTo(insetMap);

    // 인셋 맵 내 연동 링크선 및 노드 렌더링
    insetMap.whenReady(() => {
        edges.forEach(edge => {
            L.polyline([[edge.u.lat, edge.u.lng], [edge.v.lat, edge.v.lng]], {
                color: isDark ? '#38bdf8' : '#0284c7',
                weight: 5.0,
                opacity: 0.95
            }).addTo(insetMap);
        });

        nodes.forEach(j => {
            // 확대 맵에서는 모든 교차로의 라벨을 확실하게 표기
            const shortId = String(j.id).replace(/^[A-Za-z0-9]+-/, '');
            const cleanName = sanitizeJunctionName(j.name);

            L.circleMarker([j.lat, j.lng], {
                radius: 3.5,
                color: '#ffffff',
                weight: 1.5,
                fillColor: '#ef4444',
                fillOpacity: 1
            }).addTo(insetMap);

            const icon = L.divIcon({
                className: 'custom-inset-label',
                html: `<div style="background:${isDark ? 'rgba(15,23,42,0.92)' : '#ffffff'}; color:${isDark ? '#fff' : '#000'}; border:1px solid #38bdf8; border-radius:3px; padding:1px 4px; font-size:9px; font-weight:bold; white-space:nowrap; box-shadow:0 2px 5px rgba(0,0,0,0.4);">[${shortId}] ${cleanName}</div>`,
                iconSize: [80, 16],
                iconAnchor: [-5, 10]
            });
            L.marker([j.lat, j.lng], { icon, interactive: false }).addTo(insetMap);
        });
    });
}

window.closeNetworkPrintOverlay = function() {
    const container = document.getElementById('network-print-overlay');
    if (container) container.style.display = 'none';
    if (_activePrintMap) {
        try { _activePrintMap.remove(); } catch(e) {}
        _activePrintMap = null;
    }
    if (_activeInsetMap) {
        try { _activeInsetMap.remove(); } catch(e) {}
        _activeInsetMap = null;
    }
};
