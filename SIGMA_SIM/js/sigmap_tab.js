// sigmap_tab.js
// ─────────────────────────────────────────────
// 시뮬레이터 내 시그널맵 (Signal Map) 표출 및 외부 데이터(UTIC, Excel) 복사 기능

function reconstructStepsFromSignalMap(sm, isRingB = false) {
    const steps = [];
    const mov = isRingB ? (sm.movB || []) : (sm.movA || []);
    const pMov = isRingB ? (sm.pedMovB || []) : (sm.pedMovA || []);
    const yellow = isRingB ? (sm.yellowB || []) : (sm.yellowA || []);
    const pedGreen = isRingB ? (sm.pedGreenB || []) : (sm.pedGreenA || []);
    const pedFlash = isRingB ? (sm.pedFlashB || []) : (sm.pedFlashA || []);
    const refMovs = isRingB ? [5, 6, 7, 8, 0, 0, 0, 0] : [1, 2, 3, 4, 0, 0, 0, 0];

    if (!mov.some(m => m > 0)) return [];

    let currentStepNo = 1;

    for (let pIdx = 0; pIdx < 8; pIdx++) {
        if (!mov[pIdx] || mov[pIdx] === 0) continue;
        
        const vId = mov[pIdx];
        const pId = pMov[pIdx] || 0;
        
        const vCol = (vId >= 1 && vId <= 8) ? vId : refMovs[pIdx];
        const pCol = (pId > 100) ? (pId - 100) : 0;
        
        const hasPed = (pCol >= 1 && pCol <= 8);
        const gTime = pedGreen[pIdx] || 0;
        const fTime = pedFlash[pIdx] || 0;
        const yTime = yellow[pIdx] || 3;
        
        const createStep = () => {
            const s = { stepNo: currentStepNo++, minTm: 0, maxTm: 0, eop: 0 };
            for(let i=1; i<=8; i++) { s[`car${i}`] = 0; s[`ped${i}`] = 0; }
            return s;
        };

        // Step 1: Green
        let s1 = createStep();
        if (vCol >= 1 && vCol <= 8) s1[`car${vCol}`] = 16;
        if (hasPed && gTime > 0) s1[`ped${pCol}`] = 1; // 1 converts to '01'
        steps.push(s1);

        // Step 2: Ped Flash
        if (hasPed && fTime > 0) {
            let s2 = createStep();
            s2.minTm = fTime;
            if (vCol >= 1 && vCol <= 8) s2[`car${vCol}`] = 16;
            s2[`ped${pCol}`] = 5;
            steps.push(s2);
        }

        // Step 3: Yellow (EOP)
        let s3 = createStep();
        s3.minTm = yTime;
        s3.eop = 1;
        if (vCol >= 1 && vCol <= 8) s3[`car${vCol}`] = 32;
        if (hasPed) s3[`ped${pCol}`] = 0;
        steps.push(s3);
    }

    while(steps.length < 32) {
        const s = { stepNo: currentStepNo++, minTm: 0, maxTm: 0, eop: 0 };
        for(let i=1; i<=8; i++) { s[`car${i}`] = 0; s[`ped${i}`] = 0; }
        steps.push(s);
    }

    return steps;
}

function renderSignalMapTab() {
    const jid = STATE.activeJid;
    const container = document.getElementById('sigmap-table-container');
    if (!container) return;

    if (!jid || !STATE.junctions[jid]) {
        container.innerHTML = `<div style="padding:30px; text-align:center; color:#f59e0b;">편집할 교차로를 지도나 사이드바에서 선택하세요.</div>`;
        return;
    }

    const j = STATE.junctions[jid];
    const mIdx = parseInt(document.getElementById('sigmap-index-select').value) || 0;

    if (!j.signalMaps) {
        // Initialize signalMaps if not present
        const refP = (j.dayPlans && j.dayPlans[0]) ? j.dayPlans[0][0] : DEFAULT_PLAN_CACHE.dayPlans[0][0];
        j.signalMaps = Array.from({ length: 6 }, () => ({
            movA: [0, 0, 0, 0, 0, 0, 0, 0],
            movB: [0, 0, 0, 0, 0, 0, 0, 0],
            pedMovA: [0, 0, 0, 0, 0, 0, 0, 0],
            pedMovB: [0, 0, 0, 0, 0, 0, 0, 0],
            yellowA: [...(refP.yellowA || [3, 3, 3, 3, 0, 0, 0, 0])],
            yellowB: [...(refP.yellowB || [3, 3, 3, 3, 0, 0, 0, 0])],
            allredA: [...(refP.allredA || [2, 2, 2, 2, 0, 0, 0, 0])],
            allredB: [...(refP.allredB || [2, 2, 2, 2, 0, 0, 0, 0])],
            pedA: [...(refP.pedA || [0, 15, 0, 15, 0, 0, 0, 0])],
            pedB: [...(refP.pedB || [0, 15, 0, 15, 0, 0, 0, 0])],
            pedDelayA: [...(refP.pedDelayA || [0, 2, 0, 2, 0, 0, 0, 0])],
            pedDelayB: [...(refP.pedDelayB || [0, 2, 0, 2, 0, 0, 0, 0])],
            mainMovements: ['A0', 'B0']
        }));
        j.signalMaps[0].movA = [...(j.movA || [0, 0, 0, 0, 0, 0, 0, 0])];
        j.signalMaps[0].movB = [...(j.movB || [0, 0, 0, 0, 0, 0, 0, 0])];
        j.signalMaps[0].pedMovA = [...(j.pedMovA || [0, 0, 0, 0, 0, 0, 0, 0])];
        j.signalMaps[0].pedMovB = [...(j.pedMovB || [0, 0, 0, 0, 0, 0, 0, 0])];
    }

    const sm = j.signalMaps[mIdx];
    let ringA = sm.stepsA || [];
    let ringB = sm.stepsB || [];
    
    // DB에서 불러온 상태 등 원본 steps 배열이 없는 경우, 동적으로 복원
    if (ringA.length === 0 && ringB.length === 0) {
        ringA = reconstructStepsFromSignalMap(sm, false);
        ringB = reconstructStepsFromSignalMap(sm, true);
        sm.stepsA = ringA;
        sm.stepsB = ringB;
    }

    if (ringA.length === 0 && ringB.length === 0) {
        container.innerHTML = `<div style="padding:30px; text-align:center; color:#f59e0b;">현재 이 시차맵에 등록된 시그널맵 데이터가 없습니다. 상단의 버튼들을 이용해 로드해주세요.</div>`;
        return;
    }

    const formatDisplayVal = (v) => {
        if (v === 0 || v === '0' || !v) return '00';
        if (v === 16 || v === '16' || v === 22 || v === '22') return '10';
        if (v === 32 || v === '32' || v === 50 || v === '50') return '20';
        return String(v).padStart(2, '0');
    };

    const getCellClass = (val, type) => {
        const v = parseInt(val, 10);
        if (isNaN(v) || v === 0) return 'cell-gray';
        
        let checkVal = v;
        if (v === 16 || v === 22) checkVal = 10;
        if (v === 32 || v === 50) checkVal = 20;

        if (type === 'car') {
            if (checkVal === 1 || checkVal === 10 || checkVal === 11 || checkVal === 4) return 'cell-green';
            if (checkVal === 2 || checkVal === 20) return 'cell-yellow';
            if (checkVal === 8) return 'cell-red';
        } else {
            if (checkVal === 1 || checkVal === 10 || checkVal === 11 || checkVal === 4) return 'cell-green';
            if (checkVal === 2 || checkVal === 8 || checkVal === 20) return 'cell-red';
            if (checkVal === 5) return 'cell-flash';
        }
        
        return 'cell-gray';
    };

    let html = `
      <h4 style="color: #60a5fa; font-size: 14px; margin-bottom: 10px; font-weight: bold;">플랜 ${mIdx} 시그널맵 (A-RING & B-RING 병렬 표출)</h4>
      <table class="sigmap-ring-table">
        <thead>
          <tr>
            <th rowspan="3" style="width: 40px; background: rgba(255, 255, 255, 0.1);">Step</th>
            <th colspan="19" style="color: #10b981; background: rgba(255, 255, 255, 0.05);">A-RING</th>
            <th colspan="19" style="color: #38bdf8; background: rgba(255, 255, 255, 0.05);">B-RING</th>
          </tr>
          <tr>
            ${[1,2,3,4,5,6,7,8].map(i => `<th colspan="2" style="background: rgba(255, 255, 255, 0.07);">${i}</th>`).join('')}
            <th rowspan="2" style="background: rgba(255, 255, 255, 0.1);">Min</th>
            <th rowspan="2" style="background: rgba(255, 255, 255, 0.1);">Max</th>
            <th rowspan="2" style="background: rgba(255, 255, 255, 0.1);">EOP</th>
            ${[1,2,3,4,5,6,7,8].map(i => `<th colspan="2" style="background: rgba(255, 255, 255, 0.07);">${i}</th>`).join('')}
            <th rowspan="2" style="background: rgba(255, 255, 255, 0.1);">Min</th>
            <th rowspan="2" style="background: rgba(255, 255, 255, 0.1);">Max</th>
            <th rowspan="2" style="background: rgba(255, 255, 255, 0.1);">EOP</th>
          </tr>
          <tr>
            ${[1,2,3,4,5,6,7,8].map(i => `<th style="background: rgba(255, 255, 255, 0.08);">V</th><th style="background: rgba(255, 255, 255, 0.08);">P</th>`).join('')}
            ${[1,2,3,4,5,6,7,8].map(i => `<th style="background: rgba(255, 255, 255, 0.08);">V</th><th style="background: rgba(255, 255, 255, 0.08);">P</th>`).join('')}
          </tr>
        </thead>
        <tbody>
    `;

    for (let n = 1; n <= 32; n++) {
        const stepA = ringA.find(s => s.stepNo === n) || {};
        const stepB = ringB.find(s => s.stepNo === n) || {};
        const isEopRow = stepA.eop === 1 || stepB.eop === 1;

        html += `<tr class="${isEopRow ? 'eop-row' : ''}" style="${isEopRow ? 'border-bottom: 2px solid var(--accent); background: rgba(245, 158, 11, 0.05);' : ''}">
            <td style="font-weight: bold; background: rgba(0,0,0,0.3);">${n}</td>
        `;

        // A-Ring V/P cells
        for (let i = 1; i <= 8; i++) {
            const carVal = stepA[`car${i}`];
            const pedVal = stepA[`ped${i}`];
            html += `
                <td class="${carVal !== undefined ? getCellClass(carVal, 'car') : 'cell-gray'}">${carVal !== undefined ? formatDisplayVal(carVal) : '-'}</td>
                <td class="${pedVal !== undefined ? getCellClass(pedVal, 'ped') : 'cell-gray'}">${pedVal !== undefined ? formatDisplayVal(pedVal) : '-'}</td>
            `;
        }
        html += `
            <td style="background: rgba(0,0,0,0.3); font-weight: bold; color: #fff;">${stepA.minTm !== undefined ? stepA.minTm : '-'}</td>
            <td style="background: rgba(0,0,0,0.3); color: #ccc;">${stepA.maxTm !== undefined ? stepA.maxTm : '-'}</td>
            <td class="${stepA.eop === 1 ? 'cell-yellow' : ''}">${stepA.eop === 1 ? 'Y' : ''}</td>
        `;

        // B-Ring V/P cells
        for (let i = 1; i <= 8; i++) {
            const carVal = stepB[`car${i}`];
            const pedVal = stepB[`ped${i}`];
            html += `
                <td class="${carVal !== undefined ? getCellClass(carVal, 'car') : 'cell-gray'}">${carVal !== undefined ? formatDisplayVal(carVal) : '-'}</td>
                <td class="${pedVal !== undefined ? getCellClass(pedVal, 'ped') : 'cell-gray'}">${pedVal !== undefined ? formatDisplayVal(pedVal) : '-'}</td>
            `;
        }
        html += `
            <td style="background: rgba(0,0,0,0.3); font-weight: bold; color: #fff;">${stepB.minTm !== undefined ? stepB.minTm : '-'}</td>
            <td style="background: rgba(0,0,0,0.3); color: #ccc;">${stepB.maxTm !== undefined ? stepB.maxTm : '-'}</td>
            <td class="${stepB.eop === 1 ? 'cell-yellow' : ''}">${stepB.eop === 1 ? 'Y' : ''}</td>
        </tr>`;
    }

    html += `</tbody></table>`;
    container.innerHTML = html;
}

async function fetchAndCopyUTICSignalMap() {
    const jid = STATE.activeJid;
    if (!jid || !STATE.junctions[jid]) return;

    const j = STATE.junctions[jid];
    let regionCode = "L02";
    if (jid.startsWith("L")) {
        regionCode = jid.split("-")[0];
    }
    
    const intName = j.name;
    if (!intName) {
        alert("교차로 명칭이 없습니다. 명칭을 먼저 입력해주세요.");
        return;
    }

    const loader = document.getElementById('sigmap-loading-indicator');
    if (loader) loader.style.display = 'block';

    try {
        const sigMapUrl = `http://tsihub.utic.go.kr/tsi/api/SigMapCrossRoadInfoService/getSigMapCRInfo?type=xml&srchCTId=${regionCode}&srchCRNm=${encodeURIComponent(intName)}&pageNo=1&numOfRows=100`;
        const response = await fetch(`/api/proxy/utic?url=${encodeURIComponent(sigMapUrl)}`);
        if (!response.ok) throw new Error("API request failed");
        
        const xmlText = await response.text();
        console.log("[UTIC API Response]", xmlText);

        let rawXml = xmlText;
        try {
            // 프록시 서버가 XML을 JSON 문자열로 감싸서 반환했을 경우 처리
            const parsed = JSON.parse(xmlText);
            if (typeof parsed === "string") {
                rawXml = parsed;
            } else if (parsed.data && typeof parsed.data === "string") {
                rawXml = parsed.data;
            }
        } catch (e) {
            // 그냥 XML 문자열인 경우 그대로 사용
        }

        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(rawXml, "text/xml");

        // 에러 코드 체크
        const resultMsg = xmlDoc.getElementsByTagName("resultMsg")[0]?.textContent;
        if (resultMsg && resultMsg !== "NORMAL_SERVICE") {
            alert("UTIC API 오류 발생: " + resultMsg);
            return;
        }

        let items = xmlDoc.getElementsByTagName("SigMapCRInfo");
        if (items.length === 0) items = xmlDoc.getElementsByTagName("item");

        if (items.length === 0) {
            alert(`UTIC에서 '${intName}' 교차로에 대한 검색 결과가 0건입니다. (이름이 다르거나 데이터가 없을 수 있습니다.)`);
            return;
        }

        const plansData = {};
        const targetIntNo = j.apiIntNo || jid;

        const processItem = (item) => {
            // UTIC 응답에서 맵 번호 추출 (PLAN_TP 가 시차제 계획번호인 경우가 많음)
            const planTpNode = item.getElementsByTagName("PLAN_TP")[0];
            const planNoNode = item.getElementsByTagName("PLAN_NO")[0];
            
            // PLAN_NO를 우선적으로 사용하고 (일반적인 시그널맵 번호), 없을 경우 PLAN_TP 사용
            const planNoText = (planNoNode && planNoNode.textContent && planNoNode.textContent !== "0") ? planNoNode.textContent : (planTpNode?.textContent || "1");
            const planNo = parseInt(planNoText, 10);
            if (!plansData[planNo]) plansData[planNo] = { ringA: [], ringB: [] };

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
            if (ringNo === 0) plansData[planNo].ringA.push(step);
            else if (ringNo === 1) plansData[planNo].ringB.push(step);
        };

        let foundMatch = false;
        const targetStr = String(targetIntNo || "").trim();
        const cleanTarget = targetStr.replace(/[^0-9]/g, '');

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const intNoStr = String(item.getElementsByTagName("INT_NO")[0]?.textContent || "").trim();
            const cleanIntNo = intNoStr.replace(/[^0-9]/g, '');
            
            // 완전 일치하거나, 숫자 부분만 같거나, 뒤에 번호가 똑같이 끝나는 경우 매칭
            if (intNoStr === targetStr || (cleanIntNo && cleanIntNo === cleanTarget) || intNoStr.endsWith(targetStr)) {
                processItem(item);
                foundMatch = true;
            }
        }

        // Fallback to first INT_NO from results
        if (!foundMatch && items.length > 0) {
            const firstIntNo = items[0].getElementsByTagName("INT_NO")[0]?.textContent;
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                const intNo = item.getElementsByTagName("INT_NO")[0]?.textContent;
                if (String(intNo) === String(firstIntNo)) {
                    processItem(item);
                }
            }
        }

        let planKeys = Object.keys(plansData).map(Number).sort((a, b) => a - b);
        if (planKeys.length === 0) {
            alert("해당 교차로 이름으로 조회된 UTIC 시그널맵 데이터가 없습니다.");
            return;
        }

        // UTIC 데이터의 계획 번호가 0부터 시작할 경우, 시그마 맵번호(1~6)에 맞추기 위해 1을 더해줍니다.
        const offset = planKeys[0] === 0 ? 1 : 0;

        let appliedPlans = [];
        planKeys.forEach(pNo => {
            const pData = plansData[pNo];
            pData.ringA.sort((a, b) => a.stepNo - b.stepNo);
            pData.ringB.sort((a, b) => a.stepNo - b.stepNo);

            // 맵번호(1~6)에 매칭하여 signalMaps[0~5]에 저장. 
            let mIdx = (pNo + offset) - 1;
            if (mIdx >= 0 && mIdx < 6) {
                const sm = j.signalMaps[mIdx];
                sm.stepsA = pData.ringA;
                sm.stepsB = pData.ringB;
                parseStepsToSignalMap(sm, pData.ringA, pData.ringB);
                appliedPlans.push(pNo + offset); // 저장된 시그마 맵번호 기준
            }
        });

        if (appliedPlans.length > 0) {
            alert(`UTIC 시그널맵 데이터를 성공적으로 가져와 각 맵번호(${appliedPlans.join(', ')}번)에 저장하고 적용했습니다.`);
        } else {
            alert("UTIC 데이터는 가져왔으나 매칭되는 맵번호(1~6)가 없습니다. (수신된 맵번호: " + planKeys.join(', ') + ")");
        }

        renderSignalMapTab();
        if (typeof renderRingTables === 'function') renderRingTables();
    } catch (e) {
        console.error(e);
        alert("UTIC 데이터를 가져오는데 실패했습니다: " + e.message);
    } finally {
        if (loader) loader.style.display = 'none';
    }
}

async function loadSignalMapFromExcel(input) {
    const file = input.files[0];
    if (!file) return;

    if (typeof XLSX === 'undefined') {
        await loadScript('https://cdn.sheetjs.com/xlsx-0.20.0/package/dist/xlsx.full.min.js');
    }

    try {
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const sheetData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        const getVal = (r, c) => (sheetData[r-1] ? sheetData[r-1][c-1] : null);

        const jid = STATE.activeJid;
        if (!jid) {
            alert("먼저 교차로를 선택해주세요.");
            return;
        }
        const j = STATE.junctions[jid];

        // 1) Find the name from Excel and compare
        let excelName = "";
        for(let r = 1; r <= 10; r++) {
            for(let c = 1; c <= 40; c++) {
                const cell = String(getVal(r,c) || "").replace(/\s/g, '');
                if(cell === "교차로명" || cell === "명칭") {
                    for(let offset = 1; offset <= 5; offset++) {
                        const nextCell = String(getVal(r, c+offset) || "").trim();
                        if(nextCell && nextCell !== ":") {
                            excelName = nextCell;
                            break;
                        }
                    }
                    if(excelName) break;
                }
            }
            if(excelName) break;
        }

        if (excelName && j.name) {
            const cleanExcel = excelName.replace(/\s/g, '');
            const cleanJ = j.name.replace(/\s/g, '');
            if (cleanExcel !== cleanJ) {
                const proceed = confirm(`⚠️ 엑셀 파일의 교차로명(${excelName})과 현재 선택된 교차로명(${j.name})이 일치하지 않습니다.\n\n그래도 계속 진행하시겠습니까?`);
                if (!proceed) {
                    input.value = "";
                    return;
                }
            }
        }

        // 2) Parse all 6 maps
        if (!j.signalMaps) j.signalMaps = [];
        let loadedCount = 0;
        const baseRowMapStart = 247;

        for (let mIdx = 0; mIdx < 6; mIdx++) {
            const startRowA = baseRowMapStart + (mIdx * 67);
            const startRowB = startRowA + 32;

            const step1Min = parseInt(getVal(startRowA, 53));
            if (isNaN(step1Min) || step1Min === 0 && mIdx > 0) {
                // If there's no first step data, skip this plan
                continue;
            }

            const baseMovA = [], baseMovB = [];
            for (let c = 19; c <= 54; c += 5) {
                baseMovA.push(parseInt(getVal(5, c)) || 0);
                baseMovB.push(parseInt(getVal(12, c)) || 0);
            }

            const parseSteps = (startRow, eopSourceRow = null) => {
                const steps = [];
                for (let s = 0; s < 32; s++) {
                    const r = startRow + s;
                    const eopRow = eopSourceRow ? eopSourceRow + s : r;
                    const step = {
                        stepNo: s + 1,
                        minTm: parseInt(getVal(r, 53)) || 0,
                        maxTm: 0,
                        eop: String(getVal(eopRow, 57) || "").toUpperCase() === 'Y' ? 1 : 0
                    };
                    for (let l = 0; l < 8; l++) {
                        step[`car${l+1}`] = parseInt(String(getVal(r, 5 + l * 6) || "0").trim()) || 0;
                        step[`ped${l+1}`] = parseInt(String(getVal(r, 8 + l * 6) || "0").trim()) || 0;
                    }
                    steps.push(step);
                }
                return steps;
            };

            const ringA = parseSteps(startRowA);
            const ringB = parseSteps(startRowB, startRowA);

            if (!j.signalMaps[mIdx]) {
                j.signalMaps[mIdx] = {
                    yellowA: [3, 3, 3, 3, 0, 0, 0, 0], yellowB: [3, 3, 3, 3, 0, 0, 0, 0],
                    allredA: [2, 2, 2, 2, 0, 0, 0, 0], allredB: [2, 2, 2, 2, 0, 0, 0, 0],
                    pedA: [0, 0, 0, 0, 0, 0, 0, 0], pedB: [0, 0, 0, 0, 0, 0, 0, 0],
                    pedDelayA: [0, 0, 0, 0, 0, 0, 0, 0], pedDelayB: [0, 0, 0, 0, 0, 0, 0, 0]
                };
            }
            
            const sm = j.signalMaps[mIdx];
            sm.stepsA = ringA;
            sm.stepsB = ringB;

            parseStepsToSignalMap(sm, ringA, ringB);
            loadedCount++;
        }

        alert(`엑셀 파일에서 ${loadedCount}개의 시차맵 데이터를 성공적으로 가져와 저장했습니다.`);
        renderSignalMapTab();
        if (typeof renderRingTables === 'function') renderRingTables();

    } catch (e) {
        console.error(e);
        alert("엑셀 분석 중 오류가 발생했습니다: " + e.message);
    } finally {
        input.value = "";
    }
}

function parseStepsToSignalMap(sm, ringA, ringB) {
    const processRing = (steps, isRingB = false) => {
        const phaseData = Array.from({ length: 8 }, () => ({ vId: 0, pId: 0, g: 0, f: 0, yellow: 0, delay: 0 }));
        if (steps.length === 0) return phaseData;

        // Use standard movement configuration if current is empty
        const baseMovs = (isRingB ? sm.movB : sm.movA) || [];
        const hasValidMov = baseMovs.some(x => x > 0);
        const refMovs = hasValidMov ? [...baseMovs] : (isRingB ? [5, 6, 7, 8, 0, 0, 0, 0] : [1, 2, 3, 4, 0, 0, 0, 0]);

        let currentStep = 0;
        for (let pIdx = 0; pIdx < 8; pIdx++) {
            if (currentStep >= steps.length) break;
            const stepsInPhase = [];
            while (currentStep < steps.length) {
                const st = steps[currentStep++];
                stepsInPhase.push(st);
                if (st.eop === 1 || st.eop === true) break;
            }

            if (stepsInPhase.length > 0) {
                const eopStep = stepsInPhase[stepsInPhase.length - 1];
                if (eopStep.eop) {
                    phaseData[pIdx].yellow = eopStep.minTm;
                }
            }

            let detectedVId = 0;
            const checkCarActive = (l) => stepsInPhase.some(st => {
                const c = st[`car${l+1}`];
                return (c === 1 || c === 16 || c === 2 || c === 32 || c === 10 || c === 20); // Hex 01, 10, 02, 20
            });
            for (let l = 0; l < 8; l++) { 
                if (checkCarActive(l)) { 
                    detectedVId = l + 1; 
                    break; 
                } 
            }
            
            const currentVId = detectedVId > 0 ? detectedVId : (refMovs[pIdx] || 0);
            phaseData[pIdx].vId = currentVId;

            let pLSU = -1;
            const checkPedActive = (l) => stepsInPhase.some(st => {
                const p = st[`ped${l+1}`];
                return (p === 1 || p === 5 || p === 10 || p === 50);
            });
            for (let l = 0; l < 4; l++) { if (checkPedActive(l)) { pLSU = l; break; } }
            if (pLSU === -1) { for (let l = 4; l < 8; l++) { if (checkPedActive(l)) { pLSU = l; break; } } }

            if (pLSU !== -1) {
                let currentPhaseTime = 0;
                let foundFirstGreen = false;

                stepsInPhase.forEach(st => {
                    const pCode = st[`ped${pLSU+1}`];
                    if (pCode === 1 || pCode === 10) {
                        if (!foundFirstGreen) {
                            phaseData[pIdx].delay = currentPhaseTime;
                            foundFirstGreen = true;
                        }
                        phaseData[pIdx].g += st.minTm;
                    } else if (pCode === 5 || pCode === 50) {
                        phaseData[pIdx].f += st.minTm;
                    }
                    currentPhaseTime += st.minTm;
                });

                if (phaseData[pIdx].g > 0 || phaseData[pIdx].f > 0) {
                    phaseData[pIdx].pId = (currentVId > 0 && currentVId % 2 === 0) ? (currentVId + 100) : (pLSU + 101);
                }
            }
        }
        return phaseData;
    };

    const dataA = processRing(ringA, false);
    const dataB = processRing(ringB, true);

    sm.movA = dataA.map(d => d.vId);
    sm.movB = dataB.map(d => d.vId);
    sm.pedMovA = dataA.map(d => d.pId);
    sm.pedMovB = dataB.map(d => d.pId);
    sm.yellowA = dataA.map(d => d.yellow);
    sm.yellowB = dataB.map(d => d.yellow);
    sm.pedGreenA = dataA.map(d => d.g);
    sm.pedGreenB = dataB.map(d => d.g);
    sm.pedFlashA = dataA.map(d => d.f);
    sm.pedFlashB = dataB.map(d => d.f);
    sm.pedDelayA = dataA.map(d => d.delay || 0);
    sm.pedDelayB = dataB.map(d => d.delay || 0);
    sm.pedA = dataA.map(d => d.g + d.f);
    sm.pedB = dataB.map(d => d.g + d.f);
}

function loadScript(url) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = url;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}
