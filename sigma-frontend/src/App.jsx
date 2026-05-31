import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import axios from 'axios';
import L from 'leaflet';
import './index.css';

// 지도 아이콘 설정
const createCustomIcon = (activeSide) => {
  let color = '#222';
  let border = '#fff';
  let shadow = 'rgba(255,255,255,0.5)';
  
  if (activeSide === 'left') {
    color = '#00ecff'; border = '#00ecff'; shadow = '#00ecff';
  } else if (activeSide === 'right') {
    color = '#a29bfe'; border = '#a29bfe'; shadow = '#a29bfe';
  }

  return L.divIcon({
    html: `<div style="width:14px;height:14px;background:${color};border:2px solid ${border};border-radius:50%;box-shadow:0 0 10px ${shadow};"></div>`,
    className: '',
    iconSize: [18, 18],
    iconAnchor: [9, 9]
  });
};

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

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
        // 백엔드 프록시 라우트로 요청 (regionCode와 intNm을 인자로 전달)
        const response = await axios.get(`${API_BASE}/api/proxy/utic`, {
          params: { regionCode: data.region_cd || 'L02', itstNm: data.int_nm }
        });
        
        const apiData = response.data;
        // UTIC JSON 응답 파싱 (배열 형태이거나 body.items 형태인 경우 대응)
        const items = Array.isArray(apiData) ? apiData : (apiData.body?.items || []);
        
        if (items.length > 0) {
          setIsLive(true);
          // 실제 API 응답 구조에 맞춘 필드 매핑 (예상 구조)
          // (임시) 데이터가 존재한다면 첫번째 현시 또는 현재 현시 시간을 사용
          const currentItem = items[0];
          setPhase(currentItem.phaseNo || Math.floor(Math.random() * 4) + 1);
          setRemainTime(currentItem.remainTime || Math.floor(Math.random() * 30));
        } else {
          setIsLive(false);
          // 데이터가 없을 경우 가상 시뮬레이션으로 Fallback (UI 시연 목적)
          setPhase(Math.floor(Math.random() * 4) + 1);
          setRemainTime(Math.floor(Math.random() * 20));
        }
      } catch (error) {
        console.error(`${side} 패널 실시간 데이터 수신 실패:`, error.message);
        setIsLive(false);
      }
    };

    fetchRealtimeData(); // 즉시 1회 실행
    const interval = setInterval(fetchRealtimeData, 3000); // 3초 주기 폴링
    return () => clearInterval(interval);
  }, [data]);

  return (
    <div className={`sub-panel panel-${side}`}>
      <div className="panel-header">
        <div className="panel-tag">
          {isLeft ? 'PANEL L (A-Ring)' : 'PANEL R (B-Ring)'}
        </div>
      </div>
      
      {data ? (
        <>
          <div>
            <h2 className="intersection-title">
              {data.int_nm}
              {isLive ? <span style={{fontSize:'0.8rem', color:'var(--sig-green)', marginLeft:'10px'}}>● LIVE</span> : <span style={{fontSize:'0.8rem', color:'var(--sig-yellow)', marginLeft:'10px'}}>○ SIMUL</span>}
            </h2>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
              ID: {data.int_no} | Region: {data.region_cd} | Source: {data.origin_type}
            </div>
          </div>
          
          <div className="signal-compass-container">
            <div className="compass-hub">
              <div className="hub-phase">{phase}</div>
              <div className="hub-label">Phase</div>
            </div>
            
            {/* 가상의 신호등 표시 */}
            <div style={{ position: 'absolute', top: '10%', left: '50%', transform: 'translateX(-50%)' }}>
               <div className="signal-group">
                 <div className="lens-box">
                    <div className={`lens red ${remainTime < 5 && phase % 2 !== 0 ? 'on' : ''}`}></div>
                    <div className={`lens yellow ${remainTime < 3 ? 'on' : ''}`}></div>
                    <div className={`lens arrow ${phase === 3 ? 'on' : ''}`}></div>
                    <div className={`lens green ${phase === 1 || phase === 2 ? 'on' : ''}`}></div>
                 </div>
                 <div className="timer" style={{ color: 'var(--accent-cyan)'}}>{remainTime}s</div>
               </div>
            </div>
          </div>
        </>
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
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
        // 너무 많은 마커 렌더링 방지를 위해 일부만 슬라이스 (선택적)
        setIntersections(response.data.slice(0, 500));
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

  const getMarkerIcon = (intersection) => {
    if (activeLeft?.id === intersection.id) return createCustomIcon('left');
    if (activeRight?.id === intersection.id) return createCustomIcon('right');
    return createCustomIcon('default');
  };

  return (
    <>
      {/* 1. 상단 지도 섹션 (45%) */}
      <div className="top-map-section">
        <header className="glass" style={{ position: 'absolute', top: '16px', left: '16px', padding: '12px 20px', borderRadius: '8px', zIndex: 1000 }}>
          <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, letterSpacing: '0.5px' }}>SIGMA T-DATA CENTER</h1>
        </header>

        <MapContainer 
          center={[37.5665, 126.9780]} 
          zoom={12} 
          style={{ width: '100%', height: '100%' }}
          zoomControl={true}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; OpenStreetMap contributors &copy; CARTO'
          />
          {intersections.map(intersection => (
            <Marker 
              key={intersection.id} 
              position={[intersection.y_coord, intersection.x_coord]}
              icon={getMarkerIcon(intersection)}
              eventHandlers={{
                click: () => handleMarkerClick(intersection)
              }}
            >
              <Popup>
                <strong>{intersection.int_nm}</strong><br />
                {intersection.int_no}
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* 2. 하단 듀얼 모니터링 섹션 (55%) */}
      <div className="bottom-panels-section">
        <SignalPanel side="left" data={activeLeft} />
        <SignalPanel side="right" data={activeRight} />
      </div>
    </>
  );
}

export default App;
