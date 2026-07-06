import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import axios from 'axios';
import { parsePhaseCode } from '../utils/signalUtils';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

export default function MapSignalOverlay({ intersection, uticUpdateTick, onMapSignalToggle, displayMode }) {
  const [cropData, setCropData] = useState(null);
  const [phaseA, setPhaseA] = useState(1);
  const [phaseB, setPhaseB] = useState(1);
  const [remainA, setRemainA] = useState(0);
  const [remainB, setRemainB] = useState(0);
  const [sigMapData, setSigMapData] = useState({ ringA: [], ringB: [] });

  const isSeoul = useMemo(() => {
    return intersection.origin_type?.toLowerCase().includes('tdata') || false;
  }, [intersection]);

  // CROP 정보
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
            if (calculatedCycle > 0) matched.cycle = calculatedCycle;
            break;
          }
        }
        if (matched) setCropData(matched);
      } catch (err) {
        console.error('Error fetching CROP for map overlay:', err);
      }
    };
    fetchCROP();
  }, [intersection, isSeoul]);

  // SigMap 정보
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
        console.error('Error fetching SigMap for map overlay:', err);
      }
    };
    fetchSigMap();
  }, [intersection, isSeoul]);

  // 실시간 타이머 연동
  useEffect(() => {
    if (isSeoul) return;
    const updateRealtime = () => {
      if (!cropData || !cropData.cycle) return;
      const cycle = cropData.cycle;
      const offset = cropData.offset || 0;
      const now = new Date();
      // KST(한국 표준시) 기준 일자 및 누적 초 구하기
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

  const markerRef = useRef(null);

  const htmlString = useMemo(() => {
    // 1. 화살표 표출 모드인 경우
    if (displayMode === 'arrow') {
      const vehicles = Array.from({ length: 16 }, (_, i) => i + 1);
      const peds = Array.from({ length: 16 }, (_, i) => i + 101);
      const allMovs = [...vehicles, ...peds];

      const defPosAngles = [90, 270, 180, 0, 270, 90, 0, 180, 45, 225, 135, 315, 225, 45, 315, 135];
      const getVisualArrowLocal = (m) => {
        if (m <= 0) return { type: '•', ang: 0 };
        if (m >= 100) return { type: 'WALK', ang: 0 };
        const movementMap = {
          1: { type: '↰', ang: 270 }, 2: { type: '↗', ang: 45 },
          3: { type: '↰', ang: 0 }, 4: { type: '↙', ang: 315 },
          5: { type: '↰', ang: 90 }, 6: { type: '↙', ang: 45 },
          7: { type: '↰', ang: 180 }, 8: { type: '↖', ang: 45 },
          9: { type: '↰', ang: 225 }, 10: { type: '↗', ang: 0 },
          11: { type: '↰', ang: 315 }, 12: { type: '↘', ang: 0 },
          13: { type: '↰', ang: 45 }, 14: { type: '↙', ang: 0 },
          15: { type: '↰', ang: 135 }, 16: { type: '↖', ang: 0 }
        };
        return movementMap[m] || { type: '•', ang: 0 };
      };

      const htmlContent = allMovs.map(m => {
        const isPed = m >= 100;
        const arrowData = isPed ? { type: 'WALK', ang: 0 } : getVisualArrowLocal(m);

        let ang = 0;
        if (isPed) {
          const refM = m - 100;
          ang = defPosAngles[(refM - 1) % 16] || 0;
          if (refM % 2 !== 0) ang += 22;
          else ang -= 22;
        } else {
          ang = defPosAngles[(m - 1) % 16] || 0;
          if (m % 2 !== 0) ang += 7;
          else ang -= 7;
        }

        const rad = ang * Math.PI / 180;
        const radiusMultiplier = isPed ? 70 : ((m > 8) ? 55 : 40);
        const topPx = 77.5 - Math.cos(rad) * radiusMultiplier;
        const leftPx = 77.5 + Math.sin(rad) * radiusMultiplier;

        let signalState = 'off';
        let countdown = 0;

        if (isSeoul) {
          const degVal = defPosAngles[(isPed ? (m - 101) : (m - 1)) % 16] || 0;
          const degToKey = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };
          const key = degToKey[degVal];
          
          let spat = window.SEOUL_SPAT_MAP && window.SEOUL_SPAT_MAP[intersection.int_no];
          if (spat && spat.status) {
            const prefixMap = { 'N': 'nt', 'NE': 'ne', 'E': 'et', 'SE': 'se', 'S': 'st', 'SW': 'sw', 'W': 'wt', 'NW': 'nw' };
            const pfx = prefixMap[key];
            const statObj = Array.isArray(spat.status) ? (spat.status[0] || {}) : spat.status;
            const timingObj = Array.isArray(spat.timing) ? (spat.timing[0] || {}) : spat.timing;

            const stsg = statObj[pfx + 'StsgStatNm'];
            const ltsg = statObj[pfx + 'LtsgStatNm'];
            const pdsg = statObj[pfx + 'PdsgStatNm'];

            const stTime = timingObj[pfx + 'StsgRmdrCs'];
            const ltTime = timingObj[pfx + 'LtsgRmdrCs'];
            const pdTime = timingObj[pfx + 'PdsgRmdrCs'];

            if (isPed) {
              if (pdsg === 'protected-Movement-Allowed' || pdsg === 'permissive-Movement-Allowed' || pdsg === '녹색') { 
                signalState = 'G';
                if (pdTime) countdown = Math.floor(pdTime / 10);
              } else if (pdsg === 'protected-clearance' || pdsg === '황색') {
                signalState = 'F';
                if (pdTime) countdown = Math.floor(pdTime / 10);
              }
            } else {
              const isLeftMov = (m % 2 !== 0);
              if (isLeftMov) {
                if (ltsg === 'protected-Movement-Allowed' || ltsg === '녹색화살표') {
                  signalState = 'G';
                  if (ltTime) countdown = Math.floor(ltTime / 10);
                } else if (ltsg === 'protected-clearance' || ltsg === '황색') {
                  signalState = 'Y';
                  if (ltTime) countdown = Math.floor(ltTime / 10);
                }
              } else {
                if (stsg === 'protected-Movement-Allowed' || stsg === 'permissive-Movement-Allowed' || stsg === '녹색' || stsg === '녹색화살표' || stsg === '청색') {
                  signalState = 'G';
                  if (stTime) countdown = Math.floor(stTime / 10);
                } else if (stsg === 'protected-clearance' || stsg === 'permissive-clearance' || stsg === '황색') {
                  signalState = 'Y';
                  if (stTime) countdown = Math.floor(stTime / 10);
                }
              }
            }
          }
        } else {
          const sPhaseMap = {}, lPhaseMap = {}, pPhaseMap = {};
          const detailData = window.L02_DETAIL_DATA || [];
          const conf = detailData.find(d => String(d.INT_NO) === String(intersection.int_no));

          if (conf) {
            for (let i = 1; i <= 8; i++) {
              ['A', 'B'].forEach(ring => {
                const parsed = parsePhaseCode(conf[`${ring}_RING_${i}_PHASE_CONF_CD`]);
                if (parsed) {
                  const degVal = parsed.angle;
                  if (parsed.type === 'S') sPhaseMap[degVal] = { ring, idx: i };
                  else if (parsed.type === 'L') lPhaseMap[degVal] = { ring, idx: i };
                  else if (parsed.type === 'P') pPhaseMap[degVal] = { ring, idx: i };
                }
              });
            }
          }
          if (String(intersection.int_no) === '1045') {
            pPhaseMap[225] = { ring: 'A', idx: 1 };
          }

          if (cropData) {
            const checkActive = (map, degVal) => {
              const conf = map[degVal];
              if (!conf) return false;
              return conf.ring === 'A' ? (conf.idx === phaseA) : (conf.idx === phaseB);
            };
            const getCountdown = (map, degVal) => {
              const conf = map[degVal];
              if (!conf) return 0;
              return conf.ring === 'A' ? remainA : remainB;
            };

            const degVal = defPosAngles[(isPed ? (m - 101) : (m - 1)) % 16] || 0;
            if (isPed) {
              const pConf = pPhaseMap[degVal];
              if (pConf && checkActive(pPhaseMap, degVal)) {
                const elapsed = pConf.ring === 'A' ? (cropData[`A_RING_${phaseA}_PHASE_VAL`] || 0) - remainA : (cropData[`B_RING_${phaseB}_PHASE_VAL`] || 0) - remainB;
                let pedDuration = getCountdown(pPhaseMap, degVal) + elapsed;
                if (sigMapData && (sigMapData.ringA.length > 0 || sigMapData.ringB.length > 0)) {
                  const ringData = pConf.ring === 'A' ? sigMapData.ringA : sigMapData.ringB;
                  const activeSteps = ringData.filter(step => step[`ped${pConf.idx}`] === 1 || step[`ped${pConf.idx}`] === 5);
                  if (activeSteps.length > 0) {
                    pedDuration = activeSteps.reduce((acc, step) => acc + (step.maxTm > 0 ? step.maxTm : step.minTm), 0);
                  } else {
                    pedDuration = Math.max(0, pedDuration - 5);
                  }
                } else {
                  pedDuration = Math.max(0, pedDuration - 5);
                }
                const pedRemain = Math.max(0, pedDuration - elapsed);
                if (pedRemain > 0) {
                  signalState = pedRemain <= 7 ? 'F' : 'G';
                  countdown = pedRemain;
                }
              }
            } else {
              const isLeftMov = (m % 2 !== 0);
              const mapToUse = isLeftMov ? lPhaseMap : sPhaseMap;
              if (mapToUse[degVal] && checkActive(mapToUse, degVal)) {
                signalState = 'G';
                countdown = getCountdown(mapToUse, degVal);
                if (countdown <= 3) signalState = 'Y';
              }
            }
          }
        }

        if (signalState === 'off') return '';

        const colorClass = (signalState === 'Y' || signalState === 'F') ? 'yellow' : 'green';
        const isPedOnly = isPed;

        return `
          <div class="signal-slot" style="position: absolute; top: ${topPx}px; left: ${leftPx}px; transform: translate(-50%, -50%); display: flex; flex-direction: column; align-items: center; justify-content: center; pointer-events: none; z-index: 10000;">
            <div class="signal-arrow ${colorClass} ${isPedOnly ? 'walk-mode' : ''}" style="transform: rotate(${arrowData.ang}deg); font-weight: 800; font-size: ${isPedOnly ? '11px' : '22px'}; line-height: 1; color: ${colorClass === 'yellow' ? '#ffeb3b' : '#00ffbb'};">
              ${isPedOnly ? 'WALK' : arrowData.type}
            </div>
            <div style="font-family: monospace; font-size: 10px; font-weight: bold; color: ${colorClass === 'yellow' ? '#f59e0b' : '#00ffa2'}; text-shadow: 0 0 3px #000, 0 0 5px #000; margin-top: 1px; transform: rotate(0deg); line-height: 1;">
              ${countdown > 0 ? `${countdown}s` : ''}
            </div>
          </div>
        `;
      }).join('');

      return `
        <div class="directions-wrapper" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); zoom: var(--compass-scale, 1); width: 180px; height: 180px; border-radius: 50%; border: 2px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.5);">
          <div class="center-box" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 16px; height: 16px; background: #333; border: 2px solid #555; border-radius: 4px;"></div>
          ${htmlContent}
        </div>
      `;
    }

    // 2. 기존 신호등(Compass) 표출 모드
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

    return `
        <div class="compass-center-overlay-wrapper" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); zoom: var(--compass-scale-11, 1.1); transform-origin: center; pointer-events: none; z-index: 9999; width: 180px; height: 180px;">
          <div class="compass-center-overlay">
            ${directions.map(({ key, deg }) => {
              let s = 'off', l = 'off', p = 'off';
              let carCountdown = 0;
              let pedCountdown = 0;
              let vehHasData = false;
              let pedHasData = false;

              if (isSeoul) {
                let spat = window.SEOUL_SPAT_MAP && window.SEOUL_SPAT_MAP[intersection.int_no];
                if (spat && spat.status) {
                  const prefixMap = { 'N': 'nt', 'NE': 'ne', 'E': 'et', 'SE': 'se', 'S': 'st', 'SW': 'sw', 'W': 'wt', 'NW': 'nw' };
                  const pfx = prefixMap[key];
                  const statObj = Array.isArray(spat.status) ? (spat.status[0] || {}) : spat.status;
                  const timingObj = Array.isArray(spat.timing) ? (spat.timing[0] || {}) : spat.timing;

                  const stsg = statObj[pfx + 'StsgStatNm'];
                  const ltsg = statObj[pfx + 'LtsgStatNm'];
                  const pdsg = statObj[pfx + 'PdsgStatNm'];

                  const stTime = timingObj[pfx + 'StsgRmdrCs'];
                  const ltTime = timingObj[pfx + 'LtsgRmdrCs'];
                  const pdTime = timingObj[pfx + 'PdsgRmdrCs'];

                  if (stsg && stsg !== 'null' && stsg !== 'unknown') vehHasData = true;
                  if (ltsg && ltsg !== 'null' && ltsg !== 'unknown') vehHasData = true;
                  if (pdsg && pdsg !== 'null' && pdsg !== 'unknown') pedHasData = true;

                  const hasAnySeoulSignal = Object.keys(statObj).some(k => k.endsWith('StatNm') && statObj[k] && statObj[k] !== 'null');
                  if (!hasAnySeoulSignal && ['N', 'E', 'S', 'W'].includes(key)) {
                    vehHasData = true;
                    pedHasData = true;
                  }

                  let stOn = false, ltOn = false;
                  if (stsg === 'protected-Movement-Allowed' || stsg === 'permissive-Movement-Allowed' || stsg === '녹색' || stsg === '녹색화살표' || stsg === '청색') { 
                    s = 'green'; 
                    stOn = true; 
                    if (stTime) carCountdown = Math.max(carCountdown, Math.floor(stTime / 10));
                  } else if (stsg === 'protected-clearance' || stsg === 'permissive-clearance' || stsg === '황색') { 
                    s = 'yellow'; 
                    stOn = true; 
                    if (stTime) carCountdown = Math.max(carCountdown, Math.floor(stTime / 10));
                  }

                  if (ltsg === 'protected-Movement-Allowed' || ltsg === '녹색화살표') { 
                    l = 'green'; 
                    ltOn = true; 
                    if (ltTime) carCountdown = Math.max(carCountdown, Math.floor(ltTime / 10));
                  } else if (ltsg === 'protected-clearance' || ltsg === '황색') { 
                    l = 'yellow'; 
                    ltOn = true; 
                    if (ltTime) carCountdown = Math.max(carCountdown, Math.floor(ltTime / 10));
                  }

                  if (!stOn && !ltOn && (stsg === 'stop-And-Remain' || ltsg === 'stop-And-Remain' || stsg === '적색' || ltsg === '적색' || s === 'off')) { 
                    s = 'red'; 
                    l = 'red'; 
                  }

                  if (pdsg === 'protected-Movement-Allowed' || pdsg === 'permissive-Movement-Allowed' || pdsg === '녹색') { 
                    p = 'green'; 
                    if (pdTime) pedCountdown = Math.max(pedCountdown, Math.floor(pdTime / 10));
                  } else if (pdsg === 'protected-clearance' || pdsg === '황색') {
                    p = 'flash';
                    if (pdTime) pedCountdown = Math.max(pedCountdown, Math.floor(pdTime / 10));
                  } else if (pdsg === 'stop-And-Remain' || pdsg === '적색' || p === 'off') { 
                    p = 'red'; 
                  }
                } else {
                  if (['N', 'E', 'S', 'W'].includes(key)) {
                    vehHasData = true;
                    pedHasData = true;
                    s = 'red';
                    l = 'red';
                    p = 'red';
                  }
                }
              } else {
                const sPhaseMap = {}, lPhaseMap = {}, pPhaseMap = {};
                const detailData = window.L02_DETAIL_DATA || [];
                const conf = detailData.find(d => String(d.INT_NO) === String(intersection.int_no));
                
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

                  if (sigMapData && (sigMapData.ringA.length > 0 || sigMapData.ringB.length > 0)) {
                    Object.keys(sPhaseMap).forEach(angle => {
                      const sConf = sPhaseMap[angle];
                      const ringData = sConf.ring === 'A' ? sigMapData.ringA : sigMapData.ringB;
                      const hasPedSignal = ringData.some(step => step[`ped${sConf.idx}`] === 1 || step[`ped${sConf.idx}`] === 5);
                      if (hasPedSignal && !pPhaseMap[angle]) {
                        pPhaseMap[angle] = { ring: sConf.ring, idx: sConf.idx };
                      }
                    });
                  }
                }

                vehHasData = !!(sPhaseMap[deg] || lPhaseMap[deg]);
                pedHasData = !!pPhaseMap[deg];
                if (!vehHasData && !pedHasData) return '';

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

                  const calcPedestrian = (conf, map) => {
                    const phaseIdx = conf.idx;
                    const elapsed = conf.ring === 'A' ? (cropData[`A_RING_${phaseA}_PHASE_VAL`] || 0) - remainA : (cropData[`B_RING_${phaseB}_PHASE_VAL`] || 0) - remainB;
                    let pedDuration = getCountdown(map) + elapsed;
                    if (sigMapData && (sigMapData.ringA.length > 0 || sigMapData.ringB.length > 0)) {
                      const ringData = conf.ring === 'A' ? sigMapData.ringA : sigMapData.ringB;
                      const activeSteps = ringData.filter(step => step[`ped${phaseIdx}`] === 1 || step[`ped${phaseIdx}`] === 5);
                      if (activeSteps.length > 0) {
                        pedDuration = activeSteps.reduce((acc, step) => acc + (step.maxTm > 0 ? step.maxTm : step.minTm), 0);
                      } else {
                        pedDuration = Math.max(0, pedDuration - 5);
                      }
                    } else {
                      pedDuration = Math.max(0, pedDuration - 5);
                    }
                    const pedRemain = Math.max(0, pedDuration - elapsed);
                    if (pedRemain > 0) {
                      p = pedRemain <= 7 ? 'flash' : 'green';
                      pedCountdown = Math.max(pedCountdown, pedRemain);
                    } else {
                      p = 'red';
                    }
                  };

                  const getInactiveCountdown = (map) => {
                    const conf = map[deg];
                    if (!conf) return 0;
                    const ringPrefix = conf.ring === 'A' ? 'A_RING' : 'B_RING';
                    const currentPhaseIdx = conf.ring === 'A' ? phaseA : phaseB;
                    const currentRemain = conf.ring === 'A' ? remainA : remainB;
                    const targetIdx = conf.idx;
                    
                    let sumTime = currentRemain;
                    let step = currentPhaseIdx;
                    
                    while (step !== targetIdx) {
                      step = (step % 8) + 1;
                      const split = cropData[`${ringPrefix}_${step}_PHASE_VAL`] || 0;
                      sumTime += split;
                    }
                    return sumTime;
                  };

                  if (checkActive(sPhaseMap)) { 
                    s = 'green'; 
                    carCountdown = Math.max(carCountdown, getCountdown(sPhaseMap)); 
                  } else if (sPhaseMap[deg]) {
                    carCountdown = Math.max(carCountdown, getInactiveCountdown(sPhaseMap));
                  }

                  if (checkActive(lPhaseMap)) { 
                    l = 'green'; 
                    carCountdown = Math.max(carCountdown, getCountdown(lPhaseMap)); 
                  } else if (lPhaseMap[deg] && !checkActive(sPhaseMap)) {
                    carCountdown = Math.max(carCountdown, getInactiveCountdown(lPhaseMap));
                  }

                  if (checkActive(pPhaseMap)) calcPedestrian(pPhaseMap[deg], pPhaseMap);
                  else if (pPhaseMap[deg]) {
                    p = 'red';
                    pedCountdown = Math.max(pedCountdown, getInactiveCountdown(pPhaseMap));
                  }
                }

                if (s === 'green' && carCountdown <= 3) s = 'yellow';
                if (l === 'green' && carCountdown <= 3) l = 'yellow';
                if (p === 'green' && pedCountdown > 0 && pedCountdown <= 7) p = 'flash';

                if (s === 'off' && l === 'off' && (sPhaseMap[deg] || lPhaseMap[deg])) { s = 'red'; l = 'red'; }
                if (p === 'off' && pPhaseMap[deg]) { p = 'red'; }
              }

              let crOn = s === 'red' || l === 'red';
              let cyOn = s === 'yellow' || l === 'yellow';
              let caOn = l === 'green';
              let cgOn = s === 'green';

              let prOn = p === 'red' || p === 'off';
              let pgOn = p === 'green' || p === 'flash';

              let carColor = '#fff';
              if (cgOn || caOn) carColor = '#10b981';
              else if (cyOn) carColor = '#f59e0b';
              else if (crOn) carColor = '#ef4444';

              let pedColor = '#fff';
              if (pgOn) pedColor = '#10b981';
              else if (prOn) pedColor = '#ef4444';

              const directionLabels = {
                'N': '북', 'E': '동', 'S': '남', 'W': '서',
                'NE': '북동', 'SE': '남동', 'SW': '남서', 'NW': '북서'
              };
              const dirLabel = directionLabels[key] || '';

              return `
                <div class="signal-slot slot-${key}" id="slot-${key}">
                  ${vehHasData ? `
                    <div class="signal-mount-frame" id="veh-block-${key}">
                      <div class="component-block">
                        <div style="font-size: 10px; color: #38bdf8; font-weight: bold; margin-bottom: 2px; text-align: center; text-shadow: 0 0 3px #000; white-space: nowrap;">
                          ${dirLabel} ${carCountdown > 0 ? `<span style="color:${carColor}">${carCountdown}s</span>` : ''}
                        </div>
                        <div class="car-housing-box">
                          <div class="lens c-red ${crOn ? 'on' : ''}"></div>
                          <div class="lens c-yellow ${cyOn ? 'on' : ''}"></div>
                          <div class="lens c-arrow ${caOn ? 'on' : ''}"></div>
                          <div class="lens c-green ${cgOn ? 'on' : ''}"></div>
                        </div>
                      </div>
                    </div>
                  ` : ''}
                  ${pedHasData ? `
                    <div class="ped-mount-container">
                      <div class="ped-mount-frame" id="ped-block-${key}">
                        <div class="ped-housing-box">
                          <div class="ped-lens p-red ${prOn ? 'on' : ''}"></div>
                          <div class="ped-lens p-green ${pgOn ? 'on' : ''}"></div>
                        </div>
                        <div class="micro-timer ped-timer" style="color: ${pedColor}">${pedCountdown > 0 ? `${pedCountdown}s` : '-'}</div>
                      </div>
                    </div>
                  ` : ''}
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
  }, [intersection, cropData, phaseA, phaseB, remainA, remainB, sigMapData, isSeoul, displayMode, isSeoul ? uticUpdateTick : 0]);

  const map = useMap();
  
  const onToggleRef = useRef(onMapSignalToggle);
  useEffect(() => {
    onToggleRef.current = onMapSignalToggle;
  }, [onMapSignalToggle]);

  useEffect(() => {
    if (!map) return;
    
    const marker = L.marker([intersection.y_coord, intersection.x_coord], {
      icon: L.divIcon({
        className: 'map-realtime-signal-icon',
        html: htmlString || '<div></div>',
        iconSize: [160, 160],
        iconAnchor: [80, 80]
      }),
      zIndexOffset: 500
    });

    marker.addTo(map);
    markerRef.current = marker;

    marker.on('click', () => {
      if (onToggleRef.current) {
        onToggleRef.current(intersection.id);
      }
    });

    return () => {
      marker.remove();
      markerRef.current = null;
    };
  }, [map, intersection.id, intersection.y_coord, intersection.x_coord]);

  useEffect(() => {
    if (markerRef.current) {
      const el = markerRef.current.getElement();
      if (el) {
        el.innerHTML = htmlString;
      }
    }
  }, [htmlString]);

  return null;
}
