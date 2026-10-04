const fs = require('fs');

let indexHtml = fs.readFileSync('SIGMA_SIM/index.html', 'utf8');

const startTag = '<style id="ambient-stats-style">';
const endTag = '</style>';

const startIdx = indexHtml.indexOf(startTag);
const endIdx = indexHtml.indexOf(endTag, startIdx);

if (startIdx !== -1 && endIdx !== -1) {
    const before = indexHtml.substring(0, startIdx);
    const after = indexHtml.substring(endIdx + endTag.length);

    const foolproofCSS = `<style id="ambient-stats-style">
        @keyframes pulseGlow {
            0% { box-shadow: inset 0 0 0px var(--box-color), 0 0 0px var(--box-color); }
            50% { box-shadow: inset 0 0 20px var(--box-color), 0 0 10px var(--box-color); }
            100% { box-shadow: inset 0 0 0px var(--box-color), 0 0 0px var(--box-color); }
        }
        .insight-box {
            position: relative;
            animation: pulseGlow 4s infinite alternate;
        }
        @keyframes scanLine {
            0% { top: 0%; opacity: 0; }
            10% { opacity: 1; }
            90% { opacity: 1; }
            100% { top: 100%; opacity: 0; }
        }
        .insight-box::before {
            content: "";
            position: absolute;
            left: 0; right: 0; height: 2px;
            background: var(--box-color);
            box-shadow: 0 0 8px var(--box-color);
            animation: scanLine 3s linear infinite;
            z-index: 10;
            pointer-events: none;
        }
    </style>`;

    fs.writeFileSync('SIGMA_SIM/index.html', before + foolproofCSS + after, 'utf8');
    console.log("Replaced with foolproof CSS.");
} else {
    console.log("Could not find style block.");
}
