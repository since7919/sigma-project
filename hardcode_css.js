const fs = require('fs');

let indexHtml = fs.readFileSync('SIGMA_SIM/index.html', 'utf8');

if (!indexHtml.includes('ambientPulse')) {
    const styleBlock = `
    <style id="ambient-stats-style">
        @keyframes ambientPulse {
            0% { transform: translate(-5%, -5%) scale(0.8); opacity: 0.1; }
            50% { transform: translate(5%, 5%) scale(1.3); opacity: 0.5; }
            100% { transform: translate(-5%, -5%) scale(0.8); opacity: 0.1; }
        }
        @keyframes sweepScan {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(200%); }
        }
        .insight-box {
            position: relative;
            overflow: hidden;
        }
        .insight-box::after {
            content: "";
            position: absolute;
            top: 0; left: 0; width: 100%; height: 3px;
            background: linear-gradient(90deg, transparent, var(--box-color), transparent);
            opacity: 0.9;
            animation: sweepScan 6s linear infinite;
            z-index: 10;
        }
        .ambient-bg {
            position: absolute;
            top: -50%; left: -50%; width: 200%; height: 200%;
            background: radial-gradient(circle at center, var(--box-color) 0%, transparent 50%);
            animation: ambientPulse 12s ease-in-out infinite;
            pointer-events: none;
            z-index: 0;
            mix-blend-mode: screen;
        }
        .insight-content {
            position: relative;
            z-index: 1;
        }
    </style>
</head>`;

    indexHtml = indexHtml.replace('</head>', styleBlock);
    fs.writeFileSync('SIGMA_SIM/index.html', indexHtml, 'utf8');
    console.log('Injected CSS directly into index.html');
} else {
    console.log('CSS already in index.html');
}

// Now let's remove the dynamic injection from stats.js to avoid duplication
let statsJs = fs.readFileSync('SIGMA_SIM/js/stats.js', 'utf8');
const startMarker = "// Add ambient animation styles once if not present";
const endMarker = "        document.head.appendChild(style);\n    }";

const startIdx = statsJs.indexOf(startMarker);
const endIdx = statsJs.indexOf(endMarker);

if (startIdx !== -1 && endIdx !== -1) {
    const before = statsJs.substring(0, startIdx);
    const after = statsJs.substring(endIdx + endMarker.length);
    fs.writeFileSync('SIGMA_SIM/js/stats.js', before + after, 'utf8');
    console.log('Removed dynamic CSS injection from stats.js');
}
