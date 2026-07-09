import React, { useEffect, useState, useRef } from 'react';
import { CircleMarker, Tooltip, Popup, useMap } from 'react-leaflet';

// [1] 마커 최적화 렌더링 및 클릭 이벤트
const IntersectionMarkerItem = React.memo(function IntersectionMarkerItem({ intersection, isSelected, baseColor, showTooltip, onDetailClick, onMultiClick, activeMapSignalIds, onMapSignalToggle, onNodeClick }) {
  const markerRef = useRef(null);
  const map = useMap();

  useEffect(() => {
    if (markerRef.current) {
      const el = markerRef.current.getElement();
      if (el) {
        el.setAttribute('draggable', 'true');
        el.style.pointerEvents = 'auto';
        el.style.cursor = 'grab';
        
        const handleDragStart = (e) => {
          map.dragging.disable();
          e.dataTransfer.setData('application/json', JSON.stringify(intersection));
        };
        
        const handleDragEnd = (e) => {
          map.dragging.enable();
        };
        
        el.addEventListener('dragstart', handleDragStart);
        el.addEventListener('dragend', handleDragEnd);
        return () => {
          el.removeEventListener('dragstart', handleDragStart);
          el.removeEventListener('dragend', handleDragEnd);
        };
      }
    }
  }, [intersection, map]);

  // 지도상 오버레이 활성화 여부
  const isSignalOverlayActive = activeMapSignalIds && activeMapSignalIds.includes(intersection.id);

  return (
    <CircleMarker
      ref={markerRef}
      center={[intersection.y_coord, intersection.x_coord]}
      radius={isSelected ? 11 : (isSignalOverlayActive ? 9 : 6)}
      fillColor={isSelected ? "#38bdf8" : (isSignalOverlayActive ? "#10b981" : baseColor)}
      color={isSelected ? "#fff" : (isSignalOverlayActive ? "#fff" : "#334155")}
      weight={isSelected ? 3 : (isSignalOverlayActive ? 2.5 : 2)}
      fillOpacity={0.8}
      eventHandlers={{
        click: (e) => {
          // 쉬프트 좌클릭인 경우 -> 지도상 신호 표출 토글
          if (e.originalEvent && e.originalEvent.shiftKey) {
            e.originalEvent.preventDefault();
            e.originalEvent.stopPropagation();
            if (onMapSignalToggle) {
              onMapSignalToggle(intersection.id);
            }
          } else {
            if (onNodeClick) {
              onNodeClick(intersection.id);
            }
          }
        },
        popupopen: (e) => {
          // 팝업이 열릴 때 쉬프트 클릭인 경우 강제로 닫음
          if (e.target._map.originalEvent && e.target._map.originalEvent.shiftKey) {
            e.target.closePopup();
          } else {
            if (onNodeClick) {
              onNodeClick(intersection.id);
            }
          }
        }
      }}
      onClick={(e) => {
        if (e.originalEvent && e.originalEvent.shiftKey) {
          e.originalEvent.preventDefault();
          e.originalEvent.stopPropagation();
        }
      }}
    >
      {showTooltip && (
        <Tooltip direction="top" offset={[0, -10]} permanent interactive={true} className="map-label">
          <div 
            draggable={true} 
            onDragStart={(e) => {
              e.stopPropagation();
              map.dragging.disable();
              e.dataTransfer.setData('application/json', JSON.stringify(intersection));
            }}
            onDragEnd={() => {
              map.dragging.enable();
            }}
            style={{ cursor: 'grab', display: 'inline-block' }}
          >
            {intersection.int_nm}
          </div>
        </Tooltip>
      )}
      
      {!(window.event && window.event.shiftKey) && (
        <Popup className="custom-popup" closeButton={true}>
          <div className="popup-content">
            <h3 
              draggable={true} 
              onDragStart={(e) => {
                e.stopPropagation();
                map.dragging.disable();
                e.dataTransfer.setData('application/json', JSON.stringify(intersection));
              }}
              onDragEnd={() => {
                map.dragging.enable();
              }}
              style={{ cursor: 'grab' }}
            >
              {intersection.int_nm}
            </h3>
            <div style={{display:'flex', flexDirection:'column', gap:'5px', marginTop:'10px'}}>
              <button className="btn-detail" onClick={(e) => {
                e.stopPropagation();
                onDetailClick(intersection);
                map.closePopup();
              }}>상세보기</button>
              <button className="btn-detail" style={{background:'#10b981', border:'none', padding:'6px 12px', color:'#fff', borderRadius:'4px', cursor:'pointer', fontSize:'0.8rem'}} onClick={(e) => {
                e.stopPropagation();
                onMultiClick(intersection);
                map.closePopup();
              }}>멀티 담기</button>
              <button className="btn-detail" style={{background:'#0284c7', border:'none', padding:'6px 12px', color:'#fff', borderRadius:'4px', cursor:'pointer', fontSize:'0.8rem'}} onClick={(e) => {
                e.stopPropagation();
                if (onMapSignalToggle) onMapSignalToggle(intersection.id);
                map.closePopup();
              }}>
                {isSignalOverlayActive ? '지도 신호 해제' : '지도 신호 표출'}
              </button>
            </div>
          </div>
        </Popup>
      )}
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

export default function IntersectionMarkers({ intersections, onDetailClick, onMultiClick, targetId, uticUpdateTick, activeTab, seoulActiveIds, activeMapSignalIds, onMapSignalToggle, showMapNames, onNodeClick, uticOpenRegions }) {
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
            showTooltip={showTooltip && showMapNames}
            onDetailClick={onDetailClick}
            onMultiClick={onMultiClick}
            activeMapSignalIds={activeMapSignalIds}
            onMapSignalToggle={onMapSignalToggle}
            onNodeClick={onNodeClick}
          />
        );
      })}
    </>
  );
}
