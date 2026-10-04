const fs = require('fs');

let indexHtml = fs.readFileSync('SIGMA_SIM/index.html', 'utf8');
const startTag = '<style id="ambient-stats-style">';
const endTag = '</style>';
const startIdx = indexHtml.indexOf(startTag);
const endIdx = indexHtml.indexOf(endTag, startIdx);

if (startIdx !== -1 && endIdx !== -1) {
    const before = indexHtml.substring(0, startIdx);
    const after = indexHtml.substring(endIdx + endTag.length);
    
    const elegantCSS = `<style id="ambient-stats-style">
        @keyframes iconFloat {
            0% { transform: translateY(0px); filter: drop-shadow(0 0 0px var(--box-color)); }
            50% { transform: translateY(-3px); filter: drop-shadow(0 0 8px var(--box-color)); }
            100% { transform: translateY(0px); filter: drop-shadow(0 0 0px var(--box-color)); }
        }
        .insight-icon {
            display: inline-block;
            animation: iconFloat 4s ease-in-out infinite alternate;
        }
        @keyframes liveBlink {
            0% { opacity: 0.3; }
            50% { opacity: 1; box-shadow: 0 0 8px #2ecc71; }
            100% { opacity: 0.3; }
        }
        .live-indicator-dot {
            width: 8px; height: 8px; background: #2ecc71; border-radius: 50%; display: inline-block;
            animation: liveBlink 2s infinite; margin-right: 6px; vertical-align: middle;
        }
        .live-ticker-text {
            font-size: 11px; color: #aaa; font-family: monospace;
            white-space: nowrap; overflow: hidden;
            display: inline-block; vertical-align: middle;
            transition: opacity 0.5s;
        }
    </style>`;
    fs.writeFileSync('SIGMA_SIM/index.html', before + elegantCSS + after, 'utf8');
    console.log("Updated CSS in index.html");
}

let statsJs = fs.readFileSync('SIGMA_SIM/js/stats.js', 'utf8');
// Target the icon span and add class="insight-icon" and random delay
statsJs = statsJs.replace(
    /<span style="font-size: 20px;">\$\{icon\}<\/span>/,
    `<span class="insight-icon" style="font-size: 20px; animation-delay: \${randomDelay}s;">\${icon}</span>`
);

// Add LIVE TICKER to the top of stats container
const titleInjection = `    // --- 기본 지표 계산 ---`;
const tickerHTML = `
    // Live Ticker Logic
    setTimeout(() => {
        const titleArea = document.querySelector('#tab-stats .card-title');
        if (titleArea && !document.getElementById('live-ticker-container')) {
            const ticker = document.createElement('div');
            ticker.id = 'live-ticker-container';
            ticker.style.cssText = 'flex: 1; display: flex; justify-content: center; align-items: center;';
            ticker.innerHTML = '<div style="background: rgba(0,0,0,0.4); padding: 4px 12px; border-radius: 20px; border: 1px solid rgba(46, 204, 113, 0.2);"><span class="live-indicator-dot"></span><span id="live-ticker-text" class="live-ticker-text">SYSTEM ACTIVE</span></div>';
            
            // Insert before the AI report button
            const btn = titleArea.querySelector('button');
            if (btn) titleArea.insertBefore(ticker, btn);
            else titleArea.appendChild(ticker);

            const messages = [
                "Monitoring junction flows...",
                "Synchronizing TOD schedules...",
                "Analyzing corridor offsets...",
                "Scanning pedestrian phases...",
                "Checking network coordination...",
                "SYSTEM ACTIVE"
            ];
            setInterval(() => {
                const el = document.getElementById('live-ticker-text');
                if(el) {
                    el.style.opacity = '0';
                    setTimeout(() => {
                        el.textContent = messages[Math.floor(Math.random() * messages.length)];
                        el.style.opacity = '1';
                    }, 500);
                }
            }, 6000);
        }
    }, 500);

    // --- 기본 지표 계산 ---`;

statsJs = statsJs.replace(titleInjection, tickerHTML);

fs.writeFileSync('SIGMA_SIM/js/stats.js', statsJs, 'utf8');
console.log("Updated stats.js");
