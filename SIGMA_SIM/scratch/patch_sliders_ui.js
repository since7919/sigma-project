const fs = require('fs');

// 1. Update index.html
let html = fs.readFileSync('SIGMA_SIM/index.html', 'utf8');

const sliderHtml = (type, labelId) => \
<div class="step-slider-container">
    <div class="step-slider" onclick="handleStepSlider(event, this, '\')">
        <div class="step-slider-track"></div>
        <div class="step-slider-fill" style="width: 50%;"></div>
        <div class="step-slider-dot" style="left: 0; background: #38bdf8;" data-idx="0"></div>
        <div class="step-slider-dot active" style="left: calc(50% - 6px); background: #38bdf8;" data-idx="1"></div>
        <div class="step-slider-dot" style="left: calc(100% - 12px); background: #475569;" data-idx="2"></div>
    </div>
</div>
\;

html = html.replace(
    /<input type="range" id="scale-node-bottom"[^>]*>/,
    sliderHtml('node', 'val-node-size-bottom')
);

html = html.replace(
    /<input type="range" id="scale-arrow-bottom"[^>]*>/,
    sliderHtml('arrow', 'val-arrow-size-bottom')
);

html = html.replace(
    /<input type="range" id="rng-network-weight"[^>]*>/,
    sliderHtml('weight', 'txt-network-weight')
);

html = html.replace(
    /<input type="range" id="scale-name-bottom"[^>]*>/,
    sliderHtml('name', 'val-name-size-bottom')
);

// Also change the span default texts to '보통'
html = html.replace(/<span id="val-node-size-bottom"[^>]*>1\.0<\/span>/, '<span id="val-node-size-bottom" style="color:var(--neon-cyan);">보통</span>');
html = html.replace(/<span id="val-arrow-size-bottom"[^>]*>1\.5<\/span>/, '<span id="val-arrow-size-bottom" style="color:var(--neon-cyan);">보통</span>');
html = html.replace(/<span id="txt-network-weight"[^>]*>2\.0px<\/span>/, '<span id="txt-network-weight" style="color:#00d4ff;">보통</span>');
html = html.replace(/<span id="val-name-size-bottom"[^>]*>11<\/span>px/, '<span id="val-name-size-bottom" style="color:var(--neon-cyan);">보통</span>');

fs.writeFileSync('SIGMA_SIM/index.html', html);
console.log('HTML updated');

// 2. Update ui.js
let uiJs = fs.readFileSync('SIGMA_SIM/js/ui.js', 'utf8');
const jsCode = \
window.handleStepSlider = function(e, container, paramType) {
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, x / rect.width));
    
    let step = 0;
    if (ratio < 0.33) step = 0;
    else if (ratio < 0.66) step = 1;
    else step = 2;
    
    window.updateStepSliderUI(container, step);
    
    const labels = ['작게', '보통', '크게'];
    if (paramType === 'node') {
        const vals = [0.5, 1.0, 1.5];
        document.getElementById('val-node-size-bottom').innerText = labels[step];
        if (typeof syncScaleNode === 'function') syncScaleNode(vals[step]);
    } else if (paramType === 'arrow') {
        const vals = [1.0, 1.5, 2.0]; 
        document.getElementById('val-arrow-size-bottom').innerText = labels[step];
        if (typeof syncScaleArrow === 'function') syncScaleArrow(vals[step]);
    } else if (paramType === 'weight') {
        const vals = [1, 2, 4]; 
        document.getElementById('txt-network-weight').innerText = labels[step];
        if (typeof updateNetworkWeight === 'function') updateNetworkWeight(vals[step]);
    } else if (paramType === 'name') {
        const vals = [9, 11, 14]; 
        document.getElementById('val-name-size-bottom').innerText = labels[step];
        if (typeof syncScaleName === 'function') syncScaleName(vals[step]);
    }
};

window.updateStepSliderUI = function(container, step) {
    const fill = container.querySelector('.step-slider-fill');
    const dots = container.querySelectorAll('.step-slider-dot');
    
    if (step === 0) fill.style.width = '0%';
    else if (step === 1) fill.style.width = '50%';
    else fill.style.width = 'calc(100% - 8px)';
    
    dots.forEach((dot, idx) => {
        if (idx <= step) {
            dot.style.background = '#38bdf8';
            if (idx === step) {
                dot.classList.add('active');
            } else {
                dot.classList.remove('active');
            }
        } else {
            dot.style.background = '#475569';
            dot.classList.remove('active');
        }
    });
};
\;

if (!uiJs.includes('handleStepSlider')) {
    uiJs += '\\n' + jsCode;
    fs.writeFileSync('SIGMA_SIM/js/ui.js', uiJs);
    console.log('ui.js updated');
}
