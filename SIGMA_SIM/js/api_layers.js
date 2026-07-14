/**
 * api_layers.js
 * 시뮬레이터 지도 위에 외부 API 교차로(T-Data, UTIC)를 오버레이로 표시하는 모듈
 */

const ApiLayers = {
    layers: {
        utic: L.layerGroup()
    },
    state: {
        utic: false
    },
    loadedRegion: null,

    styles: {
        utic: {
            color: '#27ae60',
            fillColor: '#27ae60',
            fillOpacity: 0.8,
            radius: 5,
            weight: 2
        }
    },

    async toggleLayer(type) {
        const isEnabled = !this.state[type];
        this.state[type] = isEnabled;
        
        // 버튼 스타일 업데이트
        const btn = document.getElementById(`btn-layer-${type}`);
        if (btn) {
            if (isEnabled) {
                btn.classList.add('active');
                btn.style.boxShadow = '0 0 10px #00d4ff'; // 네온 효과 활성화
            } else {
                btn.classList.remove('active');
                btn.style.boxShadow = 'none';
            }
        }

        const currentRegion = document.getElementById('api-region-select').value;

        if (isEnabled) {
            // 다른 지역이 로드된 상태이거나 처음 로드하는 경우 데이터 새로고침
            if (this.loadedRegion !== currentRegion) {
                await this.loadDataForRegion(currentRegion);
            }
            this.layers[type].addTo(map);
        } else {
            map.removeLayer(this.layers[type]);
        }
    },

    async loadDataForRegion(regionCode) {
        console.log(`[ApiLayers] Fetching API intersections for region ${regionCode}...`);
        
        // 기존 마커 초기화
        this.layers.utic.clearLayers();
        this.loadedRegion = regionCode;

        try {
            const response = await fetch(`/api/intersections?regionCode=${regionCode}`);
            if (!response.ok) throw new Error('API request failed');
            const data = await response.json();

            data.forEach(j => {
                // 서울은 DB에 '서울tdata'로 저장되어 있으므로 함께 UTIC 레이어에 포함시킵니다.
                if ((j.origin_type === 'UTIC' || j.origin_type === '서울tdata') && j.y_coord && j.x_coord) {
                    const marker = L.marker([parseFloat(j.y_coord), parseFloat(j.x_coord)], {
                        icon: L.divIcon({
                            className: 'utic-icon-custom',
                            html: `<div style="background-color: #9b59b6; color: white; border: 2px solid #fff; border-radius: 6px; padding: 3px 6px; font-size: 11px; font-weight: 800; box-shadow: 0 0 10px #9b59b6; white-space: nowrap; transform: translate(-50%, -50%);">UTIC</div>`,
                            iconSize: [0, 0],
                            iconAnchor: [0, 0]
                        }),
                        pane: 'markerPane'
                    });

                    marker.bindTooltip(`
                        <div style="font-family:'Pretendard', sans-serif; font-size:12px;">
                            <strong>${j.int_nm || '명칭없음'}</strong><br/>
                            ID: ${j.int_no}<br/>
                            출처: ${j.origin_type}
                        </div>
                    `, { direction: 'top', offset: [0, -10] });

                    this.layers.utic.addLayer(marker);
                }
            });

            console.log(`[ApiLayers] Loaded ${this.layers.utic.getLayers().length} UTIC markers.`);
        } catch (err) {
            console.error('[ApiLayers] Error loading API data:', err);
            alert('외부 교차로 데이터를 불러오는 중 오류가 발생했습니다.');
        }
    },

    // 지역이 변경되었을 때 켜져있는 레이어가 있다면 새로고침
    onRegionChanged(newRegionCode) {
        if (this.loadedRegion !== newRegionCode) {
            this.loadedRegion = null; // 초기화 처리
            this.layers.utic.clearLayers();
            
            // 만약 레이어가 켜져있다면 다시 로드
            if (this.state.utic) {
                this.loadDataForRegion(newRegionCode).then(() => {
                    if (!this.state.utic) map.removeLayer(this.layers.utic);
                });
            }
        }
    }
};

// Global Exposure
window.toggleApiLayer = (type) => ApiLayers.toggleLayer(type);
window.ApiLayers = ApiLayers;
