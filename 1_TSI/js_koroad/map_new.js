var mapContainer;
var map;    //지도객체
var marker;
var polygon;

var customOverlay = null;

var ps;
var infowindow = null;
var troubleInfoWindow = null;

/** 거리재기 객체*/
var drawingFlag = false;    // 선이 그려지고 있는 상태를 가지고 있을 변수입니다
var drawingAreaFlag = false;

var clickLine           // 마우스로 클릭한 좌표로 그려질 선 객체입니다
var areaOverlay;        // 다각형의 면적정보를 표시할 커스텀오버레이 입니다
var textOverlay;        // 다각형의 면적정보를 표시할 커스텀오버레이 입니다
var distanceOverlay;    // 선의 거리정보를 표시할 커스텀오버레이 입니다
var dots = {};          // 선이 그려지고 있을때 클릭할 때마다 클릭 지점과 거리를 표시하는 커스텀 오버레이 배열입니다.

var roadMarker = [];
var searchMarker = [];	    //장소
var searchInfoWindow = []   //장소 이름 인포윈도우
var imsMarker = [];
var troubleMarker = [];
var linkLineArr = [];
var _EmergencyMap = new Map();

var IMS_VIEW_LEVEL = 8;	    //돌발 7

var overlayOn = false;

var roadviewMarker = null;

var _ToggleSiginfo = false;

let _CoordOverlay = null;

const stateMap = new Map();
stateMap.set(0, 'var(--red30)');
stateMap.set(1, 'var(--green10)');
stateMap.set(2, '#FFFF00');
stateMap.set(3, '#E5DEDE');
stateMap.set(4, '#CC6600');
stateMap.set(5, 'var(--pink30)');

const strokeMap = new Map();
strokeMap.set(1, 20);
strokeMap.set(2, 15);
strokeMap.set(3, 15);
strokeMap.set(4, 10);
strokeMap.set(5, 10);
strokeMap.set(6, 10);
strokeMap.set(7, 10);
strokeMap.set(8, 10);
strokeMap.set(9, 10);
strokeMap.set(10, 10);
strokeMap.set(11, 10);

const arrowMap = new Map();
arrowMap.set(1, 20);
arrowMap.set(2, 10);
arrowMap.set(3, 5);
arrowMap.set(4, 5);
arrowMap.set(5, 2);
arrowMap.set(6, 1);
arrowMap.set(7, 1);
arrowMap.set(8, 1);
arrowMap.set(9, 1);
arrowMap.set(10, 1);
arrowMap.set(11, 1);

var _isClick = null;
let _evpData = [];

$(document).ready(function () {
    init();
});



function init() {
    //정보관리창 닫을때 regionCd intNo 가저와서 해당 위치로 이동..
    var masterLng = sessionStorage.getItem('masterLng');
    var masterLat = sessionStorage.getItem('masterLat');
    //var lat = 35.871595504565676;
    //var lng = 128.601612749012;
    var lat = '37.5630934';
    var lng = '126.9752351';

    if (masterLng != null && masterLat != null) {
        lat = masterLat;
        lng = masterLng;
    }

    mapContainer = document.getElementById('map') // 지도를 표시할 div
    var mapOption = {
        center: new kakao.maps.LatLng(lat, lng),
        level: _Level,
        maxLevel : 11,
    };

    map = new kakao.maps.Map(mapContainer, mapOption); // 지도생성

    // map.setMaxLevel(11);
    // 지도와 스카이뷰 지도타입 컨트롤을 생성
    //var mapTypeControl = new kakao.maps.MapTypeControl();
    // 지도에 컨트롤을 추가해야 지도위에 표시됩니다
    // kakao.maps.ControlPosition은 컨트롤이 표시될 위치를 정의하는데 TOPRIGHT는 오른쪽 위를 의미합니다
    //map.addControl(mapTypeControl, kakao.maps.ControlPosition.TOPRIGHT);
    // 지도 확대 축소 줌 컨트롤을 생성
    var zoomControl = new kakao.maps.ZoomControl();
    map.addControl(zoomControl, kakao.maps.ControlPosition.RIGHT);

    // 신호현시 줌,이동 이벤트 분리
    kakao.maps.event.addListener(map, 'zoom_changed', mapZoomBound);
    kakao.maps.event.addListener(map, 'dragend', mapMoveBound);//드래그 종료시 이벤트발생
    // kakao.maps.event.addListener(map, 'rightclick', mapRightClick);//드래그 종료시 이벤트발생
    // kakao.maps.event.addListener(map, 'click', mapClick);//드래그 종료시 이벤트발생
    kakao.maps.event.addListener(map, 'mousemove', (ev)=>mapEvent('moveEvent', ev.latLng));
    kakao.maps.event.addListener(map, 'rightclick', (ev)=>mapEvent('rightClickEvent', ev.latLng));
    kakao.maps.event.addListener(map, 'click', (ev)=> mapEvent('clickEvent', ev.latLng));
    //kakao.maps.event.addListener(map, 'idle', mapIdle);

    /* // 맵클릭했을때 위도경도 찾기
    kakao.maps.event.addListener(map, 'click', function(mouseEvent) {
        var nowlatLng = mouseEvent.latLng;
        console.log(nowlatLng);
    });*/

    getSignalInfo();
    const worker = new Worker('/js/worker.js?v=2');
    worker.postMessage({message:"worker START"});

    worker.onmessage = (ev)=>{
        const data = JSON.parse(ev.data);
        const table = $('.evp-table');
        const img = $('.ic_signGroup');
        // const imgName = '/images/evp_icon';
        // let exp = '.png';
        let emptyStr = '<tr><td colspan="2" class="empty-evp">조회된 내용이 없습니다.</td></tr>';
        _evpData = data;
        let method = '';
        $('.evp_tot_cnt').text('');
        if (data && data.length > 0) {
            $('.evp_tot_cnt').text('발생건수 ' + data.length + '건');
            table.empty();
            // exp = '.gif';
            let str = '';
            for (let obj of data) {
                let className = '';
                if (_isClick && obj.service_id === _isClick) {
                    className = 'on';
                }
                str += `<tr class="tr_${obj.service_id} ${className}"><td>${obj.clct_dt}</td><td>${obj.service_id}<br>${obj.service_nm}</td></tr>`;
            }

            if (_isClick) {
                drawEvp(_isClick);
            }

            table.html(str);
            data.forEach((obj)=>{
                const $service = $('.evp-table .tr_' + obj.service_id);
                $service.off('click');
                $service.on('click',()=> evpClickEvent(obj.service_id));
            });
            method = 'addClass';
        }
        else {
            if ($('.evp-table tr.on').length > 0) {
                $("#evpBottomInfo").empty();
            }

            if ($('.empty-evp').length === 0) {
                table.html(emptyStr);
            }

            if (_EmergencyMap.size){
                _EmergencyMap.forEach((obj)=>{
                    obj.clear();
                });

                _EmergencyMap.clear();
                _isClick = null;
            }
            method = 'removeClass';
        }
        img[method]('on');
    }

    function evpClickEvent(service_id) {
        if (_EmergencyMap.size > 0){
            _EmergencyMap.forEach((obj)=>{
                obj.clear();
            });
            _EmergencyMap.clear();
        }
        _isClick = service_id;
        drawEvp(_isClick);
    }

    function drawEvp(serviceId) {
        const bottom = $('#evpBottomInfo');
        bottom.empty();
        $('.history-table tr.on').removeClass('on');
        if (serviceId) {
           if (_historyMap && _historyMap.size) {
               _historyMap.forEach((obj)=>{
                   if (obj.get('draw')) {
                       obj.get('draw').clear();
                       obj.set('draw', null);
                   }
               });
               if (interval) {
                   clearInterval(interval);
                   interval = null;
                   cnt = 0;
               }
           }
           if (!$('#evpBottomInfo .tr_'+ serviceId + '.on').length) {
               $('#evpBottomInfo tr.on').removeClass('on');
               $('#evpBottomInfo .tr_'+ serviceId).addClass('on');
           }
           let idx = _evpData.findIndex((obj)=> obj.service_id === serviceId);
           let bottomEl = "";
           if (idx > -1) {
               bottomEl = getBottomListEl(_evpData[idx], _evpData[idx].event_list[0], 0, _evpData[idx].ocr_type);
           }
           bottom.html(bottomEl);
           drawEmergencyRoad(_evpData[idx]);
        }
    }
}

let coordMarker;
function mapRightClick(e) {
    if (!$('.road_on')[0]) {
        emptyCoordMarkers();
        const textArea = $('<textarea>');
        let xCoordinate = e.latLng.getLng().toString();
        let yCoordinate = e.latLng.getLat().toString();

        if (xCoordinate.length > 11) {
            xCoordinate = xCoordinate.substring(0, 11);
        }

        if (yCoordinate.length > 10) {
            yCoordinate = yCoordinate.substring(0, 10);
        }
        const text = yCoordinate + "," + xCoordinate;
        textArea.val(text);
        $('body').append(textArea);
        textArea[0].select();
        document.execCommand("copy");
        textArea.remove();

        createCoordMarkers(e.latLng, text);
    }
}

function mapClick(){
    emptyCoordMarkers();
}

function getKakaoPosition(y, x) {
    return new kakao.maps.LatLng(y, x);
}

function drawHistory(data) {
    return new EmergencyObj(data);
}

function createSig(data) {
    // return new EmergencySig(data);
    return new EmergencyCircle(data);
}

function drawEmergencyRoad(data) {
    if (data) {
        if (_EmergencyMap.size > 0) {
            const evpObj = _EmergencyMap.get(data.service_id);
            if (evpObj) {
                evpObj.car.moveMarker(getKakaoPosition(data.event_list[0].cur_lat, data.event_list[0].cur_lng));
                data.phase_list.forEach((obj)=>{
                    const sig = evpObj.sig.get(obj.service_id + '_' + obj.seq_no);
                    if (sig) {
                        sig.createRing(obj);
                    }
                });
            }
            else {
                _EmergencyMap.forEach((obj)=>{
                    obj.clear();
                });
                _EmergencyMap.clear();
                const emgObj = new EmergencyObj(data);
                _EmergencyMap.set(data.service_id, emgObj);
                _isClick = data.service_id;
            }
        }
        else {
            const emgObj = new EmergencyObj(data);
            _EmergencyMap.set(data.service_id, emgObj);
            _isClick = data.service_id;
        }
    }
    else {
        _EmergencyMap.forEach((obj)=>{
            obj.clear();
        });
        _EmergencyMap.clear();
        _isClick = null;
    }
}


function clearEmgMarker() {
    if (_EmergencyMap.size > 0) {
        _EmergencyMap.forEach((obj)=>{
            obj.get('marker').setMap(null);
            obj.get('line')[0].setMap(null);
            obj.get('line')[1].setMap(null);
            const circleArr = obj.get('circle');
            if (circleArr && circleArr.length) {
                for(let circle of circleArr) {
                    circle.setMap(null);
                }
            }
        });
        _EmergencyMap.clear();
    }
}

function moveMarker(position, marker) {
    marker.setCenter(position);
}

function customOverlayFnc(intNm, xCoord, yCoord) {
    if (customOverlay != null) customOverlay.setMap(null);
    if (intNm !== 'region') {
        // var content = '<div class ="sigCustom' + _Level + '"><span class="left"></span><span class="center">' + intNm + '<span id="customClose"><a href="javascript:customClose()">X</a></span></span><span class="right"></span></div>';
        var content = '<div class ="sigCustom"><span class="left"></span><span class="center">' + intNm + '&nbsp;<span id="customClose"><a href="javascript:customClose()">X</a></span></span><span class="right"></span></div>';
        // 커스텀 오버레이가 표시될 위치입니다
        var position = new kakao.maps.LatLng(yCoord, xCoord);
        // 커스텀 오버레이를 생성합니다
        customOverlay = new kakao.maps.CustomOverlay({
            position: position,
            content: content,
            zIndex: 100,
            yAnchor: 1.5
        });
        // 커스텀 오버레이를 지도에 표시합니다
        if (_Level > 2 && _Level < 6) customOverlay.setMap(map);

        // $('.sigCustom' + _Level + '').parent().css('width', '0px');
        // $('.sigCustom').parent().css('width', '0px');
    }
    overLayData = {
        name: intNm,
        lat: yCoord,
        lng: xCoord
    }

}

function customClose() {
    customOverlay.setMap(null);
}

function sigMapBoxClose() {
    $('.sigInfoBox').hide();
}

/****************************************************************************
 * 로드뷰 관련
 ****************************************************************************/
//로드호출
function getRoadView() {
    drawingAreaStop();
    drawingStop();

    var roadCheck = $("#road").attr("class");

    // 로드뷰 도로 오버레이가 보이게 합니다
    if (roadCheck === "road_on") {
        overlayOn = true,
            container = document.getElementById('container'), // 지도와 로드뷰를 감싸고 있는 div 입니다
            mapWrapper = document.getElementById('mapWrapper'), // 지도를 감싸고 있는 div 입니다
            mapContainer = document.getElementById('map'), // 지도를 표시할 div 입니다
            rvContainer = document.getElementById('roadview'); //로드뷰를 표시할 div 입니다

        var mapCenter = map.getCenter();

        // 로드뷰 객체를 생성합니다
        var rv = new kakao.maps.Roadview(rvContainer);

        // 좌표로부터 로드뷰 파노라마 ID를 가져올 로드뷰 클라이언트 객체를 생성합니다
        var rvClient = new kakao.maps.RoadviewClient();

        // 로드뷰에 좌표가 바뀌었을 때 발생하는 이벤트를 등록합니다
        kakao.maps.event.addListener(rv, 'position_changed', function () {

            // 현재 로드뷰의 위치 좌표를 얻어옵니다
            var rvPosition = rv.getPosition();

            // 지도의 중심을 현재 로드뷰의 위치로 설정합니다
            map.setCenter(rvPosition);

            // 지도 위에 로드뷰 도로 오버레이가 추가된 상태이면
            if (overlayOn) {
                // 마커의 위치를 현재 로드뷰의 위치로 설정합니다
                roadviewMarker.setPosition(rvPosition);
            }
        });

        // 마커 이미지를 생성합니다
        var markImage = new kakao.maps.MarkerImage(
            'http://t1.kakaocdn.net/localimg/localimages/07/mapapidoc/roadview_wk.png',
            new kakao.maps.Size(35, 39), {
                //마커의 좌표에 해당하는 이미지의 위치를 설정합니다.
                //이미지의 모양에 따라 값은 다를 수 있으나, 보통 width/2, height를 주면 좌표에 이미지의 하단 중앙이 올라가게 됩니다.
                offset: new kakao.maps.Point(14, 39)
            });

        // 드래그가 가능한 마커를 생성합니다
        roadviewMarker = new kakao.maps.Marker({
            image: markImage,
            position: mapCenter,
            draggable: true
        });

        // 마커에 dragend 이벤트를 등록합니다
        kakao.maps.event.addListener(roadviewMarker, 'dragend', function (mouseEvent) {
            // 현재 마커가 놓인 자리의 좌표입니다
            var position = roadviewMarker.getPosition();

            // 마커가 놓인 위치를 기준으로 로드뷰를 설정합니다
            toggleRoadview(position);
        });

        //지도에 클릭 이벤트를 등록합니다
        kakao.maps.event.addListener(map, 'click', function (mouseEvent) {
            // 지도 위에 로드뷰 도로 오버레이가 추가된 상태가 아니면 클릭이벤트를 무시합니다
            if (!overlayOn) {
                return;
            }

            $('#rvWrapper').show();

            // 클릭한 위치의 좌표입니다
            var position = mouseEvent.latLng;

            // 마커를 클릭한 위치로 옮깁니다
            roadviewMarker.setPosition(position);

            // 클락한 위치를 기준으로 로드뷰를 설정합니다
            toggleRoadview(position);
        });

        // 지도 위에 로드뷰 도로 오버레이를 추가합니다
        map.addOverlayMapTypeId(kakao.maps.MapTypeId.ROADVIEW);
        // 지도 위에 마커를 표시합니다
        roadviewMarker.setMap(map);

        //전달받은 좌표(position)에 가까운 로드뷰의 파노라마 ID를 추출하여 로드뷰를 설정하는 함수입니다
        function toggleRoadview(position) {
            rvClient.getNearestPanoId(position, 50, function (panoId) {
                // 파노라마 ID가 null 이면 로드뷰를 숨깁니다
                if (panoId === null) {
                    toggleMapWrapper(true, position);
                } else {
                    toggleMapWrapper(false, position);
                    // panoId로 로드뷰를 설정합니다
                    rv.setPanoId(panoId, position);
                }
            });
        }

        //지도를 감싸고 있는 div의 크기를 조정하는 함수입니다
        function toggleMapWrapper(active, position) {
            var widthDiff = wideFlag ? '10' : '290';
            if (active) {
                // 지도를 감싸고 있는 div의 너비가 100%가 되도록 class를 변경합니다
                //container.className = '';
                //$('#mapWrapper').css('width','100%');
                $('#mapWrapper').css('width', 'calc(100% - ' + widthDiff +'px');
                //$('#rvWrapper').css('width','0px');
                $('#rvWrapper').css('display','none');

                // 지도의 크기가 변경되었기 때문에 relayout 함수를 호출합니다
                map.relayout();

                // 지도의 너비가 변경될 때 지도중심을 입력받은 위치(position)로 설정합니다
                map.setCenter(position);
            } else {
                //$('#mapWrapper').css('width','59%');
                $('#mapWrapper').css('width', 'calc(60% - ' + widthDiff +'px');
                //$('#rvWrapper').css('width','40%');
                $('#rvWrapper').css('display','block');

                // 지도의 크기가 변경되었기 때문에 relayout 함수를 호출합니다
                map.relayout();

                // 지도의 너비가 변경될 때 지도중심을 입력받은 위치(position)로 설정합니다
                map.setCenter(position);
            }
        }

        //지도 위의 로드뷰 도로 오버레이를 추가,제거하는 함수입니다
        function toggleOverlay(active) {
            if (active) {
                overlayOn = true;

                // 지도 위에 로드뷰 도로 오버레이를 추가합니다
                map.addOverlayMapTypeId(kakao.maps.MapTypeId.ROADVIEW);

                // 지도 위에 마커를 표시합니다
                roadviewMarker.setMap(map);

                // 마커의 위치를 지도 중심으로 설정합니다
                roadviewMarker.setPosition(map.getCenter());

                // 로드뷰의 위치를 지도 중심으로 설정합니다
                toggleRoadview(map.getCenter());
            } else {
                overlayOn = false;

                // 지도 위의 로드뷰 도로 오버레이를 제거합니다
                map.removeOverlayMapTypeId(kakao.maps.MapTypeId.ROADVIEW);

                // 지도 위의 마커를 제거합니다
                roadviewMarker.setMap(null);
            }
        }

        //지도 위의 로드뷰 버튼을 눌렀을 때 호출되는 함수입니다
        function setRoadviewRoad() {
            var control = document.getElementById('roadviewControl');

            // 버튼이 눌린 상태가 아니면
            if (control.className.indexOf('active') === -1) {
                control.className = 'active';

                // 로드뷰 도로 오버레이가 보이게 합니다
                toggleOverlay(true);
            } else {
                control.className = '';

                // 로드뷰 도로 오버레이를 제거합니다
                toggleOverlay(false);
            }
        }

    } else {
        roadViewClose();
    }
}

//로드뷰에서 X버튼을 눌렀을 때 로드뷰를 지도 뒤로 숨기는 함수입니다
function closeRoadview() {
    const width = wideFlag ? 'calc(100% - 10px)':'calc(100% - 287px)';
    $('#mapWrapper').css('width', width);
    $('#rvWrapper').css('display','none');

    // 지도의 크기가 변경되었기 때문에 relayout 함수를 호출합니다
    map.relayout();

    // 현재 마커가 놓인 자리의 좌표입니다
    // if(roadviewMarker != null)
    // {
        // const position = roadviewMarker.getPosition();
        // 지도의 너비가 변경될 때 지도중심을 입력받은 위치(position)로 설정합니다
        // map.setCenter(position);
    // }
}

//로드뷰닫기
function roadViewClose() {
    overlayOn = false;
    //div설정
    closeRoadview();
    // 지도 위의 마커를 제거합니다
    if (roadviewMarker != null) roadviewMarker.setMap(null);
    // 지도 위의 로드뷰 도로 오버레이를 제거합니다
    map.removeOverlayMapTypeId(kakao.maps.MapTypeId.ROADVIEW);
}

// 검색결과 목록의 자식 Element를 제거하는 함수입니다
function removeAllChildNods(el) {
    while (el.hasChildNodes()) {
        el.removeChild(el.lastChild);
    }
}

//검색결과 항목을 Element로 반환하는 함수입니다
function getListItem(index, places) {
    var el = document.createElement('li'),
        itemStr = '<span class="markerbg marker_' + (index + 1) + '"></span>' +
            '<div class="info">' +
            '<a href="javascript:setBounds(\'' + places.y + '\', + \'' + places.x + '\', 4);"><h5 style="color:blue">' + places.place_name + '</h5></a>';
    if (places.address_name) {
        itemStr += '    <span>' + places.address_name + '</span>' +
            '   <span class="jibun gray">' + places.address_name + '</span>';
    } else {
        itemStr += '    <span>' + places.road_address_name + '</span>';
    }

    itemStr += '  <span class="tel">' + places.phone + '</span>' +
        '</div>';
    el.innerHTML = itemStr;
    el.className = 'item';
    return el;
}

//마커를 생성하고 지도 위에 마커를 표시하는 함수입니다
function addMarker(position, idx, title) {
    var imageSrc = 'images/goglemarker.png', // 마커 이미지 url, 스프라이트 이미지를 씁니다

        imageSize = new kakao.maps.Size(16, 30),  // 마커 이미지의 크기
        imgOptions = {
            spriteSize: new kakao.maps.Size(16, 30), // 스프라이트 이미지의 크기
            offset: new kakao.maps.Point(13, 37) // 마커 좌표에 일치시킬 이미지 내에서의 좌표
        },

        markerImage = new kakao.maps.MarkerImage(imageSrc, imageSize, imgOptions),
        marker = new kakao.maps.Marker({
            position: position, // 마커의 위치
            image: markerImage
        });

    var content = '<div>' + title + '</div>';
    var divinfowindow = new kakao.maps.InfoWindow({
        content: content, // 인포윈도우에 표시할 내용
        position: position // 마커의 위치
    });

    marker.setMap(map); // 지도 위에 마커를 표출합니다
    divinfowindow.open(map, marker);
    //divinfowindow.setMap(map);
    searchMarker.push(marker);  // 배열에 생성된 마커를 추가합니다
    searchInfoWindow.push(divinfowindow);
    return marker;
}

/**
 * 지도 center이동
 * lat,lon : 좌표값
 * level : 레벨
 */
function setBounds(lat, lon, getLevel) {
    if ($("#road").attr("class") == "road_on") {
        // 클릭한 위치의 좌표입니다
        var position = new kakao.maps.LatLng(lat, lon);

        // 마커 이미지를 생성합니다
        var markImage = new kakao.maps.MarkerImage(
            'http://i1.kakaocdn.net/localimg/localimages/07/mapapidoc/roadview_wk.png',
            new kakao.maps.Size(35, 39), {
                //마커의 좌표에 해당하는 이미지의 위치를 설정합니다.
                //이미지의 모양에 따라 값은 다를 수 있으나, 보통 width/2, height를 주면 좌표에 이미지의 하단 중앙이 올라가게 됩니다.
                offset: new kakao.maps.Point(14, 39)
            });

        // 드래그가 가능한 마커를 생성합니다
        var marker = new kakao.maps.Marker({
            image: markImage,
            position: position,
            draggable: true
        });

        // 마커를 클릭한 위치로 옮깁니다
        marker.setPosition(position);
        roadViewMap(position);
        map.setLevel(_Level, {anchor: position});
    } else {
        _Level = map.getLevel();

        //지도이동시 ZOOMIN값이 동일한 경우 FLAG 체크
        var flag = "N";

        if (_Level == getLevel) {
            flag = "Y";
        }
        // 이동할 위도 경도 위치를 생성합니다
        var moveLatLon = new kakao.maps.LatLng(lat, lon);

        // 지도 중심을 이동 시킵니다
        map.setCenter(moveLatLon);
        map.setLevel(getLevel);

        if (flag == "Y") {
            mapMoveBound();
        }
    }
}

/****************************************************************************
 * 거리재기
 ****************************************************************************/
function getDrawRoad() {
    
    drawingAreaStop();  // 면적재기초기화
    
    roadViewClose();    // 로드뷰닫기

    if (($("#draw").attr("class") == "road_on") && ($("#road").attr("class") != "road_on")) {

        var path = "";

        distanceFlag = true;

        // 지도에 클릭 이벤트를 등록합니다
        // 지도를 클릭하면 선 그리기가 시작됩니다 그려진 선이 있으면 지우고 다시 그립니다
        kakao.maps.event.addListener(map, 'click', function (mouseEvent) {

            if (distanceFlag) {

                // 마우스로 클릭한 위치입니다
                var clickPosition = mouseEvent.latLng;
                // 지도 클릭이벤트가 발생했는데 선을 그리고있는 상태가 아니면
                if (!drawingFlag) {
                    //거리재기초기화
                    drawingStop();

                    // 상태를 true로, 선이 그리고있는 상태로 변경합니다
                    drawingFlag = true;
                    distanceFlag = true;

                    // 클릭한 위치를 기준으로 선을 생성하고 지도위에 표시합니다
                    clickLine = new kakao.maps.Polyline({
                        map: map, // 선을 표시할 지도입니다
                        path: [clickPosition], // 선을 구성하는 좌표 배열입니다 클릭한 위치를 넣어줍니다
                        strokeWeight: 3, // 선의 두께입니다
                        strokeColor: '#db4040', // 선의 색깔입니다
                        strokeOpacity: 1, // 선의 불투명도입니다 0에서 1 사이값이며 0에 가까울수록 투명합니다
                        strokeStyle: 'solid' // 선의 스타일입니다
                    });

                    // 선이 그려지고 있을 때 마우스 움직임에 따라 선이 그려질 위치를 표시할 선을 생성합니다
                    moveLine = new kakao.maps.Polyline({
                        strokeWeight: 3, // 선의 두께입니다
                        strokeColor: '#db4040', // 선의 색깔입니다
                        strokeOpacity: 0.5, // 선의 불투명도입니다 0에서 1 사이값이며 0에 가까울수록 투명합니다
                        strokeStyle: 'solid' // 선의 스타일입니다
                    });

                    // 클릭한 지점에 대한 정보를 지도에 표시합니다
                    displayCircleDot(clickPosition, 0);

                } else { // 선이 그려지고 있는 상태이면
                    // 그려지고 있는 선의 좌표 배열을 얻어옵니다
                    var path = clickLine.getPath();
                    // 좌표 배열에 클릭한 위치를 추가합니다
                    path.push(clickPosition);

                    // 다시 선에 좌표 배열을 설정하여 클릭 위치까지 선을 그리도록 설정합니다
                    clickLine.setPath(path);
                    var distance = Math.round(clickLine.getLength());
                    displayCircleDot(clickPosition, distance);
                }
            }
        });

        // 지도에 마우스무브 이벤트를 등록합니다
        // 선을 그리고있는 상태에서 마우스무브 이벤트가 발생하면 그려질 선의 위치를 동적으로 보여주도록 합니다
        kakao.maps.event.addListener(map, 'mousemove', function (mouseEvent) {
            // 지도 마우스무브 이벤트가 발생했는데 선을 그리고있는 상태이면
            if (drawingFlag) {

                // 마우스 커서의 현재 위치를 얻어옵니다
                var mousePosition = mouseEvent.latLng;
                // 마우스 클릭으로 그려진 선의 좌표 배열을 얻어옵니다
                var path = clickLine.getPath();

                // 마우스 클릭으로 그려진 마지막 좌표와 마우스 커서 위치의 좌표로 선을 표시합니다
                var movepath = [path[path.length - 1], mousePosition];
                moveLine.setPath(movepath);
                moveLine.setMap(map);

                /*var distance = Math.round(clickLine.getLength() + moveLine.getLength()), // 선의 총 거리를 계산합니다
                    content = '<div class="dotOverlay distanceInfo">총거리 <span class="number">' + distance + '</span>m</div>'; // 커스텀오버레이에 추가될 내용입니다

                // 거리정보를 지도에 표시합니다
                showDistance(content, mousePosition); */

                // 지도 위에 면적정보 커스텀오버레이가 표시되고 있다면 지도에서 제거합니다
                if (textOverlay) {
                    textOverlay.setMap(null);
                    textOverlay = null;
                }

                var content = '<div class="textInfo">마우스오른쪽 버튼을 <br>\n\r 누르시면 끝마칩니다.</div>'; // 커스텀오버레이에 추가될 내용입니다

                // 면적정보를 지도에 표시합니다
                textOverlay = new kakao.maps.CustomOverlay({
                    map: map, // 커스텀오버레이를 표시할 지도입니다
                    content: content,  // 커스텀오버레이에 표시할 내용입니다
                    xAnchor: 0,
                    yAnchor: 0,
                    position: mousePosition  // 커스텀오버레이를 표시할 위치입니다. 위치는 다각형의 마지막 좌표로 설정합니다
                });
            }
        });

        // 지도에 마우스 오른쪽 클릭 이벤트를 등록합니다
        // 선을 그리고있는 상태에서 마우스 오른쪽 클릭 이벤트가 발생하면 선 그리기를 종료합니다
        kakao.maps.event.addListener(map, 'rightclick', function (mouseEvent) {
            // 지도 오른쪽 클릭 이벤트가 발생했는데 선을 그리고있는 상태이면
            if (drawingFlag) {

                // 마우스무브로 그려진 선은 지도에서 제거합니다
                moveLine.setMap(null);
                moveLine = null;

                // 마우스 클릭으로 그린 선의 좌표 배열을 얻어옵니다
                var path = clickLine.getPath();

                // 선을 구성하는 좌표의 개수가 2개 이상이면
                if (path.length > 1) {
                    // 마지막 클릭 지점에 대한 거리 정보 커스텀 오버레이를 지웁니다
                    if (dots[dots.length - 1].distance) {
                        dots[dots.length - 1].distance.setMap(null);
                        dots[dots.length - 1].distance = null;
                    }
                    var distance = Math.round(clickLine.getLength()), // 선의 총 거리를 계산합니다
                        content = getTimeHTML(distance); // 커스텀오버레이에 추가될 내용입니다

                    // 그려진 선의 거리정보를 지도에 표시합니다
                    showDistance(content, path[path.length - 1]);

                } else {
                    // 선을 구성하는 좌표의 개수가 1개 이하이면
                    // 지도에 표시되고 있는 선과 정보들을 지도에서 제거합니다.
                    deleteClickLine();
                    deleteCircleDot();
                    deleteDistnce();
                }

                // 상태를 false로, 그리지 않고 있는 상태로 변경합니다
                drawingFlag = false;

                if (textOverlay) {
                    textOverlay.setMap(null);
                    textOverlay = null;
                }
            }
        });

    } else {
        drawingStop();  //거리재기초기화
    }
}

//거리재기초기화
function drawingStop() {

    // 상태를 true로, 선이 그리고있는 상태로 변경합니다
    drawingFlag = false;

    distanceFlag = false;
    // 지도 위에 선이 표시되고 있다면 지도에서 제거합니다
    deleteClickLine();

    // 지도 위에 커스텀오버레이가 표시되고 있다면 지도에서 제거합니다
    deleteDistnce();
    // 지도 위에 선을 그리기 위해 클릭한 지점과 해당 지점의 거리정보가 표시되고 있다면 지도에서 제거합니다
    deleteCircleDot();

    if (textOverlay) {
        textOverlay.setMap(null);
        textOverlay = null;
    }
}

//클릭으로 그려진 선을 지도에서 제거하는 함수입니다
function deleteClickLine() {
    if (clickLine) {
        clickLine.setMap(null);
        clickLine = null;
    }
}

// 마우스 드래그로 그려지고 있는 선의 총거리 정보를 표시하거
// 마우스 오른쪽 클릭으로 선 그리가 종료됐을 때 선의 정보를 표시하는 커스텀 오버레이를 생성하고 지도에 표시하는 함수입니다
function showDistance(content, position) {

    if (distanceOverlay) { // 커스텀오버레이가 생성된 상태이면

        // 커스텀 오버레이의 위치와 표시할 내용을 설정합니다
        distanceOverlay.setPosition(position);
        distanceOverlay.setContent(content);

    } else { // 커스텀 오버레이가 생성되지 않은 상태이면

        // 커스텀 오버레이를 생성하고 지도에 표시합니다
        distanceOverlay = new kakao.maps.CustomOverlay({
            map: map, // 커스텀오버레이를 표시할 지도입니다
            content: content,  // 커스텀오버레이에 표시할 내용입니다
            position: position, // 커스텀오버레이를 표시할 위치입니다.
            xAnchor: 0,
            yAnchor: 0,
            zIndex: 3
        });
    }
}

// 그려지고 있는 선의 총거리 정보와
// 선 그리가 종료됐을 때 선의 정보를 표시하는 커스텀 오버레이를 삭제하는 함수입니다
function deleteDistnce() {
    if (distanceOverlay) {
        distanceOverlay.setMap(null);
        distanceOverlay = null;
    }
}

// 선이 그려지고 있는 상태일 때 지도를 클릭하면 호출하여
// 클릭 지점에 대한 정보 (동그라미와 클릭 지점까지의 총거리)를 표출하는 함수입니다
function displayCircleDot(position, distance) {
    // 클릭 지점을 표시할 빨간 동그라미 커스텀오버레이를 생성합니다
    var circleOverlay = new kakao.maps.CustomOverlay({
        content: '<span class="dot"></span>',
        position: position,
        zIndex: 1
    });
    // 지도에 표시합니다
    circleOverlay.setMap(map);
    if (distance > 0) {
        // 클릭한 지점까지의 그려진 선의 총 거리를 표시할 커스텀 오버레이를 생성합니다
        var distanceOverlay = new kakao.maps.CustomOverlay({
            content: '<div class="dotOverlay">거리 <span class="number">' + distance + '</span>m</div>',
            position: position,
            yAnchor: 1,
            zIndex: 2
        });
        // 지도에 표시합니다
        distanceOverlay.setMap(map);
    }
    // 배열에 추가합니다
    dots.push({circle: circleOverlay, distance: distanceOverlay});
}

// 클릭 지점에 대한 정보 (동그라미와 클릭 지점까지의 총거리)를 지도에서 모두 제거하는 함수입니다
function deleteCircleDot() {
    var i;
    for (i = 0; i < dots.length; i++) {
        if (dots[i].circle) {
            dots[i].circle.setMap(null);
        }
        if (dots[i].distance) {
            dots[i].distance.setMap(null);
        }
    }
    dots = [];
}

// 마우스 우클릭 하여 선 그리기가 종료됐을 때 호출하여
// 그려진 선의 총거리 정보와 거리에 대한 도보, 자전거 시간을 계산하여
// HTML Content를 만들어 리턴하는 함수입니다
function getTimeHTML(distance) {
    // 도보의 시속은 평균 4km/h 이고 도보의 분속은 67m/min입니다
    var walkkTime = distance / 67 | 0;
    var walkHour = '', walkMin = '';
    // 계산한 도보 시간이 60분 보다 크면 시간으로 표시합니다
    if (walkkTime > 60) {
        walkHour = '<span class="number">' + Math.floor(walkkTime / 60) + '</span>시간 '
    }
    walkMin = '<span class="number">' + walkkTime % 60 + '</span>분'
    // 자전거의 평균 시속은 16km/h 이고 이것을 기준으로 자전거의 분속은 267m/min입니다
    var bycicleTime = distance / 227 | 0;
    var bycicleHour = '', bycicleMin = '';
    // 계산한 자전거 시간이 60분 보다 크면 시간으로 표출합니다
    if (bycicleTime > 60) {
        bycicleHour = '<span class="number">' + Math.floor(bycicleTime / 60) + '</span>시간 '
    }
    bycicleMin = '<span class="number">' + bycicleTime % 60 + '</span>분'
    // 거리와 도보 시간, 자전거 시간을 가지고 HTML Content를 만들어 리턴합니다
    var content = '<ul class="dotOverlay distanceInfo">';
    content += '    <li>';
    content += '        <span class="label">총거리</span><span class="number">' + distance + '</span>m';
    content += '    </li>';
    content += '    <li>';
    content += '        <span class="label">도보</span>' + walkHour + walkMin;
    content += '    </li>';
    content += '    <li>';
    content += '        <span class="label">자전거</span>' + bycicleHour + bycicleMin;
    content += '    </li>';
    content += '</ul>'
    return content;
}

/****************************************************************************
 * 면적재기
 ****************************************************************************/
function getDrawArea() {

    //거리재기초기화
    drawingStop();
    //로드뷰닫기
    roadViewClose();

    if (($("#area").attr("class") == "road_on") && ($("#road").attr("class") != "road_on")) {

        var path = "";

        areaFlag = true;

        kakao.maps.event.addListener(map, 'click', function (mouseEvent) {
            if (areaFlag) {

                // 마우스로 클릭한 위치입니다
                var clickPosition = mouseEvent.latLng;

                // 지도 클릭이벤트가 발생했는데 다각형이 그려지고 있는 상태가 아니면
                if (!drawingAreaFlag) {

                    //면적재기초기화
                    drawingAreaStop();
                    // 상태를 true로, 다각형을 그리고 있는 상태로 변경합니다
                    drawingAreaFlag = true;
                    areaFlag = true;

                    // 그려지고 있는 다각형을 표시할 다각형을 생성하고 지도에 표시합니다
                    drawingPolygon = new kakao.maps.Polygon({
                        map: map, // 다각형을 표시할 지도입니다
                        path: [clickPosition], // 다각형을 구성하는 좌표 배열입니다 클릭한 위치를 넣어줍니다
                        strokeWeight: 3, // 선의 두께입니다
                        strokeColor: '#00a0e9', // 선의 색깔입니다
                        strokeOpacity: 1, // 선의 불투명도입니다 0에서 1 사이값이며 0에 가까울수록 투명합니다
                        strokeStyle: 'solid', // 선의 스타일입니다
                        fillColor: '#00a0e9', // 채우기 색깔입니다
                        fillOpacity: 0.2 // 채우기 불투명도입니다
                    });

                    // 그리기가 종료됐을때 지도에 표시할 다각형을 생성합니다
                    polygon = new kakao.maps.Polygon({
                        path: [clickPosition], // 다각형을 구성하는 좌표 배열입니다 클릭한 위치를 넣어줍니다
                        strokeWeight: 3, // 선의 두께입니다
                        strokeColor: '#00a0e9', // 선의 색깔입니다
                        strokeOpacity: 1, // 선의 불투명도입니다 0에서 1 사이값이며 0에 가까울수록 투명합니다
                        strokeStyle: 'solid', // 선의 스타일입니다
                        fillColor: '#00a0e9', // 채우기 색깔입니다
                        fillOpacity: 0.2 // 채우기 불투명도입니다
                    });

                } else { // 다각형이 그려지고 있는 상태이면

                    // 그려지고 있는 다각형의 좌표에 클릭위치를 추가합니다
                    // 다각형의 좌표 배열을 얻어옵니다
                    var drawingPath = drawingPolygon.getPath();

                    // 좌표 배열에 클릭한 위치를 추가하고
                    drawingPath.push(clickPosition);

                    // 다시 다각형 좌표 배열을 설정합니다
                    drawingPolygon.setPath(drawingPath);

                    // 그리기가 종료됐을때 지도에 표시할 다각형의 좌표에 클릭 위치를 추가합니다
                    // 다각형의 좌표 배열을 얻어옵니다
                    var path = polygon.getPath();

                    // 좌표 배열에 클릭한 위치를 추가하고
                    path.push(clickPosition);

                    // 다시 다각형 좌표 배열을 설정합니다
                    polygon.setPath(path);

                }
            }
        });

        // 지도에 마우스무브 이벤트를 등록합니다
        // 다각형을 그리고있는 상태에서 마우스무브 이벤트가 발생하면 그려질 다각형의 위치를 동적으로 보여주도록 합니다
        kakao.maps.event.addListener(map, 'mousemove', function (mouseEvent) {
            // 지도 마우스무브 이벤트가 발생했는데 다각형을 그리고있는 상태이면
            if (drawingAreaFlag) {
                // 마우스 커서의 현재 위치를 얻어옵니다
                var mousePosition = mouseEvent.latLng;

                // 그려지고있는 다각형의 좌표배열을 얻어옵니다
                var path = drawingPolygon.getPath();

                // 마우스무브로 추가된 마지막 좌표를 제거합니다
                if (path.length > 1) {
                    path.pop();
                }

                // 마우스의 커서 위치를 좌표 배열에 추가합니다
                path.push(mousePosition);
                // 그려지고 있는 다각형의 좌표를 다시 설정합니다
                drawingPolygon.setPath(path);

                // 지도 위에 면적정보 커스텀오버레이가 표시되고 있다면 지도에서 제거합니다
                if (textOverlay) {
                    textOverlay.setMap(null);
                    textOverlay = null;
                }

                var content = '<div class="textInfo">마우스오른쪽 버튼을 <br>\n\r 누르시면 끝마칩니다.</div>'; // 커스텀오버레이에 추가될 내용입니다

                // 면적정보를 지도에 표시합니다
                textOverlay = new kakao.maps.CustomOverlay({
                    map: map, // 커스텀오버레이를 표시할 지도입니다
                    content: content,  // 커스텀오버레이에 표시할 내용입니다
                    xAnchor: 0,
                    yAnchor: 0,
                    position: mousePosition  // 커스텀오버레이를 표시할 위치입니다. 위치는 다각형의 마지막 좌표로 설정합니다
                });

            }
        });

        // 지도에 마우스 오른쪽 클릭 이벤트를 등록합니다
        // 다각형을 그리고있는 상태에서 마우스 오른쪽 클릭 이벤트가 발생하면 그리기를 종료합니다
        kakao.maps.event.addListener(map, 'rightclick', function (mouseEvent) {
            // 지도 오른쪽 클릭 이벤트가 발생했는데 다각형을 그리고있는 상태이면
            if (drawingAreaFlag) {

                // 그려지고있는 다각형을  지도에서 제거합니다
                drawingPolygon.setMap(null);
                drawingPolygon = null;

                // 클릭된 죄표로 그릴 다각형의 좌표배열을 얻어옵니다
                var path = polygon.getPath();

                // 다각형을 구성하는 좌표의 개수가 3개 이상이면
                if (path.length > 2) {

                    // 지도에 다각형을 표시합니다
                    polygon.setMap(map);
                    var area = Math.round(polygon.getArea()), // 다각형의 총면적을 계산합니다
                        content = '<div class="info">총면적 <span class="areaNumber"> ' + area + '</span> m<sup>2</sup></div>'; // 커스텀오버레이에 추가될 내용입니다

                    // 면적정보를 지도에 표시합니다
                    areaOverlay = new kakao.maps.CustomOverlay({
                        map: map, // 커스텀오버레이를 표시할 지도입니다
                        content: content,  // 커스텀오버레이에 표시할 내용입니다
                        xAnchor: 0,
                        yAnchor: 0,
                        position: path[path.length - 1]  // 커스텀오버레이를 표시할 위치입니다. 위치는 다각형의 마지막 좌표로 설정합니다
                    });

                } else {

                    // 다각형을 구성하는 좌표가 2개 이하이면 다각형을 지도에 표시하지 않습니다
                    polygon = null;
                }

                // 상태를 false로, 그리지 않고 있는 상태로 변경합니다
                drawingAreaFlag = false;

                if (textOverlay) {
                    textOverlay.setMap(null);
                    textOverlay = null;
                }
            }
        });

    } else {
        //면적재기초기화
        drawingAreaStop();
    }
}

//면적재기초기화
function drawingAreaStop() {

    drawingAreaFlag = false;
    areaFlag = false;

    // 지도 위에 다각형이 표시되고 있다면 지도에서 제거합니다
    if (polygon) {
        polygon.setMap(null);
        polygon = null;
    }

    // 지도 위에 면적정보 커스텀오버레이가 표시되고 있다면 지도에서 제거합니다
    if (areaOverlay) {
        areaOverlay.setMap(null);
        areaOverlay = null;
    }

    if (textOverlay) {
        textOverlay.setMap(null);
        textOverlay = null;
    }
}

//마커초기화
function markerRemove(temp) {

    let str = "";
    const UserAgent = window.navigator.userAgent;
    //로드뷰아이콘
    if (temp === "road") {
        str = roadMarker;
        roadMarker = [];
    }

    if (temp === "search") {

        str = searchMarker;
        searchMarker = [];
    }
    if (temp === "infowindow") {

        str = searchInfoWindow;
        searchInfoWindow = [];
    }
    if (temp === "ims") {
        str = imsMarker;
        imsMarker = [];
        // let UserAgent = window.navigator.userAgent;
        if (UserAgent.match(/iPhone|iPod|Android|Windows CE|BlackBerry|Symbian|Windows Phone|webOS|Opera Mini|Opera Mobi|POLARIS|IEMobile|lgtelecom|nokia|SonyEricsson/i) != null || UserAgent.match(/LG|SAMSUNG|Samsung/) != null) {

        } else {
            toolClose();
        }
    }

    if (temp === "imsLink") {
        str = linkLineArr;
        linkLineArr = [];
    }

    if (temp === "trouble") {

        str = troubleMarker;
        troubleMarker = [];
        // let UserAgent = window.navigator.userAgent;
        if (UserAgent.match(/iPhone|iPod|Android|Windows CE|BlackBerry|Symbian|Windows Phone|webOS|Opera Mini|Opera Mobi|POLARIS|IEMobile|lgtelecom|nokia|SonyEricsson/i) != null || UserAgent.match(/LG|SAMSUNG|Samsung/) != null) {

        } else {
            toolClose();
        }
    }

    // 지도 위에 표시되고 있는 마커를 모두 제거합니다
    for (var i = 0; i < str.length; i++) {
        str[i].setMap(null);
    }

    str = [];
}

//마커지도에 표출
function setMarker(points, title, temp, img, markerSize) {
    // 지도를 재설정할 범위정보를 가지고 있을 LatLngBounds 객체를 생성합니다
    var bounds = new kakao.maps.LatLngBounds();

    for (var i = 0; i < points.length; i++) {

        // 마커 이미지의 이미지 주소입니다
        var imgPath = MAP_IMAGE_PATH + img[i];

        // 마커 이미지의 이미지 크기 입니다
        var imageSize = new kakao.maps.Size(markerSize, markerSize);

        // 마커 이미지를 생성합니다
        var markerImage = createMarkerImage(imgPath, imageSize);
        //마커생성
        createMarker(points[i], title[i], markerImage, temp);


    }

    //marker 컨트롤
    markerView();
}

/*********************************************************************
 * marker 이미지 zoomin 될때 컨트롤
 *********************************************************************/
function markerView() {

    var ims = $("#ims").attr("class");

    //지도의  레벨을 얻어옵니다
    _Level = map.getLevel();
    /**---------------------------------------------------------------
     * 돌발 보임
     * ---------------------------------------------------------------*/
    if (_Level < IMS_VIEW_LEVEL) {

        if (ims == "road_on") {
            if (imsMarker.length > 0) {
                for (var i = 0; i < imsMarker.length; i++) {
                    imsMarker[i].setVisible(true);
                }
            } else {
                if (imsFlag) {
                    getIMS();
                }
            }
        }

        /**---------------------------------------------------------------
         * 돌발 삭제
         * ---------------------------------------------------------------*/
    } else {
        markerRemove("ims");
        //markerRemove("imsLink");
    }
}

//마커이미지의 주소와, 크기, 옵션으로 마커 이미지를 생성하여 리턴하는 함수입니다
function createMarkerImage(src, size) {
    var markerImage = new kakao.maps.MarkerImage(src, size);
    return markerImage;
}

//마커생성
function createMarker(points, title, markerImage, temp) {
    marker = new kakao.maps.Marker({
        position: new kakao.maps.LatLng(points[0], points[1]), // 마커를 표시할 위치
        title: title, // 마커의 타이틀, 마커에 마우스를 올리면 타이틀이 표시됩니다
        clickable: true,
        image: markerImage // 마커 이미지
    });

    return marker;
}

/****************************************************************************************************
 * 돌발 & 전면통제 인포윈도우 닫기
 ****************************************************************************************************/
function toolClose() {
    if (infowindow != null) infowindow.close();
    if (troubleInfoWindow != null) troubleInfoWindow.close();
}

/********************************************************************************
 * 현재위치 찾기
 *********************************************************************************/
function getMyLocation() {
    if (navigator.geolocation) {
        var geo_options = {
            enableHighAccuracy: true, // 불리언
            maximumAge: 0, // 천분의 1초 단위
            timeout: 10000 // 천분의 1초 단위
        };

        navigator.geolocation.getCurrentPosition(showPosition, showError, geo_options);

    } else {
        alert("Geolocation is not supported by this browser.");
    }
}

function showPosition(position) {
    var myCenter = null;
    myCenter = new kakao.maps.LatLng(position.coords.latitude, position.coords.longitude);
    map.setCenter(myCenter);

    var msg = "당신은 " +
        new Date(position.timestamp).toLocaleString() + "에 " +
        " 위도 " + position.coords.latitude +
        " 경도 " + position.coords.longitude + "에서 " +
        " 약 " + position.coords.accuracy + " 미터 떨어진 곳에 있습니다.";
    //console.log(msg);
}

function showError(error) {
    var errMsg = '';
    switch (error.code) {
        case error.PERMISSION_DENIED:
            errMsg = "User denied the request for Geolocation.";
            break;
        case error.POSITION_UNAVAILABLE:
            errMsg = "Location information is unavailable.";
            break;
        case error.TIMEOUT:
            errMsg = "The request to get user location timed out.";
            break;
        case error.UNKNOWN_ERROR:
            errMsg = "An unknown error occurred.";
            break;
    }
    alert(errMsg);
}

/********************************************************************************
 * 신호정보 팝업 토글
 *********************************************************************************/
function toggleSiginfo() {
    if ($("#toggle_siginfo").attr("class") == "road_on") {
        _ToggleSiginfo = true;
        if (customOverlay != null) customOverlay.setMap(null);
    } else _ToggleSiginfo = false;
    getSignalInfo();
}
function emptyCoordMarkers() {
    if (coordMarker) {
        coordMarker.close();
        coordMarker = null;
    }
    if (_CoordOverlay) {
        _CoordOverlay.setMap(null);
    }
}

function createCoordMarkers(latLng, text) {

    _CoordOverlay = new kakao.maps.Marker({
        position: latLng
    });

    _CoordOverlay.setMap(map);

    coordMarker = new kakao.maps.InfoWindow({
        position: latLng,
        content: '<div style="padding: 5px; font-weight: bold; font-size: 12px;">'+ text +'</div>'
    })
    coordMarker.open(map, _CoordOverlay);
}

/****************************************************************************
 * 좌표검색
 ****************************************************************************/
function moveToPosition(e) {
    if (e && e.keyCode !== 13) return;
    emptyCoordMarkers();
    const coordinates =  $('#lctn_coord');
    if (!coordinates.val()) {
        alert('좌표값을 입력해주세요.');
        return coordinates.focus();
    }
    const coordArr = coordinates.val().split(',');
    if (coordArr.length !== 2 || isNaN(Number(coordArr[0].trim())) || isNaN(Number(coordArr[1].trim())))  {
        alert('좌표값 형식에 맞게 입력해주세요.');
        return coordinates.focus();
    }

    const lat  = Number(coordArr[0].trim());
    const lng  = Number(coordArr[1].trim());

    const position = new kakao.maps.LatLng(lat, lng);
    map.setCenter(position);
    map.setLevel(3);
    mapZoomBound();
    createCoordMarkers(position, lat + ','+ lng);

}


class EmergencyObj{
    constructor({ arr_lat, arr_lng, arr_tm, clct_dt,
                    cur_lat, cur_lng, ev_no, ocr_no, ocr_type,
                    phase_list, route_list, service_dist,
                    service_id, service_nm, status_cd, veh_len, event_list, node_list }) {
        this.arr_lat = arr_lat;
        this.arr_lng = arr_lng;
        this.arr_tm = arr_tm;
        this.clct_dt = clct_dt;
        this.cur_lat = cur_lat;
        this.cur_lng = cur_lng;
        this.ev_no = ev_no;
        this.ocr_no = ocr_no;
        this.ocr_type = ocr_type;
        this.phase_list = phase_list;
        this.route_list = route_list;
        this.service_dist = service_dist;
        this.service_id = service_id;
        this.service_nm = service_nm;
        this.status_cd = status_cd;
        this.veh_len = veh_len;
        this.road = null;
        this.sig = new Map();
        this.car = null;
        this.arrive = null;
        this.event_list = event_list;
        this.node_list = node_list;
        this.init();
    }

    init() {
        // this.setBound();
        this.road = new EmergencyRoadObj(this.route_list);

        if (this.node_list && this.node_list.length) {
            this.node_list.forEach((obj)=>{
                this.sig.set(obj.service_id + '_' + obj.seq_no , new EmergencyCircle(obj));
            })
        }

        if (this.phase_list && this.phase_list.length) {
            this.phase_list.forEach((obj)=>{
                const circle = this.sig.get(obj.service_id + '_' + obj.seq_no);
                if (circle) {
                    circle.createRing(obj);
                }
            })
        }
        if (this.event_list && this.event_list.length) {
            this.car = new EmergencyMarker(getKakaoPosition(this.event_list[0].cur_lat, this.event_list[0].cur_lng), '/images/car.gif');
        }
        this.arrive = new EmergencyMarker(getKakaoPosition(this.arr_lat, this.arr_lng), '/images/evp_arr.svg');
    }

    clear() {
        if (this.road) {
            this.road.hide();
        }

        if (this.sig && this.sig.size) {
            this.sig.forEach((obj)=>{
                obj.hide();
            });
            this.sig.clear();
        }

        if (this.car) {
            this.car.hide();
        }

        if (this.arrive) {
            this.arrive.hide();
        }

        const tree = $('#evp-table tr.on');
        if (tree.length) {
            const bottom = $('#evpBottomInfo');
            bottom.empty();
        }
    }

    setBound() {
        const bounds = new kakao.maps.LatLngBounds();

        if (this.node_list && this.node_list.length) {
            const {lat, lng} = this.node_list[0];
            bounds.extend(getKakaoPosition(lat, lng));
            bounds.extend(getKakaoPosition(this.arr_lat, this.arr_lng));
            map.setBounds(bounds);
        }
    }
}

// 1~5 레발 까지만 보임
// 통신 이상 : 0 (var(--red30), 빨강), 정상 : 1 (var(--green10), 초록), 점멸 : 2 (#FFFF00, 노랑), 소등 : 3 (#808080, 회색), 수동진행 : 4 (#CC6600, 갈색), 현시 유지 : 5 (#9933FF, 보라)
class Ring{
    constructor({service_id, node_id, ring, phase_no, flow_no, head_lat, head_lng, mid_lat, mid_lng, end_lat, end_lng, head_angle, end_angle, state}) {
        this.service_id = service_id;
        this.node_id = node_id;
        this.ring = ring;
        this.phase_no = phase_no;
        this.flow_no = flow_no;
        this.head_lat = head_lat;
        this.head_lng = head_lng;
        this.mid_lat = mid_lat;
        this.mid_lng = mid_lng;
        this.end_lat = end_lat;
        this.end_lng = end_lng;
        this.head_angle = head_angle;
        this.end_angle = end_angle;
        this.state = state;
        this.polyLine = null;
        this.init();
    }

    init() {
            const headPosition = getKakaoPosition(this.head_lat, this.head_lng);
            const midPosition = getKakaoPosition(this.mid_lat, this.mid_lng);
            const endPosition = getKakaoPosition(this.end_lat, this.end_lng);
            let stateColor = 'var(--red30)';
            if (!isNaN(Number(this.state))) {
                stateColor = stateMap.get(Number(this.state));
            }
            // 선이 그려지고 있을 때 마우스 움직임에 따라 선이 그려질 위치를 표시할 선을 생성합니다
            this.polyLine = new kakao.maps.Polyline({
                strokeWeight: arrowMap.get(_Level), // 선의 두께입니다
                path: [headPosition, midPosition, endPosition],
                strokeColor: stateColor, // 선의 색깔입니다
                strokeOpacity: 1, // 선의 불투명도입니다 0에서 1 사이값이며 0에 가까울수록 투명합니다
                strokeStyle: 'solid', // 선의 스타일입니다
                endArrow : true,
                zIndex: 2,
            });
    }

    show() {
        if (this.polyLine) {
            this.polyLine.setMap(map);
        }
    }

    hide() {
        if (this.polyLine) {
            this.polyLine.setMap(null);
        }
    }

    setPath(pathArr) {
        if (this.polyLine) {
            this.polyLine.setPath(pathArr);
        }
    }

    setOptions(option) {
        if (this.polyLine) {
            this.polyLine.setOptions(option);
        }
    }

    setLineWidth() {
        this.setOptions({strokeWeight :  arrowMap.get(_Level)});
    }

    setState(color) {
        if (this.polyLine) {
            this.polyLine.setOptions({
                strokeColor : color,
            });
        }
    }
}


class EmergencyCircle{
    constructor({service_id, seq_no, node_id, node_nm, lat, lng}) {
        this.service_id = service_id;
        this.seq_no = seq_no;
        this.node_id = node_id;
        this.node_nm = node_nm;
        this.lat = lat;
        this.lng = lng;
        this.circle = null;
        this.a_ring = null;
        this.b_ring = null;
        this.init();
    }

    init() {
        let stateColor = 'var(--green10)';
        const position = getKakaoPosition(this.lat, this.lng);
        const nodeNm = this.node_nm;
        this.circle = new kakao.maps.Circle({
            center : position,  // 원의 중심좌표 입니다
            radius: 60, // 미터 단위의 원의 반지름입니다
            strokeWeight: arrowMap.get(_Level), // 선의 두께입니다
            strokeColor: stateColor, // 선의 색깔입니다
            strokeOpacity: 1, // 선의 불투명도 입니다 1에서 0 사이의 값이며 0에 가까울수록 투명합니다
            strokeStyle: 'solid', // 선의 스타일 입니다
            fillColor: stateColor, // 채우기 색깔입니다
            fillOpacity: 0.3, // 채우기 불투명도 입니다
            zIndex: 2,
            name : nodeNm,
        });
        this.show();
    }

    show() {
        if (this.circle) {
            this.circle.setMap(map);
        }

        if (this.a_ring) {
            this.a_ring.show();
        }

        if (this.b_ring) {
            this.b_ring.show();
        }
    }

    hide() {
        if (this.circle) {
            this.circle.setMap(null);
        }

        this.deleteRing();
    }

    setState(state){
        const stateColor = this.getStateColor(state);
        if (this.circle) {
            this.circle.setOptions({
                strokeColor: stateColor,
                fillColor : stateColor,
            });
        }
    }

    getStateColor(state) {
        let stateColor = 'var(--red30)';
        if (!isNaN(Number(state))) {
            stateColor = stateMap.get(Number(state));
        }
        return stateColor;
    }

    createRing(data) {
        if (this.a_ring) {
            this.a_ring.hide();
            this.a_ring = null;
        }
        if (this.b_ring) {
            this.b_ring.hide();
            this.b_ring = null;
        }
        const stateArr = [1,2,4,5];
        if (stateArr.includes(data.state)) {
            this.a_ring = new Ring({
                service_id : data.service_id,
                node_id : data.node_id,
                ring : 1,
                phase_no : data.a_ring_phase,
                flow_no : data.a_flow_no,
                head_lat : data.a_head_lat,
                head_lng : data.a_head_lng,
                mid_lat : data.a_mid_lat,
                mid_lng : data.a_mid_lng,
                end_lat : data.a_end_lat,
                end_lng : data.a_end_lng,
                head_angle : data.a_head_angle,
                end_angle : data.a_end_angle,
                state : data.state
            });

            this.b_ring = new Ring({
                service_id : data.service_id,
                node_id    : data.node_id,
                ring       : 2,
                phase_no   : data.b_ring_phase,
                flow_no    : data.b_flow_no,
                head_lat   : data.b_head_lat,
                head_lng   : data.b_head_lng,
                mid_lat    : data.b_mid_lat,
                mid_lng    : data.b_mid_lng,
                end_lat    : data.b_end_lat,
                end_lng    : data.b_end_lng,
                head_angle : data.b_head_angle,
                end_angle  : data.b_end_angle,
                state      : data.state
            });

            this.a_ring.show();
            this.b_ring.show();
            this.setState(data.state);
        }
    }

    setLineWidth() {
        if (this.circle) {
            this.circle.setOptions({strokeWeight :  arrowMap.get(_Level)})
        }
        if (this.a_ring) {
            this.a_ring.setLineWidth()
        }

        if (this.b_ring) {
            this.b_ring.setLineWidth()
        }
    }

    deleteRing() {
        if (this.a_ring) {
            this.a_ring.hide();
            this.a_ring = null;
        }
        if (this.b_ring) {
            this.b_ring.hide();
            this.b_ring = null;
        }
    }
}

class EmergencyRoadObj{
    constructor(pathArr) {
        this.pathArr = pathArr;
        this.backPolyLine = null;
        this.polyLine = null;
        this.kakaoPathArr = [];
        this.init();
    }

    init() {

        if (this.pathArr && this.pathArr.length) {
            this.pathArr.forEach((obj)=>{
                this.kakaoPathArr.push(getKakaoPosition(obj.lat, obj.lng));
            });

            let strokeWidth = strokeMap.get(_Level);
            this.backPolyLine = new kakao.maps.Polyline({
                path: this.kakaoPathArr, // 선을 구성하는 좌표 배열입니다 클릭한 위치를 넣어줍니다
                strokeWeight: strokeWidth, // 선의 두께입니다
                strokeColor: '#ffffff', // 선의 색깔입니다
                strokeOpacity: 1, // 선의 불투명도입니다 0에서 1 사이값이며 0에 가까울수록 투명합니다
                strokeStyle: 'solid', // 선의 스타일입니다
                zIndex: 1,
            });

            // 선이 그려지고 있을 때 마우스 움직임에 따라 선이 그려질 위치를 표시할 선을 생성합니다
            this.polyLine = new kakao.maps.Polyline({
                strokeWeight: strokeWidth - 2, // 선의 두께입니다
                path: this.kakaoPathArr,
                strokeColor: '#3386ff', // 선의 색깔입니다
                strokeOpacity: 1, // 선의 불투명도입니다 0에서 1 사이값이며 0에 가까울수록 투명합니다
                strokeStyle: 'solid', // 선의 스타일입니다
                zIndex: 2,
            });

            this.show();
            this.setBound();
        }
    }

    setLineWidth() {
        this.backPolyLine.setOptions({strokeWeight: strokeMap.get(_Level)})
        this.polyLine.setOptions({strokeWeight: strokeMap.get(_Level) - 2})
    }

    show() {
        if (this.backPolyLine) {
            this.backPolyLine.setMap(map);
        }
        if (this.polyLine) {
            this.polyLine.setMap(map);
        }
    }

    hide() {
        if (this.backPolyLine) {
            this.backPolyLine.setMap(null);
        }
        if (this.polyLine) {
            this.polyLine.setMap(null);
        }
    }

    setBound() {
        if (this.kakaoPathArr.length > 0) {
            const bounds = new kakao.maps.LatLngBounds();
            bounds.extend(this.kakaoPathArr[0]);
            bounds.extend(this.kakaoPathArr[this.pathArr.length - 1]);
            map.setBounds(bounds);
            this.setLineWidth();
        }
    }
}

class EmergencyMarker{
    constructor(position, img) {
        this.position = position;
        this.marker = null;
        this.imgSrc = img;
        this.init();
    }

    init() {
        const imgSrc = this.imgSrc;
        let markImage = new kakao.maps.MarkerImage(
            imgSrc,
            new kakao.maps.Size(32, 39), {
                 offset: new kakao.maps.Point(16, 39)
            });

        const position = this.position;
        this.marker = new kakao.maps.Marker({
            image: markImage,
            position: position,
            zIndex: 11
        });
        this.show();
    }

    show() {
        if (this.marker) {
            this.marker.setMap(map);
        }
    }

    hide() {
        if (this.marker) {
            this.marker.setMap(null);
        }
    }

    moveMarker(position) {
        if (this.marker) {
            this.marker.setPosition(position);
        }
    }
}