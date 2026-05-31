
class RoadView {
    constructor(map) {
        this.active = false;
        this.map = map;
        this.marker = null;
        this.roadView = new kakao.maps.Roadview(document.getElementById('roadview'));
        this.client = new kakao.maps.RoadviewClient();
        this.init();
    }

    init() {
        const image = new kakao.maps.MarkerImage(
            'http://t1.kakaocdn.net/localimg/localimages/07/mapapidoc/roadview_wk.png',
            new kakao.maps.Size(35,39), {
                offset: new kakao.maps.Point(14, 39)
            }
        );
        this.marker = new kakao.maps.Marker({
            image : image,
            draggable: true
        });
        kakao.maps.event.addListener(this.marker, 'dragend', () => {
            this.showRoadView(this.marker.getPosition())
        });
        kakao.maps.event.addListener(this.roadView, 'position_changed', ()=>{
            const position = this.roadView.getPosition();
            this.map.setCenter(position)
            this.marker.setPosition(position);
        });
    }

    clickEvent(position) {
        this.showRoadView(position);
    }

    showRoadView(position) {
        this.marker.setPosition(position);
        this.client.getNearestPanoId(position, 50, (panoId)=>{
            this.roadView.setPanoId(panoId, position);
            this.roadView.relayout();
        });
    }

    activation() {
        this.setActive(true, this.map.getCenter(), 'addOverlayMapTypeId');
    }

    setActive(isActive, position, method) {
        this.active = isActive;
        $('#map').toggleClass('on');
        $('#roadview').toggleClass('on');
        if (position) {
            this.marker.setPosition(position);
            this.showRoadView(position);
        }
        this.marker.setMap(position ? this.map : null);
        this.map[method](kakao.maps.MapTypeId.ROADVIEW);
        this.map.relayout();
    }

    show() {
        this.marker.setMap(this.map);
    }

    hide() {
        this.marker.setMap(null);
    }
    reset () {
        this.setActive(false, null, 'removeOverlayMapTypeId');
    }
}

/**
 * 면적 Object
 */
class Polygon {
    constructor(map) {
        this.active = false;
        this.draw = false;
        this.overlays = {
            drawPolygon: null,
            textOverlay: null,
            areaOverlay: null,
        };
        this.dots = [];
        this.map = map;
        this.content = '<div class="textInfo">마우스오른쪽 버튼을<br>누르시면 끝마칩니다.</div>';
    }

    setOverlay(name, overlay) {
        this.clearOverlay(name);
        if (overlay) {
            this.overlays[name] = overlay;
            overlay.setMap(this.map);
        }
    }

    clearOverlay(name) {
        if (this.overlays[name]) {
            this.overlays[name].setMap(null);
            this.overlays[name] = null;
        }
    }

    clearAllOverlays() {
        Object.keys(this.overlays).forEach(key => this.clearOverlay(key));
    }

    clickEvent(position) {
        if (!this.draw) {
            this.clearAllOverlays();
            this.draw = true;
            this.setOverlay("drawPolygon",
                new kakao.maps.Polygon({
                    map: this.map,
                    path: [position],
                    strokeWeight: 3,
                    strokeColor: '#00a0e9',
                    strokeOpacity: 1,
                    fillColor: '#00a0e9',
                    strokeStyle: 'solid',
                    fillOpacity: 0.2
                })
            );
        }
        else {
            const {drawPolygon} = this.overlays;
            const drawingPath = drawPolygon.getPath();
            drawingPath.push(position)
            drawPolygon.setPath(drawingPath);
        }
    }

    moveEvent(position) {
        if (this.draw) {
            const path = this.overlays.drawPolygon.getPath();
            if (path.length > 1) {
                path.pop();
            }
            path.push(position);
            this.overlays.drawPolygon.setPath(path);

            this.setOverlay("textOverlay",
                new kakao.maps.CustomOverlay({
                    content: this.content,
                    xAnchor: 0, yAnchor: 0,
                    position
                })
            );
        } else {
            this.clearOverlay("textOverlay");
        }
    }

    rightClickEvent() {
        this.clearOverlay("textOverlay");
        this.draw = false;
        const { drawPolygon } = this.overlays;
        const path = drawPolygon.getPath();
        if (path.length > 2) {
            const area = Math.round(drawPolygon.getArea());
            const content = '<div class="square_info">총면적 <span class="number"> ' + area.toLocaleString() + '</span> m<sup>2</sup></div>';
            this.setOverlay("areaOverlay", new kakao.maps.CustomOverlay({
                content, position: path.at(-1), xAnchor: 0, yAnchor: 0, zIndex: 3
            }));
        }
        else {
            this.clearOverlay("drawPolygon");
            this.clearOverlay("areaOverlay");
        }

    }

    reset() {
        this.clearAllOverlays();
        this.draw = false;
        this.active = false;
    }


    activation() {
        this.active = true;
    }
}

class Coordinates {
    constructor(map) {
        this.active = true;
        this.overlay = null;
        this.map = map;
        this.content = null;
        this.infowindow = null;
    }
    setOverLay(latLng, text) {
        this.overlay = new kakao.maps.Marker({
            position: latLng
        });
        this.infowindow = new kakao.maps.InfoWindow({
            position: latLng,
            content: '<div style="padding: 5px; font-size: 12px; font-weight: bold; border-radius: 5px;">'+ text +'</div>'
        });
        this.overlay.setMap(map);
        this.infowindow.open(map, this.overlay);
    }

    rightClickEvent(latLng) {
        this.clearOverlay();
        const textArea = $('<textarea>');
        let xCoordinate = latLng.getLng().toString();
        let yCoordinate = latLng.getLat().toString();

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
        this.setOverLay(latLng, text);
    }

    clickEvent() {
        this.clearOverlay();
    }

    clearOverlay() {
        if (this.overlay) {
            this.overlay.setMap(null);
            this.overlay = null;
        }
        if (this.infowindow) {
            this.infowindow.close();
            this.infowindow = null;
        }
    }

    reset() {
        this.clearOverlay();
        this.active = false;
    }

    activation() {
        this.active = true;
    }
}

/**
 * 거리 Object
 */
class DistanceLine {
    constructor(map) {
        this.active = false;
        this.draw = false;
        this.overlays = {
            clickLine: null,
            moveLine: null,
            textOverlay: null,
            distanceOverlay: null,
        };
        this.dots = [];
        this.map = map;
        this.content = '<div class="textInfo">마우스오른쪽 버튼을<br>누르시면 끝마칩니다.</div>';
    }

    setOverlay(name, overlay) {
        this.clearOverlay(name);
        if (overlay) {
            this.overlays[name] = overlay;
            overlay.setMap(this.map);
        }
    }

    clearOverlay(name) {
        if (this.overlays[name]) {
            this.overlays[name].setMap(null);
            this.overlays[name] = null;
        }
    }

    clearAllOverlays() {
        Object.keys(this.overlays).forEach(key => this.clearOverlay(key));
        this.clearDots();
    }

    clickEvent(position) {
        if (!this.draw) {
            this.clearAllOverlays();
            this.draw = true;
            this.setOverlay("clickLine",
                new kakao.maps.Polyline({
                    map: this.map,
                    path: [position],
                    strokeWeight: 3,
                    strokeColor: '#db4040',
                    strokeOpacity: 1,
                    strokeStyle: 'solid'
                })
            );
            this.setOverlay("moveLine",
                new kakao.maps.Polyline({
                    strokeWeight: 3,
                    strokeColor: '#db4040',
                    strokeOpacity: 0.5,
                    strokeStyle: 'solid'
                })
            );
            this.addDot(position, 0);
        }
        else {
            const {clickLine} = this.overlays;
            const path = clickLine.getPath();

            path.push(position);

            clickLine.setPath(path);

            const distance = Math.round(clickLine.getLength());
            this.addDot(position, distance);
        }
    }

    moveEvent(position) {
        if (this.draw) {
            const path = this.overlays.clickLine.getPath();
            this.overlays.moveLine.setPath([path[path.length - 1], position]);

            this.setOverlay("textOverlay",
                new kakao.maps.CustomOverlay({
                    content: this.content,
                    xAnchor: 0, yAnchor: 0,
                    position
                })
            );
        } else {
            this.clearOverlay("moveLine");
            this.clearOverlay("textOverlay");
        }
    }

    rightClickEvent() {
        this.clearOverlay("moveLine");
        this.clearOverlay("textOverlay");
        this.draw = false;
        const path = this.overlays.clickLine.getPath();
        if (path.length > 1) {
            this.clearOverlay(this.dots.at(-1)?.distance);
            const distance = Math.round(this.overlays.clickLine.getLength());
            const content = this.getTimeHTML(distance);
            this.setOverlay("distanceOverlay", new kakao.maps.CustomOverlay({
                content, position: path.at(-1), xAnchor: 0, yAnchor: 0, zIndex: 3
            }));
        }
        else {
            this.clearOverlay("clickLine");
            this.clearOverlay("distanceOverlay");
            this.clearDots();
        }

    }

    addDot(position, distance) {
        const circle = new kakao.maps.CustomOverlay({
            content: '<span class="dot"></span>', position, zIndex: 1
        });
        circle.setMap(this.map);

        const dotObj = { circle, distance: null };

        if (distance > 0) {
            dotObj.distance = new kakao.maps.CustomOverlay({
                content: `<div class="dotOverlay">거리 <span class="number">${distance.toLocaleString()}</span>m</div>`,
                position, yAnchor: 1, zIndex: 2
            });
            dotObj.distance.setMap(this.map);
        }

        this.dots.push(dotObj);
    }

    clearDots() {
        this.dots.forEach(dot => {
            dot.circle?.setMap(null);
            dot.distance?.setMap(null);
        });
        this.dots = [];
    }

    deleteMarker(marker) {
        if (this[marker]) {
            this[marker].setMap(null);
            this[marker] = null;
        }
    }

    displayCircleDot(position, distance) {
        const distanceObj = {
            circle : null,
            distance : null,
        };

        distanceObj.circle =
            new kakao.maps.CustomOverlay({
                content: '<span class="dot"></span>',
                position: position,
                zIndex: 1
            });

        distanceObj.circle.setMap(this.map);
        if (distance > 0) {
            distanceObj.distance =
                new kakao.maps.CustomOverlay({
                    content: '<div class="dotOverlay">거리 <span class="number">' + distance.toLocaleString() + '</span>m</div>',
                    position: position,
                    yAnchor: 1,
                    zIndex: 2
                });

            distanceObj.distance.setMap(this.map);
        }
        this.dots.push(distanceObj);
    }
    getTimeHTML(distance) {
        const WALK_SPEED = 67;  // m/min
        const BIKE_SPEED = 227; // m/min

        const formatTime = (minutes) => {
            const h = Math.floor(minutes / 60);
            const m = minutes % 60;
            return `${h > 0 ? `<span class="number">${h}</span>시간 ` : ""}<span class="number">${m}</span>분`;
        };

        const walkTime = formatTime(distance / WALK_SPEED | 0);
        const bikeTime = formatTime(distance / BIKE_SPEED | 0);

        return `
                <ul class="dotOverlay distanceInfo">
                    <li><span class="label">총거리</span><span class="number">${distance.toLocaleString()}</span>m</li>
                    <li><span class="label">도보</span>${walkTime}</li>
                    <li><span class="label">자전거</span>${bikeTime}</li>
                </ul>`;
    }
    reset() {
        this.clearAllOverlays();
        this.draw = false;
        this.active = false;

    }

    activation() {
        this.active = true;
    }

}


class SearchPlace {
    constructor(map) {
        this.search = new kakao.maps.services.Places();
        this.list =  $('#placesList');
        this.keyword = $('#keyword');
        this.menuWrap = $('#menu_wrap');
        this.markers = [];
        this.map = map;
        this.infoWindow = new kakao.maps.InfoWindow({zIndex:1});
    }

    callBack(data, status, pagination) {
        if (status === kakao.maps.services.Status.OK) {
            this.displayPlaces(data);

            // 페이지 번호를 표출합니다
            this.displayPagination(pagination);

        } else if (status === kakao.maps.services.Status.ZERO_RESULT) {

            alert('검색 결과가 존재하지 않습니다.');
            return;

        } else if (status === kakao.maps.services.Status.ERROR) {

            alert('검색 결과 중 오류가 발생했습니다.');
            return;
        }
    }

    searchPlaces() {

        const keyword = this.keyword.val();

        if (!keyword.replace(/^\s+|\s+$/g, '')) {
            alert('키워드를 입력해주세요!');
            return false;
        }

        // 장소검색 객체를 통해 키워드로 장소검색을 요청합니다
        this.search.keywordSearch(keyword, (data, status, pagination) => this.callBack(data, status, pagination));
    }


    displayPlaces(places) {

        let fragment = document.createDocumentFragment();
        let bounds = new kakao.maps.LatLngBounds();
        let listStr = '';
        this.list.empty();

        // 지도에 표시되고 있는 마커를 제거합니다
        this.removeMarker();

        for ( var i=0; i<places.length; i++ ) {

            // 마커를 생성하고 지도에 표시합니다
            var placePosition = new kakao.maps.LatLng(places[i].y, places[i].x),
                marker = this.addMarker(placePosition, i),
                itemEl = this.getListItem(i, places[i]); // 검색 결과 항목 Element를 생성합니다

            // 검색된 장소 위치를 기준으로 지도 범위를 재설정하기위해
            // LatLngBounds 객체에 좌표를 추가합니다
            bounds.extend(placePosition);

            fragment.appendChild(itemEl);
        }

        // 검색결과 항목들을 검색결과 목록 Element에 추가합니다
        this.list.html(fragment);
        this.menuWrap[0].scrollTop = 0;

        // 검색된 장소 위치를 기준으로 지도 범위를 재설정합니다
        this.map.setBounds(bounds);
    }

    removeMarker() {
        this.markers.forEach((marker)=>{
            marker.setMap(null);
        });
        this.markers = [];
    }

    getListItem(index, places) {

        var el = document.createElement('li'),
            itemStr = '<span class="markerbg marker_' + (index+1) + '"></span>' +
                '<div class="info">' +
                '   <div style="font-weight: bold; font-size: 12px">' + places.place_name + '</div>';

        if (places.road_address_name) {
            itemStr += '    <span>' + places.road_address_name + '</span>' +
                '   <span class="jibun gray">' +  places.address_name  + '</span>';
        } else {
            itemStr += '    <span>' +  places.address_name  + '</span>';
        }
        itemStr += '  <span class="tel">' + places.phone  + '</span>' +
            '</div>';

        el.innerHTML = itemStr;
        el.className = 'item';
        $(el).on('click', ()=>{
            this.map.setLevel(2);
            this.map.setCenter(new kakao.maps.LatLng( places.y, places.x ));
        });
        return el;
    }

    addMarker(position, idx, title) {
        const imageSrc = 'https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/marker_number_blue.png', // 마커 이미지 url, 스프라이트 이미지를 씁니다
            imageSize = new kakao.maps.Size(36, 37),  // 마커 이미지의 크기
            imgOptions =  {
                spriteSize : new kakao.maps.Size(36, 691), // 스프라이트 이미지의 크기
                spriteOrigin : new kakao.maps.Point(0, (idx*46)+10), // 스프라이트 이미지 중 사용할 영역의 좌상단 좌표
                offset: new kakao.maps.Point(13, 37) // 마커 좌표에 일치시킬 이미지 내에서의 좌표
            },
            markerImage = new kakao.maps.MarkerImage(imageSrc, imageSize, imgOptions),
            marker = new kakao.maps.Marker({
                position: position, // 마커의 위치
                image: markerImage
            });

        marker.setMap(map); // 지도 위에 마커를 표출합니다
        this.markers.push(marker);  // 배열에 생성된 마커를 추가합니다

        return marker;
    }

    // 검색결과 목록 하단에 페이지번호를 표시는 함수입니다
    displayPagination(pagination) {
        var paginationEl = document.getElementById('pagination'),
            fragment = document.createDocumentFragment(),
            i;

        // 기존에 추가된 페이지번호를 삭제합니다
        while (paginationEl.hasChildNodes()) {
            paginationEl.removeChild (paginationEl.lastChild);
        }

        for (i=1; i<=pagination.last; i++) {
            var el = document.createElement('a');
            el.href = "#";
            el.innerHTML = i;

            if (i===pagination.current) {
                el.className = 'on';
            } else {
                el.onclick = (function(i) {
                    return function() {
                        pagination.gotoPage(i);
                    }
                })(i);
            }

            fragment.appendChild(el);
        }
        paginationEl.appendChild(fragment);
    }

    displayInfowindow(marker, title) {
        var content = '<div style="padding:5px;z-index:1;">' + title + '</div>';

        this.infoWindow.setContent(content);
        this.infoWindow.open(this.map, marker);
    }
}