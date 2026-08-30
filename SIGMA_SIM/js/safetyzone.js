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
        safetyZoneLayer = L.layerGroup();
        await fetchAndDrawSafetyZones();
    } else {
        if (window.map) {
            safetyZoneLayer.addTo(window.map);
            
            // 줌 레벨에 따라 툴팁 표시/숨김
            const updateTooltips = () => {
                const z = window.map.getZoom();
                const tooltips = document.querySelectorAll('.safetyzone-tooltip');
                tooltips.forEach(t => {
                    t.style.visibility = z >= 16 ? 'visible' : 'hidden';
                });
            };
            window.map.on('zoomend', updateTooltips);
            updateTooltips(); // 초기 설정
        }
    }
}

async function fetchAndDrawSafetyZones() {
    if (typeof showLoading === 'function') showLoading("보호구역 데이터 로딩 중...");
    
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
        
        let items = [];
        if (data && data.items) {
            items = data.items;
        } else if (Array.isArray(data)) {
            items = data;
        }
        
        if (!Array.isArray(items)) {
            items = [items];
        }
        
        if (items.length === 0 || items[0] == null) {
            alert("조회된 보호구역 데이터가 없습니다. (API 서버 응답 없음 또는 데이터 없음)");
            if (typeof hideLoading === 'function') hideLoading();
            
            const btn = document.getElementById('btn-safety-zone');
            btn.innerHTML = '🚸 보호구역';
            isSafetyZoneVisible = false;
            return;
        }
        
        const circleIcon = L.divIcon({
            className: 'safety-zone-marker',
            html: '<div style="width:24px; height:24px; background-color:rgba(255,165,0,0.8); border:2px solid #fff; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:12px; box-shadow: 0 2px 5px rgba(0,0,0,0.3);">🚸</div>',
            iconSize: [24, 24],
            iconAnchor: [12, 12]
        });

        items.forEach(item => {
            if (!item) return;
            const lat = parseFloat(item.lat || item.latitude || item.y || item.Y);
            const lng = parseFloat(item.lng || item.longitude || item.lon || item.x || item.X);
            
            const hasCoords = !isNaN(lat) && !isNaN(lng);
            const hasGeojson = !!item.geojson;
            
            if (hasCoords || hasGeojson) {
                const name = item.trgtFcltNm || item.fac_name || item.name || item.소재지지번주소 || item.spt_nm || item.fcltyNm || "보호구역";
                
                // typeMap이 있는지 체크, 없으면 기본값
                let type = "보호구역";
                if (item.fcltTypeCd && typeof typeMap !== 'undefined' && typeMap[item.fcltTypeCd]) {
                    type = typeMap[item.fcltTypeCd];
                } else if (item.spt_se) {
                    type = item.spt_se;
                }
                
                let layerToAdd;
                
                if (hasGeojson) {
                    layerToAdd = L.geoJSON(item.geojson, {
                        style: {
                            color: '#e74c3c',
                            weight: 2,
                            fillColor: '#f39c12',
                            fillOpacity: 0.2
                        },
                        pointToLayer: function (feature, latlng) {
                            return L.marker(latlng, { icon: circleIcon });
                        }
                    });
                } else {
                    layerToAdd = L.marker([lat, lng], { icon: circleIcon });
                }

                layerToAdd.bindPopup('<div style="padding:5px; text-align:center;"><b>' + name + '</b><br><span style="font-size:11px; color:#555;">' + type + '</span></div>');
                
                layerToAdd.bindTooltip(name, {
                    permanent: true,
                    direction: 'center',
                    className: 'safetyzone-tooltip'
                });
                
                safetyZoneLayer.addLayer(layerToAdd);
            }
        });
        
        if (window.map) {
            safetyZoneLayer.addTo(window.map);
        }
        
    } catch (e) {
        console.error("보호구역 로딩 오류:", e);
        alert("보호구역 데이터를 가져오는데 실패했습니다: " + e.message + "\\n\\n(공공데이터포털 API가 변경되었거나 접근 권한이 없을 수 있습니다.)");
        
        const btn = document.getElementById('btn-safety-zone');
        btn.innerHTML = '🚸 보호구역';
        isSafetyZoneVisible = false;
    }
    
    if (typeof hideLoading === 'function') hideLoading();
}
