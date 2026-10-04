const fs = require('fs');
let c = fs.readFileSync('SIGMA_SIM/js/tsd.js', 'utf8');

const regexArrow = /if \(segW > 14\) this\.drawPhaseArrow\(xS \+ segW \/ 2, yPos \+ ringH \/ 2, curMov\);/;
const replaceArrow = `// if (segW > 14) this.drawPhaseArrow(xS + segW / 2, yPos + ringH / 2, curMov); // Removed text for cleaner UI
                    
                    // 툴팁용 hit region 등록
                    const dX = Math.max(cfg.padding.left, xS);
                    const dW = Math.min(cfg.padding.left + chartW, xE) - dX;
                    if (dW > 0 && this.state.hitRegions) {
                        this.state.hitRegions.push({
                            x: dX, y: yPos, w: dW, h: ringH,
                            mov: curMov, split: splitTime, green: greenTime, yellow: yellowTime
                        });
                    }`;

c = c.replace(regexArrow, replaceArrow);

fs.writeFileSync('SIGMA_SIM/js/tsd.js', c, 'utf8');
console.log("hitRegions populated in drawRing.");
