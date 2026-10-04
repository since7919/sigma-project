const fs = require('fs');

// 1. Update layout.css
let css = fs.readFileSync('SIGMA_SIM/css/layout.css', 'utf8');

const oldBadge = /\.tsd-status-badge \{[\s\S]*?\}/;
const newBadge = `.tsd-status-badge { font-size: 11px; font-weight: 600; color: #e3f2fd; background: #131b26; padding: 6px 12px; border-radius: 6px; border: 1px solid rgba(100, 181, 246, 0.2); box-shadow: 0 2px 8px rgba(0,0,0,0.3); display: inline-flex; align-items: center; flex-wrap: wrap; gap: 10px; }`;
if (css.match(oldBadge)) css = css.replace(oldBadge, newBadge);

const oldControlBar = /\.tsd-control-bar \{[\s\S]*?\}/;
const newControlBar = `.tsd-control-bar { display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:12px; width:100%; background:#11151c; padding:10px 16px; border-radius:8px; border:1px solid rgba(255,255,255,0.06); box-shadow:0 4px 12px rgba(0,0,0,0.2); }`;
if (css.match(oldControlBar)) css = css.replace(oldControlBar, newControlBar);

const oldInputWrap = /\.tsd-input-wrap \{[\s\S]*?\}/;
const newInputWrap = `.tsd-input-wrap { display:flex; align-items:center; background:#1a1e27; border-radius:6px; border:1px solid rgba(255,255,255,0.08); overflow:hidden; }`;
if (css.match(oldInputWrap)) css = css.replace(oldInputWrap, newInputWrap);

const oldSelect = /\.tsd-select \{[\s\S]*?\}/;
const newSelect = `.tsd-select { background:#1a1e27; color:#64b5f6; border:1px solid rgba(255,255,255,0.08); border-radius:6px; height:26px; font-size:11px; font-weight:700; padding:0 8px; outline:none; transition:0.2s; cursor:pointer; }\n.tsd-select:hover { border-color: rgba(255,255,255,0.2); }`;
if (css.match(oldSelect)) css = css.replace(oldSelect, newSelect);

fs.writeFileSync('SIGMA_SIM/css/layout.css', css, 'utf8');
console.log("layout.css updated");


// 2. Update index.html (buttons)
let html = fs.readFileSync('SIGMA_SIM/index.html', 'utf8');

const oldResetBtn = /<button onclick="resetTsdOffsets\(\)"\s*style="background:#1e1610; color:#ff8a65; border:1px solid #55331a; padding:5px 13px; border-radius:4px; font-size:11px; font-weight:800; cursor:pointer; transition:0\.2s;"\s*title="오프셋을 초기 상태로 초기화">↺ RESET<\/button>/;
const newResetBtn = `<button onclick="resetTsdOffsets()"
                                style="background:rgba(255, 82, 82, 0.1); color:#ff5252; border:1px solid rgba(255, 82, 82, 0.3); padding:5px 14px; border-radius:6px; font-size:11px; font-weight:700; cursor:pointer; transition:all 0.2s; display:flex; align-items:center; gap:4px;"
                                onmouseover="this.style.background='rgba(255, 82, 82, 0.2)'" onmouseout="this.style.background='rgba(255, 82, 82, 0.1)'"
                                title="오프셋을 초기 상태로 초기화"><span style="font-size:13px;">↺</span> RESET</button>`;

if (html.match(oldResetBtn)) html = html.replace(oldResetBtn, newResetBtn);
else console.log("oldResetBtn not found");

const oldPopBtn = /<button onclick="openTsdPopup\(\)"\s*style="background:#0d1f14; color:#00e676; border:1px solid rgba\(0,230,118,0\.4\); padding:5px 13px; border-radius:4px; font-size:11px; font-weight:800; cursor:pointer; transition:0\.2s;"\s*title="분석 팝업 열기">🗖 크게보기<\/button>/;
const newPopBtn = `<button onclick="openTsdPopup()"
                                style="background:rgba(0, 230, 118, 0.1); color:#00e676; border:1px solid rgba(0, 230, 118, 0.3); padding:5px 14px; border-radius:6px; font-size:11px; font-weight:700; cursor:pointer; transition:all 0.2s; display:flex; align-items:center; gap:4px;"
                                onmouseover="this.style.background='rgba(0, 230, 118, 0.2)'" onmouseout="this.style.background='rgba(0, 230, 118, 0.1)'"
                                title="분석 팝업 열기"><span style="font-size:13px;">⛶</span> 크게보기</button>`;
if (html.match(oldPopBtn)) html = html.replace(oldPopBtn, newPopBtn);
else {
    const popRegexAlt = /<button onclick="openTsdPopup\(\)"[\s\S]*?크게보기<\/button>/;
    if (html.match(popRegexAlt)) html = html.replace(popRegexAlt, newPopBtn);
    else console.log("oldPopBtn alt not found");
}

// Remove weird inline styles on speed input and make it cleaner
const oldSpeed = /<input type="number" id="tsd-speed" value="50" step="5"\s*onchange="renderTimeSpaceDiagram\(\)"\s*style="width:44px; border:none; background:transparent; color:var\(--accent\); font-weight:800; font-size:11px; text-align:center; height:24px;">/;
const newSpeed = `<input type="number" id="tsd-speed" value="50" step="5"
                                        onchange="renderTimeSpaceDiagram()"
                                        style="width:40px; border:none; background:transparent; color:#64b5f6; font-weight:700; font-size:12px; text-align:center; height:24px; outline:none;">`;
if (html.match(oldSpeed)) html = html.replace(oldSpeed, newSpeed);

// Update config-set select border color
html = html.replace(/style="color:var\(--neon-magenta\); border-color: rgba\(255,0,255,0\.2\);"/, 'style="color:#b388ff; border-color: rgba(179, 136, 255, 0.3);"');

fs.writeFileSync('SIGMA_SIM/index.html', html, 'utf8');
console.log("index.html buttons updated");


// 3. Update tsd.js infoText
let js = fs.readFileSync('SIGMA_SIM/js/tsd.js', 'utf8');
const oldInfo = /info\.innerHTML = \`[\s\S]*?\`;\s*\}/;
const newInfo = `info.innerHTML = \`
            <div style="background:rgba(100,181,246,0.15); color:#64b5f6; padding:2px 8px; border-radius:4px;">[일계획 \${dayNo} #\${planNo}]</div>
            <div style="display:flex; align-items:center; gap:4px;"><span style="color:\${this.config.trajectories.up}">●</span> 상행: \${upLabel}</div>
            <div style="display:flex; align-items:center; gap:4px;"><span style="color:\${this.config.trajectories.down}">●</span> 하행: \${downLabel}</div>
            <div style="color:#aaa;">주기: <span style="color:#fff;">\${c}s</span></div>
            <div style="color:#aaa;">속도: <span style="color:#fff;">\${speed}km/h</span></div>
            <div style="opacity:0.6; font-size:10px;">분석: \${Math.max(vUp, vDown)}/\${total}개</div>
        \`;
    }`;
if (js.match(oldInfo)) js = js.replace(oldInfo, newInfo);
else console.log("tsd.js infoText not found");

fs.writeFileSync('SIGMA_SIM/js/tsd.js', js, 'utf8');
console.log("tsd.js updated");
