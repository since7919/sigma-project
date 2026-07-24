import React, { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, useMap } from 'react-leaflet';
import axios from 'axios';
import CompassOverlay from './CompassOverlay';
import { parsePhaseCode, toHex, getCellClass, isCarActive, isPedActive } from '../utils/signalUtils';
import { useSignalPhases } from '../hooks/useSignalPhases';
import { useRealtimeSignal } from '../hooks/useRealtimeSignal';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

function MapResizer({ mapZoomMode }) {
  const map = useMap();

  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 300);
    return () => clearTimeout(timer);
  }, [mapZoomMode, map]);
  return null;
}

const getPlanTpText = (code) => {
  if (code === undefined || code === null) return '-';
  const strCode = String(code);
  if (strCode === '0') return '?ºÎ∞ò??;
  if (['1', '2', '3', '4', '5'].includes(strCode)) return '?úÏ∞®??;
  if (strCode === '6') return 'Î≥¥ÌñâÎß?;
  return '-';
};

const PhaseArrow = ({ p }) => {
  if (!p) return <span style={{ color: '#475569' }}>-</span>;
  if (p.type === 'P') return <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 'bold' }}>?ö∂</span>;
  if (p.type === 'U') return <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 'bold' }}>?</span>;
  
  const arrowChar = p.type === 'L' ? '?? : '??;
  const color = p.type === 'L' ? '#f59e0b' : '#38bdf8';
  
  return (
    <div style={{ transform: `rotate(${(p.angle + 180) % 360}deg)`, color, fontSize: '14px', fontWeight: 'bold', display: 'inline-block', lineHeight: 1 }} title={`${p.direction} ${p.outputType}`}>
      {arrowChar}
    </div>
  );
};

export default function SingleDetailOverlay({ intersection, onClose, isDual, forceZoom, uticUpdateTick, isMultiScreenOpen, mainPhases, onMainPhaseUpdate }) {
  const [localTab, setLocalTab] = useState('remainTime');
  const [currentTimeStr, setCurrentTimeStr] = useState('-');
  const [todTab, setTodTab] = useState('general');
  const [reservCtrl, setReservCtrl] = useState('-');
  const [reservCode, setReservCode] = useState(0);
  const [localZoomMode, setLocalZoomMode] = useState(false);
  const [displayMode, setDisplayMode] = useState('circle');
  const [selectedSigMapPlan, setSelectedSigMapPlan] = useState('0');


  const mapZoomMode = forceZoom !== undefined ? forceZoom : localZoomMode;

  const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:4000' : 'https://sigma-project-245n.onrender.com';

  const currentMainPhase = mainPhases?.[intersection?.id] || (intersection?.region_cd === 'L02' ? 2 : 1);

  const handleMainPhaseChange = async (e) => {
    const newPhase = e.target.value;
    const pwd = prompt('Ï£ºÌòÑ???ïÎ≥¥Î•?Î≥ÄÍ≤ΩÌïò?§Î©¥ ÎπÑÎ?Î≤àÌò∏Î•??ÖÎ†•?òÏÑ∏??');
    if (pwd) {
      try {
        const res = await fetch(`${API_BASE}/api/main-phases`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ int_no: intersection.id, main_phase: newPhase, password: pwd })
        });
        const data = await res.json();
        if (data.success) {
          alert('Ï£ºÌòÑ?úÍ? ?Ä?•Îêò?àÏäµ?àÎã§.');
          if (onMainPhaseUpdate) onMainPhaseUpdate(intersection.id, Number(newPhase));
        } else {
          alert(`?§Î•ò: ${data.error}`);
        }
      } catch (err) {
        alert('?Ä??Ï§??§Î•òÍ∞Ä Î∞úÏÉù?àÏäµ?àÎã§.');
      }
    }
  };

  const isSeoul = useMemo(() => {
    return intersection.origin_type?.toLowerCase().includes('tdata') || false;
  }, [intersection]);

  const detailConf = useMemo(() => {
    if (isSeoul) return null;
    const data = window.L02_DETAIL_DATA || [];
    return data.find(d => String(d.INT_NO) === String(intersection.int_no)) || null;
  }, [isSeoul, intersection.int_no]);

  const phaseDiagramData = useMemo(() => {
    if (!detailConf) return [];
    let diagram = [];
    let hasData = false;
    for (let i = 1; i <= 8; i++) {
      const pA = parsePhaseCode(detailConf[`A_RING_${i}_PHASE_CONF_CD`]);
      const pB = parsePhaseCode(detailConf[`B_RING_${i}_PHASE_CONF_CD`]);
      if (pA || pB) hasData = true;
      diagram.push({ idx: i, A: pA, B: pB });
    }
    return hasData ? diagram : [];
  }, [detailConf]);

  const {
    cropData,
    phaseA,
    phaseB,
    remainA,
    remainB,
    sigMapData,
    sigMapDataList,
    weeklyPlans,
    allTodPlans,
    isSigMapLoading
  } = useRealtimeSignal({ intersection, mainPhases });

  useEffect(() => {
    if (sigMapDataList && sigMapDataList.length > 0) {
      if (cropData && cropData.planTp !== undefined) {
        const planTp = cropData.planTp ?? cropData.plan_tp ?? cropData.PLAN_TP;
        const active = sigMapDataList.find(p => String(p.planTp) === String(planTp));
        setSelectedSigMapPlan(String(active ? active.planTp : sigMapDataList[0].planTp));
      } else {
        setSelectedSigMapPlan(String(sigMapDataList[0].planTp));
      }
    }
  }, [sigMapDataList, cropData]);

  // CRRS (?àÏïΩ?úÏñ¥) ?ïÎ≥¥ Ï°∞Ìöå???¨Í∏∞?úÎßå ?®ÎèÖ ?òÌñâ
  useEffect(() => {
    if (isSeoul) {
      setReservCtrl('-');
      return;
    }
    const fetchReserv = async () => {
      try {
        const regionCode = intersection.region_cd || 'L02';
        const crNm = encodeURIComponent(intersection.int_nm);
        const rsUrl = `http://tsihub.utic.go.kr/tsi/api/PlanCrossRoadInfoService/getPlanCRRSInfo?type=xml&srchCTId=${regionCode}&srchCRNm=${crNm}&pageNo=1&numOfRows=1`;
        const rsRes = await axios.get(`${API_BASE}/api/proxy/utic?url=${encodeURIComponent(rsUrl)}`);
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(rsRes.data, "text/xml");
        const rsNode = xmlDoc.getElementsByTagName("RESRV_CONTRL_CD")[0];
        if (rsNode) {
          const cd = parseInt(rsNode.textContent, 10);
          setReservCode(cd);
          const rsMap = {
            1: 'Ï°∞Í¥ë ?úÏñ¥', 2: '?êÎ©∏ ?úÏñ¥', 3: '?åÎì± ?úÏñ¥', 4: '?úÏ∞® ?úÏñ¥', 5: 'Í∞êÏùë ?úÏñ¥',
            6: 'Î≥¥Ìñâ ?úÏÑ±', 7: '?åÌñ• Î∞úÏÉù', 8: 'Í∞êÏùë+?∏Ïãú', 9: '?úÏ∞®+Í∞êÏùë+?∏Ïãú', 10: 'PPC?úÏñ¥', 11: '?®ÎèÖ ?ûÎßâ??
          };
          setReservCtrl(cd === 0 ? '?ºÎ∞ò ?úÏñ¥' : (rsMap[cd] || `?åÏàò?ÜÏùå(${cd})`));
        } else {
          setReservCode(0);
          setReservCtrl('-');
        }
      } catch (err) {
        console.error('Error fetching CRRS:', err);
      }
    };
    fetchReserv();
  }, [intersection, isSeoul]);

  useEffect(() => {
    const updateRealtimeClock = () => {
      const now = new Date(Date.now() + (window.SIGMA_TIME_OFFSET || 0));
      setCurrentTimeStr(now.getFullYear() + '-' + 
        String(now.getMonth()+1).padStart(2,'0') + '-' + 
        String(now.getDate()).padStart(2,'0') + ' ' + 
        now.toLocaleTimeString('ko-KR', {hour12:false}));
    };
    updateRealtimeClock();
    const interval = setInterval(updateRealtimeClock, 1000);
    return () => clearInterval(interval);
  }, []);

  const detailData = window.L02_DETAIL_DATA || [];
  const conf = !isSeoul ? detailData.find(d => String(d.INT_NO) === String(intersection.int_no)) : null;

  // ?§ÏãúÍ∞??†Ìò∏ ?åÏù¥Î∏??∞Ïù¥??Í∞ÄÍ≥?Î°úÏßÅ
  const updatedPhases = useSignalPhases({ intersection, isSeoul, cropData, phaseA, phaseB, remainA, remainB, uticUpdateTick, sigMapData, sigMapDataList });

  // TOD ?¥ÏòÅÍ≥ÑÌöç ?§Ïö¥Î°úÎìú
  const downloadPlanData = () => {
    if (!cropData) {
      alert('?§Ïö¥Î°úÎìú???†Ìò∏ Í≥ÑÌöç?ïÎ≥¥Í∞Ä ?ÜÏäµ?àÎã§.');
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

  const isApiOn = isSeoul ? (window.SEOUL_SPAT_MAP && window.SEOUL_SPAT_MAP[intersection.int_no]) : cropData;

  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (isDragging) {
      const handleGlobalMouseMove = (e) => {
        setPosition({
          x: e.clientX - dragOffset.x,
          y: e.clientY - dragOffset.y
        });
      };
      const handleGlobalMouseUp = () => setIsDragging(false);
      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('mouseup', handleGlobalMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleGlobalMouseMove);
        window.removeEventListener('mouseup', handleGlobalMouseUp);
      };
    }
  }, [isDragging, dragOffset]);

  const handleMouseDown = (e) => {
    if (isDual) return;
    // Remove the target closest check since we will bind this directly to the header
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  };

  return (
    <div className={isDual ? "overlay" : "detail-modal-overlay"} style={isMultiScreenOpen ? { background: 'transparent', pointerEvents: 'none' } : { background: 'transparent', pointerEvents: 'none' }}>
      <div 
        className="detail-modal-content"
        style={
          isDual ? {width:'100%', height:'100%', borderRadius:0, pointerEvents: 'auto'} :
          {
            pointerEvents: 'auto',
            transform: `translate(${position.x}px, ${position.y}px)`,
            transition: isDragging ? 'none' : 'transform 0.1s ease-out'
          }
        }
      >
        <header 
          className="modal-header" 
          onMouseDown={handleMouseDown}
          style={{ cursor: isDual ? 'auto' : (isDragging ? 'grabbing' : 'grab') }}
        >
          <h2 style={{ pointerEvents: 'none' }}>?ö¶ {intersection.int_nm} <span style={{fontSize:'0.8rem', color:'#94a3b8', marginLeft:10}}>ID: {intersection.int_no}</span></h2>
          <button className="btn-close" onMouseDown={(e) => e.stopPropagation()} onClick={onClose}>√ó</button>
        </header>

        <div className="modal-top-map" style={mapZoomMode ? { flex: 1 } : {}}>
          {!isDual && (
            <div className="overlay-toolbar" style={{ display: 'flex', gap: '15px' }}>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="toolbar-btn" onClick={() => setLocalZoomMode(!localZoomMode)}>
                  {localZoomMode ? 'Îß?Ï∂ïÏÜå (?ÑÏ≤¥ ?ïÎ≥¥)' : 'Îß??ïÎ? Î™®Îìú'}
                </button>
                <button className="toolbar-btn" onClick={() => setDisplayMode(displayMode === 'circle' ? 'arrow' : 'circle')}>
                  {displayMode === 'circle' ? (
                    <svg width="28" height="14" viewBox="0 0 28 14" fill="none" xmlns="http://www.w3.org/2000/svg" title="?†Ìò∏??Î™®Îìú"><rect x="1" y="1" width="26" height="12" rx="4" fill="#222" stroke="#555" strokeWidth="2"></rect><circle cx="7" cy="7" r="3" fill="#ef4444"></circle><circle cx="14" cy="7" r="3" fill="#eab308"></circle><circle cx="21" cy="7" r="3" fill="#22c55e"></circle></svg>
                  ) : (
                    <svg width="24" height="18" viewBox="0 0 24 18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" title="?îÏÇ¥??Î™®Îìú"><path d="M11 16V9a3 3 0 0 0-3-3H3" /><path d="M6 3L2 6l4 3" /><path d="M18 16V2" /><path d="M14 6l4-4 4 4" /></svg>
                  )}
                </button>
              </div>
            </div>
          )}
          <div style={{position: 'absolute', top: '10px', right: isDual ? '10px' : '20px', zIndex: 1000, background: 'rgba(15, 23, 42, 0.85)', padding: '6px 10px', borderRadius: '20px', border: `1px solid ${isApiOn ? '#10b981' : '#64748b'}`, display: 'flex', alignItems: 'center', gap: '6px'}}>
            <span style={{fontSize: '10px', color: '#94a3b8'}}>API</span>
            <span style={{color: isApiOn ? '#10b981' : '#64748b', fontWeight:'bold', fontSize: '11px', textShadow: isApiOn ? '0 0 10px #10b981' : 'none'}}>
              {isApiOn ? 'On' : 'Off'}
            </span>
          </div>
          <div style={{position: 'relative', width: '100%', height: '100%'}}>
          {useMemo(() => (
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
              <MapResizer mapZoomMode={mapZoomMode} />
              <TileLayer url="https://mt0.google.com/vt/lyrs=s&hl=ko&x={x}&y={y}&z={z}" />
              <CircleMarker
                center={[intersection.y_coord, intersection.x_coord]}
                radius={8}
                fillColor="#00ecff"
                color="#fff"
                weight={2}
                fillOpacity={0.8}
              />
            </MapContainer>
          ), [intersection.y_coord, intersection.x_coord, mapZoomMode])}
            <CompassOverlay 
              updatedPhases={updatedPhases.unique}
              displayMode={displayMode}
            />
          </div>
        </div>

        {!mapZoomMode && (
          <div className="modal-bottom-data">
            <div className="tabs-header">
              <button className={`tab-btn ${localTab === 'remainTime' ? 'active' : ''}`} onClick={() => setLocalTab('remainTime')}>?†Ìò∏Í≥ÑÌöç?ïÎ≥¥</button>
              <button className={`tab-btn ${localTab === 'signalmap' ? 'active' : ''}`} onClick={() => setLocalTab('signalmap')}>?úÍ∑∏?êÎßµ</button>
              <button className={`tab-btn ${localTab === 'baseinfo' ? 'active' : ''}`} onClick={() => setLocalTab('baseinfo')}>Í∏∞Î∞ò?ïÎ≥¥</button>
            </div>
            <div className="detail-tab-content custom-scroll">
              {localTab === 'baseinfo' && (
                <div style={{ padding: '20px', color: '#fff', fontSize: '13px', height: '100%', overflowY: 'auto' }}>
                  <h3 style={{ color: '#00ecff', marginBottom: '15px' }}>L02 ÍµêÏ∞®Î°?Í∏∞Î∞ò ?ïÎ≥¥ (JSON)</h3>
                  {conf ? (
                    (() => {
                      const baseRows = [];
                      ['A', 'B'].forEach(ring => {
                        for (let i = 1; i <= 8; i++) {
                          const inferredPhases = updatedPhases.all.filter(p => p.ring === ring && p.idx === i && p.inferred);
                          const code = conf[`${ring}_RING_${i}_PHASE_CONF_CD`];
                          
                          if (code && typeof code === 'string' && code.length >= 7) {
                            const typeChar = code.charAt(0).toUpperCase();
                            
                            let typeName = 'ÎØ∏Ï???;
                            if (typeChar === 'S') typeName = 'ÏßÅÏßÑ(S)';
                            else if (typeChar === 'L') typeName = 'Ï¢åÌöå??L)';
                            else if (typeChar === 'P') typeName = 'Î≥¥Ìñâ(P)';
                            else if (typeChar === 'U') typeName = '?†ÌÑ¥(U)';
                            const inAngle = parseInt(code.substring(1, 4), 10);
                            const outAngle = parseInt(code.substring(4, 7), 10);
                            baseRows.push({
                              ringStep: `${ring}Îß?${i}?ÑÏãú`,
                              type: typeName,
                              inAngle: !isNaN(inAngle) ? inAngle + '¬∞' : '-',
                              outAngle: !isNaN(outAngle) ? outAngle + '¬∞' : '-',
                              fullCode: code,
                              remark: 'Í∏∞Î∞ò?ïÎ≥¥'
                            });
                          }
                          
                          inferredPhases.forEach(p => {
                            baseRows.push({
                              ringStep: `${ring}Îß?${i}?ÑÏãú`,
                              type: p.type === 'L' ? 'Ï¢åÌöå??L)' : 'Î≥¥Ìñâ(P)',
                              inAngle: '-',
                              outAngle: '-',
                              fullCode: '-',
                              remark: '?úÍ∑∏?êÎßµ ?†Ï∂î'
                            });
                          });
                        }
                      });
                      
                      return (
                        <div style={{ background: '#0f172a', padding: '15px', borderRadius: '8px', border: '1px solid #1e293b' }}>
                          {baseRows.length > 0 ? (
                            <table className="detail-grid-table" style={{ width: '100%', textAlign: 'center' }}>
                              <thead>
                                <tr>
                                  <th>?ÑÏãú</th>
                                  <th>?†Ìò∏Ï¢ÖÎ•ò</th>
                                  <th>ÏßÑÏûÖÎ∞©ÏúÑÍ∞?/th>
                                  <th>ÏßÑÏ∂úÎ∞©ÏúÑÍ∞?/th>
                                  <th>?ÑÏ≤¥ÏΩîÎìú</th>
                                  <th>ÎπÑÍ≥†</th>
                                </tr>
                              </thead>
                              <tbody>
                                {baseRows.map((row, idx) => (
                                  <tr key={idx}>
                                    <td>{row.ringStep}</td>
                                    <td>{row.type}</td>
                                    <td>{row.inAngle}</td>
                                    <td>{row.outAngle}</td>
                                    <td style={{ fontFamily: 'monospace', color: '#10b981', fontWeight: 'bold' }}>{row.fullCode}</td>
                                    <td style={{ color: row.remark === '?úÍ∑∏?êÎßµ ?†Ï∂î' ? '#f59e0b' : '#38bdf8', fontSize: '11px' }}>{row.remark}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          ) : (
                            <div style={{ opacity: 0.5, textAlign: 'center', padding: '20px' }}>?†Ìö®???ÑÏãú ÏΩîÎìúÍ∞Ä ?ÜÏäµ?àÎã§.</div>
                          )}
                          <details style={{ marginTop: '20px', borderTop: '1px solid #1e293b', paddingTop: '10px' }}>
                            <summary style={{ cursor: 'pointer', color: '#94a3b8' }}>?êÎ≥∏ JSON ?∞Ïù¥??Î≥¥Í∏∞</summary>
                            <pre style={{ margin: '10px 0 0 0', whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontFamily: 'monospace', fontSize: '11px', color: '#64748b' }}>
                              {JSON.stringify(conf, null, 2)}
                            </pre>
                          </details>
                        </div>
                      );
                    })()
                  ) : (
                    <div style={{ padding: '30px', opacity: 0.5, textAlign: 'center' }}>?¥Îãπ ÍµêÏ∞®Î°úÏùò Í∏∞Î∞ò ?ïÎ≥¥Í∞Ä ?ÜÏäµ?àÎã§.</div>
                  )}
                </div>
              )}
              {localTab === 'remainTime' && (
                
<div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }}>
  <div style={{ display: 'flex', gap: '20px', flex: 1, minHeight: 0 }}>
    <div style={{ width: '50%', height: '100%', overflowY: 'auto', paddingRight: '10px', borderRight: '1px solid #1e293b' }} className="custom-scroll">
      <h3 style={{ color: '#00ecff', marginBottom: '15px' }}>?†Ìò∏Í≥ÑÌöç?ïÎ≥¥</h3>
      <table className="detail-grid-table">
                  <thead>
                    <tr>
                      <th>Î∞©Ìñ•?ïÎ≥¥</th>
                      <th>Ï∂úÎ†•?ïÌÉú</th>
                      <th style={{width: '90px'}}>?†Ìò∏?±ÏÉÅ??/th>
                      <th>?îÏó¨?úÍ∞Ñ</th>
                      <th>?úÏ∂ú?úÍ∞Ñ</th>
                      <th>?ÑÏãú</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      if (updatedPhases.unique.length === 0) {
                        return <tr><td colSpan="6" style={{padding: '30px', opacity: 0.5}}>?†Ìò∏ Íµ¨ÏÑ± Í≥ÑÌöç ?ïÎ≥¥Í∞Ä ?ÜÏäµ?àÎã§.</td></tr>;
                      }
                      
                      const grouped = updatedPhases.unique.reduce((acc, p) => {
                        if (!acc[p.direction]) acc[p.direction] = [];
                        acc[p.direction].push(p);
                        return acc;
                      }, {});

                      const getActivePhasesStr = (pObj) => {
                        if (!pObj.confs || pObj.confs.length === 0) return '-';
                        const phasesArr = [...new Set(pObj.confs.map(c => c.idx))].filter(Boolean).sort((a,b) => a - b);
                        return phasesArr.length > 0 ? phasesArr.join(',') : '-';
                      };

                      return Object.entries(grouped).map(([dir, phases]) => (
                        <React.Fragment key={dir}>
                          <tr style={{ borderTop: '2px solid #475569' }}>
                            <td rowSpan={phases.length} className="action-type" style={{background: 'rgba(255,255,255,0.05)', fontWeight: 'bold', borderRight: '1px solid #334155', verticalAlign: 'middle', padding: '2px 4px'}}>
                              {dir}Ï∏?
                            </td>
                            <td style={{padding: '2px 4px'}}><span className="status-badge" style={{color:'#60a5fa', padding: '2px 4px', fontSize: '11px'}}>{phases[0].outputType}</span></td>
                            <td style={{padding: '2px 4px'}}><span className={phases[0].statusClass} style={{padding: '2px 4px', fontSize: '11px'}}>{phases[0].statusText}</span></td>
                            <td style={{fontFamily: 'monospace', fontWeight: 'bold', color: phases[0].isGreen ? '#10b981' : '#94a3b8', padding: '2px 4px', fontSize: '12px'}}>
                              {phases[0].remaining !== '-' ? phases[0].remaining : '-'}
                            </td>
                            <td style={{fontFamily: 'monospace', fontWeight: 'bold', color: '#f59e0b', padding: '2px 4px', fontSize: '12px'}}>
                              {phases[0].displayTime || '-'}
                            </td>
                            <td style={{fontFamily: 'monospace', fontWeight: 'bold', color: '#10b981', padding: '2px 4px', fontSize: '12px'}}>
                              {getActivePhasesStr(phases[0])}
                            </td>
                          </tr>
                          {phases.slice(1).map((p, idx) => (
                            <tr key={`${dir}-${idx}`}>
                              <td style={{padding: '2px 4px'}}><span className="status-badge" style={{color:'#60a5fa', padding: '2px 4px', fontSize: '11px'}}>{p.outputType}</span></td>
                              <td style={{padding: '2px 4px'}}><span className={p.statusClass} style={{padding: '2px 4px', fontSize: '11px'}}>{p.statusText}</span></td>
                              <td style={{fontFamily: 'monospace', fontWeight: 'bold', color: p.isGreen ? '#10b981' : '#94a3b8', padding: '2px 4px', fontSize: '12px'}}>
                                {p.remaining !== '-' ? p.remaining : '-'}
                              </td>
                              <td style={{fontFamily: 'monospace', fontWeight: 'bold', color: '#f59e0b', padding: '2px 4px', fontSize: '12px'}}>
                                {p.displayTime || '-'}
                              </td>
                              <td style={{fontFamily: 'monospace', fontWeight: 'bold', color: '#10b981', padding: '2px 4px', fontSize: '12px'}}>
                                {getActivePhasesStr(p)}
                              </td>
                            </tr>
                          ))}
                        </React.Fragment>
                      ));
                    })()}
                  </tbody>
                </table>
                <div style={{ textAlign: 'right', marginTop: '5px', fontSize: '11px', color: '#94a3b8' }}>
                  ÍµêÏ∞®Î°úÏãúÍ∞? {currentTimeStr}
                </div>

  {phaseDiagramData.length > 0 && (
    <div style={{ marginTop: '15px', paddingTop: '10px', borderTop: '2px solid #1e293b' }}>
      <div style={{ color: '#38bdf8', fontWeight: 'bold', fontSize: '13px', marginBottom: '8px' }}>?ÑÏãú??(Phase Diagram)</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '5px' }}>
        {phaseDiagramData.map(ph => {
          const isRingAActive = ph.idx === phaseA && cropData && cropData.cycle > 0 && cropData[`A_RING_${ph.idx}_PHASE_VAL`] > 0;
          const isRingBActive = ph.idx === phaseB && cropData && cropData.cycle > 0 && cropData[`B_RING_${ph.idx}_PHASE_VAL`] > 0;
          const isAnyActive = isRingAActive || isRingBActive;
          
          let remainText = '';
          if (isRingAActive && isRingBActive) {
            remainText = remainA === remainB ? `${remainA}s` : `A:${remainA}s B:${remainB}s`;
          } else if (isRingAActive) {
            remainText = `${remainA}s`;
          } else if (isRingBActive) {
            remainText = `${remainB}s`;
          }

          return (
            <div key={ph.idx} style={{ 
              border: isAnyActive ? '2px solid #10b981' : '1px solid #334155', 
              borderRadius: '4px', 
              background: isAnyActive ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255,255,255,0.02)', 
              textAlign: 'center',
              transition: 'all 0.3s'
            }}>
              <div style={{ 
                background: isAnyActive ? '#10b981' : '#1e293b', 
                padding: '4px 6px', 
                fontSize: '11px', 
                fontWeight: 'bold', 
                color: isAnyActive ? '#0f172a' : '#cbd5e1',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span>{ph.idx}?ÑÏãú</span>
                {isAnyActive && (
                  <span style={{ fontSize: '10px', background: 'rgba(0,0,0,0.4)', color: '#fff', padding: '1px 4px', borderRadius: '3px' }}>
                    {remainText}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '6px 4px', gap: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%' }}>
                  <span style={{ fontSize: '10px', color: isRingAActive ? '#10b981' : '#64748b', fontWeight: 'bold', width: '10px' }}>A</span>
                  <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                    {(() => {
                      const ringPhases = updatedPhases.all.filter(p => p.ring === 'A' && p.idx === ph.idx);
                      if (ringPhases.length === 0) return <span style={{ color: '#475569' }}>-</span>;
                      return (
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'center' }}>
                          {ringPhases.map((p, i) => <PhaseArrow key={i} p={p} />)}
                        </div>
                      );
                    })()}
                  </div>
                </div>
                <div style={{ height: '1px', width: '80%', background: isAnyActive ? 'rgba(16, 185, 129, 0.3)' : '#334155' }}></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%' }}>
                  <span style={{ fontSize: '10px', color: isRingBActive ? '#10b981' : '#64748b', fontWeight: 'bold', width: '10px' }}>B</span>
                  <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                    {(() => {
                      const ringPhases = updatedPhases.all.filter(p => p.ring === 'B' && p.idx === ph.idx);
                      if (ringPhases.length === 0) return <span style={{ color: '#475569' }}>-</span>;
                      return (
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'center' }}>
                          {ringPhases.map((p, i) => <PhaseArrow key={i} p={p} />)}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  )}

  </div>
  <div style={{ width: '50%', height: '100%', overflowY: 'auto' }} className="custom-scroll">
    <div className="operation-panel" style={{display: "flex", flexDirection: "column", gap: "15px", alignItems: "stretch", padding: "0 10px", height: "100%", overflowY: "auto"}}>
              <div style={{marginBottom: '5px'}}>
                <span style={{ color: '#38bdf8', fontWeight: 'bold', fontSize: '13px', borderBottom: '2px solid #38bdf8', paddingBottom: '2px' }}>?¥ÏòÅ?ïÎ≥¥</span>
                <table style={{ width: '100%', marginTop: '10px', borderCollapse: 'collapse', textAlign: 'center', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.05)', color: '#94a3b8' }}>
                      <th style={{ padding: '6px', border: '1px solid #334155' }}>Ï£ºÍ∏∞(Cycle)</th>
                      <th style={{ padding: '6px', border: '1px solid #334155' }}>Ï£ºÌòÑ??/th>
                      <th style={{ padding: '6px', border: '1px solid #334155' }}>?∞ÎèôÍ∞?Offset)</th>
                      <th style={{ padding: '6px', border: '1px solid #334155' }}>?îÏùºÍ≥ÑÌöç(Day plan)</th>
                      <th style={{ padding: '6px', border: '1px solid #334155' }}>?úÍ∞ÑÍ≥ÑÌöç(Time plan)</th>
                      <th style={{ padding: '6px', border: '1px solid #334155' }}>?úÍ∞Ñ(Time)</th>
                      <th style={{ padding: '6px', border: '1px solid #334155' }}>?úÏ∞®Í≥ÑÌöç(Plan)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ padding: '6px', border: '1px solid #334155', color: '#38bdf8', fontWeight: 'bold' }}>{cropData ? `${cropData.cycle}Ï¥? : 'ÎØ∏Ïó∞??}</td>
                      <td style={{ padding: '6px', border: '1px solid #334155' }}>
                        <select value={currentMainPhase} onChange={handleMainPhaseChange} style={{ background: '#1e293b', color: '#fff', border: '1px solid #475569', borderRadius: '4px', padding: '2px', cursor: 'pointer' }}>
                          {[1,2,3,4,5,6,7,8].map(p => <option key={p} value={p}>{p}?ÑÏãú</option>)}
                        </select>
                      </td>
                      <td style={{ padding: '6px', border: '1px solid #334155', color: '#fff', fontWeight: 'bold' }}>{cropData ? `${cropData.offset}Ï¥? : '-'}</td>
                      <td style={{ padding: '6px', border: '1px solid #334155', color: '#f472b6', fontWeight: 'bold' }}>{cropData ? cropData.planNo : '-'}</td>
                      <td style={{ padding: '6px', border: '1px solid #334155', color: '#f472b6', fontWeight: 'bold' }}>{cropData ? cropData.planIdxNo : '-'}</td>
                      <td style={{ padding: '6px', border: '1px solid #334155', color: '#f472b6', fontWeight: 'bold' }}>{cropData ? cropData.operPlanTm : '-'}</td>
                      <td style={{ padding: '6px', border: '1px solid #334155', color: '#10b981', fontWeight: 'bold' }}>
                        {cropData ? getPlanTpText(cropData.planTp ?? cropData.plan_tp ?? cropData.PLAN_TP) : '-'}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>


              <div style={{ marginTop: '15px' }}>
                <span style={{ color: '#38bdf8', fontWeight: 'bold', fontSize: '13px' }}>Ï£ºÍ∞Ñ ?ºÍ≥Ñ?çÌëú</span>
                <table style={{ width: '100%', marginTop: '8px', borderCollapse: 'collapse', textAlign: 'center', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.1)' }}>
                      {['??, '??, '??, 'Î™?, 'Í∏?, '??, '??].map((day, idx) => {
                        const dyInt = idx + 1;
                        const jsDay = new Date().getDay();
                        const todayDy = jsDay === 0 ? 7 : jsDay;
                        const isToday = dyInt === todayDy;
                        return <th key={day} style={{ padding: '6px', color: isToday ? '#10b981' : '#94a3b8', border: '1px solid #334155' }}>{day}</th>
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      {[2, 3, 4, 5, 6, 7, 1].map((dy) => {
                        const currentJsDay = new Date().getDay();
                        const currentTodayDy = currentJsDay + 1;
                        const isToday = dy === currentTodayDy;
                        return <td key={dy} style={{ padding: '6px', fontWeight: 'bold', color: isToday ? '#10b981' : '#fff', border: '1px solid #334155', background: isToday ? 'rgba(16, 185, 129, 0.1)' : 'transparent' }}>
                          {weeklyPlans[dy] || '-'}
                        </td>
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>

              {Object.keys(allTodPlans).length > 0 && (
                <div style={{ marginTop: '15px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ color: '#38bdf8', fontWeight: 'bold', fontSize: '13px' }}>TOD Í≥ÑÌöç?ïÎ≥¥ (?ÑÏû¨ ?§Ìñâ: ?ºÍ≥Ñ??{cropData?.planNo})</span>
                    <div style={{ display: 'flex', gap: '5px' }}>
                      <button onClick={() => setTodTab('general')} style={{ background: todTab === 'general' ? '#0ea5e9' : '#334155', color: '#fff', border: 'none', padding: '2px 4px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', transition: '0.2s' }}>?ºÎ∞òÎß?(1~5)</button>
                      <button onClick={() => setTodTab('offset')} style={{ background: todTab === 'offset' ? '#0ea5e9' : '#334155', color: '#fff', border: 'none', padding: '2px 4px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', transition: '0.2s' }}>?úÏ∞®Îß?(6~10)</button>
                    </div>
                  </div>
                  <div style={{ overflowX: 'auto', background: '#0f172a', padding: '1px', borderRadius: '6px', border: '1px solid #1e293b' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', fontSize: '11px' }}>
                      <thead>
                        <tr style={{ background: 'rgba(255,255,255,0.05)' }}>
                          <th style={{ padding: '6px 4px', borderBottom: '1px solid #334155', width: '30px', color: '#94a3b8' }}>#</th>
                          {[1, 2, 3, 4, 5].map((i) => {
                            const pNo = todTab === 'general' ? i : i + 5;
                            return (
                              <th key={`hdr-${pNo}`} colSpan={3} style={{ padding: '6px 4px', borderBottom: '1px solid #334155', borderLeft: '1px solid #334155', color: cropData?.planNo === String(pNo) ? '#10b981' : '#94a3b8' }}>
                                ?ºÍ≥Ñ??{pNo}
                              </th>
                            )
                          })}
                        </tr>
                        <tr style={{ background: 'rgba(255,255,255,0.05)' }}>
                          <th style={{ padding: '4px', borderBottom: '1px solid #334155' }}></th>
                          {[1, 2, 3, 4, 5].map((i) => {
                            const pNo = todTab === 'general' ? i : i + 5;
                            return (
                              <React.Fragment key={`sub-${pNo}`}>
                                <th style={{ padding: '4px', borderBottom: '1px solid #334155', borderLeft: '1px solid #334155', fontWeight: 'normal', color: '#cbd5e1' }}>TIME</th>
                                <th style={{ padding: '4px', borderBottom: '1px solid #334155', fontWeight: 'normal', color: '#cbd5e1' }}>CYC</th>
                                <th style={{ padding: '4px', borderBottom: '1px solid #334155', fontWeight: 'normal', color: '#cbd5e1' }}>IDX</th>
                              </React.Fragment>
                            )
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {Array.from({ length: 16 }).map((_, rIdx) => (
                          <tr key={`row-${rIdx}`} style={{ borderBottom: '1px solid #1e293b' }}>
                            <td style={{ padding: '4px', fontWeight: 'bold', color: '#64748b' }}>{rIdx + 1}</td>
                            {[1, 2, 3, 4, 5].map((i) => {
                              const pNo = String(todTab === 'general' ? i : i + 5);
                              const planArr = allTodPlans[pNo] || [];
                              const matchedData = planArr.find(p => String(p.planIdxNo) === String(rIdx + 1)) || planArr[rIdx];
                              
                              const isActive = cropData?.planNo === pNo && String(cropData?.planIdxNo) === String(matchedData?.planIdxNo);
                              const bg = isActive ? 'rgba(16, 185, 129, 0.2)' : 'transparent';
                              const fontColor = isActive ? '#10b981' : '#cbd5e1';

                              const isZeroCycle = matchedData && (matchedData.cycle === 0 || String(matchedData.cycle) === '0');

                              return (
                                <React.Fragment key={`cell-${pNo}-${rIdx}`}>
                                  <td style={{ padding: '4px', borderLeft: '1px solid #334155', background: bg, color: fontColor }}>
                                    {matchedData && !isZeroCycle ? matchedData.operPlanTm : '-'}
                                  </td>
                                  <td style={{ padding: '4px', background: bg, color: fontColor }}>
                                    {matchedData && !isZeroCycle ? matchedData.cycle : '-'}
                                  </td>
                                  <td style={{ padding: '4px', background: bg, color: fontColor, fontWeight: 'bold' }}>
                                    {matchedData ? matchedData.planIdxNo : '-'}
                                  </td>
                                </React.Fragment>
                              )
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              

            </div>
  </div>
</div>
</div>
              )}
              {localTab === 'signalmap' && (
                <div className="sigmap-container">

                  {isSigMapLoading ? (
                    <div style={{padding: '30px', textAlign: 'center', color: '#38bdf8'}}>?úÍ∑∏?êÎßµ ?∞Ïù¥?∞Î? Î∂àÎü¨?§Îäî Ï§?..</div>
                  ) : (sigMapDataList.length === 0) ? (
                    <div style={{padding: '30px', textAlign: 'center', color: '#f59e0b'}}>?ÑÏû¨ ??ÍµêÏ∞®Î°úÏùò ?úÍ∑∏?êÎßµ ?∞Ïù¥?∞Í? ?ÜÏäµ?àÎã§.</div>
                  ) : (
                    <>
                      <div style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <label style={{ color: '#94a3b8', fontSize: '13px' }}>?åÎûú ?†ÌÉù:</label>
                        <select 
                          value={selectedSigMapPlan}
                          onChange={(e) => setSelectedSigMapPlan(e.target.value)}
                          style={{ background: '#334155', color: '#fff', border: '1px solid #475569', borderRadius: '4px', padding: '2px 4px', fontSize: '13px' }}
                        >
                          {sigMapDataList.map((p, idx) => (
                            <option key={idx} value={String(p.planTp)}>?åÎûú {p.planTp}</option>
                          ))}
                        </select>
                      </div>
                      {sigMapDataList.filter(p => String(p.planTp) === selectedSigMapPlan).map((planData, pIdx) => (
                        <div key={pIdx} style={{marginBottom: '20px'}}>
                          <h4 style={{color: '#38bdf8', marginBottom: '5px', fontSize: '13px', textAlign: 'left'}}>?åÎûú {planData.planTp} ?úÍ∑∏?êÎßµ (A-RING & B-RING Î≥ëÎ†¨ ?úÏ∂ú)</h4>
                          <table className="sigmap-ring-table">
                            <thead>
                              <tr>
                                <th rowSpan="3" style={{width: '40px'}}>Step</th>
                                <th colSpan="19" style={{color: '#10b981'}}>A-RING</th>
                                <th colSpan="19" style={{color: '#38bdf8'}}>B-RING</th>
                              </tr>
                              <tr>
                                {[1,2,3,4,5,6,7,8].map(i => <th colSpan="2" key={`a-${i}`}>{i}</th>)}
                                <th rowSpan="2">Min</th>
                                <th rowSpan="2">Max</th>
                                <th rowSpan="2">EOP</th>
                                {[1,2,3,4,5,6,7,8].map(i => <th colSpan="2" key={`b-${i}`}>{i}</th>)}
                                <th rowSpan="2">Min</th>
                                <th rowSpan="2">Max</th>
                                <th rowSpan="2">EOP</th>
                              </tr>
                              <tr>
                                {[1,2,3,4,5,6,7,8].map(i => <React.Fragment key={`a-sub-${i}`}><th>V</th><th>P</th></React.Fragment>)}
                                {[1,2,3,4,5,6,7,8].map(i => <React.Fragment key={`b-sub-${i}`}><th>V</th><th>P</th></React.Fragment>)}
                              </tr>
                            </thead>
                            <tbody>
                              {Array.from({length: 32}, (_, i) => i + 1).map(n => {
                                const stepA = planData.ringA.find(s => s.stepNo === n) || {};
                                const stepB = planData.ringB.find(s => s.stepNo === n) || {};
                                const isEopRow = stepA.eop === 1 || stepB.eop === 1;
                                return (
                                  <tr key={n} className={isEopRow ? 'eop-row' : ''}>
                                    <td style={{fontWeight: 'bold', background: 'rgba(0,0,0,0.2)'}}>{n}</td>
                                    {[1,2,3,4,5,6,7,8].map(i => (
                                      <React.Fragment key={`a-td-${i}`}>
                                        <td className={stepA[`car${i}`] !== undefined ? getCellClass(stepA[`car${i}`], 'car') : 'cell-gray'}>{stepA[`car${i}`] !== undefined ? toHex(stepA[`car${i}`]) : '-'}</td>
                                        <td className={stepA[`ped${i}`] !== undefined ? getCellClass(stepA[`ped${i}`], 'ped') : 'cell-gray'}>{stepA[`ped${i}`] !== undefined ? toHex(stepA[`ped${i}`]) : '-'}</td>
                                      </React.Fragment>
                                    ))}
                                    <td style={{background: 'rgba(0,0,0,0.2)'}}>{stepA.minTm !== undefined ? stepA.minTm : '-'}</td>
                                    <td style={{background: 'rgba(0,0,0,0.2)'}}>{stepA.maxTm !== undefined ? stepA.maxTm : '-'}</td>
                                    <td className={stepA.eop === 1 ? 'cell-yellow' : ''}>{stepA.eop === 1 ? 'Y' : ''}</td>
                                    {[1,2,3,4,5,6,7,8].map(i => (
                                      <React.Fragment key={`b-td-${i}`}>
                                        <td className={stepB[`car${i}`] !== undefined ? getCellClass(stepB[`car${i}`], 'car') : 'cell-gray'}>{stepB[`car${i}`] !== undefined ? toHex(stepB[`car${i}`]) : '-'}</td>
                                        <td className={stepB[`ped${i}`] !== undefined ? getCellClass(stepB[`ped${i}`], 'ped') : 'cell-gray'}>{stepB[`ped${i}`] !== undefined ? toHex(stepB[`ped${i}`]) : '-'}</td>
                                      </React.Fragment>
                                    ))}
                                    <td style={{background: 'rgba(0,0,0,0.2)'}}>{stepB.minTm !== undefined ? stepB.minTm : '-'}</td>
                                    <td style={{background: 'rgba(0,0,0,0.2)'}}>{stepB.maxTm !== undefined ? stepB.maxTm : '-'}</td>
                                    <td className={stepB.eop === 1 ? 'cell-yellow' : ''}>{stepB.eop === 1 ? 'Y' : ''}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      ))}
                    </>
                  )}
                  <div style={{marginTop: '20px', padding: '15px', background: 'rgba(56, 189, 248, 0.05)', border: '1px solid rgba(56, 189, 248, 0.2)', borderRadius: '8px', fontSize: '13px', lineHeight: '1.6', color: '#e2e8f0'}}>
                    <h4 style={{color: '#38bdf8', marginBottom: '8px', fontSize: '14px', fontWeight: 'bold'}}>?í° ?úÍ∑∏?êÎßµ Î≥¥Ìñâ?†Ìò∏ ?†Ï∂î Î°úÏßÅ</h4>
                    <ol style={{paddingLeft: '20px', margin: 0}}>
                      <li style={{marginBottom: '4px'}}>?úÍ∑∏?êÎßµ?êÏÑú Î≥¥Ìñâ?†Ìò∏Í∞Ä ?úÏÑ±?îÎêú LSU Î≤àÌò∏Î•??ïÏù∏?©Îãà??</li>
                      <li style={{marginBottom: '4px'}}>Í∏∞Î∞ò?ïÎ≥¥?êÏÑú <b>?ôÏùº??Îß?Ring), ?ôÏùº??LSU Î≤àÌò∏</b>??Ï∞®Îüâ?†Ìò∏Î•?Ï∞æÏïÑ ?¥Îãπ Î∞©Ìñ•Í≥?Í∞ÅÎèÑÎ•?Î≥¥Ìñâ?†Ìò∏???ôÏùº?òÍ≤å Î∂Ä?¨Ìï©?àÎã§.</li>
                      <li style={{marginBottom: '4px'}}>ÎßåÏïΩ ?ôÏùº??ÎßÅÏóê ?¥Îãπ Ï∞®Îüâ?†Ìò∏Í∞Ä ?ÜÎã§Î©? <b>?§Î•∏ ÎßÅÏùò ?ôÏùº??LSU Î≤àÌò∏</b>Î•?Ï°∞Ìöå?òÏó¨ Î∞©Ìñ•???†Ï∂î?©Îãà??</li>
                      <li style={{marginBottom: '4px'}}>Ï∞®Îüâ?†Ìò∏?Ä ?®Íªò ?§Ïπò?òÎäî Î≥¥Ìñâ?†Ìò∏???πÏÑ±??Î∞òÏòÅ?òÏó¨, ?†Ï∂î??Î≥¥Ìñâ?ïÎ≥¥Î•?<b>Í∏∞Î∞ò?ïÎ≥¥ ??/b>???úÏãú?©Îãà?? (ÎπÑÍ≥†: "?úÍ∑∏?êÎßµ ?†Ï∂î")</li>
                    </ol>
                  </div>
                </div>
              )}
            </div>
            
          </div>
        )}
      </div>
    </div>
  );
}
