const fs = require('fs');
let html = fs.readFileSync('SIGMA_SIM/index.html', 'utf8');

const css = \
        .step-slider-container {
            display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 4px;
        }
        .step-slider {
            position: relative;
            width: 100%; height: 12px;
            cursor: pointer;
        }
        .step-slider-track {
            position: absolute;
            left: 4px; right: 4px; height: 4px;
            background: #475569; top: 4px; z-index: 1; border-radius: 2px;
        }
        .step-slider-fill {
            position: absolute;
            left: 4px; height: 4px;
            background: #38bdf8; top: 4px; z-index: 1; transition: width 0.2s; border-radius: 2px;
        }
        .step-slider-dot {
            position: absolute;
            top: 0;
            width: 10px; height: 10px; margin-top: 1px;
            border-radius: 50%;
            background: #475569;
            z-index: 2; transition: all 0.2s;
        }
        .step-slider-dot.active {
            width: 12px; height: 12px; margin-top: 0;
            background: #38bdf8;
        }
\;

html = html.replace('</style>', css + '\\n    </style>');

fs.writeFileSync('SIGMA_SIM/index.html', html);
console.log('CSS injected');
