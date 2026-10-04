const fs = require('fs');

let indexHtml = fs.readFileSync('SIGMA_SIM/index.html', 'utf8');

const startTag = '<style id="ambient-stats-style">';
const endTag = '</style>';

const startIdx = indexHtml.indexOf(startTag);
const endIdx = indexHtml.indexOf(endTag, startIdx);

if (startIdx !== -1 && endIdx !== -1) {
    const before = indexHtml.substring(0, startIdx);
    const after = indexHtml.substring(endIdx + endTag.length);
    
    // Ambient Aurora Background Effect
    const auroraCSS = `<style id="ambient-stats-style">
        @keyframes auroraFloat {
            0% { transform: translate(0%, 0%) scale(1); opacity: 0.5; }
            33% { transform: translate(5%, -5%) scale(1.1); opacity: 0.8; }
            66% { transform: translate(-5%, 2%) scale(0.95); opacity: 0.6; }
            100% { transform: translate(0%, 0%) scale(1); opacity: 0.5; }
        }
        .ambient-aurora {
            position: absolute;
            top: 0; left: 0; width: 100%; height: 100%;
            background: radial-gradient(circle at 20% 30%, rgba(52, 152, 219, 0.06) 0%, transparent 50%),
                        radial-gradient(circle at 80% 70%, rgba(155, 89, 182, 0.06) 0%, transparent 50%),
                        radial-gradient(circle at 60% 20%, rgba(46, 204, 113, 0.04) 0%, transparent 50%);
            filter: blur(60px);
            animation: auroraFloat 15s ease-in-out infinite;
            pointer-events: none;
            z-index: 0;
        }
        #stat-content {
            position: relative;
            overflow: hidden;
        }
        #stat-content > div:not(.ambient-aurora) {
            position: relative;
            z-index: 1;
        }
        /* Keep the subtle icon float as it is very non-intrusive */
        @keyframes iconFloat {
            0% { transform: translateY(0px); }
            50% { transform: translateY(-3px); }
            100% { transform: translateY(0px); }
        }
        .insight-icon {
            display: inline-block;
            animation: iconFloat 4s ease-in-out infinite alternate;
        }
    </style>`;

    fs.writeFileSync('SIGMA_SIM/index.html', before + auroraCSS + after, 'utf8');
    console.log("Updated CSS for Aurora effect.");
}

let statsJs = fs.readFileSync('SIGMA_SIM/js/stats.js', 'utf8');
// Insert the aurora div at the beginning of the html payload in renderStats
statsJs = statsJs.replace(
    /let html = ``;/,
    `let html = \`<div class="ambient-aurora"></div>\`;`
);
fs.writeFileSync('SIGMA_SIM/js/stats.js', statsJs, 'utf8');
console.log("Injected aurora div into stats.js");
