/*
 * 전체 신호제어기를 메모리에 저장해서 등록함(Bean 으로 등록하면 됨)
 */
var _mapSignal = new HashMap();
var sigInfowindow = null;
var cvibMarkerArr = [];
var signalArr = [];
var _Flag = null;
var siginfoPhaseDetailWin = null;
var _CvibObjArr = [];
var _CvibCircleImgArr = [];
var _CvibOutCircleImgArr = [];
var _CvibInfoImgArr = [];
var _CvibInfoCWImgArr = [];
var _CvibInfoULImgArr = [];
var _CvibInfoUtunImgArr = [];
var _CvibTimeId = null;
var overLayData;
var _CustomOverlayArr = [];
let _CvibInfoDetailPop = null;


function mapZoomBound() {

    _Level = map.getLevel();
    getSignalInfo();
    if (_Level === 0 || _Level === 1) {
        // _CvibNodeArr.forEach(function (el) {
        //     el.allDrawCircle();
        //     el.allDrawCvib();
        // });
        
        signalArr.forEach(function (el) {
            if (el.mapCircle) {
                el.mapCircle.setMap(null);
            }
        });

    } else {
        _CvibNodeArr.forEach(function (el) {
            el.emptyCvibCircleImg();
            el.emptyCvibInfoImg();
        });
        if (customOverlay != null) {
            customOverlayFnc(overLayData.name, overLayData.lng, overLayData.lat);
        }
        //_CvibNodeArr = []
    }

    if (_Level === 1 || _Level === 2) {
        if (customOverlay) {
            customOverlay.setMap(null);
        }
    }

    if (_EmergencyMap && _EmergencyMap.size) {
        _EmergencyMap.forEach((obj)=>{
            obj.road.setLineWidth();
            if (obj.sig && obj.sig.size) {
                obj.sig.forEach((sig)=>{
                   sig.setLineWidth();
                })
            }
        });
    }

    // const history = $('#iframeTreeList').get(0).contentWindow._historyMap;
    const history = _historyMap;
    if (history && history.size) {
        history.forEach((obj)=>{
            if (obj.get('draw')) {
                obj.get('draw').road.setLineWidth();
                if (obj.get('draw').sig && obj.get('draw').sig.size) {
                    obj.get('draw').sig.forEach((sig)=>{
                        sig.setLineWidth();
                    })
                }
            }
        });
    }
}

function mapMoveBound() {
   // _CvibNodeArr = [];
    getSignalInfo();
    // _CvibNodeArr.forEach(function (el) {
    //     el.emptyCvibCircleImg();
    //     el.emptyCvibInfoImg();
    // });
    if(_Level === 0 || _Level === 1){
        _CvibNodeArr.forEach(function (el) {
            for (let ii = 0; ii < signalArr.length; ii++) {
                if(el.nodeId == signalArr[ii].nodeId){
                    el.emptyCvibCircleImg();
                    el.emptyCvibInfoImg();
                }
            }
        });
        _CvibNodeArr.forEach(function (el) {
            for (var ii = 0; ii < signalArr.length; ii++) {
                if(el.nodeId == signalArr[ii].nodeId){
                    
                    el.setCircle();
                    el.setCvibInfo();
                }
            }

        });
    } else {
        _CvibNodeArr.forEach(function (el) {
            for (var ii = 0; ii < signalArr.length; ii++) {
                if(el.nodeId == signalArr[ii].nodeId){
                    el.emptyCvibCircleImg();
                    el.emptyCvibInfoImg();
                }
            }
        });
        if (customOverlay != null) {

            customOverlayFnc(overLayData.name, overLayData.lng, overLayData.lat);
        }
        //_CvibNodeArr = []
    }
}

function emptySignalArr(arr) {
    if (arr != null) {
        arr.forEach(function (el) {
            el.setMap(null);
        });
        arr = 0;
    }
}


function getSignalInfo() {
    var url = 'getSignalInfo.do';
    var param =
        '&minX=' + map.getBounds().getSouthWest().getLng() +
        '&minY=' + map.getBounds().getSouthWest().getLat() +
        '&maxX=' + map.getBounds().getNorthEast().getLng() +
        '&maxY=' + map.getBounds().getNorthEast().getLat();

    if (_CustomOverlayArr.length > 0) {
        _CustomOverlayArr.forEach((obj)=>{
            obj.setMap(null);
        })
        _CustomOverlayArr = [];
    }
    requestService(url, param, getSignalInfoCallback);
}

function getSignalInfoCallback(json) {
    signalArr = [];

    var data = json;

     cvibMarkerArr.forEach(function (el) {
        if (el.getMap() != null) {
            el.setMap(null);
        }
    });

    var bottomCvibInfoList = "";

    cvibMarkerArr = [];
    //cvibMarkerArr =[];

    for (var ii = 0; ii < data.length; ii++) {
        //if(data[ii].addr1 == null||data[ii].addr1=='-')continue;
        var nodeId = data[ii].nodeid;
        var addr1 = data[ii].addr1;
        var addr2 = data[ii].addr2;
        var addr3 = data[ii].addr3;
        var lat = data[ii].lat;
        var lng = data[ii].lng;
        var name = data[ii].name;
        var tmpHtml="";

        _CvibNodeArr.forEach(function(el) {
            if(el.nodeId == nodeId){
                tmpHtml = '<tr id="'+nodeId+'">' +
                '<td style="width:10%"><span>' +addr1 + '</span></td>' +
                '<td style="width:10%"><a style="margin: auto;" href="javascript:goPanToInt(\'' + name + '\',' + lng + ',' + lat + ')"><span>' +nodeId + '</span></a></td>' +
                '<td style="width:15%"><a href="javascript:goPanToInt(\'' + name + '\',' + lng + ',' + lat + ')"><span>' +name + '</span></a></td>' +
                /*'<td style="width:10%">'+el.date+'</td>'+*/
                '<td style="width:5%" id="oprTrans"><span>'+el.oprTrans+'</span></td>' +
                '<td style="width:5%" id="oprInd"><span>'+el.oprInd+'</span></td>' +
                '<td style="width:5%" id="oprTurnoff"><span>'+el.oprTurnoff+'</span></td>' +
                '<td style="width:5%" id="oprBlink"><span>'+el.oprBlink+'</span></td>' +
                '<td style="width:5%" id="oprManual"><span>'+el.oprManual+'</span></td>' +
                '<td style="width:7%" id="errScu"><span>'+el.errScu+'</span></td>' +
                '<td style="width:7%" id="errCenter"><span>'+el.errCenter+'</span></td>' +
                '<td style="width:7%" id="errCont"><span>'+el.errCont+'</span></td>' +
                '<td style="width:7%" id="counter"><span>'+el.counter+'</span></td>'+
                '<td style="width:7%" id="date"><span>'+el.date+'</span></td>' +
                '</tr>';
            }
        });
        
        if (tmpHtml === "") {
            tmpHtml = '<tr id="'+nodeId+'">' +
            '<td style="width:10%"><span>' + addr1 + '</span></td>' +
            '<td style="width:7%"><span><a style="margin: auto;" href="javascript:goPanToInt(\'' + name + '\',' + lng + ',' + lat + ')">' + nodeId + '</a></span></td>' +
            '<td style="width:15%"><span><a href="javascript:goPanToInt(\'' + name + '\',' + lng + ',' + lat + ')">' + name + '</a></span></td>' +
            /*'<td style="width:10%">'+el.date+'</td>'+*/
            '<td style="width:5%" id="oprTrans"><span>-</span></td>' +
            '<td style="width:5%" id="oprInd"><span>-</span></td>' +
            '<td style="width:5%" id="oprTurnoff"><span>-</span></td>' +
            '<td style="width:5%" id="oprBlink"><span>-</span></td>' +
            '<td style="width:5%" id="oprManual"><span>-</span></td>' +
            '<td style="width:7%" id="errScu"><span>-</span></td>' +
            '<td style="width:7%" id="errCenter"><span>-</span></td>' +
            '<td style="width:7%" id="errCont"><span>-</span></td>' +
            '<td style="width:7%" id="counter"><span>-</span></td>'+
            '<td style="width:15%" id="date"><span>-</span></td>' +
            '</tr>';
        }

        const signal = new Signal(nodeId, name, lat, lng, addr1, addr2, addr3);
        signalArr.push(signal);

        if (_Level === 1 || _Level === 2) {
            let content = '<div class ="sigCustom"><span class="left"></span>';
            let title = '<span class="center">' + name + '</span>';

            if (customOverlay && overLayData.lat === lat && overLayData.lng === lng) {
                title = '<span class="center" style="font-weight: bold; color: #3396ff;">' + name + '</span>'
            }
            content += title + '<span class="right"></span></div>';

            // 커스텀 오버레이가 표시될 위치입니다
            let position = new kakao.maps.LatLng(lat, lng);
            // 커스텀 오버레이를 생성합니다
            let overlay = new kakao.maps.CustomOverlay({
                position: position,
                content: content,
                zIndex: 100,
                yAnchor: 1.5
            });

            overlay.setMap(map);

            // $('.sigCustom' + _Level + '').parent().css('width', '0px');
            // $('.sigCustom').parent().css('width', '0px');
            _CustomOverlayArr.push(overlay);
        }

        bottomCvibInfoList += tmpHtml;
    }

    signalArr.forEach(function (el) {
        if (el.mapCircle.getMap() == null) {
            el.mapCircle.setMap(map);
        }
        //if (_Level < 2) el.mapCircle.setMap(null);
    })

    // 하단 리스트 클리어
    // 하단 리스트 초기작업
    $('.bottomBody').html(bottomCvibInfoList);
}

/*function drawSignal(signal) {
	if(sigInfowindow != null) sigInfowindow.close();
}*/

function findSignal(Id) {
    return _mapSignal.get(Id);
};

function addSignal(Id, Obj) {
    _mapSignal.put(Id, Obj);
    return _mapSignal.size();
};


//#define RadToDeg(x) (57.29577951 * x)
//#define DegToRad(x) (0.017453293 * x)
Number.prototype.toRadians = function () {
    return this * 0.017453293;
    //return this * Math.PI / 180;
};
Number.prototype.toDegrees = function () {
    return this * 57.29577951;
    //return this * 180 / Math.PI;
};

/*
 * 좌표를 저장하는 Class
 * Lat(Y) = 37.564974, Lng(X) = 126.978517;
 * kakao.maps.LatLng(Lat, Lng)
 */
function SCoord(Lat, Lng) {
    this.Lat = parseFloat(Lat);
    this.Lng = parseFloat(Lng);
};

function SignalLinkDraw(ALink, BLink) {
    this.initialize(ALink, BLink);
}

/*
 * 신호제어기 정보
 */
function Signal(nodeId, name, lat, lng, addr1, addr2, addr3) {
    this.initialize(nodeId, name, lat, lng, addr1, addr2, addr3);
};
Signal.prototype = {
    Lat: 0,
    Lng: 0,

    drawSignal: null,	/* 현재 표출될 SignalDraw class */
    listDrawSignal: null, 	/* 표출현시 목록을 저장할 list array: 최초 한번만 좌표를 계산하도록 하기 위함, 성능에 따라 map 사용 가능 */

    mapCircle: null,
    initialize: function (nodeId, name, lat, lng, addr1, addr2, addr3) {
        this.nodeId = nodeId;
        this.name = name;
        this.addr1 = addr1;
        this.addr2 = addr2;
        this.addr3 = addr3;
        this.Lat = lat;
        this.Lng = lng;
        this.listDrawSignal = [];
        var markerSize = 0;
        if (_Level >= 5) {
            markerSize = 10;
        } else if (_Level >= 3) {
            markerSize = 20;
        } else {
            markerSize = 20;
        }
        let offset = markerSize / 2;
        var icon = new kakao.maps.MarkerImage(
            // 'images/TrafficLight25.png',
            'images/sig6.png',
            new kakao.maps.Size(markerSize * 3, markerSize),
            {

                alt: "신호현시",
                offset: new kakao.maps.Point(offset * 3, offset)
            },

        );

        this.mapCircle = new kakao.maps.Marker({
            position: new kakao.maps.LatLng(lat, lng),
            image: icon,
            zIndex: 10
        });

        if (_Level < 7) {
            this.mapCircle.setMap(map);
        }

        cvibMarkerArr.push(this.mapCircle);
        kakao.maps.event.addListener(this.mapCircle, 'mouseover', function () {
            //신호 이미지 마우스올렷을때 [이름 생성]
            if (_Level !== 1 && _Level !== 2) {
                customOverlayFnc(name, lng, lat);
            }
        });

        kakao.maps.event.addListener(this.mapCircle, 'mouseout', function () {
            // 신호 이미지 마우스아웃시 [이름 사라짐]
            if (customOverlay && _Level !== 1 && _Level !== 2) {
                customOverlay.setMap(null);
                customOverlay = null;
            }
        });
        const mapCircle = this.mapCircle;
        kakao.maps.event.addListener(this.mapCircle, 'click', function () {

            $('.modal-title').text('['+addr1+'] '+name + '(' + nodeId + ')');
            // const url = 'cvibInfoDetail.do?nodeId=' + nodeId;
            const url = 'cvibInfoDetail.do?nodeId=' + nodeId;
            const options = 'scrollbars=no,toolbar=no,location=no,resizable=no,status=no,menubar=no,width=1240px,height=595px,left=0,top=0';
            _CvibInfoDetailPop = window.open(url, 'cvibChild', options);
            // const modal = `<iframe src="${url}" id="iframeModal" class="iframeModal" title="상세 목록"></iframe>`;
            // const modalBox = $('.cvibDetailFrame');
            //
            // modalBox.html(modal);
            // $('.modal-container').addClass('open');
        });


    },

    empty: function (map) {
        if (this.drawSignal.mapCircle != null) this.drawSignal.mapCircle.setMap(null);
    }
};
