const fs = require('fs');
let c = fs.readFileSync('SIGMA_SIM/js/ui.js', 'utf8');

const regexEnter = /case CONFIG\.APP_MODE\.MAP_EDIT:\s*STATE\.isMapEditMode = true;\s*this\.refreshAllJunctions\(\);\s*break;/;

const newEnter = `case CONFIG.APP_MODE.MAP_EDIT:
                STATE.isMapEditMode = true;
                this.refreshAllJunctions();
                const movContainer = document.getElementById('info-mov-combined-container');
                if (movContainer) movContainer.style.display = 'block';
                if (typeof renderRingTables === 'function' && STATE.activeJid) renderRingTables();
                break;`;

c = c.replace(regexEnter, newEnter);

const regexExit = /case CONFIG\.APP_MODE\.MAP_EDIT:\s*STATE\.isMapEditMode = false;\s*STATE\.focusedArrow = null;\s*this\.refreshAllJunctions\(\);\s*break;/;

const newExit = `case CONFIG.APP_MODE.MAP_EDIT:
                STATE.isMapEditMode = false;
                STATE.focusedArrow = null;
                this.refreshAllJunctions();
                const movContainerExit = document.getElementById('info-mov-combined-container');
                if (movContainerExit) movContainerExit.style.display = 'none';
                break;`;

c = c.replace(regexExit, newExit);

fs.writeFileSync('SIGMA_SIM/js/ui.js', c, 'utf8');
