/* SIGMA_SIM Data Parser Functions */

function serializeFlash(j) { return `${j.flashEnable?1:0}|${(j.flashTimes||[]).map(t=>`${t.s},${t.e}`).join(';')}|${(j.flashYellows||[]).join(';')}|${(j.flashReds||[]).join(';')}`; }

function serializeOpInt(j) { const op = j.opIntervention||{enable:false,rows:[]}; return `${op.enable?1:0}|${(op.rows||[]).map(r=>`${r.s},${r.e},${r.cycle},${r.offset},${(r.splitA||[]).join(';')},${(r.splitB||[]).join(';')}`).join('::')}`; }

function serializeArrows(j) {
    const arrs = Object.entries(j.arrowConfigs || {}).flatMap(([m, configs]) =>
        configs.map(c => `${m}:${c.dLat}:${c.dLng}:${c.rot}`)
    );
    if (j.customAngles) {
        Object.entries(j.customAngles).forEach(([pfx, angle]) => {
            arrs.push(`_custom_angles:${pfx}:${angle}`);
        });
    }
    return arrs.join(';');
}

function processIntersectionCSV(csv) {
    const lines = csv.trim().split(/\r?\n/); if (lines.length < 2) return;
    const firstLine = lines[0].replace(/^\ufeff/, '').trim();
    const delimiter = firstLine.includes(';') ? ';' : ',';
    const headers = firstLine.split(delimiter).map(h => h.trim().replace(/^"|"$/g, ''));
    const getCol = (cols, names) => {
        const normalize = (s) => String(s||"").replace(/\s+/g,'').toLowerCase();
        for (const name of names) {
            const idx = headers.findIndex(h => normalize(h) === normalize(name));
            if (idx !== -1) return cols[idx];
        }
        return null;
    };
    const newJuncts = {};
    for (let i = 1; i < lines.length; i++) {
        const cols = [], line = lines[i]; let start = 0, inQ = false;
        for (let c = 0; c < line.length; c++) {
            if (line[c] === '"') inQ = !inQ;
            else if (line[c] === delimiter && !inQ) { cols.push(line.substring(start, c).replace(/^"|"$/g,'').trim()); start = c + 1; }
        }
        cols.push(line.substring(start).replace(/^"|"$/g,'').trim());
        let id = getCol(cols, ["ID", "교차로번호", "No", "JID"]); if (!id) continue;
        const region = getCol(cols, ["Region", "지역"]) || (id.startsWith("L02-") ? "L02" : "L01");
        const apiIntNoRaw = getCol(cols, ["API_Int_No", "api_int_no", "apiIntNo"]);
        const apiIntNo = apiIntNoRaw ? parseInt(apiIntNoRaw, 10) : null;
        newJuncts[id] = {
            id, region, name: getCol(cols, ["Name", "이름", "교차로명"]) || "Node",
            lat: parseFloat(getCol(cols, ["Lat", "위도"])) || 37.5, lng: parseFloat(getCol(cols, ["Lng", "경도"])) || 127.0,
            seq: getCol(cols, ["Seq", "연등번호"]), police: getCol(cols, ["Police", "경찰서"]) || "", office: getCol(cols, ["Office", "관리청"]) || "",
            group: parseInt(getCol(cols, ["GroupID", "그룹ID"])) || 0, weeklyPlan: getCol(cols, ["Weekly_plan"]) || "1;1;1;1;1;2;3",
            apiIntNo: isNaN(apiIntNo) ? null : apiIntNo,
            signalMaps: Array.from({ length: 6 }, () => createEmptySignalMap()), dayPlans: Array.from({ length: 10 }, () => createEmptyPlans()),
            schedules: Array.from({ length: 10 }, () => createEmptySched()), dayPlanMapIds: new Array(10).fill(0), extra: {}
        };
        headers.forEach((h, idx) => { if (cols[idx] !== undefined) newJuncts[id].extra[h] = cols[idx]; });
        const dOrder = getCol(cols, ["DiagramOrder", "Order"]);
        if (dOrder !== null) newJuncts[id].extra.diagramOrder = parseInt(dOrder);
        parseExtraConfigs(newJuncts[id], newJuncts[id].extra);
    }
    Object.values(STATE.junctions).forEach(j => { if (j.marker && window.map) window.map.removeLayer(j.marker); });
    STATE.junctions = newJuncts;
    if (typeof STATE !== 'undefined') STATE.sortedJunctions = null;
    Object.keys(STATE.junctions).forEach(jid => { if (typeof drawJunction === 'function') drawJunction(jid); });
    refreshDBStats();
}

function processSignalMapCSV(csv) {
    const lines = csv.trim().split(/\r?\n/); if (lines.length < 2) return;
    const headers = lines[0].replace(/^\ufeff/, '').split(',').map(h => h.replace(/^"|"$/g, '').trim());
    
    const idIdx = headers.findIndex(h => h === "ID" || h === "id");
    const mapIdxIdx = headers.findIndex(h => h === "MapIdx");
    
    const fields = ["movA","movB","pedMovA","pedMovB","yellowA","yellowB","allredA","allredB","pedA","pedB","pedDelayA","pedDelayB","pedFlashA","pedFlashB","pedGreenA","pedGreenB"];
    const fieldIndices = fields.map(f => headers.findIndex(h => h === f));
    const mainMovIdx = headers.findIndex(h => h === "mainMovements");
    const startIdx = headers.findIndex(h => h === "startTime");
    const endIdx = headers.findIndex(h => h === "endTime");

    const rawStepsIdx = headers.findIndex(h => h === "rawSteps");

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        const cols = [];
        let start = 0, inQ = false;
        const parseVal = (str) => {
            let v = str.trim();
            if (v.startsWith('"') && v.endsWith('"')) {
                return v.substring(1, v.length - 1).replace(/""/g, '"');
            }
            return v;
        };
        for (let c = 0; c < line.length; c++) {
            if (line[c] === '"') inQ = !inQ;
            else if (line[c] === ',' && !inQ) { cols.push(parseVal(line.substring(start, c))); start = c + 1; }
        }
        cols.push(parseVal(line.substring(start)));

        let jid = cols[idIdx]; if (!jid || !STATE.junctions[jid]) continue;
        const midx = parseInt(cols[mapIdxIdx]); if (isNaN(midx) || midx >= 10) continue;
        
        const sm = STATE.junctions[jid].signalMaps[midx];
        
        for (let f = 0; f < fields.length; f++) {
            const cIdx = fieldIndices[f];
            if (cIdx !== -1 && cols[cIdx] !== undefined) {
                sm[fields[f]] = String(cols[cIdx]).split(';').map(Number);
            }
        }
        
        if (mainMovIdx !== -1 && cols[mainMovIdx]) sm.mainMovements = String(cols[mainMovIdx]).split(';');
        if (startIdx !== -1) sm.startTime = cols[startIdx] || ""; 
        if (endIdx !== -1) sm.endTime = cols[endIdx] || "";
        if (rawStepsIdx !== -1 && cols[rawStepsIdx]) {
            try {
                const rs = JSON.parse(cols[rawStepsIdx]);
                if (rs && rs.stepsA) sm.stepsA = rs.stepsA;
                if (rs && rs.stepsB) sm.stepsB = rs.stepsB;
            } catch(e) {
                console.error("Failed to parse rawSteps for", jid, midx, e);
            }
        }
    }
}

function processTodPlanCSV(csv) {
    const lines = csv.trim().split(/\r?\n/); if (lines.length < 2) return;
    const headers = lines[0].replace(/^\ufeff/, '').split(',').map(h => h.replace(/^"|"$/g, '').trim());
    
    const idIdx = headers.findIndex(h => h === "ID" || h === "id");
    const dayPlanIdx = headers.findIndex(h => h === "Day_plan");
    const sigMapIdx = headers.findIndex(h => h === "SignalMap");
    
    const tpIndices = [];
    for (let i = 1; i <= 16; i++) {
        tpIndices.push(headers.findIndex(h => h === `Time_plan${i}`));
    }

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        const cols = [];
        let start = 0, inQ = false;
        for (let c = 0; c < line.length; c++) {
            if (line[c] === '"') inQ = !inQ;
            else if (line[c] === ',' && !inQ) { cols.push(line.substring(start, c).replace(/^"|"$/g,'').trim()); start = c + 1; }
        }
        cols.push(line.substring(start).replace(/^"|"$/g,'').trim());

        let jid = cols[idIdx]; if (!jid || !STATE.junctions[jid]) continue;
        const d_plan = parseInt(cols[dayPlanIdx]); if (isNaN(d_plan) || d_plan < 1 || d_plan > 10) continue;
        const dIdx = d_plan - 1;
        
        STATE.junctions[jid].dayPlanMapIds[dIdx] = parseInt(cols[sigMapIdx]) || 0;
        
        for (let sIdx = 0; sIdx < 16; sIdx++) {
            const slotIdx = tpIndices[sIdx];
            if (slotIdx === -1) continue;
            const slot = cols[slotIdx]; if (!slot) continue;
            
            const p = slot.split('|');
            if (p[0] === "-1") STATE.junctions[jid].schedules[dIdx][sIdx].h = -1;
            else if (p[0].includes(':')) { 
                const hm = p[0].split(':'); 
                STATE.junctions[jid].schedules[dIdx][sIdx].h = parseInt(hm[0]) || 0; 
                STATE.junctions[jid].schedules[dIdx][sIdx].m = parseInt(hm[1]) || 0; 
            }
            if (p[1]) STATE.junctions[jid].schedules[dIdx][sIdx].cycle = parseInt(p[1]);
            if (p[2]) STATE.junctions[jid].dayPlans[dIdx][sIdx].offset = parseInt(p[2]);
            if (p[3]) STATE.junctions[jid].dayPlans[dIdx][sIdx].splitA = p[3].split(';').map(Number);
            if (p[4]) STATE.junctions[jid].dayPlans[dIdx][sIdx].splitB = p[4].split(';').map(Number);
            if (p[5]) STATE.junctions[jid].schedules[dIdx][sIdx].idx = parseInt(p[5]);
            else STATE.junctions[jid].schedules[dIdx][sIdx].idx = (parseInt(cols[sigMapIdx]) || 0) + 1;
        }
    }
}

function parseCSV(csv) {
    const lines = csv.trim().split(/\r?\n/); 
    if (lines.length < 2) return [];

    const parseLine = (line) => {
        const result = [];
        let start = 0;
        let inQ = false;
        for (let i = 0; i < line.length; i++) {
            if (line[i] === '"') {
                inQ = !inQ;
            } else if (line[i] === ',' && !inQ) {
                let val = line.substring(start, i).trim();
                if (val.length >= 2 && val[0] === '"' && val[val.length - 1] === '"') {
                    val = val.substring(1, val.length - 1).replace(/""/g, '"');
                }
                result.push(val);
                start = i + 1;
            }
        }
        let val = line.substring(start).trim();
        if (val.length >= 2 && val[0] === '"' && val[val.length - 1] === '"') {
            val = val.substring(1, val.length - 1).replace(/""/g, '"');
        }
        result.push(val);
        return result;
    };

    const headers = parseLine(lines[0].replace(/^\ufeff/, ''));
    const res = [];
    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const cols = parseLine(lines[i]);
        const row = {};
        headers.forEach((h, idx) => { if (cols[idx] !== undefined) row[h] = cols[idx]; });
        res.push(row);
    }
    return res;
}

async function handleExcelSignalLoad(input, isSingle = false) {
    const files = Array.from(input.files).slice(0, 50);
    if (files.length === 0) return;

    if (isSingle && files.length > 1) {
        alert("하나의 파일만 선택해 주세요.");
        return;
    }

    const infoEl = document.getElementById('xlsx-info-text');
    const progEl = document.getElementById('xlsx-progress-bar');
    const percEl = document.getElementById('xlsx-percent-text');
    const contEl = document.getElementById('xlsx-progress-container');
    const listEl = document.getElementById('xlsx-loaded-list');

    const infoElPh = document.getElementById('xlsx-info-text-phase');
    const progElPh = document.getElementById('xlsx-progress-bar-phase');
    const percElPh = document.getElementById('xlsx-percent-text-phase');
    const contElPh = document.getElementById('xlsx-progress-container-phase');
    const listElPh = document.getElementById('xlsx-loaded-list-phase');

    if (contEl) contEl.style.display = 'block';
    if (contElPh) contElPh.style.display = 'block';

    if (listEl) {
        listEl.style.display = 'block';
        listEl.innerHTML = '<div style="margin-bottom:5px; font-weight:bold; color:#2ecc71;">로드 목록 (최대 50개):</div>';
    }
    if (listElPh) {
        listElPh.style.display = 'block';
        listElPh.innerHTML = '<div style="margin-bottom:5px; font-weight:bold; color:#2ecc71;">로드 목록 (최대 50개):</div>';
    }

    const updateProgress = (pct, msg) => {
        if (progEl) progEl.style.width = pct + '%';
        if (percEl) percEl.textContent = pct + '%';
        if (infoEl) infoEl.textContent = msg;

        if (progElPh) progElPh.style.width = pct + '%';
        if (percElPh) percElPh.textContent = pct + '%';
        if (infoElPh) infoElPh.textContent = msg;
    };

    const addToList = (filename, status, errorMsg = "") => {
        const color = (status === 'success') ? '#2ecc71' : '#e74c3c';
        const icon = (status === 'success') ? '✅' : '❌';
        const html = `<span style="color:${color}">${icon}</span> ${filename}${errorMsg ? `<span style="color:#e74c3c; font-size:10px;"> (${errorMsg})</span>` : ''}`;

        if (listEl) {
            const div = document.createElement('div');
            div.style.marginBottom = '2px';
            div.innerHTML = html;
            listEl.appendChild(div);
            listEl.scrollTop = listEl.scrollHeight;
        }
        if (listElPh) {
            const divPh = document.createElement('div');
            divPh.style.marginBottom = '2px';
            divPh.innerHTML = html;
            listElPh.appendChild(divPh);
            listElPh.scrollTop = listElPh.scrollHeight;
        }
    };

    if (typeof XLSX === 'undefined') {
        updateProgress(0, "라이브러리 로드 중...");
        await loadScript('https://cdn.sheetjs.com/xlsx-0.20.0/package/dist/xlsx.full.min.js');
    }

    let successCount = 0;
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const stepPctBase = (i / files.length) * 100;
        const stepSize = 100 / files.length;

        try {
            updateProgress(Math.round(stepPctBase + (stepSize * 0.1)), `[${i+1}/${files.length}] ${file.name} 분석 중...`);
            const arrayBuffer = await file.arrayBuffer();
            const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const sheetData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
            const getVal = (r, c) => (sheetData[r-1] ? sheetData[r-1][c-1] : null);

            const jNo = parseInt(getVal(3, 37));
            if (isNaN(jNo)) throw new Error(`[C37] 교차로 번호 누락`);
            
            const expectedSeq = jNo * 10;
            let junction = null;
            
            if (isSingle) {
                if (!STATE.activeJid || !STATE.junctions[STATE.activeJid]) {
                    throw new Error("먼저 교차로를 선택해주세요.");
                }
                const activeSeq = parseInt(STATE.junctions[STATE.activeJid].seq);
                if (!isNaN(activeSeq) && activeSeq !== expectedSeq) {
                    if (!confirm(`현재 선택된 교차로(No. ${activeSeq})와 업로드하신 엑셀 파일의 교차로(No. ${expectedSeq})가 일치하지 않습니다.\n선택된 교차로(No. ${activeSeq})에 이 데이터를 업데이트하시겠습니까?`)) {
                        throw new Error(`사용자 취소 (교차로번호 불일치)`);
                    }
                }
                junction = STATE.junctions[STATE.activeJid];
            } else {
                // L01 또는 L02 접두사를 포함해 매칭
                junction = STATE.junctions[`L01-${expectedSeq}`] || STATE.junctions[`L02-${expectedSeq}`] || Object.values(STATE.junctions).find(j => String(j.seq) === String(expectedSeq));
                if (!junction) throw new Error(`시스템에 교차로(No. ${expectedSeq})가 없습니다.`);
            }

            // [1] 이동류(Movement) ID 추출 (Row 5 & 12)
            const baseMovA = [], baseMovB = [];
            for (let c = 19; c <= 54; c += 5) {
                baseMovA.push(parseInt(getVal(5, c)) || 0);
                baseMovB.push(parseInt(getVal(12, c)) || 0);
            }

            // [2] 시그널맵 분석 엔진 (사용자 규칙 기반)
            const baseRowMapStart = 247;
            const processRingData = (startRow, baseMovs, eopSourceRow = null) => {
                const phaseData = Array.from({ length: 8 }, () => ({ vId: 0, pId: 0, g: 0, f: 0, yellow: 0 }));
                const rawSteps = [];
                
                // 동적 컬럼 탐지 (Auto-detection)
                // startRow-2 (행 인덱스 기준 startRow-3)는 "MIN", "EOP", "LSU 1" 등이 있는 헤더 줄
                // startRow-1 (행 인덱스 기준 startRow-2)는 "V", "P" 가 있는 서브헤더 줄
                let minCol = 53, maxCol = 55, eopCol = 57; // 기본값 (기존 넓은 양식)
                let lsuCols = Array(8).fill(null).map((_, i) => ({ v: 5 + i * 6, p: 8 + i * 6 }));

                // 엑셀 시트 데이터는 0-indexed 배열이며, getVal은 1-indexed 파라미터를 받음
                const headerRow1 = sheetData[startRow - 3] || [];
                const headerRow2 = sheetData[startRow - 2] || [];

                // 문자열을 찾아 1-indexed 컬럼 반환
                const findCol = (row, text) => {
                    for (let c = 0; c < row.length; c++) {
                        if (String(row[c]).toUpperCase().replace(/\s/g, '').includes(text)) return c + 1;
                    }
                    return -1;
                };

                const detectedMin = findCol(headerRow1, "MIN");
                if (detectedMin !== -1) minCol = detectedMin;

                const detectedMax = findCol(headerRow1, "MAX");
                if (detectedMax !== -1) maxCol = detectedMax;

                const detectedEop = findCol(headerRow1, "EOP");
                if (detectedEop !== -1) eopCol = detectedEop;

                for (let lsu = 1; lsu <= 8; lsu++) {
                    const lsuStartCol = findCol(headerRow1, `LSU${lsu}`) - 1; // 0-indexed로 변환
                    if (lsuStartCol !== -1) {
                        // LSU 주변 열(최대 5칸 이내)에서 V와 P 서브헤더 탐색
                        let vFound = -1, pFound = -1;
                        for (let c = lsuStartCol; c < lsuStartCol + 5 && c < headerRow2.length; c++) {
                            const h2 = String(headerRow2[c] || "").toUpperCase().trim();
                            if (h2 === "V") vFound = c + 1;
                            if (h2 === "P") pFound = c + 1;
                        }
                        if (vFound !== -1) lsuCols[lsu - 1].v = vFound;
                        if (pFound !== -1) lsuCols[lsu - 1].p = pFound;
                    }
                }

                // 1. 전체 32스텝 로드
                const allSteps = [];
                for (let s = 0; s < 32; s++) {
                    const r = startRow + s;
                    // B링은 EOP('Y') 정보가 없을 수 있으므로 eopSourceRow(A링 행)를 참조
                    const eopRow = eopSourceRow ? eopSourceRow + s : r;
                    
                    // 빈 행 검사 (MIN, V1, V2 등이 모두 비어있으면 루프 종료 또는 빈값 처리)
                    const minStr = String(getVal(r, minCol) || "").trim();
                    const eopStr = String(getVal(eopRow, eopCol) || "").toUpperCase().trim();
                    
                    const info = {
                        min: parseInt(minStr) || 0,
                        eop: eopStr === 'Y',
                        sigsV: [], sigsP: []
                    };
                    const uticStep = {
                        stepNo: s + 1,
                        minTm: parseInt(minStr) || 0,
                        maxTm: parseInt(String(getVal(r, maxCol) || "0").trim()) || 0,
                        eop: eopStr === 'Y' ? 1 : 0
                    };
                    for (let l = 0; l < 8; l++) {
                        const vVal = parseInt(String(getVal(r, lsuCols[l].v) || "0").trim()) || 0;
                        const pVal = parseInt(String(getVal(r, lsuCols[l].p) || "0").trim()) || 0;
                        info.sigsV.push(vVal);
                        info.sigsP.push(pVal);
                        uticStep[`car${l+1}`] = vVal;
                        uticStep[`ped${l+1}`] = pVal;
                    }
                    allSteps.push(info);
                    rawSteps.push(uticStep);
                }

                // 2. 현시순서에 따라 매핑
                let currentStep = 0;
                for (let pIdx = 0; pIdx < 8; pIdx++) {
                    if (currentStep >= 32) break;
                    const stepsInPhase = [];
                    while (currentStep < 32) {
                        const st = allSteps[currentStep++];
                        stepsInPhase.push(st);
                        if (st.eop) break;
                    }

                    if (stepsInPhase.length > 0) {
                        const eopStep = stepsInPhase[stepsInPhase.length - 1];
                        if (eopStep.eop) {
                            // V열에 값이 있는지 확인 (차량신호 존재 여부)
                            const hasVehicleSignal = eopStep.sigsV.some(v => v > 0);
                            phaseData[pIdx].yellow = hasVehicleSignal ? eopStep.min : 0;
                        }
                    }

                    const currentVId = baseMovs[pIdx] || 0;
                    phaseData[pIdx].vId = currentVId;

                    let pLSU = -1;
                    const checkPedActive = (l) => stepsInPhase.some(st => {
                        const p = st.sigsP[l];
                        return (p === 1 || p === 5 || p === 10 || p === 50);
                    });
                    
                    for (let l = 0; l < 4; l++) { if (checkPedActive(l)) { pLSU = l; break; } }
                    if (pLSU === -1) { for (let l = 4; l < 8; l++) { if (checkPedActive(l)) { pLSU = l; break; } } }

                    if (pLSU !== -1) {
                        let currentPhaseTime = 0;
                        let foundFirstGreen = false;
                        stepsInPhase.forEach(st => {
                            const pCode = st.sigsP[pLSU];
                            if (pCode === 1 || pCode === 10) {
                                if (!foundFirstGreen) { phaseData[pIdx].delay = currentPhaseTime; foundFirstGreen = true; }
                                phaseData[pIdx].g += st.min;
                            } else if (pCode === 5 || pCode === 50) { phaseData[pIdx].f += st.min; }
                            currentPhaseTime += st.min;
                        });
                        if (phaseData[pIdx].g > 0 || phaseData[pIdx].f > 0) {
                            phaseData[pIdx].pId = (currentVId > 0 && currentVId % 2 === 0) ? (currentVId + 100) : (pLSU + 101);
                        }
                    }
                }
                return { phaseData, rawSteps };
            };

            for (let m = 0; m < 6; m++) {
                const sm = junction.signalMaps[m];
                const startRowA = baseRowMapStart + (m * 67) + 3;
                const startRowB = startRowA + 32;

                const { phaseData: dataA, rawSteps: stepsA } = processRingData(startRowA, baseMovA);
                // B링 분석 시 A링의 EOP 행 위치를 함께 전달하여 동기화
                const { phaseData: dataB, rawSteps: stepsB } = processRingData(startRowB, baseMovB, startRowA);

                sm.stepsA = stepsA;
                sm.stepsB = stepsB;

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

            // [3] 일계획 및 시간계획 분석 (기존 로직 유지)
            const dayPlansFound = {};
            const tpPlansDict = {};
            for (let r = 1; r < sheetData.length; r++) {
                for (let c = 1; c < 60; c++) {
                    const cellVal = String(getVal(r, c) || "");
                    if (cellVal.startsWith('일계획(')) {
                        const dMatch = cellVal.match(/\((\d+)\)/);
                        if (dMatch) {
                            const dNo = parseInt(dMatch[1]), slots = [];
                            for (let sr = r + 2; sr < r + 18; sr++) {
                                let vTime = getVal(sr, c + 2), tStr = "-1";
                                if (typeof vTime === 'number') {
                                    const tot = Math.round(vTime * 1440);
                                    tStr = `${String(Math.floor(tot/60)).padStart(2,'0')}:${String(tot%60).padStart(2,'0')}`;
                                } else tStr = String(vTime || "-1");
                                const cyc = parseInt(getVal(sr, c + 5)) || 0, tIdx = parseInt(getVal(sr, c + 8)) || 0;
                                if (cyc > 0) slots.push({ time: tStr, cycle: cyc, tpIdx: tIdx });
                            }
                            dayPlansFound[dNo] = slots;
                        }
                    }
                    if (cellVal.includes('시간계획(')) {
                        const tMatch = cellVal.match(/\((\d+)\)/);
                        if (tMatch) {
                            const tpIdx = parseInt(tMatch[1]), baseR = r + 2;
                            const tpPlans = Array(16).fill(null);
                            for (let idxS = 0; idxS < 16; idxS++) {
                                const isR = (idxS >= 8), hO = isR ? 12 : 0, locI = isR ? (idxS - 8) : idxS;
                                const rA = baseR + (locI * 2), rB = rA + 1;
                                const spC = c + 5 + hO, offC = c + 4 + hO, cycC = c + 2 + hO, idxC = c + 3 + hO;
                                
                                const patternIdx = parseInt(getVal(rA, idxC));
                                if (!isNaN(patternIdx) && patternIdx >= 1 && patternIdx <= 16) {
                                    const sAL = [], sBL = [];
                                    // 8 intervals per ring
                                    for (let sc = spC; sc < spC + 8; sc++) { 
                                        sAL.push(parseInt(getVal(rA, sc)) || 0); 
                                        sBL.push(parseInt(getVal(rB, sc)) || 0); 
                                    }
                                    tpPlans[patternIdx - 1] = { 
                                        cycle: parseInt(getVal(rA, cycC)) || 0, 
                                        offset: parseInt(getVal(rA, offC)) || 0, 
                                        splitA: sAL, 
                                        splitB: sBL 
                                    };
                                }
                            }
                            // Fill missing patterns with empty data
                            for(let i=0; i<16; i++) {
                                if(!tpPlans[i]) tpPlans[i] = { offset: 0, splitA: Array(8).fill(0), splitB: Array(8).fill(0) };
                            }
                            tpPlansDict[tpIdx] = tpPlans;
                        }
                    }
                }
            }

            for (let dK = 1; dK <= 5; dK++) {
                const daily = dayPlansFound[dK]; if (!daily) continue;
                const sysDayIndices = (dK === 1 ? [0, 5] : dK === 2 ? [1, 6] : dK === 3 ? [2, 7] : dK === 4 ? [3, 8] : dK === 5 ? [4, 9] : []);
                sysDayIndices.forEach(dIdx => {
                    junction.dayPlanMapIds[dIdx] = (dK - 1);
                    junction.schedules[dIdx] = Array.from({ length: 16 }, (_, sI) => {
                        const s = daily[sI]; if (!s) return { h: -1, m: 0, cycle: 100, idx: 1 };
                        const [h, m] = s.time.split(':').map(Number);
                        return { h, m, cycle: s.cycle, idx: s.tpIdx || 1 };
                    });
                    junction.dayPlans[dIdx] = Array.from({ length: 16 }, (_, sI) => {
                        const s = daily[sI];
                        const tPlans = tpPlansDict[dK] || tpPlansDict[1] || [];
                        const pl = (s && s.tpIdx > 0 && tPlans[s.tpIdx - 1]) ? tPlans[s.tpIdx - 1] : (tPlans[0] || null);
                        if (!pl) return { offset: 0, splitA: Array(8).fill(0), splitB: Array(8).fill(0) };
                        return { offset: pl.offset, splitA: [...pl.splitA], splitB: [...pl.splitB] };
                    });
                });
            }
            junction._isDirty = true;
            successCount++;
            addToList(file.name, 'success');
        } catch (err) {
            console.error(file.name, err);
            addToList(file.name, 'fail', err.message);
        }
    }
    updateProgress(100, "분석 완료!");
    setTimeout(() => {
        alert(`분석 완료: 총 ${files.length}개 중 ${successCount}개 성공`);
        if (typeof renderRingTables === 'function') renderRingTables();
        if (typeof renderSummaryTable === 'function') renderSummaryTable();
        if (typeof refreshDBStats === 'function') refreshDBStats();
        if (typeof renderGroupList === 'function') renderGroupList();
        input.value = '';
    }, 500);
}

function processGeoJSON(json) {
    try {
        const data = typeof json === 'string' ? JSON.parse(json) : json;
        if (STATE.geoJsonLayer && window.map) window.map.removeLayer(STATE.geoJsonLayer);

        // 💎 은은하고 반투명한 유리(Glass-Sleek) 스타일
        STATE.geoJsonLayer = L.geoJSON(data, {
            style: (f) => {
                const props = f.properties;
                const gid = props.group || props.group_id || props.GroupID || props.link_id || props.id;
                const color = getGroupColor(gid);
                
                return {
                    color: color,
                    weight: 5.5,
                    opacity: 0.4, // 반투명 감각 강화
                    lineJoin: 'round',
                    lineCap: 'round',
                    fillColor: color,
                    fillOpacity: 0.05
                };
            },
            onEachFeature: (feature, layer) => {
                const props = feature.properties;
                const gid = props.group || props.group_id || props.GroupID || props.link_id || props.id;
                const color = getGroupColor(gid);

                layer.on({
                    mouseover: (e) => {
                        // 호버 시에도 과한 네온 효과 제거 (부드러운 포커스)

                        e.target.setStyle({ 
                            weight: 8, 
                            opacity: 0.8, 
                            color: '#2ecc71' 
                        });
                    },
                    mouseout: (e) => {
                        STATE.geoJsonLayer.resetStyle(e.target);
                    }
                });

                layer.bindTooltip(`
                    <div style="padding:10px; background:rgba(18,18,18,0.95); color:#fff; border-radius:12px; border:1px solid rgba(255,255,255,0.1); box-shadow:0 10px 20px rgba(0,0,0,0.5); font-size:12px;">
                        <span style="display:inline-block; width:10px; height:10px; background:${color}; border-radius:50%; margin-right:8px;"></span>
                        <b>Link:</b> <span style="color:#2ecc71;">${props.link_id || props.id || 'N/A'}</span><br>
                        <div style="margin-top:4px; opacity:0.7; font-size:10px;">🏢 Group ID: ${gid || 'Common'}</div>
                    </div>`, { sticky: true, className: "premium-tooltip" });
            }
        }).addTo(window.map);

        // [추가] 로딩 즉시 맵 상단 "연동" 버튼을 활성화 상태로 동기화
        const btn = document.getElementById('btn-road-network-toggle');
        if (btn) btn.classList.add('active');

        // [핵심 수정] 시각적 레이어만 만드는 것이 아니라, 편집 엔진(RoadManager)에도 데이터를 주입해야 함
        if (window.RoadManager) {
            console.log("[Data] Injecting GeoJSON into RoadManager for editing...");
            window.RoadManager.importJSON(data);
        }

    } catch (e) { console.error("Link GeoJSON Style Error:", e); }
}

function processBoundaryGeoJSON(json) {
    try {
        const data = typeof json === 'string' ? JSON.parse(json) : json;
        if (STATE.boundaryLayer && window.map) window.map.removeLayer(STATE.boundaryLayer);
        STATE.boundaryLayer = L.geoJSON(data, {
            style: { color: "#555", weight: 2, fillOpacity: 0.1, dashArray: '5,5' }
        }).addTo(window.map);
    } catch (e) { console.error("Boundary GeoJSON Error:", e); }
}

function createEmptySignalMap() {
    return { movA:Array(8).fill(0), movB:Array(8).fill(0), pedMovA:Array(8).fill(0), pedMovB:Array(8).fill(0), mainMovements:['A0','B0'], yellowA:[3,3,3,3,0,0,0,0], yellowB:[3,3,3,3,0,0,0,0], allredA:[2,2,2,2,0,0,0,0], allredB:[2,2,2,2,0,0,0,0], pedA:[0,15,0,15,0,0,0,0], pedB:[0,15,0,15,0,0,0,0], pedDelayA:[0,2,0,2,0,0,0,0], pedDelayB:[0,2,0,2,0,0,0,0], pedFlashA:Array(8).fill(0), pedFlashB:Array(8).fill(0), pedGreenA:Array(8).fill(0), pedGreenB:Array(8).fill(0), startTime:"", endTime:"" };
}

function parseExtraConfigs(j, row) {
    if (!row) return;
    const fStr = row["FlashCfg"];
    if (fStr && fStr.includes('|')) {
        const p = fStr.split('|'); j.flashEnable = p[0] === '1';
        j.flashTimes = (p[1]||"").split(';').map(s=>{ const b=s.split(','); return b.length>=2?{s:b[0],e:b[1]}:null; }).filter(t=>t);
        j.flashYellows = (p[2]||"").split(';').filter(v=>v).map(Number); j.flashReds = (p[3]||"").split(';').filter(v=>v).map(Number);
    }

    const arrowStr = row["ArrowConfigs"];
    j.arrowConfigs = {};
    j.customAngles = {};
    if (arrowStr) {
        arrowStr.split(';').forEach(conf => {
            const parts = conf.split(':');
            if (parts.length >= 3 && parts[0] === '_custom_angles') {
                j.customAngles[parts[1]] = parseInt(parts[2]) || 0;
            } else if (parts.length >= 4) {
                const mov = parseInt(parts[0]);
                if (!j.arrowConfigs[mov]) j.arrowConfigs[mov] = [];
                j.arrowConfigs[mov].push({
                    dLat: parseFloat(parts[1]) || 0,
                    dLng: parseFloat(parts[2]) || 0,
                    rot: parseInt(parts[3]) || 0
                });
            }
        });
    }
}

