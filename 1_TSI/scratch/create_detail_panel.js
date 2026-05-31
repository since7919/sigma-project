const fs = require('fs');
let code = fs.readFileSync('scratch/detail_logic.js', 'utf8');

// The logic needs to be converted into a class
let classCode = `
class DetailPanel {
    constructor(slot, item) {
        this.slot = slot;
        this.item = item;
        this.detailMap = null;
        this.detailUpdateTimer = null;
        this.detailMarkers = {};
        this.currentCropData = null;
        this.currentSigMapData = { ringA: [], ringB: [] };
        
        this.init();
    }
    
    $(id) {
        return document.getElementById(id + '-' + this.slot);
    }
    
    destroy() {
        if (this.detailUpdateTimer) clearInterval(this.detailUpdateTimer);
        if (this.detailMap) {
            this.detailMap.remove();
            this.detailMap = null;
        }
        this.detailMarkers = {};
    }

    init() {
        const item = this.item;
        
        // 기본 정보 세팅
        if(this.$('detail-itst-name')) this.$('detail-itst-name').textContent = item.itstNm;
        if(this.$('f-val-id')) this.$('f-val-id').textContent = item.itstId;
        if(this.$('f-val-region')) this.$('f-val-region').textContent = REGIONS.find(r => r.code === currentRegionCode)?.name || '인천시';
        if(this.$('detail-region-label')) this.$('detail-region-label').textContent = \`[\${this.$('f-val-region').textContent}]\`;

        // 미니맵 초기화
        setTimeout(() => {
            if (this.detailMap) {
                this.detailMap.remove();
            }
            this.detailMap = L.map('detail-map-' + this.slot, {
                zoomControl: false,
                attributionControl: false
            }).setView([item.la, item.lo], 18);

            L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(this.detailMap);
            
            L.circleMarker([item.la, item.lo], {
                radius: 12,
                fillColor: "#38bdf8",
                color: "#fff",
                weight: 3,
                fillOpacity: 0.8
            }).addTo(this.detailMap);

            const angles = [0, 45, 90, 135, 180, 225, 270, 315];
            const dirNames = { 0: '북', 45: '북동', 90: '동', 135: '남동', 180: '남', 225: '남서', 270: '서', 315: '북서' };
            
            this.detailMarkers = {};
            angles.forEach(deg => {
                const distanceY = 0.00024;
                const distanceX = (deg === 0 || deg === 180) ? 0.00024 : 0.00032;
                const rad = deg * Math.PI / 180;
                
                const markerLat = item.la + distanceY * Math.cos(rad);
                const markerLng = item.lo + distanceX * Math.sin(rad);

                const marker = L.circleMarker([markerLat, markerLng], {
                    radius: 8,
                    fillColor: "#ef4444",
                    color: "#000",
                    weight: 2,
                    fillOpacity: 1
                }).addTo(this.detailMap);

                marker.bindTooltip(\`\${dirNames[deg]}향 (\${deg}°)\`, { direction: 'top', offset: [0, -5] });
                this.detailMarkers[deg] = marker;
            });
        }, 100);

        this.startDetailRealtimeUpdate();
        this.fetchPlanCROP(item.itstId, item.itstNm);
        this.fetchSigMapCRInfo(item.itstId, item.itstNm);
    }
    
    parsePhaseCode(code) {
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

    getRealtimeSignalState() {
        if (!this.currentCropData || !this.currentCropData.cycle) return null;
        const cycle = parseInt(this.currentCropData.cycle);
        const offset = parseInt(this.currentCropData.offset || 0);
        const nowSeconds = Math.floor(Date.now() / 1000);
        const timeInCycle = (nowSeconds - offset + cycle) % cycle;

        const calcRingState = (ringPrefix) => {
            let cumulativeTime = 0;
            let currentPhaseIdx = 1;
            let remainingTime = 0;
            for (let i = 1; i <= 8; i++) {
                const split = this.currentCropData[\`\${ringPrefix}_\${i}_PHASE_VAL\`] || 0;
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
        return { 
            currentPhaseA: ringA.currentPhaseIdx, 
            remainingTimeA: ringA.remainingTime,
            currentPhaseB: ringB.currentPhaseIdx,
            remainingTimeB: ringB.remainingTime
        };
    }

    calculateActualSignalStatus(phases) {
        const state = this.getRealtimeSignalState();
        if (!state) {
            return phases.map(p => ({
                ...p,
                isGreen: false,
                remaining: 0,
                statusText: '정보없음',
                statusClass: 'sig-status-gray'
            }));
        }

        return phases.map(p => {
            const isActive = p.ring === 'A' ? (p.idx === state.currentPhaseA) : (p.idx === state.currentPhaseB);
            const remainingTime = p.ring === 'A' ? state.remainingTimeA : state.remainingTimeB;
            let statusText = '적색 점등(1)';
            let statusClass = 'sig-status-red';
            let isGreen = false;

            if (isActive) {
                isGreen = true;
                if (p.outputType.includes('보행')) {
                    if (remainingTime <= 7) {
                        statusText = '보행 점멸(3)';
                        statusClass = 'sig-status-flash';
                    } else {
                        statusText = '녹색 점등(3)';
                        statusClass = 'sig-status-green';
                    }
                } else {
                    if (remainingTime <= 3) {
                        statusText = '황색 점등(2)';
                        statusClass = 'sig-status-yellow';
                    } else {
                        statusText = '녹색 점등(3)';
                        statusClass = 'sig-status-green';
                    }
                }
            }

            let pedestrianVal = '-';
            if (isActive) {
                if (p.type === 'P' || p.type === 'S') {
                    pedestrianVal = remainingTime + 's';
                }
            }

            return {
                ...p,
                isGreen: isGreen,
                remaining: isActive ? remainingTime : 0,
                pedestrian: pedestrianVal,
                statusText: statusText,
                statusClass: statusClass
            };
        });
    }

    startDetailRealtimeUpdate() {
        if (this.detailUpdateTimer) clearInterval(this.detailUpdateTimer);

        let phases = [];
        if (typeof L02_DETAIL_DATA !== 'undefined') {
            const conf = L02_DETAIL_DATA.find(d => d.INT_NO == this.item.itstId);
            if (conf) {
                phases = [1, 2, 3, 4, 5, 6, 7, 8].reduce((acc, idx) => {
                    const aPhase = this.parsePhaseCode(conf[\`A_RING_\${idx}_PHASE_CONF_CD\`]);
                    const bPhase = this.parsePhaseCode(conf[\`B_RING_\${idx}_PHASE_CONF_CD\`]);
                    if (aPhase) acc.push({ ...aPhase, ring: 'A', idx });
                    if (bPhase) acc.push({ ...bPhase, ring: 'B', idx });
                    return acc;
                }, []);
            }
        }

        const update = () => {
            const tableBody = this.$('detail-signal-body');
            if(!tableBody) return;
            
            if (this.currentCropData) {
                if(this.$('f-val-cycle')) this.$('f-val-cycle').textContent = this.currentCropData.cycle + '초';
                const offsetEl = this.$('f-val-offset');
                if (offsetEl) offsetEl.textContent = (this.currentCropData.offset || 0) + '초';
                
                // document-wide query for footer is tricky, let's target by container
                const container = document.getElementById('detail-container-' + this.slot);
                if(container) {
                    container.querySelectorAll('.footer-content .val-normal').forEach(el => {
                        el.textContent = '정상';
                        el.style.color = '#10b981';
                    });
                }
            } else {
                if(this.$('f-val-cycle')) this.$('f-val-cycle').textContent = '-';
                if(this.$('f-val-offset')) this.$('f-val-offset').textContent = '-';
                const container = document.getElementById('detail-container-' + this.slot);
                if(container) {
                    container.querySelectorAll('.footer-content .val-normal').forEach(el => {
                        el.textContent = '미수신';
                        el.style.color = '#94a3b8';
                    });
                }
            }

            if (this.currentCropData) {
                const now = new Date();
                if(this.$('f-val-time')) this.$('f-val-time').textContent = now.getFullYear() + '-' + 
                    String(now.getMonth()+1).padStart(2,'0') + '-' + 
                    String(now.getDate()).padStart(2,'0') + ' ' + 
                    now.toLocaleTimeString('ko-KR', {hour12:false});
            } else {
                if(this.$('f-val-time')) this.$('f-val-time').textContent = '-';
            }

            const updatedPhases = this.calculateActualSignalStatus(phases);
            
            tableBody.innerHTML = updatedPhases.map(p => \`
                <tr>
                    <td style="font-weight:700; color:var(--accent-primary);">\${p.direction}</td>
                    <td>\${p.pedestrian}</td>
                    <td>\${p.bankCode}</td>
                    <td style="font-family: monospace; font-weight:700; color: \${p.isGreen ? '#10b981' : 'inherit'}">
                        \${p.isGreen ? p.remaining + 's' : '-'}
                    </td>
                    <td><span class="output-badge">\${p.outputType}</span></td>
                    <td><div class="\${p.statusClass}">\${p.statusText}</div></td>
                </tr>
            \`).join('');

            // Also update markers
            const state = this.getRealtimeSignalState();
            const phaseA = state ? state.currentPhaseA : 0;
            const phaseB = state ? state.currentPhaseB : 0;
            const directions = [0, 45, 90, 135, 180, 225, 270, 315];
            const directionNames = { 0: '북', 45: '북동', 90: '동', 135: '남동', 180: '남', 225: '남서', 270: '서', 315: '북서' };

            let sPhaseMap = {}, lPhaseMap = {}, pPhaseMap = {};
            if (typeof L02_DETAIL_DATA !== 'undefined' && this.item.itstId) {
                const conf = L02_DETAIL_DATA.find(d => d.INT_NO == this.item.itstId);
                if (conf) {
                    for (let i = 1; i <= 8; i++) {
                        ['A', 'B'].forEach(ring => {
                            const parsed = this.parsePhaseCode(conf[\`\${ring}_RING_\${i}_PHASE_CONF_CD\`]);
                            if (parsed) {
                                if (parsed.type === 'S') sPhaseMap[parsed.angle] = { ring, idx: i };
                                else if (parsed.type === 'L') lPhaseMap[parsed.angle] = { ring, idx: i };
                                else if (parsed.type === 'P') pPhaseMap[parsed.angle] = { ring, idx: i };
                            }
                        });
                    }
                }
            }
            
            const hasConf = Object.keys(sPhaseMap).length > 0;
            directions.forEach((deg) => {
                let s = 'off', l = 'off', p = 'off';
                let countdown = 0;
                if (hasConf && state) {
                    const checkActive = (map) => {
                        const conf = map[deg];
                        if (!conf) return false;
                        return conf.ring === 'A' ? (conf.idx === phaseA) : (conf.idx === phaseB);
                    };
                    const getCountdown = (map) => {
                        const conf = map[deg];
                        if (!conf) return 0;
                        return conf.ring === 'A' ? state.remainingTimeA : state.remainingTimeB;
                    };
                    if (checkActive(sPhaseMap)) { s = 'green'; countdown = Math.max(countdown, getCountdown(sPhaseMap)); }
                    if (checkActive(lPhaseMap)) { l = 'green'; countdown = Math.max(countdown, getCountdown(lPhaseMap)); }
                    if (checkActive(pPhaseMap)) { p = 'green'; countdown = Math.max(countdown, getCountdown(pPhaseMap)); }
                    else if (checkActive(sPhaseMap) && !pPhaseMap[deg]) { p = 'green'; }
                }

                if (s === 'green' && countdown <= 3) s = 'yellow';
                if (l === 'green' && countdown <= 3) l = 'yellow';
                if (p === 'green' && countdown <= 7) p = 'flash';

                if (this.detailMarkers[deg]) {
                    let markerColor = "#ef4444";
                    let statusText = "정지";
                    if (s === 'green' || l === 'green' || p === 'green' || p === 'flash') {
                        markerColor = "#10b981";
                        statusText = "진행";
                        if (p === 'flash') statusText = "보행점멸";
                    } else if (s === 'yellow' || l === 'yellow') {
                        markerColor = "#f59e0b";
                        statusText = "주의";
                    }
                    this.detailMarkers[deg].setStyle({ fillColor: markerColor });
                    this.detailMarkers[deg].setTooltipContent(\`\${directionNames[deg]}향 (\${deg}°)<br><span style="color:\${markerColor}; font-weight:bold;">\${statusText} \${countdown > 0 ? countdown + 's' : ''}</span>\`);
                }
            });
        };

        update();
        this.detailUpdateTimer = setInterval(update, 1000);
    }

    async fetchPlanCROP(itstId, itstNm) {
        try {
            const targetUrl = \`\${API_CONFIG.cropUrl}?serviceKey=\${API_CONFIG.serviceKey}&type=xml&srchCTId=\${currentRegionCode}&srchCRNm=\${encodeURIComponent(itstNm)}&pageNo=1&numOfRows=10\`;
            const response = await fetch(getUrl(targetUrl));
            if (!response.ok) throw new Error('Network response not ok');
            const text = await response.text();
            
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(text, "text/xml");
            let items = xmlDoc.getElementsByTagName("PlanCROPInfo");
            if (items.length === 0) items = xmlDoc.getElementsByTagName("item");
            
            let data = null;
            for (let item of items) {
                const intNo = item.getElementsByTagName("INT_NO")[0]?.textContent;
                if (intNo === itstId) {
                    data = {
                        planNo: item.getElementsByTagName("INT_PLAN_NO")[0]?.textContent,
                        cycle: item.getElementsByTagName("INT_OPER_CYCLE_VAL")[0]?.textContent,
                        offset: item.getElementsByTagName("INT_OPER_OFFSET_VAL")[0]?.textContent,
                    };
                    let sumA = 0;
                    let sumB = 0;
                    for (let i = 1; i <= 8; i++) {
                        data[\`A_RING_\${i}_PHASE_VAL\`] = parseInt(item.getElementsByTagName(\`A_RING_\${i}_PHASE_VAL\`)[0]?.textContent || 0, 10);
                        data[\`B_RING_\${i}_PHASE_VAL\`] = parseInt(item.getElementsByTagName(\`B_RING_\${i}_PHASE_VAL\`)[0]?.textContent || 0, 10);
                        sumA += data[\`A_RING_\${i}_PHASE_VAL\`];
                        sumB += data[\`B_RING_\${i}_PHASE_VAL\`];
                    }
                    const calculatedCycle = Math.max(sumA, sumB);
                    if (calculatedCycle > 0 && (data.cycle === '121' || !data.cycle || Math.abs(parseInt(data.cycle) - calculatedCycle) > 5)) {
                        data.cycle = calculatedCycle.toString();
                    }
                    break;
                }
            }
            if (data) this.currentCropData = data;
            else throw new Error('Parsed crop data is null');
        } catch (error) {
            console.error('CROP Fetch Error for slot ' + this.slot + ':', error);
            if (typeof L02_DETAIL_DATA !== 'undefined') {
                const conf = L02_DETAIL_DATA.find(d => d.INT_NO == itstId);
                if (conf) {
                    const data = { planNo: 'MOCK_OFFLINE', cycle: '120', offset: '0' };
                    let sumA = 0; let sumB = 0;
                    for (let i = 1; i <= 8; i++) {
                        const aCode = conf[\`A_RING_\${i}_PHASE_CONF_CD\`];
                        const bCode = conf[\`B_RING_\${i}_PHASE_CONF_CD\`];
                        let aVal = 0;
                        if (aCode) { aVal = parseInt(aCode.substring(4, 7), 10) / 10; if (isNaN(aVal) || aVal <= 0) aVal = 20; }
                        let bVal = 0;
                        if (bCode) { bVal = parseInt(bCode.substring(4, 7), 10) / 10; if (isNaN(bVal) || bVal <= 0) bVal = 20; }
                        data[\`A_RING_\${i}_PHASE_VAL\`] = aVal;
                        data[\`B_RING_\${i}_PHASE_VAL\`] = bVal;
                        sumA += aVal; sumB += bVal;
                    }
                    const calculatedCycle = Math.max(sumA, sumB);
                    data.cycle = (calculatedCycle > 0 ? calculatedCycle : 120).toString();
                    this.currentCropData = data;
                }
            }
        }
    }

    async fetchSigMapCRInfo(itstId, itstNm) {
        try {
            const targetUrl = \`\${API_CONFIG.sigMapUrl}?serviceKey=\${API_CONFIG.serviceKey}&type=xml&srchCTId=\${currentRegionCode}&srchCRNm=\${encodeURIComponent(itstNm)}&pageNo=1&numOfRows=100\`;
            const response = await fetch(getUrl(targetUrl));
            if (!response.ok) throw new Error('Network response not ok');
            const text = await response.text();
            
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(text, "text/xml");
            let items = xmlDoc.getElementsByTagName("SigMapCRInfo");
            if (items.length === 0) items = xmlDoc.getElementsByTagName("item");

            const ringA = [];
            const ringB = [];
            for (let item of items) {
                const intNo = item.getElementsByTagName("INT_NO")[0]?.textContent;
                if (intNo === itstId) {
                    const ringNo = parseInt(item.getElementsByTagName("RING_NO")[0]?.textContent || 0, 10);
                    const step = {
                        stepNo: parseInt(item.getElementsByTagName("STEP_NO")[0]?.textContent || 0, 10),
                        minTm: parseInt(item.getElementsByTagName("MIN_TM")[0]?.textContent || 0, 10),
                        maxTm: parseInt(item.getElementsByTagName("MAX_TM")[0]?.textContent || 0, 10),
                        eop: parseInt(item.getElementsByTagName("EOP")[0]?.textContent || 0, 10),
                    };
                    for (let i = 1; i <= 8; i++) {
                        step[\`car\${i}\`] = parseInt(item.getElementsByTagName(\`CAR\${i}\`)[0]?.textContent || 0, 10);
                        step[\`ped\${i}\`] = parseInt(item.getElementsByTagName(\`PED\${i}\`)[0]?.textContent || 0, 10);
                    }
                    if (ringNo === 1) ringA.push(step);
                    else if (ringNo === 2) ringB.push(step);
                }
            }
            ringA.sort((a, b) => a.stepNo - b.stepNo);
            ringB.sort((a, b) => a.stepNo - b.stepNo);

            if (ringA.length > 0 || ringB.length > 0) {
                this.currentSigMapData = { ringA, ringB };
                this.renderSigMapTable();
            } else throw new Error('Parsed sigmap data is empty');
        } catch (error) {
            console.error('SigMap Fetch Error for slot ' + this.slot + ':', error);
            if (typeof L02_DETAIL_DATA !== 'undefined') {
                const conf = L02_DETAIL_DATA.find(d => d.INT_NO == itstId);
                if (conf) {
                    const stepsA = []; const stepsB = [];
                    let stepNoA = 1; let stepNoB = 1;
                    for (let i = 1; i <= 8; i++) {
                        const aCode = conf[\`A_RING_\${i}_PHASE_CONF_CD\`];
                        const bCode = conf[\`B_RING_\${i}_PHASE_CONF_CD\`];
                        if (aCode) {
                            const parsed = this.parsePhaseCode(aCode);
                            const step = { stepNo: stepNoA++, minTm: 10, maxTm: 30, eop: 1 };
                            for (let k = 1; k <= 8; k++) { step[\`car\${k}\`] = 8; step[\`ped\${k}\`] = 8; }
                            if (parsed.type === 'S') step[\`car\${i}\`] = 1;
                            else if (parsed.type === 'L') step[\`car\${i}\`] = 4;
                            else if (parsed.type === 'P') step[\`ped\${i}\`] = 16;
                            stepsA.push(step);
                        }
                        if (bCode) {
                            const parsed = this.parsePhaseCode(bCode);
                            const step = { stepNo: stepNoB++, minTm: 10, maxTm: 30, eop: 1 };
                            for (let k = 1; k <= 8; k++) { step[\`car\${k}\`] = 8; step[\`ped\${k}\`] = 8; }
                            if (parsed.type === 'S') step[\`car\${i}\`] = 1;
                            else if (parsed.type === 'L') step[\`car\${i}\`] = 4;
                            else if (parsed.type === 'P') step[\`ped\${i}\`] = 16;
                            stepsB.push(step);
                        }
                    }
                    this.currentSigMapData = { ringA: stepsA, ringB: stepsB };
                    this.renderSigMapTable();
                }
            }
        }
    }

    renderSigMapTable() {
        const renderTable = (theadId, tbodyId, steps, ringName) => {
            const thead = this.$(theadId);
            const tbody = this.$(tbodyId);
            if (!thead || !tbody) return;

            if (!steps || steps.length === 0) {
                thead.innerHTML = '';
                tbody.innerHTML = \`<tr><td style="padding:20px; text-align:center; color: #94a3b8;">\${ringName} 데이터 없음</td></tr>\`;
                return;
            }

            let headHTML = \`
                <tr>
                    <th rowspan="2" style="width:30px;">ST</th>
                    <th colspan="2">L1</th><th colspan="2">L2</th><th colspan="2">L3</th><th colspan="2">L4</th>
                    <th colspan="2">L5</th><th colspan="2">L6</th><th colspan="2">L7</th><th colspan="2">L8</th>
                    <th rowspan="2" style="width:25px;">MIN</th>
                    <th rowspan="2" style="width:25px;">MAX</th>
                    <th rowspan="2" style="width:25px;">EOP</th>
                </tr>
                <tr>\`;
            for(let i=1; i<=8; i++) headHTML += \`<th>V</th><th>P</th>\`;
            headHTML += \`</tr>\`;
            thead.innerHTML = headHTML;

            let bodyHTML = '';
            const toHex = (v) => {
                if (v === 0 || v === '0' || !v) return '00';
                if (v === 16 || v === '16' || v === 22 || v === '22') return '10';
                if (v === 32 || v === '32' || v === 50 || v === '50') return '20';
                return typeof v === 'number' ? v.toString(16).padStart(2, '0').toUpperCase() : v.toString();
            };

            const getCellClass = (val, type) => {
                const hex = toHex(val);
                if (hex === '00') return 'cell-gray';
                if (type === 'car') {
                    if (hex === '01' || hex === '04') return 'cell-green';
                    if (hex === '02') return 'cell-yellow';
                    if (hex === '08') return 'cell-red';
                    if (hex === '20') return 'cell-yellow-flash';
                    if (hex === '10') return 'cell-red-flash';
                } else {
                    if (hex === '01') return 'cell-green';
                    if (hex === '08' || hex === '02') return 'cell-red';
                    if (hex === '05') return 'cell-flash';
                }
                const num = parseInt(hex, 16);
                if (num & 0x55) return 'cell-green';
                if (num & 0xAA) return 'cell-yellow';
                return 'cell-red';
            };

            steps.forEach(step => {
                let isEOP = step.eop === 1;
                let eopClass = isEOP ? 'cell-red' : '';
                let eopText = isEOP ? 'Y' : '';
                
                bodyHTML += \`<tr>
                    <td style="font-weight:bold; background:rgba(0,0,0,0.2);">\${step.stepNo}</td>\`;
                
                for (let i = 1; i <= 8; i++) {
                    const carVal = step[\`car\${i}\`];
                    const pedVal = step[\`ped\${i}\`];
                    bodyHTML += \`<td class="\${getCellClass(carVal, 'car')}">\${toHex(carVal)}</td>\`;
                    bodyHTML += \`<td class="\${getCellClass(pedVal, 'ped')}">\${toHex(pedVal)}</td>\`;
                }

                bodyHTML += \`
                    <td style="background:rgba(0,0,0,0.2);">\${step.minTm}</td>
                    <td style="background:rgba(0,0,0,0.2);">\${step.maxTm}</td>
                    <td class="\${eopClass}">\${eopText}</td>
                </tr>\`;
            });

            tbody.innerHTML = bodyHTML;
        };

        if (!this.currentSigMapData || (!this.currentSigMapData.ringA?.length && !this.currentSigMapData.ringB?.length)) {
            if(this.$('sigmap-table-head-a')) this.$('sigmap-table-head-a').innerHTML = '';
            if(this.$('sigmap-table-body-a')) this.$('sigmap-table-body-a').innerHTML = '<tr><td style="padding:20px; text-align:center; color: #f59e0b;">현재 이 교차로의 시그널맵 데이터가 수신되지 않았거나 처리 중입니다.</td></tr>';
            if(this.$('sigmap-table-head-b')) this.$('sigmap-table-head-b').innerHTML = '';
            if(this.$('sigmap-table-body-b')) this.$('sigmap-table-body-b').innerHTML = '';
            return;
        }

        renderTable('sigmap-table-head-a', 'sigmap-table-body-a', this.currentSigMapData.ringA, 'A-RING');
        renderTable('sigmap-table-head-b', 'sigmap-table-body-b', this.currentSigMapData.ringB, 'B-RING');
    }
}

window.DetailPanel = DetailPanel;
`;

fs.writeFileSync('js/detail_panel.js', classCode);
console.log('detail_panel.js created!');
