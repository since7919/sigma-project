import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';

const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? 'http://localhost:4000' : 'https://sigma-project-245n.onrender.com';

export function useRealtimeSignal({ intersection, mainPhases }) {
  const [cropData, setCropData] = useState(null);
  const [phaseA, setPhaseA] = useState(1);
  const [phaseB, setPhaseB] = useState(1);
  const [remainA, setRemainA] = useState(0);
  const [remainB, setRemainB] = useState(0);
  
  const [sigMapDataList, setSigMapDataList] = useState([]);
  const [weeklyPlans, setWeeklyPlans] = useState({});
  const [allTodPlans, setAllTodPlans] = useState({});
  const [isSigMapLoading, setIsSigMapLoading] = useState(false);

  const isSeoul = useMemo(() => {
    return intersection?.origin_type?.toLowerCase().includes('tdata') || false;
  }, [intersection]);

  const currentMainPhase = mainPhases?.[intersection?.id] || (intersection?.region_cd === 'L02' ? 2 : 1);

  // 1. CRWD (계획요일) 정보 조회
  useEffect(() => {
    if (isSeoul || !intersection) {
      setWeeklyPlans({});
      return;
    }
    const fetchWeeklyPlan = async () => {
      try {
        const regionCode = intersection.region_cd || 'L02';
        const crNm = encodeURIComponent(intersection.int_nm);
        
        const wdUrl = `http://tsihub.utic.go.kr/tsi/api/PlanCrossRoadInfoService/getPlanCRWDInfo?type=xml&srchCTId=${regionCode}&srchCRNm=${crNm}&pageNo=1&numOfRows=10`;
        const wdRes = await axios.get(`${API_BASE}/api/proxy/utic?url=${encodeURIComponent(wdUrl)}`);
        
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(wdRes.data, "text/xml");
        
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
      } catch (err) {
        console.error('Error fetching CRWD (useRealtimeSignal):', err);
      }
    };
    fetchWeeklyPlan();
  }, [intersection, isSeoul]);

  // 2. CROP TOD 계획 정보 조회
  useEffect(() => {
    if (isSeoul || !intersection || Object.keys(weeklyPlans).length === 0) return;
    const fetchCROP = async () => {
      try {
        const jsDay = new Date().getDay();
        const todayUticDy = jsDay + 1; // 일요일:1, 월요일:2...
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
          plansMap[key] = plansMap[key].filter(p => p.cycle > 0);
          plansMap[key].sort((a, b) => a.startMins - b.startMins);
        }

        // 현시계획(Split Plan) 데이터가 동일한 경우 동일한 글로벌 인덱스를 부여
        // 물리적 제어기와의 유사성을 높이기 위해 주기(Cycle) 오름차순으로 정렬 후 ID 부여
        let uniqueSplits = [];
        const isSameSplit = (p1, p2) => {
          if (p1.cycle !== p2.cycle) return false;
          for (let i = 1; i <= 8; i++) {
            if (p1[`A_RING_${i}_PHASE_VAL`] !== p2[`A_RING_${i}_PHASE_VAL`]) return false;
            if (p1[`B_RING_${i}_PHASE_VAL`] !== p2[`B_RING_${i}_PHASE_VAL`]) return false;
          }
          return true;
        };

        for (let key in plansMap) {
          for (let matched of plansMap[key]) {
             if (!uniqueSplits.find(gp => isSameSplit(gp, matched))) {
                uniqueSplits.push({ ...matched });
             }
          }
        }

        uniqueSplits.sort((a, b) => {
           if (a.cycle !== b.cycle) return a.cycle - b.cycle;
           if (a.offset !== b.offset) return a.offset - b.offset;
           return 0;
        });

        uniqueSplits.forEach((split, index) => {
           split.globalIdx = index + 1;
        });

        for (let key in plansMap) {
          for (let matched of plansMap[key]) {
             const existing = uniqueSplits.find(gp => isSameSplit(gp, matched));
             if (existing) {
                matched.planIdxNo = String(existing.globalIdx);
             }
          }
        }

        setAllTodPlans(plansMap);
        
        // 초기 1회 현재 시간에 맞는 계획 설정
        if (todayPlanNo && plansMap[todayPlanNo]) {
          const now = new Date(Date.now() + (window.SIGMA_TIME_OFFSET || 0));
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
        console.error('Error fetching CROP plan (useRealtimeSignal):', err);
      }
    };
    fetchCROP();
  }, [intersection, isSeoul, weeklyPlans]);

  // 3. SigMap 정보 조회
  useEffect(() => {
    if (isSeoul || !intersection) {
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
        console.error('Error fetching SigMap (useRealtimeSignal):', err);
        setSigMapDataList([]);
      } finally {
        setIsSigMapLoading(false);
      }
    };
    fetchSigMap();
  }, [intersection, isSeoul]);

  // 4. 실시간 타이머 및 TOD 계획 갱신 (1초마다)
  useEffect(() => {
    const updateRealtime = () => {
      const now = new Date(Date.now() + (window.SIGMA_TIME_OFFSET || 0));

      if (isSeoul) return;
      
      let activePlan = cropData;
      // 실시간 시간에 맞춰 TOD 계획 업데이트
      if (allTodPlans && Object.keys(allTodPlans).length > 0) {
        const jsDay = now.getDay();
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
            return; // 상태가 바뀌면 다음 틱에서 계산 (렌더링 사이클 보호)
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
  }, [cropData, isSeoul, allTodPlans, weeklyPlans, currentMainPhase]);

  // 현재 CROP PlanTp에 매칭되는 SigMap 반환
  const sigMapData = useMemo(() => {
    if (!sigMapDataList || sigMapDataList.length === 0) return { ringA: [], ringB: [] };
    if (!cropData || cropData.planTp === undefined) return sigMapDataList[0];
    const planTp = cropData.planTp ?? cropData.plan_tp ?? cropData.PLAN_TP;
    const active = sigMapDataList.find(p => String(p.planTp) === String(planTp));
    return active || sigMapDataList[0];
  }, [sigMapDataList, cropData]);

  return {
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
  };
}
