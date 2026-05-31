const fs = require('fs');
const csv = require('csv-parser');
const supabase = require('./db');

const CSV_FILE_PATH = '../2_SIGMA/db_intersections.csv';

async function migrateIntersections() {
  const intersections = [];
  
  fs.createReadStream(CSV_FILE_PATH)
    .pipe(csv())
    .on('data', (row) => {
      // row: ID, Name, Lat, Lng, Seq, ...
      const region_cd = 'L01';
      const int_no = parseInt(row.Seq) || (Math.floor(Math.random() * 10000) + 10000);
      const int_nm = row.Name || '알 수 없음';
      const lat = parseFloat(row.Lat) || 0;
      const lng = parseFloat(row.Lng) || 0;
      const origin_type = 'MANUAL';
      const sigma_legacy_id = row.ID;

      intersections.push({
        region_cd,
        int_no,
        int_nm,
        x_coord: lng,
        y_coord: lat,
        origin_type,
        sigma_legacy_id
      });
    })
    .on('end', async () => {
      console.log(`총 ${intersections.length}개의 데이터를 마이그레이션합니다...`);
      
      // 배치 처리 (한 번에 100개씩)
      const batchSize = 100;
      for (let i = 0; i < intersections.length; i += batchSize) {
        const batch = intersections.slice(i, i + batchSize);
        
        const { data, error } = await supabase
          .from('utic_intersections')
          .upsert(batch, { onConflict: 'region_cd, int_no, origin_type' });
          
        if (error) {
          console.error(`배치 ${i} - ${i + batchSize} 에러:`, error.message);
        } else {
          console.log(`배치 ${i} - ${i + batchSize} 성공적 적재.`);
        }
      }
      
      console.log('마이그레이션 완료!');
    });
}

migrateIntersections();
