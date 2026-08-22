/**
 * map.js
 * ─────────────────────────────────────────────
 * Leaflet 지도 초기화, 타일 레이어, 테마 전환,
 * GeoJSON 스타일, 지도 편집 모드
 * 의존: config.js, utils.js, ui.js
 */

/* ══════════════════════════════════════════
 *  지도 초기화 (Canvas 최적화 활성화)
 * ══════════════════════════════════════════ */
const map = L.map('map', { zoomControl: false, maxZoom: 22, preferCanvas: true, boxZoom: false }).setView(CONFIG.DEFAULT_LATLNG, 18);
window.map = map; // [중요] 전역 객체 명시적 할당 (t.addLayer 에러 방지)
const darkLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 22, maxNativeZoom: 20 });
const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 22, maxNativeZoom: 19 });
const grayLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { maxZoom: 22, maxNativeZoom: 20 });

darkLayer.addTo(map);

// 민원 전용 레이어(Pane) 생성 - zIndex를 매우 높게 설정하여 노드/화살표보다 항상 위에 오도록 함
if (!map.getPane('civil-pane')) {
    map.createPane('civil-pane');
    map.getPane('civil-pane').style.zIndex = 1000; // 기본 markerPane(600)보다 상층
    map.getPane('civil-pane').style.pointerEvents = 'auto'; // 클릭 이벤트 허용
}

/* ══════════════════════════════════════════
 *  테마 전환
 * ══════════════════════════════════════════ */
function toggleMapTheme() {
    if (STATE.currentTheme === 'dark') {
        map.removeLayer(darkLayer);
        grayLayer.addTo(map);
        STATE.currentTheme = 'gray';
        UI.btnMapTheme.innerHTML = '🗺️ OSM(Gray)';
        UI.btnMapTheme.classList.add('on');
    } else if (STATE.currentTheme === 'gray') {
        map.removeLayer(grayLayer);
        STATE.currentTheme = 'none';
        UI.btnMapTheme.innerHTML = '🗺️ OSM(Off)';
        UI.btnMapTheme.classList.remove('on');
        UI.btnMapTheme.style.borderColor = 'rgba(255,255,255,0.1)';
    } else {
        darkLayer.addTo(map);
        STATE.currentTheme = 'dark';
        UI.btnMapTheme.innerHTML = '🗺️ OSM(Black)';
        UI.btnMapTheme.classList.add('on');
        UI.btnMapTheme.style.borderColor = 'var(--accent)';
    }
    updateGeoJsonStyle();
}

/* ══════════════════════════════════════════
 *  GeoJSON 스타일
 * ══════════════════════════════════════════ */
function updateGeoJsonStyle() {
    if (!STATE.geoJsonLayer) return;
    const isNone = (STATE.currentTheme === 'none');
    STATE.geoJsonLayer.setStyle({
        color: isNone ? "#00d4ff" : "var(--accent)",
        weight: isNone ? 2 : 1.2,
        opacity: isNone ? 0.8 : 0.4,
        fillOpacity: isNone ? 0.2 : 0.08
    });
    STATE.geoJsonLayer.bringToBack();
}

/* ══════════════════════════════════════════
 *  지도 편집 모드
 * ══════════════════════════════════════════ */
function toggleMapEdit() {
    if (STATE.appMode === CONFIG.APP_MODE.MAP_EDIT) {
        AppStateMachine.setMode(CONFIG.APP_MODE.SELECT);
        if (typeof applyInfo === 'function') applyInfo();
        alert("편집이 완료되어 변경사항이 적용되었습니다.");
    } else {
        if (STATE.simTimer) pauseSim();
        AppStateMachine.setMode(CONFIG.APP_MODE.MAP_EDIT);
        alert("교차로 및 신호등 위치 편집 모드가 활성화되었습니다.\n" +
            "1. [우클릭+드래그] : 모든 신호등의 회전\n" +
            "2. [좌클릭+드래그] : 신호등 위치 이동\n" +
            "3. [Ctrl+왼클릭]  : 신호등 복사\n" +
            "4. [더블클릭+우클릭 드래그]: 개별 신호등 회전");
    }
}

/* ══════════════════════════════════════════
 *  지도 클릭 이벤트 (교차로 추가)
 * ══════════════════════════════════════════ */
function initMapClickHandlers() {
    map.on('click', (e) => {
        if (STATE.appMode === CONFIG.APP_MODE.ADD_NODE) {
            const jid = 'J-' + Date.now().toString().slice(-4);
            const cache = JSON.parse(JSON.stringify(DEFAULT_PLAN_CACHE));
            const map0 = cache.signalMaps[0];

            STATE.junctions[jid] = {
                id: jid, name: '새 교차로', seq: '0', police: '서초서', office: '서초구',
                lat: e.latlng.lat, lng: e.latlng.lng,
                dayPlans: cache.dayPlans,
                schedules: cache.schedules,
                signalMaps: cache.signalMaps,
                // 호환성용 루트 필드 동기화
                movA: [...map0.movA], movB: [...map0.movB],
                pedMovA: [...map0.pedMovA], pedMovB: [...map0.pedMovB],
                mainMovements: [...map0.mainMovements],
                marker: null, arrows: {}, arrowConfigs: {},
                flashEnable: false, flashTimes: [],
                flashYellows: [], flashReds: [],
                opIntervention: { enable: false, rows: [] }
            };
            drawJunction(jid); selectJunction(jid);
            AppStateMachine.setMode(CONFIG.APP_MODE.SELECT); // 추가 후 기본 모드로 복귀
        } else {
            // [New] 지도 클릭 시 연동 그룹 선택 해제
            if (STATE.highlightedGroupId !== null) {
                STATE.highlightedGroupId = null;
                if (STATE.geoJsonLayer) STATE.geoJsonLayer.setStyle({});
            }

            // [복구] 지도 빈 공간 클릭 시 선택된 교차로 해제
            if (STATE.activeJid && STATE.appMode === CONFIG.APP_MODE.SELECT) deselectJunction();
        }
    });

    map.on('dblclick', () => {
        if (STATE.highlightedGroupId !== null) {
            STATE.highlightedGroupId = null;
            if (STATE.geoJsonLayer) STATE.geoJsonLayer.setStyle({});
        }
        if (STATE.activeJid && !STATE.isMapEditMode) deselectJunction();
    });

    map.doubleClickZoom.disable();
}

/* ══════════════════════════════════════════
 *  뷰포트 변경 시 화살표/툴팁 갱신
 * ══════════════════════════════════════════ */
function initMapMoveHandlers() {
    map.on('moveend zoomend', () => {
        refreshVisibleArrows();
        const zoomIndicator = document.getElementById('zoom-indicator');
        if (zoomIndicator) {
            zoomIndicator.innerHTML = `🔍 줌 레벨: ${map.getZoom()}`;
        }
    });
}

