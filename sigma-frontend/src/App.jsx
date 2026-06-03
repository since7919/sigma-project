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

// [2] 8방향 시그널 렌즈 컴포넌트 (원본 TSI 완벽 이식)
function OctagonLens({ phase, activeDirections }) {
  // 0(북), 45(북동), 90(동), 135(남동), 180(남), 225(남서), 270(서), 315(북서)
  const allDirections = [0, 45, 90, 135, 180, 225, 270, 315];
  
  // 데이터가 있는 방향만 필터링 (수신되지 않는 방향은 숨김 처리)
  const renderDirections = allDirections.filter(dir => activeDirections.includes(dir));

  return (
    <div className="signal-board">
      <div className="center-label">
        <span style={{fontSize:'0.8rem', color:'#94a3b8'}}>PHASE</span>
        <span className="accent" style={{fontSize:'2rem'}}>{phase}</span>
      </div>
      
      {renderDirections.map(dir => {
        // 더미 상태 시뮬레이션 (이후 실제 phase 연동 시 변경 가능)
        // 원본과 동일하게 3가지(직진, 좌회전, 보행) 상태 제어
        let sState = phase % 2 !== 0 ? 'red' : 'green';
        let lState = phase === 3 || phase === 4 ? 'green' : 'red';
        let pState = phase % 2 === 0 ? 'flash' : 'red';
        
        return (
          <div key={dir} className={`direction-signal dir-${dir}`}>
            <div className="signal-cluster" style={{ transform: `rotate(${dir}deg)` }}>
              <div className="vehicle-box">
                <div className={`sig-unit s-light active-s ${sState}`} title="직진">
                  <svg viewBox="0 0 24 24"><path d="M12 4l-8 8h6v8h4v-8h6l-8-8z"/></svg>
                </div>
                <div className={`sig-unit l-light active-l ${lState}`} title="좌회전">
                  <svg viewBox="0 0 24 24" style={{ transform: 'rotate(-45deg)' }}><path d="M12 4l-8 8h6v8h4v-8h6l-8-8z"/></svg>
                </div>
              </div>
              <div className={`pedestrian-box p-light active-p ${pState}`} title="보행">
                <svg viewBox="0 0 24 24"><path d="M13.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM9.8 8.9L7 23h2.1l1.8-8 2.1 2v6h2V15l-2.1-2 .6-3C14.8 12 16.8 13 19 13v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L6 8.3V13h2V9.6l1.8-.7"/></svg>
              </div>
            </div>
          </div>
        );
      })}
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
      setPhase(p => (p % 8) + 1);
      setRemainTime(r => r > 0 ? r - 1 : 25);
    }, 3000);
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
            <span style={{color:'#10b981', marginLeft:20, fontWeight:'bold'}}>잔여시간: {remainTime}초</span>
          </div>
          <MapContainer center={[intersection.y_coord, intersection.x_coord]} zoom={19} style={{width:'100%', height:'100%'}} zoomControl={false}>
            <TileLayer url="http://mt0.google.com/vt/lyrs=s&hl=en&x={x}&y={y}&z={z}" />
          </MapContainer>
          {/* 십자 직진 방향(0, 90, 180, 270)만 수신되었다고 가정 (데이터 없으면 숨김) */}
          <OctagonLens phase={phase} activeDirections={[0, 90, 180, 270]} />
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
                  <tr><th>방향정보</th><th>보행자</th><th>뱅크코드</th><th>시간제신호</th><th>출력형태</th><th>신호등상태</th></tr>
                </thead>
                <tbody>
                  <tr><td className="action-type">북</td><td>-</td><td>-</td><td>-</td><td><span className="status-badge">직진(1)</span></td><td>대기 중</td></tr>
                  <tr><td className="action-type">북</td><td>-</td><td>-</td><td>-</td><td><span className="status-badge">보행(3)</span></td><td>대기 중</td></tr>
                  <tr><td className="action-type">북동</td><td>-</td><td>-</td><td>-</td><td><span className="status-badge">좌회전(2)</span></td><td>대기 중</td></tr>
                  <tr><td className="action-type">동</td><td>-</td><td>-</td><td>-</td><td><span className="status-badge">보행(3)</span></td><td>대기 중</td></tr>
                </tbody>
              </table>
            )}
          </div>
          <footer className="operation-footer">
            <div className="op-items">
              <div className="op-item"><span className="op-label">운영정보</span><span className="op-val" style={{color:'#38bdf8'}}>주기 미연동</span></div>
              <div className="op-item"><span className="op-label">오프셋</span><span className="op-val">-</span></div>
              <div className="op-item"><span className="op-label">전이</span><span className="op-val">OFF</span></div>
              <div className="op-item"><span className="op-label">감응</span><span className="op-val">OFF</span></div>
            </div>
            <button className="btn-download">📄 운영계획(TOD) 다운로드</button>
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
