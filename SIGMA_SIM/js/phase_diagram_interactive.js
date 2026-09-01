// js/phase_diagram_interactive.js

class InteractivePhaseDiagram {
    constructor(containerId) {
        this.containerId = containerId;
        this.activeMovements = {}; // { phaseIndex: Set(arrowId) }
        this.init();
    }

    init() {
        const container = document.getElementById(this.containerId);
        if (!container) return;
        
        container.innerHTML = this.getHTML();
        this.attachEvents();
    }

    getHTML() {
        // Base SVG for all 16 movements
        const baseArrows = `
            <!-- N (from bottom) -->
            <path class="ipd-arrow ipd-nbl" id="NBL" d="M 55,90 Q 55,45 10,45" marker-end="url(#ah-gray)" />
            <path class="ipd-arrow ipd-nbt" id="NBT" d="M 65,90 L 65,10" marker-end="url(#ah-gray)" />
            <path class="ipd-arrow ipd-dashed ipd-nbr" id="NBR" d="M 65,90 Q 65,65 90,65" marker-end="url(#ah-gray)" />
            
            <!-- S (from top) -->
            <path class="ipd-arrow ipd-sbl" id="SBL" d="M 45,10 Q 45,55 90,55" marker-end="url(#ah-gray)" />
            <path class="ipd-arrow ipd-sbt" id="SBT" d="M 35,10 L 35,90" marker-end="url(#ah-gray)" />
            <path class="ipd-arrow ipd-dashed ipd-sbr" id="SBR" d="M 35,10 Q 35,35 10,35" marker-end="url(#ah-gray)" />
            
            <!-- E (from right) -->
            <path class="ipd-arrow ipd-wbl" id="WBL" d="M 90,45 Q 45,45 45,90" marker-end="url(#ah-gray)" />
            <path class="ipd-arrow ipd-wbt" id="WBT" d="M 90,35 L 10,35" marker-end="url(#ah-gray)" />
            <path class="ipd-arrow ipd-dashed ipd-wbr" id="WBR" d="M 90,35 Q 65,35 65,10" marker-end="url(#ah-gray)" />
            
            <!-- W (from left) -->
            <path class="ipd-arrow ipd-ebl" id="EBL" d="M 10,55 Q 55,55 55,10" marker-end="url(#ah-gray)" />
            <path class="ipd-arrow ipd-ebt" id="EBT" d="M 10,65 L 90,65" marker-end="url(#ah-gray)" />
            <path class="ipd-arrow ipd-dashed ipd-ebr" id="EBR" d="M 10,65 Q 35,65 35,90" marker-end="url(#ah-gray)" />
            
            <!-- Peds -->
            <path class="ipd-arrow ipd-ped ipd-dashed" id="PED-S" d="M 20,80 L 80,80" marker-start="url(#ah-gray-rev)" marker-end="url(#ah-gray)" />
            <path class="ipd-arrow ipd-ped ipd-dashed" id="PED-N" d="M 20,20 L 80,20" marker-start="url(#ah-gray-rev)" marker-end="url(#ah-gray)" />
            <path class="ipd-arrow ipd-ped ipd-dashed" id="PED-W" d="M 20,20 L 20,80" marker-start="url(#ah-gray-rev)" marker-end="url(#ah-gray)" />
            <path class="ipd-arrow ipd-ped ipd-dashed" id="PED-E" d="M 80,20 L 80,80" marker-start="url(#ah-gray-rev)" marker-end="url(#ah-gray)" />
        `;

        // Pre-fill standard NEMA for visual cue if wanted, but user asked to toggle on/off. 
        // We'll leave them all gray initially, or preset them. Let's preset them as per NEMA standard so the user doesn't face a blank sheet.
        const presets = {
            1: ['WBL'],
            2: ['SBT', 'SBR', 'PED-W', 'PED-E'],
            3: ['NBL'],
            4: ['WBT', 'WBR', 'PED-N', 'PED-S'],
            5: ['SBL'],
            6: ['NBT', 'NBR', 'PED-W', 'PED-E'],
            7: ['EBL'],
            8: ['EBT', 'EBR', 'PED-N', 'PED-S']
        };

        let cellsHtml = '';
        for (let i = 1; i <= 8; i++) {
            // Generate unique IDs for each cell's arrows
            let cellSvg = baseArrows.replace(/id="(.*?)"/g, `id="arr-${i}-$1"`);
            
            // Apply presets
            if (presets[i]) {
                presets[i].forEach(mov => {
                    cellSvg = cellSvg.replace(`id="arr-${i}-${mov}"`, `id="arr-${i}-${mov}" class="ipd-arrow ipd-preset ipd-active"`);
                });
            }

            // Fix the dashed class persistence logic in replace
            cellSvg = cellSvg.replace(/class="ipd-arrow( ipd-[^"]*)? ipd-preset ipd-active"/g, `class="ipd-arrow$1 ipd-active"`);

            const isBottomRow = i >= 5;
            const borderBottom = isBottomRow ? 'border-bottom:none;' : '';
            const borderRight = (i === 4 || i === 8) ? 'border-right:none;' : '';
            
            cellsHtml += `
                <div class="ipd-cell" style="${borderBottom} ${borderRight}">
                    <div class="ipd-cell-label">Ø${i}</div>
                    <svg width="100%" height="100%" viewBox="0 0 100 100">
                        ${cellSvg}
                    </svg>
                </div>
            `;
            
            if (i === 2 || i === 6) {
                cellsHtml += `<div class="ipd-barrier" style="${borderBottom}"></div>`;
            }
        }

        return `
        <div class="interactive-phase-diagram" style="background:#fff; border:1px solid #ccc; width:100%; max-width:800px; margin: 0 auto; user-select:none; font-family:sans-serif;">
            <style>
                .ipd-grid { display: grid; grid-template-columns: 1fr 1fr 8px 1fr 1fr; grid-template-rows: 150px 150px; background: #fff; }
                .ipd-cell { position: relative; border-bottom: 1px solid #ccc; border-right: 1px solid #ccc; background:#fff; }
                .ipd-cell-label { position: absolute; top: 8px; left: 8px; font-weight: bold; color: #888; font-size: 16px; }
                .ipd-barrier { background: #fdf5d3; border-left: 2px solid #aaa; border-right: 2px solid #aaa; }
                
                .ipd-arrow { 
                    fill: none; 
                    stroke: #e5e7eb; /* faint gray */
                    stroke-width: 3.5; 
                    cursor: pointer; 
                    transition: all 0.2s; 
                }
                .ipd-arrow:hover { stroke: #cbd5e1; }
                
                .ipd-dashed { stroke-dasharray: 4 3; }
                
                /* Active state styles */
                .ipd-arrow.ipd-active { stroke: #0ea5e9; }
                .ipd-arrow.ipd-active:hover { stroke: #0284c7; }
                
                /* Legend */
                .ipd-legend { display: flex; flex-direction: column; gap: 8px; padding: 15px; background: #fff; border-top: 1px solid #ccc; font-size: 13px; color: #555; font-weight: bold;}
                .ipd-legend-item { display: flex; align-items: center; gap: 10px; }
            </style>

            <!-- SVG Defs for arrowheads -->
            <svg width="0" height="0" style="position:absolute;">
                <defs>
                    <!-- Marker sizing relative to stroke-width, made smaller for sleekness -->
                    <marker id="ah-gray" markerWidth="2.5" markerHeight="2.5" refX="2" refY="1.25" orient="auto">
                        <polygon points="0 0, 2.5 1.25, 0 2.5" fill="#e5e7eb" />
                    </marker>
                    <marker id="ah-blue" markerWidth="2.5" markerHeight="2.5" refX="2" refY="1.25" orient="auto">
                        <polygon points="0 0, 2.5 1.25, 0 2.5" fill="#0ea5e9" />
                    </marker>
                    <marker id="ah-gray-rev" markerWidth="2.5" markerHeight="2.5" refX="0.5" refY="1.25" orient="auto">
                        <polygon points="2.5 0, 0 1.25, 2.5 2.5" fill="#e5e7eb" />
                    </marker>
                    <marker id="ah-blue-rev" markerWidth="2.5" markerHeight="2.5" refX="0.5" refY="1.25" orient="auto">
                        <polygon points="2.5 0, 0 1.25, 2.5 2.5" fill="#0ea5e9" />
                    </marker>
                </defs>
            </svg>

            <div class="ipd-grid">
                ${cellsHtml}
            </div>
            
            <div class="ipd-legend">
                <div class="ipd-legend-item">
                    <svg width="40" height="10"><path d="M0,5 L30,5" stroke="#0ea5e9" stroke-width="3.5" marker-end="url(#ah-blue)"/></svg>
                    <span>Protected Phase (직진/좌회전)</span>
                </div>
                <div class="ipd-legend-item">
                    <svg width="40" height="10"><path d="M0,5 L30,5" stroke="#0ea5e9" stroke-width="3.5" stroke-dasharray="4 3" marker-end="url(#ah-blue)"/></svg>
                    <span>Permissive Phase (비보호/우회전)</span>
                </div>
                <div class="ipd-legend-item">
                    <svg width="40" height="10"><path d="M5,5 L35,5" stroke="#0ea5e9" stroke-width="3.5" stroke-dasharray="4 3" marker-start="url(#ah-blue-rev)" marker-end="url(#ah-blue)"/></svg>
                    <span>Pedestrian Phase (보행자)</span>
                </div>
                <div style="font-size:11px; color:#888; font-weight:normal; margin-top:5px;">
                    * 팁: 회색 실선을 클릭하면 파란색으로 활성화되며 해당 현시에 배정됩니다. 다시 클릭하면 해제됩니다.
                </div>
            </div>
        </div>
        `;
    }

    attachEvents() {
        const container = document.getElementById(this.containerId);
        const arrows = container.querySelectorAll('.ipd-arrow');
        
        // Ensure initial markers are set correctly based on active class
        arrows.forEach(arrow => {
            this.updateMarkers(arrow);
            
            arrow.addEventListener('click', (e) => {
                if (arrow.classList.contains('ipd-active')) {
                    arrow.classList.remove('ipd-active');
                } else {
                    arrow.classList.add('ipd-active');
                }
                this.updateMarkers(arrow);
            });
        });
    }

    updateMarkers(arrow) {
        const isActive = arrow.classList.contains('ipd-active');
        const color = isActive ? 'blue' : 'gray';
        
        if (arrow.classList.contains('ipd-ped')) {
            arrow.setAttribute('marker-start', `url(#ah-${color}-rev)`);
            arrow.setAttribute('marker-end', `url(#ah-${color})`);
        } else {
            arrow.setAttribute('marker-end', `url(#ah-${color})`);
        }
    }
}

window.InteractivePhaseDiagram = InteractivePhaseDiagram;
