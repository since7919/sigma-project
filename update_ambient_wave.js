const fs = require('fs');

let p = fs.readFileSync('SIGMA_SIM/js/stats.js', 'utf8');

// Find the string we just injected and modify it
const target = `animation: ambientPulse 12s ease-in-out infinite;`;
const replacement = `animation: ambientPulse 12s ease-in-out infinite;`;

// Actually we need to add the animation-delay to the ::before element. Since we can't easily inline style a pseudo-element dynamically per instance, we can achieve organic desync by applying the animation to a dedicated background div instead of a pseudo-element!

const newStr = `
    // Add ambient animation styles once if not present
    if (!document.getElementById('ambient-stats-style')) {
        const style = document.createElement('style');
        style.id = 'ambient-stats-style';
        style.innerHTML = \`
            @keyframes ambientPulse {
                0% { transform: translate(-10%, -10%) scale(1); opacity: 0.05; }
                50% { transform: translate(10%, 10%) scale(1.1); opacity: 0.15; }
                100% { transform: translate(-10%, -10%) scale(1); opacity: 0.05; }
            }
            .insight-box {
                position: relative;
                overflow: hidden;
            }
            .ambient-bg {
                position: absolute;
                top: -50%; left: -50%; width: 200%; height: 200%;
                background: radial-gradient(circle at center, var(--box-color) 0%, transparent 50%);
                animation: ambientPulse 12s ease-in-out infinite;
                pointer-events: none;
                z-index: 0;
            }
            .insight-content {
                position: relative;
                z-index: 1;
            }
        \`;
        document.head.appendChild(style);
    }

    const InsightBox = (id, title, mainVal, subText, desc, icon, color) => {
        const randomDelay = -(Math.random() * 12).toFixed(1);
        return \`
        <div class="sigma-panel insight-box" \${id ? \`onclick="showInsightDetail('\${id}')" style="cursor: pointer;"\` : 'style="cursor: default;"'} style="--box-color: \${color}; padding: 15px; margin: 0; background: rgba(0,0,0,0.3); border-left: 3px solid \${color}; border-radius: 4px; transition: background 0.2s;">
            <div class="ambient-bg" style="animation-delay: \${randomDelay}s;"></div>
            <div class="insight-content">
                <div class="flex-row gap-10 align-center mb-8">
                    <span style="font-size: 20px;">\${icon}</span>
                    <span class="fs-12 fw-800 text-white">\${title}</span>
                </div>
                <div class="flex-row gap-8 align-end mb-8">
                    <span class="fw-900" style="font-size: 24px; color: \${color}; line-height: 1;">\${mainVal}</span>
                    <span class="fs-11 text-dim" style="line-height: 1.4;">\${subText}</span>
                </div>
                <div class="fs-11 flex-row-between" style="color: #999; line-height: 1.4;">
                    <span style="flex:1;">\${desc}</span>
                </div>
            </div>
        </div>
        \`;
    };`;

const startMarker = "// Add ambient animation styles once if not present";
const endMarker = "    \`;";

const startIdx = p.indexOf(startMarker);
const endIdx = p.indexOf(endMarker, startIdx);

if (startIdx !== -1 && endIdx !== -1) {
    const before = p.substring(0, startIdx);
    const after = p.substring(endIdx + endMarker.length);
    fs.writeFileSync('SIGMA_SIM/js/stats.js', before + newStr + after, 'utf8');
    console.log("Successfully updated to use dedicated div with random desync");
} else {
    console.log("Could not find previously injected block.");
}
