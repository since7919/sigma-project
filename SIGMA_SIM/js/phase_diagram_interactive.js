// js/phase_diagram_interactive.js

class InteractivePhaseDiagram {
    constructor(containerId) {
        this.containerId = containerId;
        this.activeMovements = {};
        this.currentEditingCell = null;
        this.init();
    }

    init() {
        const container = document.getElementById(this.containerId);
        if (!container) return;
        
        container.innerHTML = this.getGridHTML() + this.getModalHTML();
        this.attachCellEvents();
        
        setTimeout(() => {
            for (let i = 1; i <= 8; i++) {
                this.renderCell('P' + i + '-A');
                this.renderCell('P' + i + '-B');
            }
        }, 100);
    }

    loadFromSignalMap(sm) {
        if (!sm) return;
        this.activeMovements = {};

        if (sm.ipdCustomArrows) {
            this.activeMovements = JSON.parse(JSON.stringify(sm.ipdCustomArrows));
            for (let i = 1; i <= 8; i++) {
                this.renderCell('P' + i + '-A');
                this.renderCell('P' + i + '-B');
            }
            return;
        }

        // Korean Standard Phase Mapping
        // 2: EBT (Eastbound), 6: WBT (Westbound), 4: SBT (Southbound), 8: NBT (Northbound)
        // 1: EBL, 5: WBL, 3: NBL, 7: SBL
        const mapMov = (m) => {
            const MAP = {
                1: ['WBL'], 2: ['EBT'], 3: ['NBL'], 4: ['SBT'],
                5: ['EBL'], 6: ['WBT'], 7: ['SBL'], 8: ['NBT'],
                9: ['NEL'], 10: ['SWT'], 11: ['SEL'], 12: ['NWT'],
                13: ['SWL'], 14: ['NET'], 15: ['NWL'], 16: ['SET'],
                
                // Right Turns
                22: ['EBR'], 24: ['SBR'], 26: ['WBR'], 28: ['NBR'],
                30: ['SWR'], 32: ['NWR'], 34: ['NER'], 36: ['SER'],
                
                // Permissive Lefts
                31: ['WBL-P'], 33: ['NBL-P'], 35: ['EBL-P'], 37: ['SBL-P'],
                39: ['NEL-P'], 41: ['SEL-P'], 43: ['SWL-P'], 45: ['NWL-P'],
                
                // Pedestrians
                102: ['PED-S'], 104: ['PED-W'], 106: ['PED-N'], 108: ['PED-E'],
                
                
                
            };
            return MAP[m] || [];
        };

        for (let i = 0; i < 8; i++) {
            const ringAMovs = [];
            const ringBMovs = [];
            
            if (sm.movA && sm.movA[i]) ringAMovs.push(...mapMov(sm.movA[i]));
            if (sm.movB && sm.movB[i]) ringBMovs.push(...mapMov(sm.movB[i]));
            
            if (sm.pedMovA && sm.pedMovA[i]) ringAMovs.push(...mapMov(sm.pedMovA[i]));
            if (sm.pedMovB && sm.pedMovB[i]) ringBMovs.push(...mapMov(sm.pedMovB[i]));

            this.activeMovements['P' + (i + 1) + '-A'] = ringAMovs;
            this.activeMovements['P' + (i + 1) + '-B'] = ringBMovs;
        }

        for (let i = 1; i <= 8; i++) {
            this.renderCell('P' + i + '-A');
            this.renderCell('P' + i + '-B');
        }
    }

    saveToSignalMap(sm, j = null) {
        if (!sm) return;
        
        // Save the explicit combination of arrows directly to ipdCustomArrows
        sm.ipdCustomArrows = JSON.parse(JSON.stringify(this.activeMovements));
    }

    getVehSVGPaths(prefix, filter = null) {
        let html = '';
        const getNS = (pfx) => `
            <!-- NB -->
            <path class="ipd-arrow ipd-nbl" id="${pfx}-NBL" data-mov="NBL" d="M 56,85 L 56,70 Q 56,60 46,60" />
            <path class="ipd-arrow ipd-dashed ipd-nbl-p" id="${pfx}-NBL-P" data-mov="NBL-P" d="M 52,85 L 52,70 Q 52,55 42,55" />
            <path class="ipd-arrow ipd-nbt" id="${pfx}-NBT" data-mov="NBT" d="M 68,85 L 68,55" />
            <path class="ipd-arrow ipd-nbr" id="${pfx}-NBR" data-mov="NBR" d="M 80,85 L 80,70 Q 80,60 90,60" />
            
            <!-- SB -->
            <path class="ipd-arrow ipd-sbl" id="${pfx}-SBL" data-mov="SBL" d="M 44,15 L 44,30 Q 44,40 54,40" />
            <path class="ipd-arrow ipd-dashed ipd-sbl-p" id="${pfx}-SBL-P" data-mov="SBL-P" d="M 48,15 L 48,30 Q 48,45 58,45" />
            <path class="ipd-arrow ipd-sbt" id="${pfx}-SBT" data-mov="SBT" d="M 32,15 L 32,45" />
            <path class="ipd-arrow ipd-sbr" id="${pfx}-SBR" data-mov="SBR" d="M 20,15 L 20,30 Q 20,40 10,40" />
        `;
        const getEW = (pfx) => `
            <!-- EB -->
            <path class="ipd-arrow ipd-ebl" id="${pfx}-EBL" data-mov="EBL" d="M 15,56 L 30,56 Q 40,56 40,46" />
            <path class="ipd-arrow ipd-dashed ipd-ebl-p" id="${pfx}-EBL-P" data-mov="EBL-P" d="M 15,60 L 30,60 Q 45,60 45,46" />
            <path class="ipd-arrow ipd-ebt" id="${pfx}-EBT" data-mov="EBT" d="M 15,68 L 45,68" />
            <path class="ipd-arrow ipd-ebr" id="${pfx}-EBR" data-mov="EBR" d="M 15,80 L 30,80 Q 40,80 40,90" />
            
            <!-- WB -->
            <path class="ipd-arrow ipd-wbl" id="${pfx}-WBL" data-mov="WBL" d="M 85,44 L 70,44 Q 60,44 60,54" />
            <path class="ipd-arrow ipd-dashed ipd-wbl-p" id="${pfx}-WBL-P" data-mov="WBL-P" d="M 85,40 L 70,40 Q 55,40 55,54" />
            <path class="ipd-arrow ipd-wbt" id="${pfx}-WBT" data-mov="WBT" d="M 85,32 L 55,32" />
            <path class="ipd-arrow ipd-wbr" id="${pfx}-WBR" data-mov="WBR" d="M 85,20 L 70,20 Q 60,20 60,10" />
        `;
        const getMultiNS = (pfx) => `
            <!-- NB Diag -->
            <path class="ipd-arrow ipd-ndl" id="${pfx}-NDL" data-mov="NDL" d="M 62,85 L 62,70 Q 62,60 52,50" />
            <path class="ipd-arrow ipd-ndr" id="${pfx}-NDR" data-mov="NDR" d="M 74,85 L 74,70 Q 74,60 84,50" />
            <!-- SB Diag -->
            <path class="ipd-arrow ipd-sdl" id="${pfx}-SDL" data-mov="SDL" d="M 38,15 L 38,30 Q 38,40 48,50" />
            <path class="ipd-arrow ipd-sdr" id="${pfx}-SDR" data-mov="SDR" d="M 26,15 L 26,30 Q 26,40 16,50" />
        `;
        const getMultiEW = (pfx) => `
            <!-- EB Diag -->
            <path class="ipd-arrow ipd-edl" id="${pfx}-EDL" data-mov="EDL" d="M 15,62 L 30,62 Q 40,62 50,52" />
            <path class="ipd-arrow ipd-edr" id="${pfx}-EDR" data-mov="EDR" d="M 15,74 L 30,74 Q 40,74 50,84" />
            <!-- WB Diag -->
            <path class="ipd-arrow ipd-wdl" id="${pfx}-WDL" data-mov="WDL" d="M 85,38 L 70,38 Q 60,38 50,48" />
            <path class="ipd-arrow ipd-wdr" id="${pfx}-WDR" data-mov="WDR" d="M 85,26 L 70,26 Q 60,26 50,16" />
        `;
        const getNESW = (pfx) => `
            <g transform="rotate(45 50 50)">
                <!-- SW (From Bottom) -->
                <path class="ipd-arrow ipd-nbl" id="${pfx}-SWL" data-mov="SWL" d="M 56,85 L 56,70 Q 56,60 46,60" />
                <path class="ipd-arrow ipd-dashed ipd-nbl-p" id="${pfx}-SWL-P" data-mov="SWL-P" d="M 52,85 L 52,70 Q 52,55 42,55" />
                <path class="ipd-arrow ipd-nbt" id="${pfx}-SWT" data-mov="SWT" d="M 68,85 L 68,55" />
                <path class="ipd-arrow ipd-nbr" id="${pfx}-SWR" data-mov="SWR" d="M 80,85 L 80,70 Q 80,60 90,60" />
                <!-- SW Diag -->
                <path class="ipd-arrow ipd-ndl" id="${pfx}-SWDL" data-mov="SWDL" d="M 62,85 L 62,70 Q 62,60 52,50" />
                <path class="ipd-arrow ipd-ndr" id="${pfx}-SWDR" data-mov="SWDR" d="M 74,85 L 74,70 Q 74,60 84,50" />
                
                <!-- NE (From Top) -->
                <path class="ipd-arrow ipd-sbl" id="${pfx}-NEL" data-mov="NEL" d="M 44,15 L 44,30 Q 44,40 54,40" />
                <path class="ipd-arrow ipd-dashed ipd-sbl-p" id="${pfx}-NEL-P" data-mov="NEL-P" d="M 48,15 L 48,30 Q 48,45 58,45" />
                <path class="ipd-arrow ipd-sbt" id="${pfx}-NET" data-mov="NET" d="M 32,15 L 32,45" />
                <path class="ipd-arrow ipd-sbr" id="${pfx}-NER" data-mov="NER" d="M 20,15 L 20,30 Q 20,40 10,40" />
                <!-- NE Diag -->
                <path class="ipd-arrow ipd-sdl" id="${pfx}-NEDL" data-mov="NEDL" d="M 38,15 L 38,30 Q 38,40 48,50" />
                <path class="ipd-arrow ipd-sdr" id="${pfx}-NEDR" data-mov="NEDR" d="M 26,15 L 26,30 Q 26,40 16,50" />
            </g>
        `;
        const getNWSE = (pfx) => `
            <g transform="rotate(-45 50 50)">
                <!-- SE (From Bottom) -->
                <path class="ipd-arrow ipd-nbl" id="${pfx}-SEL" data-mov="SEL" d="M 56,85 L 56,70 Q 56,60 46,60" />
                <path class="ipd-arrow ipd-dashed ipd-nbl-p" id="${pfx}-SEL-P" data-mov="SEL-P" d="M 52,85 L 52,70 Q 52,55 42,55" />
                <path class="ipd-arrow ipd-nbt" id="${pfx}-SET" data-mov="SET" d="M 68,85 L 68,55" />
                <path class="ipd-arrow ipd-nbr" id="${pfx}-SER" data-mov="SER" d="M 80,85 L 80,70 Q 80,60 90,60" />
                <!-- SE Diag -->
                <path class="ipd-arrow ipd-ndl" id="${pfx}-SEDL" data-mov="SEDL" d="M 62,85 L 62,70 Q 62,60 52,50" />
                <path class="ipd-arrow ipd-ndr" id="${pfx}-SEDR" data-mov="SEDR" d="M 74,85 L 74,70 Q 74,60 84,50" />
                
                <!-- NW (From Top) -->
                <path class="ipd-arrow ipd-sbl" id="${pfx}-NWL" data-mov="NWL" d="M 44,15 L 44,30 Q 44,40 54,40" />
                <path class="ipd-arrow ipd-dashed ipd-sbl-p" id="${pfx}-NWL-P" data-mov="NWL-P" d="M 48,15 L 48,30 Q 48,45 58,45" />
                <path class="ipd-arrow ipd-sbt" id="${pfx}-NWT" data-mov="NWT" d="M 32,15 L 32,45" />
                <path class="ipd-arrow ipd-sbr" id="${pfx}-NWR" data-mov="NWR" d="M 20,15 L 20,30 Q 20,40 10,40" />
                <!-- NW Diag -->
                <path class="ipd-arrow ipd-sdl" id="${pfx}-NWDL" data-mov="NWDL" d="M 38,15 L 38,30 Q 38,40 48,50" />
                <path class="ipd-arrow ipd-sdr" id="${pfx}-NWDR" data-mov="NWDR" d="M 26,15 L 26,30 Q 26,40 16,50" />
            </g>
        `;

        if (!filter) {
            html += getNS(prefix) + getEW(prefix) + getMultiNS(prefix) + getMultiEW(prefix) + getNESW(prefix) + getNWSE(prefix);
        } else if (filter === 'NS') {
            html += getNS(prefix);
        } else if (filter === 'EW') {
            html += getEW(prefix);
        } else if (filter === 'MULTI_LEG_NS') {
            html += getNS(prefix) + getMultiNS(prefix);
        } else if (filter === 'MULTI_LEG_EW') {
            html += getEW(prefix) + getMultiEW(prefix);
        } else if (filter === 'MULTI_LEG_NESW') {
            html += getNESW(prefix);
        } else if (filter === 'MULTI_LEG_NWSE') {
            html += getNWSE(prefix);
        }
        return html;
    }

    getPedSVGPaths(prefix, filter = null) {
        let html = '';
        const getEWPeds = (pfx) => `
            <path class="ipd-arrow ipd-ped ipd-dashed" id="${pfx}-PED-S" data-mov="PED-S" d="M 30,92 L 48,92" />
            <path class="ipd-arrow ipd-ped ipd-dashed" id="${pfx}-PED-S2" data-mov="PED-S2" d="M 52,92 L 70,92" />
            <path class="ipd-arrow ipd-ped ipd-dashed" id="${pfx}-PED-N" data-mov="PED-N" d="M 30,8 L 48,8" />
            <path class="ipd-arrow ipd-ped ipd-dashed" id="${pfx}-PED-N2" data-mov="PED-N2" d="M 52,8 L 70,8" />
        `;
        const getNSPeds = (pfx) => `
            <path class="ipd-arrow ipd-ped ipd-dashed" id="${pfx}-PED-W" data-mov="PED-W" d="M 8,30 L 8,48" />
            <path class="ipd-arrow ipd-ped ipd-dashed" id="${pfx}-PED-W2" data-mov="PED-W2" d="M 8,52 L 8,70" />
            <path class="ipd-arrow ipd-ped ipd-dashed" id="${pfx}-PED-E" data-mov="PED-E" d="M 92,30 L 92,48" />
            <path class="ipd-arrow ipd-ped ipd-dashed" id="${pfx}-PED-E2" data-mov="PED-E2" d="M 92,52 L 92,70" />
        `;
        const getNESWPeds = (pfx) => `
            <g transform="rotate(45 50 50)">
                <path class="ipd-arrow ipd-ped ipd-dashed" id="${pfx}-PED-SW" data-mov="PED-SW" d="M 30,92 L 48,92" />
                <path class="ipd-arrow ipd-ped ipd-dashed" id="${pfx}-PED-SW2" data-mov="PED-SW2" d="M 52,92 L 70,92" />
                <path class="ipd-arrow ipd-ped ipd-dashed" id="${pfx}-PED-NE" data-mov="PED-NE" d="M 30,8 L 48,8" />
                <path class="ipd-arrow ipd-ped ipd-dashed" id="${pfx}-PED-NE2" data-mov="PED-NE2" d="M 52,8 L 70,8" />
            </g>
        `;
        const getNWSEPeds = (pfx) => `
            <g transform="rotate(-45 50 50)">
                <path class="ipd-arrow ipd-ped ipd-dashed" id="${pfx}-PED-SE" data-mov="PED-SE" d="M 30,92 L 48,92" />
                <path class="ipd-arrow ipd-ped ipd-dashed" id="${pfx}-PED-SE2" data-mov="PED-SE2" d="M 52,92 L 70,92" />
                <path class="ipd-arrow ipd-ped ipd-dashed" id="${pfx}-PED-NW" data-mov="PED-NW" d="M 30,8 L 48,8" />
                <path class="ipd-arrow ipd-ped ipd-dashed" id="${pfx}-PED-NW2" data-mov="PED-NW2" d="M 52,8 L 70,8" />
            </g>
        `;

        if (!filter) {
            html += getEWPeds(prefix) + getNSPeds(prefix) + getNESWPeds(prefix) + getNWSEPeds(prefix);
        } else if (filter === 'EW' || filter === 'MULTI_LEG_EW') {
            html += getEWPeds(prefix);
        } else if (filter === 'NS' || filter === 'MULTI_LEG_NS') {
            html += getNSPeds(prefix);
        } else if (filter === 'MULTI_LEG_NESW') {
            html += getNESWPeds(prefix);
        } else if (filter === 'MULTI_LEG_NWSE') {
            html += getNWSEPeds(prefix);
        } else if (filter === 'SCRAMBLE') {
            html += `
            <path class="ipd-arrow ipd-ped ipd-dashed" id="${prefix}-PED-NWSE" data-mov="PED-NWSE" d="M 20,20 L 80,80" />
            <path class="ipd-arrow ipd-ped ipd-dashed" id="${prefix}-PED-NESW" data-mov="PED-NESW" d="M 80,20 L 20,80" />
            
            <path class="ipd-arrow ipd-ped ipd-dashed" id="${prefix}-PED-S" data-mov="PED-S" d="M 30,92 L 48,92" />
            <path class="ipd-arrow ipd-ped ipd-dashed" id="${prefix}-PED-S2" data-mov="PED-S2" d="M 52,92 L 70,92" />
            <path class="ipd-arrow ipd-ped ipd-dashed" id="${prefix}-PED-N" data-mov="PED-N" d="M 30,8 L 48,8" />
            <path class="ipd-arrow ipd-ped ipd-dashed" id="${prefix}-PED-N2" data-mov="PED-N2" d="M 52,8 L 70,8" />
            
            <path class="ipd-arrow ipd-ped ipd-dashed" id="${prefix}-PED-W" data-mov="PED-W" d="M 8,30 L 8,48" />
            <path class="ipd-arrow ipd-ped ipd-dashed" id="${prefix}-PED-W2" data-mov="PED-W2" d="M 8,52 L 8,70" />
            <path class="ipd-arrow ipd-ped ipd-dashed" id="${prefix}-PED-E" data-mov="PED-E" d="M 92,30 L 92,48" />
            <path class="ipd-arrow ipd-ped ipd-dashed" id="${prefix}-PED-E2" data-mov="PED-E2" d="M 92,52 L 92,70" />
            `;
        }
        return html;
    }

    getLabelSVGPaths(prefix, filter = null) {
        if (!prefix.startsWith('modal')) return '';
        let html = '';
        
        const getNSLabels = () => `
            <text class="ipd-text-label" data-mov="NBL" x="56" y="99" fill="#0ea5e9" font-size="5" font-weight="bold" text-anchor="middle" style="cursor:pointer;">3</text>
            <text class="ipd-text-label" data-mov="NBL-P" x="52" y="99" fill="#0ea5e9" font-size="5" font-weight="bold" text-anchor="middle" style="cursor:pointer;">33</text>
            <text class="ipd-text-label" data-mov="NBT" x="68" y="99" fill="#0ea5e9" font-size="5" font-weight="bold" text-anchor="middle" style="cursor:pointer;">8</text>
            <text class="ipd-text-label" data-mov="NBR" x="80" y="99" fill="#0ea5e9" font-size="5" font-weight="bold" text-anchor="middle" style="cursor:pointer;">28</text>
            
            <text class="ipd-text-label" data-mov="SBL" x="44" y="3" fill="#0ea5e9" font-size="5" font-weight="bold" text-anchor="middle" style="cursor:pointer;">7</text>
            <text class="ipd-text-label" data-mov="SBL-P" x="48" y="3" fill="#0ea5e9" font-size="5" font-weight="bold" text-anchor="middle" style="cursor:pointer;">37</text>
            <text class="ipd-text-label" data-mov="SBT" x="32" y="3" fill="#0ea5e9" font-size="5" font-weight="bold" text-anchor="middle" style="cursor:pointer;">4</text>
            <text class="ipd-text-label" data-mov="SBR" x="20" y="3" fill="#0ea5e9" font-size="5" font-weight="bold" text-anchor="middle" style="cursor:pointer;">24</text>
            
            <text class="ipd-text-label" data-mov="PED-W" x="-3" y="39" fill="#0ea5e9" font-size="4.5" font-weight="bold" text-anchor="middle" dominant-baseline="middle" style="cursor:pointer;">104</text>
            <text class="ipd-text-label" data-mov="PED-W2" x="-3" y="61" fill="#0ea5e9" font-size="4.5" font-weight="bold" text-anchor="middle" dominant-baseline="middle" style="cursor:pointer;">124</text>
            <text class="ipd-text-label" data-mov="PED-E" x="103" y="39" fill="#0ea5e9" font-size="4.5" font-weight="bold" text-anchor="middle" dominant-baseline="middle" style="cursor:pointer;">108</text>
            <text class="ipd-text-label" data-mov="PED-E2" x="103" y="61" fill="#0ea5e9" font-size="4.5" font-weight="bold" text-anchor="middle" dominant-baseline="middle" style="cursor:pointer;">128</text>
        `;
        const getEWLabels = () => `
            <text class="ipd-text-label" data-mov="EBL" x="3" y="56" fill="#0ea5e9" font-size="5" font-weight="bold" text-anchor="middle" dominant-baseline="middle" style="cursor:pointer;">5</text>
            <text class="ipd-text-label" data-mov="EBL-P" x="3" y="52" fill="#0ea5e9" font-size="5" font-weight="bold" text-anchor="middle" dominant-baseline="middle" style="cursor:pointer;">35</text>
            <text class="ipd-text-label" data-mov="EBT" x="3" y="68" fill="#0ea5e9" font-size="5" font-weight="bold" text-anchor="middle" dominant-baseline="middle" style="cursor:pointer;">2</text>
            <text class="ipd-text-label" data-mov="EBR" x="3" y="80" fill="#0ea5e9" font-size="5" font-weight="bold" text-anchor="middle" dominant-baseline="middle" style="cursor:pointer;">22</text>
            
            <text class="ipd-text-label" data-mov="WBL" x="97" y="44" fill="#0ea5e9" font-size="5" font-weight="bold" text-anchor="middle" dominant-baseline="middle" style="cursor:pointer;">1</text>
            <text class="ipd-text-label" data-mov="WBL-P" x="97" y="48" fill="#0ea5e9" font-size="5" font-weight="bold" text-anchor="middle" dominant-baseline="middle" style="cursor:pointer;">31</text>
            <text class="ipd-text-label" data-mov="WBT" x="97" y="32" fill="#0ea5e9" font-size="5" font-weight="bold" text-anchor="middle" dominant-baseline="middle" style="cursor:pointer;">6</text>
            <text class="ipd-text-label" data-mov="WBR" x="97" y="20" fill="#0ea5e9" font-size="5" font-weight="bold" text-anchor="middle" dominant-baseline="middle" style="cursor:pointer;">26</text>
            
            <text class="ipd-text-label" data-mov="PED-S" x="39" y="103" fill="#0ea5e9" font-size="4.5" font-weight="bold" text-anchor="middle" style="cursor:pointer;">102</text>
            <text class="ipd-text-label" data-mov="PED-S2" x="61" y="103" fill="#0ea5e9" font-size="4.5" font-weight="bold" text-anchor="middle" style="cursor:pointer;">122</text>
            <text class="ipd-text-label" data-mov="PED-N" x="39" y="-1" fill="#0ea5e9" font-size="4.5" font-weight="bold" text-anchor="middle" style="cursor:pointer;">106</text>
            <text class="ipd-text-label" data-mov="PED-N2" x="61" y="-1" fill="#0ea5e9" font-size="4.5" font-weight="bold" text-anchor="middle" style="cursor:pointer;">126</text>
        `;

        const getMultiNSLabels = () => `
            <text class="ipd-text-label" data-mov="NDL" x="62" y="99" fill="#0ea5e9" font-size="4.5" font-weight="bold" text-anchor="middle" style="cursor:pointer;">DL</text>
            <text class="ipd-text-label" data-mov="NDR" x="74" y="99" fill="#0ea5e9" font-size="4.5" font-weight="bold" text-anchor="middle" style="cursor:pointer;">DR</text>
            <text class="ipd-text-label" data-mov="SDL" x="38" y="3" fill="#0ea5e9" font-size="4.5" font-weight="bold" text-anchor="middle" style="cursor:pointer;">DL</text>
            <text class="ipd-text-label" data-mov="SDR" x="26" y="3" fill="#0ea5e9" font-size="4.5" font-weight="bold" text-anchor="middle" style="cursor:pointer;">DR</text>
        `;
        const getMultiEWLabels = () => `
            <text class="ipd-text-label" data-mov="EDL" x="3" y="62" fill="#0ea5e9" font-size="4.5" font-weight="bold" text-anchor="middle" dominant-baseline="middle" style="cursor:pointer;">DL</text>
            <text class="ipd-text-label" data-mov="EDR" x="3" y="74" fill="#0ea5e9" font-size="4.5" font-weight="bold" text-anchor="middle" dominant-baseline="middle" style="cursor:pointer;">DR</text>
            <text class="ipd-text-label" data-mov="WDL" x="97" y="38" fill="#0ea5e9" font-size="4.5" font-weight="bold" text-anchor="middle" dominant-baseline="middle" style="cursor:pointer;">DL</text>
            <text class="ipd-text-label" data-mov="WDR" x="97" y="26" fill="#0ea5e9" font-size="4.5" font-weight="bold" text-anchor="middle" dominant-baseline="middle" style="cursor:pointer;">DR</text>
        `;

        const getNESWLabels = () => `
            <text class="ipd-text-label" data-mov="SWL" x="20" y="91" fill="#0ea5e9" font-size="5" font-weight="bold" text-anchor="middle" style="cursor:pointer;">13</text>
            <text class="ipd-text-label" data-mov="SWL-P" x="17" y="86" fill="#0ea5e9" font-size="5" font-weight="bold" text-anchor="middle" style="cursor:pointer;">43</text>
            <text class="ipd-text-label" data-mov="SWT" x="28" y="97" fill="#0ea5e9" font-size="5" font-weight="bold" text-anchor="middle" style="cursor:pointer;">10</text>
            <text class="ipd-text-label" data-mov="SWR" x="37" y="106" fill="#0ea5e9" font-size="5" font-weight="bold" text-anchor="middle" style="cursor:pointer;">30</text>
            
            <text class="ipd-text-label" data-mov="NEL" x="80" y="9" fill="#0ea5e9" font-size="5" font-weight="bold" text-anchor="middle" style="cursor:pointer;">9</text>
            <text class="ipd-text-label" data-mov="NEL-P" x="82" y="15" fill="#0ea5e9" font-size="5" font-weight="bold" text-anchor="middle" style="cursor:pointer;">39</text>
            <text class="ipd-text-label" data-mov="NET" x="72" y="3" fill="#0ea5e9" font-size="5" font-weight="bold" text-anchor="middle" style="cursor:pointer;">14</text>
            <text class="ipd-text-label" data-mov="NER" x="62" y="-4" fill="#0ea5e9" font-size="5" font-weight="bold" text-anchor="middle" style="cursor:pointer;">34</text>
            
            <text class="ipd-text-label" data-mov="PED-SW" x="5" y="80" fill="#0ea5e9" font-size="4.5" font-weight="bold" text-anchor="middle" style="cursor:pointer;">110</text>
            <text class="ipd-text-label" data-mov="PED-SW2" x="20" y="95" fill="#0ea5e9" font-size="4.5" font-weight="bold" text-anchor="middle" style="cursor:pointer;">130</text>
            <text class="ipd-text-label" data-mov="PED-NE" x="78" y="6" fill="#0ea5e9" font-size="4.5" font-weight="bold" text-anchor="middle" style="cursor:pointer;">114</text>
            <text class="ipd-text-label" data-mov="PED-NE2" x="94" y="22" fill="#0ea5e9" font-size="4.5" font-weight="bold" text-anchor="middle" style="cursor:pointer;">134</text>
            
            <text class="ipd-text-label" data-mov="SWDL" x="24" y="94" fill="#0ea5e9" font-size="4.5" font-weight="bold" text-anchor="middle" style="cursor:pointer;">DL</text>
            <text class="ipd-text-label" data-mov="SWDR" x="32" y="101" fill="#0ea5e9" font-size="4.5" font-weight="bold" text-anchor="middle" style="cursor:pointer;">DR</text>
            <text class="ipd-text-label" data-mov="NEDL" x="76" y="6" fill="#0ea5e9" font-size="4.5" font-weight="bold" text-anchor="middle" style="cursor:pointer;">DL</text>
            <text class="ipd-text-label" data-mov="NEDR" x="67" y="-1" fill="#0ea5e9" font-size="4.5" font-weight="bold" text-anchor="middle" style="cursor:pointer;">DR</text>
        `;
        const getNWSELabels = () => `
            <text class="ipd-text-label" data-mov="SEL" x="80" y="91" fill="#0ea5e9" font-size="5" font-weight="bold" text-anchor="middle" style="cursor:pointer;">11</text>
            <text class="ipd-text-label" data-mov="SEL-P" x="83" y="86" fill="#0ea5e9" font-size="5" font-weight="bold" text-anchor="middle" style="cursor:pointer;">41</text>
            <text class="ipd-text-label" data-mov="SET" x="72" y="97" fill="#0ea5e9" font-size="5" font-weight="bold" text-anchor="middle" style="cursor:pointer;">16</text>
            <text class="ipd-text-label" data-mov="SER" x="63" y="106" fill="#0ea5e9" font-size="5" font-weight="bold" text-anchor="middle" style="cursor:pointer;">36</text>
            
            <text class="ipd-text-label" data-mov="NWL" x="20" y="9" fill="#0ea5e9" font-size="5" font-weight="bold" text-anchor="middle" style="cursor:pointer;">15</text>
            <text class="ipd-text-label" data-mov="NWL-P" x="18" y="15" fill="#0ea5e9" font-size="5" font-weight="bold" text-anchor="middle" style="cursor:pointer;">45</text>
            <text class="ipd-text-label" data-mov="NWT" x="28" y="3" fill="#0ea5e9" font-size="5" font-weight="bold" text-anchor="middle" style="cursor:pointer;">12</text>
            <text class="ipd-text-label" data-mov="NWR" x="38" y="-4" fill="#0ea5e9" font-size="5" font-weight="bold" text-anchor="middle" style="cursor:pointer;">32</text>
            
            <text class="ipd-text-label" data-mov="PED-SE" x="80" y="95" fill="#0ea5e9" font-size="4.5" font-weight="bold" text-anchor="middle" style="cursor:pointer;">116</text>
            <text class="ipd-text-label" data-mov="PED-SE2" x="95" y="80" fill="#0ea5e9" font-size="4.5" font-weight="bold" text-anchor="middle" style="cursor:pointer;">136</text>
            <text class="ipd-text-label" data-mov="PED-NW" x="6" y="22" fill="#0ea5e9" font-size="4.5" font-weight="bold" text-anchor="middle" style="cursor:pointer;">112</text>
            <text class="ipd-text-label" data-mov="PED-NW2" x="22" y="6" fill="#0ea5e9" font-size="4.5" font-weight="bold" text-anchor="middle" style="cursor:pointer;">132</text>
            
            <text class="ipd-text-label" data-mov="SEDL" x="76" y="94" fill="#0ea5e9" font-size="4.5" font-weight="bold" text-anchor="middle" style="cursor:pointer;">DL</text>
            <text class="ipd-text-label" data-mov="SEDR" x="67" y="101" fill="#0ea5e9" font-size="4.5" font-weight="bold" text-anchor="middle" style="cursor:pointer;">DR</text>
            <text class="ipd-text-label" data-mov="NWDL" x="24" y="6" fill="#0ea5e9" font-size="4.5" font-weight="bold" text-anchor="middle" style="cursor:pointer;">DL</text>
            <text class="ipd-text-label" data-mov="NWDR" x="33" y="-1" fill="#0ea5e9" font-size="4.5" font-weight="bold" text-anchor="middle" style="cursor:pointer;">DR</text>
        `;

        if (filter === 'NS') html += getNSLabels();
        if (filter === 'EW') html += getEWLabels();
        if (filter === 'MULTI_LEG_NS') html += getNSLabels() + getMultiNSLabels();
        if (filter === 'MULTI_LEG_EW') html += getEWLabels() + getMultiEWLabels();
        if (filter === 'MULTI_LEG_NESW') html += getNESWLabels();
        if (filter === 'MULTI_LEG_NWSE') html += getNWSELabels();
        if (filter === 'SCRAMBLE') {
            html += `
            <text class="ipd-text-label" data-mov="PED-NWSE" x="18" y="18" fill="#0ea5e9" font-size="4.5" font-weight="bold" text-anchor="middle" style="cursor:pointer;">101</text>
            <text class="ipd-text-label" data-mov="PED-NESW" x="82" y="18" fill="#0ea5e9" font-size="4.5" font-weight="bold" text-anchor="middle" style="cursor:pointer;">103</text>
            
            <text class="ipd-text-label" data-mov="PED-S" x="39" y="103" fill="#0ea5e9" font-size="4.5" font-weight="bold" text-anchor="middle" style="cursor:pointer;">102</text>
            <text class="ipd-text-label" data-mov="PED-S2" x="61" y="103" fill="#0ea5e9" font-size="4.5" font-weight="bold" text-anchor="middle" style="cursor:pointer;">122</text>
            <text class="ipd-text-label" data-mov="PED-N" x="39" y="-1" fill="#0ea5e9" font-size="4.5" font-weight="bold" text-anchor="middle" style="cursor:pointer;">106</text>
            <text class="ipd-text-label" data-mov="PED-N2" x="61" y="-1" fill="#0ea5e9" font-size="4.5" font-weight="bold" text-anchor="middle" style="cursor:pointer;">126</text>
            
            <text class="ipd-text-label" data-mov="PED-W" x="-3" y="39" fill="#0ea5e9" font-size="4.5" font-weight="bold" text-anchor="middle" dominant-baseline="middle" style="cursor:pointer;">104</text>
            <text class="ipd-text-label" data-mov="PED-W2" x="-3" y="61" fill="#0ea5e9" font-size="4.5" font-weight="bold" text-anchor="middle" dominant-baseline="middle" style="cursor:pointer;">124</text>
            <text class="ipd-text-label" data-mov="PED-E" x="103" y="39" fill="#0ea5e9" font-size="4.5" font-weight="bold" text-anchor="middle" dominant-baseline="middle" style="cursor:pointer;">108</text>
            <text class="ipd-text-label" data-mov="PED-E2" x="103" y="61" fill="#0ea5e9" font-size="4.5" font-weight="bold" text-anchor="middle" dominant-baseline="middle" style="cursor:pointer;">128</text>
            `;
        }
        
        return html;
    }

    getSVGDefs() {
        return `
            <svg width="0" height="0" style="position:absolute;">
                <defs>
                    <marker id="${this.containerId}-ah-gray" markerWidth="3" markerHeight="3" refX="1.5" refY="1.5" orient="auto">
                        <polygon points="0 0, 3 1.5, 0 3" fill="#444" />
                    </marker>
                    <marker id="${this.containerId}-ah-blue" markerWidth="3" markerHeight="3" refX="1.5" refY="1.5" orient="auto">
                        <polygon points="0 0, 3 1.5, 0 3" fill="#0ea5e9" />
                    </marker>
                    <marker id="${this.containerId}-ah-gray-rev" markerWidth="3" markerHeight="3" refX="1.5" refY="1.5" orient="auto">
                        <polygon points="3 0, 0 1.5, 3 3" fill="#444" />
                    </marker>
                    <marker id="${this.containerId}-ah-blue-rev" markerWidth="3" markerHeight="3" refX="1.5" refY="1.5" orient="auto">
                        <polygon points="3 0, 0 1.5, 3 3" fill="#0ea5e9" />
                    </marker>
                </defs>
            </svg>
        `;
    }

    getGridHTML() {
        let gridHtml = `<div class="ipd-header-cell" style="border-right:1px solid #3e3e42; border-bottom:1px solid #3e3e42;"></div>`;
        for (let i = 1; i <= 8; i++) {
            const br = (i === 8) ? '' : 'border-right:1px solid #3e3e42;';
            gridHtml += `<div class="ipd-header-cell" style="${br} border-bottom:1px solid #3e3e42;">P${i}</div>`;
        }

        gridHtml += `<div class="ipd-row-label" style="border-right:1px solid #3e3e42; border-bottom:1px solid #3e3e42;">A링</div>`;
        for (let i = 1; i <= 8; i++) {
            const cId = 'P' + i + '-A';
            const br = (i === 8) ? '' : 'border-right:1px solid #3e3e42;';
            gridHtml += `
                <div class="ipd-cell" id="${this.containerId}-cell-${cId}" data-cell="${cId}" style="${br} border-bottom:1px solid #3e3e42;">
                    <svg class="ipd-svg-main" width="100%" height="100%" viewBox="0 0 100 100">
                        <svg class="ipd-svg" id="${this.containerId}-svg-${cId}" x="15" y="15" width="70" height="70" viewBox="0 0 100 100">
                            ${this.getVehSVGPaths(this.containerId + "-cell-" + cId)}
                        </svg>
                        ${this.getPedSVGPaths(this.containerId + "-cell-" + cId)}
                    </svg>
                </div>
            `;
        }

        gridHtml += `<div class="ipd-row-label" style="border-right:1px solid #3e3e42;">B링</div>`;
        for (let i = 1; i <= 8; i++) {
            const cId = 'P' + i + '-B';
            const br = (i === 8) ? '' : 'border-right:1px solid #3e3e42;';
            gridHtml += `
                <div class="ipd-cell" id="${this.containerId}-cell-${cId}" data-cell="${cId}" style="${br}">
                    <svg class="ipd-svg-main" width="100%" height="100%" viewBox="0 0 100 100">
                        <svg class="ipd-svg" id="${this.containerId}-svg-${cId}" x="15" y="15" width="70" height="70" viewBox="0 0 100 100">
                            ${this.getVehSVGPaths(this.containerId + "-cell-" + cId)}
                        </svg>
                        ${this.getPedSVGPaths(this.containerId + "-cell-" + cId)}
                    </svg>
                </div>
            `;
        }

        return `
        <div class="interactive-phase-diagram" style="background:#1e1e1e; border:1px solid #3e3e42; width:100%; margin: 0 auto; user-select:none; font-family:sans-serif; overflow: hidden; border-radius:6px;">
            <style>
                .interactive-phase-diagram * { box-sizing: border-box; }
                .ipd-grid { display: grid; grid-template-columns: 28px repeat(8, 1fr); background: #1e1e1e; width: 100%; }
                .ipd-header-cell { background: #252526; color: #888; font-size: 10px; font-weight: bold; display: flex; align-items: center; justify-content: center; height: 20px; min-width: 0; min-height: 0; overflow: hidden; }
                .ipd-row-label { background: #252526; color: #888; font-size: 10px; font-weight: bold; display: flex; align-items: center; justify-content: center; writing-mode: vertical-rl; text-orientation: upright; letter-spacing: -2px; min-width: 0; min-height: 0; overflow: hidden; }
                
                .ipd-cell { position: relative; aspect-ratio: 1 / 1; background:#1e1e1e; cursor:pointer; transition: background 0.1s; min-width: 0; min-height: 0; overflow: hidden; }
                .ipd-cell:hover { background: #2a2d2e; }
                
                .ipd-arrow { fill: none; stroke: #444; stroke-width: 4.5; transition: all 0.2s; }
                .ipd-dashed { stroke-dasharray: 5 4; }
                
                .ipd-cell .ipd-arrow { display: none; }
                .ipd-cell .ipd-arrow.ipd-active { display: block; stroke: #0ea5e9; }
                
                .ipd-modal-svg .ipd-arrow { display: block; stroke: #444; cursor: pointer; }
                .ipd-modal-svg .ipd-arrow:hover { stroke: #666; }
                .ipd-modal-svg .ipd-arrow.ipd-active { stroke: #0ea5e9; }
                .ipd-modal-svg .ipd-arrow.ipd-active:hover { stroke: #0284c7; }
                
                .ipd-legend { display: flex; flex-direction: row; flex-wrap: wrap; gap: 16px; padding: 10px 15px; background: #252526; border-top: 1px solid #3e3e42; font-size: 11px; color: #aaa; font-weight: bold;}
                .ipd-legend-item { display: flex; align-items: center; gap: 6px; }
            </style>

            ${this.getSVGDefs()}

            <div class="ipd-grid">
                ${gridHtml}
            </div>
            
            <div class="ipd-legend">
                <div class="ipd-legend-item">
                    <svg width="30" height="10" style="overflow:visible;"><path d="M0,5 L22,5" stroke="#0ea5e9" stroke-width="4.5" marker-end="url(#${this.containerId}-ah-blue)"/></svg>
                    <span>Protected (직/좌/우)</span>
                </div>
                <div class="ipd-legend-item">
                    <svg width="30" height="10" style="overflow:visible;"><path d="M0,5 L22,5" stroke="#0ea5e9" stroke-width="4.5" stroke-dasharray="5 4" marker-end="url(#${this.containerId}-ah-blue)"/></svg>
                    <span>Permissive (비보호 좌회전)</span>
                </div>
                <div class="ipd-legend-item">
                    <svg width="30" height="10" style="overflow:visible;"><path d="M8,5 L22,5" stroke="#0ea5e9" stroke-width="4.5" stroke-dasharray="5 4" marker-start="url(#${this.containerId}-ah-blue-rev)" marker-end="url(#${this.containerId}-ah-blue)"/></svg>
                    <span>Pedestrian (보행자)</span>
                </div>
                <div style="font-size:11px; color:#666; font-weight:normal; margin-left: auto; display: flex; align-items: center;">
                    * 팁: 현시 칸을 클릭하여 팔레트(Popup)를 띄워 편집하세요.
                </div>
            </div>
        </div>
        `;
    }

    getModalHTML() {
        return `
        <div id="${this.containerId}-modal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:9999; align-items:center; justify-content:center;">
            <div style="background:#1e1e1e; padding:20px; border-radius:8px; border:1px solid #3e3e42; color:#d4d4d4; width: 650px; box-shadow: 0 10px 40px rgba(0,0,0,0.8);">
                <h3 style="margin-top:0; border-bottom:1px solid #3e3e42; padding-bottom:10px; display:flex; justify-content:space-between; font-size:15px; color:#fff;">
                    <span>🎨 방향 선택 팔레트 - <span id="${this.containerId}-modal-title" style="color:#0ea5e9;"></span></span>
                    <button onclick="document.getElementById('${this.containerId}-modal').style.display='none'" style="background:none; border:none; color:#888; cursor:pointer; font-size:16px;">&times;</button>
                </h3>
                <div style="text-align:center; font-size:12px; color:#888; margin-bottom:15px; line-height: 1.4;">
                    원하는 이동류(직진, 좌회전 등)와 보행자를 클릭하여 켜고 끄세요.<br>
                    비보호 좌회전은 점선으로 표시되며, <b>하늘색 숫자</b>는 각 이동류 고유 번호입니다.
                </div>
                
                <div style="display:flex; justify-content:center; gap:10px; margin-bottom:15px; flex-wrap:wrap;">
                    <button class="phase-action-btn phase-btn-cyan" id="${this.containerId}-tab-normal" style="min-width: 130px; font-weight:bold;">기본 방향</button>
                    <button class="phase-action-btn phase-btn-gray" id="${this.containerId}-tab-diag" style="min-width: 130px; font-weight:bold;">다지 교차로</button>
                    <button class="phase-action-btn phase-btn-gray" id="${this.containerId}-tab-scramble" style="min-width: 130px; font-weight:bold;">대각선 횡단보도</button>
                </div>
                
                <div id="${this.containerId}-content-normal" style="display: flex; gap: 20px; justify-content: center; margin-bottom: 10px;">
                    <!-- 동서 방향 (E-W) -->
                    <div style="width:280px; height:280px; background:#252526; border-radius:4px; border:1px solid #3e3e42; position: relative;">
                        <div style="position:absolute; top:8px; left:10px; font-size:11.5px; color:#aaa; font-weight:bold;">동서 방향 (E-W)</div>
                        <svg class="ipd-modal-svg" width="100%" height="100%" viewBox="-15 -15 130 130">
                            ${this.getVehSVGPaths('modal-normal', 'EW')}
                            ${this.getPedSVGPaths('modal-normal', 'EW')}
                            ${this.getLabelSVGPaths('modal-normal', 'EW')}
                        </svg>
                    </div>
                    
                    <!-- 남북 방향 (N-S) -->
                    <div style="width:280px; height:280px; background:#252526; border-radius:4px; border:1px solid #3e3e42; position: relative;">
                        <div style="position:absolute; top:8px; left:10px; font-size:11.5px; color:#aaa; font-weight:bold;">남북 방향 (N-S)</div>
                        <svg class="ipd-modal-svg" width="100%" height="100%" viewBox="-15 -15 130 130">
                            ${this.getVehSVGPaths('modal-normal', 'NS')}
                            ${this.getPedSVGPaths('modal-normal', 'NS')}
                            ${this.getLabelSVGPaths('modal-normal', 'NS')}
                        </svg>
                    </div>
                </div>

                <div id="${this.containerId}-content-diag" style="display: none; gap: 20px; justify-content: center; margin-bottom: 10px; flex-wrap: wrap;">
                    <!-- 다지교차 동서 방향 (Multi-leg E-W) -->
                    <div style="width:280px; height:280px; background:#252526; border-radius:4px; border:1px solid #3e3e42; position: relative;">
                        <div style="position:absolute; top:8px; left:10px; font-size:11.5px; color:#aaa; font-weight:bold;">다지교차 동서 방향 (Multi-leg E-W)</div>
                        <svg class="ipd-modal-svg" width="100%" height="100%" viewBox="-15 -15 130 130">
                            ${this.getVehSVGPaths('modal-multileg', 'MULTI_LEG_EW')}
                            ${this.getPedSVGPaths('modal-multileg', 'MULTI_LEG_EW')}
                            ${this.getLabelSVGPaths('modal-multileg', 'MULTI_LEG_EW')}
                        </svg>
                    </div>
                    
                    <!-- 다지교차 남북 방향 (Multi-leg N-S) -->
                    <div style="width:280px; height:280px; background:#252526; border-radius:4px; border:1px solid #3e3e42; position: relative;">
                        <div style="position:absolute; top:8px; left:10px; font-size:11.5px; color:#aaa; font-weight:bold;">다지교차 남북 방향 (Multi-leg N-S)</div>
                        <svg class="ipd-modal-svg" width="100%" height="100%" viewBox="-15 -15 130 130">
                            ${this.getVehSVGPaths('modal-multileg', 'MULTI_LEG_NS')}
                            ${this.getPedSVGPaths('modal-multileg', 'MULTI_LEG_NS')}
                            ${this.getLabelSVGPaths('modal-multileg', 'MULTI_LEG_NS')}
                        </svg>
                    </div>

                    <!-- 다지교차 북동-남서 방향 (Multi-leg NE-SW) -->
                    <div style="width:280px; height:280px; background:#252526; border-radius:4px; border:1px solid #3e3e42; position: relative;">
                        <div style="position:absolute; top:8px; left:10px; font-size:11.5px; color:#aaa; font-weight:bold;">다지교차 북동-남서 방향 (Multi-leg NE-SW)</div>
                        <svg class="ipd-modal-svg" width="100%" height="100%" viewBox="-15 -15 130 130">
                            ${this.getVehSVGPaths('modal-multileg', 'MULTI_LEG_NESW')}
                            ${this.getPedSVGPaths('modal-multileg', 'MULTI_LEG_NESW')}
                            ${this.getLabelSVGPaths('modal-multileg', 'MULTI_LEG_NESW')}
                        </svg>
                    </div>
                    
                    <!-- 다지교차 북서-남동 방향 (Multi-leg NW-SE) -->
                    <div style="width:280px; height:280px; background:#252526; border-radius:4px; border:1px solid #3e3e42; position: relative;">
                        <div style="position:absolute; top:8px; left:10px; font-size:11.5px; color:#aaa; font-weight:bold;">다지교차 북서-남동 방향 (Multi-leg NW-SE)</div>
                        <svg class="ipd-modal-svg" width="100%" height="100%" viewBox="-15 -15 130 130">
                            ${this.getVehSVGPaths('modal-multileg', 'MULTI_LEG_NWSE')}
                            ${this.getPedSVGPaths('modal-multileg', 'MULTI_LEG_NWSE')}
                            ${this.getLabelSVGPaths('modal-multileg', 'MULTI_LEG_NWSE')}
                        </svg>
                    </div>
                </div>

                
                <div id="${this.containerId}-content-scramble" style="display: none; gap: 20px; justify-content: center; margin-bottom: 10px;">
                    <!-- 대각선 횡단보도 (SCRAMBLE) -->
                    <div style="width:280px; height:280px; background:#252526; border-radius:4px; border:1px solid #3e3e42; position: relative;">
                        <div style="position:absolute; top:8px; left:10px; font-size:11.5px; color:#aaa; font-weight:bold;">대각선 횡단보도 (Scramble)</div>
                        <button id="${this.containerId}-btn-scramble-all" class="phase-action-btn phase-btn-purple" style="position:absolute; top:6px; right:10px; font-weight:bold; min-width:80px; padding:3px 8px; font-size:11px;">모두 선택</button>
                        <svg class="ipd-modal-svg" width="100%" height="100%" viewBox="-15 -15 130 130">
                            ${this.getPedSVGPaths('modal-scramble', 'SCRAMBLE')}
                            ${this.getLabelSVGPaths('modal-scramble', 'SCRAMBLE')}
                        </svg>
                    </div>
                </div>
                <div style="margin-top:20px; display:flex; justify-content:flex-end; gap:8px;">
                    <button onclick="document.getElementById('${this.containerId}-modal').style.display='none'" class="phase-action-btn phase-btn-gray">취소</button>
                    <button id="${this.containerId}-modal-clear" class="phase-action-btn phase-btn-red">초기화</button>
                    <button id="${this.containerId}-modal-save" class="phase-action-btn phase-btn-cyan">적용하기</button>
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

        const clearBtn = document.getElementById(this.containerId + '-modal-clear');
        if(clearBtn) {
            clearBtn.addEventListener('click', () => {
                const modalContainer = document.getElementById(this.containerId + '-modal');
                const arrows = modalContainer.querySelectorAll('.ipd-arrow');
                arrows.forEach(arrow => {
                    arrow.classList.remove('ipd-active');
                    this.updateArrowMarker(arrow);
                });
            });
        }

        const saveBtn = document.getElementById(this.containerId + '-modal-save');
        if(saveBtn) {
            saveBtn.addEventListener('click', () => {
                const modalContainer = document.getElementById(this.containerId + '-modal');
                const arrows = modalContainer.querySelectorAll('.ipd-arrow');
                const selected = [];
                arrows.forEach(arrow => {
                    if (arrow.classList.contains('ipd-active')) {
                        selected.push(arrow.getAttribute('data-mov'));
                    }
                });
                this.activeMovements[this.currentEditingCell] = selected;
                this.renderCell(this.currentEditingCell);
                document.getElementById(this.containerId + '-modal').style.display = 'none';

                if (window.STATE && window.STATE.junctions && window.STATE.activeJid) {
                    const j = window.STATE.junctions[window.STATE.activeJid];
                    if (j && j.signalMaps) {
                        const sm = j.signalMaps[window.STATE.currentSignalMapIdx || 0];
                        this.saveToSignalMap(sm, j);
                        if (typeof window.renderRingTables === 'function') {
                            window.renderRingTables();
                        }
                    }
                }
            });
        }

        const tabNormal = document.getElementById(this.containerId + '-tab-normal');
        const tabDiag = document.getElementById(this.containerId + '-tab-diag');
        if(tabNormal && tabDiag) {
            tabNormal.addEventListener('click', () => {
                document.getElementById(this.containerId + '-content-normal').style.display = 'flex';
                document.getElementById(this.containerId + '-content-diag').style.display = 'none';
                tabNormal.classList.replace('phase-btn-gray', 'phase-btn-cyan');
                tabDiag.classList.replace('phase-btn-cyan', 'phase-btn-gray');
            });
            tabDiag.addEventListener('click', () => {
                document.getElementById(this.containerId + '-content-normal').style.display = 'none';
                document.getElementById(this.containerId + '-content-diag').style.display = 'flex';
                document.getElementById(this.containerId + '-content-scramble').style.display = 'none';
                tabDiag.classList.replace('phase-btn-gray', 'phase-btn-cyan');
                tabNormal.classList.replace('phase-btn-cyan', 'phase-btn-gray');
                if(document.getElementById(this.containerId + '-tab-scramble')) document.getElementById(this.containerId + '-tab-scramble').classList.replace('phase-btn-cyan', 'phase-btn-gray');
            });
        }
        
        const tabScramble = document.getElementById(this.containerId + '-tab-scramble');
        if(tabScramble) {
            tabScramble.addEventListener('click', () => {
                document.getElementById(this.containerId + '-content-normal').style.display = 'none';
                document.getElementById(this.containerId + '-content-diag').style.display = 'none';
                document.getElementById(this.containerId + '-content-scramble').style.display = 'flex';
                tabScramble.classList.replace('phase-btn-gray', 'phase-btn-cyan');
                if(tabNormal) tabNormal.classList.replace('phase-btn-cyan', 'phase-btn-gray');
                if(tabDiag) tabDiag.classList.replace('phase-btn-cyan', 'phase-btn-gray');
            });
        }
        
        // Add listener to Normal tab to clear scramble
        if(tabNormal) {
            const origNormal = tabNormal.onclick;
            tabNormal.addEventListener('click', () => {
                document.getElementById(this.containerId + '-content-scramble').style.display = 'none';
                if(tabScramble) tabScramble.classList.replace('phase-btn-cyan', 'phase-btn-gray');
            });
        }

        const btnScrambleAll = document.getElementById(this.containerId + '-btn-scramble-all');
        if(btnScrambleAll) {
            btnScrambleAll.addEventListener('click', () => {
                const modalContainer = document.getElementById(this.containerId + '-modal');
                const peds = ['PED-NWSE', 'PED-NESW', 'PED-N', 'PED-S', 'PED-E', 'PED-W'];
                
                // Check if ALL are active
                let allActive = true;
                peds.forEach(p => {
                    const arr = modalContainer.querySelector(`.ipd-arrow[data-mov="${p}"]`);
                    if (!arr || !arr.classList.contains('ipd-active')) allActive = false;
                });
                
                peds.forEach(p => {
                    const relatedArrows = modalContainer.querySelectorAll(`.ipd-arrow[data-mov="${p}"]`);
                    relatedArrows.forEach(arr => {
                        if (allActive) arr.classList.remove('ipd-active');
                        else arr.classList.add('ipd-active');
                        this.updateArrowMarker(arr);
                    });
                });
            });
        }

        const modalContainer = document.getElementById(this.containerId + '-modal');
        if(modalContainer) {
            const modalArrows = modalContainer.querySelectorAll('.ipd-arrow');
            modalArrows.forEach(arrow => {
                arrow.addEventListener('click', () => {
                    const mov = arrow.getAttribute('data-mov');
                    const isActive = !arrow.classList.contains('ipd-active');
                    const relatedArrows = modalContainer.querySelectorAll(`.ipd-arrow[data-mov="${mov}"]`);
                    relatedArrows.forEach(arr => {
                        if (isActive) arr.classList.add('ipd-active');
                        else arr.classList.remove('ipd-active');
                        this.updateArrowMarker(arr);
                    });
                });
            });
            
            const modalLabels = modalContainer.querySelectorAll('.ipd-text-label');
            modalLabels.forEach(label => {
                label.addEventListener('click', () => {
                    const mov = label.getAttribute('data-mov');
                    const firstArrow = modalContainer.querySelector(`.ipd-arrow[data-mov="${mov}"]`);
                    if (firstArrow) {
                        const isActive = !firstArrow.classList.contains('ipd-active');
                        const relatedArrows = modalContainer.querySelectorAll(`.ipd-arrow[data-mov="${mov}"]`);
                        relatedArrows.forEach(arr => {
                            if (isActive) arr.classList.add('ipd-active');
                            else arr.classList.remove('ipd-active');
                            this.updateArrowMarker(arr);
                        });
                    }
                });
            });
        }
    }

    openModal(cellId) {
        this.currentEditingCell = cellId;
        document.getElementById(this.containerId + '-modal-title').innerText = cellId;
        
        const activeMovs = this.activeMovements[cellId] || [];
        const modalContainer = document.getElementById(this.containerId + '-modal');
        const arrows = modalContainer.querySelectorAll('.ipd-arrow');
        
        arrows.forEach(arrow => {
            const mov = arrow.getAttribute('data-mov');
            if (activeMovs.includes(mov)) {
                arrow.classList.add('ipd-active');
            } else {
                arrow.classList.remove('ipd-active');
            }
            this.updateArrowMarker(arrow);
        });

        document.getElementById(this.containerId + '-modal').style.display = 'flex';
    }

    renderCell(cellId) {
        const cellNode = document.getElementById(this.containerId + '-cell-' + cellId);
        if (!cellNode) return;
        
        const svg = document.getElementById(this.containerId + '-svg-' + cellId);
        if (!svg) return;
        
        const activeMovs = this.activeMovements[cellId] || [];
        const arrows = cellNode.querySelectorAll('.ipd-arrow');
        
        const BBOX = {
            'NBL': {x:46, y:60, w:10, h:25}, 'NBL-P': {x:42, y:55, w:10, h:30}, 'NBT': {x:68, y:55, w:0, h:30}, 'NBR': {x:80, y:60, w:10, h:25},
            'NDL': {x:52, y:50, w:10, h:35}, 'NDR': {x:74, y:50, w:10, h:35},
            'SBL': {x:44, y:15, w:10, h:25}, 'SBL-P': {x:48, y:15, w:10, h:30}, 'SBT': {x:32, y:15, w:0, h:30}, 'SBR': {x:10, y:15, w:10, h:25},
            'SDL': {x:38, y:15, w:10, h:35}, 'SDR': {x:16, y:15, w:10, h:35},
            'EBL': {x:15, y:46, w:25, h:10}, 'EBL-P': {x:15, y:46, w:30, h:14}, 'EBT': {x:15, y:68, w:30, h:0}, 'EBR': {x:15, y:80, w:25, h:10},
            'EDL': {x:15, y:52, w:35, h:10}, 'EDR': {x:15, y:74, w:35, h:10},
            'WBL': {x:60, y:44, w:25, h:10}, 'WBL-P': {x:55, y:40, w:30, h:14}, 'WBT': {x:55, y:32, w:30, h:0}, 'WBR': {x:60, y:10, w:25, h:10},
            'WDL': {x:50, y:38, w:35, h:10}, 'WDR': {x:50, y:16, w:35, h:10}
        };

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        let hasActiveVeh = false;

        arrows.forEach(arrow => {
            const mov = arrow.getAttribute('data-mov');
            if (activeMovs.includes(mov)) {
                arrow.classList.add('ipd-active');
                this.updateArrowMarker(arrow);
            } else {
                arrow.classList.remove('ipd-active');
            }
        });

        activeMovs.forEach(mov => {
            if (mov.startsWith('PED-')) return;
            const box = BBOX[mov];
            if (box) {
                minX = Math.min(minX, box.x);
                minY = Math.min(minY, box.y);
                maxX = Math.max(maxX, box.x + box.w);
                maxY = Math.max(maxY, box.y + box.h);
                hasActiveVeh = true;
            }
        });

        if (hasActiveVeh) {
            const cx = (minX + maxX) / 2;
            const cy = (minY + maxY) / 2;
            const objW = maxX - minX;
            const objH = maxY - minY;
            const pad = 10;
            const size = Math.max(objW + 2*pad, objH + 2*pad, 40);
            svg.setAttribute('viewBox', `${cx - size/2} ${cy - size/2} ${size} ${size}`);
        } else {
            svg.setAttribute('viewBox', '0 0 100 100');
        }
    }

    updateArrowMarker(arrow) {
        const isActive = arrow.classList.contains('ipd-active');
        const color = isActive ? 'blue' : 'gray';
        
        if (arrow.classList.contains('ipd-ped')) {
            arrow.setAttribute('marker-start', `url(#${this.containerId}-ah-${color}-rev)`);
            arrow.setAttribute('marker-end', `url(#${this.containerId}-ah-${color})`);
        } else {
            arrow.setAttribute('marker-end', `url(#${this.containerId}-ah-${color})`);
        }
    }
}

window.InteractivePhaseDiagram = InteractivePhaseDiagram;

// Auto-initialize robustly
let initAttempts = 0;
function tryInitIPD() {
    if (document.getElementById('interactive-phase-container') && !window.ipdInstance) {
        window.ipdInstance = new InteractivePhaseDiagram('interactive-phase-container');
        // Restore data if already loaded
        if (window.STATE && window.STATE.junctions && window.STATE.activeJid) {
            const j = window.STATE.junctions[window.STATE.activeJid];
            if (j && j.signalMaps) window.ipdInstance.loadFromSignalMap(j.signalMaps[window.STATE.currentSignalMapIdx || 0]);
        }
    } else if (!window.ipdInstance && initAttempts < 10) {
        initAttempts++;
        setTimeout(tryInitIPD, 500);
    }
}
setTimeout(tryInitIPD, 100);
