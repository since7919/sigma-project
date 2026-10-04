const fs = require('fs');
let c = fs.readFileSync('SIGMA_SIM/js/tsd.js', 'utf8');

const tooltipInit = `        window.addEventListener('resize', () => this.render());

        // 툴팁 초기화
        this.tooltip = document.createElement('div');
        this.tooltip.style.position = 'absolute';
        this.tooltip.style.pointerEvents = 'none';
        this.tooltip.style.backgroundColor = 'rgba(20, 20, 20, 0.9)';
        this.tooltip.style.color = '#fff';
        this.tooltip.style.padding = '8px 12px';
        this.tooltip.style.borderRadius = '6px';
        this.tooltip.style.fontSize = '12px';
        this.tooltip.style.fontFamily = this.config.font.base;
        this.tooltip.style.zIndex = '9999';
        this.tooltip.style.display = 'none';
        this.tooltip.style.boxShadow = '0 4px 6px rgba(0,0,0,0.5)';
        this.tooltip.style.border = '1px solid rgba(255,255,255,0.1)';
        document.body.appendChild(this.tooltip);`;

c = c.replace(/window\.addEventListener\('resize', \(\) => this\.render\(\)\);/, tooltipInit);

fs.writeFileSync('SIGMA_SIM/js/tsd.js', c, 'utf8');
console.log("Tooltip element injected.");
