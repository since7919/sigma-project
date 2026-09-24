const fs = require('fs'); let js = fs.readFileSync('../js/phase_diagram_interactive.js', 'utf8');
js = js.replace(/id="ipd-modal"/g, 'id="${this.containerId}-modal"');
js = js.replace(/id="ipd-modal-title"/g, 'id="${this.containerId}-modal-title"');
js = js.replace(/id="ipd-modal-save"/g, 'id="${this.containerId}-modal-save"');
js = js.replace(/id="ipd-modal-clear"/g, 'id="${this.containerId}-modal-clear"');
js = js.replace(/id="ipd-tab-normal"/g, 'id="${this.containerId}-tab-normal"');
js = js.replace(/id="ipd-tab-diag"/g, 'id="${this.containerId}-tab-diag"');
js = js.replace(/id="ipd-tab-scramble"/g, 'id="${this.containerId}-tab-scramble"');
js = js.replace(/id="ipd-content-normal"/g, 'id="${this.containerId}-content-normal"');
js = js.replace(/id="ipd-content-diag"/g, 'id="${this.containerId}-content-diag"');
js = js.replace(/id="ipd-content-scramble"/g, 'id="${this.containerId}-content-scramble"');
js = js.replace(/id="ipd-btn-scramble-all"/g, 'id="${this.containerId}-btn-scramble-all"');

// Fix getElementById calls
js = js.replace(/getElementById\('ipd-modal'\)/g, 'getElementById(this.containerId + -modal)');
js = js.replace(/getElementById\('ipd-modal-title'\)/g, 'getElementById(this.containerId + -modal-title)');
js = js.replace(/getElementById\('ipd-modal-save'\)/g, 'getElementById(this.containerId + -modal-save)');
js = js.replace(/getElementById\('ipd-modal-clear'\)/g, 'getElementById(this.containerId + -modal-clear)');
js = js.replace(/getElementById\('ipd-tab-normal'\)/g, 'getElementById(this.containerId + -tab-normal)');
js = js.replace(/getElementById\('ipd-tab-diag'\)/g, 'getElementById(this.containerId + -tab-diag)');
js = js.replace(/getElementById\('ipd-tab-scramble'\)/g, 'getElementById(this.containerId + -tab-scramble)');
js = js.replace(/getElementById\('ipd-content-normal'\)/g, 'getElementById(this.containerId + -content-normal)');
js = js.replace(/getElementById\('ipd-content-diag'\)/g, 'getElementById(this.containerId + -content-diag)');
js = js.replace(/getElementById\('ipd-content-scramble'\)/g, 'getElementById(this.containerId + -content-scramble)');
js = js.replace(/getElementById\('ipd-btn-scramble-all'\)/g, 'getElementById(this.containerId + -btn-scramble-all)');

fs.writeFileSync('../js/phase_diagram_interactive.js', js);
console.log('Patched');
