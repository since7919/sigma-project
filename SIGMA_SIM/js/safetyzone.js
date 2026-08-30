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
        
        items.forEach(item => {
            if (!item) return;
            const lat = parseFloat(item.lat || item.latitude || item.y || item.Y);
            const lng = parseFloat(item.lng || item.longitude || item.lon || item.x || item.X);
            
            if (!isNaN(lat) && !isNaN(lng)) {
                const name = item.fac_name || item.name || item.소재지지번주소 || item.spt_nm || item.fcltyNm || "보호구역";
                const type = item.spt_se || "보호구역";
                let layerToAdd;
                
                if (item.geojson) {
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
