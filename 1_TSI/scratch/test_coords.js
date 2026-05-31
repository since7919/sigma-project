const proj4 = require('proj4');

// EPSG:5181 (Korea 2000 Central Belt, old y_0 = 500000)
const epsg5181 = '+proj=tmerc +lat_0=38 +lon_0=127 +k=1 +x_0=200000 +y_0=500000 +ellps=GRS80 +units=m +no_defs';

// EPSG:5186 (Korea 2000 Central Belt 2010, new y_0 = 600000)
const epsg5186 = '+proj=tmerc +lat_0=38 +lon_0=127 +k=1 +x_0=200000 +y_0=600000 +ellps=GRS80 +units=m +no_defs';

const wgs84 = '+proj=longlat +ellps=WGS84 +datum=WGS84 +no_defs';

const x = 195190.43080597;
const y = 543061.276626151;

console.log('Testing EPSG:5181 (y_0 = 500000):');
const res5181 = proj4(epsg5181, wgs84, [x, y]);
console.log('Result [lon, lat]:', res5181);

console.log('\nTesting EPSG:5186 (y_0 = 600000):');
const res5186 = proj4(epsg5186, wgs84, [x, y]);
console.log('Result [lon, lat]:', res5186);
