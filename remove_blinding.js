const fs = require('fs');

let indexHtml = fs.readFileSync('SIGMA_SIM/index.html', 'utf8');

const startTag = '<style id="ambient-stats-style">';
const endTag = '</style>';

const startIdx = indexHtml.indexOf(startTag);
const endIdx = indexHtml.indexOf(endTag, startIdx);

if (startIdx !== -1 && endIdx !== -1) {
    const before = indexHtml.substring(0, startIdx);
    const after = indexHtml.substring(endIdx + endTag.length);
    
    // Add a very subtle, elegant breathing effect just for the icons, NOT the whole box.
    const elegantCSS = `
    <style id="ambient-stats-style">
        @keyframes iconFloat {
            0% { transform: translateY(0px); filter: drop-shadow(0 0 2px rgba(255,255,255,0.1)); }
            50% { transform: translateY(-2px); filter: drop-shadow(0 0 6px var(--box-color)); }
            100% { transform: translateY(0px); filter: drop-shadow(0 0 2px rgba(255,255,255,0.1)); }
        }
        .insight-box .fs-20 {
            display: inline-block;
            animation: iconFloat 4s ease-in-out infinite alternate;
        }
    </style>`;

    fs.writeFileSync('SIGMA_SIM/index.html', before + elegantCSS + after, 'utf8');
    console.log("Removed blinding scan line, replaced with subtle icon float.");
} else {
    console.log("Could not find style block.");
}
