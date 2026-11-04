/**
 * network_print.js - 연동 네트워크 도면 극대화 & 연동그룹별 고유 컬러 & 단위면적 최대밀집 확대도 모듈
 * ─────────────────────────────────────────────────────────────
 * 핵심 기능:
 * 1. 연동 그룹별 고유 컬러(High-contrast 16색 팔레트) 적용 (중첩/교차 연동구간 100% 식별)
 * 2. 단위 면적당 교차로 밀집도가 가장 높은 핫스팟 구역 자동 탐지 & 250% 상세 확대도 (Inset Map)
 * 3. 인셋 맵을 교차로가 없는 여백(한강 수면)에 자동 배치 + 마우스 드래그 이동 지원 (원래 교차로 0% 가림)
 * 4. 본 도면 지도 위에 [단위면적 최대 밀집 구역] 황금색 점선 사각형 표시
 * 5. 초미니멀 노드(r=1.8px) & 최상위 연동선 렌더링 & 지시선 분산 라벨링
 */

const SEOUL_DISTRICTS = [
    '강남구', '강동구', '강북구', '강서구', '관악구', '광진구', '구로구', '금천구',
    '노원구', '도봉구', '동대문구', '동작구', '마포구', '서대문구', '서초구', '성동구',
    '성북구', '송파구', '양천구', '영등포구', '용산구', '은평구', '종로구', '중구', '중랑구'
];

// 연동그룹 식별을 위한 16색 고대비 명확한 팔레트
const GROUP_PALETTE = [
    '#00d4ff', // 0: 시안 블루
    '#10b981', // 1: 에메랄드 그린
    '#f59e0b', // 2: 앰버 골드
    '#ec4899', // 3: 코랄 핑크
    '#8b5cf6', // 4: 로열 퍼플
    '#06b6d4', // 5: 청록
    '#f97316', // 6: 오렌지
    '#84cc16', // 7: 라임 그린
    '#a855f7', // 8: 바이올렛
    '#14b8a6', // 9: 틸
    '#e11d48', // 10: 로즈 레드
    '#3b82f6', // 11: 딥 블루
    '#eab308', // 12: 레몬 옐로우
    '#22c55e', // 13: 브라이트 그린
    '#d946ef', // 14: 푸시아
    '#6366f1'  // 15: 인디고
];

function getDistinctGroupColor(gid) {
    if (!gid || gid === '0' || gid === 'default') return '#00d4ff';
    const num = parseInt(gid);
    if (!isNaN(num)) {
        return GROUP_PALETTE[Math.abs(num) % GROUP_PALETTE.length];
    }
    let hash = 0;
    const str = String(gid);
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
    }
    return GROUP_PALETTE[Math.abs(hash) % GROUP_PALETTE.length];
}

/**
 * 고해상도 무키(No-Key)·무워터마크 타일 서버 설정
 * - clean (기본값): 그레이톤 도로망 캔버스 지도 (알록달록한 배경 색상 완전 배제, 도로망 윤곽 선명화, 무키·무워터마크)
 * - color: 대한민국 국토교통부 브이월드 표준 컬러 지도 (원본)
 * - osm: 글로벌 표준 오픈스트리트맵 모노톤 도로망 (API키 불필요)
 * - dark: OpenStreetMap 기반 고대비 야간 다크 필터 (API키 불필요)
 */
function getNetworkPrintTileConfig(theme) {
    if (theme === 'dark') {
        return {
            url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
            options: {
                maxZoom: 19,
                maxNativeZoom: 19,
                attribution: false,
                className: 'leaflet-tile-dark'
            }
        };
    } else if (theme === 'color') {
        // 원본 컬러 지도 (풀컬러 VWorld)
        return {
            url: 'https://xdworld.vworld.kr/2d/Base/service/{z}/{x}/{y}.png',
            options: {
                maxZoom: 19,
                maxNativeZoom: 19,
                minZoom: 6,
                attribution: false
            }
        };
    } else if (theme === 'osm') {
        return {
            url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
            options: {
                maxZoom: 19,
                maxNativeZoom: 19,
                attribution: false,
                className: 'leaflet-tile-grayscale'
            }
        };
    } else {
        // 기본값: 'clean' (대한민국 국토교통부 표준 그레이톤 도로망 캔버스 지도 - 무키·무워터마크)
        return {
            url: 'https://xdworld.vworld.kr/2d/Base/service/{z}/{x}/{y}.png',
            options: {
                maxZoom: 19,
                maxNativeZoom: 19,
                minZoom: 6,
                attribution: false,
                className: 'leaflet-tile-grayscale'
            }
        };
    }
}

let _currentPrintOpts = {
    targetDistrict: 'ALL',
    pageSize: 'A4',
    orientation: 'landscape',
    labelMode: 'leader',     // 'leader' (지시선 분산) | 'smart' (스마트 겹침방지) | 'badge' (번호 뱃지)
    fontSize: 7.5,           // px
    lineWidth: 5.0,          // px
    nodeSize: 1.8,           // px
    showInsetMap: true,      // 단위면적 최대밀집 확대도 표기 여부
    showJid: true,
    showBoundary: true,
    theme: 'clean'           // 'clean' (라이트 지도 - 기본값) | 'google' | 'dark'
};

let _activePrintMap = null;
let _baseFitZoom = null;
let _cachedHotspots = [];
let _activeInsetMaps = {}; // { [id]: L.Map }
let _insetVisibility = { 1: true, 2: true, 3: true };
let _cachedFilteredNodes = [];
let _cachedFilteredEdges = [];
let _cachedTargetFeature = null;
let _cachedDistrictBounds = null;

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
        .replace(/입구지하차도/, '지하차도')
        .replace(/주민센터/, '동')
        .trim();
}

/**
 * 단위 면적당 교차로 밀집도 상위 3대 중심점(Hotspot) 자동 계산 (반경 650m 기준, 상호 이격 1.3km 이상)
 */
function findTopDensityHotspots(nodes, maxCount = 3) {
    if (!nodes || nodes.length === 0) return [];

    const radiusKm = 0.65; // 약 650m 단위 면적 반경
    const minSeparationKm = 1.3; // 핫스팟 상호 간 최소 이격 거리 (영역 중복 방지)

    const scores = nodes.map(n => {
        let cnt = 0;
        nodes.forEach(other => {
            const d = Math.hypot((other.lat - n.lat) * 111, (other.lng - n.lng) * 88);
            if (d <= radiusKm) cnt++;
        });
        return { node: n, count: cnt };
    });

    scores.sort((a, b) => b.count - a.count);

    const colors = ['#f59e0b', '#06b6d4', '#ec4899']; // 1위: 앰버 골드, 2위: 시안 블루, 3위: 코랄 핑크
    const hotspots = [];

    for (const item of scores) {
        if (hotspots.length >= maxCount) break;
        const tooClose = hotspots.some(h => {
            const d = Math.hypot((h.centerNode.lat - item.node.lat) * 111, (h.centerNode.lng - item.node.lng) * 88);
            return d < minSeparationKm;
        });

        if (!tooClose && item.count >= 2) {
            const id = hotspots.length + 1;
            const cleanName = sanitizeJunctionName(item.node.name);
            const dLat = (radiusKm / 111) * 0.95;
            const dLng = (radiusKm / 88) * 0.95;

            hotspots.push({
                id: id,
                name: cleanName,
                title: `제${id} 밀집구역 (${cleanName} 일대 ${item.count}개소)`,
                shortTitle: `#${id} ${cleanName} (${item.count}개소)`,
                centerNode: item.node,
                count: item.count,
                color: colors[id - 1] || '#38bdf8',
                bounds: L.latLngBounds(
                    [item.node.lat - dLat, item.node.lng - dLng],
                    [item.node.lat + dLat, item.node.lng + dLng]
                )
            });
        }
    }
    return hotspots;
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
                    <h3 style="margin:0; font-size:17px; font-weight:700; color:#f8fafc;">연동 네트워크 도면 PDF 출력 설정</h3>
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

                <!-- 2. 라벨 및 밀집 확대도 옵션 -->
                <div style="background:rgba(56,189,248,0.06); border:1px solid rgba(56,189,248,0.25); border-radius:8px; padding:12px 14px;">
                    <label style="display:block; font-size:12.5px; font-weight:700; color:#38bdf8; margin-bottom:6px;">
                        🏷️ 모든 교차로명 표기 & 밀집지역 확대 설정
                    </label>
                    <select id="sel-print-label-mode" class="phase-select" style="width:100%; height:36px; background:#0f172a; border:1px solid rgba(56,189,248,0.4); color:#fff; border-radius:6px; padding:0 8px; font-size:12.5px; font-weight:bold;">
                        <option value="leader" selected>🎯 지시선 여백 분산 표기 (모든 교차로명 100% 표출 - 권장)</option>
                        <option value="badge">🔢 번호 뱃지 도면 + 하단 교차로 일람표</option>
                        <option value="smart">🛡️ 스마트 겹침 방지 (간소화 필터링)</option>
                    </select>
                    <div style="margin-top:8px; display:flex; align-items:center; gap:8px;">
                        <input type="checkbox" id="chk-print-show-inset" checked style="accent-color:#38bdf8; width:16px; height:16px; cursor:pointer;">
                        <label for="chk-print-show-inset" style="font-size:12px; color:#f8fafc; font-weight:bold; cursor:pointer;">
                            🔍 단위면적 최대밀집구역 상세 확대도(Inset Map) 포함
                        </label>
                    </div>
                </div>

                <!-- 3. 배경 지도 및 테마 -->
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                    <div>
                        <label style="display:block; font-size:12px; font-weight:600; color:#cbd5e1; margin-bottom:6px;">배경 지도 스타일</label>
                        <select id="sel-print-theme" class="phase-select" style="width:100%; height:36px; background:rgba(0,0,0,0.5); border:1px solid rgba(255,255,255,0.2); color:#fff; border-radius:6px; padding:0 8px; font-size:12px; font-weight:bold;">
                            <option value="clean" selected>📄 그레이톤 도로망 (기본 / 권장)</option>
                            <option value="color">🗺️ 컬러 도로 지도 (원본 풀컬러)</option>
                            <option value="osm">🌐 오픈스트리트맵 (OSM 그레이)</option>
                            <option value="dark">🌌 다크 지도 (고대비 야간 / 무키·무워터마크)</option>
                        </select>
                    </div>
                    <div>
                        <label style="display:block; font-size:12px; font-weight:600; color:#cbd5e1; margin-bottom:6px;">용지 규격 및 출력 방향</label>
                        <select id="sel-print-page-size" class="phase-select" style="width:100%; height:36px; background:rgba(0,0,0,0.5); border:1px solid rgba(255,255,255,0.2); color:#fff; border-radius:6px; padding:0 8px; font-size:12px; font-weight:600;">
                            <option value="A4_landscape" selected>📄 A4 가로 (기본 도면)</option>
                            <option value="A4_portrait">📑 A4 세로 (수직 도면)</option>
                            <option value="A3_landscape">📄 A3 가로 (대형 고해상도)</option>
                            <option value="A3_portrait">📑 A3 세로 (대형 수직 도면)</option>
                        </select>
                    </div>
                </div>

                <!-- 4. 연동선 및 노드 크기 -->
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                    <div>
                        <label style="display:block; font-size:12px; font-weight:600; color:#cbd5e1; margin-bottom:6px;">교차로 노드 크기</label>
                        <select id="sel-print-node-size" class="phase-select" style="width:100%; height:36px; background:rgba(0,0,0,0.5); border:1px solid rgba(255,255,255,0.2); color:#fff; border-radius:6px; padding:0 8px; font-size:12px;">
                            <option value="1.8" selected>초미니 1.8px (연동선 가림 0%)</option>
                            <option value="2.5">보통 2.5px</option>
                        </select>
                    </div>
                    <div>
                        <label style="display:block; font-size:12px; font-weight:600; color:#cbd5e1; margin-bottom:6px;">연동 링크선 굵기</label>
                        <select id="sel-print-line-width" class="phase-select" style="width:100%; height:36px; background:rgba(0,0,0,0.5); border:1px solid rgba(255,255,255,0.2); color:#fff; border-radius:6px; padding:0 8px; font-size:12px;">
                            <option value="5.0" selected>굵게 5.0px (그룹별 컬러 확연)</option>
                            <option value="6.5">매우 굵게 6.5px</option>
                        </select>
                    </div>
                </div>

                <!-- 버튼 -->
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
 * 모달 설정값 수집 후 실행
 */
window.executeNetworkPrint = async function() {
    const selDistrict = document.getElementById('sel-print-target-district');
    const pageVal = document.getElementById('sel-print-page-size').value || 'A4_landscape';
    const [pSize, pOrient] = pageVal.includes('_') ? pageVal.split('_') : [pageVal, 'landscape'];

    _currentPrintOpts = {
        targetDistrict: selDistrict ? selDistrict.value : 'ALL',
        pageSize: pSize || 'A4',
        orientation: pOrient || 'landscape',
        labelMode: document.getElementById('sel-print-label-mode').value || 'leader',
        theme: document.getElementById('sel-print-theme').value || 'clean',
        nodeSize: parseFloat(document.getElementById('sel-print-node-size').value) || 1.8,
        lineWidth: parseFloat(document.getElementById('sel-print-line-width').value) || 5.0,
        showInsetMap: document.getElementById('chk-print-show-inset').checked,
        fontSize: 7.5,
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

window.resetPrintMapView = function() {
    if (_activePrintMap && _cachedDistrictBounds) {
        _activePrintMap.fitBounds(_cachedDistrictBounds, { padding: [10, 10], animate: true });
        setTimeout(() => {
            if (_activePrintMap) {
                _baseFitZoom = _activePrintMap.getZoom();
                const gauge = document.getElementById('net-print-zoom-gauge');
                if (gauge) {
                    gauge.min = Math.max(9, _baseFitZoom - 2.0).toFixed(2);
                    gauge.max = Math.min(19, _baseFitZoom + 4.5).toFixed(2);
                    gauge.value = _baseFitZoom.toFixed(2);
                }
                updateZoomGaugeBadge(_baseFitZoom);
            }
        }, 350);
    }
};

window.onZoomGaugeInput = function(zoomVal) {
    if (!_activePrintMap) return;
    _activePrintMap.setZoom(parseFloat(zoomVal), { animate: false });
    updateZoomGaugeBadge(parseFloat(zoomVal));
};

window.stepZoomGauge = function(delta) {
    if (!_activePrintMap) return;
    const cur = _activePrintMap.getZoom();
    const target = Math.min(19, Math.max(8, cur + delta));
    _activePrintMap.setZoom(target, { animate: false });
    updateZoomGaugeBadge(target);
};

function updateZoomGaugeBadge(currentZoom) {
    const badge = document.getElementById('net-print-zoom-badge');
    const gauge = document.getElementById('net-print-zoom-gauge');
    if (badge) {
        if (_baseFitZoom) {
            const pct = Math.round(Math.pow(2, currentZoom - _baseFitZoom) * 100);
            badge.textContent = `${pct}%`;
        } else {
            badge.textContent = `${currentZoom.toFixed(1)}x`;
        }
    }
    if (gauge && Math.abs(parseFloat(gauge.value) - currentZoom) > 0.02) {
        gauge.value = currentZoom.toFixed(2);
    }
}

window.closeInsetMap = function(id) {
    const box = document.getElementById(`net-print-inset-box-${id}`);
    if (box) box.style.display = 'none';
    _insetVisibility[id] = false;
    updateInsetToolbarBadges();
    if (window.triggerSvgOverlayRender) window.triggerSvgOverlayRender();
};

window.openInsetMap = function(id) {
    _insetVisibility[id] = true;
    const box = document.getElementById(`net-print-inset-box-${id}`);
    if (box) box.style.display = 'block';

    const map = _activeInsetMaps[id];
    if (map) {
        setTimeout(() => map.invalidateSize(), 50);
    } else {
        const hotspot = _cachedHotspots.find(h => h.id === id);
        if (hotspot) {
            const tileConf = getNetworkPrintTileConfig(_currentPrintOpts.theme);
            renderSingleInsetDetailMap(hotspot, _cachedFilteredNodes, _cachedFilteredEdges, _currentPrintOpts, _currentPrintOpts.theme === 'dark', tileConf);
        }
    }
    updateInsetToolbarBadges();
    if (window.triggerSvgOverlayRender) window.triggerSvgOverlayRender();
};

window.toggleInsetMap = function(id) {
    if (_insetVisibility[id]) {
        window.closeInsetMap(id);
    } else {
        window.openInsetMap(id);
    }
};

window.restoreAllInsets = function() {
    _cachedHotspots.forEach(h => {
        window.openInsetMap(h.id);
    });
};

function updateInsetToolbarBadges() {
    const container = document.getElementById('net-print-inset-toolbar-buttons');
    if (!container || !_cachedHotspots || _cachedHotspots.length === 0) return;
    container.innerHTML = _cachedHotspots.map(h => {
        const isOpen = !!_insetVisibility[h.id];
        return `
            <button onclick="toggleInsetMap(${h.id})" style="background:${isOpen ? h.color + '22' : '#0f172a'}; border:1px solid ${isOpen ? h.color : '#475569'}; color:${isOpen ? h.color : '#64748b'}; border-radius:4px; padding:2px 7px; font-size:11px; font-weight:bold; cursor:pointer;" title="${isOpen ? '확대창 닫기' : '확대창 열기'}">
                #${h.id} ${isOpen ? 'ON' : 'OFF'}
            </button>
        `;
    }).join('');
}

let _savedPrintBounds = null;

window.triggerNetworkPrint = function() {
    if (_activePrintMap) {
        _savedPrintBounds = _activePrintMap.getBounds();
        _activePrintMap.invalidateSize({ animate: false });
        if (window.triggerSvgOverlayRender) window.triggerSvgOverlayRender();
    }
    Object.values(_activeInsetMaps).forEach(m => m && m.invalidateSize({ animate: false }));
    setTimeout(() => {
        window.print();
    }, 120);
};

if (typeof window !== 'undefined' && !window._netPrintEventsBound) {
    window._netPrintEventsBound = true;
    window.addEventListener('beforeprint', () => {
        if (_activePrintMap) {
            const b = _savedPrintBounds || _activePrintMap.getBounds();
            _activePrintMap.invalidateSize({ animate: false });
            if (b) _activePrintMap.fitBounds(b, { padding: [0, 0], animate: false });
            if (window.triggerSvgOverlayRender) window.triggerSvgOverlayRender();
        }
        Object.values(_activeInsetMaps).forEach(m => m && m.invalidateSize({ animate: false }));
    });
    window.addEventListener('afterprint', () => {
        if (_activePrintMap) {
            const b = _savedPrintBounds || _activePrintMap.getBounds();
            _activePrintMap.invalidateSize({ animate: false });
            if (b) _activePrintMap.fitBounds(b, { padding: [0, 0], animate: false });
            if (window.triggerSvgOverlayRender) window.triggerSvgOverlayRender();
        }
        Object.values(_activeInsetMaps).forEach(m => m && m.invalidateSize({ animate: false }));
    });
}

/**
 * 지시선(Leader Line) 방사형 분산 라벨링 계산
 */
function computeLeaderDispersedLabels(nodes, edges, opts, mapInstance) {
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
    const densityRadius = 26; // px
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

    const results = [];
    const fontSize = opts.fontSize || 7.5;

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
        const rectW = charCount * (fontSize * 0.70) + 8;
        const rectH = fontSize + 4;

        let targetX = p.origX + 5;
        let targetY = p.origY - rectH / 2;
        let hasLeader = false;

        // 밀집 지역인 경우 여백 방향으로 방사형 지시선 확장
        if (p.neighborCount > 1 && opts.labelMode === 'leader') {
            hasLeader = true;
            let dirX = p.origX - p.clusterCenterX;
            let dirY = p.origY - p.clusterCenterY;
            if (Math.hypot(dirX, dirY) < 1) {
                const ang = angles[i % angles.length];
                dirX = Math.cos(ang);
                dirY = Math.sin(ang);
            }
            const norm = Math.hypot(dirX, dirY) || 1;
            const dist = 24 + (i % 4) * 16;

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
    const hotspots = findTopDensityHotspots(filteredNodes, 3);

    _cachedFilteredNodes = filteredNodes;
    _cachedFilteredEdges = filteredEdges;
    _cachedTargetFeature = targetFeature;
    _cachedDistrictBounds = bounds;
    _cachedHotspots = hotspots;
    _insetVisibility = {
        1: opts.showInsetMap !== false,
        2: opts.showInsetMap !== false,
        3: opts.showInsetMap !== false
    };

    // 5. 오버레이 컨테이너 생성
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

    if (_activePrintMap) {
        try { _activePrintMap.remove(); } catch(e) {}
        _activePrintMap = null;
    }
    Object.keys(_activeInsetMaps).forEach(k => {
        try { _activeInsetMaps[k]?.remove(); } catch(e) {}
    });
    _activeInsetMaps = {};

    // 5. 인쇄 및 브라우저 화면 비율 1:1 완벽 일치 (WYSIWYG: A4/A3 가로·세로 규격 정밀 매핑)
    const isPortrait = (opts.orientation === 'portrait');
    const isA3 = (opts.pageSize === 'A3');

    let paperWidth, screenMapHeight, printMapHeight, aspectRatio;

    if (isPortrait) {
        paperWidth = '800px';
        if (isA3) {
            // A3 세로 (297x420mm -> 인쇄 가용 277x380mm, 비율 0.729)
            screenMapHeight = 1042;
            printMapHeight = '380mm';
            aspectRatio = '277 / 380';
        } else {
            // A4 세로 (210x297mm -> 인쇄 가용 190x257mm, 비율 0.739)
            screenMapHeight = 1028;
            printMapHeight = '257mm';
            aspectRatio = '190 / 257';
        }
    } else {
        paperWidth = '1140px';
        if (isA3) {
            // A3 가로 (420x297mm -> 인쇄 가용 400x257mm, 비율 1.556)
            screenMapHeight = 707;
            printMapHeight = '257mm';
            aspectRatio = '400 / 257';
        } else {
            // A4 가로 (297x210mm -> 인쇄 가용 277x170mm, 비율 1.629)
            screenMapHeight = 675;
            printMapHeight = '170mm';
            aspectRatio = '277 / 170';
        }
    }

    container.innerHTML = `
        <style id="network-print-dynamic-style">
            #network-print-overlay {
                position: fixed;
                top: 0; left: 0; width: 100vw; height: 100vh;
                background: rgba(6,9,18,0.95);
                z-index: 1000000;
                overflow-y: auto;
                display: flex;
                flex-direction: column;
                align-items: center;
                padding: 12px;
                box-sizing: border-box;
            }
            .net-print-paper {
                background: ${bgColor};
                color: ${textColor};
                width: ${paperWidth};
                max-width: 96vw;
                padding: 16px 20px;
                border-radius: 8px;
                box-shadow: 0 10px 45px rgba(0,0,0,0.7);
                border: 1px solid ${borderColor};
                box-sizing: border-box;
                position: relative;
            }
            /* 그레이톤 도로망 캔버스 필터 (알록달록한 배경 완전 배제, 도로망 윤곽 선명화) */
            .leaflet-tile-grayscale, img.leaflet-tile-grayscale {
                filter: grayscale(100%) brightness(105%) contrast(85%) opacity(0.85) !important;
                -webkit-filter: grayscale(100%) brightness(105%) contrast(85%) opacity(0.85) !important;
            }
            /* 다크 모드 타일 필터 (워터마크 없는 무키 고대비 다크 렌더링) */
            .leaflet-tile-dark, img.leaflet-tile-dark {
                filter: invert(100%) hue-rotate(180deg) brightness(85%) contrast(90%) !important;
                -webkit-filter: invert(100%) hue-rotate(180deg) brightness(85%) contrast(90%) !important;
            }
            /* 교차로명 라벨 기본 프레임 및 박스 제거 */
            .custom-inset-label {
                background: transparent !important;
                border: none !important;
                box-shadow: none !important;
            }
            @media print {
                @page {
                    size: ${opts.pageSize || 'A4'} ${opts.orientation || 'landscape'};
                    margin: 5mm;
                }
                html, body {
                    width: 100% !important;
                    height: 100% !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    overflow: hidden !important;
                    background: ${bgColor} !important;
                }
                body * {
                    visibility: hidden;
                }
                #network-print-overlay, #network-print-overlay * {
                    visibility: visible;
                }
                #network-print-overlay {
                    position: absolute !important;
                    top: 0 !important;
                    left: 0 !important;
                    width: 100% !important;
                    height: 100% !important;
                    max-height: 100% !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    background: ${bgColor} !important;
                    overflow: hidden !important;
                    page-break-after: avoid !important;
                    break-after: avoid !important;
                    page-break-inside: avoid !important;
                    break-inside: avoid !important;
                }
                .net-print-paper {
                    box-shadow: none !important;
                    border: none !important;
                    width: 100% !important;
                    max-width: 100% !important;
                    height: 100% !important;
                    max-height: 100% !important;
                    padding: 2mm 5mm !important;
                    margin: 0 !important;
                    background: ${bgColor} !important;
                    display: flex !important;
                    flex-direction: column !important;
                    justify-content: space-between !important;
                    page-break-inside: avoid !important;
                    break-inside: avoid !important;
                    page-break-after: avoid !important;
                    break-after: avoid !important;
                }
                #net-print-map-wrapper {
                    width: 100% !important;
                    height: ${printMapHeight} !important;
                    max-height: ${printMapHeight} !important;
                    min-height: ${printMapHeight} !important;
                    aspect-ratio: ${aspectRatio} !important;
                    overflow: hidden !important;
                    border: 1px solid ${borderColor} !important;
                    border-radius: 4px !important;
                    page-break-inside: avoid !important;
                    break-inside: avoid !important;
                }
                .net-print-inset-card {
                    box-shadow: none !important;
                    border-width: 1px !important;
                    page-break-inside: avoid !important;
                    break-inside: avoid !important;
                }
                .net-no-print {
                    display: none !important;
                }
                .leaflet-tile {
                    visibility: visible !important;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                }
                .leaflet-tile-grayscale, img.leaflet-tile-grayscale {
                    filter: grayscale(100%) brightness(105%) contrast(85%) opacity(0.85) !important;
                    -webkit-filter: grayscale(100%) brightness(105%) contrast(85%) opacity(0.85) !important;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                }
                .leaflet-tile-dark, img.leaflet-tile-dark {
                    filter: invert(100%) hue-rotate(180deg) brightness(85%) contrast(90%) !important;
                    -webkit-filter: invert(100%) hue-rotate(180deg) brightness(85%) contrast(90%) !important;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                }
            }
        </style>

        <!-- 상단 실시간 도면 최적화 툴바 (도면 규격에 정렬) -->
        <div class="net-no-print" style="width:${paperWidth}; max-width:96vw; background:#0f172a; border:1px solid rgba(56,189,248,0.4); border-radius:10px; padding:8px 14px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px 10px; box-shadow:0 8px 25px rgba(0,0,0,0.4);">
            <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                <div style="display:flex; align-items:center; gap:5px;">
                    <span style="font-size:12px; font-weight:bold; color:#38bdf8;">구역:</span>
                    <select onchange="updatePrintOption('targetDistrict', this.value)" style="background:#1e293b; color:#fff; border:1px solid #38bdf8; border-radius:4px; height:30px; font-size:12px; padding:0 6px;">
                        ${districtSelectHtml}
                    </select>
                </div>

                <div style="display:flex; align-items:center; gap:5px;">
                    <span style="font-size:12px; font-weight:bold; color:#cbd5e1;">방향:</span>
                    <select onchange="updatePrintOption('orientation', this.value)" style="background:#1e293b; color:#fff; border:1px solid rgba(255,255,255,0.2); border-radius:4px; height:30px; font-size:12px; padding:0 6px; font-weight:bold;">
                        <option value="landscape"${!isPortrait ? ' selected' : ''}>📄 가로 (Landscape)</option>
                        <option value="portrait"${isPortrait ? ' selected' : ''}>📑 세로 (Portrait)</option>
                    </select>
                </div>

                <div style="display:flex; align-items:center; gap:5px;">
                    <span style="font-size:12px; font-weight:bold; color:#cbd5e1;">용지:</span>
                    <select onchange="updatePrintOption('pageSize', this.value)" style="background:#1e293b; color:#fff; border:1px solid rgba(255,255,255,0.2); border-radius:4px; height:30px; font-size:12px; padding:0 6px;">
                        <option value="A4"${opts.pageSize === 'A4' || !opts.pageSize ? ' selected' : ''}>A4</option>
                        <option value="A3"${opts.pageSize === 'A3' ? ' selected' : ''}>A3</option>
                    </select>
                </div>

                <div style="display:flex; align-items:center; gap:5px;">
                    <span style="font-size:12px; font-weight:bold; color:#38bdf8;">라벨:</span>
                    <select onchange="updatePrintOption('labelMode', this.value)" style="background:#1e293b; color:#fff; border:1px solid #38bdf8; border-radius:4px; height:30px; font-size:12px; padding:0 6px; font-weight:bold;">
                        <option value="leader"${opts.labelMode === 'leader' ? ' selected' : ''}>🎯 지시선 여백 분산 (모든 교차로명 표출)</option>
                        <option value="smart"${opts.labelMode === 'smart' ? ' selected' : ''}>🛡️ 스마트 겹침방지 모드</option>
                        <option value="badge"${opts.labelMode === 'badge' ? ' selected' : ''}>🔢 번호 뱃지 + 하단 색인표</option>
                    </select>
                </div>

                <div style="display:flex; align-items:center; gap:5px;">
                    <span style="font-size:12px; font-weight:bold; color:#cbd5e1;">지도:</span>
                    <select onchange="updatePrintOption('theme', this.value)" style="background:#1e293b; color:#fff; border:1px solid rgba(255,255,255,0.2); border-radius:4px; height:30px; font-size:12px; padding:0 6px; font-weight:bold;">
                        <option value="clean"${opts.theme === 'clean' || !opts.theme ? ' selected' : ''}>📄 그레이톤 도로망 (기본)</option>
                        <option value="color"${opts.theme === 'color' ? ' selected' : ''}>🗺️ 컬러 도로 지도</option>
                        <option value="osm"${opts.theme === 'osm' ? ' selected' : ''}>🌐 오픈스트리트맵</option>
                        <option value="dark"${opts.theme === 'dark' ? ' selected' : ''}>🌌 다크 지도</option>
                    </select>
                </div>

                <div style="display:flex; align-items:center; gap:5px;">
                    <span style="font-size:12px; font-weight:bold; color:#cbd5e1;">연동선:</span>
                    <select onchange="updatePrintOption('lineWidth', parseFloat(this.value))" style="background:#1e293b; color:#fff; border:1px solid rgba(255,255,255,0.2); border-radius:4px; height:30px; font-size:12px; padding:0 6px;">
                        <option value="4.0"${opts.lineWidth === 4.0 ? ' selected' : ''}>보통 4.0px</option>
                        <option value="5.5"${opts.lineWidth === 5.5 ? ' selected' : ''}>굵게 5.5px (권장)</option>
                        <option value="7.0"${opts.lineWidth === 7.0 ? ' selected' : ''}>매우 굵게 7.0px</option>
                    </select>
                </div>

                <!-- [배율 미세조절 게이지 슬라이더] -->
                <div style="display:flex; align-items:center; gap:6px; background:#1e293b; border:1px solid #38bdf8; border-radius:6px; padding:2px 10px; height:30px; box-sizing:border-box;">
                    <span style="font-size:12px; font-weight:bold; color:#38bdf8; white-space:nowrap;">🔍 배율:</span>
                    <button onclick="stepZoomGauge(-0.15)" style="background:#0f172a; border:1px solid rgba(56,189,248,0.3); color:#38bdf8; border-radius:3px; width:22px; height:22px; font-size:13px; font-weight:bold; cursor:pointer; display:flex; align-items:center; justify-content:center; line-height:1;" title="미세 축소 (−0.15)">−</button>
                    <input type="range" id="net-print-zoom-gauge" min="10" max="18" step="0.05" value="13"
                           oninput="onZoomGaugeInput(parseFloat(this.value))"
                           style="width:115px; accent-color:#38bdf8; cursor:ew-resize;" title="슬라이더를 좌우로 드래그하여 배율을 미세하게 조절합니다">
                    <button onclick="stepZoomGauge(+0.15)" style="background:#0f172a; border:1px solid rgba(56,189,248,0.3); color:#38bdf8; border-radius:3px; width:22px; height:22px; font-size:13px; font-weight:bold; cursor:pointer; display:flex; align-items:center; justify-content:center; line-height:1;" title="미세 확대 (+0.15)">+</button>
                    <span id="net-print-zoom-badge" style="font-size:11px; font-weight:bold; color:#38bdf8; min-width:44px; text-align:right; font-variant-numeric:tabular-nums;">100%</span>
                </div>

                <!-- [확대영역 3개 토글 & 복원 컨트롤] -->
                <div style="display:flex; align-items:center; gap:6px; background:#1e293b; border:1px solid rgba(245,158,11,0.5); border-radius:6px; padding:2px 8px; height:30px; box-sizing:border-box;">
                    <span style="font-size:12px; font-weight:bold; color:#f59e0b; white-space:nowrap;">🔍 확대영역(3개):</span>
                    <div id="net-print-inset-toolbar-buttons" style="display:flex; gap:4px;">
                        ${hotspots.map(h => `
                            <button onclick="toggleInsetMap(${h.id})" style="background:${h.color}22; border:1px solid ${h.color}; color:${h.color}; border-radius:4px; padding:2px 7px; font-size:11px; font-weight:bold; cursor:pointer;" title="${h.title} 토글">
                                #${h.id} ON
                            </button>
                        `).join('')}
                    </div>
                    <button onclick="restoreAllInsets()" style="background:#0f172a; border:1px solid #f59e0b; color:#f59e0b; border-radius:4px; font-size:11px; font-weight:bold; padding:2px 6px; cursor:pointer;" title="닫았던 모든 확대영역을 다시 복원합니다">
                        전체 복원
                    </button>
                </div>

                <button onclick="resetPrintMapView()" class="phase-action-btn phase-btn-cyan" style="height:30px; padding:0 10px; font-size:11.5px; font-weight:bold;" title="해당 구역을 화면에 꽉 차게 재설정합니다 (100% 기본 배율)">
                    구역 전체 맞춤
                </button>
            </div>

            <div style="display:flex; gap:8px;">
                <button onclick="triggerNetworkPrint()" class="phase-action-btn phase-btn-blue" style="height:34px; padding:0 18px; font-size:13px; font-weight:bold; background:linear-gradient(135deg, #0284c7 0%, #0369a1 100%);">
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
            <div style="display:flex; justify-content:space-between; align-items:flex-end; border-bottom:2.5px solid ${isDark ? '#38bdf8' : '#0284c7'}; padding-bottom:6px; margin-bottom:8px;">
                <div>
                    <div style="font-size:11px; font-weight:700; color:${isDark ? '#38bdf8' : '#0284c7'}; letter-spacing:1px; margin-bottom:2px;">
                        KOROAD SIGMA TRAFFIC SIGNAL MANAGEMENT SYSTEM
                    </div>
                    <h1 style="margin:0; font-size:21px; font-weight:800; letter-spacing:-0.5px; color:${textColor};">
                        ${districtTitle} 신호 연동 네트워크 현황도
                    </h1>
                </div>

                <!-- 통계 정보 요약 -->
                <div style="display:flex; flex-direction:column; gap:3px; text-align:right; font-size:11px; color:${subColor};">
                    <div><b>관할:</b> ${regionName} &nbsp;|&nbsp; <b>발행일시:</b> ${nowStr}</div>
                    <div>
                        <b>총 교차로:</b> <span style="color:${isDark ? '#38bdf8' : '#0284c7'}; font-weight:bold;">${filteredNodes.length}개소</span> &nbsp;|&nbsp; 
                        <b>연동 링크:</b> <span style="color:${isDark ? '#38bdf8' : '#0284c7'}; font-weight:bold;">${filteredEdges.length}구간</span>
                    </div>
                </div>
            </div>

            <!-- 중앙 대형 맵 영역 (화면비율과 인쇄비율 1:1 일치) -->
            <div id="net-print-map-wrapper" style="position:relative; width:100%; height:${screenMapHeight}px; aspect-ratio:${aspectRatio}; border:1.5px solid ${borderColor}; border-radius:6px; overflow:hidden; background:${isDark ? '#050811' : '#f8fafc'};">
                <!-- 1. Leaflet 배경지도 타일 레이어 -->
                <div id="net-print-leaflet-map" style="position:absolute; top:0; left:0; width:100%; height:100%; z-index:1; cursor:grab;"></div>

                <!-- 2. SVG 그래픽 레이어 -->
                <svg id="net-print-svg-overlay" style="position:absolute; top:0; left:0; width:100%; height:100%; z-index:2; pointer-events:none;">
                </svg>

                <!-- 3. 방위표 및 조작 안내 -->
                <div style="position:absolute; top:14px; right:14px; z-index:10; display:flex; flex-direction:column; align-items:flex-end; gap:8px;">
                    <div style="background:${cardBg}; border:1px solid ${borderColor}; border-radius:50%; width:34px; height:34px; display:flex; align-items:center; justify-content:center; box-shadow:0 4px 10px rgba(0,0,0,0.3);">
                        <span style="font-size:11px; font-weight:bold; color:${isDark ? '#38bdf8' : '#0284c7'};">▲ N</span>
                    </div>
                    <div class="net-no-print" style="background:${cardBg}; border:1px solid ${borderColor}; border-radius:4px; padding:3px 8px; font-size:10px; color:${subColor};">
                        * 마우스 휠 및 게이지로 미세 확대/축소 가능
                    </div>
                </div>

                <!-- 4. [단위면적 최대 밀집구역 상세 확대 인셋 맵 3개] (백분율 배치로 인쇄 1:1 완벽 일치 & 드래그 보존) -->
                <div id="net-print-insets-container" style="position:absolute; bottom:0; left:0; width:100%; height:100%; pointer-events:none; z-index:15;">
                    ${hotspots.map((h, idx) => {
                        let defaultLeftPct, defaultBottomPct, defaultWidthPct, defaultHeightPct;
                        if (isPortrait) {
                            defaultWidthPct = 31.5;
                            defaultHeightPct = 18.0;
                            defaultBottomPct = 1.2;
                            defaultLeftPct = 1.2 + idx * 33.0;
                        } else {
                            defaultWidthPct = 29.5;
                            defaultHeightPct = 31.0;
                            defaultBottomPct = 1.5;
                            defaultLeftPct = 1.2 + idx * 30.5;
                        }
                        return `
                        <div id="net-print-inset-box-${h.id}" class="net-print-inset-card" style="display:${_insetVisibility[h.id] ? 'block' : 'none'}; position:absolute; bottom:${defaultBottomPct}%; left:${defaultLeftPct}%; width:${defaultWidthPct}%; height:${defaultHeightPct}%; background:${bgColor}; border:1.2px solid ${h.color}; border-radius:4px; box-shadow:0 4px 14px rgba(0,0,0,0.4); overflow:hidden; pointer-events:auto; box-sizing:border-box;">
                            <!-- 투명 드래그 핸들 (상단 터치 영역) -->
                            <div id="net-print-inset-header-${h.id}" style="position:absolute; top:0; left:0; width:100%; height:26px; z-index:9; cursor:grab; user-select:none;"></div>
                            
                            <!-- 미니멀 식별 뱃지 (#1, #2, #3) -->
                            <span style="position:absolute; top:4px; left:4px; z-index:10; background:${h.color}; color:#fff; font-size:9.5px; font-weight:bold; padding:1px 5px; border-radius:3px; box-shadow:0 1px 3px rgba(0,0,0,0.5); pointer-events:none; line-height:1.2;">#${h.id}</span>
                            
                            <!-- 미니멀 닫기 버튼 (화면용) -->
                            <button onclick="closeInsetMap(${h.id})" class="net-no-print" style="position:absolute; top:4px; right:4px; z-index:10; background:rgba(15,23,42,0.75); border:1px solid rgba(255,255,255,0.3); color:#fff; border-radius:3px; width:18px; height:18px; font-size:10px; font-weight:bold; display:flex; align-items:center; justify-content:center; cursor:pointer; line-height:1; padding:0;" title="확대창 닫기">✕</button>

                            <!-- 100% 전체 화면 지도 캔버스 -->
                            <div id="net-print-inset-map-${h.id}" style="width:100%; height:100%; position:relative;"></div>
                        </div>
                    `;}).join('')}
                </div>
            </div>

            <!-- 하단 푸터 -->
            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:6px; font-size:9.5px; color:${subColor};">
                <div>* 본 도면은 실제 도로 배경 지도와 SIGMA 연동 그룹별 고유 알고리즘에 의해 자동 생성된 공식 도면입니다.</div>
                <div><b>SIGMA SIM</b> | Powered by Koroad & Advanced Agentic Signal Engine</div>
            </div>
        </div>
    `;

    container.style.display = 'flex';

    // 6. Leaflet 맵 초기화 및 화면 가득 차도록 타이트 피팅
    setTimeout(() => {
        const mapEl = document.getElementById('net-print-leaflet-map');
        if (!mapEl) return;

        const printMap = L.map('net-print-leaflet-map', {
            zoomControl: false,
            attributionControl: false,
            boxZoom: true,
            doubleClickZoom: true,
            dragging: true,
            scrollWheelZoom: true,
            zoomSnap: 0.05,
            zoomDelta: 0.1,
            wheelPxPerZoomLevel: 140
        });
        _activePrintMap = printMap;

        const tileConf = getNetworkPrintTileConfig(opts.theme);
        L.tileLayer(tileConf.url, tileConf.options).addTo(printMap);

        // 여백 10px 극소화로 구역 전체 화면 가득 차게 Auto-Zoom
        printMap.fitBounds(bounds, { padding: [10, 10], animate: false });
        _baseFitZoom = printMap.getZoom();

        const gauge = document.getElementById('net-print-zoom-gauge');
        if (gauge) {
            gauge.min = Math.max(9, _baseFitZoom - 2.0).toFixed(2);
            gauge.max = Math.min(19, _baseFitZoom + 4.5).toFixed(2);
            gauge.value = _baseFitZoom.toFixed(2);
        }
        updateZoomGaugeBadge(_baseFitZoom);

        let _renderRaf = null;
        const triggerRender = () => {
            if (_renderRaf) cancelAnimationFrame(_renderRaf);
            _renderRaf = requestAnimationFrame(() => {
                renderSvgOnMap(printMap, _cachedFilteredNodes, _cachedFilteredEdges, _cachedTargetFeature, opts, _cachedHotspots);
            });
        };
        window.triggerSvgOverlayRender = triggerRender;

        printMap.whenReady(() => {
            triggerRender();
            renderAllInsets(_cachedFilteredNodes, _cachedFilteredEdges, opts, isDark, tileConf, _cachedHotspots);
        });

        printMap.on('zoom', () => {
            updateZoomGaugeBadge(printMap.getZoom());
            triggerRender();
        });
        printMap.on('move', triggerRender);
        printMap.on('resize', triggerRender);
    }, 40);
}

/**
 * 맵 좌표계를 투영하여 SVG 그래픽 렌더링
 * [그룹별 고유 컬러 적용 & 연동선 최상위 승격]
 */
function renderSvgOnMap(printMap, nodes, edges, targetFeature, opts, hotspots) {
    const svgEl = document.getElementById('net-print-svg-overlay');
    if (!svgEl) return;

    const isDark = (opts.theme === 'dark');
    const nodeR = opts.nodeSize || 1.8;
    const lineWidth = opts.lineWidth || 5.0;
    const textColor = isDark ? '#f8fafc' : '#0f172a';
    const badgeBg = isDark ? 'rgba(15,23,42,0.88)' : 'rgba(255,255,255,0.92)';
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
            return `<polygon points="${pts}" fill="${isDark ? 'rgba(56,189,248,0.03)' : 'rgba(2,132,199,0.02)'}" stroke="${isDark ? '#38bdf8' : '#0284c7'}" stroke-width="2.2" stroke-dasharray="6,4" />`;
        };

        if (geom.type === 'Polygon') {
            svgBoundary += renderPolygon(geom.coordinates[0]);
        } else if (geom.type === 'MultiPolygon') {
            geom.coordinates.forEach(poly => {
                svgBoundary += renderPolygon(poly[0]);
            });
        }
    }

    // 2. [단위면적 상위 3대 밀집구역] 본도면 점선 및 배지 표시 완전 제거 (혼란 방지 및 본도면 도로망 시인성 극대화)

    // 3. 지시선 및 라벨 계산
    const labelItems = computeLeaderDispersedLabels(nodes, edges, opts, printMap);

    let svgLeaders = '';
    let svgLabels = '';

    labelItems.forEach(item => {
        const { origX, origY, labelX, labelY, rectW, rectH, labelText, hasLeader } = item;

        // A. 지시선
        if (hasLeader) {
            svgLeaders += `<polyline points="${origX},${origY} ${labelX},${labelY + rectH / 2}" stroke="${leaderColor}" stroke-width="0.8" stroke-dasharray="3,2" fill="none" opacity="0.8" />`;
        }

        // B. 교차로명 라벨 텍스트 (배경 사각 프레임 제거 -> 지도의 도로망 시인성 극대화)
        // 텍스트 후광(Halo Stroke)을 부여하여 어떤 배경 위에서도 글자 본체가 선명하게 식별됨
        const textHalo = isDark ? '#080c16' : '#ffffff';
        svgLabels += `
            <g transform="translate(${labelX}, ${labelY})">
                <text x="2" y="${rectH - 3.5}" 
                      font-family="'Pretendard', 'Noto Sans KR', sans-serif" 
                      font-size="${opts.fontSize}px" 
                      font-weight="700" 
                      paint-order="stroke fill"
                      stroke="${textHalo}"
                      stroke-width="2.6px"
                      stroke-linejoin="round"
                      stroke-linecap="round"
                      fill="${textColor}">
                    ${labelText}
                </text>
            </g>
        `;
    });

    // 4. 연동 링크선 (Edges - 그룹별 고유 컬러 적용 & 최상위 관통 레이어!)
    let svgEdges = '';
    edges.forEach(edge => {
        const p1 = printMap.latLngToContainerPoint([edge.u.lat, edge.u.lng]);
        const p2 = printMap.latLngToContainerPoint([edge.v.lat, edge.v.lng]);
        
        // 두 노드의 그룹 확인 (그룹별 고유 컬러 매핑)
        const gid = (edge.u.group && edge.u.group !== '0' && edge.u.group !== 'default') 
            ? edge.u.group 
            : ((edge.v.group && edge.v.group !== '0') ? edge.v.group : '0');

        const strokeColor = getDistinctGroupColor(gid);
        const isCrossGroup = (edge.u.group && edge.v.group && edge.u.group !== edge.v.group);
        const dashArray = isCrossGroup ? 'stroke-dasharray="6,3"' : '';

        // 하부 글로우 베이스 (선명한 대비 확보)
        svgEdges += `<line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" stroke="${isDark ? '#000000' : '#ffffff'}" stroke-width="${lineWidth + 2.5}" stroke-linecap="round" opacity="0.8" />`;
        // 상부 고유 그룹 컬러 연동선
        svgEdges += `<line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" stroke="${strokeColor}" stroke-width="${lineWidth}" stroke-linecap="round" ${dashArray} opacity="0.95" />`;
    });

    // 5. 초미니멀 노드 점 (r=1.8px)
    let svgNodes = '';
    nodes.forEach(j => {
        const pt = printMap.latLngToContainerPoint([j.lat, j.lng]);
        const nodeColor = getDistinctGroupColor(j.group || '0');
        svgNodes += `<circle cx="${pt.x}" cy="${pt.y}" r="${nodeR}" fill="${nodeColor}" stroke="#ffffff" stroke-width="1.0" />`;
    });

    // 렌더링 순서: 경계선 -> 지시선 -> 라벨 -> 연동선(그룹컬러 최상위) -> 노드 점
    svgEl.innerHTML = `
        ${svgBoundary}
        ${svgLeaders}
        ${svgLabels}
        ${svgEdges}
        ${svgNodes}
    `;
}

/**
 * 단위 면적당 상위 3대 밀집구역 상세 확대 인셋 맵 전체 렌더링
 */
function renderAllInsets(nodes, edges, opts, isDark, tileConf, hotspots) {
    if (!hotspots || hotspots.length === 0) return;
    hotspots.forEach(h => {
        if (_insetVisibility[h.id]) {
            renderSingleInsetDetailMap(h, nodes, edges, opts, isDark, tileConf);
        }
        const box = document.getElementById(`net-print-inset-box-${h.id}`);
        const header = document.getElementById(`net-print-inset-header-${h.id}`);
        if (box && header) {
            makeDraggable(header, box);
        }
    });
}

function renderSingleInsetDetailMap(hotspot, nodes, edges, opts, isDark, tileConf) {
    const mapContainerId = `net-print-inset-map-${hotspot.id}`;
    const el = document.getElementById(mapContainerId);
    if (!el) return;

    if (_activeInsetMaps[hotspot.id]) {
        try { _activeInsetMaps[hotspot.id].remove(); } catch(e) {}
        delete _activeInsetMaps[hotspot.id];
    }

    const conf = (tileConf && tileConf.url) ? tileConf : getNetworkPrintTileConfig(opts ? opts.theme : 'clean');

    const centerNode = hotspot.centerNode;
    const insetMap = L.map(mapContainerId, {
        zoomControl: false,
        attributionControl: false,
        boxZoom: false,
        doubleClickZoom: false,
        dragging: true,
        scrollWheelZoom: true,
        zoomSnap: 0.1
    }).setView([centerNode.lat, centerNode.lng], 16); // 250% 정밀 확대

    _activeInsetMaps[hotspot.id] = insetMap;
    L.tileLayer(conf.url, conf.options).addTo(insetMap);

    insetMap.whenReady(() => {
        // 인셋 맵 내 연동 링크선 (고유 그룹 컬러)
        edges.forEach(edge => {
            const gid = (edge.u.group && edge.u.group !== '0') ? edge.u.group : (edge.v.group || '0');
            const color = getDistinctGroupColor(gid);
            L.polyline([[edge.u.lat, edge.u.lng], [edge.v.lat, edge.v.lng]], {
                color: color,
                weight: 5.0,
                opacity: 0.95
            }).addTo(insetMap);
        });

        // 핫스팟 반경 내 교차로 마커 및 큼직한 교차로명 라벨
        nodes.forEach(j => {
            const d = Math.hypot((j.lat - centerNode.lat) * 111, (j.lng - centerNode.lng) * 88);
            if (d <= 0.9) {
                const shortId = String(j.id).replace(/^[A-Za-z0-9]+-/, '');
                const cleanName = sanitizeJunctionName(j.name);
                const color = getDistinctGroupColor(j.group || '0');

                L.circleMarker([j.lat, j.lng], {
                    radius: 3.5,
                    color: '#ffffff',
                    weight: 1.5,
                    fillColor: color,
                    fillOpacity: 1
                }).addTo(insetMap);

                const icon = L.divIcon({
                    className: 'custom-inset-label',
                    html: `<div style="background:transparent; color:${isDark ? '#ffffff' : '#0f172a'}; border:none; padding:0; font-size:9.5px; font-weight:700; text-shadow:${isDark ? '0 0 3px #000, 0 0 3px #000, 1px 1px 2px #000' : '0 0 3px #fff, 0 0 3px #fff, 1px 1px 2px #fff'}; white-space:nowrap;">[${shortId}] ${cleanName}</div>`,
                    iconSize: [90, 18],
                    iconAnchor: [-6, 12]
                });
                L.marker([j.lat, j.lng], { icon, interactive: false }).addTo(insetMap);
            }
        });
    });
}

/**
 * 인셋 박스 마우스 드래그 이동 헬퍼
 * - 포인터 상대 오프셋 기반 무간섭 드래그 & 부모 컨테이너 기준 정밀 좌표 계산
 * - 엉뚱한 위치로 튀는 현상 원천 해결 (오차 0px)
 */
function makeDraggable(headerEl, containerEl) {
    let isDragging = false;
    let grabOffsetX = 0;
    let grabOffsetY = 0;
    headerEl.style.cursor = 'grab';

    headerEl.onmousedown = (e) => {
        if (e.target.tagName === 'BUTTON') return; // 창닫기 버튼 클릭 시 드래그 방지
        e.preventDefault();

        isDragging = true;
        headerEl.style.cursor = 'grabbing';
        document.querySelectorAll('.net-print-inset-card').forEach(el => el.style.zIndex = '15');
        containerEl.style.zIndex = '25';

        // 1. 클릭 시점 카드 박스 위치(Viewport)와 마우스 클릭 위치 간격(오프셋)
        const cardRect = containerEl.getBoundingClientRect();
        grabOffsetX = e.clientX - cardRect.left;
        grabOffsetY = e.clientY - cardRect.top;

        // 2. 부모 컨테이너 (위치 기준 요소)
        const parent = containerEl.offsetParent || containerEl.parentElement;

        const onMouseMove = (ev) => {
            if (!isDragging) return;
            const parentRect = parent.getBoundingClientRect();

            // 부모 기준 새 좌표 = (현재 마우스 - 클릭 오프셋) - 부모 시작점
            let newLeft = (ev.clientX - grabOffsetX) - parentRect.left;
            let newTop = (ev.clientY - grabOffsetY) - parentRect.top;

            // 지도 래퍼 경계 내로 제한 (화면 밖 이탈 방지)
            const maxLeft = parentRect.width - cardRect.width;
            const maxTop = parentRect.height - cardRect.height;
            newLeft = Math.max(4, Math.min(maxLeft - 4, newLeft));
            newTop = Math.max(4, Math.min(maxTop - 4, newTop));

            containerEl.style.left = `${newLeft}px`;
            containerEl.style.top = `${newTop}px`;
            containerEl.style.bottom = 'auto';
            containerEl.style.right = 'auto';
        };

        const onMouseUp = () => {
            isDragging = false;
            headerEl.style.cursor = 'grab';
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);

            // 드래그 종료 시 부모 기준 백분율(%)로 확정 변환 (인쇄 1:1 완벽 일치 보장)
            const parentRect = parent.getBoundingClientRect();
            const currentRect = containerEl.getBoundingClientRect();
            if (parentRect.width > 0 && parentRect.height > 0) {
                const pctLeft = (((currentRect.left - parentRect.left) / parentRect.width) * 100).toFixed(2);
                const pctTop = (((currentRect.top - parentRect.top) / parentRect.height) * 100).toFixed(2);
                containerEl.style.left = `${pctLeft}%`;
                containerEl.style.top = `${pctTop}%`;
                containerEl.style.bottom = 'auto';
                containerEl.style.right = 'auto';
            }
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };
}

window.closeNetworkPrintOverlay = function() {
    const container = document.getElementById('network-print-overlay');
    if (container) container.style.display = 'none';
    if (_activePrintMap) {
        try { _activePrintMap.remove(); } catch(e) {}
        _activePrintMap = null;
    }
    Object.keys(_activeInsetMaps).forEach(k => {
        try { _activeInsetMaps[k]?.remove(); } catch(e) {}
    });
    _activeInsetMaps = {};
};
