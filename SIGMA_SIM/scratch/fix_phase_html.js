const fs = require('fs');
const path = 'SIGMA_SIM/index.html';
let content = fs.readFileSync(path, 'utf8');
content = content.replace(/\r\n/g, '\n');

const target = `            <div class="sigma-panel" style="margin-top: 0;">
                <div class="card-title" onclick="toggleSection(this)">
                    <h3>📅 TOD 상세 정보 일람</h3>
                    <span class="fold-icon">▼</span>
                </div>
                <div class="foldable-content">
                    <!-- [신규] 교차로 요일별 TOD 탭 선택 및 복사 기능 -->
                    <div class="box-blue">
                        <div style="margin-bottom: 8px; display: flex; flex-direction: column; gap: 6px;">
                            <div id="j-day-type-buttons">
                                <!-- JS Dynamic Insertion via updateJunctionDayUI() -->
                            </div>
                            <div
                                style="display: flex; align-items: center; justify-content: flex-end; gap: 8px; font-size: 10px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.05);">
                                <span style="color:#aaa;">데이터 복사(가져오기):</span>
                                <select id="j-copy-from-day" class="input-dark"
                                    style="width: 70px; height: 22px; font-size: 10px;">
                                    <option value="0">일계획 1</option>
                                    <option value="1">일계획 2</option>
                                    <option value="2">일계획 3</option>
                                    <option value="3">일계획 4</option>
                                    <option value="4">일계획 5</option>
                                    <option value="5">일계획 6</option>
                                    <option value="6">일계획 7</option>
                                    <option value="7">일계획 8</option>
                                    <option value="8">일계획 9</option>
                                    <option value="9">일계획 10</option>
                                </select>
                                <button class="btn-sm" onclick="copyJunctionTODDay()"
                                    style="background:#8e44ad; padding: 3px 10px; font-size: 10px;">가져오기</button>
                            </div>
                        </div>
                        <div id="j-current-day-label"
                            style="font-size: 11px; color: var(--accent); font-weight: bold; margin-bottom: 4px;">
                            📅
                            현재 조회: 일계획 1 TOD (TOD SLOT 1~16)</div>
                        <div style="height: 1px; background: rgba(52, 152, 219, 0.2); margin: 5px 0;"></div>

                        <div
                            style="max-height:300px; overflow-y:auto; background:#1a1a1a; border-radius:5px; border: 1px solid rgba(255,255,255,0.05);">
                            <div id="tod-summary-container"></div>
                        </div>
                    </div>
                </div>
            </div>`;

const replacement = `            <div class="sigma-panel" style="margin-top: 0;">
                <div class="card-title" onclick="toggleSection(this)">
                    <h3>📅 TOD 상세 정보 일람</h3>
                    <span class="fold-icon">▼</span>
                </div>
                <div class="foldable-content">
                    <!-- [신규] 교차로 요일별 TOD 탭 선택 및 복사 기능 -->
                    <div class="box-blue">
                        <!-- 1. 주간 일계획표 -->
                        <div id="weekly-plan-container" style="margin-bottom: 12px;"></div>

                        <!-- 2. TOD 계획정보 -->
                        <div id="tod-plan-info-container" style="margin-bottom: 12px;"></div>

                        <!-- 3. 복사 및 현재 조회 레이블 -->
                        <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 10.5px; margin-bottom: 6px; padding-bottom: 6px; border-bottom: 1px solid rgba(255,255,255,0.05);">
                            <span id="j-current-day-label" style="color: var(--accent); font-weight: bold;">
                                📅 현재 조회: 일계획 1 TOD (TOD SLOT 1~16)
                            </span>
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <span style="color:#aaa; font-size:9.5px;">데이터 복사(가져오기):</span>
                                <select id="j-copy-from-day" class="input-dark"
                                    style="width: 70px; height: 20px; font-size: 9.5px; border-radius: 3px;">
                                    <option value="0">일계획 1</option>
                                    <option value="1">일계획 2</option>
                                    <option value="2">일계획 3</option>
                                    <option value="3">일계획 4</option>
                                    <option value="4">일계획 5</option>
                                    <option value="5">일계획 6</option>
                                    <option value="6">일계획 7</option>
                                    <option value="7">일계획 8</option>
                                    <option value="8">일계획 9</option>
                                    <option value="9">일계획 10</option>
                                </select>
                                <button class="btn-sm" onclick="copyJunctionTODDay()"
                                    style="background:#8e44ad; padding: 2px 8px; font-size: 9.5px; height: 20px; line-height: 16px; border-radius: 3px;">가져오기</button>
                            </div>
                        </div>

                        <!-- 4. TOD slot (1~16 목록) -->
                        <div style="max-height:300px; overflow-y:auto; background:#1a1a1a; border-radius:5px; border: 1px solid rgba(255,255,255,0.05);">
                            <div id="tod-summary-container"></div>
                        </div>
                    </div>
                </div>
            </div>`;

if (content.includes(target.replace(/\r\n/g, '\n'))) {
    content = content.replace(target.replace(/\r\n/g, '\n'), replacement.replace(/\r\n/g, '\n'));
    fs.writeFileSync(path, content, 'utf8');
    console.log("Replacement successful.");
} else {
    console.log("Target not found!");
}
