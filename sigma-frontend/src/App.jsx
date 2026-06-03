import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import axios from 'axios';
import './index.css';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

// [1] 마커 최적화 렌더링 컴포넌트
function IntersectionMarkers({ intersections, selectedIds, onMarkerClick }) {
  const map = useMap();
  const [zoomLevel, setZoomLevel] = useState(map.getZoom());

  useEffect(() => {
    const onZoom = () => setZoomLevel(map.getZoom());
    map.on('zoomend', onZoom);
    return () => map.off('zoomend', onZoom);
  }, [map]);

  const showTooltip = zoomLevel >= 13;

  return (
    <>
      {intersections.map((intersection) => {
        const isSelected = selectedIds.includes(intersection.id);
        const fillColor = isSelected ? '#38bdf8' : '#64748b'; // 선택시 하늘색, 기본 회색
        
        return (
          <CircleMarker
            key={intersection.id}
            center={[intersection.y_coord, intersection.x_coord]}
            radius={isSelected ? 10 : 6}
            fillColor={fillColor}
            color={isSelected ? '#fff' : '#334155'}
            weight={isSelected ? 3 : 2}
            fillOpacity={0.8}
            eventHandlers={{ click: () => onMarkerClick(intersection) }}
          >
            {showTooltip && (
              <Tooltip direction="top" offset={[0, -10]} permanent className="map-label">
                {intersection.int_nm}
              </Tooltip>
            )}
          </CircleMarker>
        );
      })}
    </>
  );
}

// [2] 8방향 시그널 렌즈 컴포넌트 (위성 지도 중앙 오버레이용)
function OctagonLens({ phase }) {
  // 방향 배열: 북, 동, 남, 서 (간단화를 위해 4방향 십자 + 대각선 4방향)
  const directions = ['N', 'E', 'S', 'W', 'NE', 'SE', 'SW', 'NW'];
  
  return (
    <div className="octagon-lens-container">
      <div className="center-node"></div>
      {directions.map(dir => (
        <div key={dir} className={`directional-lens-group dir-${dir}`}>
          <div className={`lens red ${phase % 2 !== 0 ? 'on' : ''}`}></div>
          <div className={`lens yellow ${phase === 3 ? 'on' : ''}`}></div>
          <div className={`lens green ${phase % 2 === 0 ? 'on' : ''}`}></div>
        </div>
      ))}
    </div>
  );
}

// [3] 위성 지도 듀얼 팝업 오버레이
function DualMonitoringOverlay({ items, onClose }) {
  if (items.length !== 2) return null;
  const [item1, item2] = items;
  
  // 가상의 실시간 Phase (폴링 흉내)
  const [phase, setPhase] = useState(1);
  useEffect(() => {
    const interval = setInterval(() => setPhase(p => (p % 8) + 1), 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="dual-overlay">
      <header className="overlay-header">
        <h2 style={{margin:0, color:'#fff', fontSize:'1.2rem', fontWeight:800}}>📡 위성 기반 상세 듀얼 모니터링 (시그널 맵)</h2>
        <button className="close-btn" onClick={onClose}>X</button>
      </header>
      
      <div className="dual-container">
        {/* 첫 번째 교차로 */}
        <div className="dual-pane">
          <div className="pane-title">🚦 {item1.int_nm}</div>
          <MapContainer center={[item1.y_coord, item1.x_coord]} zoom={18} style={{width:'100%', height:'100%'}} zoomControl={false}>
            {/* 구글 위성지도 타일 (또는 VWorld) */}
            <TileLayer url="http://mt0.google.com/vt/lyrs=s&hl=en&x={x}&y={y}&z={z}" />
          </MapContainer>
          <OctagonLens phase={phase} />
        </div>
        
        {/* 두 번째 교차로 */}
        <div className="dual-pane">
          <div className="pane-title">🚦 {item2.int_nm}</div>
          <MapContainer center={[item2.y_coord, item2.x_coord]} zoom={18} style={{width:'100%', height:'100%'}} zoomControl={false}>
            <TileLayer url="http://mt0.google.com/vt/lyrs=s&hl=en&x={x}&y={y}&z={z}" />
          </MapContainer>
          <OctagonLens phase={phase + 2} />
        </div>
      </div>
    </div>
  );
}

// [4] 메인 애플리케이션
function App() {
  const [intersections, setIntersections] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [showOverlay, setShowOverlay] = useState(false);

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

  // 교차로 다중 선택 토글 (최대 2개)
  const toggleSelection = (intersection) => {
    setSelectedItems(prev => {
      const isExist = prev.find(item => item.id === intersection.id);
      if (isExist) return prev.filter(item => item.id !== intersection.id);
      if (prev.length >= 2) return [prev[1], intersection]; // 2개 초과시 오래된 것 제거 (FIFO)
      return [...prev, intersection];
    });
  };

  const selectedIds = selectedItems.map(item => item.id);

  return (
    <>
      {/* 좌측 사이드바 (트리 뷰) */}
      <aside className="sidebar glass">
        <header className="sidebar-header">
          <h1>🚦 SIGMA T-DATA</h1>
        </header>
        <div className="search-box">
          <input type="text" placeholder="교차로명 검색..." />
          <button>🔍</button>
        </div>
        <div className="tree-container">
          {/* 가상 스크롤 없이 일단 간단 렌더링 (최상단 200개만 표시하여 과부하 방지) */}
          <div style={{color:'var(--accent-primary)', fontSize:'0.8rem', marginBottom:'10px', fontWeight:700}}>▼ UTIC 전체 목록 ({intersections.length})</div>
          {intersections.slice(0, 200).map(item => (
            <div 
              key={item.id} 
              className={`tree-item ${selectedIds.includes(item.id) ? 'selected' : ''}`}
              onClick={() => toggleSelection(item)}
            >
              <input type="checkbox" checked={selectedIds.includes(item.id)} readOnly />
              <div className="status-dot" style={{background: selectedIds.includes(item.id) ? '#38bdf8' : '#64748b'}}></div>
              <span className="id-label">[{item.int_no}]</span>
              <span className="name-label">{item.int_nm}</span>
            </div>
          ))}
        </div>
      </aside>

      {/* 우측 메인 영역 */}
      <main className="main-content">
        {/* 상단: 지도 뷰어 */}
        <div className="top-map-wrapper">
          <MapContainer center={[37.5665, 126.9780]} zoom={12} style={{width:'100%', height:'100%'}} preferCanvas={true}>
            <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" attribution='&copy; CARTO' />
            <IntersectionMarkers 
              intersections={intersections} 
              selectedIds={selectedIds} 
              onMarkerClick={toggleSelection} 
            />
          </MapContainer>
        </div>

        {/* 하단: 상태 모니터링 테이블 */}
        <div className="bottom-table-wrapper">
          <div className="table-header-title">
            <span>📊 실시간 교차로 운영 상태 (13컬럼)</span>
            <span>선택 항목: {selectedItems.length}개</span>
          </div>
          <div className="table-scroll custom-scroll">
            <table className="status-table">
              <thead>
                <tr>
                  <th>센터명</th><th>제어기번호</th><th>교차로명</th>
                  <th>전이</th><th>감응</th><th>소등</th><th>점멸</th><th>수동</th>
                  <th>SCU통신</th><th>센터통신</th><th>모순이상</th><th>주기카운터</th><th>수집시각</th>
                </tr>
              </thead>
              <tbody>
                {/* 선택된 교차로 우선 렌더링, 없으면 상위 5개 표시 */}
                {(selectedItems.length > 0 ? selectedItems : intersections.slice(0, 5)).map(item => (
                  <tr key={item.id} style={{background: selectedIds.includes(item.id) ? 'rgba(56, 189, 248, 0.1)' : ''}}>
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
                    <td>-</td>
                    <td>-</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 선택 플로팅 바 */}
        {selectedItems.length > 0 && (
          <div className="floating-action-bar glass">
            <div style={{color:'#fff', fontWeight:600}}>
              {selectedItems.length === 1 
                ? `1개 선택됨: ${selectedItems[0].int_nm}`
                : `2개 선택 완료: ${selectedItems[0].int_nm} VS ${selectedItems[1].int_nm}`
              }
            </div>
            {selectedItems.length === 2 && (
              <button className="btn-primary" onClick={() => setShowOverlay(true)}>
                🔍 듀얼 모니터링 시작
              </button>
            )}
          </div>
        )}
      </main>

      {/* 위성 듀얼 오버레이 */}
      {showOverlay && (
        <DualMonitoringOverlay items={selectedItems} onClose={() => setShowOverlay(false)} />
      )}
    </>
  );
}

export default App;
