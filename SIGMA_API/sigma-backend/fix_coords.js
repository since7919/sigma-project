const { createClient } = require('@supabase/supabase-js');
const proj4 = require('proj4');
const dotenv = require('dotenv');
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

proj4.defs("EPSG:5181","+proj=tmerc +lat_0=38 +lon_0=127 +k=1 +x_0=200000 +y_0=500000 +ellps=GRS80 +units=m +no_defs");

function transformCoords(coords) {
    if (typeof coords[0] === 'number') {
        // Point
        if (Math.abs(coords[0]) > 180) {
            return proj4("EPSG:5181", "WGS84", coords);
        }
        return coords;
    } else {
        // LineString, Polygon, MultiPolygon
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

async function fixDB() {
    console.log("Fetching rows to fix...");
    // We fetch in chunks of 5000
    let from = 0;
    const step = 5000;
    let totalFixed = 0;
    
    while(true) {
        const { data, error } = await supabase.from('safety_zones').select('ptznmngno, geojson').range(from, from + step - 1);
        if (error) { console.error(error); break; }
        if (!data || data.length === 0) break;
        
        let updates = [];
        for (let row of data) {
            if (row.geojson) {
                // Peek at the first coordinate
                let peek = row.geojson;
                while (peek.coordinates || peek.geometries) {
                    if (peek.geometries) peek = peek.geometries[0];
                    else if (Array.isArray(peek.coordinates[0])) peek = { coordinates: peek.coordinates[0] };
                    else peek = peek.coordinates;
                }
                
                // If it's EPSG:5181
                if (Array.isArray(peek) && Math.abs(peek[0]) > 180) {
                    const newGeo = transformGeoJSON(row.geojson);
                    updates.push({ ptznmngno: row.ptznmngno, geojson: newGeo });
                }
            }
        }
        
        if (updates.length > 0) {
            const { error: updErr } = await supabase.from('safety_zones').upsert(updates, { onConflict: 'ptznmngno' });
            if (updErr) console.error(updErr);
            else totalFixed += updates.length;
        }
        
        from += step;
        console.log(`Processed up to ${from}, fixed ${updates.length} rows in this batch.`);
    }
    
    console.log(`Done! Total fixed: ${totalFixed}`);
}

fixDB();
