import React, { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, useMap } from 'react-leaflet';
import axios from 'axios';
import CompassOverlay from './CompassOverlay';
import { parsePhaseCode, toHex, getCellClass, isCarActive, isPedActive } from '../utils/signalUtils';

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
  if (strCode === '0') return '일반제';
  if (['1', '2', '3', '4', '5'].includes(strCode)) return '시차제';
  if (strCode === '6') return '보행맵';
  return '-';
};

const PhaseArrow = ({ p }) => {
  if (!p) return <span style={{ color: '#475569' }}>-</span>;
  if (p.type === 'P') return <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 'bold' }}>🚶</span>;
  if (p.type === 'U') return <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 'bold' }}>?</span>;
  
  const arrowChar = p.type === 'L' ? '↰' : '↑';
  const color = p.type === 'L' ? '#f59e0b' : '#38bdf8';
  
  return (
    <div style={{ transform: `rotate(${(p.angle + 180) % 360}deg)`, color, fontSize: '14px', fontWeight: 'bold', display: 'inline-block', lineHeight: 1 }} title={`${p.direction} ${p.outputType}`}>
      {arrowChar}
    </div>
  );
};

export default function SingleDetailOverlay({ intersection, onClose, isDual, forceZoom, uticUpdateTick, isMultiScreenOpen, mainPhases, onMainPhaseUpdate }) {
  const [localTab, setLocalTab] = useState('remainTime');
  const [cropData, setCropData] = useState(null);
  const [phaseA, setPhaseA] = useState(1);
  const [phaseB, setPhaseB] = useState(1);
  const [remainA, setRemainA] = useState(0);
  const [remainB, setRemainB] = useState(0);
  const [currentTimeStr, setCurrentTimeStr] = useState('-');
  const [sigMapDataList, setSigMapDataList] = useState([]);
  const sigMapData = useMemo(() => {
    if (!sigMapDataList || sigMapDataList.length === 0) return { ringA: [], ringB: [] };
    if (!cropData || cropData.planTp === undefined) return sigMapDataList[0];
    const planTp = cropData.planTp ?? cropData.plan_tp ?? cropData.PLAN_TP;
    const active = sigMapDataList.find(p => String(p.planTp) === String(planTp));
    return active || sigMapDataList[0];
  }, [sigMapDataList, cropData]);
  const [isSigMapLoading, setIsSigMapLoading] = useState(false);
  const [weeklyPlans, setWeeklyPlans] = useState({});
  const [allTodPlans, setAllTodPlans] = useState({});
  const [todTab, setTodTab] = useState('general');
  const [reservCtrl, setReservCtrl] = useState('-');
  const [reservCode, setReservCode] = useState(0);
  const [localZoomMode, setLocalZoomMode] = useState(false);
  const [displayMode, setDisplayMode] = useState('circle');
  const [selectedSigMapPlan, setSelectedSigMapPlan] = useState('0');

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
  
  const mapZoomMode = forceZoom !== undefined ? forceZoom : localZoomMode;

  const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:4000' : 'https://sigma-project-245n.onrender.com';

  const currentMainPhase = mainPhases?.[intersection?.id] || (intersection?.region_cd === 'L02' ? 2 : 1);

  const handleMainPhaseChange = async (e) => {
    const newPhase = e.target.value;
    const pwd = prompt('주현시 정보를 변경하려면 비밀번호를 입력하세요:');
    if (pwd) {
      try {
        const res = await fetch(`${API_BASE}/api/main-phases`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ int_no: intersection.id, main_phase: newPhase, password: pwd })
        });
        const data = await res.json();
        if (data.success) {
          alert('주현시가 저장되었습니다.');
          if (onMainPhaseUpdate) onMainPhaseUpdate(intersection.id, Number(newPhase));
        } else {
          alert(`오류: ${data.error}`);
        }
      } catch (err) {
        alert('저장 중 오류가 발생했습니다.');
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

  // CROP TOD 계획 정보 조회
  useEffect(() => {
    if (isSeoul || Object.keys(weeklyPlans).length === 0) return;
    const fetchCROP = async () => {
      try {
        const jsDay = new Date().getDay();
        const todayUticDy = jsDay + 1;
        const todayPlanNo = weeklyPlans[todayUticDy];
        if (!todayPlanNo) return;

        const regionCode = intersection.region_cd || 'L02';
        const cropUrl = `http://tsihub.utic.go.kr/tsi/api/PlanCrossRoadInfoService/getPlanCROPInfo?type=xml&srchCTId=${regionCode}&srchCRNm=${encodeURIComponent(intersection.int_nm)}&pageNo=1&numOfRows=200`;
        const res = await axios.get(`${API_BASE}/api/proxy/utic?url=${encodeURIComponent(cropUrl)}`);
        
        if (res.headers && res.headers.date) {
          const serverTime = new Date(res.headers.date).getTime();
          if (!isNaN(serverTime)) {
            window.SIGMA_TIME_OFFSET = serverTime - Date.now();
          }
        }
        
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

        let plansMap = {};
        for (let i = 1; i <= 10; i++) plansMap[String(i)] = [];
        
        for (let item of rawItems) {
          const intNo = item.INT_NO || item.itstId;
          const pno = String(item.INT_PLAN_NO || item.planNo || '-');
          if (String(intNo) === String(intersection.int_no) && plansMap[pno]) {
            const hh = parseInt(item.OPER_PLAN_HH || item.operPlanHh || 0, 10);
            const mm = parseInt(item.OPER_PLAN_MI || item.operPlanMi || 0, 10);
            const startMins = hh * 60 + mm;

            let matched = {
              planNo: pno,
              planIdxNo: item.INT_PLAN_IDX_NO || item.planIdxNo || '-',
              operPlanTm: `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}`,
              startMins,
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
            plansMap[pno].push(matched);
          }
        }
        
        for (let key in plansMap) {
          plansMap[key].sort((a, b) => a.startMins - b.startMins);
        }
        setAllTodPlans(plansMap);
        
        if (todayPlanNo && plansMap[todayPlanNo]) {
          const now = new Date();
          const currentMins = now.getHours() * 60 + now.getMinutes();
          let activePlan = plansMap[todayPlanNo][0] || null;
          for (let i = 0; i < plansMap[todayPlanNo].length; i++) {
            if (currentMins >= plansMap[todayPlanNo][i].startMins) {
              activePlan = plansMap[todayPlanNo][i];
            } else {
              break;
            }
          }
          if (activePlan) setCropData(activePlan);
        }

      } catch (err) {
        console.error('Error fetching CROP plan:', err);
      }
    };
    fetchCROP();
  }, [intersection, isSeoul, weeklyPlans]);

  // SigMap 정보 조회
  useEffect(() => {
    if (isSeoul) {
      setSigMapDataList([]);
      return;
    }
    const fetchSigMap = async () => {
      setIsSigMapLoading(true);
      try {
        const regionCode = intersection.region_cd || 'L02';
        const parser = new DOMParser();
        const getPage = async (page) => {
          const url = `http://tsihub.utic.go.kr/tsi/api/SigMapCrossRoadInfoService/getSigMapCRInfo?type=xml&srchCTId=${regionCode}&srchCRNm=${encodeURIComponent(intersection.int_nm)}&pageNo=${page}&numOfRows=100`;
          const res = await axios.get(`${API_BASE}/api/proxy/utic?url=${encodeURIComponent(url)}`);
          return parser.parseFromString(res.data, "text/xml");
        };

        const xmlDoc1 = await getPage(1);
        const totPage = parseInt(xmlDoc1.getElementsByTagName("totPage")[0]?.textContent || '1', 10);
        
        let allItems = [];
        let items1 = xmlDoc1.getElementsByTagName("SigMapCRInfo");
        if (items1.length === 0) items1 = xmlDoc1.getElementsByTagName("item");
        allItems.push(...Array.from(items1));

        if (totPage > 1) {
          const promises = [];
          for (let p = 2; p <= totPage; p++) {
            promises.push(getPage(p));
          }
          const docs = await Promise.all(promises);
          for (const doc of docs) {
            let its = doc.getElementsByTagName("SigMapCRInfo");
            if (its.length === 0) its = doc.getElementsByTagName("item");
            allItems.push(...Array.from(its));
          }
        }

        const plans = {};
        for (let i = 0; i < allItems.length; i++) {
          const item = allItems[i];
          const intNo = item.getElementsByTagName("INT_NO")[0]?.textContent;
          if (String(intNo) === String(intersection.int_no)) {
            const planTp = item.getElementsByTagName("PLAN_TP")[0]?.textContent || '0';
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
            if (!plans[planTp]) plans[planTp] = { ringA: [], ringB: [], planTp };
            if (ringNo === 0) plans[planTp].ringA.push(step);
            else if (ringNo === 1) plans[planTp].ringB.push(step);
          }
        }
        
        const list = Object.values(plans).map(p => {
          p.ringA.sort((a, b) => a.stepNo - b.stepNo);
          p.ringB.sort((a, b) => a.stepNo - b.stepNo);
          return p;
        }).sort((a, b) => parseInt(a.planTp) - parseInt(b.planTp));
        
        setSigMapDataList(list);
      } catch (err) {
        console.error('Error fetching SigMap:', err);
        setSigMapDataList([]);
      } finally {
        setIsSigMapLoading(false);
      }
    };
    fetchSigMap();
  }, [intersection, isSeoul]);

  // CRWD (계획요일) & CRRS (예약제어) 정보 조회
  useEffect(() => {
    if (isSeoul) {
      setWeeklyPlans({});
      setReservCtrl('-');
      return;
    }
    const fetchPlanAndReserv = async () => {
      try {
        const regionCode = intersection.region_cd || 'L02';
        const crNm = encodeURIComponent(intersection.int_nm);
        
        // 1. 주간 일계획표 조회 (CRWD)
        const wdUrl = `http://tsihub.utic.go.kr/tsi/api/PlanCrossRoadInfoService/getPlanCRWDInfo?type=xml&srchCTId=${regionCode}&srchCRNm=${crNm}&pageNo=1&numOfRows=10`;
        const wdRes = await axios.get(`${API_BASE}/api/proxy/utic?url=${encodeURIComponent(wdUrl)}`);
        let parser = new DOMParser();
        let xmlDoc = parser.parseFromString(wdRes.data, "text/xml");
        
        let wdItems = xmlDoc.getElementsByTagName("PlanCRWDInfo");
        if(wdItems.length === 0) wdItems = xmlDoc.getElementsByTagName("item");
        
        const plans = {};
        for(let i=0; i<wdItems.length; i++) {
          const dyNode = wdItems[i].getElementsByTagName("PLAN_DY")[0];
          const pnoNode = wdItems[i].getElementsByTagName("INT_PLAN_NO")[0];
          if(dyNode && pnoNode) {
            plans[dyNode.textContent] = pnoNode.textContent;
          }
        }
        setWeeklyPlans(plans);

        // 2. 예약제어 조회 (CRRS)
        const rsUrl = `http://tsihub.utic.go.kr/tsi/api/PlanCrossRoadInfoService/getPlanCRRSInfo?type=xml&srchCTId=${regionCode}&srchCRNm=${crNm}&pageNo=1&numOfRows=1`;
        const rsRes = await axios.get(`${API_BASE}/api/proxy/utic?url=${encodeURIComponent(rsUrl)}`);
        xmlDoc = parser.parseFromString(rsRes.data, "text/xml");
        let rsNode = xmlDoc.getElementsByTagName("RESRV_CONTRL_CD")[0];
        if (rsNode) {
          const cd = parseInt(rsNode.textContent, 10);
          setReservCode(cd);
          const rsMap = {
            1: '조광 제어', 2: '점멸 제어', 3: '소등 제어', 4: '시차 제어', 5: '감응 제어',
            6: '보행 활성', 7: '음향 발생', 8: '감응+푸시', 9: '시차+감응+푸시', 10: 'PPC제어', 11: '단독 앞막힘'
          };
          setReservCtrl(cd === 0 ? '일반 제어' : (rsMap[cd] || `알수없음(${cd})`));
        } else {
          setReservCode(0);
          setReservCtrl('-');
        }
      } catch (err) {
        console.error('Error fetching CRWD/CRRS:', err);
      }
    };
    fetchPlanAndReserv();
  }, [intersection, isSeoul]);

  // 실시간 신호 연동 시각 연산 루프
  useEffect(() => {
    const updateRealtime = () => {
      const now = new Date(Date.now() + (window.SIGMA_TIME_OFFSET || 0));
      setCurrentTimeStr(now.getFullYear() + '-' + 
        String(now.getMonth()+1).padStart(2,'0') + '-' + 
        String(now.getDate()).padStart(2,'0') + ' ' + 
        now.toLocaleTimeString('ko-KR', {hour12:false}));

      if (isSeoul) return;
      
      let activePlan = cropData;
      if (allTodPlans && Object.keys(allTodPlans).length > 0) {
        const jsDay = new Date().getDay();
        const todayUticDy = jsDay + 1;
        const todayPlanNo = weeklyPlans[todayUticDy];
        if (todayPlanNo && allTodPlans[todayPlanNo]) {
          let todaysPlans = allTodPlans[todayPlanNo];
          const currentMins = now.getHours() * 60 + now.getMinutes();
          let currentActive = todaysPlans[0];
          for (let i = 0; i < todaysPlans.length; i++) {
            if (currentMins >= todaysPlans[i].startMins) {
              currentActive = todaysPlans[i];
            } else {
              break;
            }
          }
          if (currentActive && (!cropData || currentActive.planIdxNo !== cropData.planIdxNo || currentActive.planNo !== cropData.planNo)) {
            setCropData(currentActive);
            return;
          }
          activePlan = currentActive;
        }
      }

      if (!activePlan || !activePlan.cycle) return;

      const cycle = activePlan.cycle;
      const offset = activePlan.offset || 0;
      
      let splitSum = 0;
      if (currentMainPhase > 1 && cropData) {
         for (let i = 1; i < currentMainPhase; i++) {
            splitSum += (cropData[`A_RING_${i}_PHASE_VAL`] || 0);
         }
      }
      const adjustedOffset = (offset - splitSum + cycle * 10) % cycle;
      
      const kstTimeStr = now.toLocaleString("en-US", { timeZone: "Asia/Seoul" });
      const kstNow = new Date(kstTimeStr);
      
      const midnight = new Date(kstNow.getFullYear(), kstNow.getMonth(), kstNow.getDate(), 0, 0, 0, 0);
      const secondsSinceMidnight = Math.floor((kstNow.getTime() - midnight.getTime()) / 1000);
      
      const timeInCycle = (secondsSinceMidnight - adjustedOffset + cycle * 10) % cycle;

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
  }, [cropData, isSeoul, allTodPlans, weeklyPlans, phaseA, phaseB, remainA, remainB]);

  const detailData = window.L02_DETAIL_DATA || [];
  const conf = !isSeoul ? detailData.find(d => String(d.INT_NO) === String(intersection.int_no)) : null;

  // 실시간 신호 테이블 데이터 가공 로직
  const updatedPhases = useMemo(() => {
    let phases = [];

    if (isSeoul) {
      let spat = window.SEOUL_SPAT_MAP && window.SEOUL_SPAT_MAP[intersection.int_no];
      if (spat && spat.status) {
        const statObj = Array.isArray(spat.status) ? (spat.status[0] || {}) : spat.status;
        const prefixMap = { 'nt': '북', 'ne': '북동', 'et': '동', 'se': '남동', 'st': '남', 'sw': '남서', 'wt': '서', 'nw': '북서' };
        const angleMap = { 'nt': 0, 'ne': 45, 'et': 90, 'se': 135, 'st': 180, 'sw': 225, 'wt': 270, 'nw': 315 };
        
        Object.entries(prefixMap).forEach(([pfx, dirKor]) => {
          if (statObj[pfx + 'StsgStatNm'] !== undefined && statObj[pfx + 'StsgStatNm'] !== null) {
            phases.push({
              direction: dirKor,
              outputType: '직진(1)',
              pedestrian: 0,
              type: 'S',
              angle: angleMap[pfx],
              pfx: pfx
            });
          }
          if (statObj[pfx + 'LtsgStatNm'] !== undefined && statObj[pfx + 'LtsgStatNm'] !== null) {
            phases.push({
              direction: dirKor,
              outputType: '좌회전(2)',
              pedestrian: 0,
              type: 'L',
              angle: angleMap[pfx],
              pfx: pfx
            });
          }
          if (statObj[pfx + 'PdsgStatNm'] !== undefined && statObj[pfx + 'PdsgStatNm'] !== null) {
            phases.push({
              direction: dirKor,
              outputType: '보행(3)',
              pedestrian: 0,
              type: 'P',
              angle: angleMap[pfx],
              pfx: pfx
            });
          }
        });
      }
    } else if (conf) {
      phases = [1, 2, 3, 4, 5, 6, 7, 8].reduce((acc, idx) => {
        const aPhase = parsePhaseCode(conf[`A_RING_${idx}_PHASE_CONF_CD`]);
        const bPhase = parsePhaseCode(conf[`B_RING_${idx}_PHASE_CONF_CD`]);
        if (aPhase) acc.push({ ...aPhase, ring: 'A', idx });
        if (bPhase) acc.push({ ...bPhase, ring: 'B', idx });
        return acc;
      }, []);

      if (cropData) {
        const vehiclePhases = phases.filter(p => p.type === 'S' || p.type === 'L');
        vehiclePhases.forEach(vPhase => {
          const hasPhase = (cropData[`${vPhase.ring}_RING_${vPhase.idx}_PHASE_VAL`] || 0) > 0;
          if (hasPhase) {
            const existingPed = phases.find(p => p.type === 'P' && p.ring === vPhase.ring && p.idx === vPhase.idx);
            if (!existingPed) {
              const uPhaseIndex = phases.findIndex(p => p.type === 'U' && p.ring === vPhase.ring && p.idx === vPhase.idx);
              if (uPhaseIndex !== -1) {
                phases[uPhaseIndex].type = 'P';
                phases[uPhaseIndex].outputType = '보행(3)';
                phases[uPhaseIndex].angle = vPhase.angle;
                phases[uPhaseIndex].direction = vPhase.direction;
              } else {
                phases.push({
                  direction: vPhase.direction,
                  outputType: '보행(3)',
                  pedestrian: 0,
                  type: 'P',
                  angle: vPhase.angle,
                  ring: vPhase.ring,
                  idx: vPhase.idx
                });
              }
            }
          }
        });

        if (sigMapData && (sigMapData.ringA?.length > 0 || sigMapData.ringB?.length > 0)) {
          ['A', 'B'].forEach(ring => {
            const ringData = ring === 'A' ? sigMapData.ringA : sigMapData.ringB;
            if (!ringData) return;
            for (let lsuIdx = 1; lsuIdx <= 8; lsuIdx++) {
              // 1. 시그널맵을 통째로 뒤져서, 이 링의 이 LSU 인덱스에 '보행 신호'가 존재하는지 확인.
              const hasPedLSU = sigMapDataList.some(plan => {
                const planRingData = ring === 'A' ? plan.ringA : plan.ringB;
                return planRingData.some(step => {
                  const hex = toHex(step[`ped${lsuIdx}`]);
                  return hex === '01' || hex === '05';
                });
              });

              if (hasPedLSU) {
                // 2. 방향 특정: 이 LSU(lsuIdx)를 담당하는 차량 신호의 방향을 기반정보에서 찾는다.
                let vehPhases = phases.filter(p => (p.type === 'S' || p.type === 'L') && p.ring === ring && p.idx === lsuIdx);
                
                if (vehPhases.length === 0) {
                  // 단일 방향 링
                  const ringVehs = phases.filter(p => (p.type === 'S' || p.type === 'L') && p.ring === ring);
                  const uniqueDirs = [...new Set(ringVehs.map(p => p.direction))];
                  if (uniqueDirs.length === 1) {
                    vehPhases = [ringVehs[0]];
                  } else {
                    // 최후 수단: N+1
                    vehPhases = phases.filter(p => (p.type === 'S' || p.type === 'L') && p.ring === ring && p.idx === (lsuIdx + 1));
                  }
                }

                if (vehPhases.length > 0) {
                  const targetDirection = vehPhases[0].direction;
                  const targetAngle = vehPhases[0].angle;

                  // 3. '어느 현시에 켜지는가?': 시그널맵에서 EOP를 기준으로 현시 번호를 계산하여 보행 신호(01, 05)가 등장하는 현시를 추출
                  let pedPhases = new Set();
                  sigMapDataList.forEach(plan => {
                    const planRingData = ring === 'A' ? plan.ringA : plan.ringB;
                    let currentPhase = 1;
                    planRingData.forEach(step => {
                      const hex = toHex(step[`ped${lsuIdx}`]);
                      if (hex === '01' || hex === '05') {
                        pedPhases.add(currentPhase);
                      }
                      if (step.eop === 1) {
                        currentPhase++;
                      }
                    });
                  });

                  // 추출된 각각의 현시에 보행 신호를 푸시
                  pedPhases.forEach(phaseNo => {
                    const existingPed = phases.some(p => p.type === 'P' && p.ring === ring && p.idx === phaseNo && p.angle === targetAngle);
                    if (!existingPed) {
                      phases.push({
                        direction: targetDirection,
                        outputType: '보행(3)',
                        pedestrian: 0,
                        type: 'P',
                        angle: targetAngle,
                        ring: ring,
                        idx: phaseNo, // 정확히 계산된 현시 번호(Phase No)를 매핑!
                        inferred: true
                      });
                    }
                  });
                }
              }

              const hasLeftSignal = sigMapDataList.some(plan => {
                const planRingData = ring === 'A' ? plan.ringA : plan.ringB;
                return planRingData.some(step => {
                  const hex = toHex(step[`car${lsuIdx}`]);
                  return hex === '10' || hex === '11' || hex === '20';
                });
              });
              if (hasLeftSignal) {
                const sPhases = phases.filter(p => p.type === 'S' && p.ring === ring && p.lsuIdx === lsuIdx);
                sPhases.forEach(sPhaseMatch => {
                  const hasLeftPhase = phases.some(p => p.type === 'L' && p.ring === ring && p.lsuIdx === lsuIdx && p.angle === sPhaseMatch.angle);
                  if (!hasLeftPhase) {
                    phases.push({
                      direction: sPhaseMatch.direction,
                      outputType: '좌회전(2)',
                      pedestrian: 0,
                      type: 'L',
                      angle: sPhaseMatch.angle,
                      ring: ring,
                      lsuIdx: lsuIdx,
                      inferred: true
                    });
                  }
                });
              }
            }
          });
        }
      }
    }

    const uniqueMovementsMap = new Map();
    // 시그널맵 데이터가 존재한다면, 시그널맵 유추 결과에 없는 보행 신호(SPaT 등에서 임의 생성된 것)는 제거
    if (sigMapDataList && sigMapDataList.length > 0) {
      const validPedAngles = new Set(phases.filter(p => p.type === 'P' && p.inferred).map(p => p.angle));
      phases = phases.filter(p => {
        if (p.type === 'P' && !p.inferred) {
          // 시그널맵을 통해 유추된 보행 신호가 있다면, 기존 기반정보(L02)나 
          // SPaT의 잘못된 보행 현시 정보를 제거하여 중복 표출 및 현시 꼬임을 방지합니다.
          return !validPedAngles.has(p.angle);
        }
        return true;
      });
    }

    phases.forEach(p => {
      const key = `${p.angle}_${p.type}`;
      if (!uniqueMovementsMap.has(key)) {
        uniqueMovementsMap.set(key, { ...p, confs: [] });
      }
      uniqueMovementsMap.get(key).confs.push(p);
    });

    const mapped = Array.from(uniqueMovementsMap.values()).map(m => {
      let isGreen = false;
      let statText = '소등';
      let statClass = 'sig-status-gray';
      let remaining = '-';
      let displayTime = '-';

      if (isSeoul) {
        let spat = window.SEOUL_SPAT_MAP && window.SEOUL_SPAT_MAP[intersection.int_no];
        let pfx = '';
        if (m.angle === 0) pfx = 'nt';
        else if (m.angle === 45) pfx = 'ne';
        else if (m.angle === 90) pfx = 'et';
        else if (m.angle === 135) pfx = 'se';
        else if (m.angle === 180) pfx = 'st';
        else if (m.angle === 225) pfx = 'sw';
        else if (m.angle === 270) pfx = 'wt';
        else if (m.angle === 315) pfx = 'nw';

        if (spat && spat.status && pfx) {
          const statObj = Array.isArray(spat.status) ? (spat.status[0] || {}) : spat.status;
          const timingObj = Array.isArray(spat.timing) ? (spat.timing[0] || {}) : spat.timing;
          
          let field = pfx + 'StsgStatNm';
          let timeField = pfx + 'StsgRmdrCs';
          if (m.type === 'L') { field = pfx + 'LtsgStatNm'; timeField = pfx + 'LtsgRmdrCs'; }
          if (m.type === 'P') { field = pfx + 'PdsgStatNm'; timeField = pfx + 'PdsgRmdrCs'; }
          
          const val = statObj[field];
          const remVal = timingObj[timeField];
          
          const parseRemVal = (v) => (v !== undefined && v !== null && v < 36000) ? (Math.floor(v / 10) + 's') : '-';
          
          if (val === 'protected-Movement-Allowed' || val === 'permissive-Movement-Allowed' || val === '녹색' || val === '녹색화살표' || val === '청색') {
            isGreen = true;
            statText = m.type === 'P' ? '녹색 점등(3)' : '녹색 점등(3)';
            statClass = 'sig-status-green';
            remaining = parseRemVal(remVal);
          } else if (val === 'stop-And-Remain' || val === '적색') {
            statText = m.type === 'P' ? '적색 점등(1)' : '적색 점등(1)';
            statClass = 'sig-status-red';
            remaining = parseRemVal(remVal);
          } else if (val === 'protected-clearance' || val === 'permissive-clearance' || val === '황색' || val === '적-황색') {
            statText = m.type === 'P' ? '보행 점멸(3)' : '황색 점등(2)';
            statClass = m.type === 'P' ? 'sig-status-flash' : 'sig-status-yellow';
            remaining = parseRemVal(remVal);
          }
        }
      } else {
        if (cropData && m.confs.length > 0) {
          const getStepsForCurrentPhase = (ring, currentPhase) => {
            const ringData = ring === 'A' ? sigMapData.ringA : sigMapData.ringB;
            if (!ringData || ringData.length === 0) return [];
            let p = 1;
            let stepsInPhase = [];
            for (let step of ringData) {
              if (p === currentPhase) {
                stepsInPhase.push(step);
              }
              if (step.eop === 1) {
                p++;
              }
            }
            return stepsInPhase;
          };

          const activeConf = m.confs.find(conf => {
            const currentPhase = conf.ring === 'A' ? phaseA : phaseB;
            if (conf.idx !== currentPhase) return false;

            if (sigMapData && (sigMapData.ringA?.length > 0 || sigMapData.ringB?.length > 0)) {
              const phaseSteps = getStepsForCurrentPhase(conf.ring, currentPhase);
              if (m.type === 'P') {
                return phaseSteps.some(step => isPedActive(step[`ped${conf.idx}`]));
              } else {
                return phaseSteps.some(step => {
                  for (let i = 1; i <= 8; i++) {
                    if (isCarActive(step[`car${i}`])) return true;
                  }
                  return false;
                });
              }
            }
            return true;
          });

          const cycle = cropData.cycle || 0;

          const getPedDuration = (conf) => {
            const currentPhase = conf.ring === 'A' ? phaseA : phaseB;
            const pVal = cropData[`${conf.ring}_RING_${currentPhase}_PHASE_VAL`] || 0;
            let pedDur = pVal;
            if (sigMapData && (sigMapData.ringA.length > 0 || sigMapData.ringB.length > 0)) {
              const ringData = conf.ring === 'A' ? sigMapData.ringA : sigMapData.ringB;
              const phaseSteps = getStepsForCurrentPhase(conf.ring, currentPhase);
              const activeSteps = phaseSteps.filter(s => isPedActive(s[`ped${conf.idx}`]));
              if (activeSteps.length > 0) {
                pedDur = activeSteps.reduce((acc, s) => acc + (s.maxTm > 0 ? s.maxTm : s.minTm), 0);
              } else {
                pedDur = Math.max(0, pedDur - 5);
              }
            } else {
              pedDur = Math.max(0, pedDur - 5);
            }
            return pedDur;
          };

          let isRed = true;

          if (cropData.cycle === 0) {
            isGreen = false;
            statText = '점멸/소등';
            statClass = 'sig-status-flash';
            remaining = '-';
            displayTime = '-';
          } else {
            if (activeConf) {
              const remainingTime = activeConf.ring === 'A' ? remainA : remainB;
              const currentPhase = activeConf.ring === 'A' ? phaseA : phaseB;
              const phaseVal = cropData[`${activeConf.ring}_RING_${currentPhase}_PHASE_VAL`] || 0;
              const elapsed = phaseVal - remainingTime;

              if (m.type === 'P') {
                const pedDuration = getPedDuration(activeConf);
                const pedRemain = Math.max(0, pedDuration - elapsed);

                if (pedRemain > 0) {
                  isRed = false;
                  isGreen = true;
                  if (pedRemain <= 7) {
                    statText = '보행 점멸(3)';
                    statClass = 'sig-status-flash';
                    displayTime = Math.min(pedDuration, 7) + 's';
                    remaining = pedRemain + 's';
                  } else {
                    statText = '녹색 점등(3)';
                    statClass = 'sig-status-green';
                    displayTime = Math.max(0, pedDuration - 7) + 's';
                    remaining = (pedRemain - 7) + 's';
                  }
                }
              } else {
                let carActive = true;
                if (sigMapData && (sigMapData.ringA.length > 0 || sigMapData.ringB.length > 0)) {
                  const ringData = activeConf.ring === 'A' ? sigMapData.ringA : sigMapData.ringB;
                  const phaseSteps = getStepsForCurrentPhase(activeConf.ring, currentPhase);
                  const activeSteps = phaseSteps.filter(s => {
                    for (let i = 1; i <= 8; i++) {
                      if (isCarActive(s[`car${i}`])) return true;
                    }
                    return false;
                  });
                  if (activeSteps.length === 0) {
                    carActive = false;
                  }
                }

                if (carActive) {
                  isRed = false;
                  isGreen = true;
                  if (remainingTime <= 3) {
                    statText = '황색 점등(2)';
                    statClass = 'sig-status-yellow';
                    displayTime = '3s';
                    remaining = remainingTime + 's';
                  } else {
                    statText = '녹색 점등(3)';
                    statClass = 'sig-status-green';
                    displayTime = Math.max(0, phaseVal - 3) + 's';
                    remaining = (remainingTime - 3) + 's';
                  }
                } else {
                  isRed = true;
                }
              }
            }

            if (isRed) {
              isGreen = false;
              statText = m.type === 'P' ? '적색 점등(1)' : '적색 점등(1)';
              statClass = 'sig-status-red';

              let minRedRemain = Infinity;
              for (const conf of m.confs) {
                const ringPrefix = conf.ring === 'A' ? 'A_RING' : 'B_RING';
                const currentPhaseIdx = conf.ring === 'A' ? phaseA : phaseB;
                const currentRemain = conf.ring === 'A' ? remainA : remainB;
                
                let targetIdx = conf.idx;
                if (sigMapData && (sigMapData.ringA?.length > 0 || sigMapData.ringB?.length > 0)) {
                  const ringData = conf.ring === 'A' ? sigMapData.ringA : sigMapData.ringB;
                  let foundTargetPhase = null;
                  let p = 1;
                  for (let step of ringData) {
                    const isActive = m.type === 'P'
                      ? isPedActive(step[`ped${conf.idx}`])
                      : isCarActive(step[`car${conf.idx}`]);
                    if (isActive) {
                      foundTargetPhase = p;
                      break;
                    }
                    if (step.eop === 1) p++;
                  }
                  if (foundTargetPhase !== null) {
                    targetIdx = foundTargetPhase;
                  }
                }

                let sumTime = 0;
                if (currentPhaseIdx === targetIdx) {
                  const phaseVal = cropData[`${ringPrefix}_${targetIdx}_PHASE_VAL`] || 0;
                  const elapsed = phaseVal - currentRemain;
                  sumTime = cycle - elapsed;
                } else {
                  sumTime = currentRemain;
                  let step = currentPhaseIdx;
                  let loopCount = 0;
                  while (step !== targetIdx && loopCount < 8) {
                    step = (step % 8) + 1;
                    if (step === targetIdx) break;
                    const split = cropData[`${ringPrefix}_${step}_PHASE_VAL`] || 0;
                    sumTime += split;
                    loopCount++;
                  }
                }
                if (sumTime < minRedRemain) minRedRemain = sumTime;
              }

              remaining = minRedRemain + 's';

              let ringTotals = { A: 0, B: 0 };
              for (const conf of m.confs) {
                if (m.type === 'P') {
                  ringTotals[conf.ring] += getPedDuration(conf);
                } else {
                  let activePhaseIdx = conf.idx;
                  if (sigMapData && (sigMapData.ringA?.length > 0 || sigMapData.ringB?.length > 0)) {
                    const ringData = conf.ring === 'A' ? sigMapData.ringA : sigMapData.ringB;
                    let foundTargetPhase = null;
                    let p = 1;
                    for (let step of ringData) {
                      const isActive = isCarActive(step[`car${conf.idx}`]);
                      if (isActive) { foundTargetPhase = p; break; }
                      if (step.eop === 1) p++;
                    }
                    if (foundTargetPhase !== null) activePhaseIdx = foundTargetPhase;
                  }
                  ringTotals[conf.ring] += (cropData[`${conf.ring}_RING_${activePhaseIdx}_PHASE_VAL`] || 0);
                }
              }
              let totalActive = Math.max(ringTotals.A, ringTotals.B);
              displayTime = Math.max(0, cycle - totalActive) + 's';
            }
          }
        }
      }

      return {
        ...m,
        isGreen,
        remaining,
        displayTime,
        statusText: statText,
        statusClass: statClass
      };
    });

    return {
      unique: mapped.sort((a, b) => {
        if (a.angle !== b.angle) return a.angle - b.angle;
        const typeWeight = { 'S': 1, 'L': 2, 'P': 3 };
        const weightA = typeWeight[a.type] || 4;
        const weightB = typeWeight[b.type] || 4;
        return weightA - weightB;
      }),
      all: phases
    };
  }, [intersection, isSeoul, cropData, phaseA, phaseB, remainA, remainB, uticUpdateTick, sigMapData]);

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

  const isApiOn = isSeoul ? (window.SEOUL_SPAT_MAP && window.SEOUL_SPAT_MAP[intersection.int_no]) : cropData;

  return (
    <div className={isDual ? "overlay" : "detail-modal-overlay"} style={isMultiScreenOpen ? { background: 'transparent', pointerEvents: 'none' } : {}}>
      <div className="detail-modal-content" style={
        isDual ? {width:'100%', height:'100%', borderRadius:0} :
        isMultiScreenOpen ? {
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '80%',
          maxWidth: '1000px',
          height: '80%',
          boxShadow: '0 30px 60px rgba(0,0,0,0.8)',
          pointerEvents: 'auto',
          border: '1px solid rgba(56, 189, 248, 0.5)'
        } : {}
      }>
        <header className="modal-header">
          <h2>🚦 {intersection.int_nm} <span style={{fontSize:'0.8rem', color:'#94a3b8', marginLeft:10}}>ID: {intersection.int_no}</span></h2>
          <button className="btn-close" onClick={onClose}>×</button>
        </header>

        <div className="modal-top-map" style={mapZoomMode ? { flex: 1 } : {}}>
          {!isDual && (
            <div className="overlay-toolbar" style={{ display: 'flex', gap: '15px' }}>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="toolbar-btn" onClick={() => setLocalZoomMode(!localZoomMode)}>
                  {localZoomMode ? '맵 축소 (전체 정보)' : '맵 확대 모드'}
                </button>
                <button className="toolbar-btn" onClick={() => setDisplayMode(displayMode === 'circle' ? 'arrow' : 'circle')}>
                  {displayMode === 'circle' ? (
                    <svg width="28" height="14" viewBox="0 0 28 14" fill="none" xmlns="http://www.w3.org/2000/svg" title="신호등 모드"><rect x="1" y="1" width="26" height="12" rx="4" fill="#222" stroke="#555" strokeWidth="2"></rect><circle cx="7" cy="7" r="3" fill="#ef4444"></circle><circle cx="14" cy="7" r="3" fill="#eab308"></circle><circle cx="21" cy="7" r="3" fill="#22c55e"></circle></svg>
                  ) : (
                    <svg width="24" height="18" viewBox="0 0 24 18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" title="화살표 모드"><path d="M11 16V9a3 3 0 0 0-3-3H3" /><path d="M6 3L2 6l4 3" /><path d="M18 16V2" /><path d="M14 6l4-4 4 4" /></svg>
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
              intersection={intersection}
              cropData={cropData}
              phaseA={phaseA}
              phaseB={phaseB}
              remainA={remainA}
              remainB={remainB}
              isSeoul={isSeoul}
              sigMapData={sigMapData} updatedPhases={updatedPhases.unique}
              displayMode={displayMode}
            />
          </div>
        </div>

        {!mapZoomMode && (
          <div className="modal-bottom-data">
            <div className="tabs-header">
              <button className={`tab-btn ${localTab === 'remainTime' ? 'active' : ''}`} onClick={() => setLocalTab('remainTime')}>신호계획정보</button>
              <button className={`tab-btn ${localTab === 'signalmap' ? 'active' : ''}`} onClick={() => setLocalTab('signalmap')}>시그널맵</button>
              <button className={`tab-btn ${localTab === 'baseinfo' ? 'active' : ''}`} onClick={() => setLocalTab('baseinfo')}>기반정보</button>
            </div>
            <div className="detail-tab-content custom-scroll">
              {localTab === 'baseinfo' && (
                <div style={{ padding: '20px', color: '#fff', fontSize: '13px', height: '100%', overflowY: 'auto' }}>
                  <h3 style={{ color: '#00ecff', marginBottom: '15px' }}>L02 교차로 기반 정보 (JSON)</h3>
                  {conf ? (
                    (() => {
                      const baseRows = [];
                      ['A', 'B'].forEach(ring => {
                        for (let i = 1; i <= 8; i++) {
                          const code = conf[`${ring}_RING_${i}_PHASE_CONF_CD`];
                          if (code && typeof code === 'string' && code.length >= 7) {
                            const typeChar = code.charAt(0).toUpperCase();
                            let typeName = '미지정';
                            if (typeChar === 'S') typeName = '직진(S)';
                            else if (typeChar === 'L') typeName = '좌회전(L)';
                            else if (typeChar === 'P') typeName = '보행(P)';
                            else if (typeChar === 'U') typeName = '유턴(U)';
                            const inAngle = parseInt(code.substring(1, 4), 10);
                            const outAngle = parseInt(code.substring(4, 7), 10);
                            baseRows.push({
                              ringStep: `${ring}링 ${i}현시`,
                              type: typeName,
                              inAngle: !isNaN(inAngle) ? inAngle + '°' : '-',
                              outAngle: !isNaN(outAngle) ? outAngle + '°' : '-',
                              fullCode: code,
                              remark: '기반정보'
                            });
                          }
                          const inferredPhases = updatedPhases.all.filter(p => p.ring === ring && p.idx === i && p.inferred);
                          inferredPhases.forEach(p => {
                            baseRows.push({
                              ringStep: `${ring}링 ${i}현시`,
                              type: p.type === 'L' ? '좌회전(L)' : '보행(P)',
                              inAngle: '-',
                              outAngle: '-',
                              fullCode: '-',
                              remark: '시그널맵 유추'
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
                                  <th>현시</th>
                                  <th>신호종류</th>
                                  <th>진입방위각</th>
                                  <th>진출방위각</th>
                                  <th>전체코드</th>
                                  <th>비고</th>
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
                                    <td style={{ color: row.remark === '시그널맵 유추' ? '#f59e0b' : '#38bdf8', fontSize: '11px' }}>{row.remark}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          ) : (
                            <div style={{ opacity: 0.5, textAlign: 'center', padding: '20px' }}>유효한 현시 코드가 없습니다.</div>
                          )}
                          <details style={{ marginTop: '20px', borderTop: '1px solid #1e293b', paddingTop: '10px' }}>
                            <summary style={{ cursor: 'pointer', color: '#94a3b8' }}>원본 JSON 데이터 보기</summary>
                            <pre style={{ margin: '10px 0 0 0', whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontFamily: 'monospace', fontSize: '11px', color: '#64748b' }}>
                              {JSON.stringify(conf, null, 2)}
                            </pre>
                          </details>
                        </div>
                      );
                    })()
                  ) : (
                    <div style={{ padding: '30px', opacity: 0.5, textAlign: 'center' }}>해당 교차로의 기반 정보가 없습니다.</div>
                  )}
                </div>
              )}
              {localTab === 'remainTime' && (
                
<div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }}>
  <div style={{ display: 'flex', gap: '20px', flex: 1, minHeight: 0 }}>
    <div style={{ width: '50%', height: '100%', overflowY: 'auto', paddingRight: '10px', borderRight: '1px solid #1e293b' }} className="custom-scroll">
      <table className="detail-grid-table">
                  <thead>
                    <tr>
                      <th>방향정보</th>
                      <th>출력형태</th>
                      <th style={{width: '90px'}}>신호등상태</th>
                      <th>잔여시간</th>
                      <th>표출시간</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      if (updatedPhases.unique.length === 0) {
                        return <tr><td colSpan="5" style={{padding: '30px', opacity: 0.5}}>신호 구성 계획 정보가 없습니다.</td></tr>;
                      }
                      
                      const grouped = updatedPhases.unique.reduce((acc, p) => {
                        if (!acc[p.direction]) acc[p.direction] = [];
                        acc[p.direction].push(p);
                        return acc;
                      }, {});

                      return Object.entries(grouped).map(([dir, phases]) => (
                        <React.Fragment key={dir}>
                          <tr style={{ borderTop: '2px solid #475569' }}>
                            <td rowSpan={phases.length} className="action-type" style={{background: 'rgba(255,255,255,0.05)', fontWeight: 'bold', borderRight: '1px solid #334155', verticalAlign: 'middle', padding: '4px 8px'}}>
                              {dir}측
                            </td>
                            <td style={{padding: '4px 8px'}}><span className="status-badge" style={{color:'#60a5fa', padding: '2px 4px', fontSize: '11px'}}>{phases[0].outputType}</span></td>
                            <td style={{padding: '4px 8px'}}><span className={phases[0].statusClass} style={{padding: '2px 4px', fontSize: '11px'}}>{phases[0].statusText}</span></td>
                            <td style={{fontFamily: 'monospace', fontWeight: 'bold', color: phases[0].isGreen ? '#10b981' : '#94a3b8', padding: '4px 8px', fontSize: '12px'}}>
                              {phases[0].remaining !== '-' ? phases[0].remaining : '-'}
                            </td>
                            <td style={{fontFamily: 'monospace', fontWeight: 'bold', color: '#f59e0b', padding: '4px 8px', fontSize: '12px'}}>
                              {phases[0].displayTime || '-'}
                            </td>
                          </tr>
                          {phases.slice(1).map((p, idx) => (
                            <tr key={`${dir}-${idx}`}>
                              <td style={{padding: '4px 8px'}}><span className="status-badge" style={{color:'#60a5fa', padding: '2px 4px', fontSize: '11px'}}>{p.outputType}</span></td>
                              <td style={{padding: '4px 8px'}}><span className={p.statusClass} style={{padding: '2px 4px', fontSize: '11px'}}>{p.statusText}</span></td>
                              <td style={{fontFamily: 'monospace', fontWeight: 'bold', color: p.isGreen ? '#10b981' : '#94a3b8', padding: '4px 8px', fontSize: '12px'}}>
                                {p.remaining !== '-' ? p.remaining : '-'}
                              </td>
                              <td style={{fontFamily: 'monospace', fontWeight: 'bold', color: '#f59e0b', padding: '4px 8px', fontSize: '12px'}}>
                                {p.displayTime || '-'}
                              </td>
                            </tr>
                          ))}
                        </React.Fragment>
                      ));
                    })()}
                  </tbody>
                </table>
                <div style={{ textAlign: 'right', marginTop: '5px', fontSize: '11px', color: '#94a3b8' }}>
                  교차로시각: {currentTimeStr}
                </div>

  {phaseDiagramData.length > 0 && (
    <div style={{ marginTop: '15px', paddingTop: '10px', borderTop: '2px solid #1e293b' }}>
      <div style={{ color: '#38bdf8', fontWeight: 'bold', fontSize: '13px', marginBottom: '8px' }}>현시표 (Phase Diagram)</div>
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
                <span>{ph.idx}현시</span>
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
                <span style={{ color: '#38bdf8', fontWeight: 'bold', fontSize: '13px', borderBottom: '2px solid #38bdf8', paddingBottom: '2px' }}>운영정보</span>
                <table style={{ width: '100%', marginTop: '10px', borderCollapse: 'collapse', textAlign: 'center', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.05)', color: '#94a3b8' }}>
                      <th style={{ padding: '6px', border: '1px solid #334155' }}>주기(Cycle)</th>
                      <th style={{ padding: '6px', border: '1px solid #334155' }}>주현시</th>
                      <th style={{ padding: '6px', border: '1px solid #334155' }}>연동값(Offset)</th>
                      <th style={{ padding: '6px', border: '1px solid #334155' }}>요일계획(Day plan)</th>
                      <th style={{ padding: '6px', border: '1px solid #334155' }}>시간계획(Time plan)</th>
                      <th style={{ padding: '6px', border: '1px solid #334155' }}>시간(Time)</th>
                      <th style={{ padding: '6px', border: '1px solid #334155' }}>시차계획(Plan)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ padding: '6px', border: '1px solid #334155', color: '#38bdf8', fontWeight: 'bold' }}>{cropData ? `${cropData.cycle}초` : '미연동'}</td>
                      <td style={{ padding: '6px', border: '1px solid #334155' }}>
                        <select value={currentMainPhase} onChange={handleMainPhaseChange} style={{ background: '#1e293b', color: '#fff', border: '1px solid #475569', borderRadius: '4px', padding: '2px', cursor: 'pointer' }}>
                          {[1,2,3,4,5,6,7,8].map(p => <option key={p} value={p}>{p}현시</option>)}
                        </select>
                      </td>
                      <td style={{ padding: '6px', border: '1px solid #334155', color: '#fff', fontWeight: 'bold' }}>{cropData ? `${cropData.offset}초` : '-'}</td>
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
                <span style={{ color: '#38bdf8', fontWeight: 'bold', fontSize: '13px' }}>주간 일계획표</span>
                <table style={{ width: '100%', marginTop: '8px', borderCollapse: 'collapse', textAlign: 'center', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.1)' }}>
                      {['월', '화', '수', '목', '금', '토', '일'].map((day, idx) => {
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
                    <span style={{ color: '#38bdf8', fontWeight: 'bold', fontSize: '13px' }}>TOD 계획정보 (현재 실행: 일계획 {cropData?.planNo})</span>
                    <div style={{ display: 'flex', gap: '5px' }}>
                      <button onClick={() => setTodTab('general')} style={{ background: todTab === 'general' ? '#0ea5e9' : '#334155', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', transition: '0.2s' }}>일반맵 (1~5)</button>
                      <button onClick={() => setTodTab('offset')} style={{ background: todTab === 'offset' ? '#0ea5e9' : '#334155', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', transition: '0.2s' }}>시차맵 (6~10)</button>
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
                                일계획 {pNo}
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
                    <div style={{padding: '30px', textAlign: 'center', color: '#38bdf8'}}>시그널맵 데이터를 불러오는 중...</div>
                  ) : (sigMapDataList.length === 0) ? (
                    <div style={{padding: '30px', textAlign: 'center', color: '#f59e0b'}}>현재 이 교차로의 시그널맵 데이터가 없습니다.</div>
                  ) : (
                    <>
                      <div style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <label style={{ color: '#94a3b8', fontSize: '13px' }}>플랜 선택:</label>
                        <select 
                          value={selectedSigMapPlan}
                          onChange={(e) => setSelectedSigMapPlan(e.target.value)}
                          style={{ background: '#334155', color: '#fff', border: '1px solid #475569', borderRadius: '4px', padding: '4px 8px', fontSize: '13px' }}
                        >
                          {sigMapDataList.map((p, idx) => (
                            <option key={idx} value={String(p.planTp)}>플랜 {p.planTp}</option>
                          ))}
                        </select>
                      </div>
                      {sigMapDataList.filter(p => String(p.planTp) === selectedSigMapPlan).map((planData, pIdx) => (
                        <div key={pIdx} style={{marginBottom: '20px'}}>
                          <h4 style={{color: '#38bdf8', marginBottom: '5px', fontSize: '13px', textAlign: 'left'}}>플랜 {planData.planTp} 시그널맵 (A-RING & B-RING 병렬 표출)</h4>
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
                    <h4 style={{color: '#38bdf8', marginBottom: '8px', fontSize: '14px', fontWeight: 'bold'}}>💡 시그널맵 보행신호 유추 로직</h4>
                    <ol style={{paddingLeft: '20px', margin: 0}}>
                      <li style={{marginBottom: '4px'}}>기반정보의 차량신호와 시그널맵의 LSU 정보를 매치하여 방향을 특정합니다.</li>
                      <li style={{marginBottom: '4px'}}>매치된 방향의 LSU에 보행신호가 있다면, 해당 보행신호가 점등되는 현시에 보행정보를 <b>기반정보 탭</b>에 표시합니다. (비고: "시그널맵 유추")</li>
                      <li style={{marginBottom: '4px'}}>보행신호 시간은 시그널맵 상의 보행녹색(01)과 보행점멸(05) 유지 시간의 합계로 계산합니다.</li>
                    </ol>
                    <p style={{marginTop: '8px', marginBottom: 0, color: '#94a3b8', fontSize: '12px'}}>
                      ※ 참고: 기본적으로 LSU는 1번부터 북행(NB), 동행(EB), 남행(SB), 서행(WB), 북동, 동남, 남서, 서북 순으로 배치되나, 현장 상황에 따라 달라질 수 있으므로 기반정보를 최우선 기준으로 참고합니다.
                    </p>
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
