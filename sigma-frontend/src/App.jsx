import React, { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Tooltip, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import axios from 'axios';
import './index.css';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

// [1] 마커 최적화 렌더링 및 클릭 이벤트
function IntersectionMarkers({ intersections, onDetailClick, targetId }) {
  const map = useMap();
  const [zoomLevel, setZoomLevel] = useState(map.getZoom());

  // 사이드바에서 교차로 선택시 지도 위치 이동 (flyTo)
  useEffect(() => {
    if (targetId) {
      const target = intersections.find(i => i.id === targetId);
      if (target) {
        map.flyTo([target.y_coord, target.x_coord], 16, { duration: 1 });
      }
    }
  }, [targetId, intersections, map]);

  useEffect(() => {
    const onZoom = () => setZoomLevel(map.getZoom());
    map.on('zoomend', onZoom);
    return () => map.off('zoomend', onZoom);
  }, [map]);

  const showTooltip = zoomLevel >= 13;

  return (
    <>
      {intersections.map((intersection) => {
        const isSelected = intersection.id === targetId;
        return (
          <CircleMarker
            key={intersection.id}
            center={[intersection.y_coord, intersection.x_coord]}
            radius={isSelected ? 10 : 6}
            fillColor={isSelected ? "#38bdf8" : "#64748b"}
            color={isSelected ? "#fff" : "#334155"}
            weight={isSelected ? 3 : 2}
            fillOpacity={0.8}
          >
            {showTooltip && (
              <Tooltip direction="top" offset={[0, -10]} permanent className="map-label">
                {intersection.int_nm}
              </Tooltip>
            )}
            
            <Popup className="custom-popup" closeButton={true}>
              <div className="popup-content">
                <h3>{intersection.int_nm}</h3>
                <button className="btn-detail" onClick={(e) => {
                  e.stopPropagation();
                  onDetailClick(intersection);
                }}>상세보기</button>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </>
  );
}

// [2] 8방향 실시간 신호등 오버레이 컴포넌트
function CompassOverlay({ phase, remainTime, activeDirections = [0, 90, 180, 270] }) {
  const directions = [
    { key: 'N', deg: 0 },
    { key: 'NE', deg: 45 },
    { key: 'E', deg: 90 },
    { key: 'SE', deg: 135 },
    { key: 'S', deg: 180 },
    { key: 'SW', deg: 225 },
    { key: 'W', deg: 270 },
    { key: 'NW', deg: 315 }
  ];

  return (
    <div className="compass-center-overlay-wrapper" style={{
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%) scale(1.5)',
      width: '155px',
      height: '155px',
      pointerEvents: 'none',
      zIndex: 9999
    }}>
      <div className="compass-center-overlay">
        {directions.map(({ key, deg }) => {
          if (!activeDirections.includes(deg)) return null;

          // 실시간 신호 제어 시뮬레이션
          let isGreen = phase % 2 === 0;
          let isYellow = !isGreen && remainTime <= 3;
          let isRed = !isGreen && !isYellow;
          let isArrow = phase === 3 || phase === 4;
          
          let pedGreen = phase % 2 !== 0;
          let pedRed = !pedGreen;

          return (
            <div key={key} className={`signal-slot slot-${key}`} id={`slot-${key}`}>
              <div className="signal-mount-frame">
                <div className="component-block">
                  <div className="car-housing-box">
                    <div className={`lens c-red ${isRed ? 'on' : ''}`}></div>
                    <div className={`lens c-yellow ${isYellow ? 'on' : ''}`}></div>
                    <div className={`lens c-arrow ${isArrow ? 'on' : ''}`}></div>
                    <div className={`lens c-green ${isGreen ? 'on' : ''}`}></div>
                  </div>
                  <div className="micro-timer car-timer">{remainTime}s</div>
                </div>
              </div>
              <div className="ped-mount-container">
                <div className="ped-mount-frame">
                  <div className="ped-housing-box">
                    <div className={`ped-lens p-red ${pedRed ? 'on' : ''}`}></div>
                    <div className={`ped-lens p-green ${pedGreen ? 'on' : ''}`}></div>
                  </div>
                  <div className="micro-timer ped-timer">{remainTime}s</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// [3] 단일 교차로 상세 모니터링 모달
function SingleDetailOverlay({ intersection, onClose }) {
  const [activeTab, setActiveTab] = useState('detail');
  const [phase, setPhase] = useState(1);
  const [remainTime, setRemainTime] = useState(25);

  useEffect(() => {
    const interval = setInterval(() => {
      setRemainTime(r => {
        if (r <= 1) {
          setPhase(p => (p % 8) + 1);
          return 25;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!intersection) return null;

  return (
    <div className="detail-modal-overlay">
      <div className="detail-modal-content">
        <header className="modal-header">
          <h2>🚦 {intersection.int_nm} <span style={{fontSize:'0.8rem', color:'#94a3b8', marginLeft:10}}>ID: {intersection.int_no}</span></h2>
          <button className="btn-close" onClick={onClose}>×</button>
        </header>

        <div className="modal-top-map">
          <div className="overlay-toolbar">
            <button className="toolbar-btn active">전체 정보 모드</button>
            <button className="toolbar-btn">맵 확대 모드</button>
          </div>
          <div style={{position: 'absolute', top: '10px', right: '20px', zIndex: 1000, background: 'rgba(15, 23, 42, 0.85)', padding: '6px 14px', borderRadius: '20px', border: '1px solid #10b981', display: 'flex', alignItems: 'center', gap: '6px'}}>
            <span style={{fontSize: '10px'}}>제어 상태:</span>
            <span style={{color:'#10b981', fontWeight:'bold', fontSize: '11px', textShadow: '0 0 10px #10b981'}}>실시간 연동 중</span>
          </div>
          <div style={{position: 'relative', width: '100%', height: '100%'}}>
            <MapContainer 
              center={[intersection.y_coord, intersection.x_coord]} 
              zoom={19} 
              style={{width:'100%', height:'100%'}} 
              zoomControl={false}
              dragging={false}
              touchZoom={false}
              doubleClickZoom={false}
              scrollWheelZoom={false}
              boxZoom={false}
              keyboard={false}
            >
              <TileLayer url="http://mt0.google.com/vt/lyrs=s&hl=ko&x={x}&y={y}&z={z}" />
              <CircleMarker
                center={[intersection.y_coord, intersection.x_coord]}
                radius={8}
                fillColor="#00ecff"
                color="#fff"
                weight={2}
                fillOpacity={0.8}
              />
            </MapContainer>
            {/* 위성 지도 위에 4색/2색 신호등을 정확한 방향 각도에 맞춰 오버레이 */}
            <CompassOverlay phase={phase} remainTime={remainTime} activeDirections={[0, 90, 180, 270]} />
          </div>
        </div>

        <div className="modal-bottom-data">
          <div className="tabs-header">
            <button className={`tab-btn ${activeTab === 'detail' ? 'active' : ''}`} onClick={() => setActiveTab('detail')}>상세 신호정보</button>
            <button className={`tab-btn ${activeTab === 'signalmap' ? 'active' : ''}`} onClick={() => setActiveTab('signalmap')}>시그널맵 (LSU & Step)</button>
          </div>
          <div className="detail-tab-content custom-scroll">
            {activeTab === 'detail' && (
              <table className="detail-grid-table">
                <thead>
                  <tr>
                    <th>방향정보</th>
                    <th>보행자</th>
                    <th>뱅크코드</th>
                    <th>시간제신호</th>
                    <th>출력형태</th>
                    <th>신호등상태</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="action-type">북</td>
                    <td>-</td>
                    <td>-</td>
                    <td>-</td>
                    <td><span className="status-badge" style={{color:'#60a5fa'}}>직진(1)</span></td>
                    <td><span style={{color: '#94a3b8', background: 'rgba(148, 163, 184, 0.1)', padding: '3px 8px', borderRadius: '4px', border: '1px solid rgba(148, 163, 184, 0.2)', fontSize: '11px'}}>소등</span></td>
                  </tr>
                  <tr>
                    <td className="action-type">북</td>
                    <td>-</td>
                    <td>-</td>
                    <td>-</td>
                    <td><span className="status-badge" style={{color:'#60a5fa'}}>보행(3)</span></td>
                    <td><span style={{color: '#94a3b8', background: 'rgba(148, 163, 184, 0.1)', padding: '3px 8px', borderRadius: '4px', border: '1px solid rgba(148, 163, 184, 0.2)', fontSize: '11px'}}>소등</span></td>
                  </tr>
                  <tr>
                    <td className="action-type">북동</td>
                    <td>-</td>
                    <td>-</td>
                    <td>-</td>
                    <td><span className="status-badge" style={{color:'#60a5fa'}}>좌회전(2)</span></td>
                    <td><span style={{color: '#94a3b8', background: 'rgba(148, 163, 184, 0.1)', padding: '3px 8px', borderRadius: '4px', border: '1px solid rgba(148, 163, 184, 0.2)', fontSize: '11px'}}>소등</span></td>
                  </tr>
                  <tr>
                    <td className="action-type">동</td>
                    <td>-</td>
                    <td>-</td>
                    <td>-</td>
                    <td><span className="status-badge" style={{color:'#60a5fa'}}>보행(3)</span></td>
                    <td><span style={{color: '#94a3b8', background: 'rgba(148, 163, 184, 0.1)', padding: '3px 8px', borderRadius: '4px', border: '1px solid rgba(148, 163, 184, 0.2)', fontSize: '11px'}}>소등</span></td>
                  </tr>
                  <tr>
                    <td className="action-type">남</td>
                    <td>-</td>
                    <td>-</td>
                    <td>-</td>
                    <td><span className="status-badge" style={{color:'#60a5fa'}}>직진(1)</span></td>
                    <td><span style={{color: '#94a3b8', background: 'rgba(148, 163, 184, 0.1)', padding: '3px 8px', borderRadius: '4px', border: '1px solid rgba(148, 163, 184, 0.2)', fontSize: '11px'}}>소등</span></td>
                  </tr>
                  <tr>
                    <td className="action-type">남서</td>
                    <td>-</td>
                    <td>-</td>
                    <td>-</td>
                    <td><span className="status-badge" style={{color:'#60a5fa'}}>좌회전(2)</span></td>
                    <td><span style={{color: '#94a3b8', background: 'rgba(148, 163, 184, 0.1)', padding: '3px 8px', borderRadius: '4px', border: '1px solid rgba(148, 163, 184, 0.2)', fontSize: '11px'}}>소등</span></td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>
          <footer className="operation-footer" style={{flexDirection: 'column', gap: '15px', alignItems: 'stretch', padding: '15px 20px'}}>
            <div className="op-items" style={{display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px'}}>
              <div className="op-item"><span className="op-label" style={{color: '#38bdf8', fontWeight: 'bold'}}>운영정보</span><span className="op-val" style={{color: '#38bdf8'}}>주기 미연동</span></div>
              <div className="op-item"><span className="op-label">오프셋</span><span className="op-val">-</span></div>
              <div className="op-item"><span className="op-label">전이</span><span className="op-val" style={{color: '#64748b'}}>OFF</span></div>
              <div className="op-item"><span className="op-label">감응</span><span className="op-val" style={{color: '#64748b'}}>OFF</span></div>
              <div className="op-item"><span className="op-label">소등</span><span className="op-val" style={{color: '#64748b'}}>OFF</span></div>
              <div className="op-item"><span className="op-label">점멸</span><span className="op-val" style={{color: '#64748b'}}>OFF</span></div>
              <div className="op-item"><span className="op-label">수동</span><span className="op-val" style={{color: '#64748b'}}>OFF</span></div>
            </div>
            <button className="btn-download" style={{width: '100%', padding: '10px', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10b981', color: '#10b981', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer'}}>
              📄 운영계획(TOD) 다운로드
            </button>
            <div style={{marginTop: '5px'}}>
              <a href="#more" style={{color: '#38bdf8', fontSize: '11px', textDecoration: 'none'}}>추가 상세 정보</a>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}

// [4] 사이드바 트리 (Accordion) 컴포넌트
function SidebarAccordion({ intersections, onNodeClick, activeNodeId }) {
  // 데이터 그룹화 로직 (useMemo 활용)
  const { tdataList, uticGroups } = useMemo(() => {
    const tdata = [];
    const utic = {};

    intersections.forEach(item => {
      // origin_type 판별 (가정: '서울tdata', 'tdata' 또는 'UTIC', 'utic')
      const isTdata = item.origin_type?.toLowerCase().includes('tdata');
      if (isTdata) {
        tdata.push(item);
      } else {
        const region = item.region_cd || '기타지역';
        if (!utic[region]) utic[region] = [];
        utic[region].push(item);
      }
    });
    return { tdataList: tdata, uticGroups: utic };
  }, [intersections]);

  // 아코디언 상태 관리
  const [tdataOpen, setTdataOpen] = useState(true);
  const [uticOpen, setUticOpen] = useState(true);
  const [openRegions, setOpenRegions] = useState({});

  const toggleRegion = (region) => {
    setOpenRegions(prev => ({ ...prev, [region]: !prev[region] }));
  };

  return (
    <div className="accordion-wrapper custom-scroll">
      
      {/* 1. 서울 Tdata 그룹 */}
      <div className="acc-group">
        <div className="acc-header" onClick={() => setTdataOpen(!tdataOpen)}>
          <span className="acc-icon">{tdataOpen ? '▼' : '▶'}</span>
          🏛️ 서울Tdata 개방데이터 <span className="acc-count">({tdataList.length})</span>
        </div>
        {tdataOpen && (
          <div className="acc-body">
            {tdataList.map(item => (
              <div 
                key={item.id} 
                className={`tree-item ${activeNodeId === item.id ? 'selected' : ''}`}
                onClick={() => onNodeClick(item.id)}
              >
                <div className="status-dot" style={{background: activeNodeId === item.id ? '#38bdf8' : '#64748b'}}></div>
                <span className="id-label">[{item.int_no}]</span>
                <span className="name-label">{item.int_nm}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 2. UTIC 그룹 */}
      <div className="acc-group">
        <div className="acc-header" onClick={() => setUticOpen(!uticOpen)}>
          <span className="acc-icon">{uticOpen ? '▼' : '▶'}</span>
          🚓 경찰청 UTIC 개방데이터
        </div>
        {uticOpen && (
          <div className="acc-body">
            {Object.entries(uticGroups).map(([region, list]) => (
              <div key={region} className="acc-subgroup">
                <div className="acc-sub-header" onClick={() => toggleRegion(region)}>
                  <span className="acc-icon">{openRegions[region] ? '▼' : '▶'}</span>
                  📍 {region} 지역 <span className="acc-count">({list.length})</span>
                </div>
                {openRegions[region] && (
                  <div className="acc-sub-body">
                    {list.map(item => (
                      <div 
                        key={item.id} 
                        className={`tree-item ${activeNodeId === item.id ? 'selected' : ''}`}
                        onClick={() => onNodeClick(item.id)}
                      >
                        <div className="status-dot" style={{background: activeNodeId === item.id ? '#38bdf8' : '#64748b'}}></div>
                        <span className="id-label">[{item.int_no}]</span>
                        <span className="name-label">{item.int_nm}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      
    </div>
  );
}

// [5] 메인 레이아웃
function App() {
  const [intersections, setIntersections] = useState([]);
  const [detailIntersection, setDetailIntersection] = useState(null); // 상세보기(모달) 타겟
  const [activeNodeId, setActiveNodeId] = useState(null); // 트리뷰 및 지도 포커스 타겟

  useEffect(() => {
    const fetchIntersections = async () => {
      try {
        const response = await axios.get(`${API_BASE}/api/intersections`);
        setIntersections(response.data);
      } catch (error) {
        console.error("교차로 데이터 로드 실패", error);
      }
    };
    fetchIntersections();
  }, []);

  const handleNodeClick = (id) => {
    setActiveNodeId(id);
  };

  const openDetail = (intersection) => {
    setDetailIntersection(intersection);
  };

  return (
    <>
      <aside className="sidebar glass">
        <header className="sidebar-header">
          <h1>🚦 SIGMA T-DATA</h1>
        </header>
        <div className="search-box">
          <input type="text" placeholder="교차로명 검색..." />
          <button>🔍</button>
        </div>
        
        {/* 트리뷰 컴포넌트 연결 */}
        <SidebarAccordion 
          intersections={intersections} 
          onNodeClick={handleNodeClick} 
          activeNodeId={activeNodeId} 
        />
        
      </aside>

      <main className="main-content">
        <div className="top-map-wrapper">
          <MapContainer center={[37.5665, 126.9780]} zoom={12} style={{width:'100%', height:'100%'}} preferCanvas={true}>
            <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" attribution='&copy; CARTO' />
            <IntersectionMarkers 
              intersections={intersections} 
              onDetailClick={openDetail}
              targetId={activeNodeId}
            />
          </MapContainer>
        </div>

        <div className="bottom-table-wrapper">
          <div className="table-header-title">
            <span>📊 실시간 교차로 운영 상태</span>
            <span>전체: {intersections.length}개</span>
          </div>
          <div className="table-scroll custom-scroll">
            <table className="status-table">
              <thead>
                <tr>
                  <th>센터명</th><th>제어기번호</th><th>교차로명</th>
                  <th>전이</th><th>감응</th><th>소등</th><th>점멸</th><th>수동</th>
                  <th>SCU통신</th><th>센터통신</th><th>모순이상</th>
                </tr>
              </thead>
              <tbody>
                {intersections.slice(0, 10).map(item => (
                  <tr key={item.id} style={{background: activeNodeId === item.id ? 'rgba(56, 189, 248, 0.1)' : ''}}>
                    <td>-</td>
                    <td style={{color:'var(--accent-primary)', fontWeight:'bold'}}>{item.int_no}</td>
                    <td style={{fontWeight:'bold'}}>{item.int_nm}</td>
                    <td style={{color:'var(--text-muted)'}}>OFF</td>
                    <td style={{color:'var(--text-muted)'}}>OFF</td>
                    <td style={{color:'var(--text-muted)'}}>OFF</td>
                    <td style={{color:'var(--text-muted)'}}>OFF</td>
                    <td style={{color:'var(--text-muted)'}}>OFF</td>
                    <td style={{color:'var(--sig-green)'}}>정상</td>
                    <td style={{color:'var(--sig-green)'}}>정상</td>
                    <td style={{color:'var(--sig-green)'}}>정상</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {detailIntersection && (
        <SingleDetailOverlay intersection={detailIntersection} onClose={() => setDetailIntersection(null)} />
      )}
    </>
  );
}

export default App;
