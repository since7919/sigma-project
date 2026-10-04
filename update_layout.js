const fs = require('fs');

let indexHtml = fs.readFileSync('SIGMA_SIM/index.html', 'utf8');

const startTag = '<div class="tsd-console-header';
const endTag = '</div>\n\n                <div class="foldable-content p-10" style="background: #050608;">';

const startIdx = indexHtml.indexOf(startTag, indexHtml.indexOf('<!-- 📊 Professional TSD Console -->'));
const endIdx = indexHtml.indexOf(endTag, startIdx);

if (startIdx !== -1 && endIdx !== -1) {
    const before = indexHtml.substring(0, startIdx);
    const after = indexHtml.substring(endIdx + '</div>'.length); // Leave the foldable-content intact
    
    const newHeader = `<div class="tsd-console-header" style="display: flex; flex-direction: column; gap: 12px; padding: 12px 16px; background: #0c0f14; border-bottom: 1px solid rgba(255,255,255,0.05);">
                    
                    <!-- Row 1: Title & Config Set -->
                    <div class="flex-row-between align-center" style="width: 100%;">
                        <!-- Title -->
                        <div class="flex-row gap-8 align-center">
                            <div class="tsd-icon-box" style="width:28px; height:28px; background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.08);">
                                <span class="fs-12">📊</span>
                            </div>
                            <h3 class="m-0 fs-14 fw-800 ls-05 text-white">연동 시공도 분석 콘솔</h3>
                        </div>
                        
                        <!-- 세트 -->
                        <select id="tsd-config-set" onchange="renderTimeSpaceDiagram()" class="tsd-select" style="color:#b388ff; border-color: rgba(179, 136, 255, 0.3);">
                            <option value="0">SET 1</option>
                            <option value="1">SET 2</option>
                            <option value="2">SET 3</option>
                        </select>
                    </div>

                    <!-- Row 2: Controls & Info -->
                    <div class="flex-row-between align-center" style="width: 100%; flex-wrap: wrap; gap: 12px;">
                        <!-- Left: Core Controls -->
                        <div class="flex-row gap-8 align-center" style="flex-wrap: wrap;">
                            <!-- 축 -->
                            <div class="tsd-input-wrap">
                                <label class="fs-10 text-white pointer p-3-10 flex-row gap-4" style="margin:0;">
                                    <input type="radio" name="tsd-axis" value="ew" checked onchange="renderTimeSpaceDiagram()" style="accent-color:var(--accent);"> E-W
                                </label>
                                <label class="fs-10 text-white pointer p-3-10 flex-row gap-4" style="margin:0; border-left:1px solid rgba(255,255,255,0.08);">
                                    <input type="radio" name="tsd-axis" value="ns" onchange="renderTimeSpaceDiagram()" style="accent-color:var(--accent);"> S-N
                                </label>
                            </div>
                            <!-- 속도 -->
                            <div class="tsd-input-wrap px-8">
                                <span class="fs-9 text-dim pr-4">속도</span>
                                <input type="number" id="tsd-speed" value="50" step="5" onchange="renderTimeSpaceDiagram()" style="width:32px; border:none; background:transparent; color:#64b5f6; font-weight:700; font-size:11px; text-align:center; outline:none;">
                            </div>
                            <!-- 시간선택 -->
                            <select id="tsd-day-plan" onchange="updateTsdTimeSlots(); renderTimeSpaceDiagram();" class="tsd-select" style="min-width:70px;">
                                <option value="0">일계획 1</option>
                                <option value="1">일계획 2</option>
                                <option value="2">일계획 3</option>
                                <option value="3">일계획 4</option>
                                <option value="4">일계획 5</option>
                                <option value="5">일계획 6</option>
                                <option value="6">일계획 7</option>
                                <option value="7">일계획 8</option>
                                <option value="8">일계획 9</option>
                                <option value="9">일계획 10</option>
                            </select>
                            <select id="tsd-time-slot" onchange="renderTimeSpaceDiagram()" class="tsd-select" style="min-width:60px;"></select>
                        </div>
                        
                        <!-- Right: Info & Buttons -->
                        <div class="flex-row gap-6 align-center">
                            <div id="tsd-info-text" class="tsd-status-badge" style="margin: 0; margin-right: 4px;">데이터 분석 대기 중...</div>
                            <button onclick="resetTsdOffsets()" class="tsd-btn tsd-btn-danger" title="오프셋 초기화">↺</button>
                            <button onclick="openTsdPopup()" class="tsd-btn tsd-btn-success" title="크게보기">⛶</button>
                        </div>
                    </div>
                </div>`;
    
    fs.writeFileSync('SIGMA_SIM/index.html', before + newHeader + after, 'utf8');
    console.log("Updated TSD console header to 2-row layout.");
} else {
    console.log("Could not find start or end index.");
}
