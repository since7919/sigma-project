/*
    신호 기반 데이터 [메모리 저장]

 */

function SignalInfo(nodeId, name, lat, lng, addr1, addr2, addr3, regionId) {
    this.initialize(nodeId, name, lat, lng, addr1, addr2, addr3, regionId);
};

SignalInfo.prototype = {
    initialize: function (nodeId, name, lat, lng, addr1, addr2, addr3, regionId) {
        this.nodeId = nodeId;
        this.name = name;
        this.addr1 = addr1;
        this.addr2 = addr2;
        this.addr3 = addr3;
        this.Lat = lat;
        this.Lng = lng;
        this.status = 0;    // 0 데이터없음 1 정상 2 이상
        this.date = null;   //교차로시각
        this.regionId = regionId;
    },
};