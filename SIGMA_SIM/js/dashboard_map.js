/**
 * 대시보드 내 지도시각화 (Seoul GeoJSON) 관련 로직
 */
var dashMap = null;
var dashGeoLayer = null;

/** 대시보드 지도 초기화 */
function initDashboardMap() {
    if (dashMap) return; // 이미 초기화됨

    const container = document.getElementById('dash-map-container');
    if (!container) return;

    // 대시보드용 Leaflet 인스턴스 생성 (다크 테마 타일 제외하고 벡터 중심)
    dashMap = L.map('dash-map-container', {
        zoomControl: false,
        attributionControl: false,
        dragging: true,
        scrollWheelZoom: true,
        doubleClickZoom: false
    }).setView([37.5665, 126.9780], 11);

    // 타일 레이어 (아주 어두운 스타일)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19
    }).addTo(dashMap);

    // Seoul_polygon.geojson 로드 시도
    loadSeoulGeoJSON();

    // [New] 외부에서 GeoJSON이 갱신되었을 때 대시보드 지도도 즉시 업데이트하도록 리스너 추가
    window.addEventListener('sigmaGeoJSONUpdated', function (e) {
        if (e.detail) renderDashGeoJSON(e.detail);
    });
}

/** 서울 폴리곤 GeoJSON 로드 및 렌더링 */
function loadSeoulGeoJSON() {
    // 1. 브라우저 저장소(localStorage)에 저장된 캐시 데이터 확인 (로컬 실행 시 최적)
    const cachedData = localStorage.getItem('SIGMA_SEOUL_GEOJSON');
    if (cachedData) {
        try {
            const geoData = JSON.parse(cachedData);
            renderDashGeoJSON(geoData);
            return; // 캐시 로드 성공 시 종료
        } catch (e) {
            console.error("캐시 데이터 파싱 실패", e);
        }
    }

    // 2. 캐시가 없으면 서버 fetch 시도 (http 환경)
    const fileName = "Seoul_polygon_4326.geojson";
    fetch(fileName)
        .then(res => {
            if (!res.ok) throw new Error("File not found");
            return res.json();
        })
        .then(data => {
            renderDashGeoJSON(data);
        })
        .catch(err => {
            console.error("GeoJSON 로드 실패:", err);
            // 최후의 안내 (로컬 실행 시)
            if (window.location.protocol === 'file:') {
                console.warn("대시보드 지도 안내: 메인 화면의 '배경도 로드(GeoJSON)' 버튼을 통해 파일을 한 번 로드해 주시면 대시보드에도 자동으로 나타납니다.");
            }
        });
}

/** GeoJSON 데이터 렌더링 */
function renderDashGeoJSON(geoData) {
    if (!dashMap) return;
    if (dashGeoLayer) dashMap.removeLayer(dashGeoLayer);

    dashGeoLayer = L.geoJSON(geoData, {
        style: function (feature) {
            // [Style] 알록달록한 색상을 배제하고 전문적인 단일 다크 블루/사이언 테마 적용
            return {
                fillColor: '#00d4ff', // 단일색 테마
                fillOpacity: 0.15,    // 배경처럼 얇게
                color: 'rgba(0, 212, 255, 0.4)', // 경계선 강조
                weight: 1.5,
            };
        },
        onEachFeature: function (feature, layer) {
            // 툴팁: 구 이름 표시
            if (feature.properties && feature.properties.SIG_KOR_NM) {
                layer.bindTooltip("<b>" + feature.properties.SIG_KOR_NM + "</b>", {
                    permanent: true,
                    direction: 'center',
                    className: 'dash-map-label'
                });
            }

            layer.on('mouseover', function () {
                this.setStyle({ fillOpacity: 0.4, weight: 2, color: '#fff' });
            });
            layer.on('mouseout', function () {
                // [Fix] 초기 스타일 수치로 정확히 복원
                this.setStyle({ fillOpacity: 0.15, weight: 1.5, color: 'rgba(0, 212, 255, 0.4)' });
            });
        }
    }).addTo(dashMap);

    // 지도 범위 맞춤 (여백 최소화하여 더 넓게 표시)
    const bounds = dashGeoLayer.getBounds();
    if (bounds.isValid()) dashMap.fitBounds(bounds, { padding: [5, 5] });
}

/** 대시보드 교차로 위치 마커 표시 (중앙 지도용) */
function syncJunctionsToDashMap() {
    if (!dashMap) return;

    // 기존 마커 제거
    dashMap.eachLayer(layer => {
        if (layer instanceof L.CircleMarker) dashMap.removeLayer(layer);
    });

    const junctions = (typeof STATE !== 'undefined' && STATE.junctions) ? Object.values(STATE.junctions) : [];
    junctions.forEach(j => {
        L.circleMarker([j.lat, j.lng], {
            radius: 1.5, // [Min] 노드 크기 최소화
            fillColor: '#00ff88',
            color: '#fff',
            weight: 0.5,
            fillOpacity: 1
        }).addTo(dashMap).bindPopup(`
            <div style="text-align:center;">
                <div style="margin-bottom:8px; font-weight:bold; font-size:12px;">${j.name} (${j.id})</div>
                <button class="btn-sm" style="background:#38bdf8; color:#000; padding:5px 12px; border:none; border-radius:4px; font-weight:bold; cursor:pointer; width:100%;" onclick="STATE.activeJid='${j.id}'; openDetailOverlay('${j.id}');">상세보기</button>
            </div>
        `);
    });
}

/** [신규] 행정경계 데이터 처리 핸들러 */
function processPolyData(data) {
    if (!data) return;
    try {
        let geoData = data;
        if (typeof data === 'string') geoData = JSON.parse(data);
        
        // 메인 지도시각화 갱신
        renderDashGeoJSON(geoData);
        
        // 전역 상태 저장 (필요 시)
        if (typeof STATE !== 'undefined') STATE.polyData = geoData;
        
        console.log("[Poly] Administrative boundary data processed and rendered.");
        alert("행정경계 데이터가 지도에 반영되었습니다.");
    } catch(e) {
        console.error("[Poly] Error processing data:", e);
        alert("행정경계 데이터 처리 중 오류가 발생했습니다.");
    }
}

/** [신규] 행정경계 데이터 초기화 */
function clearPolyData() {
    if (dashGeoLayer && dashMap) {
        dashMap.removeLayer(dashGeoLayer);
        dashGeoLayer = null;
    }
    if (typeof STATE !== 'undefined') delete STATE.polyData;
    console.log("[Poly] Administrative boundary data cleared.");
}

