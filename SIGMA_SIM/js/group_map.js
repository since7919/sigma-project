/* SIGMA_SIM Group Map Rendering Functions */

function highlightGroupMembers(members) {
    groupHighlightMarkers.forEach(m => map.removeLayer(m));
    groupHighlightMarkers = [];
    if (!members || members.length === 0) return;

    const latlngs = [];
    members.forEach(j => {
        // [수정] 시공도 포함 여부(체크박스) 확인. 제외된 경우 하이라이트와 순서 번호 생략
        const isExcluded = (j.extra && j.extra.excludeFromTsd === true);
        
        if (!isExcluded) {
            // 1. 하이라이트 원형 마커
            const hMarker = L.circleMarker([j.lat, j.lng], {
                radius: 15,
                color: '#00d4ff',
                weight: 3,
                fillColor: '#00d4ff',
                fillOpacity: 0.15,
                interactive: false,
                className: 'neon-pulse'
            }).addTo(map);
            groupHighlightMarkers.push(hMarker);

            // 2. 도면 순서 번호 표시 (있을 경우만)
            const diagOrder = (j.extra && j.extra.diagramOrder !== undefined) ? j.extra.diagramOrder : -1;
            if (diagOrder !== -1) {
                const seqIcon = L.divIcon({
                    className: 'group-seq-marker',
                    html: `<div style="background:var(--accent); color:#000; font-weight:bold; font-size:11px; border-radius:50%; width:18px; height:18px; display:flex; align-items:center; justify-content:center; border:1px solid #fff; box-shadow:0 0 5px rgba(0,0,0,0.5);">${diagOrder}</div>`,
                    iconSize: [18, 18],
                    iconAnchor: [9, 9]
                });
                const sMarker = L.marker([j.lat, j.lng], { icon: seqIcon, interactive: false, zIndexOffset: 1500 }).addTo(map);
                groupHighlightMarkers.push(sMarker);
            }
            // 3. 교차로 명칭 표시 (사용자 요청: 선택된 그룹은 이름 상시 노출)
            const nameIcon = L.divIcon({
                className: 'group-name-marker',
                html: `<div style="color:var(--accent); font-weight:700; font-size:12px; text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000, 0 0 8px rgba(0,0,0,0.8); white-space:nowrap; margin-top:22px; text-align:center; transform:translateX(-50%);">${j.name || j.id}</div>`,
                iconSize: [0, 0],
                iconAnchor: [0, 0]
            });
            const nMarker = L.marker([j.lat, j.lng], { icon: nameIcon, interactive: false, zIndexOffset: 1500 }).addTo(map);
            groupHighlightMarkers.push(nMarker);
        }
        
        // 지도의 자동 줌(Bounds) 범위에는 포함
        latlngs.push([j.lat, j.lng]);
    });

    if (latlngs.length > 0) {
        const bounds = L.latLngBounds(latlngs);
        // [사용자 요청] 이동 속도 단축 (duration: 0.8)
        map.flyToBounds(bounds, { padding: [100, 100], maxZoom: 16, duration: 0.8 });
    }
}

function clearHighlightGroupMembers() {
    groupHighlightMarkers.forEach(m => map.removeLayer(m));
    groupHighlightMarkers = [];
}

