const fs = require('fs');

const p = fs.readFileSync('SIGMA_SIM/js/stats.js', 'utf8');

const targetStr = `            @keyframes ambientPulse {
                0% { transform: translate(-10%, -10%) scale(1); opacity: 0.05; }
                50% { transform: translate(10%, 10%) scale(1.1); opacity: 0.15; }
                100% { transform: translate(-10%, -10%) scale(1); opacity: 0.05; }
            }`;

const replaceStr = `            @keyframes ambientPulse {
                0% { transform: translate(-5%, -5%) scale(0.8); opacity: 0.1; }
                50% { transform: translate(5%, 5%) scale(1.3); opacity: 0.5; }
                100% { transform: translate(-5%, -5%) scale(0.8); opacity: 0.1; }
            }
            @keyframes sweepScan {
                0% { transform: translateX(-100%); }
                100% { transform: translateX(200%); }
            }
            .insight-box::after {
                content: "";
                position: absolute;
                top: 0; left: 0; width: 100%; height: 2px;
                background: linear-gradient(90deg, transparent, var(--box-color), transparent);
                opacity: 0.7;
                animation: sweepScan 6s linear infinite;
                z-index: 2;
            }`;

if (p.includes(targetStr)) {
    const updated = p.replace(targetStr, replaceStr);
    fs.writeFileSync('SIGMA_SIM/js/stats.js', updated, 'utf8');
    console.log("Successfully boosted animation visibility and added sweep scan.");
} else {
    console.log("Could not find ambientPulse keyframes.");
}
