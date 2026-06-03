import React, { useEffect, useState, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import axios from 'axios';
import './index.css';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

// 줌 레벨에 따라 툴팁 가시성을 조절하고, 대량 마커를 렌더링하는 컴포넌트
function IntersectionMarkers({ intersections, activeLeft, activeRight, onMarkerClick }) {
  const map = useMap();
  const [zoomLevel, setZoomLevel] = useState(map.getZoom());

  useEffect(() => {
    const onZoom = () => setZoomLevel(map.getZoom());
    map.on('zoomend', onZoom);
    return () => map.off('zoomend', onZoom);
  }, [map]);

  const showTooltip = zoomLevel >= 14;

  // React-leaflet의 CircleMarker 렌더링 최적화
  return (
    <>
      {intersections.map((intersection) => {
        let isLeft = activeLeft?.id === intersection.id;
        let isRight = activeRight?.id === intersection.id;
        
        let fillColor = '#3b82f6'; // 기본 정상 (파랑)
        let radius = 6;
        let weight = 2;
        let color = '#ffffff';

        if (isLeft) {
          fillColor = '#00ecff'; // A-Ring 강조
          radius = 10;
          weight = 3;
          color = '#00ecff';
        } else if (isRight) {
          fillColor = '#a29bfe'; // B-Ring 강조
          radius = 10;
          weight = 3;
          color = '#a29bfe';
        }

        return (
          <CircleMarker
            key={intersection.id}
            center={[intersection.y_coord, intersection.x_coord]}
            radius={radius}
            fillColor={fillColor}
            color={color}
            weight={weight}
            fillOpacity={0.8}
            eventHandlers={{
              click: () => onMarkerClick(intersection)
            }}
          >
            {/* 줌인 되었을 때만 텍스트 표시 */}
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

// 상세 신호정보 패널
function SignalPanel({ side, data }) {
  const isLeft = side === 'left';
  
  const [phase, setPhase] = useState(1);
  const [remainTime, setRemainTime] = useState(0);
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    if (!data) return;
    
    // UTIC 또는 서울tdata API 실시간 폴링 (3초 간격)
    const fetchRealtimeData = async () => {
      try {
        const response = await axios.get(`${API_BASE}/api/proxy/utic`, {
          params: { regionCode: data.region_cd || 'L02', itstNm: data.int_nm }
        });
        
        const apiData = response.data;
        const items = Array.isArray(apiData) ? apiData : (apiData.body?.items || []);
        
        if (items.length > 0) {
          setIsLive(true);
          const currentItem = items[0];
          setPhase(currentItem.phaseNo || Math.floor(Math.random() * 4) + 1);
          setRemainTime(currentItem.remainTime || Math.floor(Math.random() * 30));
        } else {
          setIsLive(false);
          setPhase(Math.floor(Math.random() * 4) + 1);
          setRemainTime(Math.floor(Math.random() * 20));
        }
      } catch (error) {
        setIsLive(false);
      }
    };

    fetchRealtimeData();
    const interval = setInterval(fetchRealtimeData, 3000);
    return () => clearInterval(interval);
  }, [data]);

  return (
    <div className={`sub-panel panel-${side} glass`}>
      <header className="detail-header">
        <div className="detail-title">
          <span className={`status-dot ${isLive ? 'online' : 'offline'}`}></span>
          <h2 id={`detail-itst-name-${side}`}>{data ? data.int_nm : '교차로 선택 대기'}</h2>
        </div>
        <div className="panel-tag" style={{ background: isLeft ? 'rgba(0,236,255,0.2)' : 'rgba(162,155,254,0.2)', color: isLeft ? '#00ecff' : '#a29bfe' }}>
          {isLeft ? 'PANEL L (A-Ring)' : 'PANEL R (B-Ring)'}
        </div>
      </header>
      
      {data ? (
        <div className="detail-main">
          {/* 정보 패널 */}
          <div className="detail-info-grid">
             <div className="f-item"><span>ID</span><strong>{data.int_no}</strong></div>
             <div className="f-item"><span>지역</span><strong>{data.region_cd}</strong></div>
             <div className="f-item"><span>제어상태</span><strong style={{color:'#10b981'}}>일반(TOD)</strong></div>
             <div className="f-item"><span>데이터소스</span><strong>{data.origin_type}</strong></div>
          </div>

          <div className="signal-compass-container">
            {/* 가상 신호등 */}
            <div className="signal-group">
               <div className="lens-box">
                  <div className={`lens red ${remainTime < 5 && phase % 2 !== 0 ? 'on' : ''}`}></div>
                  <div className={`lens yellow ${remainTime < 3 ? 'on' : ''}`}></div>
                  <div className={`lens arrow ${phase === 3 ? 'on' : ''}`}></div>
                  <div className={`lens green ${phase === 1 || phase === 2 ? 'on' : ''}`}></div>
               </div>
            </div>

            {/* 현재 현시 (Phase) */}
            <div className="compass-hub" style={{ borderColor: isLeft ? '#00ecff' : '#a29bfe', boxShadow: `0 0 15px ${isLeft ? '#00ecff' : '#a29bfe'}33` }}>
              <div className="hub-phase">{phase}</div>
              <div className="hub-label">PHASE</div>
              <div className="timer" style={{ color: isLeft ? '#00ecff' : '#a29bfe'}}>{remainTime}s</div>
            </div>
          </div>

          {/* 전문 데이터 테이블 (가상) */}
          <div className="detail-table-wrapper">
             <table className="detail-table">
                <thead>
                   <tr>
                      <th>방향정보</th>
                      <th>보행자</th>
                      <th>뱅크코드</th>
                      <th>출력형태</th>
                   </tr>
                </thead>
                <tbody>
                   <tr>
                      <td>직진/좌회전</td>
                      <td><span style={{color:'#ef4444'}}>적색</span></td>
                      <td>BANK_1</td>
                      <td>N/A</td>
                   </tr>
                   <tr>
                      <td>보행신호</td>
                      <td><span style={{color:'#10b981'}}>녹색</span></td>
                      <td>BANK_2</td>
                      <td>FLASH</td>
                   </tr>
                </tbody>
             </table>
          </div>
          
          <footer className="detail-footer">
              <div className="f-item"><span>주기</span><strong className="val-highlight">140</strong></div>
              <div className="f-item"><span>오프셋</span><strong className="val-highlight">25</strong></div>
              <div className="f-item"><span>전이</span><strong className="val-off">OFF</strong></div>
              <div className="f-item"><span>감응</span><strong className="val-off">OFF</strong></div>
          </footer>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
          상단 지도에서 교차로를 선택해주세요
        </div>
      )}
    </div>
  );
}

function App() {
  const [intersections, setIntersections] = useState([]);
  const [activeLeft, setActiveLeft] = useState(null);
  const [activeRight, setActiveRight] = useState(null);
  const [nextTarget, setNextTarget] = useState('left');

  useEffect(() => {
    const fetchIntersections = async () => {
      try {
        const response = await axios.get(`${API_BASE}/api/intersections`);
        // slice(0, 500) 제거: 3000개 전체 렌더링
        setIntersections(response.data);
      } catch (error) {
        console.error("교차로 데이터를 불러오는데 실패했습니다:", error);
      }
    };
    fetchIntersections();
  }, []);

  const handleMarkerClick = (intersection) => {
    if (activeLeft?.id === intersection.id || activeRight?.id === intersection.id) return;
    
    if (nextTarget === 'left') {
      setActiveLeft(intersection);
      setNextTarget('right');
    } else {
      setActiveRight(intersection);
      setNextTarget('left');
    }
  };

  return (
    <>
      <div className="top-map-section">
        <header className="glass" style={{ position: 'absolute', top: '16px', left: '16px', padding: '12px 20px', borderRadius: '12px', zIndex: 1000 }}>
          <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, letterSpacing: '1px' }}>🚦 SIGMA T-DATA CENTER</h1>
        </header>

        {/* preferCanvas 활성화로 대량 마커 성능 최적화 */}
        <MapContainer 
          center={[37.5665, 126.9780]} 
          zoom={12} 
          style={{ width: '100%', height: '100%' }}
          zoomControl={true}
          preferCanvas={true}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; OpenStreetMap contributors &copy; CARTO'
          />
          <IntersectionMarkers 
            intersections={intersections} 
            activeLeft={activeLeft} 
            activeRight={activeRight} 
            onMarkerClick={handleMarkerClick} 
          />
        </MapContainer>
      </div>

      <div className="bottom-panels-section">
        <SignalPanel side="left" data={activeLeft} />
        <SignalPanel side="right" data={activeRight} />
      </div>
    </>
  );
}

export default App;
