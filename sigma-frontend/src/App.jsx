import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Tooltip, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import axios from 'axios';
import './index.css';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

// [1] 마커 최적화 렌더링 컴포넌트
function IntersectionMarkers({ intersections, onDetailClick }) {
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
      {intersections.map((intersection) => (
        <CircleMarker
          key={intersection.id}
          center={[intersection.y_coord, intersection.x_coord]}
          radius={6}
          fillColor="#64748b"
          color="#334155"
          weight={2}
          fillOpacity={0.8}
        >
          {/* 마커 툴팁 (이름 표출용) */}
          {showTooltip && (
            <Tooltip direction="top" offset={[0, -10]} permanent className="map-label">
              {intersection.int_nm}
            </Tooltip>
          )}
          
          {/* 클릭 시 나타나는 팝업 (첫 번째 캡처 화면 복원) */}
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
      ))}
    </>
  );
}

// [2] 8방향 시그널 렌즈 컴포넌트 (모달 위성 지도 중앙 배치용)
function OctagonLens({ phase }) {
  const directions = ['N', 'E', 'S', 'W', 'NE', 'SE', 'SW', 'NW'];
  return (
    <div className="octagon-lens-container">
      <div className="center-node"><div className="center-inner"></div></div>
      {directions.map(dir => (
        <div key={dir} className={`directional-lens-group dir-${dir}`}>
          <div className={`lens red ${phase % 2 !== 0 ? 'on' : ''}`}></div>
          <div className={`lens yellow ${phase === 3 ? 'on' : ''}`}></div>
          <div className={`lens arrow ${dir === 'N' || dir === 'S' ? 'on' : ''}`}></div>
          <div className={`lens green ${phase % 2 === 0 ? 'on' : ''}`}></div>
        </div>
      ))}
    </div>
  );
}

// [3] 단일 교차로 상세 모니터링 (Single Detail Overlay)
function SingleDetailOverlay({ intersection, onClose }) {
  const [activeTab, setActiveTab] = useState('detail');
  const [phase, setPhase] = useState(1);

  useEffect(() => {
    const interval = setInterval(() => setPhase(p => (p % 8) + 1), 3000);
    return () => clearInterval(interval);
  }, []);

  if (!intersection) return null;

  return (
    <div className="detail-modal-overlay">
      <div className="detail-modal-content">
        {/* 상단 헤더 */}
        <header className="modal-header">
          <h2>🚦 {intersection.int_nm} <span style={{fontSize:'0.8rem', color:'#94a3b8', marginLeft:10}}>ID: {intersection.int_no}</span></h2>
          <button className="btn-close" onClick={onClose}>×</button>
        </header>

        {/* 상단 55%: 위성 지도 및 시그널 렌즈 */}
        <div className="modal-top-map">
          <div className="overlay-toolbar">
            <button className="toolbar-btn active">전체 정보 모드</button>
            <button className="toolbar-btn">맵 확대 모드</button>
          </div>
          <MapContainer center={[intersection.y_coord, intersection.x_coord]} zoom={18} style={{width:'100%', height:'100%'}} zoomControl={false}>
            <TileLayer url="http://mt0.google.com/vt/lyrs=s&hl=en&x={x}&y={y}&z={z}" />
          </MapContainer>
          <OctagonLens phase={phase} />
        </div>

        {/* 하단 45%: 상세 탭, 테이블, 운영정보 */}
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
                    <th>방향정보</th><th>보행자</th><th>뱅크코드</th><th>시간제신호</th><th>출력형태</th><th>신호등상태</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td className="action-type">북</td><td>-</td><td>-</td><td>-</td><td><span className="status-badge">직진(1)</span></td><td>대기 중</td></tr>
                  <tr><td className="action-type">북</td><td>-</td><td>-</td><td>-</td><td><span className="status-badge">보행(3)</span></td><td>대기 중</td></tr>
                  <tr><td className="action-type">북동</td><td>-</td><td>-</td><td>-</td><td><span className="status-badge">좌회전(2)</span></td><td>대기 중</td></tr>
                  <tr><td className="action-type">동</td><td>-</td><td>-</td><td>-</td><td><span className="status-badge">보행(3)</span></td><td>대기 중</td></tr>
                  <tr><td className="action-type">남</td><td>-</td><td>-</td><td>-</td><td><span className="status-badge">직진(1)</span></td><td>대기 중</td></tr>
                  <tr><td className="action-type">남서</td><td>-</td><td>-</td><td>-</td><td><span className="status-badge">좌회전(2)</span></td><td>대기 중</td></tr>
                </tbody>
              </table>
            )}
            {activeTab === 'signalmap' && (
              <div style={{padding:20, color:'#94a3b8', textAlign:'center'}}>
                시그널맵(LSU & Step) 데이터 준비중...
              </div>
            )}
          </div>

          {/* 최하단 운영정보 */}
          <footer className="operation-footer">
            <div className="op-items">
              <div className="op-item"><span className="op-label">운영정보</span><span className="op-val" style={{color:'#38bdf8'}}>주기 미연동</span></div>
              <div className="op-item"><span className="op-label">오프셋</span><span className="op-val">-</span></div>
              <div className="op-item"><span className="op-label">전이</span><span className="op-val">OFF</span></div>
              <div className="op-item"><span className="op-label">감응</span><span className="op-val">OFF</span></div>
              <div className="op-item"><span className="op-label">소등</span><span className="op-val">OFF</span></div>
              <div className="op-item"><span className="op-label">점멸</span><span className="op-val">OFF</span></div>
              <div className="op-item"><span className="op-label">수동</span><span className="op-val">OFF</span></div>
            </div>
            <button className="btn-download">📄 운영계획(TOD) 다운로드</button>
          </footer>
        </div>
      </div>
    </div>
  );
}

// [4] 메인 애플리케이션 레이아웃
function App() {
  const [intersections, setIntersections] = useState([]);
  const [detailIntersection, setDetailIntersection] = useState(null); // 상세보기 타겟

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
        <div className="tree-container custom-scroll">
          <div style={{color:'var(--accent-primary)', fontSize:'0.8rem', marginBottom:'10px', fontWeight:700}}>▼ 전체 교차로 목록 ({intersections.length})</div>
          {intersections.slice(0, 200).map(item => (
            <div key={item.id} className="tree-item" onClick={() => openDetail(item)}>
              <div className="status-dot" style={{background: '#64748b'}}></div>
              <span className="id-label">[{item.int_no}]</span>
              <span className="name-label">{item.int_nm}</span>
            </div>
          ))}
        </div>
      </aside>

      <main className="main-content">
        <div className="top-map-wrapper">
          <MapContainer center={[37.5665, 126.9780]} zoom={12} style={{width:'100%', height:'100%'}} preferCanvas={true}>
            <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" attribution='&copy; CARTO' />
            <IntersectionMarkers 
              intersections={intersections} 
              onDetailClick={openDetail}
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
                  <tr key={item.id}>
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

      {/* 상세보기 모달 렌더링 */}
      {detailIntersection && (
        <SingleDetailOverlay intersection={detailIntersection} onClose={() => setDetailIntersection(null)} />
      )}
    </>
  );
}

export default App;
