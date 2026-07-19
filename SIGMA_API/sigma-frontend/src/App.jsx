import React, { useEffect, useState, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, useMap, ZoomControl } from 'react-leaflet';
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
import IntersectionMarkers, { MapAutoResizer } from './components/IntersectionMarkers';
import HeaderClock from './components/HeaderClock';
import MapResizer from './components/MapResizer';
import MapPanner from './components/MapPanner';

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

// [5] 메인 레이아웃
function App() {
  // Render 서버 슬립 방지용 Keep-Alive 핑 (1분 간격)
  useEffect(() => {
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
  const [uticOpenRegions, setUticOpenRegions] = useState({}); // 현재 열려있는 UTIC 지역 목록
  const [seoulActiveIds, setSeoulActiveIds] = useState([]); // 서울 활성 ID 목록
  const [uticUpdateTick, setUticUpdateTick] = useState(0); // UTIC 수신 리렌더 트리거
  const [apiStatus, setApiStatus] = useState({
    seoul: { status: 'Off', time: '-ms', color: '#ef4444' },
    utic: { status: 'Off', time: '-ms', color: '#ef4444' }
  });
  const [supabaseConfig, setSupabaseConfig] = useState(null);
  const [activeMapSignalIds, setActiveMapSignalIds] = useState([]); // 지도상 신호 표출 활성화할 교차로 ID (최대 3개)
  const [isMapSignalOn, setIsMapSignalOn] = useState(false);
  const [mapSignalType, setMapSignalType] = useState('compass'); // 'compass' | 'arrow'
  const [multiSignalDisplayMode, setMultiSignalDisplayMode] = useState('compass'); // 멀티스크린 신호 표출 모드: 'compass' | 'arrow'
  const [showMapNames, setShowMapNames] = useState(true); // 지도상 교차로명 보이기/감추기 토글 state
  const [compassSizeVal, setCompassSizeVal] = useState(180);
  const [filterSeoulActive, setFilterSeoulActive] = useState(false);

  useEffect(() => {
    const scale = compassSizeVal / 180;
    document.documentElement.style.setProperty('--compass-scale', scale);
    document.documentElement.style.setProperty('--compass-scale-11', scale * 1.1);
    document.documentElement.style.setProperty('--compass-scale-115', scale * 1.15);
  }, [compassSizeVal]);


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
  const [isMultiScreenOpen, setIsMultiScreenOpen] = useState(false); // 멀티스크린 패널 열림 여부 state (초기값 false)
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
    // 만약 신호가 꺼진 상태에서 신호등 표출을 켰다면 자동으로 ON 모드로 활성화
    setIsMapSignalOn(true);

    setActiveMapSignalIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(x => x !== id);
      }
      return [...prev, id];
    });
  };

  const prevMultiIdsRef = useRef([]);

  // 신호등 제거 모드('off')로 변경 시 지도상의 신호 활성 목록을 완전히 비움
  useEffect(() => {
    if (!isMapSignalOn) {
      setActiveMapSignalIds([]);
    } else {
      // 켜질 때 멀티스크린에 있는 교차로들을 다시 활성화
      setActiveMapSignalIds(prev => {
        let newIds = [...prev];
        multiScreenItems.filter(item => item !== null).forEach(item => {
          if (!newIds.includes(item.id)) {
            newIds.push(item.id);
          }
        });
        return newIds;
      });
    }
  }, [isMapSignalOn, multiScreenItems]);

  // 멀티스크린 담기/삭제 시 자동으로 지도 신호 표출 동기화
  useEffect(() => {
    const multiIds = multiScreenItems.filter(item => item !== null).map(item => item.id);
    const prevMultiIds = prevMultiIdsRef.current;
    
    const addedIds = multiIds.filter(id => !prevMultiIds.includes(id));
    const removedIds = prevMultiIds.filter(id => !multiIds.includes(id));

    if (addedIds.length > 0 || removedIds.length > 0) {
      setActiveMapSignalIds(prev => {
        let newIds = [...prev];
        addedIds.forEach(id => {
          if (!newIds.includes(id)) newIds.push(id);
        });
        removedIds.forEach(id => {
          newIds = newIds.filter(x => x !== id);
        });
        return newIds;
      });

      if (addedIds.length > 0) {
        setIsMapSignalOn(true);
      }
    }

    prevMultiIdsRef.current = multiIds;
  }, [multiScreenItems]);

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
    setIsMultiScreenOpen(true);
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

  const filteredIntersections = useMemo(() => {
    if (!filterSeoulActive) return intersections;
    return intersections.filter(item => {
      const originLower = String(item.origin_type || '').toLowerCase();
      if (originLower.includes('tdata')) {
        const hasSeoulSpat = window.SEOUL_SPAT_MAP && window.SEOUL_SPAT_MAP[item.int_no];
        return seoulActiveIds.includes(String(item.id)) || hasSeoulSpat;
      }
      return true; // Keep UTIC intersections
    });
  }, [intersections, filterSeoulActive, seoulActiveIds, uticUpdateTick]);

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
          intersections={filteredIntersections} 
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
          uticOpenRegions={uticOpenRegions}
          setUticOpenRegions={setUticOpenRegions}
          filterSeoulActive={filterSeoulActive}
          setFilterSeoulActive={setFilterSeoulActive}
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
              className={`btn-clear ${isMapSignalOn ? 'active' : ''}`}
              style={{
                background: isMapSignalOn ? 'rgba(56, 189, 248, 0.25)' : 'transparent',
                color: isMapSignalOn ? '#38bdf8' : '#94a3b8',
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
              onClick={() => setIsMapSignalOn(prev => !prev)}
              title="신호등 켜기/끄기"
            >
              <div style={{
                width: '36px', height: '20px', borderRadius: '10px', 
                background: isMapSignalOn ? '#38bdf8' : '#475569',
                position: 'relative', transition: 'background 0.3s'
              }}>
                <div style={{
                  width: '16px', height: '16px', borderRadius: '50%', background: '#fff',
                  position: 'absolute', top: '2px', left: isMapSignalOn ? '18px' : '2px',
                  transition: 'left 0.3s'
                }} />
              </div>
            </button>
            <div style={{ width: '1px', height: '18px', background: 'rgba(255,255,255,0.15)', alignSelf: 'center', margin: '0 4px' }}></div>
            <button 
              className={`btn-clear ${isMapSignalOn ? 'active' : ''}`}
              style={{
                background: isMapSignalOn ? 'rgba(16, 185, 129, 0.25)' : 'transparent',
                color: isMapSignalOn ? '#10b981' : '#64748b',
                border: 'none',
                padding: '6px 14px',
                borderRadius: '15px',
                fontSize: '0.75rem',
                fontWeight: 'bold',
                cursor: isMapSignalOn ? 'pointer' : 'not-allowed',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                opacity: isMapSignalOn ? 1 : 0.5
              }}
              onClick={() => {
                if (isMapSignalOn) {
                  setMapSignalType(prev => prev === 'compass' ? 'arrow' : 'compass');
                }
              }}
              title={mapSignalType === 'compass' ? "신호등 모드" : "화살표 모드"}
            >
              {mapSignalType === 'compass' ? (
                <svg width="28" height="14" viewBox="0 0 28 14" fill="none" xmlns="http://www.w3.org/2000/svg" title="신호등 모드"><rect x="1" y="1" width="26" height="12" rx="4" fill="#222" stroke="#555" strokeWidth="2"></rect><circle cx="7" cy="7" r="3" fill="#ef4444"></circle><circle cx="14" cy="7" r="3" fill="#eab308"></circle><circle cx="21" cy="7" r="3" fill="#22c55e"></circle></svg>
              ) : (
                <svg width="24" height="18" viewBox="0 0 24 18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" title="화살표 모드"><path d="M11 16V9a3 3 0 0 0-3-3H3" /><path d="M6 3L2 6l4 3" /><path d="M18 16V2" /><path d="M14 6l4-4 4 4" /></svg>
              )}
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
              title="교차로명 표시 토글"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
            </button>
            <div style={{ width: '1px', height: '18px', background: 'rgba(255,255,255,0.15)', alignSelf: 'center', margin: '0 4px' }}></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '0 8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', position: 'relative', width: '50px', height: '12px' }} title="신호등 영역 크기 조절">
                <div style={{ position: 'absolute', left: '4px', right: '4px', height: '4px', background: '#475569', top: '4px', zIndex: 1, borderRadius: '2px' }} />
                <div style={{ position: 'absolute', left: '4px', width: compassSizeVal === 100 ? '0%' : compassSizeVal === 200 ? '50%' : 'calc(100% - 8px)', height: '4px', background: '#38bdf8', top: '4px', zIndex: 1, transition: 'width 0.2s', borderRadius: '2px' }} />
                {[100, 200, 300].map((val, idx) => (
                  <div 
                    key={val}
                    onClick={() => setCompassSizeVal(val)}
                    style={{
                      position: 'absolute',
                      left: idx === 0 ? '0' : idx === 1 ? 'calc(50% - 6px)' : 'calc(100% - 12px)',
                      top: '0',
                      width: compassSizeVal === val ? '12px' : '10px',
                      height: compassSizeVal === val ? '12px' : '10px',
                      marginTop: compassSizeVal === val ? '0' : '1px',
                      borderRadius: '50%',
                      background: val <= compassSizeVal ? '#38bdf8' : '#475569',
                      cursor: 'pointer', zIndex: 2,
                      transition: 'all 0.2s'
                    }}
                  />
                ))}
              </div>
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
              title="멀티스크린"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" title="멀티스크린"><rect x="2" y="2" width="9" height="9" rx="1" /><rect x="13" y="2" width="9" height="9" rx="1" /><rect x="2" y="13" width="9" height="9" rx="1" /><rect x="13" y="13" width="9" height="9" rx="1" /></svg>
            </button>
          </div>

          <MapContainer center={DEFAULT_CENTER} zoom={12} style={{width:'100%', height:'100%'}} preferCanvas={true} zoomControl={false}>
            <ZoomControl position="bottomright" />
            <MapAutoResizer />
            <MapPanner intersections={filteredIntersections} targetId={activeNodeId} />
            <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png" attribution='&copy; CARTO' />
            <IntersectionMarkers 
              intersections={filteredIntersections} 
              onDetailClick={openDetail}
              onMultiClick={handleMultiClick}
              targetId={activeNodeId}
              uticUpdateTick={uticUpdateTick}
              activeTab={activeTab}
              seoulActiveIds={seoulActiveIds}
              activeMapSignalIds={activeMapSignalIds}
              onMapSignalToggle={handleMapSignalToggle}
              showMapNames={showMapNames}
              onNodeClick={handleNodeClick}
              uticOpenRegions={uticOpenRegions}
            />
            {/* 지도상 신호 표출 레이어 */}
            {isMapSignalOn && filteredIntersections
              .filter(item => activeMapSignalIds.includes(item.id))
              .map(item => (
                <MapSignalOverlay 
                  key={`map-signal-${item.id}`} 
                  intersection={item} 
                  uticUpdateTick={uticUpdateTick}
                  onMapSignalToggle={handleMapSignalToggle}
                  displayMode={mapSignalType}
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
                background: 'rgba(16, 185, 129, 0.25)',
                color: '#10b981',
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
                setMultiSignalDisplayMode(prev => prev === 'compass' ? 'arrow' : 'compass');
              }}
            >
              {multiSignalDisplayMode === 'compass' ? (
                <svg width="28" height="14" viewBox="0 0 28 14" fill="none" xmlns="http://www.w3.org/2000/svg" title="신호등 모드"><rect x="1" y="1" width="26" height="12" rx="4" fill="#222" stroke="#555" strokeWidth="2"></rect><circle cx="7" cy="7" r="3" fill="#ef4444"></circle><circle cx="14" cy="7" r="3" fill="#eab308"></circle><circle cx="21" cy="7" r="3" fill="#22c55e"></circle></svg>
              ) : (
                <svg width="24" height="18" viewBox="0 0 24 18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" title="화살표 모드"><path d="M11 16V9a3 3 0 0 0-3-3H3" /><path d="M6 3L2 6l4 3" /><path d="M18 16V2" /><path d="M14 6l4-4 4 4" /></svg>
              )}
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
          isMultiScreenOpen={isMultiScreenOpen}
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
