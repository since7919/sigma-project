// js/phase_diagram_interactive.js

class InteractivePhaseDiagram {
    constructor(containerId) {
        this.containerId = containerId;
        this.activeMovements = {};
        this.init();
    }

    init() {
        const container = document.getElementById(this.containerId);
        if (!container) return;
        
        container.innerHTML = this.getHTML();
        this.attachEvents();
    }

    getHTML() {
        // Base SVG for all 16 movements (styled as road surface markings)
        const baseArrows = `
            <!-- NB (from bottom) -->
            <path class="ipd-arrow ipd-nbl" id="NBL" d="M 56,85 L 56,70 Q 56,60 46,60" marker-end="url(#ah-gray)" />
            <path class="ipd-arrow ipd-nbt" id="NBT" d="M 68,85 L 68,55" marker-end="url(#ah-gray)" />
            <path class="ipd-arrow ipd-dashed ipd-nbr" id="NBR" d="M 80,85 L 80,70 Q 80,60 90,60" marker-end="url(#ah-gray)" />
            
            <!-- SB (from top) -->
            <path class="ipd-arrow ipd-sbl" id="SBL" d="M 44,15 L 44,30 Q 44,40 54,40" marker-end="url(#ah-gray)" />
            <path class="ipd-arrow ipd-sbt" id="SBT" d="M 32,15 L 32,45" marker-end="url(#ah-gray)" />
            <path class="ipd-arrow ipd-dashed ipd-sbr" id="SBR" d="M 20,15 L 20,30 Q 20,40 10,40" marker-end="url(#ah-gray)" />
            
            <!-- EB (from left) -->
            <path class="ipd-arrow ipd-ebl" id="EBL" d="M 15,56 L 30,56 Q 40,56 40,46" marker-end="url(#ah-gray)" />
            <path class="ipd-arrow ipd-ebt" id="EBT" d="M 15,68 L 45,68" marker-end="url(#ah-gray)" />
            <path class="ipd-arrow ipd-dashed ipd-ebr" id="EBR" d="M 15,80 L 30,80 Q 40,80 40,90" marker-end="url(#ah-gray)" />
            
            <!-- WB (from right) -->
            <path class="ipd-arrow ipd-wbl" id="WBL" d="M 85,44 L 70,44 Q 60,44 60,54" marker-end="url(#ah-gray)" />
            <path class="ipd-arrow ipd-wbt" id="WBT" d="M 85,32 L 55,32" marker-end="url(#ah-gray)" />
            <path class="ipd-arrow ipd-dashed ipd-wbr" id="WBR" d="M 85,20 L 70,20 Q 60,20 60,10" marker-end="url(#ah-gray)" />
            
            <!-- Peds -->
            <path class="ipd-arrow ipd-ped ipd-dashed" id="PED-S" d="M 30,92 L 70,92" marker-start="url(#ah-gray-rev)" marker-end="url(#ah-gray)" />
            <path class="ipd-arrow ipd-ped ipd-dashed" id="PED-N" d="M 30,8 L 70,8" marker-start="url(#ah-gray-rev)" marker-end="url(#ah-gray)" />
            <path class="ipd-arrow ipd-ped ipd-dashed" id="PED-W" d="M 8,30 L 8,70" marker-start="url(#ah-gray-rev)" marker-end="url(#ah-gray)" />
            <path class="ipd-arrow ipd-ped ipd-dashed" id="PED-E" d="M 92,30 L 92,70" marker-start="url(#ah-gray-rev)" marker-end="url(#ah-gray)" />
        `;

        // 16 Cells: A-Ring (P1~P8), B-Ring (P1~P8)
        const cellIds = [];
        for (let i = 1; i <= 8; i++) cellIds.push('P' + i + '-A');
        for (let i = 1; i <= 8; i++) cellIds.push('P' + i + '-B');

        let cellsHtml = '';
        cellIds.forEach((cId, idx) => {
            let cellSvg = baseArrows.replace(/id="(.*?)"/g, `id="arr-${cId}-$1"`);
            
            const isBottomRow = idx >= 8;
            const borderBottom = isBottomRow ? 'border-bottom:none;' : '';
            const borderRight = (idx === 7 || idx === 15) ? 'border-right:none;' : '';
            
            cellsHtml += `
                <div class="ipd-cell" style="${borderBottom} ${borderRight}">
                    <div class="ipd-cell-label">${cId}</div>
                    <svg width="100%" height="100%" viewBox="0 0 100 100">
                        ${cellSvg}
                    </svg>
                </div>
            `;
        });

        return `
        <div class="interactive-phase-diagram" style="background:#fff; border:1px solid #ccc; width:100%; max-width:100%; margin: 0 auto; user-select:none; font-family:sans-serif; overflow-x: auto;">
            <style>
                .ipd-grid { display: grid; grid-template-columns: repeat(8, minmax(120px, 1fr)); grid-template-rows: repeat(2, 120px); background: #fff; min-width: 960px; }
                .ipd-cell { position: relative; border-bottom: 1px solid #ccc; border-right: 1px solid #ccc; background:#fff; }
                .ipd-cell-label { position: absolute; top: 4px; left: 6px; font-weight: bold; color: #888; font-size: 13px; }
                
                .ipd-arrow { 
                    fill: none; 
                    stroke: #e5e7eb; 
                    stroke-width: 4.5; 
                    cursor: pointer; 
                    transition: all 0.2s; 
                }
                .ipd-arrow:hover { stroke: #cbd5e1; }
                
                .ipd-dashed { stroke-dasharray: 5 4; }
                
                /* Active state styles */
                .ipd-arrow.ipd-active { stroke: #0ea5e9; }
                .ipd-arrow.ipd-active:hover { stroke: #0284c7; }
                
                /* Legend */
                .ipd-legend { display: flex; flex-direction: row; flex-wrap: wrap; gap: 16px; padding: 12px 15px; background: #fff; border-top: 1px solid #ccc; font-size: 12px; color: #555; font-weight: bold;}
                .ipd-legend-item { display: flex; align-items: center; gap: 6px; }
            </style>

            <svg width="0" height="0" style="position:absolute;">
                <defs>
                    <marker id="ah-gray" markerWidth="3" markerHeight="3" refX="1.5" refY="1.5" orient="auto">
                        <polygon points="0 0, 3 1.5, 0 3" fill="#e5e7eb" />
                    </marker>
                    <marker id="ah-blue" markerWidth="3" markerHeight="3" refX="1.5" refY="1.5" orient="auto">
                        <polygon points="0 0, 3 1.5, 0 3" fill="#0ea5e9" />
                    </marker>
                    <marker id="ah-gray-rev" markerWidth="3" markerHeight="3" refX="1.5" refY="1.5" orient="auto">
                        <polygon points="3 0, 0 1.5, 3 3" fill="#e5e7eb" />
                    </marker>
                    <marker id="ah-blue-rev" markerWidth="3" markerHeight="3" refX="1.5" refY="1.5" orient="auto">
                        <polygon points="3 0, 0 1.5, 3 3" fill="#0ea5e9" />
                    </marker>
                </defs>
            </svg>

            <div class="ipd-grid">
                ${cellsHtml}
            </div>
            
            <div class="ipd-legend">
                <div class="ipd-legend-item">
                    <svg width="30" height="10"><path d="M0,5 L30,5" stroke="#0ea5e9" stroke-width="4.5" marker-end="url(#ah-blue)"/></svg>
                    <span>Protected (직진/좌회전)</span>
                </div>
                <div class="ipd-legend-item">
                    <svg width="30" height="10"><path d="M0,5 L30,5" stroke="#0ea5e9" stroke-width="4.5" stroke-dasharray="5 4" marker-end="url(#ah-blue)"/></svg>
                    <span>Permissive (비보호/우회전)</span>
                </div>
                <div class="ipd-legend-item">
                    <svg width="30" height="10"><path d="M5,5 L25,5" stroke="#0ea5e9" stroke-width="4.5" stroke-dasharray="5 4" marker-start="url(#ah-blue-rev)" marker-end="url(#ah-blue)"/></svg>
                    <span>Pedestrian (보행자)</span>
                </div>
                <div style="font-size:11px; color:#888; font-weight:normal; margin-left: auto; display: flex; align-items: center;">
                    * 팁: 회색 노면표시를 클릭하면 파란색으로 활성화되며 해당 현시에 배정됩니다. 다시 클릭하면 해제됩니다.
                </div>
            </div>
        </div>
        `;
    }

    attachEvents() {
        const container = document.getElementById(this.containerId);
        const arrows = container.querySelectorAll('.ipd-arrow');
        
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
