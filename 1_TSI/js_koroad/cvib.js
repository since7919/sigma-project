function CvibInfo(nodeId, name, latitude, longitude, addr1, addr2, addr3, date, errCenter, errCont, errScu, oprBlink, oprInd, oprManual, oprTrans, oprTurnoff, dataCount, counter, cvibStts10, cvibStts20, cvibStts30, cvibStts40, cvibStts50, cvibStts60, cvibStts70, cvibStts80, light, dirAdd, timeFlag, walker, unprotected, stts, dispTm, remainTm, dirCode) {
    this.initialize(nodeId, name, latitude, longitude, addr1, addr2, addr3, date, errCenter, errCont, errScu, oprBlink, oprInd, oprManual, oprTrans, oprTurnoff, dataCount, counter, cvibStts10, cvibStts20, cvibStts30, cvibStts40, cvibStts50, cvibStts60, cvibStts70, cvibStts80, light, dirAdd, timeFlag, walker, unprotected, stts, dispTm, remainTm, dirCode);
}

CvibInfo.prototype = {
    cvimCircleImg: [], // 지도 원 객체
    cvimInfoULImg: [], // 비보호 좌회전 변수
    cvimInfoImg: [],   // 신호등 변수
    cvimInfoCWImg: [], // 보행자 변수
    cvimInfoUtunImg: [], // 유턴 변수
    initialize: function (nodeId, name, latitude, longitude, addr1, addr2, addr3, date, errCenter, errCont, errScu, oprBlink, oprInd, oprManual, oprTrans, oprTurnoff, dataCount, counter, cvibStts10, cvibStts20, cvibStts30, cvibStts40, cvibStts50, cvibStts60, cvibStts70, cvibStts80, light, dirAdd, timeFlag, walker, unprotected, stts, dispTm, remainTm, dirCode) {

        this.nodeId = nodeId;
        this.name = name;
        this.lat = latitude;
        this.lng = longitude;
        this.addr1 = addr1;
        this.addr2 = addr2;
        this.addr3 = addr3;
        this.oprTrans = oprTrans;
        this.oprInd = oprInd;
        this.oprTurnoff = oprTurnoff;
        this.oprBlink = oprBlink;
        this.oprManual = oprManual;
        this.errScu = errScu;
        this.errCenter = errCenter;
        this.errCont = errCont;
        this.counter = counter;
        this.dataCount = dataCount;
        this.date = date;
        this.light = light;
        this.dirAdd = dirAdd;
        this.timeFlag = timeFlag;
        this.walker = walker;
        this.unprotected = unprotected;
        this.stts = stts;
        this.dispTm = dispTm;
        this.remainTm = remainTm;
        this.dirCode = dirCode;
        this.lightPosArr = [180, 270, 0, 90, 225, 315, 45, 135];
        //this.lightPosArr = [270, 180, 90, 0,315, 225, 135, 45];

        this.lightStsArr = [cvibStts10, cvibStts20, cvibStts30, cvibStts40, cvibStts50, cvibStts60, cvibStts70, cvibStts80];
        this.centerPos = {'Lat': parseFloat(latitude), 'Lng': parseFloat(longitude)};
        // this.setCircle();
        // this.setCvibInfo();
    },
    imgArrNull: function(){
        this.emptyCvibCircleImg();
        this.emptyCvibInfoImg();
        this.cvimCircleImg=[];
        this.cvimInfoULImg=[];
        this.cvimInfoImg=[];
        this.cvimInfoCWImg=[];
        this.cvimInfoUtunImg=[];
    },

    setCircle: function () {
       //this.emptyCvibCircleImg();
        var cvibCircle = new kakao.maps.Circle({
            center: new kakao.maps.LatLng(this.centerPos.Lat, this.centerPos.Lng),
            radius: 30,
            strokeWeight: 0.3,
            strokeColor: 'black',
            strokeStyle: 'solid',
            zIndex: 10,
            map : map
        });
        this.cvimCircleImg.push(cvibCircle);
        //_CvibCircleImgArr.push(cvibCircle);

    },
    allDrawCircle: function(){
        this.emptyCvibCircleImg();
        this.cvimCircleImg.forEach(function(el){
            el.setMap(map);
        })
    },

    allDrawCvib: function(){
        this.emptyCvibInfoImg();
        this.cvimInfoCWImg.forEach(function (el) {
            el.setMap(map);
        });
        this.cvimInfoImg.forEach(function (el) {
            el.setMap(map);

        });
        this.cvimInfoULImg.forEach((function (el) {
            el.setMap(map);

        }));
        this.cvimInfoUtunImg.forEach(function (el) {
            el.setMap(map);

        });
    },

    setCvibInfo: function () {
        //this.emptyCvibInfoImg();
        var leftUnprotectArr = []
        var sigPos;
        var position
        var distanceX = 0.03;
        /**
         Map 매칭 방안에 따른 방향 코드-신호등정보(미지정(0), 북(1), 동(2), 남(3), 서(4), 북동(5), 남동(6), 남서(7), 북서(8))'
         출력형태 : 미지정(0), 직진(1), 좌회전(2), 보행(3), 자전거(4), 우회전(5), 버스(6), 유턴(7)'
         신호등상태: 소등(0), 적색점등(1), 황색점등(2), 녹색점등(3), 적색점멸(4), 황색점멸(5), 녹색점멸(6)'
         **/
        //비보호 좌회전 유턴
        for (let ll = 0; ll < this.dataCount; ll++) {
            let dircodeIndex = (this.dirCode[ll] / 10) - 1;
            if (this.unprotected[ll] === 1 && this.light[ll] === 2 && ([3, 7].includes(this.stts[ll]))) {
                leftUnprotectArr[dircodeIndex] = true;
                var cwId = 'UL_' + this.nodeId;
                var ulContent = '<div style="transform: rotate(' + (this.lightPosArr[dircodeIndex]) + 'deg);width:27px;height:30px;background-size:27px;background-image:url(\'/images/cvib/unprotected.png\')"' +
                    ' onclick="cvibInfoDetail(\'' + this.nodeId + '\')" id="' + cwId + '"></div>';
                //var ulContent ="";
                sigPos = this.moveCenterOutPos(this.centerPos, this.lightPosArr[dircodeIndex], distanceX, true);

                position = new kakao.maps.LatLng(sigPos.lat, sigPos.lng);

                var cvibULOverlay = new kakao.maps.CustomOverlay({
                    content: ulContent,
                    position: position,
                    map : map
                });
                
                this.cvimInfoULImg.push(cvibULOverlay);
            }
            else {
                if (!leftUnprotectArr[dircodeIndex]) leftUnprotectArr[dircodeIndex] = false;
            }

            if (this.unprotected[ll] === 1 && this.light[ll] === 7 && this.stts[ll] === 3) {
                var utunId = 'UL_' + this.nodeId;
                var utunContent = '<div style="transform: rotate(' + (this.lightPosArr[dircodeIndex]) + 'deg);width:27px;height:27px;background-size:27px;background-image:url(\'/images/cvib/unproUTUN120.png\')"' +
                    ' onclick="cvibInfoDetail(\'' + this.nodeId + '\')" id="' + utunId + '"></div>';

                sigPos = this.moveCenterOutPos(this.centerPos, this.lightPosArr[dircodeIndex], distanceX, false);

                position = new kakao.maps.LatLng(sigPos.lat, sigPos.lng);
                var cvibUtunOverlay = new kakao.maps.CustomOverlay({
                    content: utunContent,
                    position: position,
                    map : map
                });
                this.cvimInfoUtunImg.push(cvibUtunOverlay);
            }
        }

        for (let ii = 0; ii < this.lightPosArr.length; ii++) {
            const lightImg = this.lightStsArr[ii].substring(0, 3);
            if (typeof this.lightStsArr[ii] !== 'undefined' && lightImg !== '9_9') {

                if ((this.lightPosArr[ii] > 0 && this.lightPosArr[ii] < 180) ||
                    (this.lightPosArr[ii] > 180 && this.lightPosArr[ii] < 360)) {
                    distanceX = 0.0375;
                }

                //신호등
                sigPos = this.moveCenterPos(this.centerPos, this.lightPosArr[ii], distanceX);

                position = new kakao.maps.LatLng(sigPos.lat, sigPos.lng);
                var overlayId = 'cvib_' + this.nodeId + '_' + this.lightPosArr[ii];


                var content;
                if (leftUnprotectArr[ii] && lightImg === '3_3') {
                    content = '<div style="width:80px;height:27px;background-size: 80px 27px; background-image:url(\'/images/cvib/CvibLight_3_9.png\')"' +
                    // content = '<div style="width:80px;height:27px;background-size: 80px 27px; background-image:url(\'/images/cvib/CvibLight_3_9.gif\')"' +
                        ' onclick="cvibInfoDetail(\'' + this.nodeId + '\')" id="' + overlayId + '"></div>';
                }
                else {
                    content = '<div style="width:80px;height:27px;background-size: 80px 27px; background-image:url(\'/images/cvib/CvibLight_' + lightImg + '.png\')"' +
                    // content = '<div style="width:80px;height:27px;background-size: 80px 27px; background-image:url(\'/images/cvib/CvibLight_' + lightImg + '.gif\')"' +
                        ' onclick="cvibInfoDetail(\'' + this.nodeId + '\')" id="' + overlayId + '"></div>';
                }

                var cvibOverlay = new kakao.maps.CustomOverlay({
                    content: content,
                    position: position,
                    map : map
                });
                $('#' + overlayId).parent().css({'transform': 'rotate(' + this.lightPosArr[ii] + 'deg)'});
                this.cvimInfoImg.push(cvibOverlay);
            }
            //보행자 신호등

            var cwlightImg = 'OFF';
            var tempcwlight = this.lightStsArr[ii].substring(4, 5);
            sigPos1 = this.moveCenterInPos(this.centerPos, this.lightPosArr[ii], distanceX);

            if (tempcwlight !== '9') {
                if (tempcwlight === '3' || tempcwlight === '6') {
                    cwlightImg = 'ON';
                } else if (tempcwlight === '1') {
                    cwlightImg = 'OFF';
                } else {
                    cwlightImg = 'BLECK';
                }

                position = new kakao.maps.LatLng(sigPos1.lat, sigPos1.lng);

                var cwId = 'CW_' + this.nodeId;
                // var wcContent = '<div style="transform: rotate(' + this.lightPosArr[ii] + 'deg);width:25px;height:25px;background-size:25px; background-image:url(\'/images/cvib/CW' + cwlightImg + '_55.png\')"' +
                //     ' onclick="cvibInfoDetail(\'' + this.nodeId + '\')" id="' + cwId + '"></div>';
                var wcContent = '<div style="transform: rotate(' + (this.lightPosArr[ii] - 90) + 'deg);width:25px;height:47px;background-size:25px 47px;background-image:url(\'/images/cvib/CW' + cwlightImg + '_55.png\')"' +
                    ' onclick="cvibInfoDetail(\'' + this.nodeId + '\')" id="' + cwId + '"></div>';

                var cvibCWOverlay = new kakao.maps.CustomOverlay({
                    content: wcContent,
                    position: position,
                    map : map,
                });
                this.cvimInfoCWImg.push(cvibCWOverlay);
            }
        }
    },

    moveCenterPos: function (pos, deg, distanceX) {
        var distanceY = 0.03;

        var rad = deg.toRadians();
        var deltaLat = distanceY * Math.cos(rad);
        var deltaLng = distanceX * Math.sin(rad);

        deltaLat = (deltaLat * 360) / 39000;
        deltaLng = (deltaLng * 360) / 39000;
        var lat = pos.Lat + deltaLat;
        var lng = pos.Lng + deltaLng;

        return {'lat': lat, 'lng': lng};
    },

    moveCenterOutPos: function (pos, deg, distanceX, is) {
        var distanceY = 0.03;
        var rad;
        (is === true) ? rad = deg.toRadians() - 0.1 : rad = deg.toRadians() + 0.1;


        var deltaLat = distanceY * Math.cos(rad);
        var deltaLng = distanceX * Math.sin(rad);

        deltaLat = (deltaLat * 360) / 31500;
        deltaLng = (deltaLng * 360) / 31500;
        var lat = pos.Lat + deltaLat;
        var lng = pos.Lng + deltaLng;

        return {'lat': lat, 'lng': lng};
    },

    moveCenterInPos: function (pos, deg, distanceX) {
        var distanceY = 0.03;

        var rad = deg.toRadians();
        var deltaLat = distanceY * Math.cos(rad);
        var deltaLng = distanceX * Math.sin(rad);

        deltaLat = (deltaLat * 360) / 51000;
        deltaLng = (deltaLng * 360) / 51000;
        var lat = pos.Lat + deltaLat;
        var lng = pos.Lng + deltaLng;

        return {'lat': lat, 'lng': lng};
    },

    emptyCvibCircleImg: function () {
        this.cvimCircleImg.forEach(function(el){
            el.setMap(null);
        })
        // _CvibCircleImgArr.forEach(function (el) {
        //     el.setMap(null);
        // });
        //this.cvimCircleImg=[];
    },

    emptyCvibInfoImg: function () {
        this.cvimInfoCWImg.forEach(function (el) {
            el.setMap(null);
        });
        this.cvimInfoImg.forEach(function (el) {
            el.setMap(null);

        });
        this.cvimInfoULImg.forEach((function (el) {
            el.setMap(null);

        }));
        this.cvimInfoUtunImg.forEach(function (el) {
            el.setMap(null);

        });
    }
}

function cvibInfoDetail(nodeId) {
    var url = 'cvibInfoDetail.do?nodeId=' + nodeId;
    var options = 'scrollbars=no,toolbar=no,location=no,resizable=no,status=no,menubar=no,width=1300px,height=590px,left=0,top=0';
    _CvibInfoDetailPop = window.open(url, 'cvibChild', options);
}
