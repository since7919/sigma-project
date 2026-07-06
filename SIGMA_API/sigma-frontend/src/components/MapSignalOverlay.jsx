import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import axios from 'axios';
import { calculateArrowSignals, calculateCompassSignals } from '../utils/signalUtils';

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
    if (displayMode === 'arrow') {
      const arrowStates = calculateArrowSignals({
        intersection,
        isSeoul,
        cropData,
        phaseA,
        phaseB,
        remainA,
        remainB,
        sigMapData
      });

      const htmlContent = arrowStates.map(({ m, isPed, arrowData, topPx, leftPx, textRot, signalState, countdown, colorClass }) => {
        if (signalState === 'off') return '';
        const isPedOnly = isPed;

        return `
          <div class="signal-slot" style="position: absolute; top: ${topPx}px; left: ${leftPx}px; transform: translate(-50%, -50%); display: flex; flex-direction: column; align-items: center; justify-content: center; pointer-events: none; z-index: 10000;">
            <div class="signal-arrow ${colorClass} ${isPedOnly ? 'walk-mode' : ''}" style="transform: rotate(${textRot}deg); font-weight: 800; font-size: ${isPedOnly ? '11px' : '22px'}; line-height: 1; color: ${colorClass === 'yellow' ? '#ffeb3b' : '#00ffbb'};">
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

    // Compass Mode
    const compassStates = calculateCompassSignals({
      intersection,
      isSeoul,
      cropData,
      phaseA,
      phaseB,
      remainA,
      remainB,
      sigMapData
    });

    return `
      <div class="compass-center-overlay-wrapper" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); zoom: var(--compass-scale-11, 1.1); transform-origin: center; pointer-events: none; z-index: 9999; width: 180px; height: 180px;">
        <div class="compass-center-overlay">
          ${compassStates.map(({ key, vehHasData, pedHasData, carCountdown, pedCountdown, crOn, cyOn, caOn, cgOn, prOn, pgOn, carColor, pedColor, dirLabel }) => {
            if (!vehHasData && !pedHasData) return '';

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
      zIndexOffset: 500,
      interactive: false
    });

    marker.addTo(map);
    markerRef.current = marker;

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
