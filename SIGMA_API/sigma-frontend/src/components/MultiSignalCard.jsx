import React, { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, useMap } from 'react-leaflet';
import axios from 'axios';
import CompassOverlay from './CompassOverlay';

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

export default function MultiSignalCard({ intersection, onRemove, uticUpdateTick, displayMode }) {
  const [cropData, setCropData] = useState(null);
  const [phaseA, setPhaseA] = useState(1);
  const [phaseB, setPhaseB] = useState(1);
  const [remainA, setRemainA] = useState(0);
  const [remainB, setRemainB] = useState(0);
  const [sigMapData, setSigMapData] = useState({ ringA: [], ringB: [] });
  const [currentTimeStr, setCurrentTimeStr] = useState('-');
  const [utcTimeStr, setUtcTimeStr] = useState('-');

  const isSeoul = useMemo(() => {
    return intersection.origin_type?.toLowerCase().includes('tdata') || false;
  }, [intersection]);

  // CROP TOD 계획 정보 조회
  useEffect(() => {
    if (isSeoul) return;
    const fetchCROP = async () => {
      try {
        const regionCode = intersection.region_cd || 'L02';
        const cropUrl = `http://tsihub.utic.go.kr/tsi/api/PlanCrossRoadInfoService/getPlanCROPInfo?type=xml&srchCTId=${regionCode}&srchCRNm=${encodeURIComponent(intersection.int_nm)}&pageNo=1&numOfRows=100`;
        const res = await axios.get(`${API_BASE}/api/proxy/utic?url=${encodeURIComponent(cropUrl)}`);
        
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(res.data, "text/xml");
        const items = xmlDoc.getElementsByTagName("PlanCROPInfo");
        
        let rawItems = [];
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          const obj = {};
          for (let j = 0; j < item.children.length; j++) {
            obj[item.children[j].tagName] = item.children[j].textContent;
          }
          rawItems.push(obj);
        }

        let matched = null;
        for (let item of rawItems) {
          const intNo = item.INT_NO || item.itstId;
          if (String(intNo) === String(intersection.int_no)) {
            matched = {
              planNo: item.INT_PLAN_NO || item.planNo,
              cycle: parseInt(item.INT_OPER_CYCLE_VAL || item.cycle || 120),
              offset: parseInt(item.INT_OPER_OFFSET_VAL || item.offset || 0),
            };
            let sumA = 0;
            let sumB = 0;
            for (let i = 1; i <= 8; i++) {
              matched[`A_RING_${i}_PHASE_VAL`] = parseInt(item[`A_RING_${i}_PHASE_VAL`] || 0);
              matched[`B_RING_${i}_PHASE_VAL`] = parseInt(item[`B_RING_${i}_PHASE_VAL`] || 0);
              sumA += matched[`A_RING_${i}_PHASE_VAL`];
              sumB += matched[`B_RING_${i}_PHASE_VAL`];
            }
            const calculatedCycle = Math.max(sumA, sumB);
            if (calculatedCycle > 0) {
              matched.cycle = calculatedCycle;
            }
            break;
          }
        }
        if (matched) {
          setCropData(matched);
        }
      } catch (err) {
        console.error('Error fetching CROP plan for mini card:', err);
      }
    };
    fetchCROP();
  }, [intersection, isSeoul]);

  // SigMap 정보 조회
  useEffect(() => {
    if (isSeoul) return;
    const fetchSigMap = async () => {
      try {
        const regionCode = intersection.region_cd || 'L02';
        const sigMapUrl = `http://tsihub.utic.go.kr/tsi/api/SigMapCrossRoadInfoService/getSigMapCRInfo?type=xml&srchCTId=${regionCode}&srchCRNm=${encodeURIComponent(intersection.int_nm)}&pageNo=1&numOfRows=100`;
        const res = await axios.get(`${API_BASE}/api/proxy/utic?url=${encodeURIComponent(sigMapUrl)}`);
        
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(res.data, "text/xml");
        let items = xmlDoc.getElementsByTagName("SigMapCRInfo");
        if (items.length === 0) items = xmlDoc.getElementsByTagName("item");

        const ringA = [];
        const ringB = [];
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          const intNo = item.getElementsByTagName("INT_NO")[0]?.textContent;
          if (String(intNo) === String(intersection.int_no)) {
            const ringNo = parseInt(item.getElementsByTagName("RING_NO")[0]?.textContent || 0, 10);
            const step = {
              stepNo: parseInt(item.getElementsByTagName("STEP_NO")[0]?.textContent || 0, 10),
              minTm: parseInt(item.getElementsByTagName("MIN_TM")[0]?.textContent || 0, 10),
              maxTm: parseInt(item.getElementsByTagName("MAX_TM")[0]?.textContent || 0, 10),
              eop: parseInt(item.getElementsByTagName("EOP")[0]?.textContent || 0, 10),
            };
            for (let k = 1; k <= 8; k++) {
              step[`car${k}`] = parseInt(item.getElementsByTagName(`CAR${k}`)[0]?.textContent || 0, 10);
              step[`ped${k}`] = parseInt(item.getElementsByTagName(`PED${k}`)[0]?.textContent || 0, 10);
            }
            if (ringNo === 0) ringA.push(step);
            else if (ringNo === 1) ringB.push(step);
          }
        }
        ringA.sort((a, b) => a.stepNo - b.stepNo);
        ringB.sort((a, b) => a.stepNo - b.stepNo);
        setSigMapData({ ringA, ringB });
      } catch (err) {
        console.error('Error fetching SigMap for mini card:', err);
      }
    };
    fetchSigMap();
  }, [intersection, isSeoul]);

  // 실시간 신호 연동 시각 연산 루프
  useEffect(() => {
    const updateRealtime = () => {
      const now = new Date();
      setCurrentTimeStr(
        now.getFullYear() + '-' + 
        String(now.getMonth() + 1).padStart(2, '0') + '-' + 
        String(now.getDate()).padStart(2, '0') + ' ' + 
        now.toLocaleTimeString('ko-KR', { hour12: false })
      );
      setUtcTimeStr(now.toISOString().replace('T', ' ').substring(0, 19) + ' UTC');

      if (isSeoul) return;
      if (!cropData || !cropData.cycle) return;

      const cycle = cropData.cycle;
      const offset = cropData.offset || 0;
      
      const kstTimeStr = now.toLocaleString("en-US", { timeZone: "Asia/Seoul" });
      const kstNow = new Date(kstTimeStr);
      
      const midnight = new Date(kstNow.getFullYear(), kstNow.getMonth(), kstNow.getDate(), 0, 0, 0, 0);
      const secondsSinceMidnight = Math.floor((kstNow.getTime() - midnight.getTime()) / 1000);
      
      const timeInCycle = (secondsSinceMidnight - offset + cycle) % cycle;

      const calcRingState = (ringPrefix) => {
        let cumulativeTime = 0;
        let currentPhaseIdx = 1;
        let remainingTime = 0;
        for (let i = 1; i <= 8; i++) {
          const split = cropData[`${ringPrefix}_${i}_PHASE_VAL`] || 0;
          if (split === 0) continue;
          if (timeInCycle < cumulativeTime + split) {
            currentPhaseIdx = i;
            remainingTime = (cumulativeTime + split) - timeInCycle;
            break;
          }
          cumulativeTime += split;
        }
        return { currentPhaseIdx, remainingTime };
      };

      const ringA = calcRingState('A_RING');
      const ringB = calcRingState('B_RING');

      setPhaseA(ringA.currentPhaseIdx);
      setRemainA(ringA.remainingTime);
      setPhaseB(ringB.currentPhaseIdx);
      setRemainB(ringB.remainingTime);
    };

    updateRealtime();
    const interval = setInterval(updateRealtime, 1000);
    return () => clearInterval(interval);
  }, [cropData, isSeoul]);

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
            intersection={intersection}
            cropData={cropData}
            phaseA={phaseA}
            phaseB={phaseB}
            remainA={remainA}
            remainB={remainB}
            isSeoul={isSeoul}
            sigMapData={sigMapData}
            displayMode={displayMode}
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
