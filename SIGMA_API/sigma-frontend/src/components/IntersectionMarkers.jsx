import React, { useEffect, useState, useRef } from 'react';
import { CircleMarker, Tooltip, Popup, useMap } from 'react-leaflet';

// [1] 마커 최적화 렌더링 및 클릭 이벤트
const IntersectionMarkerItem = React.memo(function IntersectionMarkerItem({ intersection, isSelected, baseColor, showTooltip, onDetailClick, onNodeClick }) {
  const markerRef = useRef(null);
  const map = useMap();

  return (
    <CircleMarker
      ref={markerRef}
      center={[intersection.y_coord, intersection.x_coord]}
      radius={isSelected ? 11 : 6}
      fillColor={isSelected ? "#38bdf8" : baseColor}
      color={isSelected ? "#fff" : "#334155"}
      weight={isSelected ? 3 : 2}
      fillOpacity={0.8}
      eventHandlers={{
        click: (e) => {
          if (onNodeClick) {
            onNodeClick(intersection.id);
          }
        },
        popupopen: (e) => {
          if (onNodeClick) {
            onNodeClick(intersection.id);
          }
        }
      }}
    >
      {showTooltip && (
        <Tooltip direction="top" offset={[0, -10]} permanent interactive={true} className="map-label">
          <div>
            {intersection.int_nm}
          </div>
        </Tooltip>
      )}
      
      <Popup className="custom-popup" closeButton={true}>
        <div className="popup-content">
          <h3>
            {intersection.int_nm}
          </h3>
          <div style={{display:'flex', flexDirection:'column', gap:'5px', marginTop:'10px'}}>
            <button className="btn-detail" onClick={(e) => {
              e.stopPropagation();
              onDetailClick(intersection);
              map.closePopup();
            }}>상세보기</button>
          </div>
        </div>
      </Popup>
    </CircleMarker>
  );
});

// 지도 컨테이너 크기 변경 감지 및 자동 리사이즈 컴포넌트
export function MapAutoResizer() {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    const resizeObserver = new ResizeObserver(() => {
      window.requestAnimationFrame(() => {
        map.invalidateSize();
      });
    });
    resizeObserver.observe(map.getContainer());
    return () => resizeObserver.disconnect();
  }, [map]);
  return null;
}

export default function IntersectionMarkers({ intersections, onDetailClick, targetId, activeTab, seoulActiveIds, showMapNames, onNodeClick, uticOpenRegions }) {
  const map = useMap();
  const [zoomLevel, setZoomLevel] = useState(map.getZoom());
  const [bounds, setBounds] = useState(map.getBounds());

  useEffect(() => {
    const updateMapState = () => {
      setZoomLevel(map.getZoom());
      setBounds(map.getBounds());
    };
    map.on('zoomend moveend', updateMapState);
    return () => map.off('zoomend moveend', updateMapState);
  }, [map]);

  const visibleIntersections = intersections.filter(intersection => {
    if (!intersection.y_coord || !intersection.x_coord) return false;
    
    // 탭에 따른 필터링 (activeTab이 null이면 모두 숨김)
    if (!activeTab) return false;
    const isSeoul = intersection.origin_type?.toLowerCase().includes('tdata');
    if (activeTab === 'tdata' && !isSeoul) return false;
    
    // UTIC 탭인 경우
    if (activeTab === 'utic') {
      if (isSeoul) return false; // 서울 TDATA 제외
      
      // UTIC 지역 필터링 (열려있는 지역만 표시)
      const rCode = intersection.region_cd || '기타';
      const isOpen = Object.keys(uticOpenRegions || {}).some(key => key.startsWith(rCode) && uticOpenRegions[key]);
      
      if (!isOpen) {
        return false;
      }
    }

    return true;
  });

  const intersectionsInBounds = bounds ? visibleIntersections.filter(intersection => 
    bounds.contains([intersection.y_coord, intersection.x_coord])
  ) : visibleIntersections;

  const showTooltip = intersectionsInBounds.length <= 100;

  return (
    <>
      {intersectionsInBounds.map((intersection) => {
        const isSelected = intersection.id === targetId;
        const isSeoul = intersection.origin_type?.toLowerCase().includes('tdata');
        
        const isUticActive = window.UTIC_SPAT_MAP && window.UTIC_SPAT_MAP[intersection.int_no] && window.UTIC_SPAT_MAP[intersection.int_no].opMode === '수신';
        const isSeoulActive = seoulActiveIds && seoulActiveIds.includes(String(intersection.int_no));
        
        let baseColor = "#64748b"; // 기본 회색
        const hasSeoulSpat = window.SEOUL_SPAT_MAP && window.SEOUL_SPAT_MAP[String(intersection.int_no)];
        if (isSeoul) {
          baseColor = (hasSeoulSpat || isSeoulActive) ? "#3b82f6" : "#64748b"; // 서울Tdata 실시간 데이터 수신 시 파란색, 미수신 시 회색
        } else {
          if (isUticActive) baseColor = "#3b82f6"; // UTIC 수신 시 파란색
        }
        
        return (
          <IntersectionMarkerItem
            key={intersection.id}
            intersection={intersection}
            isSelected={isSelected}
            baseColor={baseColor}
            showTooltip={(showTooltip && showMapNames) || isSelected}
            onDetailClick={onDetailClick}
            onNodeClick={onNodeClick}
          />
        );
      })}
    </>
  );
}
