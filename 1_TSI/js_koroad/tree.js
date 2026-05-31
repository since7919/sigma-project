
var treeJson = null;
var onlineCenterStatusCheckId;
var offlineCenterStatusCheckId;
var onlineIntStatusCheckId;
var offlineIntStatusCheckId;
var _RegionCdArr = [];

var onlineCenterStatusData;
var offlineCenterStatusData;
var onlineIntStatusData;
var offlineIntStatusData;
let _regionMap = new Map();
let timeout = null;
var _historyMap = new Map();
var interval = null;
var cnt = 0;
let isSearch = false;

let _timeIdx;
function nodeClick(nodeId, regionId, name, lat, lng){
    _RegionCd = regionId;
    $('.node-li').removeClass('on');
    $('#node-li-'+ nodeId).addClass('on');
    if (_Level > 3) map.setLevel(1);
    map.panTo(new kakao.maps.LatLng(lat, lng));
    if (_timeIdx) {
        clearTimeout(_timeIdx);
        _timeIdx = "";
    }
    _timeIdx = setTimeout(() => {
        getSignalInfo();
        customOverlayFnc(name,lng,lat);
    }, 100 * 2);
}

function toggleCheckbox(event, nodeId) {
    event.stopPropagation(); // 이벤트 버블링 방지
    document.getElementById(`state_${nodeId}`).click();
}


function getDateToStr(date){
    const year = date.getFullYear();
    let month = date.getMonth() + 1;
    let day = date.getDate();
    if (month < 10){
        month = '0' + month;
    }
    if (day < 10) {
        day = '0' + day;
    }
    return year.toString() + '-' + month.toString() + '-' + day.toString();
}

function getDateTimeToStr(date) {
    let str = getDateToStr(date);
    let hour = date.getHours();
    let minute = date.getMinutes();
    let seconds = date.getSeconds();
    if (hour < 10){
        hour = '0' + hour;
    }
    if (minute < 10){
        minute = '0' + minute;
    }
    if (seconds < 10){
        seconds = '0' + seconds;
    }
    str += ' ';
    str += hour + ':' + minute + ':' + seconds;
    return str;
}

function setAddrMap(data) {

    _regionMap.clear();
    for (let ii = 0; ii < data.length; ii++) {
        if (data[ii].addr1 == null || data[ii].addr1 == '-') {
            continue;
        }
        _regionMap.set(data[ii].addr1, data[ii].regionid);
    }
}

function getAddrSi() {
    return Array.from(_regionMap.keys());
}
function getEngAddr(addr){
    let region_id = _regionMap.get(addr);
    if (region_id === null || region_id === undefined) {
        return "U99"
    }
    return region_id;
}

// setTreeList();
getIntTreeList();
controllerOnOffFunc();
/*
* 신호 제어기 상태 정보
* 1 : 정상, 2: 교차로 시각 오류 0: 마지막통신 시간 3초이상 지연시
 */

function controllerOnOffFunc() {
    if (timeout) clearTimeout(timeout);
    const start = new Date();

    let now = new Date();
    const countMap = new Map();
    _signalInfoArr.forEach(function (el, idx) {
        if (!countMap.get(el.regionId)) {
            countMap.set(el.regionId, {tot : 0, error : 0});
        }
        const regionCounter = countMap.get(el.regionId);

        regionCounter.tot++;
        if (!el.commStatus) {
            regionCounter.error++;
            el.status = 0;  // 데이터 없음(현재 통신하고 있지 않음)
        }
        else {
            el.status = 1;
        }
        $('#int-status-'+ el.nodeId).attr('class', 'comm'+ el.status);
    });

    countMap.forEach((obj, key)=>{
        $('#intErrCnt_'+ key).text(obj.error);
        $('#intTotal_'+ key).text(obj.tot);
    });
    const end = new Date();
    let diff = end.getTime() - start.getTime();
    if (diff >= 1000) {
        diff = 1000;
    }

    timeout = setTimeout(()=>controllerOnOffFunc(), 1000 - diff);
}


function getIntTreeList() {
    const url = 'getIntTreeList.do';
    // requestService(url, '', getIntTreeListCallback);
    requestService(url, '', drawIntTree);
}

function drawIntTree(data) {
    treeJson = [];
    if (data && data.length) {
        data.sort((a, b)=> a.addr1.localeCompare(b.addr1) || a.name.localeCompare(b.name));
        treeJson = data;
    }
    const treeData = getIntTreeData(data);
    const intTree = $('#intTree');
    intTree.jstree({
        "themes": {"stripes": false},
        "plugins": ["wholerow"],
        'core' : { 'data' : treeData }
    });

    intTree.on('select_node.jstree', function (e, data) {
        const { lat, lng, type, id, name, regionid } = data.node.data;
        if (type === 'int') nodeClick(id, regionid, name, lat, lng);
        // moveCenter(lat, lng);
    });

    intTree.on('changed.jstree', function (e, data) {
        if (data.action === '"deselect_all"') {
            if (isSearch) {
                $(this).jstree("open_all");
            }
            else {
                $(this).jstree("close_all");
            }
        }
    })

}

function getStatus(stts){
    if ( stts == 1 ) {
        return "On"; //정상
    }
    else if( stts == 2 ){
        return "Off"; //교차로시각이상
    }
    else{
        return "Null"; // 통신시간 3초이상
    }
}

function isNull(str) {
    return (str === "" || str === null || str === undefined);
}

//유선 센터상테 체크..
function onlineCenterStatusCheck() {

    if (onlineCenterStatusCheckId != null) clearTimeout(onlineCenterStatusCheckId);
    onlineCenterStatusCheckId = setTimeout('onlineCenterStatusCheck()', 5 * 1000);

    var url = 'getOnlineCenterStatus.do';
    requestService(url, '', onlineCenterStatusCheckCallback);
}

function onlineCenterStatusCheckCallback(data) {
    onlineCenterStatusData = data;
    drawCenterStatus(0, data);
}

//무선 센터상테 체크..
function offlineCenterStatusCheck() {

    if (offlineCenterStatusCheckId != null) clearTimeout(offlineCenterStatusCheckId);
    offlineCenterStatusCheckId = setTimeout('offlineCenterStatusCheck()', 5 * 1000);

    var url = 'getOfflineCenterStatus.do';
    requestService(url, '', offlineCenterStatusCheckCallback);
}

function offlineCenterStatusCheckCallback(data) {
    offlineCenterStatusData = data;
    drawCenterStatus(1, data);
}

function drawCenterStatus(network, data) {
    let regionCd;
    let totCnt;
    let errCnt;
    let commState;
    let commImg = '';

    for (let ii = 0; ii < data.length; ii++) {
        regionCd = data[ii].REGION_CD;
        totCnt = data[ii].TOT;
        errCnt = data[ii].ERR_CNT;
        commState = data[ii].COMM_STATE;

        if (commState == 1) {
            commImg = 'images/commOff.png';
            $('.intErrCnt_' + network + '_' + regionCd).text(totCnt);
        } else {
            commImg = 'images/commOn.png';
            $('.intErrCnt_' + network + '_' + regionCd).text(errCnt);
        }
        if (network == 0) $('.regionComm_' + network + '_' + regionCd).attr('src', commImg);

        $('.intTotal_' + network + '_' + regionCd).text(totCnt);
    }
}

//유선 제어기 상태 체크..
function onlineIntStatusCheck() {
    if (_RegionCdArr.length > 0) {
        if (onlineIntStatusCheckId != null) clearTimeout(onlineIntStatusCheckId);
        onlineIntStatusCheckId = setTimeout('onlineIntStatusCheck()', 5 * 1000);

        var url = 'getOnlineIntStatus.do';
        var param = 'regionCd=' + _RegionCdArr;
        requestService(url, param, onlineIntStatusCheckCallback);
    }
}

function onlineIntStatusCheckCallback(data) {
    onlineIntStatusData = data;
    drawIntStatus(0, data);
}

//무선 제어기 상태 체크..
function offlineIntStatusCheck() {
    if (_RegionCdArr.length > 0) {
        if (offlineIntStatusCheckId != null) clearTimeout(offlineIntStatusCheckId);
        offlineIntStatusCheckId = setTimeout('offlineIntStatusCheck()', 5 * 1000);

        var url = 'getOfflineIntStatus.do';
        var param = 'regionCd=' + _RegionCdArr;
        requestService(url, param, offlineIntStatusCheckCallback);
    }
}

function offlineIntStatusCheckCallback(data) {
    offlineIntStatusData = data;
    drawIntStatus(1, data);
}

function drawIntStatus(network, data) {
    var commState;
    if (network == 0) {
        for (var i = 0; i < onlineCenterStatusData.length; i++) {
            if (onlineCenterStatusData[i].REGION_CD == data[0].REGION_CD) {
                commState = onlineCenterStatusData[i].COMM_STATE;
                break;
            }
        }
    } else {
        commState = 0;
    }

    var regionCd;
    var siguguCd;
    var intNoArr;
    var commOnOffFlagArr;
    var commOnOffImg;

    for (var ii = 0; ii < data.length; ii++) {
        regionCd = data[ii].REGION_CD;
        sigunguCd = data[ii].SIGUNGU_CD;
        intNoArr = data[ii].INT_NO.split('|');
        commOnOffFlagArr = data[ii].COMM_ON_OFF_FLAG.split('|');

        $('.guIntTotal_' + network + '_' + sigunguCd).text(intNoArr.length);

        //sigunguCd = 41190 부천시 , 41430 의왕시, 41410 군포시

        //commState = 1;

        //시군구 코드가 없으면 상태정보이미지가 없데이트가 안된다...
        if (commState == 0) {
            var guIntErrCnt = 0;
            for (var jj = 0; jj < intNoArr.length; jj++) {
                if (commOnOffFlagArr[jj] == 1) {
                    guIntErrCnt++;
                    commOnOffImg = 'background-image:url("images/intStatusOff.png");background-position:center center';
                } else {
                    commOnOffImg = 'background-image:url("images/intStatusOn.png");background-position:center center';
                }
                $('#' + regionCd + '_' + network + '_' + intNoArr[jj] + ' .jstree-anchor .jstree-icon').attr('style', commOnOffImg);
            }
            $('.guIntErrCnt_' + network + '_' + sigunguCd).text(guIntErrCnt);
        } else {
            for (var j = 0; j < intNoArr.length; j++) {
                commOnOffImg = 'background-image:url("images/intStatusOff.png");background-position:center center';
                $('#' + regionCd + '_' + network + '_' + intNoArr[j] + ' .jstree-anchor .jstree-icon').attr('style', commOnOffImg);
            }
            $('.guIntErrCnt_' + network + '_' + sigunguCd).text(intNoArr.length);
        }

    }
}


function unsetEvpCurr() {
    if (_EmergencyMap && _EmergencyMap.size) {
        _EmergencyMap.forEach((obj)=> obj.clear());
        _EmergencyMap.clear();
        $('.evp-table tr.on').removeClass('on');
        _isClick = null;
    }
}

function searchHistoryData() {
    const $emptyBox       = $('.empty-history');
    const $historyLoading = $('.history-loading');
    const $region         = $('#region');
    const $start          = $('#startDate');
    const $startTime      = $('#startTime');
    const $end            = $('#endDate');
    const $endTime        = $('#endTime');
    const regionVal       = $region.val();
    const startVal        = $start.val();
    const endVal          = $end.val();
    const startTimeVal    = $startTime.val();
    const endTimeVal      = $endTime.val();
    if (!startVal) {
        alert('검색시작 년월일을 입력해주세요');
        return $start.focus();
    }
    if (!startTimeVal) {
        alert('검색시작 시간을 입력해주세요');
        return $startTime.focus();
    }
    if (!endVal) {
        alert('검색종료 년월일을 입력해주세요');
        return $end.focus();
    }

    if (!endTimeVal) {
        alert('검색종료 시간을 입력해주세요');
        return $endTime.focus();
    }

    const param = {
        start : startVal + ' ' + startTimeVal + ':00',
        end : endVal + ' ' + endTimeVal + ':59',
        region : regionVal
    }
    if (param.start > param.end) {
        alert('검색시작 일시가 종료 일시 보다 큽니다.');
        return $end.focus();
    }

    const $historyTable = $('.history-table');
    $historyTable.empty();
    $emptyBox.css('display', 'none');
    $historyLoading.css('display', 'flex');
    imageOnOff('play', false);
    imageOnOff('stop', false);
    imageOnOff('pause', false);

    if (_historyMap.size) {
        _historyMap.forEach((obj)=>{
            if (obj.get('draw')) obj.get('draw').clear();
        });
        _historyMap.clear();
        if (interval) {
            clearInterval(interval);
            interval = null;
            cnt = 0;
        }
        $('#evpBottomInfo').empty();
    }

    requestService('getEvpHistory.do', param, (rec)=>{
        evpHistoryCallBack(rec)
    }, true, ()=>{
        $emptyBox.css('display', 'flex');
        $historyLoading.css('display', 'none');
    });
}

function evpHistoryCallBack(rec) {
    const $historyTable = $('.history-table');
    const $emptyBox       = $('.empty-history');
    const $historyLoading = $('.history-loading');
    let str = ''
    let historyCnt = 0;
    if (rec && rec.length) {
        historyCnt = rec.length;
        for (let history of rec) {
            _historyMap.set(history.service_id, new Map());
            const {event_list, phase_list, node_list} = history;

            const dateMap = new Map();
            if (event_list.length && phase_list.length) {
                event_list.forEach((eventObj)=>{
                    dateMap.set(eventObj.clct_dt, new Map());
                    dateMap.get(eventObj.clct_dt).set('event', eventObj);
                    dateMap.get(eventObj.clct_dt).set('sig', []);
                });

                phase_list.forEach((obj)=>{
                    if (!dateMap.get(obj.clct_dt)) {
                        dateMap.set(obj.clct_dt, new Map());
                        dateMap.get(obj.clct_dt).set('event', null);
                        dateMap.get(obj.clct_dt).set('sig', []);

                    }
                    dateMap.get(obj.clct_dt).get('sig').push(obj);
                });

                if (dateMap.size) {
                    history.event_list = [];
                    history.phase_list = [];
                    const dateArr = Array.from(dateMap.keys()).sort();
                    let beforeSig;
                    let beforeEvent;

                    for (let date of dateArr) {
                        const objMap = dateMap.get(date);
                        if (objMap.get('event') === null && beforeEvent === undefined) {
                            beforeEvent = event_list[0];
                        }
                        else if (objMap.get('event')){
                            beforeEvent = objMap.get('event');
                        }
                        const eventData = {...beforeEvent};

                        eventData.clct_dt = date;

                        if (objMap.get('sig').length === 0 && beforeSig === undefined) {
                            beforeSig = dateMap.get(phase_list[0].clct_dt).get('sig');
                        }
                        else if (objMap.get('sig').length) {
                            beforeSig = objMap.get('sig');
                        }

                        if (beforeSig.length !== node_list.length) {
                            for (let node of node_list) {
                                let idx = objMap.get('sig').findIndex(obj => obj.seq_no === node.seq_no)
                                if (idx === -1) {
                                    if (new Date(date).getTime() - new Date(dateArr[0]).getTime() !== 0) {
                                        let startTime = new Date(dateArr[0]).getTime();
                                        let currTime = new Date(date).getTime();
                                        let beforeObj = null

                                        for (let ii = currTime; ii >= startTime; ii -= 1000) {
                                            const key = getDateTimeToStr(new Date(ii));
                                            if (dateMap.get(key)) {
                                                const beforeIdx = dateMap.get(key).get('sig').findIndex(obj => obj.seq_no === node.seq_no);

                                                if (beforeIdx > -1) {
                                                    beforeObj = dateMap.get(key).get('sig')[beforeIdx];
                                                    break;
                                                }
                                            }
                                        }
                                        if (beforeObj) {
                                            beforeSig.push({
                                                seq_no : beforeObj.seq_no,
                                                clct_dt : date,
                                                service_id : beforeObj.service_id,
                                                a_end_angle : beforeObj.a_end_angle,
                                                a_end_lat:beforeObj.a_end_lat,
                                                a_end_lng:beforeObj.a_end_lng,
                                                a_flow_no:beforeObj.a_flow_no,
                                                a_head_angle:beforeObj.a_head_angle,
                                                a_head_lat:beforeObj.a_head_lat,
                                                a_head_lng: beforeObj.a_head_lng,
                                                a_mid_lat:beforeObj.a_mid_lat,
                                                a_mid_lng:beforeObj.a_mid_lng,
                                                a_ring_phase:beforeObj.a_ring_phase,
                                                b_end_angle:beforeObj.b_end_angle,
                                                b_end_lat:beforeObj.b_end_lat,
                                                b_end_lng:beforeObj.b_end_lng,
                                                b_flow_no:beforeObj.b_flow_no,
                                                b_head_angle:beforeObj.b_head_angle,
                                                b_head_lat:beforeObj.b_head_lat,
                                                b_head_lng:beforeObj.b_head_lng,
                                                b_mid_lat:beforeObj.b_mid_lat,
                                                b_mid_lng:beforeObj.b_mid_lng,
                                                b_ring_phase:beforeObj.b_ring_phase,
                                                hold_phase:beforeObj.hold_phase,
                                                lat : beforeObj.lat,
                                                lng : beforeObj.lng,
                                                node_id : beforeObj.node_id,
                                                node_nm : beforeObj.node_nm,
                                                plan_class:beforeObj.plan_class,
                                                rem_dist:beforeObj.rem_dist,
                                                state : beforeObj.state,
                                            })
                                        }

                                    }

                                }
                            }
                        }
                        const sigData = beforeSig;
                        history.event_list.push(eventData);
                        history.phase_list.push(sigData);
                    }
                }
            }
            _historyMap.get(history.service_id).set('obj', history);
            _historyMap.get(history.service_id).set('draw', null);
            str += `<tr class="hs_${history.service_id}" onclick="drawHistoryList('${history.service_id}', '${history.ocr_type}')"><td>${history.clct_dt}</td><td style="text-align: left;">${history.service_id}<br>${history.service_nm}</tr>`;
        }
    }

    $historyLoading.css('display', 'none');
    if (str === '') {
        $emptyBox.css('display', 'flex');
    }
    $('.history-cnt').text('이력건수 ' + historyCnt.toLocaleString() + '건');
    $historyTable.html(str);
}

function drawHistoryList(serviceId, occurType) {
    unsetEvpCurr();
    $('.history-table tr.on').removeClass('on');
    $('.hs_' + serviceId).addClass('on');
    const bottomInfo = $('#evpBottomInfo');
    bottomInfo.empty();
    requestService('getEvpHistoryDetail.do', {serviceId}, (data)=>{

        if (_historyMap.size && data) {
            _historyMap.forEach((obj, key)=>{
                const beforeDraw = obj.get('draw');
                if (beforeDraw && serviceId !== key) {
                    beforeDraw.clear();
                    obj.set('draw', null);
                }
            });
            _historyMap.get(serviceId).get("obj").event_list = data.event_list;
            _historyMap.get(serviceId).get("obj").phase_list = data.phase_list;
            _historyMap.get(serviceId).get("obj").node_list = data.node_list;
            _historyMap.get(serviceId).get("obj").route_list = data.route_list;
            if (_historyMap.get(serviceId).get('draw')) {
                return;
            }
            else {
                if (interval) {
                    clearInterval(interval);
                    interval = null;
                    cnt = 0;
                }
            }
        }

        const obj = _historyMap.get(serviceId).get('obj');

        const drawObj = {...obj};
        const { event_list, phase_list } = obj;

        if (event_list && event_list.length) drawObj.event_list = [drawObj.event_list[0]];
        if (phase_list && phase_list.length) drawObj.phase_list = phase_list[0];

        let str = '';

        event_list.forEach((event, idx)=>{
            str += getBottomListEl(obj, event, idx, occurType);
        });

        bottomInfo.html(str);
        const draw = drawHistory(drawObj);
        _historyMap.get(serviceId).set('draw', draw);
        $('.evpContainer').scrollTop(0);
        imageOnOff('play', true);
        imageOnOff('stop', false);
        imageOnOff('pause', false);
    }, true, null);

}

function imageOnOff(name, isOn) {
    const el = $('#' + name);
    const eventName = isOn ? 'addClass' : 'removeClass';
    el[eventName]('on');

    if (el.attr('src') === getImageName(name, !isOn)) {
        el.attr('src', getImageName(name, isOn));
    }
}

/**
 * 긴급차량우선신호 bottom list 생성
 * @param obj 서비스 정보
 * @param event 발생 이벤트 정보
 * @param idx 인덱스 번호
 * @returns {string} html 리스트 목록 반환
 */
function getBottomListEl(obj, event, idx, occurType) {
    // const regionNm = $('#region option[value="'+obj.service_id.substr(0,3)+'"]').text(); //왼쪽 3글자는 센터 번호를 의미
    let className = '';

    if (idx === 0) { //처음 그릴때 첫줄을 기반으로 그리므로 선택 표시
        className = 'on';
    }
    let curSpd = '-';
    if (event && event.cur_spd) { // 현재 스피드가 있을경우 천단위 콤마
        curSpd = event.cur_spd.toLocaleString();
    }

    let remDist = '-';
    if (event && event.rem_dist) {// 남은 거리가 있을경우 천단위 콤마
        remDist = event.rem_dist.toLocaleString();
    }


    let clctDt = event && event.clct_dt ? event.clct_dt.replace(/\:|\-|\.| /gi, '') : '-'; //시간 기호(':', '-', ' ') 제거 후 값만 추출 하여 table 로우 ID 부여
    let str = `<tr onclick="moveLocation('${obj.service_id}', this)" class="${className}" id="${obj.service_id}_${clctDt}">`
        +'<td>'+event.clct_dt+'</td>'
        +'<td>'+obj.region_name+'</td>'
        +'<td>'+obj.service_id+'</td>'
        +'<td>'+obj.service_nm+'</td>'
        +'<td>'+obj.ev_no+'</td>'
        +'<td>'+(occurType || '-')+'</td>'
        +'<td>'+event.cur_lng+'</td>'
        +'<td>'+event.cur_lat+'</td>'
        +'<td>'+curSpd+'</td>'
        +'<td>'+remDist+'</td>'
        +'</tr>';
    return str;
}

/**
 * 시뮬레이션 재생 / 멈춤 버튼 활성화 비활성화 이미지명 가져오기
 * @param name 요소 ID name (ID 와 이미지 이름이 동일함)
 * @param isOn 활성화/비활성화(true/false)
 * @returns {string} 이미지명 반환
 */
function getImageName(name, isOn) {
    let imgName = '/images/' + name;
    const onName = '_on';
    const extName = '.png';
    if (isOn) {
        imgName += onName;
    }
    return imgName + extName;
}


/**
 * 시뭏레이션 재생
 */
function playSimulation() {
    if (!$('#play').hasClass('on')) return; //비활성화중일 때만 실행
    if (interval) {
        clearInterval(interval);
        interval = null;
    }
    const serviceId = $('.history-table tr.on').attr('class').replace(/hs_| on/gi, '');// 선택 로우에서 service id 추출
    let evp = _historyMap.get(serviceId); //Map 에 저장된 해당 service_id 데이터 정보 가져오기
    let obj = evp.get('obj'); //object 정보
    let draw = evp.get('draw'); // marker handler 정보
    if (!draw) {// handler 가 없다면 생성
        drawHistoryList(serviceId);
        draw = evp.get('draw');
    }

    const { event_list, phase_list } = obj; //이벤트 리스트와 신호 리스트

    //버튼 활성화/비활성화 적용
    imageOnOff('stop', true);
    imageOnOff('pause', true);
    imageOnOff('play', false);

    interval = setInterval(()=>{
        cnt++;
        if (event_list.length === cnt) {
            return stopSimulation();
        }
        $('#evpBottomInfo tr.on').removeClass('on');
        let clctDt = event_list[cnt].clct_dt.replace(/\:|\-|\.| /gi, '')
        const bottomInfo = $('#evpBottomInfo #'+obj.service_id +'_'+clctDt);
        bottomInfo.addClass('on');
        $('.evpContainer').scrollTop(36 * cnt);

        const position = getKakaoPosition(event_list[cnt].cur_lat, event_list[cnt].cur_lng);
        draw.car.moveMarker(position);
        setSigState(phase_list[cnt], draw);

    }, 500);
}

function setSigState(phase, draw) {
    if (phase && phase.length) {
        phase.forEach((sigObj)=>{
            if (draw.sig.get(sigObj.service_id + '_' + sigObj.seq_no) === undefined) {
                draw.sig.set(sigObj.service_id + '_' + sigObj.seq_no, createSig(sigObj));
            }
            const evpSig = draw.sig.get(sigObj.service_id + '_' + sigObj.seq_no);
            evpSig.createRing(sigObj);
        });
    }

    if (draw.sig && draw.sig.length) {
        draw.sig.forEach((obj, key)=>{
            const idx = phase.findIndex((sig)=>{
                return sig.service_id + '_' + sig.seq_no === key;
            })

            if (idx === -1) {
                obj.deleteRing();
                obj.setState(1);
            }
        });
    }

}

function pauseSimulation() {
    if (!$('#pause').hasClass('on')) {
        return;
    }
    clearInterval(interval);
    imageOnOff('pause', false);
    imageOnOff('play', true);
}

function stopSimulation() {
    if (!$('#stop').hasClass('on')) {
        return;
    }
    clearInterval(interval);
    imageOnOff('stop', false);
    imageOnOff('pause', false);
    imageOnOff('play', true);
    cnt = 0;
    const serviceId = $('.history-table tr.on').attr('class').replace(/hs_| on/gi, '');
    clearSimulator();
    drawHistoryList(serviceId);
}

function clearSimulator() {
    _historyMap.forEach((obj)=>{
        const beforeDraw = obj.get('draw');
        if (beforeDraw) {
            beforeDraw.clear();
            obj.set('draw', null);
        }
    })
}

const initialArr = [
    'ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ',
    'ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'
];

const mixIntialArr = {
    'ㄳ': 'ㄱ' + 'ㅅ',
    'ㄵ': 'ㄴ' + 'ㅈ',
    'ㄶ': 'ㄴ' + 'ㅎ',
    'ㄺ': 'ㄹ' + 'ㄱ',
    'ㄻ': 'ㄹ' + 'ㅁ',
    'ㄼ': 'ㄹ' + 'ㅂ',
    'ㄽ': 'ㄹ' + 'ㅅ',
    'ㄾ': 'ㄹ' + 'ㅌ',
    'ㄿ': 'ㄹ' + 'ㅍ',
    'ㅀ': 'ㄹ' + 'ㅎ',
    'ㅄ': 'ㅂ' + 'ㅅ'
};

function getMixInitialSeparate(text) {
    let str = '';
    for (let ii = 0; ii < text.length; ii++) {
        str += mixIntialArr[text[ii]] || text[ii];
    }
    return str;
}

function getChosung(text) {
    let result = '';
    for (let i = 0; i < text.length; i++) {
        const code = text.charCodeAt(i);
        if (code >= 0xAC00 && code <= 0xD7A3) {
            const uniIndex = code - 0xAC00;
            const cho = Math.floor(uniIndex / 588);
            result += initialArr[cho];
        } else {
            result += text[i];
        }
    }
    return result;
}
function isMatch(node, searchText) {
    const { nodeid, name, regionid, lat, lng, addr1, addr2, addr3, ipaddr } = node;
    const baseInfo = `${regionid}_${addr1}_${nodeid}_${name}`.toLowerCase();
    const mixChosung = getMixInitialSeparate(searchText);
    return (baseInfo.includes(searchText.toLowerCase()) || `${lng},${lat}` === searchText
        || getChosung(addr1 || '').includes(mixChosung)
        || getChosung(name || '').includes(mixChosung));
}

function searchTree(ev) {
    if (!ev || ev.key === 'Enter') {
        const searchText = $('#searchText').val();
        let searchData = [];
        if (searchText) {
            treeJson.forEach((obj)=>{
                if (isMatch(obj, searchText)) {
                    searchData.push(obj);
                }
            });

        }
        else {
            searchData = treeJson;
        }
        if (searchData.length !== treeJson.length) {
            isSearch = true;
        }
        else {
            isSearch = false;
        }
        const newData = getIntTreeData(searchData);
        const intTree = $('#intTree');

        intTree.jstree(true).settings.core.data = newData;
        intTree.jstree(true).refresh();
    }
}

function getIntTreeData(data) {
    const treeData = [];
    _signalInfoArr = [];
    if (data && data.length) {
        const checkMap = new Map();
        for (let obj of data) {
            const {nodeid, name, regionid, lat, lng, addr1, addr2, addr3, ipaddr} = obj;
            let regionId = regionid;
            if (isNull(regionId)) {
                regionId = '9999';
            }
            const signal = new SignalInfo(nodeid, name, lat, lng, addr1, addr2, addr3, regionid);
            _signalInfoArr.push(signal);
            const intStatus = getStatus(signal.status);

            if (!checkMap.get(regionId)) {

                // let text = `<strong class="centerNm_${regionId}">${addr1}</strong>
                //                     &nbsp;( 전체 : <span class="intTotal" id="intTotal_${regionId}" style="color:#4A90E2"></span> / 이상 :
                //                     <span class="intErrCnt" id="intErrCnt_${regionId}" style="color:#D9534F"></span> )`;
                let text = `<div style="display:flex; align-items:center; gap:5px;">
                                <div id="state_${regionId}"><div></div></div>
                                <div title="${addr1}" class="centerNm_${regionId}" style="width: 57px; text-overflow: ellipsis; overflow: hidden; font-weight:bold; font-size:13px;">${addr1}</div>
                                <div class="tot">전체 <span class="intTotal" id="intTotal_${regionId}"></span></div>
                                <div class="error">이상 <span class="intErrCnt" id="intErrCnt_${regionId}"></span></div>
                            </div>`;
                checkMap.set(regionId, true);
                const region = { "id": regionid, "parent": "#", "text": text,
                    "data" : {name: addr1, id: regionid, type: 'region'} };
                treeData.push(region);
            }

            let text = `<div style="display: flex; gap: 5px; align-items: center; font-size: 12px;">
                            <div id="int-status-${nodeid}" class="comm${intStatus}"></div>
                            <div class="int-name" title="${nodeid} ${name}" style="display: flex; gap: 5px;">
                                <div>${nodeid}</div> 
                                <div>${name}</div>
                            </div>
                        </div>`;
//                             <div class="int-name" title="${name} (${nodeid})">${name} (${nodeid})</div>
            const node = { "id": regionid + '_' + nodeid, "parent": regionid, "text": text,
                "data" : { lat, lng ,name: name, id: nodeid, regionid : regionid, type: 'int'} };
            treeData.push(node);
        }
        return treeData;
    }
}