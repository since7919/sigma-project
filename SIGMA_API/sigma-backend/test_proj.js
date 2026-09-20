const proj4 = require('proj4');

// EPSG:5181 definition
proj4.defs("EPSG:5181","+proj=tmerc +lat_0=38 +lon_0=127 +k=1 +x_0=200000 +y_0=500000 +ellps=GRS80 +units=m +no_defs");

const result = proj4("EPSG:5181", "WGS84", [339645, 262310]);
console.log('Converted WGS84:', result);
