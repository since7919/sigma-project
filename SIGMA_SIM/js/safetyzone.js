let safetyZoneLayer = null;
let isSafetyZoneVisible = false;

async function toggleSafetyZone() {
    isSafetyZoneVisible = !isSafetyZoneVisible;
    const btn = document.getElementById('btn-safety-zone');
    
    if (!isSafetyZoneVisible) {
        btn.innerHTML = '🚸 보호구역';
        if (safetyZoneLayer && window.map) {
            window.map.removeLayer(safetyZoneLayer);
        }
        return;
    }
    
    btn.innerHTML = '🚸 보호구역 <span style="color:#10b981; font-weight:bold;">● On</span>';
    
    if (!safetyZoneLayer) {
        await fetchAndDrawSafetyZones();
    } else {
        if (window.map) {
            safetyZoneLayer.addTo(window.map);
        }
    }
}

async function fetchAndDrawSafetyZones() {
    if (typeof showLoading === 'function') showLoading("보호구역 데이터 로딩 중 (최적화 모드)...");
    
    try {
        const response = await fetch('/api/sim/safetyzone');
        if (!response.ok) throw new Error("API 요청 실패: " + response.status);
        
        const text = await response.text();
        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            console.error("JSON 파싱 오류:", text);
            throw new Error("API 서버에서 올바른 JSON 데이터를 반환하지 않았습니다.");
        }
        
        let items = data.items || (Array.isArray(data) ? data : [data]);
        
        if (items.length === 0 || items[0] == null) {
            alert("조회된 보호구역 데이터가 없습니다.");
            if (typeof hideLoading === 'function') hideLoading();
            const btn = document.getElementById('btn-safety-zone');
            btn.innerHTML = '🚸 보호구역';
            isSafetyZoneVisible = false;
            return;
        }
        
        // 1. 단일 FeatureCollection으로 통합 (성능 대폭 향상)
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
                
                // 속성 병합
                if (parsedGeo.type === 'FeatureCollection' && Array.isArray(parsedGeo.features)) {
                    parsedGeo.features.forEach(f => {
                        f.properties = { ...f.properties, name, type };
                        features.push(f);
                    });
                } else if (parsedGeo.type === 'Feature') {
                    parsedGeo.properties = { ...parsedGeo.properties, name, type };
                    features.push(parsedGeo);
                } else if (parsedGeo.type) { // Any geometry type (Polygon, MultiPolygon, Point, etc)
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

        // 2. L.geoJSON 단 한 번 호출 및 무거운 DOM 툴팁 제거
        safetyZoneLayer = L.geoJSON({ type: 'FeatureCollection', features: features }, {
            style: function(feature) {
                return {
                    color: '#e74c3c',
                    weight: 2,
                    fillColor: '#f39c12',
                    fillOpacity: 0.3, interactive: true
                };
            },
            pointToLayer: function(feature, latlng) {
                return L.circleMarker(latlng, {
                    radius: 8,
                    color: '#fff',
                    weight: 2,
                    fillColor: '#f39c12',
                    fillOpacity: 0.8,
                    interactive: true,
                    pane: 'markerPane'
                });
            },
            onEachFeature: function(feature, layer) {
                const p = feature.properties;
                // 클릭 시에만 팝업 표시 (DOM 요소 최소화)
                layer.bindPopup('<div style="padding:5px; text-align:center;"><b>' + p.name + '</b><br><span style="font-size:11px; color:#555;">' + p.type + '</span></div>');
                
                // 마우스 오버 시에만 툴팁 (permanent: false 로 변경하여 렌더링 부하 99% 제거)
                layer.bindTooltip(p.name, {
                    permanent: false,
                    direction: 'top',
                    className: 'safetyzone-tooltip'
                });
            }
        });

        if (window.map) {
            safetyZoneLayer.addTo(window.map);
        }
        
    } catch (e) {
        console.error("보호구역 로딩 오류:", e);
        alert("보호구역 데이터를 가져오는데 실패했습니다: " + e.message);
        const btn = document.getElementById('btn-safety-zone');
        btn.innerHTML = '🚸 보호구역';
        isSafetyZoneVisible = false;
    }
    
    if (typeof hideLoading === 'function') hideLoading();
}