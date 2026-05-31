/**
 * Road Network Generator & Editor (Beta)
 * Logic: ARN (8 Sectors) + Acyclic + Integrity Check
 * Editor: Alt+Click delete, Node-to-Node add
 */

class RoadNetworkManager {
    constructor() {
        this.nodes = [];
        this.edges = []; // Array of [uIdx, vIdx]
        this.layerGroup = null;
        this.isActive = false;      // 데이터 로드 여부
        this.isEditMode = false;    // 편집 가능 여부
        this.baseWeight = 2;        // 도로망 기본 선 굵기
        this.selectedNode = null;
        this.highlightGroupId = null;
        this.edgeSet = new Set();    // [최적화] 중복 체크용 고속 Set
        this.labelLayer = null;      // [최적화] 가시 범위 기반 텍스트 라벨 전용 레이어
        this.canvasRenderer = L.canvas({ padding: 0.5, tolerance: 20 }); 
    }

    /**
     * 모든 데이터 초기화 및 레이어 제거
     */
    clear() {
        this.nodes = [];
        this.edges = [];
        this.edgeSet.clear();
        this.isActive = false;

        // [핵심 수정] 잔상 방지를 위해 외부 로드된 레이어(data.js의 geoJsonLayer)도 함께 소탕
        if (typeof STATE !== 'undefined' && STATE.geoJsonLayer && window.map) {
            window.map.removeLayer(STATE.geoJsonLayer);
            STATE.geoJsonLayer = null;
        }

        if (this.layerGroup && map) {
            map.removeLayer(this.layerGroup);
            this.layerGroup = null;
        }
    }

    /**
     * 메인 생성 로직
     */
    generate(junctions) {
        if (!junctions || junctions.length === 0) return;

        // 분석 시작 전에도 기존 외부 레이어를 미리 청소하여 중복 방지
        if (typeof STATE !== 'undefined' && STATE.geoJsonLayer && window.map) {
            window.map.removeLayer(STATE.geoJsonLayer);
            STATE.geoJsonLayer = null;
        }

        console.log("[RoadNetwork] Starting generation for", junctions.length, "nodes");

        this.nodes = junctions.map((j, i) => ({
            ...j,
            index: i,
            group: String(j.group || 'default'),
            x: j.lng, // Using simple lng/lat for quadtree, roughly OK for local Seou area
            y: j.lat,
            adj: new Set()
        }));

        this.edges = [];
        this.edgeSet.clear(); // [필수] 재분석 시 중복 체크용 Set을 반드시 초기화해야 함

        const groups = {};
        this.nodes.forEach(n => {
            if (!groups[n.group]) groups[n.group] = [];
            groups[n.group].push(n);
        });
        for (const gid in groups) {
            this._processGroup(groups[gid]);
        }

        console.log("[RoadNetwork] Generation complete. Edges:", this.edges.length);
        this.isActive = true;
        this.render();
    }

    /**
     * STATE.junctions와 this.nodes 간의 정합성 유지 (새로 추가된 데이터 반영)
     */
    _syncNodesInternal() {
        const junctions = Object.values(STATE.junctions || {});
        if (junctions.length === 0) return;

        // 기존 노드들의 ID 맵핑 (업데이트 및 중복 방지)
        const existingNodeMap = new Map(this.nodes.map(n => [String(n.id), n]));

        // 새로운 노드 리스트 생성 (기존 노드는 유지, 새 노드는 추가)
        const newNodes = junctions.map((j, i) => {
            const idStr = String(j.id);
            if (existingNodeMap.has(idStr)) {
                const node = existingNodeMap.get(idStr);
                // 주소지/좌표/그룹 등 속성 최신화 (인덱스는 유지)
                node.lat = j.lat;
                node.lng = j.lng;
                node.x = j.lng;
                node.y = j.lat;
                node.group = String(j.group || 'default');
                node.name = j.name;
                return node;
            } else {
                // 완전히 새로운 노드
                return {
                    ...j,
                    index: i, // 임시 인덱스는 .map이 끝난 후 다시 부여
                    group: String(j.group || 'default'),
                    x: j.lng,
                    y: j.lat,
                    adj: new Set()
                };
            }
        });

        // 인덱스 재부여 (동기화)
        newNodes.forEach((n, idx) => n.index = idx);
        this.nodes = newNodes;
    }

    /**
     * 특정 그룹에 대해서만 재생성 (기존 수정 데이터 보존 목적)
     */
    generateForGroup(groupId) {
        // 항상 최신 교차로 데이터를 동기화
        this._syncNodesInternal();

        if (this.nodes.length === 0) return;
        this.isActive = true;

        const gidStr = String(groupId);
        console.log("[RoadNetwork] Regenerating for group:", gidStr);

        // 1. 해당 그룹을 포함하는 기존 엣지들 제거
        for (let i = this.edges.length - 1; i >= 0; i--) {
            const [ui, vi] = this.edges[i];
            if (this.nodes[ui].group === gidStr || this.nodes[vi].group === gidStr) {
                this._removeEdgeByIndex(i);
            }
        }

        // 2. 해당 그룹 노드 선별 및 adj 초기화
        const groupNodes = this.nodes.filter(n => n.group === gidStr);
        if (groupNodes.length < 2) {
            console.log("[RoadNetwork] Group nodes < 2, cannot form network");
            this.isActive = true;
            this.render();
            return;
        }
        groupNodes.forEach(n => n.adj.clear());

        // 3. ARN 프로세스 수행
        this._processGroup(groupNodes);

        console.log("[RoadNetwork] Group analysis complete.");
        this.isActive = true;
        this.render();
    }

    /**
     * [신규] 주기(Cycle) 기준으로 연동망 생성
     */
    generateByCycle(junctions, dIdx, targetSec) {
        if (typeof STATE !== 'undefined' && STATE.geoJsonLayer && window.map) {
            window.map.removeLayer(STATE.geoJsonLayer);
            STATE.geoJsonLayer = null;
        }

        console.log("[RoadNetwork] Starting generation by cycle for", junctions.length, "nodes");

        this.nodes = junctions.map((j, i) => {
            let cycle = 0;
            if (typeof getSimContext === 'function' && typeof getLinkedSchedule === 'function' && typeof findActiveSchedIdx === 'function') {
                // [Fix] 스케줄표의 고정값이 아닌, 실제 구동되는 스플릿의 합계를 추적합니다.
                const ctx = getSimContext(j, targetSec);
                const sched = getLinkedSchedule(j, ctx.dayIdx) || (j.schedules ? j.schedules[ctx.dayIdx] : null);
                const activeIdx = (sched && Array.isArray(sched)) ? findActiveSchedIdx(sched, targetSec) : 0;
                
                const p = (j.dayPlans && j.dayPlans[ctx.dayIdx]) ? j.dayPlans[ctx.dayIdx][activeIdx] : null;
                if (p && p.splitA) {
                    // [반올림] 소수점 오차로 인한 동일주기 매칭 실패 방지
                    cycle = Math.round(p.splitA.reduce((a, b) => a + b, 0));
                }
                if (!cycle && sched && sched[activeIdx]) {
                    cycle = sched[activeIdx].cycle || 0;
                }
            } else if (typeof getCurrentOperatingCycle === 'function') {
                cycle = getCurrentOperatingCycle(j, targetSec);
            } else {
                // Fallback
                const sched = j.schedules[dIdx];
                if (sched) {
                    let activeIdx = 0, maxSec = -1;
                    sched.forEach((sc, idx) => {
                        if (sc && sc.h !== -1) {
                            const total = sc.h * 3600 + sc.m * 60;
                            if (targetSec >= total && total > maxSec) { maxSec = total; activeIdx = idx; }
                        }
                    });
                    if (sched[activeIdx] && sched[activeIdx].cycle > 0) cycle = sched[activeIdx].cycle;
                }
            }
            
            return {
                ...j,
                index: i,
                group: cycle > 0 ? `C${cycle}` : 'default', // 그룹을 주기로 덮어씀
                originalGroup: String(j.group || 'default'),
                x: j.lng,
                y: j.lat,
                adj: new Set()
            };
        });

        this.edges = [];
        this.edgeSet.clear();

        const groups = {};
        this.nodes.forEach(n => {
            if (n.group === 'default' || n.group === 'C0') return; // 주기가 없는 경우 제외
            if (!groups[n.group]) groups[n.group] = [];
            groups[n.group].push(n);
        });

        for (const gid in groups) {
            this._processGroup(groups[gid], true);
        }

        console.log("[RoadNetwork] Generation by cycle complete. Edges:", this.edges.length);
        this.isActive = true;
        this.render();
    }

    _processGroup(groupNodes, isCycleAnalysis = false) {
        if (groupNodes.length < 2) return;

        // Seoul area coordinate correction (1deg Lat != 1deg Lng)
        // 37.5 deg N: Cos(37.5) is approx 0.793
        const DIST_KAP = 0.793;
        const getDistSq = (a, b) => ((a.x - b.x) * DIST_KAP) ** 2 + (a.y - b.y) ** 2;

        const BASE_LIMIT = 300 / 111320; // 300m
        const BRIDGE_LIMIT = isCycleAnalysis ? (300 / 111320) : (800 / 111320); // 800m (동일주기 분석시 300m 제한)
        const distSq = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

        const quadtree = d3.quadtree()
            .x(d => d.x)
            .y(d => d.y)
            .addAll(groupNodes);

        // 1. ARN Step (Collect candidates)
        const candidates = [];
        groupNodes.forEach(u => {
            const sectors = Array.from({ length: 8 }, () => []);
            quadtree.visit((node, x1, y1, x2, y2) => {
                if (!node.length) {
                    do {
                        const v = node.data;
                        if (v.id !== u.id) {
                            const d2 = getDistSq(u, v);
                            if (d2 <= BASE_LIMIT ** 2) {
                                const angle = (Math.atan2(v.y - u.y, v.x - u.x) * 180 / Math.PI + 360) % 360;
                                const sIdx = Math.floor(angle / 45) % 8;
                                sectors[sIdx].push({ node: v, d2 });
                            }
                        }
                    } while (node = node.next);
                }
                return x1 > u.x + BASE_LIMIT || x2 < u.x - BASE_LIMIT || y1 > u.y + BASE_LIMIT || y2 < u.y - BASE_LIMIT;
            });

            sectors.forEach(list => {
                if (list.length > 0) {
                    list.sort((a, b) => a.d2 - b.d2);
                    const v = list[0].node;
                    // Sort ID to avoid [u,v] vs [v,u] duplicates
                    const pair = [u.index, v.index].sort((a, b) => a - b);
                    candidates.push({ u, v, d2: list[0].d2, key: pair.join('-') });
                }
            });
        });

        // 2. Add non-crossing edges sorted by distance
        const uniqueCandidates = Array.from(new Map(candidates.map(c => [c.key, c])).values());
        uniqueCandidates.sort((a, b) => a.d2 - b.d2);

        uniqueCandidates.forEach(c => {
            if (!this._wouldIntersect(c.u, c.v)) {
                this._addEdgeRaw(c.u, c.v);
            }
        });

        // 3. Connectivity Step (Bridge components with crossing check)
        this._ensureGroupConnectivity(groupNodes, BRIDGE_LIMIT);

        // 3. Global Triangle Pruning (Ensure Acyclic linear topology)
        this._pruneTrianglesInGroup(groupNodes);
    }

    _ensureGroupConnectivity(groupNodes, bridgeLimit) {
        const DIST_KAP = 0.793;
        const getDistSq = (a, b) => ((a.x - b.x) * DIST_KAP) ** 2 + (a.y - b.y) ** 2;

        const n = groupNodes.length;
        const uf = new UnionFind(n);
        const nodeToLocalIdx = new Map(groupNodes.map((node, i) => [node.id, i]));

        const sync = () => {
            groupNodes.forEach((u, i) => {
                u.adj.forEach(v => {
                    const vi = nodeToLocalIdx.get(v.id);
                    if (vi !== undefined) uf.union(i, vi);
                });
            });
        };
        sync();

        if (uf.count > 1) {
            const getComponents = () => {
                const comps = {};
                groupNodes.forEach((node, i) => {
                    const r = uf.find(i);
                    if (!comps[r]) comps[r] = [];
                    comps[r].push(node);
                });
                return comps;
            };

            for (let retry = 0; retry < 3 && uf.count > 1; retry++) {
                let comps = getComponents();
                const roots = Object.keys(comps);

                for (let i = 0; i < roots.length; i++) {
                    for (let j = i + 1; j < roots.length; j++) {
                        const r1 = roots[i]; const r2 = roots[j];
                        if (uf.find(r1) === uf.find(r2)) continue;

                        let minD2 = Infinity;
                        let bU = null; let bV = null;

                        comps[r1].forEach(u => {
                            comps[r2].forEach(v => {
                                const d2 = getDistSq(u, v);
                                if (d2 < minD2) {
                                    minD2 = d2; bU = u; bV = v;
                                }
                            });
                        });

                        if (bU && minD2 <= bridgeLimit ** 2) {
                            // 브릿지 생성 시에도 교차 여부 확인
                            if (!this._wouldIntersect(bU, bV)) {
                                this._addEdgeRaw(bU, bV);
                                uf.union(nodeToLocalIdx.get(bU.id), nodeToLocalIdx.get(bV.id));
                            }
                        }
                    }
                }
            }
        }
    }

    _pruneTrianglesInGroup(groupNodes) {
        // Seoul projection correction
        const DIST_KAP = 0.793;
        const getDistSq = (a, b) => ((a.x - b.x) * DIST_KAP) ** 2 + (a.y - b.y) ** 2;

        let changed = true;
        let limit = 0;
        while (changed && limit < 2000) {
            changed = false;
            limit++;
            // Iterate backwards to safely remove elements
            for (let i = this.edges.length - 1; i >= 0; i--) {
                const [ui, vi] = this.edges[i];
                const u = this.nodes[ui];
                const v = this.nodes[vi];

                // Ensure u and v are part of the current groupNodes
                // This check is implicitly handled if edges are only within groups,
                // but good for robustness if edges could span groups.
                // For now, assuming edges are within the group being processed.

                const dUV = getDistSq(u, v);
                for (let w of u.adj) {
                    // Check if w is also adjacent to v, forming a triangle (u,v,w)
                    if (v.adj.has(w)) {
                        // Ensure w is also in the current groupNodes if necessary
                        // (again, assuming group-internal edges)

                        const dUW = getDistSq(u, w);
                        const dVW = getDistSq(v, w);
                        const maxD2 = Math.max(dUV, dUW, dVW);

                        // Floating point epsilon handling
                        if (Math.abs(dUV - maxD2) < 1e-10) { // Current edge (u,v) is the longest
                            this._removeEdgeByIndex(i);
                            changed = true;
                            break; // Break from inner loop (w) to re-evaluate edges
                        } else if (Math.abs(dUW - maxD2) < 1e-10) { // Edge (u,w) is the longest
                            this._removeEdgeRaw(u, w);
                            changed = true;
                            break;
                        } else if (Math.abs(dVW - maxD2) < 1e-10) { // Edge (v,w) is the longest
                            this._removeEdgeRaw(v, w);
                            changed = true;
                            break;
                        }
                    }
                }
                if (changed) break; // Break from outer loop (edges) to restart iteration
            }
        }
    }

    _addEdgeRaw(u, v) {
        if (u.id === v.id || u.adj.has(v)) return;
        u.adj.add(v);
        v.adj.add(u);
        const pair = [u.index, v.index].sort((a, b) => a - b);
        const key = pair.join('-');
        if (!this.edgeSet.has(key)) {
            this.edgeSet.add(key);
            this.edges.push(pair);
        }
    }

    _removeEdgeRaw(u, v) {
        u.adj.delete(v);
        v.adj.delete(u);
        const pair = [u.index, v.index].sort((a, b) => a - b);
        this.edgeSet.delete(`${pair[0]}-${pair[1]}`); // [Fix] edgeSet에서도 삭제해야 다시 추가 가능
        const idx = this.edges.findIndex(e => e[0] === pair[0] && e[1] === pair[1]);
        if (idx !== -1) {
            this.edges.splice(idx, 1);
        }
    }

    _removeEdgeByIndex(idx) {
        const [ui, vi] = this.edges[idx];
        const u = this.nodes[ui];
        const v = this.nodes[vi];
        u.adj.delete(v);
        v.adj.delete(u);
        this.edgeSet.delete(`${Math.min(ui, vi)}-${Math.max(ui, vi)}`);
        this.edges.splice(idx, 1);
    }

    /**
     * 시각화 및 인터랙션 렌더링
     */
    render() {
        if (!map) return;
        if (this.layerGroup) map.removeLayer(this.layerGroup);
        this.layerGroup = L.layerGroup().addTo(map);

        // 1. Edges Rendering (은은하고 반투명한 유리 디자인)
        this.edges.forEach((pair) => {
            const u = this.nodes[pair[0]];
            const v = this.nodes[pair[1]];
            const color = this._getGroupColor(u.group);
            const isHighlightGroup = (this.highlightGroupId && u.group === this.highlightGroupId);

            L.polyline([[u.lat, u.lng], [v.lat, v.lng]], {
                color: isHighlightGroup ? '#2ecc71' : color, // 강조 시에만 에메랄드 컬러
                weight: isHighlightGroup ? 8 : 5.5,
                opacity: isHighlightGroup ? 0.8 : 0.4, // 반투명 감각 강조
                lineJoin: 'round',
                lineCap: 'round',
                renderer: this.canvasRenderer,
                interactive: false,
                pane: 'overlayPane'
            }).addTo(this.layerGroup);
        });

        // 2. Nodes for selection
        if (this.isEditMode || this.highlightGroupId) {
            this.nodes.forEach(u => {
                const isSelected = (this.selectedNode === u);
                const isHighlighted = (this.highlightGroupId && u.group === this.highlightGroupId);

                if (!this.isEditMode && !isHighlighted) return;

                L.circleMarker([u.lat, u.lng], {
                    radius: isSelected ? 12 : 10, // 노드를 큼직하게 만들어 선택 편의성 극대화
                    fillColor: isSelected ? '#fbc531' : (isHighlighted ? '#ff00ff' : '#00f3ff'),
                    fillOpacity: 1.0,
                    color: '#fff',
                    weight: isSelected ? 4 : 2,
                    interactive: true,
                    // [변경] 리플렛의 표준 마커 레이어(markerPane)를 사용하고 최상위권(5000) 유지
                    pane: 'markerPane', 
                    zIndexOffset: isSelected ? 5000 : 4500 
                }).on('click', (e) => {
                    L.DomEvent.stopPropagation(e);
                    // [성능] 편집 모드 활성화 상태라면 직접 처리
                    if (this.isEditMode) {
                        this.handleNodeClick(u);
                    }
                }).addTo(this.layerGroup);

                // [최근 변경] 전역 툴팁 생성 로직 삭제 (성능 상의 이유로 _updateLabelsView에서 처리)
            });
        }

        // 3. Global Interaction Handlers & Viewport Labels
        this._setupGlobalHandlers();
        this._updateLabelsView();
    }

    /**
     * [성능 최적화] 지도의 현재 가시 범위(Viewport) 내의 노드에만 그룹 번호를 표시
     */
    _updateLabelsView() {
        if (!map || !this.isActive || (!this.isEditMode && !this.highlightGroupId)) {
            if (this.labelLayer) map.removeLayer(this.labelLayer);
            this.labelLayer = null;
            return;
        }

        // 1. 라벨 전용 레이어 초기화 (기존 화면 밖 요소 제거)
        if (!this.labelLayer) {
            this.labelLayer = L.layerGroup().addTo(map);
        } else {
            this.labelLayer.clearLayers();
        }

        // 2. 현재 화면 영역(Bounds) 확보
        const bounds = map.getBounds();
        const highlightedGid = this.highlightGroupId;

        // 3. 보이는 영역 내의 노드만 필터링하여 라벨 생성
        this.nodes.forEach(u => {
            const isHighlighted = (highlightedGid && u.group === highlightedGid);
            if (!this.isEditMode && !isHighlighted) return;

            // 좌표가 현재 화면 영역 안에 있는지만 체크 (매우 빠름)
            if (bounds.contains([u.lat, u.lng])) {
                L.tooltip({
                    permanent: true,
                    direction: 'bottom',
                    className: 'network-group-label',
                    offset: [0, 8],
                    opacity: 0.9,
                    pane: 'tooltipPane' // 가시성 방해 금지
                })
                .setContent(`G:${u.group}`)
                .setLatLng([u.lat, u.lng])
                .addTo(this.labelLayer);
            }
        });
    }

    _setupGlobalHandlers() {
        if (this._handlersSetup) return;
        
        // [성능] 지도 이동이 끝날 때마다 화면 내의 라벨만 다시 그림
        map.on('moveend zoomend', () => {
            if (this.isActive && (this.isEditMode || this.highlightGroupId)) {
                this._updateLabelsView();
            }
        });

        // Visual Feedback Layer for Deletion
        const previewLayer = L.layerGroup().addTo(map);
        let lastNearest = null;

        map.on('mousemove', (e) => {
            if (!this.isActive || !this.isEditMode || !e.originalEvent.altKey) {
                previewLayer.clearLayers();
                return;
            }

            const nearest = this._findNearestEdge(e.latlng);
            if (nearest && nearest.dist < 15) {
                if (lastNearest !== nearest.idx) {
                    previewLayer.clearLayers();
                    const u = this.nodes[nearest.pair[0]];
                    const v = this.nodes[nearest.pair[1]];
                    L.polyline([[u.lat, u.lng], [v.lat, v.lng]], {
                        color: '#ff4757',
                        weight: this.baseWeight + 3,
                        opacity: 1,
                        dashArray: '5, 5'
                    }).addTo(previewLayer);
                    lastNearest = nearest.idx;
                }
            } else {
                previewLayer.clearLayers();
                lastNearest = null;
            }
        });

        map.on('mousedown', (e) => {
            // Dragging might interfere, deletion handles better in 'click' or dedicated handler
            // Removing mousedown handler to prevent redundancy
        });

        // Keyboard Cursor & Interaction State
        window.addEventListener('keydown', (e) => {
            if (!this.isActive || !this.isEditMode) return;
            if (e.altKey) {
                map.getContainer().classList.add('map-edit-delete');
            }
        });
        window.addEventListener('keyup', (e) => {
            if (this.isActive) {
                map.getContainer().classList.remove('map-edit-delete');
            }
        });

        // Use 'click' for deletion to ensure it happens after mousedown/mouseup cycle
        map.on('click', (e) => {
            if (!this.isActive || !this.isEditMode) return;

            // Alt+Click Deletion (Geometric Hit-Test)
            if (e.originalEvent.altKey || e.originalEvent.ctrlKey) {
                const nearest = this._findNearestEdge(e.latlng);
                if (nearest && nearest.dist < 20) {
                    console.log("[RoadNetwork] Precise Edge Removal:", nearest.pair);
                    this.removeEdge(nearest.pair);
                    previewLayer.clearLayers();
                }
            }
        });

        this._handlersSetup = true;
    }

    _findNearestEdge(latlng) {
        const edgeCount = this.edges.length;
        if (edgeCount === 0) return null;

        const p = map.latLngToLayerPoint(latlng);
        let minDist = Infinity;
        let nearest = null;

        // [최적화] 좌표 변환(latLngToLayerPoint)은 루프 밖에서 필요한 노드만 최소화하여 수행
        // 화면에 보이는 범위 등 추가 필터링이 가능하나 여기서는 연산 최적화에 집중
        const projectedNodes = new Map();

        for (let i = 0; i < edgeCount; i++) {
            const pair = this.edges[i];
            const uIdx = pair[0];
            const vIdx = pair[1];

            if (!projectedNodes.has(uIdx)) projectedNodes.set(uIdx, map.latLngToLayerPoint([this.nodes[uIdx].lat, this.nodes[uIdx].lng]));
            if (!projectedNodes.has(vIdx)) projectedNodes.set(vIdx, map.latLngToLayerPoint([this.nodes[vIdx].lat, this.nodes[vIdx].lng]));

            const u = projectedNodes.get(uIdx);
            const v = projectedNodes.get(vIdx);

            // 단순 거리 계산은 매우 빠름
            const dist = L.LineUtil.pointToSegmentDistance(p, u, v);
            if (dist < minDist) {
                minDist = dist;
                nearest = { pair, dist, idx: i };
                if (dist < 3) break; // 충분히 가까우면 조기 종료
            }
        }
        return nearest;
    }

    handleNodeClick(node) {
        if (!node) return;

        // [추가] 만약 node가 this.nodes에 속하지 않은 구버전 객체라면 최신 객체로 치환
        const targetNode = this.nodes.find(n => String(n.id) === String(node.id)) || node;

        if (this.selectedNode === targetNode) {
            // 1. 이미 선택된 노드를 다시 클릭하면 선택 해제
            this.selectedNode = null;
            this.highlightGroupId = null;
            this.render();
        } else if (this.selectedNode) {
            // 2. 다른 노드가 선택된 상태에서 두 번째 노드 클릭
            const group1 = String(this.selectedNode.group || 'default');
            const group2 = String(targetNode.group || 'default');

            if (group1 !== group2) {
                // [그룹 미일치] 선택 대상만 변경 (사용자 요청: 그룹 다르면 생성 안 됨)
                this.selectedNode = targetNode;
                this.highlightGroupId = group2;
                if (typeof selectJunction === 'function') selectJunction(targetNode.id); // [추가] 정보 탭 연동
                this.render();
            } else {
                // [그룹 일치] - 링크 토글 (있으면 삭제, 없으면 추가)
                const key = [this.selectedNode.index, targetNode.index].sort((a, b) => a - b).join('-');
                if (this.edgeSet.has(key)) {
                    // 이미 링크가 있으면 삭제
                    this._removeEdgeRaw(this.selectedNode, targetNode);
                    console.log("[RoadNetwork] Edge Removed:", key);
                } else {
                    // 링크가 없으면 추가 (교차 확인 후)
                    if (this._wouldIntersect(this.selectedNode, targetNode)) {
                        alert("⚠️ 교차 링크 제한: 해당 구간을 연결하면 기존 링크와 교차하게 됩니다.");
                    } else {
                        this._addEdgeRaw(this.selectedNode, targetNode);
                        console.log("[RoadNetwork] Edge Created:", key);
                    }
                }
                
                // [복구] 다음 연속 편집을 위해 현재 노드를 다시 선택된 노드로 설정
                this.selectedNode = targetNode; 
                if (typeof selectJunction === 'function') selectJunction(targetNode.id); // 정보 탭 연동
                this.render();
            }
        } else {
            // 3. 아무것도 선택되지 않은 상태에서 첫 번째 노드 클릭
            this.selectedNode = targetNode;
            this.highlightGroupId = String(targetNode.group || 'default');
            if (typeof selectJunction === 'function') selectJunction(targetNode.id); // [추가] 정보 탭 연동
            this.render();
        }
    }

    removeEdge(pair) {
        const u = this.nodes[pair[0]];
        const v = this.nodes[pair[1]];
        u.adj.delete(v);
        v.adj.delete(u);
        this.edgeSet.delete(`${Math.min(pair[0], pair[1])}-${Math.max(pair[0], pair[1])}`);
        const idx = this.edges.findIndex(e => e[0] === pair[0] && e[1] === pair[1]);
        if (idx !== -1) this.edges.splice(idx, 1);
        this.render();
    }

    _getGroupColor(gid) {
        if (gid === undefined || gid === null || gid === '' || gid === 'default' || gid === 0 || gid === '0') return '#00d4ff';
        const str = String(gid);
        
        // [동일주기 분석 색상] C100, C130 등의 포맷일 경우 utils.js의 getCycleColor 재사용
        if (str.startsWith('C') && !isNaN(parseInt(str.substring(1)))) {
            const cycle = parseInt(str.substring(1));
            if (typeof getCycleColor === 'function') {
                return getCycleColor(cycle);
            }
        }

        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash |= 0;
        }
        return `hsl(${(Math.abs(hash) * 137.5) % 360}, 75%, 65%)`;
    }

    /**
     * 선분 교차 판별 (CCW 알고리즘)
     */
    _doIntersect(u1, v1, u2, v2) {
        // 끝점을 공유하는 경우는 교차로 보지 않음
        if (u1.id === u2.id || u1.id === v2.id || v1.id === u2.id || v1.id === v2.id) return false;

        const ccw = (a, b, c) => {
            const area = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
            if (Math.abs(area) < 1e-15) return 0;
            return area > 0 ? 1 : -1;
        };

        const abc = ccw(u1, v1, u2);
        const abd = ccw(u1, v1, v2);
        const cda = ccw(u2, v2, u1);
        const cdb = ccw(u2, v2, v1);

        return (abc * abd < 0) && (cda * cdb < 0);
    }

    /**
     * 특정 선분(u-v)이 현재 그룹 내 다른 선분과 교차하는지 확인
     */
    _wouldIntersect(u, v) {
        const gid = u.group;
        for (let i = 0; i < this.edges.length; i++) {
            const [ui, vi] = this.edges[i];
            const nodeU = this.nodes[ui];
            const nodeV = this.nodes[vi];
            if (nodeU.group === gid && this._doIntersect(u, v, nodeU, nodeV)) return true;
        }
        return false;
    }

    /**
     * 편집 모드 진입 전 STATE.junctions와 this.nodes 간의 데이터 동기화
     */
    _syncNodesInternal() {
        const junctions = Object.values(STATE.junctions || {});
        if (junctions.length === 0) return;

        // 기존 인접 리스트(adj) 정보 백업 (ID 기준)
        const adjBackup = new Map();
        if (this.nodes) {
            this.nodes.forEach(n => {
                if (n.adj) adjBackup.set(String(n.id), Array.from(n.adj).map(v => String(v.id)));
            });
        }

        // 최신 교차로 정보로 노드 리스트 재생성
        this.nodes = junctions.map((j, i) => ({
            ...j,
            index: i,
            group: String(j.group || 'default'),
            x: j.lng,
            y: j.lat,
            adj: new Set()
        }));

        // 인접 정보 복구
        const nodeById = new Map(this.nodes.map(n => [String(n.id), n]));
        adjBackup.forEach((neighbors, uId) => {
            const u = nodeById.get(uId);
            if (!u) return;
            neighbors.forEach(vId => {
                const v = nodeById.get(vId);
                if (v) u.adj.add(v);
            });
        });

        console.log("[RoadNetwork] Internal Nodes Synchronized with STATE.");
    }

    importJSON(data) {
        if (!data || !data.features) return;

        console.log("[RoadNetwork] Importing network JSON with", data.features.length, "features");

        // [핵심 수정] 잔상 제거를 위해 기존 data.js에서 생성한 레이어가 있다면 즉시 제거
        if (typeof STATE !== 'undefined' && STATE.geoJsonLayer && window.map) {
            console.log("[RoadNetwork] Clearing external GeoJSON layer to prevent ghosting.");
            window.map.removeLayer(STATE.geoJsonLayer);
            STATE.geoJsonLayer = null;
        }

        const junctions = Object.values(STATE.junctions || {});
        if (junctions.length === 0) {
            alert("❌ 교차로 데이터가 없습니다. 먼저 교차로 CSV 파일을 불러오세요.");
            return false;
        }

        this.isActive = true;

        // 1. 노드 재생성
        this.nodes = junctions.map((j, i) => ({
            ...j,
            index: i,
            group: String(j.group || 'default'),
            x: j.lng,
            y: j.lat,
            adj: new Set()
        }));

        this.edges = [];
        this.edgeSet.clear();
        
        // ID 매칭을 위한 맵 생성 (ID 정규화 처리)
        const normalizeId = (id) => String(id || "").replace(/[^0-9]/g, ''); // 숫자만 추출
        const nodeByNormId = new Map();
        this.nodes.forEach(n => {
            nodeByNormId.set(normalizeId(n.id), n);
        });

        let successCount = 0;
        let failCount = 0;

        // 2. 피쳐로부터 속성 복구
        data.features.forEach(f => {
            const uId = normalizeId(f.properties.u_id);
            const vId = normalizeId(f.properties.v_id);
            
            const u = nodeByNormId.get(uId);
            const v = nodeByNormId.get(vId);

            if (u && v) {
                this._addEdgeRaw(u, v);
                successCount++;
            } else {
                failCount++;
            }
        });

        console.log(`[RoadNetwork] Import results: Success=${successCount}, Fail=${failCount}`);
        
        if (successCount > 0) {
            this.render();
            return true;
        } else {
            alert(`⚠️ 로드 실패: 매칭되는 교차로 ID가 없습니다.\n(가져온 특징 수: ${data.features.length}개)\n교차로 ID 형식을 확인해주세요.`);
            return false;
        }
    }

    exportJSON() {
        // Create GeoJSON Features
        const features = this.edges.map(pair => {
            const u = this.nodes[pair[0]];
            const v = this.nodes[pair[1]];
            return {
                type: "Feature",
                geometry: {
                    type: "LineString",
                    coordinates: [[u.lng, u.lat], [v.lng, v.lat]]
                },
                properties: {
                    u_id: u.id,
                    v_id: v.id,
                    group: u.group
                }
            };
        });

        const geojson = {
            type: "FeatureCollection",
            features: features
        };

        const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;

        const filename = `db_coordlink.geojson`;

        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }

    toggleVisibility() {
        if (!this.layerGroup) return;
        const btnVisibility = document.getElementById('btn-road-network-toggle');

        if (map.hasLayer(this.layerGroup)) {
            // [숨기기]
            map.removeLayer(this.layerGroup);
            if (btnVisibility) btnVisibility.classList.remove('active');

            // [추가] 숨길 때 현재 모드가 이 모드라면 기본 모드로 복귀
            if (STATE.appMode === CONFIG.APP_MODE.NETWORK_EDIT) {
                AppStateMachine.setMode(CONFIG.APP_MODE.SELECT);
            }
            console.log("[RoadNetwork] Visibility OFF: Interaction state reset.");
        } else {
            // [보이기]
            map.addLayer(this.layerGroup);
            if (btnVisibility) btnVisibility.classList.add('active');
            this.render(); // 최신 상태로 재렌더링
        }
    }
}

class UnionFind {
    constructor(n) {
        this.parent = Array.from({ length: n }, (_, i) => i);
        this.count = n;
    }
    find(i) {
        if (this.parent[i] === i) return i;
        return (this.parent[i] = this.find(this.parent[i]));
    }
    union(i, j) {
        let rootI = this.find(i);
        let rootJ = this.find(j);
        if (rootI !== rootJ) {
            this.parent[rootI] = rootJ;
            this.count--;
            return true;
        }
        return false;
    }
}

window.RoadManager = new RoadNetworkManager();

// --- UI Interface Functions ---

/**
 * 선 굵기 업데이트
 */
function updateNetworkWeight(val) {
    const weight = parseFloat(val);
    window.RoadManager.baseWeight = weight;
    document.getElementById('txt-network-weight').textContent = weight.toFixed(1) + 'px';
    if (window.RoadManager.isActive) {
        window.RoadManager.render();
    }
}

/**
 * 맵 상단 가시성 토글 (모든 연동 레이어 통합 제어)
 * @final_revision 시인성과 물리적 가시성 완벽 동기화
 */
function toggleRoadNetworkVisibility() {
    const btn = document.getElementById('btn-road-network-toggle');
    if (!btn) return;

    // 1. 타겟 상태 결정 (현재 active가 있으면 꺼야 하므로 false, 없으면 켜야 하므로 true)
    const nextShow = !btn.classList.contains('active');

    const m = window.map; // 전역 지도 객체
    if (!m) {
        console.error("[RoadNetwork] Map object not found!");
        return;
    }

    // 2. RoadManager (자동 분석 연동망) 처리
    const rm = window.RoadManager;
    if (rm && rm.isActive) {
        if (nextShow) {
            // 레이어 그룹이 유실되었거나 없는 경우 렌더링을 통해 재생성 및 추가
            if (!rm.layerGroup || !m.hasLayer(rm.layerGroup)) {
                rm.render();
            } else {
                m.addLayer(rm.layerGroup);
            }
        } else {
            if (rm.layerGroup && m.hasLayer(rm.layerGroup)) {
                m.removeLayer(rm.layerGroup);
            }
        }
    }

    // 3. STAT.geoJsonLayer (DB 로드 연동망) 처리
    const gj = (window.STATE && window.STATE.geoJsonLayer) ? window.STATE.geoJsonLayer : null;
    if (gj) {
        if (nextShow) {
            if (!m.hasLayer(gj)) m.addLayer(gj);
        } else {
            if (m.hasLayer(gj)) m.removeLayer(gj);
        }
    }

    // 4. 버튼 시각적 상태 강제 동기화
    if (nextShow) {
        btn.classList.add('active');
    } else {
        btn.classList.remove('active');
    }

    console.log(`[RoadNetwork] Force Visibility => ${nextShow ? 'ON' : 'OFF'}`);
}
function analyzeRoadNetwork() {
    if (!window.RoadManager) return;
    
    const mgr = window.RoadManager;
    const junctions = Object.values(STATE.junctions || {});
    if (junctions.length === 0) {
        alert("❌ 교차로 데이터가 없습니다. 먼저 교차로 CSV 파일을 불러오세요.");
        return;
    }

    // [강화] 로드된 파일 데이터가 있을 경우 명시적 경고
    if (mgr.edges.length > 0) {
        const proceed = confirm(`⚠️ [전체 분석 경고]\n현재 로드되어 있는 [${mgr.edges.length}개]의 연동구간 데이터를 '전부 삭제'하고 새로 분석하시겠습니까?\n(불러온 파일 데이터가 모두 유실됩니다)`);
        if (!proceed) return;
    }

    console.log("[RoadNetwork] Executing Total Network Analysis...");
    mgr.generate(junctions);
}

/**
 * 선택된 그룹만 분석 (불러온 파일 데이터 위에서 특정 그룹만 '수정')
 */
function analyzeSelectedGroupNetwork() {
    if (!window.RoadManager) return;
    
    const mgr = window.RoadManager;
    const junctions = Object.values(STATE.junctions || {});
    if (junctions.length === 0) {
        alert("❌ 교차로 데이터가 없어서 분석을 진행할 수 없습니다.");
        return;
    }

    // 1. 최신 그룹/노드 정보를 분석 엔진에 반영 (사전 동기화)
    mgr._syncNodesInternal();

    let targetGroupId = null;
    // 현재 선택된 노드의 그룹 찾기
    if (STATE.activeJid && STATE.junctions[STATE.activeJid]) {
        targetGroupId = String(STATE.junctions[STATE.activeJid].group);
    } 
    else if (typeof currentEditingGroup !== 'undefined' && currentEditingGroup !== null) {
        targetGroupId = String(currentEditingGroup);
    }

    if (!targetGroupId || targetGroupId === "0" || targetGroupId === "null") {
        alert("🎯 분석할 그룹을 선택해주세요.\n(교차로를 클릭하거나 그룹 메뉴에서 그룹을 선택하세요)");
        return;
    }

    const currentEdgeCount = mgr.edges.length;
    let msg = `🎯 [그룹 ${targetGroupId} 분석]\n`;
    if (currentEdgeCount > 0) {
        msg += `기존에 로드된 ${currentEdgeCount}개의 링크 중, 해당 그룹의 데이터만 '부분 수정'합니다. 계속하시겠습니까?`;
    } else {
        msg += `해당 그룹의 연동망 작성을 시작하시겠습니까?`;
    }

    const proceed = confirm(msg);
    if (!proceed) return;

    console.log(`[RoadNetwork] Partially modifying group ${targetGroupId}...`);
    mgr.generateForGroup(targetGroupId);
    mgr.render();
}

/**
 * [신규] 시간대별 동일주기 분석
 */
function analyzeCycleNetwork() {
    if (!window.RoadManager) return;
    
    const mgr = window.RoadManager;
    const junctions = Object.values(STATE.junctions || {});
    if (junctions.length === 0) {
        alert("❌ 교차로 데이터가 없습니다. 먼저 교차로 CSV 파일을 불러오세요.");
        return;
    }

    const hourSelect = document.getElementById('cycle-analyze-hour');
    const targetHour = hourSelect ? parseInt(hourSelect.value) : 12;
    const targetSec = targetHour * 3600;

    // 요일 기준은 현재 활성화된 요일 또는 기본값 0(월요일)로 설정
    const daySelect = document.querySelector('.btn-day.active');
    const dIdx = daySelect ? parseInt(daySelect.getAttribute('data-day') || 0) : 0;
    
    if (mgr.edges.length > 0) {
        const proceed = confirm(`⚠️ [전체 분석 경고]\n현재 로드되어 있는 [${mgr.edges.length}개]의 연동구간 데이터를 '전부 삭제'하고 ${targetHour}시 기준 '동일주기' 분석을 진행하시겠습니까?\n(불러온 파일 데이터가 모두 유실됩니다)`);
        if (!proceed) return;
    }

    console.log(`[RoadNetwork] Executing Cycle Network Analysis for Hour: ${targetHour}`);
    
    // RoadManager에 cycle 기준으로 생성하는 메서드 호출
    mgr.generateByCycle(junctions, dIdx, targetSec);
}

/**
 * 편집: 모드 토글
 */
function toggleNetworkEditMode() {
    if (!window.RoadManager) return;
    
    const mgr = window.RoadManager;
    const edgeCount = (mgr.edges || []).length;
    console.log(`[RoadNetwork] toggleNetworkEditMode triggered. Mode: ${STATE.appMode}, Edges: ${edgeCount}`);

    if (STATE.appMode !== CONFIG.APP_MODE.NETWORK_EDIT) {
        // [중요 수정] 자동 분석(Analyze) 로직 완전 제거. 
        // 데이터가 있든 없든 현재 로드된 상태 그대로 편집 모드에 진입함으로써, 
        // 외부에서 불러온 지오제이슨 데이터가 덮어씌워지는 현상을 근본적으로 차단함.
        if (edgeCount === 0) {
            console.log("[RoadNetwork] No edges loaded. Entering blank edit mode.");
        } else {
            console.log(`[RoadNetwork] Preserving ${edgeCount} loaded links for editing.`);
            mgr.isActive = true;
            mgr.render();
        }

        // 레이어 가시화 여부 확인
        if (typeof map !== 'undefined' && !map.hasLayer(mgr.layerGroup)) {
            mgr.toggleVisibility();
        }

        // 노드 동기화 (기존 Adj 보존 시도)
        if (typeof mgr._syncNodesInternal === 'function') {
            mgr._syncNodesInternal();
        }

        AppStateMachine.setMode(CONFIG.APP_MODE.NETWORK_EDIT);
        alert(`✏️ 편집 모드가 활성화되었습니다.\n(현재 로드된 피쳐: ${edgeCount}개)`);
    } else {
        AppStateMachine.setMode(CONFIG.APP_MODE.SELECT);
    }
}



/**
 * 내보내기: GeoJSON 저장
 */
function exportRoadNetwork() {
    if (!window.RoadManager.isActive || window.RoadManager.edges.length === 0) {
        alert("내보낼 네트워크 데이터가 없습니다.");
        return;
    }
    window.RoadManager.exportJSON();
}

/**
 * 불러오기: GeoJSON 파일 읽기
 */
function importRoadNetwork(event) {
    const junctions = Object.values(STATE.junctions || {});
    if (junctions.length === 0) {
        alert("❌ 교차로 데이터가 없습니다. 먼저 교차로 CSV 파일을 불러오세요.");
        event.target.value = ""; // 입력 초기화
        return;
    }

    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            const success = window.RoadManager.importJSON(data);
            if (success) {
                // Success message removed per user request
            }
        } catch (err) {
            alert("❌ 파일 파싱 오류: 올바른 GeoJSON 형식이 아닙니다.");
            console.error(err);
        } finally {
            event.target.value = ""; // 다음 불러오기를 위해 초기화
        }
    };
    reader.readAsText(file);
}

// Compatibility with old calls if any
function toggleRoadNetworkEditor() {
    toggleNetworkEditMode();
}

// [중요] 연동구간 매니저 전역 인스턴스 생성 (중복 생성 방지)
if (!window.RoadManager) {
    window.RoadManager = new RoadNetworkManager();
}
