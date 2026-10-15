/**
 * safetyzone.js - 초고속 보호구역 레이어 모듈
 * ─────────────────────────────────────────────────────────
 * 최적화 전략 (Render & Supabase 무료 티어 100% 최적화):
 * 1. 지역별 온디맨드(On-Demand) 분할 로딩 (전국 10MB 대신 해당 지역만 다운로드)
 * 2. 3계층 다중 캐싱: [1] 브라우저 RAM 레이어 -> [2] sessionStorage -> [3] 백엔드 RAM 캐시
 * 3. Leaflet Canvas 렌더러(L.canvas): 수천 개 SVG DOM 제거 및 60FPS 하드웨어 가속
 * 4. 토글 재표출 0초: 레이어 인스턴스 재사용 (Remove/Add 레이어만 수행)
 */

let safetyZoneLayer = null;
let isSafetyZoneVisible = false;
let currentRenderedRegion = null;
const clientSafetyZoneCache = {};

// 지역 코드 -> 시군구 코드 접두사 매핑
const SAFETY_PREFIX_MAP = {
    'L01': '11', 'L02': '28', '161': '26', '155': '27', '131': '30',
    '142': '31', '144': '29', '169': '36', '170': '41', '171': '42',
    '172': '43', '173': '44', '174': '45', '175': '46', '176': '47',
    '177': '48', '178': '50',
    'L03': '4119', 'L04': '4121', 'L05': '4117', 'L06': '4129', 'L07': '4127',
    'L08': '4146', 'L09': '4113', 'L10': '4128', 'L11': '4139', 'L12': '4148',
    'L13': '4163', 'L14': '4115', 'L15': '4157', 'L16': '4143', 'L17': '4141',
    'L18': '4136', 'L19': '4111', 'L20': '4161', 'L21': '4131', 'L22': '4145',
    'L23': '26', 'L24': '4833', 'L25': '4812', 'L26': '4825', 'L28': '4831',
    'L29': '27', 'L30': '30', 'L31': '29', 'L37': '4711'
};

async function toggleSafetyZone() {
    isSafetyZoneVisible = !isSafetyZoneVisible;
    const btn = document.getElementById('btn-safety-zone');
    
    if (!isSafetyZoneVisible) {
        if (btn) btn.classList.remove('active');
        if (safetyZoneLayer && window.map) {
            window.map.removeLayer(safetyZoneLayer);
        }
        return;
    }
    
    if (btn) btn.classList.add('active');

    // 현재 열려있는 지역 확인
    let activeRegion = 'L01';
    if (typeof _openAccordions !== 'undefined') {
        const found = Object.keys(_openAccordions).find(k => _openAccordions[k] && SAFETY_PREFIX_MAP[k]);
        if (found) activeRegion = found;
    }

    // 이미 동일 지역의 레이어가 생성되어 있으면 즉시 재표출 (0ms)
    if (safetyZoneLayer && currentRenderedRegion === activeRegion && window.map) {
        safetyZoneLayer.addTo(window.map);
        return;
    }

    // 다른 지역이거나 첫 생성인 경우 기존 레이어 제거 후 새로 로딩
    if (safetyZoneLayer && window.map) {
        window.map.removeLayer(safetyZoneLayer);
        safetyZoneLayer = null;
    }

    await fetchAndDrawSafetyZones(activeRegion);
}

async function fetchAndDrawSafetyZones(regionCode = 'L01') {
    if (typeof showLoading === 'function') showLoading("보호구역 데이터 로딩 중 (초고속 캐시 모드)...");
    
    try {
        let items = clientSafetyZoneCache[regionCode];

        // 1. 브라우저 세션 스토리지 캐시 확인 (새로고침 후 재방문 대응)
        if (!items) {
            try {
                const sessionRaw = sessionStorage.getItem('sigma_safety_' + regionCode);
                if (sessionRaw) {
                    items = JSON.parse(sessionRaw);
                    clientSafetyZoneCache[regionCode] = items;
                }
            } catch (e) {
                console.warn("[SafetyZone] SessionStorage read error:", e);
            }
        }

        // 2. 캐시 미스 시 온디맨드 백엔드 API 요청 (현재 지역만 분할 조회)
        if (!items) {
            const response = await fetch(`/api/sim/safetyzone?regionCode=${encodeURIComponent(regionCode)}`);
            if (!response.ok) throw new Error("API 요청 실패: HTTP " + response.status);
            
            const data = await response.json();
            items = data.items || (Array.isArray(data) ? data : [data]);

            // 브라우저 캐시에 저장
            clientSafetyZoneCache[regionCode] = items;
            try {
                sessionStorage.setItem('sigma_safety_' + regionCode, JSON.stringify(items));
            } catch (e) {
                // QuotaExceededError 등 발생 시 메모리 캐시로 대체
            }
        }

        if (!items || items.length === 0 || items[0] == null) {
            alert("조회된 보호구역 데이터가 없습니다. (지역: " + regionCode + ")");
            if (typeof hideLoading === 'function') hideLoading();
            const btn = document.getElementById('btn-safety-zone');
            if (btn) btn.classList.remove('active');
            isSafetyZoneVisible = false;
            return;
        }

        // 3. 단일 FeatureCollection 생성
        const features = [];
        
        items.forEach(item => {
            if (!item) return;
            const name = item.trgtFcltNm || item.fac_name || item.name || item.소재지지번주소 || item.spt_nm || item.fcltyNm || "보호구역";
            let type = "보호구역";
            if (item.fcltTypeCd && typeof typeMap !== 'undefined' && typeMap[item.fcltTypeCd]) {
                type = typeMap[item.fcltTypeCd];
            } else if (item.spt_se) {
                type = item.spt_se;
            }

            if (item.geojson) {
                let parsedGeo;
                try {
                    parsedGeo = typeof item.geojson === 'string' ? JSON.parse(item.geojson) : item.geojson;
                } catch(e) { return; }
                
                if (parsedGeo.type === 'FeatureCollection' && Array.isArray(parsedGeo.features)) {
                    parsedGeo.features.forEach(f => {
                        f.properties = { ...f.properties, name, type };
                        features.push(f);
                    });
                } else if (parsedGeo.type === 'Feature') {
                    parsedGeo.properties = { ...parsedGeo.properties, name, type };
                    features.push(parsedGeo);
                } else if (parsedGeo.type) {
                    features.push({
                        type: 'Feature',
                        geometry: parsedGeo,
                        properties: { name, type }
                    });
                }
            } else {
                const lat = parseFloat(item.lat || item.latitude || item.y || item.Y);
                const lng = parseFloat(item.lng || item.longitude || item.lon || item.x || item.X);
                if (!isNaN(lat) && !isNaN(lng)) {
                    features.push({
                        type: 'Feature',
                        geometry: { type: 'Point', coordinates: [lng, lat] },
                        properties: { name, type }
                    });
                }
            }
        });

        // 4. Leaflet Canvas 렌더러 적용 (DOM SVG 대신 고성능 2D Canvas 드로잉)
        const canvasRenderer = L.canvas({ padding: 0.5 });

        safetyZoneLayer = L.geoJSON({ type: 'FeatureCollection', features: features }, {
            renderer: canvasRenderer,
            style: function() {
                return {
                    color: '#f1c40f',
                    weight: 2,
                    fillColor: '#f4d03f',
                    fillOpacity: 0.35,
                    interactive: true
                };
            },
            pointToLayer: function(feature, latlng) {
                return L.circleMarker(latlng, {
                    renderer: canvasRenderer,
                    radius: 7,
                    color: '#fff',
                    weight: 2,
                    fillColor: '#f1c40f',
                    fillOpacity: 0.85,
                    interactive: true
                });
            },
            onEachFeature: function(feature, layer) {
                const p = feature.properties;
                layer.bindPopup('<div style="padding:6px; text-align:center;"><b>' + escapeHtml(p.name) + '</b><br><span style="font-size:11px; color:#64748b;">' + escapeHtml(p.type) + '</span></div>');
                layer.bindTooltip(p.name, {
                    permanent: false,
                    direction: 'top',
                    className: 'safetyzone-tooltip'
                });
            }
        });

        currentRenderedRegion = regionCode;

        if (window.map) {
            safetyZoneLayer.addTo(window.map);
        }
        
    } catch (e) {
        console.error("보호구역 로딩 오류:", e);
        alert("보호구역 데이터를 가져오는데 실패했습니다: " + e.message);
        const btn = document.getElementById('btn-safety-zone');
        if (btn) btn.classList.remove('active');
        isSafetyZoneVisible = false;
    }
    
    if (typeof hideLoading === 'function') hideLoading();
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}