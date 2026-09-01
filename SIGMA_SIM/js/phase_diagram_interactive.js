// js/phase_diagram_interactive.js

class InteractivePhaseDiagram {
    constructor(containerId) {
        this.containerId = containerId;
        this.movements = {}; // tracking selected movements: { arrowId: sequenceNumber }
        this.nextNumber = 1;
        this.init();
    }

    init() {
        const container = document.getElementById(this.containerId);
        if (!container) return;
        
        container.innerHTML = this.getHTML();
        this.attachEvents();
    }

    getHTML() {
        return `
        <div class="interactive-phase-diagram" style="background:#fff; border:1px solid #ccc; width:100%; max-width:800px; margin: 0 auto; user-select:none;">
            <style>
                .ipd-grid { display: grid; grid-template-columns: 1fr 1fr 8px 1fr 1fr 8px; grid-template-rows: 140px 140px; background: #fff; }
                .ipd-cell { position: relative; border-bottom: 1px solid #ccc; border-right: 1px solid #ccc; background:#fff; }
                .ipd-cell-label { position: absolute; top: 8px; left: 8px; font-weight: bold; color: #888; font-size: 16px; font-family: sans-serif; }
                .ipd-barrier { background: #fdf5d3; border-left: 2px solid #aaa; border-right: 2px solid #aaa; }
                .ipd-arrow { cursor: pointer; transition: all 0.2s; stroke: #ccc; fill: transparent; }
                .ipd-arrow-head { fill: #ccc; transition: all 0.2s; }
                .ipd-arrow-dashed { stroke-dasharray: 6 4; }
                
                /* Active state styles */
                .ipd-arrow.active { stroke: #0088cc; }
                .ipd-arrow-head.active { fill: #0088cc; }
                
                .ipd-badge {
                    position: absolute;
                    background: #ff4757;
                    color: white;
                    font-size: 12px;
                    font-weight: bold;
                    border-radius: 50%;
                    width: 20px;
                    height: 20px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    pointer-events: none;
                    transform: translate(-50%, -50%);
                    box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                    z-index: 10;
                    opacity: 0;
                    transition: opacity 0.2s;
                }
                .ipd-badge.visible { opacity: 1; }
                
                /* Legend */
                .ipd-legend { display: flex; flex-direction: column; gap: 8px; padding: 15px; background: #fff; border-top: 1px solid #ccc; font-family: sans-serif; font-size: 13px; color: #555; font-weight: bold;}
                .ipd-legend-item { display: flex; align-items: center; gap: 10px; }
            </style>

            <!-- SVG Defs for arrowheads -->
            <svg width="0" height="0" style="position:absolute;">
                <defs>
                    <marker id="arrowhead-gray" markerWidth="6" markerHeight="6" refX="4" refY="3" orient="auto">
                        <polygon points="0 0, 6 3, 0 6" fill="#ccc" class="ipd-arrow-head" />
                    </marker>
                    <marker id="arrowhead-blue" markerWidth="6" markerHeight="6" refX="4" refY="3" orient="auto">
                        <polygon points="0 0, 6 3, 0 6" fill="#0088cc" />
                    </marker>
                    <marker id="arrowhead-gray-rev" markerWidth="6" markerHeight="6" refX="2" refY="3" orient="auto">
                        <polygon points="6 0, 0 3, 6 6" fill="#ccc" class="ipd-arrow-head" />
                    </marker>
                    <marker id="arrowhead-blue-rev" markerWidth="6" markerHeight="6" refX="2" refY="3" orient="auto">
                        <polygon points="6 0, 0 3, 6 6" fill="#0088cc" />
                    </marker>
                </defs>
            </svg>

            <div class="ipd-grid">
                <!-- ROW 1 -->
                <div class="ipd-cell">
                    <div class="ipd-cell-label">Ø1</div>
                    <svg width="100%" height="100%">
                        <!-- WBL: from right to down -->
                        <path class="ipd-arrow" id="arr-1-1" d="M 80,40 Q 50,40 50,80" stroke-width="8" marker-end="url(#arrowhead-gray)" />
                    </svg>
                    <div class="ipd-badge" id="badge-arr-1-1" style="left:65px; top:60px;"></div>
                </div>
                <div class="ipd-cell">
                    <div class="ipd-cell-label">Ø2</div>
                    <svg width="100%" height="100%">
                        <!-- SBT: from top to down -->
                        <path class="ipd-arrow" id="arr-2-1" d="M 60,20 L 60,90" stroke-width="8" marker-end="url(#arrowhead-gray)" />
                        <!-- SBR: from top to left (dashed) -->
                        <path class="ipd-arrow ipd-arrow-dashed" id="arr-2-2" d="M 80,20 Q 80,50 40,50" stroke-width="4" marker-end="url(#arrowhead-gray)" />
                        <!-- Ped: vertical dashed double -->
                        <path class="ipd-arrow ipd-arrow-dashed" id="arr-2-3" d="M 20,30 L 20,80" stroke-width="3" marker-start="url(#arrowhead-gray-rev)" marker-end="url(#arrowhead-gray)" />
                    </svg>
                    <div class="ipd-badge" id="badge-arr-2-1" style="left:60px; top:55px;"></div>
                    <div class="ipd-badge" id="badge-arr-2-2" style="left:60px; top:35px;"></div>
                    <div class="ipd-badge" id="badge-arr-2-3" style="left:20px; top:55px;"></div>
                </div>
                
                <div class="ipd-barrier"></div>
                
                <div class="ipd-cell">
                    <div class="ipd-cell-label">Ø3</div>
                    <svg width="100%" height="100%">
                        <!-- NBL: from bottom to right -->
                        <path class="ipd-arrow" id="arr-3-1" d="M 40,90 Q 40,60 80,60" stroke-width="8" marker-end="url(#arrowhead-gray)" />
                    </svg>
                    <div class="ipd-badge" id="badge-arr-3-1" style="left:60px; top:75px;"></div>
                </div>
                <div class="ipd-cell">
                    <div class="ipd-cell-label">Ø4</div>
                    <svg width="100%" height="100%">
                        <!-- WBT: from right to left -->
                        <path class="ipd-arrow" id="arr-4-1" d="M 80,70 L 20,70" stroke-width="8" marker-end="url(#arrowhead-gray)" />
                        <!-- WBR: from right to up (dashed) -->
                        <path class="ipd-arrow ipd-arrow-dashed" id="arr-4-2" d="M 80,50 Q 50,50 50,20" stroke-width="4" marker-end="url(#arrowhead-gray)" />
                        <!-- Ped: horizontal dashed double -->
                        <path class="ipd-arrow ipd-arrow-dashed" id="arr-4-3" d="M 30,20 L 70,20" stroke-width="3" marker-start="url(#arrowhead-gray-rev)" marker-end="url(#arrowhead-gray)" />
                    </svg>
                    <div class="ipd-badge" id="badge-arr-4-1" style="left:50px; top:70px;"></div>
                    <div class="ipd-badge" id="badge-arr-4-2" style="left:65px; top:35px;"></div>
                    <div class="ipd-badge" id="badge-arr-4-3" style="left:50px; top:20px;"></div>
                </div>
                
                <div class="ipd-barrier"></div>

                <!-- ROW 2 -->
                <div class="ipd-cell" style="border-bottom:none;">
                    <div class="ipd-cell-label">Ø5</div>
                    <svg width="100%" height="100%">
                        <!-- SBL: from top to right -->
                        <path class="ipd-arrow" id="arr-5-1" d="M 40,20 Q 40,60 80,60" stroke-width="8" marker-end="url(#arrowhead-gray)" />
                    </svg>
                    <div class="ipd-badge" id="badge-arr-5-1" style="left:60px; top:40px;"></div>
                </div>
                <div class="ipd-cell" style="border-bottom:none;">
                    <div class="ipd-cell-label">Ø6</div>
                    <svg width="100%" height="100%">
                        <!-- NBT: from bottom to up -->
                        <path class="ipd-arrow" id="arr-6-1" d="M 40,90 L 40,20" stroke-width="8" marker-end="url(#arrowhead-gray)" />
                        <!-- NBR: from bottom to right (dashed) -->
                        <path class="ipd-arrow ipd-arrow-dashed" id="arr-6-2" d="M 60,90 Q 60,50 80,50" stroke-width="4" marker-end="url(#arrowhead-gray)" />
                        <!-- Ped: vertical dashed double -->
                        <path class="ipd-arrow ipd-arrow-dashed" id="arr-6-3" d="M 90,30 L 90,80" stroke-width="3" marker-start="url(#arrowhead-gray-rev)" marker-end="url(#arrowhead-gray)" />
                    </svg>
                    <div class="ipd-badge" id="badge-arr-6-1" style="left:40px; top:55px;"></div>
                    <div class="ipd-badge" id="badge-arr-6-2" style="left:70px; top:70px;"></div>
                    <div class="ipd-badge" id="badge-arr-6-3" style="left:90px; top:55px;"></div>
                </div>
                
                <div class="ipd-barrier"></div>
                
                <div class="ipd-cell" style="border-bottom:none;">
                    <div class="ipd-cell-label">Ø7</div>
                    <svg width="100%" height="100%">
                        <!-- EBL: from top to left (based on visual) or wait, visual Ø7 starts top, curves left. -->
                        <path class="ipd-arrow" id="arr-7-1" d="M 60,20 Q 60,60 20,60" stroke-width="8" marker-end="url(#arrowhead-gray)" />
                    </svg>
                    <div class="ipd-badge" id="badge-arr-7-1" style="left:40px; top:40px;"></div>
                </div>
                <div class="ipd-cell" style="border-bottom:none;">
                    <div class="ipd-cell-label">Ø8</div>
                    <svg width="100%" height="100%">
                        <!-- EBT: from left to right -->
                        <path class="ipd-arrow" id="arr-8-1" d="M 20,40 L 80,40" stroke-width="8" marker-end="url(#arrowhead-gray)" />
                        <!-- EBR: from left to down (dashed) -->
                        <path class="ipd-arrow ipd-arrow-dashed" id="arr-8-2" d="M 20,60 Q 50,60 50,90" stroke-width="4" marker-end="url(#arrowhead-gray)" />
                        <!-- Ped: horizontal dashed double -->
                        <path class="ipd-arrow ipd-arrow-dashed" id="arr-8-3" d="M 30,90 L 70,90" stroke-width="3" marker-start="url(#arrowhead-gray-rev)" marker-end="url(#arrowhead-gray)" />
                    </svg>
                    <div class="ipd-badge" id="badge-arr-8-1" style="left:50px; top:40px;"></div>
                    <div class="ipd-badge" id="badge-arr-8-2" style="left:35px; top:75px;"></div>
                    <div class="ipd-badge" id="badge-arr-8-3" style="left:50px; top:90px;"></div>
                </div>
                
                <div class="ipd-barrier"></div>
            </div>
            
            <div class="ipd-legend">
                <div class="ipd-legend-item">
                    <svg width="40" height="10"><path d="M0,5 L30,5" stroke="#0088cc" stroke-width="4" marker-end="url(#arrowhead-blue)"/></svg>
                    <span>Protected Phase</span>
                </div>
                <div class="ipd-legend-item">
                    <svg width="40" height="10"><path d="M0,5 L30,5" stroke="#0088cc" stroke-width="2" stroke-dasharray="4 2" marker-end="url(#arrowhead-blue)"/></svg>
                    <span>Permissive Phase</span>
                </div>
                <div class="ipd-legend-item">
                    <svg width="40" height="10"><path d="M5,5 L35,5" stroke="#0088cc" stroke-width="2" stroke-dasharray="4 2" marker-start="url(#arrowhead-blue-rev)" marker-end="url(#arrowhead-blue)"/></svg>
                    <span>Pedestrian Phase</span>
                </div>
            </div>
        </div>
        `;
    }

    attachEvents() {
        const container = document.getElementById(this.containerId);
        const arrows = container.querySelectorAll('.ipd-arrow');
        
        arrows.forEach(arrow => {
            // Increase hit area for easier clicking
            arrow.style.cursor = 'pointer';
            
            arrow.addEventListener('click', (e) => {
                const id = arrow.id;
                
                if (this.movements[id]) {
                    // Deactivate
                    arrow.classList.remove('active');
                    
                    // Update marker colors
                    if (arrow.id.includes('arr-2-3') || arrow.id.includes('arr-4-3') || arrow.id.includes('arr-6-3') || arrow.id.includes('arr-8-3')) {
                        arrow.setAttribute('marker-start', 'url(#arrowhead-gray-rev)');
                        arrow.setAttribute('marker-end', 'url(#arrowhead-gray)');
                    } else {
                        arrow.setAttribute('marker-end', 'url(#arrowhead-gray)');
                    }
                    
                    const badge = document.getElementById('badge-' + id);
                    if (badge) {
                        badge.classList.remove('visible');
                        badge.innerText = '';
                    }
                    delete this.movements[id];
                    this.recalcNumbers();
                } else {
                    // Activate
                    arrow.classList.add('active');
                    
                    if (arrow.id.includes('arr-2-3') || arrow.id.includes('arr-4-3') || arrow.id.includes('arr-6-3') || arrow.id.includes('arr-8-3')) {
                        arrow.setAttribute('marker-start', 'url(#arrowhead-blue-rev)');
                        arrow.setAttribute('marker-end', 'url(#arrowhead-blue)');
                    } else {
                        arrow.setAttribute('marker-end', 'url(#arrowhead-blue)');
                    }
                    
                    this.movements[id] = this.nextNumber++;
                    const badge = document.getElementById('badge-' + id);
                    if (badge) {
                        badge.innerText = this.movements[id];
                        badge.classList.add('visible');
                    }
                }
            });
        });
    }

    recalcNumbers() {
        // Reassign numbers sequentially to active movements
        let num = 1;
        
        // Sort by creation time (which is roughly maintaining original order) or by ID
        // For standard feeling, we keep the numbers assigned in chronological click order
        // by sorting the object entries by their current value.
        const sorted = Object.entries(this.movements).sort((a, b) => a[1] - b[1]);
        
        this.movements = {};
        sorted.forEach(([id, oldNum]) => {
            this.movements[id] = num;
            const badge = document.getElementById('badge-' + id);
            if (badge) {
                badge.innerText = num;
            }
            num++;
        });
        this.nextNumber = num;
    }
}

window.InteractivePhaseDiagram = InteractivePhaseDiagram;
