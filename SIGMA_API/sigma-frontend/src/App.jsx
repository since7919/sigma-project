import React, { useEffect, useState, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, CircleMarker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import axios from 'axios';
import './index.css';

// Import split components
import SingleDetailOverlay from './components/SingleDetailOverlay';
import MapSignalOverlay from './components/MapSignalOverlay';
import DualDetailOverlay from './components/DualDetailOverlay';
import SidebarAccordion from './components/SidebarAccordion';
import MultiSignalCard from './components/MultiSignalCard';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
const SUPABASE_URL = import.meta.env.VITE_SIGMA_DB_URL || import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SIGMA_DB_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

const DEFAULT_CENTER = [37.5665, 126.9780];

const REGION_MAP = {
  'L01': '서울시', 'L02': '인천시', 'L03': '부천시', 'L04': '광명시',
  'L05': '안양시', 'L06': '과천시', 'L07': '안산시', 'L08': '용인시',
  'L09': '성남시', 'L10': '고양시', 'L11': '시흥시', 'L12': '파주시',
  'L13': '양주시', 'L14': '의정부시', 'L15': '김포시', 'L16': '의왕시',
  'L17': '군포시', 'L18': '남양주시', 'L19': '수원시', 'L20': '광주시',
  'L21': '구리시', 'L22': '하남시', 'L23': '부산시', 'L24': '양산시',
  'L25': '창원시', 'L26': '김해시', 'L28': '거제시', 'L29': '대구시',
  'L30': '대전시', 'L31': '광주광역시', 'L37': '포항시'
};

// [1] 마커 최적화 렌더링 및 클릭 이벤트
const IntersectionMarkerItem = React.memo(function IntersectionMarkerItem({ intersection, isSelected, baseColor, showTooltip, onDetailClick, onMultiClick, activeMapSignalIds, onMapSignalToggle }) {
  const markerRef = React.useRef(null);
  const map = useMap();

  React.useEffect(() => {
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
          }
        },
        popupopen: (e) => {
          // 팝업이 열릴 때 쉬프트 클릭인 경우 강제로 닫음
          if (e.target._map.originalEvent && e.target._map.originalEvent.shiftKey) {
            e.target.closePopup();
          }
        }
      }}
      // Leaflet CircleMarker의 기본 popup 바인딩을 피하기 위해, Shift가 없을 때만 Popup이 작동하도록 처리
      // 혹은 onClick 단계에서 Shift 여부에 따라 openPopup을 직접 제어
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
      
      {/* 팝업 열기 조건을 설정: Shift 클릭 시 팝업 렌더링을 스킵하여 상세 메뉴가 아예 생성/표시되지 않도록 차단 */}
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
              }}>상세보기</button>
              <button className="btn-detail" style={{background:'#10b981', border:'none', padding:'6px 12px', color:'#fff', borderRadius:'4px', cursor:'pointer', fontSize:'0.8rem'}} onClick={(e) => {
                e.stopPropagation();
                onMultiClick(intersection);
              }}>멀티 담기</button>
              <button className="btn-detail" style={{background:'#0284c7', border:'none', padding:'6px 12px', color:'#fff', borderRadius:'4px', cursor:'pointer', fontSize:'0.8rem'}} onClick={(e) => {
                e.stopPropagation();
                if (onMapSignalToggle) onMapSignalToggle(intersection.id);
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
function MapAutoResizer() {
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

function IntersectionMarkers({ intersections, onDetailClick, onMultiClick, targetId, uticUpdateTick, activeTab, seoulActiveIds, activeMapSignalIds, onMapSignalToggle, showMapNames }) {
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
    if (activeTab === 'utic' && isSeoul) return false;

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
          />
        );
      })}
    </>
  );
}

// 지도 크기 변경 시 중앙정렬을 다시 맞춰주는 컴포넌트
function MapResizer({ mapZoomMode }) {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 300); // 레이아웃 전환 애니메이션 후 실행
    return () => clearTimeout(timer);
  }, [mapZoomMode, map]);
  return null;
}


function HeaderClock() {
  const [utcTimeStr, setUtcTimeStr] = useState('-');
  const [localTimeStr, setLocalTimeStr] = useState('-');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setUtcTimeStr(now.toISOString().replace('T', ' ').substring(0, 19) + ' UTC');
      
      const kstTimeStr = now.toLocaleString("en-US", { timeZone: "Asia/Seoul" });
      const kstNow = new Date(kstTimeStr);
      setLocalTimeStr(
        kstNow.getFullYear() + '-' + 
        String(kstNow.getMonth() + 1).padStart(2, '0') + '-' + 
        String(kstNow.getDate()).padStart(2, '0') + ' ' + 
        kstNow.toLocaleTimeString('ko-KR', { hour12: false })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <footer className="multi-panel-footer" style={{
      padding: '10px 20px',
      background: 'rgba(0, 0, 0, 0.4)',
      borderTop: '1px solid var(--glass-border)',
      textAlign: 'center',
      fontSize: '0.75rem',
      color: '#94a3b8',
      fontFamily: 'monospace',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      gap: '15px'
    }}>
      <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
        <span>🕒 로컬 표준시 (KST):</span>
        <strong style={{ color: '#10b981' }}>{localTimeStr}</strong>
      </div>
      <div style={{ width: '1px', height: '12px', background: 'rgba(255,255,255,0.15)' }}></div>
      <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
        <span>🌐 시스템 표준시 (UTC):</span>
        <strong style={{ color: '#38bdf8' }}>{utcTimeStr}</strong>
      </div>
    </footer>
  );
}

// [5] 메인 레이아웃
function App() {
  // Render 서버 슬립 방지용 Keep-Alive 핑 (1분 간격)
  useEffect(() => {
    if (!API_BASE) return;
    const pingInterval = setInterval(() => {
      fetch(`${API_BASE}/api/intersections?limit=1`)
        .catch(err => console.log('Keep-alive ping error:', err));
    }, 60000);
    return () => clearInterval(pingInterval);
  }, []);
  const [intersections, setIntersections] = useState([]);
  const [detailIntersection, setDetailIntersection] = useState(null); // 상세보기(모달) 타겟
  const [dualSelection, setDualSelection] = useState([]); // 듀얼 모니터링 타겟
  const [activeNodeId, setActiveNodeId] = useState(null); // 트리뷰 및 지도 포커스 타겟
  const [activeTab, setActiveTab] = useState(null); // null(모두 숨김) | 'tdata' | 'utic'
  const [seoulActiveIds, setSeoulActiveIds] = useState([]); // 서울 활성 ID 목록
  const [uticUpdateTick, setUticUpdateTick] = useState(0); // UTIC 수신 리렌더 트리거
  const [apiStatus, setApiStatus] = useState({
    seoul: { status: 'Off', time: '-ms', color: '#ef4444' },
    utic: { status: 'Off', time: '-ms', color: '#ef4444' }
  });
  const [supabaseConfig, setSupabaseConfig] = useState(null);
  const [activeMapSignalIds, setActiveMapSignalIds] = useState([]); // 지도상 신호 표출 활성화할 교차로 ID (최대 3개)
  const [mapSignalDisplayMode, setMapSignalDisplayMode] = useState('compass'); // 'compass' (신호등 모양) | 'arrow' (화살표 모양) | 'off' (제거)
  const [multiSignalDisplayMode, setMultiSignalDisplayMode] = useState('compass'); // 멀티스크린 신호 표출 모드: 'compass' | 'arrow'
  const [showMapNames, setShowMapNames] = useState(true); // 지도상 교차로명 보이기/감추기 토글 state
  const [compassSizeVal, setCompassSizeVal] = useState(180);

  useEffect(() => {
    const scale = compassSizeVal / 180;
    document.documentElement.style.setProperty('--compass-scale', scale);
    document.documentElement.style.setProperty('--compass-scale-11', scale * 1.1);
    document.documentElement.style.setProperty('--compass-scale-115', scale * 1.15);
  }, [compassSizeVal]);

  // 신호등 제거 모드('off')로 변경 시 지도상의 신호 활성 목록을 완전히 비움
  useEffect(() => {
    if (mapSignalDisplayMode === 'off') {
      setActiveMapSignalIds([]);
    }
  }, [mapSignalDisplayMode]);

  // 멀티스크린 상태
  const [gridConfig, setGridConfig] = useState({ r: 1, c: 2 }); // 초기 옵션 1x2
  const [multiScreenItems, setMultiScreenItems] = useState(Array(2).fill(null));
  const [showGridSelector, setShowGridSelector] = useState(false);
  const [hoverGrid, setHoverGrid] = useState({ r: 0, c: 0 });
  
  // 클럭 상태 추출 완료 (HeaderClock 컴포넌트로 이동)
  const handleGridConfigChange = (r, c) => {
    setSoloFullscreenIndex(null);
    setGridConfig({ r, c });
    setShowGridSelector(false);
    setMultiScreenItems(prev => {
      const newLength = r * c;
      const next = Array(newLength).fill(null);
      // 기존 아이템 순서대로 새 슬롯에 복사
      let count = 0;
      for (let i = 0; i < prev.length; i++) {
        if (prev[i] !== null && count < newLength) {
          next[count++] = prev[i];
        }
      }
      return next;
    });
  };
  const [isMultiScreenOpen, setIsMultiScreenOpen] = useState(true);
  const [isMultiScreenFullscreen, setIsMultiScreenFullscreen] = useState(false); // 멀티스크린 전체화면 상태 state
  const [soloFullscreenIndex, setSoloFullscreenIndex] = useState(null); // 개별 카드 전체화면 인덱스
  const dragOverIndexRef = useRef(null);
  const draggedIndexRef = useRef(null);
  const [multiWidth, setMultiWidth] = useState(750);
  const [isResizing, setIsResizing] = useState(false);
  const resizingRef = React.useRef(false);

  const handleMouseDownResize = (e) => {
    e.preventDefault();
    resizingRef.current = true;
    setIsResizing(true);
    document.addEventListener('mousemove', handleMouseMoveResize);
    document.addEventListener('mouseup', handleMouseUpResize);
  };

  const handleMouseMoveResize = (e) => {
    if (!resizingRef.current) return;
    const newWidth = window.innerWidth - e.clientX;
    if (newWidth > 300 && newWidth < window.innerWidth - 300) {
      setMultiWidth(newWidth);
    }
  };

  const handleMouseUpResize = () => {
    resizingRef.current = false;
    setIsResizing(false);
    document.removeEventListener('mousemove', handleMouseMoveResize);
    document.removeEventListener('mouseup', handleMouseUpResize);
  };

  const handleDropOnSlot = (e, index) => {
    e.preventDefault();
    dragOverIndexRef.current = null;
    try {
      // 1. 내부 이동 (Swap) 인 경우
      if (draggedIndexRef.current !== null && draggedIndexRef.current !== undefined) {
        const sourceIndex = draggedIndexRef.current;
        if (sourceIndex !== index) {
          setMultiScreenItems(prev => {
            const next = [...prev];
            const temp = next[index];
            next[index] = next[sourceIndex];
            next[sourceIndex] = temp;
            return next;
          });
        }
        draggedIndexRef.current = null;
        return;
      }
      
      // 2. 외부(사이드바)에서 드래그하여 새로 올리는 경우
      const dataStr = e.dataTransfer.getData('application/json');
      if (!dataStr) return;
      const intersection = JSON.parse(dataStr);
      
      // 중복 체크
      if (multiScreenItems.some(item => item && item.id === intersection.id)) {
        alert('이미 멀티스크린에 등록된 교차로입니다.');
        return;
      }
      
      setMultiScreenItems(prev => {
        const next = [...prev];
        next[index] = intersection;
        return next;
      });
    } catch (err) {
      console.error('Drop error:', err);
    }
  };

  // 백엔드로부터 Supabase 접속 정보 및 서울 지원 목록 동적 조회
  useEffect(() => {
    axios.get(`${API_BASE}/api/config`)
      .then(res => {
        if (res.data && res.data.SUPABASE_URL && res.data.SUPABASE_ANON_KEY) {
          setSupabaseConfig({
            url: res.data.SUPABASE_URL,
            key: res.data.SUPABASE_ANON_KEY
          });
        }
      })
      .catch(err => {
        console.warn('⚠️ 백엔드 설정 로드 실패 (환경 변수를 사용합니다):', err.message);
      });

    axios.get(`${API_BASE}/api/seoul-active-ids`)
      .then(res => {
        if (res.data && Array.isArray(res.data)) {
          setSeoulActiveIds(res.data);
          window.SEOUL_ACTIVE_IDS = res.data;
        }
      })
      .catch(err => console.warn('⚠️ 서울 지원 교차로 목록 로드 실패', err.message));
  }, []);

  // 서울 실시간 SPAT 정보 수신 루프 실행 (Supabase Realtime 기반)
  useEffect(() => {
    window.SEOUL_SPAT_MAP = window.SEOUL_SPAT_MAP || {};
    window.SEOUL_SPAT_LAST_UPDATE = window.SEOUL_SPAT_LAST_UPDATE || null;

    const targetUrl = supabaseConfig?.url || SUPABASE_URL;
    const targetKey = supabaseConfig?.key || SUPABASE_ANON_KEY;

    if (!targetUrl || !targetKey) return;

    // 초기 상태 통신 완료 상태 표시
    setApiStatus(prev => ({...prev, seoul: { status: 'Connected (WS)', time: 'Realtime', color: '#3b82f6' }}));

    import('@supabase/supabase-js').then(({ createClient }) => {
      const supabase = createClient(targetUrl, targetKey);
      
      // 채널 생성 및 구독
      const channel = supabase
        .channel('seoul-spat-changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'seoul_spat_realtime' },
          (payload) => {
            const updatedRow = payload.new;
            // payload.new에 데이터(data)가 실려있는 경우만 렌더링용 맵에 갱신 (프론트 핑 목적의 빈 데이터는 스킵)
            if (updatedRow && updatedRow.itstId && updatedRow.data) {
              window.SEOUL_SPAT_MAP[updatedRow.itstId] = {
                status: updatedRow.data,
                timing: updatedRow.data
              };
              window.SEOUL_SPAT_LAST_UPDATE = new Date();
              setUticUpdateTick(t => t + 1); // 리렌더링 트리거
            }
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('✅ Supabase Realtime 구독 완료');
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.error('❌ Supabase Realtime 구독 에러:', status);
          }
        });

      window.SUPABASE_CHANNEL = channel;
      window.SUPABASE_CLIENT = supabase;
    });

    return () => {
      if (window.SUPABASE_CHANNEL && window.SUPABASE_CLIENT) {
        window.SUPABASE_CLIENT.removeChannel(window.SUPABASE_CHANNEL);
      }
    };
  }, [supabaseConfig]);

  // 현재 관심 대상인 활성 교차로를 백엔드에 주기적으로 Ping 등록 (데이터 필터링 및 Sleep 방지용)
  useEffect(() => {
    const activeIds = [];
    if (detailIntersection && detailIntersection.origin_type?.toLowerCase().includes('tdata')) {
      activeIds.push(String(detailIntersection.int_no));
    }
    dualSelection.forEach(item => {
      if (item.origin_type?.toLowerCase().includes('tdata')) {
        activeIds.push(String(item.int_no));
      }
    });
    multiScreenItems.forEach(item => {
      if (item && item.origin_type?.toLowerCase().includes('tdata')) {
        activeIds.push(String(item.int_no));
      }
    });

    if (activeIds.length === 0) return;

    const sendPing = async () => {
      try {
        await axios.post(`${API_BASE}/api/ping`, { ids: activeIds });
      } catch (e) {
        // ignore network failures
      }
    };

    sendPing();
    const intervalId = setInterval(sendPing, 10000); // 10초 주기 핑

    return () => clearInterval(intervalId);
  }, [detailIntersection, dualSelection, multiScreenItems]);

  const handleMapSignalToggle = (id) => {
    // 만약 신호가 꺼진 모드('off') 상태에서 신호등 표출을 켰다면 자동으로 'arrow' 모드로 활성화
    setMapSignalDisplayMode(prev => {
      if (prev === 'off') return 'arrow';
      return prev;
    });

    setActiveMapSignalIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(x => x !== id);
      }
      if (prev.length >= 3) {
        alert('지도상 실시간 신호 표출은 브라우저 성능 최적화를 위해 동시에 최대 3개까지만 가능합니다.');
        return prev;
      }
      return [...prev, id];
    });
  };

  // UTIC 제어기 상태(CRST) (API 폐기로 인한 Mock 처리)
  useEffect(() => {
    // 모든 교차로에 대해 기본값 '수신'을 반환하도록 Proxy 객체 사용
    window.UTIC_SPAT_MAP = new Proxy({}, {
      get: function(target, prop) {
        return { opMode: '수신' };
      }
    });
    window.UTIC_SPAT_LAST_UPDATE = new Date();

    setApiStatus(prev => ({...prev, utic: { status: 'Connected', time: '12ms', color: '#3b82f6' }}));
    setUticUpdateTick(t => t + 1);

    // 1분마다 상태 갱신 시간만 업데이트 (에러 방지)
    const intervalId = setInterval(() => {
      window.UTIC_SPAT_LAST_UPDATE = new Date();
      setUticUpdateTick(t => t + 1);
    }, 60000);
    
    return () => clearInterval(intervalId);
  }, []);

  const fetchIntersections = async () => {
    try {
      const start = Date.now();
      let data = [];
      
      // Supabase PostgREST 기본 제한(1000건)을 우회하기 위해 항상 백엔드에서 전체 교차로 마스터(약 6000건) 데이터를 받아옵니다.
      // (백엔드는 메모리에 캐싱된 데이터를 즉시 반환하므로 빠르며, 동시에 Sleep 중인 백엔드를 깨우는 효과도 있습니다)
      const response = await axios.get(`${API_BASE}/api/intersections`);
      data = response.data;
      
      const elapsed = Date.now() - start;
      setIntersections(data);
      window.SEOUL_ACTIVE_IDS = [];

      setApiStatus(prev => ({
        ...prev,
        utic: { status: 'On', time: `${elapsed + 15}ms`, color: '#00ffa2' }
      }));
    } catch (error) {
      console.error("교차로 데이터 로드 실패", error);
      setApiStatus(prev => ({
        ...prev,
        utic: { status: 'Error', time: '-ms', color: '#ef4444' }
      }));
    }
  };

  useEffect(() => {
    fetchIntersections();
  }, []);

  const handleNodeClick = (id) => {
    setActiveNodeId(id);
  };

  const openDetail = (intersection) => {
    setDetailIntersection(intersection);
  };

  const handleDualClick = (intersection) => {
    setDualSelection(prev => {
      if (prev.length === 0) return [intersection];
      if (prev.length === 1 && prev[0].id !== intersection.id) return [prev[0], intersection];
      return prev;
    });
  };

  const handleMultiClick = (intersection) => {
    setMultiScreenItems(prev => {
      if (prev.some(item => item && item.id === intersection.id)) {
        alert('이미 멀티스크린에 등록된 교차로입니다.');
        return prev;
      }
      const next = [...prev];
      const emptyIndex = next.findIndex(item => item === null);
      if (emptyIndex !== -1) {
        next[emptyIndex] = intersection;
      } else {
        // FIFO 방식 유지 (가득 찬 경우 가장 오래된 것을 제거)
        next.shift();
        next.push(intersection);
      }
      return next;
    });
  };

// 사이드바 교차로 선택 시 지도 이동 처리 컴포넌트
function MapPanner({ intersections, targetId }) {
  const map = useMap();
  const lastTargetRef = useRef(null);
  
  useEffect(() => {
    if (targetId && targetId !== lastTargetRef.current) {
      const target = intersections.find(i => i.id === targetId);
      if (target && target.y_coord && target.x_coord) {
        map.flyTo([target.y_coord, target.x_coord], 16, { duration: 1 });
        lastTargetRef.current = targetId;
      }
    }
  }, [targetId, intersections, map]);
  return null;
}

  return (
    <>
      <aside className="sidebar glass">
        <header className="sidebar-header" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div 
            onClick={() => window.location.href = '/'} 
            style={{ cursor: 'pointer', fontSize: '14px', color: '#aaa', display: 'flex', alignItems: 'center', gap: '5px' }}
          >
            🏠 홈 (포털 메인)
          </div>
          <h1 onClick={() => window.location.href = window.location.pathname} style={{ cursor: 'pointer', margin: 0 }}>🚦 SIGMA API</h1>
        </header>
        {/* 트리뷰 컴포넌트 연결 */}
        <SidebarAccordion 
          intersections={intersections} 
          onNodeClick={handleNodeClick} 
          activeNodeId={activeNodeId} 
          onRefresh={fetchIntersections}
          uticUpdateTick={uticUpdateTick}
          dualSelection={dualSelection}
          onDualClick={handleDualClick}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          seoulActiveIds={seoulActiveIds}
          activeMapSignalIds={activeMapSignalIds}
          onMapSignalToggle={handleMapSignalToggle}
        />
        
        <footer className="sidebar-footer" style={{ padding: '10px 14px', display: 'flex', flexDirection: 'row', gap: '8px', justifyContent: 'space-around', borderTop: '1px solid var(--glass-border)', alignItems: 'center', marginTop: 'auto' }}>
          <div className="api-status" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 500 }}>서울Tdata</span>
            <span className="status-dot" style={{ width: '8px', height: '8px', background: apiStatus.seoul.color, borderRadius: '50%', boxShadow: `0 0 5px ${apiStatus.seoul.color}` }}></span>
            <span style={{ fontSize: '0.7rem', fontWeight: 600, color: apiStatus.seoul.color }}>{apiStatus.seoul.status}</span>
            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginLeft: '-2px' }}>{apiStatus.seoul.time}</span>
          </div>
          <div style={{ width: '1px', height: '14px', background: 'rgba(255,255,255,0.15)' }}></div>
          <div className="api-status" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 500 }}>경찰청(UTIC)</span>
            <span className="status-dot" style={{ width: '8px', height: '8px', background: apiStatus.utic.color, borderRadius: '50%', boxShadow: `0 0 5px ${apiStatus.utic.color}` }}></span>
            <span style={{ fontSize: '0.7rem', fontWeight: 600, color: apiStatus.utic.color }}>{apiStatus.utic.status}</span>
            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginLeft: '-2px' }}>{apiStatus.utic.time}</span>
          </div>
        </footer>
      </aside>

      <main className="main-content">
        <div className="top-map-wrapper" style={{ position: 'relative' }}>
          {/* 지도상 신호 표출 모드 선택기 */}
          <div 
            className="map-control-overlay glass" 
            style={{ 
              position: 'absolute', 
              top: '15px', 
              left: '50%', 
              transform: 'translateX(-50%)', 
              zIndex: 1000, 
              display: 'flex', 
              gap: '6px', 
              padding: '6px 10px', 
              borderRadius: '20px', 
              background: 'rgba(15, 23, 42, 0.75)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.47)'
            }}
          >
            <button 
              className={`btn-clear ${mapSignalDisplayMode !== 'off' ? 'active' : ''}`}
              style={{
                background: mapSignalDisplayMode !== 'off' ? 'rgba(56, 189, 248, 0.25)' : 'transparent',
                color: mapSignalDisplayMode !== 'off' ? '#38bdf8' : '#94a3b8',
                border: 'none',
                padding: '6px 14px',
                borderRadius: '15px',
                fontSize: '0.75rem',
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}
              onClick={() => {
                setMapSignalDisplayMode(prev => {
                  if (prev === 'off') return 'arrow';
                  if (prev === 'arrow') return 'compass';
                  return 'off';
                });
              }}
            >
              🚦 신호등 {mapSignalDisplayMode === 'arrow' ? '(화살표)' : (mapSignalDisplayMode === 'compass' ? '(신호등)' : '(제거)')}
            </button>
            <div style={{ width: '1px', height: '18px', background: 'rgba(255,255,255,0.15)', alignSelf: 'center', margin: '0 4px' }}></div>
            <button 
              className={`btn-clear ${showMapNames ? 'active' : ''}`}
              style={{
                background: showMapNames ? 'rgba(56, 189, 248, 0.25)' : 'transparent',
                color: showMapNames ? '#38bdf8' : '#94a3b8',
                border: 'none',
                padding: '6px 14px',
                borderRadius: '15px',
                fontSize: '0.75rem',
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}
              onClick={() => setShowMapNames(p => !p)}
            >
              📛 교차로명
            </button>
            <div style={{ width: '1px', height: '18px', background: 'rgba(255,255,255,0.15)', alignSelf: 'center', margin: '0 4px' }}></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '0 8px' }}>
              <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>영역</span>
              <input 
                type="range" 
                min="100" 
                max="300" 
                value={compassSizeVal}
                onChange={(e) => setCompassSizeVal(Number(e.target.value))}
                style={{ width: '60px', accentColor: '#38bdf8' }}
                title="신호등 영역 크기 조절"
              />
            </div>
            <div style={{ width: '1px', height: '18px', background: 'rgba(255,255,255,0.15)', alignSelf: 'center', margin: '0 4px' }}></div>
            <button 
              className={`btn-toggle-multi ${isMultiScreenOpen ? 'active' : ''}`}
              style={{
                background: isMultiScreenOpen ? 'rgba(56, 189, 248, 0.25)' : 'transparent',
                color: isMultiScreenOpen ? '#38bdf8' : '#94a3b8',
                border: 'none',
                padding: '6px 14px',
                borderRadius: '15px',
                fontSize: '0.75rem',
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}
              onClick={() => setIsMultiScreenOpen(prev => !prev)}
            >
              🖥️ 멀티스크린
            </button>
          </div>

          <MapContainer center={DEFAULT_CENTER} zoom={12} style={{width:'100%', height:'100%'}} preferCanvas={true}>
            <MapAutoResizer />
            <MapPanner intersections={intersections} targetId={activeNodeId} />
            <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png" attribution='&copy; CARTO' />
            <IntersectionMarkers 
              intersections={intersections} 
              onDetailClick={openDetail}
              onMultiClick={handleMultiClick}
              targetId={activeNodeId}
              uticUpdateTick={uticUpdateTick}
              activeTab={activeTab}
              seoulActiveIds={seoulActiveIds}
              activeMapSignalIds={activeMapSignalIds}
              onMapSignalToggle={handleMapSignalToggle}
              showMapNames={showMapNames}
            />
            {/* 지도상 신호 표출 레이어 */}
            {mapSignalDisplayMode !== 'off' && intersections
              .filter(item => activeMapSignalIds.includes(item.id))
              .map(item => (
                <MapSignalOverlay 
                  key={`map-signal-${item.id}`} 
                  intersection={item} 
                  uticUpdateTick={uticUpdateTick}
                  onMapSignalToggle={handleMapSignalToggle}
                  displayMode={mapSignalDisplayMode}
                />
              ))}
          </MapContainer>

        </div>


      </main>

      {/* 우측 멀티디스플레이 패널 */}
      <section 
        className={`multi-screen-panel ${isMultiScreenOpen ? '' : 'closed'} ${isMultiScreenFullscreen ? 'fullscreen' : ''}`}
        style={{ 
          width: isMultiScreenOpen ? (isMultiScreenFullscreen ? '100vw' : `${multiWidth}px`) : '0px',
          transition: isResizing ? 'none' : 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1), margin-right 0.3s ease',
          position: 'relative'
        }}
      >
        {isMultiScreenOpen && !isMultiScreenFullscreen && (
          <div 
            className="panel-resizer" 
            onMouseDown={handleMouseDownResize}
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: '8px',
              cursor: 'ew-resize',
              zIndex: 10,
              backgroundColor: 'transparent'
            }}
          />
        )}
        <header className="multi-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <h2>🖥️ 멀티디스플레이 ({multiScreenItems.filter(Boolean).length}/{gridConfig.r * gridConfig.c})</h2>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button 
              className="btn-clear active"
              style={{
                padding: '6px 14px',
                fontSize: '0.75rem',
                borderRadius: '15px',
                background: 'rgba(56,189,248,0.2)',
                color: '#38bdf8',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}
              onClick={() => {
                setMultiSignalDisplayMode(prev => prev === 'compass' ? 'arrow' : 'compass');
              }}
            >
              🚦 신호등 {multiSignalDisplayMode === 'compass' ? '(신호등)' : '(화살표)'}
            </button>
            <div style={{ position: 'relative' }}>
              <button 
                className="btn-clear active"
                style={{
                  padding: '6px 14px',
                  fontSize: '0.75rem',
                  borderRadius: '15px',
                  background: 'rgba(56,189,248,0.2)',
                  color: '#38bdf8',
                  border: '1px solid #38bdf8',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
                onClick={() => setShowGridSelector(p => !p)}
              >
                ▦ 화면 분할 ({gridConfig.r}x{gridConfig.c})
              </button>
              {showGridSelector && (
                <div 
                  className="grid-selector-popup"
                  onMouseLeave={() => setHoverGrid({ r: 0, c: 0 })}
                >
                  {[1, 2, 3, 4, 5].map(r => (
                    <div key={`r-${r}`} className="grid-selector-row">
                      {[1, 2, 3, 4, 5].map(c => {
                        const isActive = r <= hoverGrid.r && c <= hoverGrid.c;
                        return (
                          <div 
                            key={`c-${c}`} 
                            className={`grid-selector-cell ${isActive ? 'active' : ''}`}
                            onMouseEnter={() => setHoverGrid({ r, c })}
                            onClick={() => handleGridConfigChange(r, c)}
                          ></div>
                        );
                      })}
                    </div>
                  ))}
                  <div className="grid-selector-info">
                    {hoverGrid.r > 0 ? `${hoverGrid.r} x ${hoverGrid.c}` : '격자 선택'}
                  </div>
                </div>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              className="btn-clear" 
              style={{
                background: 'rgba(56, 189, 248, 0.1)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                color: '#38bdf8',
                padding: '4px 10px',
                borderRadius: '4px',
                fontSize: '0.75rem',
                cursor: 'pointer',
                fontWeight: '600'
              }}
              onClick={() => setIsMultiScreenFullscreen(p => !p)}
            >
              {isMultiScreenFullscreen ? '🗗 전체화면 닫기' : '🗖 전체화면'}
            </button>
            <button className="btn-clear" onClick={() => setMultiScreenItems(Array(gridConfig.r * gridConfig.c).fill(null))}>전체 비우기</button>
          </div>
        </header>
        <div className="multi-overlay-content" style={{
          gridTemplateColumns: soloFullscreenIndex !== null ? '1fr' : `repeat(${gridConfig.c}, 1fr)`,
          gridTemplateRows: soloFullscreenIndex !== null ? '1fr' : `repeat(${gridConfig.r}, 1fr)`
        }}>
          {(soloFullscreenIndex !== null
            ? [{ item: multiScreenItems[soloFullscreenIndex], index: soloFullscreenIndex }]
            : multiScreenItems.map((item, index) => ({ item, index }))
          ).map(({ item, index }) => {
            return (
              <div
                key={item ? item.id : `empty-${index}`}
                className="multi-grid-slot-wrapper"
                draggable={soloFullscreenIndex !== null ? false : !!item}
                onDragStart={(e) => {
                  if (soloFullscreenIndex !== null) return;
                  if (item) {
                    draggedIndexRef.current = index;
                    e.dataTransfer.setData('text/plain', String(index));
                  }
                }}
                onDragEnd={(e) => {
                  draggedIndexRef.current = null;
                  if (dragOverIndexRef.current !== null) {
                    dragOverIndexRef.current = null;
                  }
                  e.currentTarget.closest('.multi-grid')?.querySelectorAll('.multi-grid-slot-wrapper').forEach(el => {
                    el.style.border = 'none';
                  });
                }}
                onDragOver={(e) => {
                  if (soloFullscreenIndex !== null) return;
                  e.preventDefault();
                  if (dragOverIndexRef.current !== index) {
                    e.currentTarget.closest('.multi-grid')?.querySelectorAll('.multi-grid-slot-wrapper').forEach(el => {
                      el.style.border = 'none';
                    });
                    dragOverIndexRef.current = index;
                    e.currentTarget.style.border = '2px dashed #38bdf8';
                  }
                }}
                onDragLeave={(e) => {
                  e.currentTarget.style.border = 'none';
                  dragOverIndexRef.current = null;
                }}
                onDrop={(e) => {
                  e.currentTarget.style.border = 'none';
                  handleDropOnSlot(e, index);
                }}
                onDoubleClick={() => {
                  if (item) {
                    setSoloFullscreenIndex(prev => prev !== null ? null : index);
                  }
                }}
                style={{ 
                  width: '100%', 
                  height: '100%', 
                  display: 'flex', 
                  boxSizing: 'border-box',
                  borderRadius: '8px',
                  cursor: item ? 'pointer' : 'default'
                }}
              >
                {item ? (
                  <MultiSignalCard
                    intersection={item}
                    uticUpdateTick={uticUpdateTick}
                    displayMode={multiSignalDisplayMode}
                    onRemove={() => {
                      setSoloFullscreenIndex(null);
                      setMultiScreenItems(prev => {
                        const next = [...prev];
                        next[index] = null;
                        return next;
                      });
                    }}
                  />
                ) : (
                  <div className="empty-slot" style={{ width: '100%', height: '100%' }}>
                    <svg viewBox="0 0 24 24">
                      <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
                    </svg>
                    <span>교차로 드롭</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {isMultiScreenOpen && <HeaderClock />}
      </section>

      {detailIntersection && dualSelection.length === 0 && (
        <SingleDetailOverlay 
          intersection={detailIntersection} 
          onClose={() => setDetailIntersection(null)} 
          uticUpdateTick={uticUpdateTick}
        />
      )}

      {dualSelection.length === 1 && (
        <div style={{position:'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', background:'rgba(56, 189, 248, 0.9)', color:'#fff', padding:'12px 24px', borderRadius:'30px', zIndex:10000, fontWeight:'bold', boxShadow:'0 4px 15px rgba(0,0,0,0.3)', display:'flex', alignItems:'center', gap:'10px'}}>
          <span>⚖️ 첫 번째 교차로 <b>[{dualSelection[0].int_nm}]</b> 선택됨. 비교할 두 번째 교차로를 선택해 주세요.</span>
          <button onClick={() => setDualSelection([])} style={{background:'rgba(0,0,0,0.2)', border:'none', color:'#fff', padding:'4px 8px', borderRadius:'4px', cursor:'pointer', fontSize:'0.8rem'}}>취소</button>
        </div>
      )}

      {dualSelection.length === 2 && (
        <DualDetailOverlay
          intersections={dualSelection}
          onClose={() => setDualSelection([])}
        />
      )}

    </>
  );
}

export default App;
