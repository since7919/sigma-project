import React, { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Tooltip, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import axios from 'axios';
import './index.css';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

// [1] 마커 최적화 렌더링 및 클릭 이벤트
function IntersectionMarkers({ intersections, onDetailClick, targetId, uticUpdateTick }) {
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

  const showTooltip = zoomLevel >= 11;

  return (
    <>
      {intersections.map((intersection) => {
        const isSelected = intersection.id === targetId;
        const uticSpat = window.UTIC_SPAT_MAP && window.UTIC_SPAT_MAP[intersection.int_no];
        const baseColor = uticSpat ? "#3b82f6" : "#64748b";
        return (
          <CircleMarker
            key={intersection.id}
            center={[intersection.y_coord, intersection.x_coord]}
            radius={isSelected ? 10 : 6}
            fillColor={isSelected ? "#38bdf8" : baseColor}
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

// [2] 8방향 실시간 신호 분석 파서 및 오버레이 컴포넌트
function parsePhaseCode(code) {
  if (!code) return null;
  const typeChar = code.charAt(0).toUpperCase();
  let typeName = '미지정';
  if (typeChar === 'S') typeName = '직진(1)';
  else if (typeChar === 'L') typeName = '좌회전(2)';
  else if (typeChar === 'P') typeName = '보행(3)';
  else return null;

  const enterAngle = parseInt(code.substring(1, 4), 10);
  let dirName = '미지정';
  if (!isNaN(enterAngle)) {
    const angle = enterAngle % 360;
    if (angle >= 337 || angle < 22) dirName = '북';
    else if (angle >= 22 && angle < 67) dirName = '북동';
    else if (angle >= 67 && angle < 112) dirName = '동';
    else if (angle >= 112 && angle < 157) dirName = '남동';
    else if (angle >= 157 && angle < 202) dirName = '남';
    else if (angle >= 202 && angle < 247) dirName = '남서';
    else if (angle >= 247 && angle < 292) dirName = '서';
    else if (angle >= 292 && angle < 337) dirName = '북서';
  }

  const dirAngleMap = { '북': 0, '북동': 45, '동': 90, '남동': 135, '남': 180, '남서': 225, '서': 270, '북서': 315 };
  const parsedAngle = dirAngleMap[dirName] !== undefined ? dirAngleMap[dirName] : 0;

  return { 
    direction: dirName, 
    outputType: typeName,
    pedestrian: 0, 
    bankCode: '', 
    timeSignal: 0, 
    original: code,
    type: typeChar,
    angle: parsedAngle
  };
}

function CompassOverlay({ intersection, cropData, phaseA, phaseB, remainA, remainB, isSeoul }) {
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

  // TSI 원본 설정 데이터 활용
  const detailData = window.L02_DETAIL_DATA || [];
  const conf = !isSeoul ? detailData.find(d => String(d.INT_NO) === String(intersection.int_no)) : null;

  let sPhaseMap = {}, lPhaseMap = {}, pPhaseMap = {};
  const hasConf = !!conf || isSeoul;

  if (conf) {
    for (let i = 1; i <= 8; i++) {
      ['A', 'B'].forEach(ring => {
        const parsed = parsePhaseCode(conf[`${ring}_RING_${i}_PHASE_CONF_CD`]);
        if (parsed) {
          if (parsed.type === 'S') sPhaseMap[parsed.angle] = { ring, idx: i };
          else if (parsed.type === 'L') lPhaseMap[parsed.angle] = { ring, idx: i };
          else if (parsed.type === 'P') pPhaseMap[parsed.angle] = { ring, idx: i };
        }
      });
    }
  } else if (isSeoul) {
    // 서울 시뮬레이션 기본 구성 매핑
    const mockConf = {
      'A_RING_1_PHASE_CONF_CD': 'S0000300',
      'A_RING_2_PHASE_CONF_CD': 'L0450200',
      'A_RING_3_PHASE_CONF_CD': 'S1800300',
      'A_RING_4_PHASE_CONF_CD': 'L2250200',
      'A_RING_5_PHASE_CONF_CD': 'P0000200',
      'B_RING_5_PHASE_CONF_CD': 'P0900200',
    };
    for (let i = 1; i <= 8; i++) {
      ['A', 'B'].forEach(ring => {
        const parsed = parsePhaseCode(mockConf[`${ring}_RING_${i}_PHASE_CONF_CD`]);
        if (parsed) {
          if (parsed.type === 'S') sPhaseMap[parsed.angle] = { ring, idx: i };
          else if (parsed.type === 'L') lPhaseMap[parsed.angle] = { ring, idx: i };
          else if (parsed.type === 'P') pPhaseMap[parsed.angle] = { ring, idx: i };
        }
      });
    }
  }

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
          const vehHasData = hasConf && (sPhaseMap[deg] || lPhaseMap[deg]);
          const pedHasData = hasConf && (pPhaseMap[deg] || sPhaseMap[deg]);

          // 신호 미수신 방향 신호등 자동 숨김 처리
          if (!vehHasData && !pedHasData) return null;

          let s = 'off', l = 'off', p = 'off';
          let countdown = 0;

          if (isSeoul) {
            let spat = window.SEOUL_SPAT_MAP && window.SEOUL_SPAT_MAP[intersection.int_no];
            if (spat) {
              const prefixMap = { 'N': 'nt', 'NE': 'ne', 'E': 'et', 'SE': 'se', 'S': 'st', 'SW': 'sw', 'W': 'wt', 'NW': 'nw' };
              const pfx = prefixMap[key];
              const stsg = spat[pfx + 'StsgStatNm'];
              const ltsg = spat[pfx + 'LtsgStatNm'];
              const pdsg = spat[pfx + 'PdsgStatNm'];

              let stOn = false, ltOn = false;
              if (stsg === 'protected-Movement-Allowed' || stsg === 'permissive-Movement-Allowed') { s = 'green'; stOn = true; }
              else if (stsg === 'protected-clearance' || stsg === 'permissive-clearance') { s = 'yellow'; stOn = true; }

              if (ltsg === 'protected-Movement-Allowed') { l = 'green'; ltOn = true; }
              else if (ltsg === 'protected-clearance') { l = 'yellow'; ltOn = true; }

              if (!stOn && !ltOn && (stsg === 'stop-And-Remain' || ltsg === 'stop-And-Remain')) { s = 'red'; l = 'red'; }

              if (pdsg === 'protected-Movement-Allowed' || pdsg === 'permissive-Movement-Allowed') { p = 'green'; }
              else if (pdsg === 'stop-And-Remain' || pdsg === 'protected-clearance') { p = 'red'; }
            }
          } else {
            // UTIC 실시간 상태 변환
            if (cropData) {
              const checkActive = (map) => {
                const conf = map[deg];
                if (!conf) return false;
                return conf.ring === 'A' ? (conf.idx === phaseA) : (conf.idx === phaseB);
              };
              const getCountdown = (map) => {
                const conf = map[deg];
                if (!conf) return 0;
                return conf.ring === 'A' ? remainA : remainB;
              };

              if (checkActive(sPhaseMap)) { s = 'green'; countdown = Math.max(countdown, getCountdown(sPhaseMap)); }
              if (checkActive(lPhaseMap)) { l = 'green'; countdown = Math.max(countdown, getCountdown(lPhaseMap)); }
              if (checkActive(pPhaseMap)) { p = 'green'; countdown = Math.max(countdown, getCountdown(pPhaseMap)); }
              else if (checkActive(sPhaseMap) && !pPhaseMap[deg]) { p = 'green'; }
            }

            if (s === 'green' && countdown <= 3) s = 'yellow';
            if (l === 'green' && countdown <= 3) l = 'yellow';
            if (p === 'green' && countdown <= 7) p = 'flash';

            if (s === 'off' && l === 'off' && (sPhaseMap[deg] || lPhaseMap[deg])) { s = 'red'; l = 'red'; }
            if (p === 'off' && pPhaseMap[deg]) { p = 'red'; }
          }

          let crOn = s === 'red' || l === 'red';
          let cyOn = s === 'yellow' || l === 'yellow';
          let caOn = l === 'green';
          let cgOn = s === 'green';

          let prOn = p === 'red' || p === 'off';
          let pgOn = p === 'green' || p === 'flash';

          return (
            <div key={key} className={`signal-slot slot-${key}`} id={`slot-${key}`}>
              {vehHasData && (
                <div className="signal-mount-frame" id={`veh-block-${key}`}>
                  <div className="component-block">
                    <div className="car-housing-box">
                      <div className={`lens c-red ${crOn ? 'on' : ''}`}></div>
                      <div className={`lens c-yellow ${cyOn ? 'on' : ''}`}></div>
                      <div className={`lens c-arrow ${caOn ? 'on' : ''}`}></div>
                      <div className={`lens c-green ${cgOn ? 'on' : ''}`}></div>
                    </div>
                    <div className="micro-timer car-timer">{countdown > 0 ? `${countdown}s` : '-'}</div>
                  </div>
                </div>
              )}
              {pedHasData && (
                <div className="ped-mount-container">
                  <div className="ped-mount-frame" id={`ped-block-${key}`}>
                    <div className="ped-housing-box">
                      <div className={`ped-lens p-red ${prOn ? 'on' : ''}`}></div>
                      <div className={`ped-lens p-green ${pgOn ? 'on' : ''}`}></div>
                    </div>
                    <div className="micro-timer ped-timer">{countdown > 0 && p !== 'red' ? `${countdown}s` : '-'}</div>
                  </div>
                </div>
              )}
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
  const [cropData, setCropData] = useState(null);
  const [phaseA, setPhaseA] = useState(1);
  const [phaseB, setPhaseB] = useState(1);
  const [remainA, setRemainA] = useState(0);
  const [remainB, setRemainB] = useState(0);
  const [currentTimeStr, setCurrentTimeStr] = useState('-');

  const isSeoul = useMemo(() => {
    return intersection.origin_type?.toLowerCase().includes('tdata') || false;
  }, [intersection]);

  // CROP TOD 계획 정보 조회
  useEffect(() => {
    if (isSeoul) return;
    const fetchCROP = async () => {
      try {
        const regionCode = intersection.region_cd || 'L02';
        const res = await axios.get(`${API_BASE}/api/proxy/utic`, {
          params: { regionCode, itstNm: intersection.int_nm }
        });
        
        const data = res.data;
        let rawItems = [];
        if (Array.isArray(data)) rawItems = data.slice(1);
        else if (data && data.body && data.body.items) rawItems = Array.isArray(data.body.items) ? data.body.items : [data.body.items];
        else if (data && data.items) rawItems = Array.isArray(data.items) ? data.items : [data.items];
        else if (data && data.PlanCROPInfo) rawItems = Array.isArray(data.PlanCROPInfo) ? data.PlanCROPInfo : [data.PlanCROPInfo];

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
        console.error('Error fetching CROP plan:', err);
      }
    };
    fetchCROP();
  }, [intersection, isSeoul]);

  // 실시간 신호 연동 시각 연산 루프
  useEffect(() => {
    const updateRealtime = () => {
      const now = new Date();
      setCurrentTimeStr(now.getFullYear() + '-' + 
        String(now.getMonth()+1).padStart(2,'0') + '-' + 
        String(now.getDate()).padStart(2,'0') + ' ' + 
        now.toLocaleTimeString('ko-KR', {hour12:false}));

      if (isSeoul) return;
      if (!cropData || !cropData.cycle) return;

      const cycle = cropData.cycle;
      const offset = cropData.offset || 0;
      
      const kstNow = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Seoul"}));
      const midnight = new Date(kstNow.getFullYear(), kstNow.getMonth(), kstNow.getDate());
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

  // 실시간 신호 테이블 데이터 가공 로직
  const updatedPhases = useMemo(() => {
    let phases = [];
    const detailData = window.L02_DETAIL_DATA || [];
    const conf = !isSeoul ? detailData.find(d => String(d.INT_NO) === String(intersection.int_no)) : null;

    if (conf) {
      phases = [1, 2, 3, 4, 5, 6, 7, 8].reduce((acc, idx) => {
        const aPhase = parsePhaseCode(conf[`A_RING_${idx}_PHASE_CONF_CD`]);
        const bPhase = parsePhaseCode(conf[`B_RING_${idx}_PHASE_CONF_CD`]);
        if (aPhase) acc.push({ ...aPhase, ring: 'A', idx });
        if (bPhase) acc.push({ ...bPhase, ring: 'B', idx });
        return acc;
      }, []);
    } else if (isSeoul) {
      const mockConf = {
        'A_RING_1_PHASE_CONF_CD': 'S0000300',
        'A_RING_2_PHASE_CONF_CD': 'L0450200',
        'A_RING_3_PHASE_CONF_CD': 'S1800300',
        'A_RING_4_PHASE_CONF_CD': 'L2250200',
        'A_RING_5_PHASE_CONF_CD': 'P0000200',
        'B_RING_5_PHASE_CONF_CD': 'P0900200',
      };
      phases = [1, 2, 3, 4, 5, 6, 7, 8].reduce((acc, idx) => {
        const aPhase = parsePhaseCode(mockConf[`A_RING_${idx}_PHASE_CONF_CD`]);
        const bPhase = parsePhaseCode(mockConf[`B_RING_${idx}_PHASE_CONF_CD`]);
        if (aPhase) acc.push({ ...aPhase, ring: 'A', idx });
        if (bPhase) acc.push({ ...bPhase, ring: 'B', idx });
        return acc;
      }, []);
    }

    const mapped = phases.map(p => {
      let isGreen = false;
      let statText = '소등';
      let statClass = 'sig-status-gray';
      let remaining = '-';
      let pedestrianVal = '-';

      if (isSeoul) {
        let spat = window.SEOUL_SPAT_MAP && window.SEOUL_SPAT_MAP[intersection.int_no];
        let pfx = '';
        if (p.angle === 0) pfx = 'nt';
        else if (p.angle === 45) pfx = 'ne';
        else if (p.angle === 90) pfx = 'et';
        else if (p.angle === 135) pfx = 'se';
        else if (p.angle === 180) pfx = 'st';
        else if (p.angle === 225) pfx = 'sw';
        else if (p.angle === 270) pfx = 'wt';
        else if (p.angle === 315) pfx = 'nw';

        if (spat && pfx) {
          let pedPfxMap = { 'nt': 'wt', 'ne': 'nw', 'et': 'nt', 'se': 'ne', 'st': 'et', 'sw': 'se', 'wt': 'st', 'nw': 'sw' };
          let field = pfx + 'StsgStatNm';
          if (p.type === 'L') field = pfx + 'LtsgStatNm';
          if (p.type === 'P') field = pedPfxMap[pfx] + 'PdsgStatNm';
          const val = spat[field];

          if (val === 'protected-Movement-Allowed' || val === 'permissive-Movement-Allowed') {
            isGreen = true;
            statText = '진행';
            statClass = 'sig-status-green';
          } else if (val === 'stop-And-Remain') {
            statText = '정지';
            statClass = 'sig-status-red';
          } else if (val === 'protected-clearance' || val === 'permissive-clearance') {
            statText = '주의';
            statClass = 'sig-status-yellow';
          }
        }
      } else {
        if (cropData) {
          const isActive = p.ring === 'A' ? (p.idx === phaseA) : (p.idx === phaseB);
          const remainingTime = p.ring === 'A' ? remainA : remainB;

          if (isActive) {
            isGreen = true;
            remaining = remainingTime + 's';
            if (p.outputType.includes('보행')) {
              pedestrianVal = remainingTime + 's';
              if (remainingTime <= 7) {
                statText = '보행 점멸(3)';
                statClass = 'sig-status-flash';
              } else {
                statText = '녹색 점등(3)';
                statClass = 'sig-status-green';
              }
            } else {
              if (remainingTime <= 3) {
                statText = '황색 점등(2)';
                statClass = 'sig-status-yellow';
              } else {
                statText = '녹색 점등(3)';
                statClass = 'sig-status-green';
              }
            }
          } else {
            statText = '적색 점등(1)';
            statClass = 'sig-status-red';
          }
        }
      }

      return {
        ...p,
        isGreen,
        remaining,
        pedestrian: pedestrianVal,
        statusText,
        statusClass
      };
    });

    return mapped.sort((a, b) => {
      if (a.angle !== b.angle) return a.angle - b.angle;
      const typeWeight = { 'S': 1, 'L': 2, 'P': 3 };
      const weightA = typeWeight[a.type] || 4;
      const weightB = typeWeight[b.type] || 4;
      return weightA - weightB;
    });
  }, [intersection, isSeoul, cropData, phaseA, phaseB, remainA, remainB]);

  // TOD 운영계획 다운로드
  const downloadPlanData = () => {
    if (!cropData) {
      alert('다운로드할 신호 계획정보가 없습니다.');
      return;
    }
    const blob = new Blob([JSON.stringify({ intersection, cropData, timestamp: new Date().toISOString() }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SIGMA_Plan_${intersection.int_nm}_${intersection.int_no}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

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
            <span style={{color:'#10b981', fontWeight:'bold', fontSize: '11px', textShadow: '0 0 10px #10b981'}}>
              {isSeoul ? (window.SEOUL_SPAT_MAP && window.SEOUL_SPAT_MAP[intersection.int_no] ? '실시간 연동 중' : 'API 연동 대기 중') : (cropData ? '실시간 연동 중' : '대기 중')}
            </span>
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
            <CompassOverlay 
              intersection={intersection}
              cropData={cropData}
              phaseA={phaseA}
              phaseB={phaseB}
              remainA={remainA}
              remainB={remainB}
              isSeoul={isSeoul}
            />
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
                  {updatedPhases.map((p, idx) => (
                    <tr key={idx}>
                      <td className="action-type">{p.direction}</td>
                      <td>{p.pedestrian}</td>
                      <td>-</td>
                      <td style={{fontFamily: 'monospace', fontWeight: 'bold', color: p.isGreen ? '#10b981' : 'inherit'}}>
                        {p.isGreen ? p.remaining : '-'}
                      </td>
                      <td><span className="status-badge" style={{color:'#60a5fa'}}>{p.outputType}</span></td>
                      <td><span className={p.statusClass}>{p.statusText}</span></td>
                    </tr>
                  ))}
                  {updatedPhases.length === 0 && (
                    <tr>
                      <td colSpan="6" style={{padding: '30px', opacity: 0.5}}>신호 구성 계획 정보가 없습니다.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
          <footer className="operation-footer" style={{flexDirection: 'column', gap: '15px', alignItems: 'stretch', padding: '15px 20px'}}>
            <div className="op-items" style={{display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px'}}>
              <div className="op-item">
                <span className="op-label" style={{color: '#38bdf8', fontWeight: 'bold'}}>운영정보</span>
                <span className="op-val" style={{color: '#38bdf8'}}>{cropData ? `${cropData.cycle}초` : '주기 미연동'}</span>
              </div>
              <div className="op-item">
                <span className="op-label">오프셋</span>
                <span className="op-val">{cropData ? `${cropData.offset}초` : '-'}</span>
              </div>
              <div className="op-item"><span className="op-label">전이</span><span className="op-val" style={{color: '#64748b'}}>OFF</span></div>
              <div className="op-item"><span className="op-label">감응</span><span className="op-val" style={{color: '#64748b'}}>OFF</span></div>
              <div className="op-item"><span className="op-label">소등</span><span className="op-val" style={{color: '#64748b'}}>OFF</span></div>
              <div className="op-item"><span className="op-label">점멸</span><span className="op-val" style={{color: '#64748b'}}>OFF</span></div>
              <div className="op-item"><span className="op-label">수동</span><span className="op-val" style={{color: '#64748b'}}>OFF</span></div>
            </div>
            <button className="btn-download" onClick={downloadPlanData} style={{width: '100%', padding: '10px', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10b981', color: '#10b981', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer'}}>
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
function SidebarAccordion({ intersections, onNodeClick, activeNodeId, onRefresh, uticUpdateTick }) {
  const forceRefreshUtic = async (e) => {
    e.stopPropagation();
    if (!window.confirm('UTIC 서버에서 최신 교차로 기반정보를 다운로드 받아 데이터베이스를 갱신하시겠습니까? (약 1~2초 소요)')) return;
    
    try {
      const res = await axios.get(`${API_BASE}/api/intersections/sync?regionCode=L02`);
      if (res.data.success) {
        alert(`교차로 목록 갱신이 완료되었습니다. (${res.data.count}건)`);
        if (onRefresh) onRefresh();
      }
    } catch (err) {
      alert('동기화 중 오류가 발생했습니다: ' + err.message);
    }
  };

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
        <div className="acc-header" onClick={() => setUticOpen(!uticOpen)} style={{ position: 'relative' }}>
          <span className="acc-icon">{uticOpen ? '▼' : '▶'}</span>
          🚓 경찰청 UTIC 개방데이터
          <button 
            onClick={forceRefreshUtic} 
            style={{ position: 'absolute', right: '10px', background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.75rem', padding: '2px 6px' }}
            title="목록 강제 갱신"
          >
            🔄 갱신
          </button>
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
                        <div className="status-dot" style={{background: activeNodeId === item.id ? '#38bdf8' : (window.UTIC_SPAT_MAP && window.UTIC_SPAT_MAP[item.int_no] ? '#3b82f6' : '#64748b')}}></div>
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
  const [uticUpdateTick, setUticUpdateTick] = useState(0); // UTIC 수신 리렌더 트리거
  const [apiStatus, setApiStatus] = useState({
    seoul: { status: 'Off', time: '-ms', color: '#ef4444' },
    utic: { status: 'Off', time: '-ms', color: '#ef4444' }
  });

  // 서울 실시간 SPAT 정보 수신 루프 실행
  useEffect(() => {
    window.SEOUL_SPAT_MAP = window.SEOUL_SPAT_MAP || {};
    window.SEOUL_SPAT_LAST_UPDATE = window.SEOUL_SPAT_LAST_UPDATE || null;

    const fetchSeoulSpat = async () => {
      try {
        const response = await axios.get('/seoul_spat_mock.json');
        const dataArray = response.data.value || response.data;
        const newMap = {};
        const states = ['stop-And-Remain', 'protected-Movement-Allowed', 'protected-clearance'];
        
        dataArray.forEach(item => {
          ['nt', 'ne', 'et', 'se', 'st', 'sw', 'wt', 'nw'].forEach(dir => {
            if (item[dir + 'StsgStatNm']) item[dir + 'StsgStatNm'] = states[Math.floor(Math.random() * states.length)];
            if (item[dir + 'LtsgStatNm']) item[dir + 'LtsgStatNm'] = states[Math.floor(Math.random() * states.length)];
            if (item[dir + 'PdsgStatNm']) item[dir + 'PdsgStatNm'] = states[Math.floor(Math.random() * 2) === 0 ? 'stop-And-Remain' : 'protected-Movement-Allowed'];
          });
          newMap[item.itstId] = item;
        });

        window.SEOUL_SPAT_MAP = newMap;
        window.SEOUL_SPAT_LAST_UPDATE = new Date();
      } catch (error) {
        console.error('Seoul mock SPAT 로딩 에러:', error);
      }
    };

    fetchSeoulSpat();
    const intervalId = setInterval(fetchSeoulSpat, 3000);
    return () => clearInterval(intervalId);
  }, []);

  // UTIC 제어기 상태(CRST) 주기적 수신 루프 실행
  useEffect(() => {
    window.UTIC_SPAT_MAP = window.UTIC_SPAT_MAP || {};
    window.UTIC_SPAT_LAST_UPDATE = window.UTIC_SPAT_LAST_UPDATE || null;

    const fetchUticSpat = async () => {
      try {
        const url = `http://tsihub.utic.go.kr/tsi/api/PlanCrossRoadInfoService/getPlanCRSTInfo?type=json&srchCTId=L02&pageNo=1&numOfRows=9999`;
        const start = performance.now();
        const response = await axios.get(`${API_BASE}/api/proxy/utic?url=${encodeURIComponent(url)}`);
        const end = performance.now();
        
        let data = response.data;
        let rawItems = [];
        if (Array.isArray(data)) rawItems = data.slice(1);
        else if (data && data.body && data.body.items) rawItems = Array.isArray(data.body.items) ? data.body.items : [data.body.items];
        else if (data && data.items) rawItems = Array.isArray(data.items) ? data.items : [data.items];
        else if (data && data.PlanCRSTInfo) rawItems = Array.isArray(data.PlanCRSTInfo) ? data.PlanCRSTInfo : [data.PlanCRSTInfo];
        else if (data && data.response && data.response.body && data.response.body.items) {
            rawItems = Array.isArray(data.response.body.items) ? data.response.body.items : [data.response.body.items];
        }
        
        if (rawItems && rawItems.length > 0) {
          const newMap = {};
          rawItems.forEach(item => {
            const id = item.INT_NO || item.itstId;
            if (id) {
              item.opMode = item.OP_MODE || '수신';
              newMap[id] = item;
            }
          });
          window.UTIC_SPAT_MAP = newMap;
          window.UTIC_SPAT_LAST_UPDATE = new Date();
          setApiStatus(prev => ({...prev, utic: { status: 'Connected', time: `${Math.round(end-start)}ms`, color: '#3b82f6' }}));
          setUticUpdateTick(t => t + 1);
        }
      } catch (error) {
        console.error('UTIC CRST 폴링 에러:', error);
        setApiStatus(prev => ({...prev, utic: { status: 'Error', time: '-ms', color: '#ef4444' }}));
      }
    };

    fetchUticSpat();
    const intervalId = setInterval(fetchUticSpat, 60000);
    return () => clearInterval(intervalId);
  }, []);

  const fetchIntersections = async () => {
    try {
      const start = Date.now();
      const response = await axios.get(`${API_BASE}/api/intersections`);
      const elapsed = Date.now() - start;
      setIntersections(response.data);
      setApiStatus({
        seoul: { status: 'On', time: `${elapsed}ms`, color: '#00ffa2' },
        utic: { status: 'On', time: `${elapsed + 15}ms`, color: '#00ffa2' }
      });
    } catch (error) {
      console.error("교차로 데이터 로드 실패", error);
      setApiStatus({
        seoul: { status: 'Error', time: '-ms', color: '#ef4444' },
        utic: { status: 'Error', time: '-ms', color: '#ef4444' }
      });
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
          onRefresh={fetchIntersections}
          uticUpdateTick={uticUpdateTick}
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
        <div className="top-map-wrapper">
          <MapContainer center={[37.5665, 126.9780]} zoom={12} style={{width:'100%', height:'100%'}} preferCanvas={true}>
            <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" attribution='&copy; CARTO' />
            <IntersectionMarkers 
              intersections={intersections} 
              onDetailClick={openDetail}
              targetId={activeNodeId}
              uticUpdateTick={uticUpdateTick}
            />
          </MapContainer>

          <div className="map-legend" style={{ position: 'absolute', bottom: '20px', right: '20px', background: 'rgba(15, 23, 42, 0.85)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '10px 15px', display: 'flex', gap: '12px', zIndex: 1000, boxShadow: '0 4px 15px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 600, color: '#fff' }}>
              <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: '#3b82f6', boxShadow: '0 0 6px #3b82f6' }}></span>일반
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 600, color: '#fff' }}>
              <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: '#a855f7', boxShadow: '0 0 6px #a855f7' }}></span>전이
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 600, color: '#fff' }}>
              <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: '#84cc16', boxShadow: '0 0 6px #84cc16' }}></span>감응
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 600, color: '#fff' }}>
              <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: '#64748b', boxShadow: '0 0 6px #64748b' }}></span>소등
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 600, color: '#fff' }}>
              <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: '#f59e0b', boxShadow: '0 0 6px #f59e0b' }}></span>점멸
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 600, color: '#fff' }}>
              <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: '#06b6d4', boxShadow: '0 0 6px #06b6d4' }}></span>수동
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 600, color: '#fff' }}>
              <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 6px #ef4444' }}></span>통신이상
            </div>
          </div>
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
