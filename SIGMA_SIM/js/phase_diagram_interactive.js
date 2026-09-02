// js/phase_diagram_interactive.js

class InteractivePhaseDiagram {
    constructor(containerId) {
        this.containerId = containerId;
        // Default standard NEMA phase layout
        this.activeMovements = {
            'P1-A': ['WBL'],
            'P2-A': ['SBT', 'SBR', 'PED-W', 'PED-E'],
            'P3-A': ['NBL'],
            'P4-A': ['WBT', 'WBR', 'PED-N', 'PED-S'],
            'P5-A': ['SBL'],
            'P6-A': ['NBT', 'NBR', 'PED-W', 'PED-E'],
            'P7-A': ['EBL'],
            'P8-A': ['EBT', 'EBR', 'PED-N', 'PED-S']
        };
        this.currentEditingCell = null;
        this.init();
    }

    init() {
        const container = document.getElementById(this.containerId);
        if (!container) return;
        
        container.innerHTML = this.getGridHTML() + this.getModalHTML();
        this.attachCellEvents();
        
        // Initial render of all cells to auto-center them
        setTimeout(() => {
            for (let i = 1; i <= 8; i++) {
                this.renderCell('P' + i + '-A');
                this.renderCell('P' + i + '-B');
            }
        }, 100);
    }

    getBaseSVGPaths(prefix) {
        // Returns the 16 standard road-marking paths. 
        // prefix is used for IDs so they don't clash (e.g., 'cell-P1-A', 'modal')
        return `
            <!-- NB (from bottom) -->
            <path class="ipd-arrow ipd-nbl" id="${prefix}-NBL" data-mov="NBL" d="M 56,85 L 56,70 Q 56,60 46,60" />
            <path class="ipd-arrow ipd-nbt" id="${prefix}-NBT" data-mov="NBT" d="M 68,85 L 68,55" />
            <path class="ipd-arrow ipd-dashed ipd-nbr" id="${prefix}-NBR" data-mov="NBR" d="M 80,85 L 80,70 Q 80,60 90,60" />
            
            <!-- SB (from top) -->
            <path class="ipd-arrow ipd-sbl" id="${prefix}-SBL" data-mov="SBL" d="M 44,15 L 44,30 Q 44,40 54,40" />
            <path class="ipd-arrow ipd-sbt" id="${prefix}-SBT" data-mov="SBT" d="M 32,15 L 32,45" />
            <path class="ipd-arrow ipd-dashed ipd-sbr" id="${prefix}-SBR" data-mov="SBR" d="M 20,15 L 20,30 Q 20,40 10,40" />
            
            <!-- EB (from left) -->
            <path class="ipd-arrow ipd-ebl" id="${prefix}-EBL" data-mov="EBL" d="M 15,56 L 30,56 Q 40,56 40,46" />
            <path class="ipd-arrow ipd-ebt" id="${prefix}-EBT" data-mov="EBT" d="M 15,68 L 45,68" />
            <path class="ipd-arrow ipd-dashed ipd-ebr" id="${prefix}-EBR" data-mov="EBR" d="M 15,80 L 30,80 Q 40,80 40,90" />
            
            <!-- WB (from right) -->
            <path class="ipd-arrow ipd-wbl" id="${prefix}-WBL" data-mov="WBL" d="M 85,44 L 70,44 Q 60,44 60,54" />
            <path class="ipd-arrow ipd-wbt" id="${prefix}-WBT" data-mov="WBT" d="M 85,32 L 55,32" />
            <path class="ipd-arrow ipd-dashed ipd-wbr" id="${prefix}-WBR" data-mov="WBR" d="M 85,20 L 70,20 Q 60,20 60,10" />
            
            <!-- Peds -->
            <path class="ipd-arrow ipd-ped ipd-dashed" id="${prefix}-PED-S" data-mov="PED-S" d="M 30,92 L 70,92" />
            <path class="ipd-arrow ipd-ped ipd-dashed" id="${prefix}-PED-N" data-mov="PED-N" d="M 30,8 L 70,8" />
            <path class="ipd-arrow ipd-ped ipd-dashed" id="${prefix}-PED-W" data-mov="PED-W" d="M 8,30 L 8,70" />
            <path class="ipd-arrow ipd-ped ipd-dashed" id="${prefix}-PED-E" data-mov="PED-E" d="M 92,30 L 92,70" />
        `;
    }

    getSVGDefs() {
        return `
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
        `;
    }

    getGridHTML() {
        const cellIds = [];
        for (let i = 1; i <= 8; i++) cellIds.push('P' + i + '-A');
        for (let i = 1; i <= 8; i++) cellIds.push('P' + i + '-B');

        let cellsHtml = '';
        cellIds.forEach((cId, idx) => {
            const isBottomRow = idx >= 8;
            const borderBottom = isBottomRow ? 'border-bottom:none;' : '';
            const borderRight = (idx === 7 || idx === 15) ? 'border-right:none;' : '';
            
            cellsHtml += `
                <div class="ipd-cell" id="cell-${cId}" data-cell="${cId}" style="${borderBottom} ${borderRight}">
                    <div class="ipd-cell-label">${cId}</div>
                    <svg class="ipd-svg" id="svg-${cId}" width="100%" height="100%" viewBox="0 0 100 100">
                        ${this.getBaseSVGPaths('cell-' + cId)}
                    </svg>
                </div>
            `;
        });

        return `
        <div class="interactive-phase-diagram" style="background:#fff; border:1px solid #ccc; width:100%; max-width:100%; margin: 0 auto; user-select:none; font-family:sans-serif; overflow-x: auto;">
            <style>
                .ipd-grid { display: grid; grid-template-columns: repeat(8, 1fr); grid-template-rows: repeat(2, minmax(80px, 110px)); background: #fff; width: 100%; }
                .ipd-cell { position: relative; border-bottom: 1px solid #ccc; border-right: 1px solid #ccc; background:#fff; cursor:pointer; transition: background 0.1s; }
                .ipd-cell:hover { background: #f8fafc; }
                .ipd-cell-label { position: absolute; top: 4px; left: 6px; font-weight: bold; color: #888; font-size: 13px; z-index:2; }
                
                .ipd-arrow { 
                    fill: none; 
                    stroke: #e5e7eb; 
                    stroke-width: 4.5; 
                    transition: all 0.2s; 
                }
                
                .ipd-dashed { stroke-dasharray: 5 4; }
                
                /* Cell internal active styles (hide inactive for centering) */
                .ipd-cell .ipd-arrow { display: none; }
                .ipd-cell .ipd-arrow.ipd-active { display: block; stroke: #0ea5e9; }
                
                /* Modal active styles (show inactive as gray, active as blue) */
                .ipd-modal-svg .ipd-arrow { display: block; stroke: #e5e7eb; cursor: pointer; }
                .ipd-modal-svg .ipd-arrow:hover { stroke: #cbd5e1; }
                .ipd-modal-svg .ipd-arrow.ipd-active { stroke: #0ea5e9; }
                .ipd-modal-svg .ipd-arrow.ipd-active:hover { stroke: #0284c7; }
                
                /* Legend */
                .ipd-legend { display: flex; flex-direction: row; flex-wrap: wrap; gap: 16px; padding: 10px 15px; background: #fff; border-top: 1px solid #ccc; font-size: 12px; color: #555; font-weight: bold;}
                .ipd-legend-item { display: flex; align-items: center; gap: 6px; }
            </style>

            ${this.getSVGDefs()}

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
                    * 팁: 현시 칸을 클릭하여 팔레트(Popup)에서 포함할 방향을 편집하세요.
                </div>
            </div>
        </div>
        `;
    }

    getModalHTML() {
        return `
        <div id="ipd-modal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.7); z-index:9999; align-items:center; justify-content:center;">
            <div style="background:#252526; padding:20px; border-radius:8px; border:1px solid #3e3e42; color:#fff; width: 450px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
                <h3 style="margin-top:0; border-bottom:1px solid #3e3e42; padding-bottom:10px; display:flex; justify-content:space-between; font-size:15px;">
                    <span>🎨 방향 선택 팔레트 - <span id="ipd-modal-title" style="color:#38bdf8;"></span></span>
                    <button onclick="document.getElementById('ipd-modal').style.display='none'" style="background:none; border:none; color:#888; cursor:pointer; font-size:16px;">&times;</button>
                </h3>
                <div style="text-align:center; font-size:12px; color:#aaa; margin-bottom:15px;">
                    원하는 이동류(직진, 좌회전 등)와 보행자를 클릭하여 켜고 끄세요.
                </div>
                <div style="width:300px; height:300px; margin: 0 auto; background:#fff; border-radius:4px; border:1px solid #ccc;">
                    <svg class="ipd-modal-svg" id="ipd-modal-svg" width="100%" height="100%" viewBox="0 0 100 100">
                        ${this.getBaseSVGPaths('modal')}
                    </svg>
                </div>
                <div style="margin-top:20px; display:flex; justify-content:flex-end; gap:8px;">
                    <button onclick="document.getElementById('ipd-modal').style.display='none'" class="phase-action-btn phase-btn-gray">취소</button>
                    <button id="ipd-modal-clear" class="phase-action-btn phase-btn-red">초기화</button>
                    <button id="ipd-modal-save" class="phase-action-btn phase-btn-cyan">적용하기</button>
                </div>
            </div>
        </div>
        `;
    }

    attachCellEvents() {
        const container = document.getElementById(this.containerId);
        const cells = container.querySelectorAll('.ipd-cell');
        
        cells.forEach(cell => {
            cell.addEventListener('click', () => {
                const cellId = cell.getAttribute('data-cell');
                this.openModal(cellId);
            });
        });

        // Modal clear
        document.getElementById('ipd-modal-clear').addEventListener('click', () => {
            const modalSvg = document.getElementById('ipd-modal-svg');
            const arrows = modalSvg.querySelectorAll('.ipd-arrow');
            arrows.forEach(arrow => {
                arrow.classList.remove('ipd-active');
                this.updateArrowMarker(arrow);
            });
        });

        // Modal save
        document.getElementById('ipd-modal-save').addEventListener('click', () => {
            const modalSvg = document.getElementById('ipd-modal-svg');
            const arrows = modalSvg.querySelectorAll('.ipd-arrow');
            const selected = [];
            arrows.forEach(arrow => {
                if (arrow.classList.contains('ipd-active')) {
                    selected.push(arrow.getAttribute('data-mov'));
                }
            });
            this.activeMovements[this.currentEditingCell] = selected;
            this.renderCell(this.currentEditingCell);
            document.getElementById('ipd-modal').style.display = 'none';
        });

        // Modal arrow clicks
        const modalSvg = document.getElementById('ipd-modal-svg');
        const modalArrows = modalSvg.querySelectorAll('.ipd-arrow');
        modalArrows.forEach(arrow => {
            arrow.addEventListener('click', () => {
                arrow.classList.toggle('ipd-active');
                this.updateArrowMarker(arrow);
            });
        });
    }

    openModal(cellId) {
        this.currentEditingCell = cellId;
        document.getElementById('ipd-modal-title').innerText = cellId;
        
        const activeMovs = this.activeMovements[cellId] || [];
        const modalSvg = document.getElementById('ipd-modal-svg');
        const arrows = modalSvg.querySelectorAll('.ipd-arrow');
        
        arrows.forEach(arrow => {
            const mov = arrow.getAttribute('data-mov');
            if (activeMovs.includes(mov)) {
                arrow.classList.add('ipd-active');
            } else {
                arrow.classList.remove('ipd-active');
            }
            this.updateArrowMarker(arrow);
        });

        document.getElementById('ipd-modal').style.display = 'flex';
    }

    renderCell(cellId) {
        const svg = document.getElementById('svg-' + cellId);
        if (!svg) return;
        
        const activeMovs = this.activeMovements[cellId] || [];
        const arrows = svg.querySelectorAll('.ipd-arrow');
        
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        let hasActive = false;

        arrows.forEach(arrow => {
            const mov = arrow.getAttribute('data-mov');
            if (activeMovs.includes(mov)) {
                arrow.classList.add('ipd-active');
                this.updateArrowMarker(arrow);
                
                // Calculate bounding box for auto-centering
                // Note: getBBox ignores markers, so we add healthy padding later
                try {
                    const bbox = arrow.getBBox();
                    if (bbox && bbox.width > 0) {
                        minX = Math.min(minX, bbox.x);
                        minY = Math.min(minY, bbox.y);
                        maxX = Math.max(maxX, bbox.x + bbox.width);
                        maxY = Math.max(maxY, bbox.y + bbox.height);
                        hasActive = true;
                    }
                } catch(e) {}
            } else {
                arrow.classList.remove('ipd-active');
            }
        });

        // Apply auto-centering viewBox
        if (hasActive) {
            const pad = 15; // healthy padding for arrowheads
            minX -= pad;
            minY -= pad;
            const w = (maxX - minX) + 2*pad;
            const h = (maxY - minY) + 2*pad;
            
            // Keep it somewhat square to prevent extreme stretching
            const size = Math.max(w, h, 35);
            const cx = minX + w/2;
            const cy = minY + h/2;
            
            svg.setAttribute('viewBox', `${cx - size/2} ${cy - size/2} ${size} ${size}`);
        } else {
            // Empty cell, reset viewBox
            svg.setAttribute('viewBox', '0 0 100 100');
        }
    }

    updateArrowMarker(arrow) {
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
