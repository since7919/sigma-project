const fs = require('fs');
let script = fs.readFileSync('scrape_all_zones_wkt.js', 'utf8');

const oldRequire = `const wellknown = require('wellknown');
require('dotenv').config();`;

const newRequire = `const wellknown = require('wellknown');
const proj4 = require('proj4');
require('dotenv').config();

proj4.defs("EPSG:5181","+proj=tmerc +lat_0=38 +lon_0=127 +k=1 +x_0=200000 +y_0=500000 +ellps=GRS80 +units=m +no_defs");

function transformCoords(coords) {
    if (typeof coords[0] === 'number') {
        if (Math.abs(coords[0]) > 180) {
            return proj4("EPSG:5181", "WGS84", coords);
        }
        return coords;
    } else {
        return coords.map(c => transformCoords(c));
    }
}

function transformGeoJSON(geojson) {
    if (!geojson) return geojson;
    if (geojson.type === 'GeometryCollection') {
        geojson.geometries = geojson.geometries.map(transformGeoJSON);
        return geojson;
    }
    if (geojson.coordinates) {
        geojson.coordinates = transformCoords(geojson.coordinates);
    }
    return geojson;
}
`;

script = script.replace(oldRequire, newRequire);

const oldGeoJSON = `                                geojson = wellknown.parse(wkt);`;
const newGeoJSON = `                                geojson = transformGeoJSON(wellknown.parse(wkt));`;

script = script.replace(oldGeoJSON, newGeoJSON);

fs.writeFileSync('scrape_all_zones_wkt.js', script, 'utf8');
console.log('patched scrape_all_zones_wkt.js with proj4');
