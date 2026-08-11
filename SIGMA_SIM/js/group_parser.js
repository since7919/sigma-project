/* SIGMA_SIM Group Parser Functions */

function generateGroupCSV() {
    if (Object.keys(STATE.groups).length === 0) return "";

    let csv = "GroupID,Region,GroupName,Weekday,Friday,Saturday,Sunday,Special,Flextime1,Flextime2,Flextime3,Flextime4,Flextime5,TSD_SET1,TSD_SET2,TSD_SET3,PlanAliases\n";

    Object.keys(STATE.groups).forEach(gid => {
        const group = STATE.groups[gid];
        const gName = (group.name || `그룹 ${gid}`).replace(/,/g, ' ');
        
        let region = group.region;
        if (!region) {
            const member = Object.values(STATE.junctions).find(j => String(j.group) === String(gid));
            region = member ? (member.region || (member.id.startsWith("L02-") ? "L02" : "L01")) : "L01";
        }

        const schedStrs = Array.from({ length: 10 }, (_, d) => {
            const sched = (group.schedules && group.schedules[d]) ? group.schedules[d] : [];
            return sched.map(s => {
                const timePart = s.h === -1 ? "-1" : `${String(s.h).padStart(2, '0')}:${String(s.m).padStart(2, '0')}`;
                return `${timePart}|${s.cycle || 100}|${s.idx || 1}`;
            }).join(';');
        });

        // [신규] TSD 설정 세트 직렬화 (3개)
        const tsdSets = Array.from({ length: 3 }, (_, i) => {
            const config = (group.tsdConfigs && group.tsdConfigs[i]) ? group.tsdConfigs[i] : { enabled: 0, order: [], distances: [] };
            return `${config.enabled}|${(config.order || []).join(';')}|${(config.distances || []).join(';')}`;
        });

        const aliases = (group.planAliases || Array(10).fill("")).join(';');

        csv += `${gid},${region},${gName},${schedStrs.join(',')},${tsdSets.join(',')},${aliases}\n`;
    });
    return csv;
}

function processGroupCSV(csvString, isAutoLoad = false) {
    showLoading("그룹 데이터 분석 중...");
    setTimeout(() => {
        const lines = csvString.trim().split(/\r?\n/);
        if (lines.length < 2) { 
            alert("불러오기 실패: 파일이 비어있습니다."); 
            hideLoading(); 
            return; 
        }

        const header = lines[0].toLowerCase();
        const isTodPlansFile = header.includes('day_plan') && header.includes('time_plan1');

        if (isTodPlansFile) {
            // [A] 새 규격: db_tod_plans.csv (교차로당 10행)
            handleTodPlansAsGroup(csvString);
        } else {
            // [B] 기존 규격: sigma_group.csv (그룹당 1행)
            handleLegacyGroupCSV(lines, isAutoLoad);
        }
        hideLoading();
    }, 10);
}

function handleTodPlansAsGroup(csvString) {
    const gid = currentEditingGroup;
    if (!gid) {
        alert("먼저 편집할 그룹을 목록에서 선택하세요.");
        return;
    }

    const targetMembers = Object.values(STATE.junctions).filter(j => String(j.group) === String(gid));
    
    if (targetMembers.length === 0) {
        alert(`그룹 ${gid}에 속한 교차로가 없습니다. 교차로 정보에서 그룹 ID를 먼저 설정하세요.`);
        return;
    }

    // [개선] 그룹 템플릿만 업데이트하는 것이 아니라, 전체 교차로의 개별 데이터를 모두 업데이트합니다.
    if (typeof processTodPlanCSV === 'function') {
        processTodPlanCSV(csvString);
    }

    // 그룹에 속한 첫 번째 교차로의 최신 데이터를 기준(Template)으로 가져옴
    const refJid = targetMembers[0].id;
    const refJunction = STATE.junctions[refJid];

    if (!refJunction || !refJunction.dayPlans) {
        alert(`파일 내에 그룹 멤버인 교차로(${refJid})의 데이터가 없습니다.`);
        return;
    }

    // 그룹 스케줄 초기화 및 데이터 주입 (그룹 기준 템플릿은 UI 렌더링용으로 유지)
    if (!STATE.groups[gid]) STATE.groups[gid] = { name: `그룹 ${gid}`, schedules: Array.from({length:10}, () => createEmptySched()) };
    const groupScheds = STATE.groups[gid].schedules;

    // refJunction의 dayPlans를 순회하며 그룹 스케줄을 재구성 (파싱 속도 극대화)
    for (let d = 0; d < 10; d++) {
        const plans = refJunction.dayPlans[d];
        if (plans && plans.length > 0) {
            plans.forEach((pl, idx) => {
                if (idx < 16) {
                    const h = pl.time === -1 ? -1 : Math.floor(pl.time / 3600);
                    const m = pl.time === -1 ? 0 : Math.floor((pl.time % 3600) / 60);
                    groupScheds[d][idx] = { h, m, cycle: pl.cycle, idx: pl.planIdx };
                }
            });
        }
    }

    alert(`해당 파일의 교차로 개별 데이터가 모두 적용되었으며, 그룹 ${gid}의 기준 스케줄은 교차로(${refJid}) 데이터를 기반으로 업데이트되었습니다.`);
    loadGroupInfo();
}

