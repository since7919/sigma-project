/**
 * network_print.js - 연동 네트워크(교차로 및 연동망) PDF 도면 출력 모듈
 * ─────────────────────────────────────────────────────────────
 * 지자체 및 관할 구(예: 마포구, 용산구 등) 단위로 교차로와 연동망을 필터링하여
 * 고해상도 벡터 SVG 기반의 엔지니어링 도면 및 PDF(A4/A3 가로 인쇄)로 출력합니다.
 */

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

const SEOUL_DISTRICTS = [
    '강남구', '강동구', '강북구', '강서구', '관악구', '광진구', '구로구', '금천구',
    '노원구', '도봉구', '동대문구', '동작구', '마포구', '서대문구', '서초구', '성동구',
    '성북구', '송파구', '양천구', '영등포구', '용산구', '은평구', '종로구', '중구', '중랑구'
];

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

    // 2. 교차로 데이터(office / police / name)와 매칭하여 교차로 개수 산출 및 추가 구 수집
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

        // 폴리곤에 없는 새로운 구/오피스인 경우 자동 등록
        if (!matched && off) {
            const cleanName = off.endsWith('구') ? off : (off + '구');
            if (!districtMap.has(cleanName)) {
                districtMap.set(cleanName, { name: cleanName, count: 0, feature: null });
            }
            districtMap.get(cleanName).count++;
        }
    });

    const list = Array.from(districtMap.values());
    // 교차로가 있는 구를 우선, 그 다음 가나다순
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
        <div class="glass-panel-premium" style="position:relative; width:520px; max-width:92vw; background:rgba(15,23,42,0.95); border:1px solid rgba(56,189,248,0.4); box-shadow:0 25px 50px rgba(0,0,0,0.8), 0 0 25px rgba(56,189,248,0.2); border-radius:14px; padding:24px 26px; color:#fff;">
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:12px; margin-bottom:18px;">
                <div style="display:flex; align-items:center; gap:8px;">
                    <span style="font-size:22px;">🖨️</span>
                    <h3 style="margin:0; font-size:17px; font-weight:700; color:#f8fafc;">연동 네트워크 도면 PDF 출력</h3>
                </div>
                <button onclick="closeNetworkPrintModal()" style="background:none; border:none; color:#94a3b8; font-size:20px; cursor:pointer; line-height:1;">✕</button>
            </div>

            <div style="display:flex; flex-direction:column; gap:16px;">
                <!-- 1. 대상 구/지역 선택 -->
                <div>
                    <label style="display:block; font-size:12px; font-weight:600; color:#38bdf8; margin-bottom:6px;">
                        📍 대상 관할 구역 선택 (교차로 및 연동망 필터)
                    </label>
                    <select id="sel-print-target-district" class="phase-select" style="width:100%; height:38px; background:#0f172a; border:1px solid #38bdf8; color:#fff; border-radius:6px; padding:0 10px; font-size:13px; font-weight:600;">
                        ${districtOptions}
                    </select>
                    <div style="font-size:11px; color:#94a3b8; margin-top:4px;">
                        * 마포구, 용산구 등 특정 구를 선택하면 해당 구역의 교차로와 연동망만 집중 추출됩니다.
                    </div>
                </div>

                <!-- 2. 용지 규격 및 방향 -->
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                    <div>
                        <label style="display:block; font-size:12px; font-weight:600; color:#cbd5e1; margin-bottom:6px;">용지 규격</label>
                        <select id="sel-print-page-size" class="phase-select" style="width:100%; height:36px; background:rgba(0,0,0,0.5); border:1px solid rgba(255,255,255,0.2); color:#fff; border-radius:6px; padding:0 8px; font-size:12px;">
                            <option value="A4" selected>A4 (표준 보고서용)</option>
                            <option value="A3">A3 (대형 엔지니어링 도면)</option>
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

                <!-- 3. 교차로명 및 표기 옵션 -->
                <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:12px 14px;">
                    <div style="font-size:12px; font-weight:600; color:#cbd5e1; margin-bottom:8px;">표시 항목 설정</div>
                    <div style="display:flex; flex-direction:column; gap:8px;">
                        <label style="display:flex; align-items:center; gap:8px; font-size:12px; color:#f1f5f9; cursor:pointer;">
                            <input type="checkbox" id="chk-print-show-names" checked style="accent-color:#38bdf8; width:15px; height:15px;">
                            <span>🏷️ 교차로명 텍스트 표기 (필수)</span>
                        </label>
                        <label style="display:flex; align-items:center; gap:8px; font-size:12px; color:#f1f5f9; cursor:pointer;">
                            <input type="checkbox" id="chk-print-show-jid" checked style="accent-color:#38bdf8; width:15px; height:15px;">
                            <span>🔢 교차로 번호(ID) 함께 표기</span>
                        </label>
                        <label style="display:flex; align-items:center; gap:8px; font-size:12px; color:#f1f5f9; cursor:pointer;">
                            <input type="checkbox" id="chk-print-show-boundary" checked style="accent-color:#38bdf8; width:15px; height:15px;">
                            <span>🗺️ 구역 행정 경계선(Polygon) 함께 표기</span>
                        </label>
                    </div>
                </div>

                <!-- 4. 도면 테마 -->
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-size:12px; font-weight:600; color:#cbd5e1;">도면 배경 스타일:</span>
                    <div style="display:flex; gap:10px;">
                        <label style="font-size:12px; color:#fff; display:flex; align-items:center; gap:4px; cursor:pointer;">
                            <input type="radio" name="print-theme" value="clean" checked style="accent-color:#38bdf8;"> 화이트 (인쇄/보고서용)
                        </label>
                        <label style="font-size:12px; color:#fff; display:flex; align-items:center; gap:4px; cursor:pointer;">
                            <input type="radio" name="print-theme" value="dark" style="accent-color:#38bdf8;"> 다크 (모니터링용)
                        </label>
                    </div>
                </div>

                <!-- 실행 버튼 -->
                <div style="display:flex; gap:10px; margin-top:8px;">
                    <button onclick="closeNetworkPrintModal()" class="phase-action-btn phase-btn-gray" style="flex:1; height:40px; font-size:13px;">취소</button>
                    <button onclick="executeNetworkPrint()" class="phase-action-btn phase-btn-blue" style="flex:2; height:40px; font-size:13.5px; font-weight:bold; background:linear-gradient(135deg, #0284c7 0%, #0369a1 100%);">
                        🚀 도면 생성 및 PDF 출력
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
 * 선택된 옵션 기반 도면 생성 및 출력 오버레이 표시
 */
window.executeNetworkPrint = async function() {
    const selDistrict = document.getElementById('sel-print-target-district');
    const targetDistrict = selDistrict ? selDistrict.value : 'ALL';
    const pageSize = document.getElementById('sel-print-page-size').value || 'A4';
    const orientation = document.getElementById('sel-print-orientation').value || 'landscape';
    const showNames = document.getElementById('chk-print-show-names').checked;
    const showJid = document.getElementById('chk-print-show-jid').checked;
    const showBoundary = document.getElementById('chk-print-show-boundary').checked;
    const theme = (document.querySelector('input[name="print-theme"]:checked') || {}).value || 'clean';

    closeNetworkPrintModal();
    await renderNetworkPrintOverlay({
        targetDistrict,
        pageSize,
        orientation,
        showNames,
        showJid,
        showBoundary,
        theme
    });
};

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

    // 경계 피쳐 좌표도 바운딩 박스에 포함
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

    // 여백(Padding) 추가 (10%)
    const latSpan = Math.max(maxLat - minLat, 0.01);
    const lngSpan = Math.max(maxLng - minLng, 0.01);
    minLat -= latSpan * 0.08;
    maxLat += latSpan * 0.08;
    minLng -= lngSpan * 0.08;
    maxLng += lngSpan * 0.08;

    // 4. SVG 뷰박스 스케일링 설정
    const isLandscape = opts.orientation === 'landscape';
    const svgWidth = isLandscape ? 1200 : 850;
    const svgHeight = isLandscape ? 740 : 1100;
    const margin = { top: 40, right: 50, bottom: 40, left: 50 };
    const innerW = svgWidth - margin.left - margin.right;
    const innerH = svgHeight - margin.top - margin.bottom;

    // 위경도 -> SVG 좌표 변환 (Mercator 투영 가중치)
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
        const y = offsetY + (maxLat - lat) * latScale * scale; // Y축 반전
        return [x, y];
    };

    // 5. SVG 그래픽 요소 생성
    let svgElements = '';

    // A. 구 경계선 (Polygon)
    if (opts.showBoundary && targetFeature && targetFeature.geometry) {
        const geom = targetFeature.geometry;
        const renderPolygon = (coords) => {
            const pts = coords.map(c => project(c[0], c[1]).join(',')).join(' ');
            return `<polygon points="${pts}" fill="${opts.theme === 'dark' ? 'rgba(56,189,248,0.06)' : 'rgba(2,132,199,0.05)'}" stroke="${opts.theme === 'dark' ? '#38bdf8' : '#0284c7'}" stroke-width="2.5" stroke-dasharray="6,4" />`;
        };

        if (geom.type === 'Polygon') {
            svgElements += renderPolygon(geom.coordinates[0]);
        } else if (geom.type === 'MultiPolygon') {
            geom.coordinates.forEach(poly => {
                svgElements += renderPolygon(poly[0]);
            });
        }
    }

    // B. 연동망 링크선 (Edges)
    filteredEdges.forEach(edge => {
        const [x1, y1] = project(edge.u.lng, edge.u.lat);
        const [x2, y2] = project(edge.v.lng, edge.v.lat);
        const isInternal = (edge.type === 'internal');
        const strokeColor = isInternal 
            ? (opts.theme === 'dark' ? '#38bdf8' : '#0284c7') 
            : (opts.theme === 'dark' ? '#c084fc' : '#9333ea');
        const strokeWidth = isInternal ? 3.5 : 2.0;
        const dashArray = isInternal ? '' : 'stroke-dasharray="5,3"';

        svgElements += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-linecap="round" ${dashArray} opacity="0.85" />`;
    });

    // C. 교차로 노드 마커 및 교차로명 라벨 (핵심 요구사항!)
    filteredNodes.forEach(j => {
        const [x, y] = project(j.lng, j.lat);
        const nodeColor = opts.theme === 'dark' ? '#f43f5e' : '#dc2626';

        // 교차로 노드 원형
        svgElements += `<circle cx="${x}" cy="${y}" r="4.5" fill="${nodeColor}" stroke="#ffffff" stroke-width="1.8" />`;

        // 교차로 명칭 라벨
        if (opts.showNames) {
            let labelText = j.name || '교차로';
            if (opts.showJid) {
                const shortId = String(j.id).replace(/^[A-Za-z0-9]+-/, '');
                labelText = `[${shortId}] ${labelText}`;
            }

            const textColor = opts.theme === 'dark' ? '#f8fafc' : '#0f172a';
            const haloColor = opts.theme === 'dark' ? '#0f172a' : '#ffffff';

            svgElements += `
                <text x="${x + 7}" y="${y - 4}" 
                      font-family="'Pretendard', 'Noto Sans KR', sans-serif" 
                      font-size="9.5px" 
                      font-weight="700" 
                      fill="${textColor}" 
                      stroke="${haloColor}" 
                      stroke-width="3.2px" 
                      stroke-linejoin="round"
                      paint-order="stroke fill" 
                      style="pointer-events:none; user-select:none;">
                    ${labelText}
                </text>
            `;
        }
    });

    // 6. 메타정보 및 스타일 구성
    const regionName = (window.REGION_MAP && window.REGION_MAP[window.CURRENT_REGION_CODE]) || (window.CURRENT_REGION_CODE || '서울시');
    const districtTitle = opts.targetDistrict === 'ALL' ? `${regionName} 전역` : `${regionName} [${opts.targetDistrict}]`;
    const nowStr = new Date().toLocaleString('ko-KR', { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' });

    const bgColor = opts.theme === 'dark' ? '#090d16' : '#ffffff';
    const cardBg = opts.theme === 'dark' ? '#0f172a' : '#f8fafc';
    const textColor = opts.theme === 'dark' ? '#f8fafc' : '#0f172a';
    const subColor = opts.theme === 'dark' ? '#94a3b8' : '#475569';
    const borderColor = opts.theme === 'dark' ? '#1e293b' : '#cbd5e1';

    // 7. 인쇄 전용 컨테이너 생성 또는 교체
    let container = document.getElementById('network-print-overlay');
    if (!container) {
        container = document.createElement('div');
        container.id = 'network-print-overlay';
        document.body.appendChild(container);
    }

    container.innerHTML = `
        <style id="network-print-dynamic-style">
            #network-print-overlay {
                position: fixed;
                top: 0; left: 0; width: 100vw; height: 100vh;
                background: rgba(0,0,0,0.85);
                z-index: 1000000;
                overflow-y: auto;
                display: flex;
                flex-direction: column;
                align-items: center;
                padding: 20px;
                box-sizing: border-box;
            }
            .net-print-paper {
                background: ${bgColor};
                color: ${textColor};
                width: ${isLandscape ? '1240px' : '880px'};
                max-width: 98vw;
                padding: 24px 30px;
                border-radius: 8px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.5);
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

        <!-- 플로팅 액션바 (출력 시 숨김) -->
        <div class="net-no-print" style="width:${isLandscape ? '1240px' : '880px'}; max-width:98vw; display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; gap:10px;">
            <div style="display:flex; align-items:center; gap:8px; color:#fff; font-size:14px; font-weight:700;">
                <span>📄 도면 인쇄 미리보기</span>
                <span style="font-size:12px; font-weight:normal; color:#94a3b8;">(${opts.pageSize} ${isLandscape ? '가로' : '세로'})</span>
            </div>
            <div style="display:flex; gap:10px;">
                <button onclick="window.print()" class="phase-action-btn phase-btn-blue" style="height:36px; padding:0 20px; font-size:13.5px; font-weight:bold; background:linear-gradient(135deg, #0284c7 0%, #0369a1 100%);">
                    🖨️ PDF로 저장 / 인쇄
                </button>
                <button onclick="closeNetworkPrintOverlay()" class="phase-action-btn phase-btn-gray" style="height:36px; padding:0 16px; font-size:13px;">
                    닫기
                </button>
            </div>
        </div>

        <!-- 인쇄 도면 용지 본문 -->
        <div class="net-print-paper">
            <!-- 도면 헤더 -->
            <div style="display:flex; justify-content:space-between; align-items:flex-end; border-bottom:2.5px solid ${opts.theme === 'dark' ? '#38bdf8' : '#0284c7'}; padding-bottom:10px; margin-bottom:14px;">
                <div>
                    <div style="font-size:11px; font-weight:700; color:${opts.theme === 'dark' ? '#38bdf8' : '#0284c7'}; letter-spacing:1px; margin-bottom:3px;">
                        KOROAD SIGMA TRAFFIC SIGNAL MANAGEMENT SYSTEM
                    </div>
                    <h1 style="margin:0; font-size:23px; font-weight:800; letter-spacing:-0.5px; color:${textColor};">
                        ${districtTitle} 신호 연동 네트워크 현황도
                    </h1>
                </div>

                <!-- 우측 범례 및 통계 표 -->
                <div style="display:flex; gap:16px; align-items:center; font-size:11.5px; color:${subColor};">
                    <div style="display:flex; flex-direction:column; gap:4px; text-align:right;">
                        <div><b>관할 지자체:</b> ${regionName} | <b>발행일시:</b> ${nowStr}</div>
                        <div>
                            <b>총 대상 교차로:</b> <span style="color:${opts.theme === 'dark' ? '#38bdf8' : '#0284c7'}; font-weight:bold;">${filteredNodes.length}개소</span> | 
                            <b>연동 링크:</b> <span style="color:${opts.theme === 'dark' ? '#38bdf8' : '#0284c7'}; font-weight:bold;">${filteredEdges.length}구간</span>
                        </div>
                    </div>
                    <!-- 범례 박스 -->
                    <div style="background:${cardBg}; border:1px solid ${borderColor}; border-radius:6px; padding:6px 12px; display:flex; flex-direction:column; gap:4px; font-size:11px;">
                        <div style="display:flex; align-items:center; gap:6px;">
                            <span style="display:inline-block; width:9px; height:9px; border-radius:50%; background:${opts.theme === 'dark' ? '#f43f5e' : '#dc2626'}; border:1px solid #fff;"></span>
                            <span style="font-weight:600;">신호제어 교차로</span>
                        </div>
                        <div style="display:flex; align-items:center; gap:6px;">
                            <span style="display:inline-block; width:16px; height:3px; background:${opts.theme === 'dark' ? '#38bdf8' : '#0284c7'}; border-radius:2px;"></span>
                            <span style="font-weight:600;">연동 링크 구간</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 중앙 고해상도 SVG 도면 캔버스 -->
            <div style="position:relative; width:100%; border:1px solid ${borderColor}; border-radius:6px; overflow:hidden; background:${opts.theme === 'dark' ? '#050811' : '#fcfcfd'};">
                <svg viewBox="0 0 ${svgWidth} ${svgHeight}" style="width:100%; height:auto; display:block;">
                    <!-- 배경 격자망 (Subtle Grid) -->
                    <defs>
                        <pattern id="net-grid-pattern" width="40" height="40" patternUnits="userSpaceOnUse">
                            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="${opts.theme === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'}" stroke-width="1" />
                        </pattern>
                    </defs>
                    <rect width="${svgWidth}" height="${svgHeight}" fill="url(#net-grid-pattern)" />

                    <!-- 본문 도면 그래픽 -->
                    ${svgElements}

                    <!-- 방위표 (North Arrow) -->
                    <g transform="translate(${svgWidth - 60}, 50)">
                        <circle cx="0" cy="0" r="18" fill="${cardBg}" stroke="${borderColor}" stroke-width="1.5" />
                        <path d="M 0 -12 L 5 4 L 0 1 L -5 4 Z" fill="${opts.theme === 'dark' ? '#38bdf8' : '#0284c7'}" />
                        <text x="0" y="-14" text-anchor="middle" font-size="10px" font-weight="bold" fill="${textColor}">N</text>
                    </g>
                </svg>
            </div>

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
