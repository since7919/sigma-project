const fs = require('fs');

let js = fs.readFileSync('SIGMA_SIM/js/tsd.js', 'utf8');
const regex = /info\.innerHTML = `[\s\S]*?`;/;
const newHTML = `info.innerHTML = \`
            <div style="background:rgba(100,181,246,0.15); color:#64b5f6; padding:2px 6px; border-radius:4px; font-size:10px;">[계획 \${dayNo} #\${planNo}]</div>
            <div style="display:flex; align-items:center; gap:3px;"><span style="color:\${this.config.trajectories.up}">●</span> 상:\${upLabel}</div>
            <div style="display:flex; align-items:center; gap:3px;"><span style="color:\${this.config.trajectories.down}">●</span> 하:\${downLabel}</div>
            <div style="color:#aaa;">C:<span style="color:#fff;">\${c}</span></div>
            <div style="color:#aaa;">V:<span style="color:#fff;">\${speed}</span></div>
            <div style="opacity:0.6; font-size:9px;">\${Math.max(vUp, vDown)}/\${total}개</div>
        \`;`;
if(js.match(regex)) {
    js = js.replace(regex, newHTML);
    fs.writeFileSync('SIGMA_SIM/js/tsd.js', js, 'utf8');
    console.log("tsd.js updated");
}

let html = fs.readFileSync('SIGMA_SIM/index.html', 'utf8');
const htmlRegex = /<div class="tsd-control-bar">[\s\S]*?<!-- 오른쪽: 버튼들 -->[\s\S]*?<\/div>\s*<\/div>/;

const compactControlBar = `<div class="tsd-control-bar">
                        <div class="flex-row gap-8" style="flex-wrap: wrap; flex: 1;">
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
                            <select id="tsd-time-slot" onchange="renderTimeSpaceDiagram()" class="tsd-select" style="min-width:60px;">
                                <!-- JS Loader -->
                            </select>
                            <!-- 세트 -->
                            <select id="tsd-config-set" onchange="renderTimeSpaceDiagram()" class="tsd-select" style="color:#b388ff; border-color: rgba(179, 136, 255, 0.3);">
                                <option value="0">SET 1</option>
                                <option value="1">SET 2</option>
                                <option value="2">SET 3</option>
                            </select>
                        </div>
                        
                        <div class="flex-row gap-6">
                            <button onclick="resetTsdOffsets()" class="tsd-btn tsd-btn-danger" title="오프셋 초기화">↺</button>
                            <button onclick="openTsdPopup()" class="tsd-btn tsd-btn-success" title="크게보기">⛶</button>
                        </div>
                    </div>`;

if(html.match(htmlRegex)) {
    html = html.replace(htmlRegex, compactControlBar);
    fs.writeFileSync('SIGMA_SIM/index.html', html, 'utf8');
    console.log("index.html updated");
} else {
    console.log("index.html regex failed");
}
