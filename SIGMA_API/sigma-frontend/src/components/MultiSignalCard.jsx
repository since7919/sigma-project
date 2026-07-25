import React, { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, useMap } from 'react-leaflet';
import axios from 'axios';
import CompassOverlay from './CompassOverlay';
import { useSignalPhases } from '../hooks/useSignalPhases';
import { useRealtimeSignal } from '../hooks/useRealtimeSignal';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

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

export default function MultiSignalCard({ intersection, uticUpdateTick, onRemove, displayMode, isSoloFullscreen, mainPhases }) {
  const {
    cropData,
    phaseA,
    phaseB,
    remainA,
    remainB,
    sigMapData
  } = useRealtimeSignal({ intersection, mainPhases });

  const [currentTimeStr, setCurrentTimeStr] = useState('-');
  const [utcTimeStr, setUtcTimeStr] = useState('-');

  const isSeoul = useMemo(() => {
    return intersection.origin_type?.toLowerCase().includes('tdata') || false;
  }, [intersection]);

  const phasesInfo = useSignalPhases({ intersection, isSeoul, cropData, phaseA, phaseB, remainA, remainB, uticUpdateTick, sigMapData, customAngles: intersection.custom_angles });

  // 실시간 타이머 및 시간 업데이트 연동
  useEffect(() => {
    const updateTime = () => {
      const now = new Date(Date.now() + (window.SIGMA_TIME_OFFSET || 0));
      setCurrentTimeStr(now.getFullYear() + '-' + 
        String(now.getMonth()+1).padStart(2,'0') + '-' + 
        String(now.getDate()).padStart(2,'0') + ' ' + 
        now.toLocaleTimeString('ko-KR', {hour12:false}));
      setUtcTimeStr(now.toISOString().substring(11, 19));
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const isApiOn = isSeoul ? (window.SEOUL_SPAT_MAP && window.SEOUL_SPAT_MAP[intersection.int_no]) : cropData;



  return (
    <div className="multi-card">
      <header className="multi-card-header">
        <span className="card-title" title={intersection.int_nm}>{intersection.int_nm}</span>
        <span className="card-id">#{intersection.int_no}</span>
        <button className="btn-card-close" onClick={onRemove}>×</button>
      </header>
      <div className="multi-card-body">
        <div style={{position: 'relative', width: '100%', height: '100%'}}>
          {useMemo(() => (
            <MapContainer 
              center={[intersection.y_coord, intersection.x_coord]} 
              zoom={20} 
              style={{width:'100%', height:'100%'}} 
              zoomControl={false}
              dragging={false}
              touchZoom={false}
              doubleClickZoom={false}
              scrollWheelZoom={false}
              boxZoom={false}
              keyboard={false}
            >
              <MapAutoResizer />
              <TileLayer url="https://mt0.google.com/vt/lyrs=s&hl=ko&x={x}&y={y}&z={z}" />
              <CircleMarker
                center={[intersection.y_coord, intersection.x_coord]}
                radius={6}
                fillColor="#00ecff"
                color="#fff"
                weight={2}
                fillOpacity={0.8}
              />
            </MapContainer>
          ), [intersection.y_coord, intersection.x_coord])}
          <CompassOverlay 
            displayMode={displayMode}
            updatedPhases={phasesInfo.unique}
          />
        </div>
      </div>
      <footer className="multi-card-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', textAlign: 'left' }}>
          <span style={{ fontSize: '0.65rem' }}>{isSeoul ? '서울 T-data' : `경찰청 UTIC_${intersection.region_cd || ''} ${REGION_MAP[intersection.region_cd] || ''}`.trim()}</span>
          <span style={{ fontSize: '0.6rem', color: '#64748b', fontFamily: 'monospace' }}>🕒 {currentTimeStr}</span>
        </div>
        <span className={`api-indicator ${isApiOn ? 'on' : 'off'}`}>
          API: {isApiOn ? 'ON' : 'OFF'}
        </span>
      </footer>
    </div>
  );
}
