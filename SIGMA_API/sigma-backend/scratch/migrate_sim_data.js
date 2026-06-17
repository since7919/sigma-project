const fs = require('fs');
const path = require('path');
const supabase = require('../db');

const SIM_DIR = path.join(__dirname, '../../../SIGMA_SIM');

const FILES_TO_MIGRATE = [
  { name: 'db_intersections.csv', label: '교차로 정보' },
  { name: 'db_signal_maps.csv', label: '현시계획 정보' },
  { name: 'db_tod_plans.csv', label: 'TOD 운영계획' },
  { name: 'db_groups.csv', label: '그룹정보' },
  { name: 'db_stats.csv', label: '접근로 통계' },
  { name: 'db_yearbook.csv', label: '신호운영 연보' },
  { name: 'db_poly.geojson', label: '행정경계 지오메트리' },
  { name: 'db_coordlink.geojson', label: '연동구간 지오메트리' }
];

async function runMigration() {
  console.log("🚀 Starting SIGMA Simulator Data Migration to Supabase...");
  
  for (const fileInfo of FILES_TO_MIGRATE) {
    const filePath = path.join(SIM_DIR, fileInfo.name);
    console.log(`\n--------------------------------------------`);
    console.log(`[Migration] Reading: ${fileInfo.name} (${fileInfo.label})`);
    
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️ File not found: ${filePath}. Skipping.`);
      continue;
    }
    
    try {
      // 용량이 크므로 동기식으로 안전하게 버퍼 로드 후 디코딩
      const fileBuffer = fs.readFileSync(filePath);
      let fileContent = '';
      
      // UTF-8 또는 EUC-KR 디코딩 처리
      try {
        const utf8Decoder = new TextDecoder('utf-8', { fatal: true });
        fileContent = utf8Decoder.decode(fileBuffer).replace(/^\ufeff/, '');
      } catch (e) {
        // UTF-8 파싱 에러 시 EUC-KR 디코딩 적용하기 위해 iconv-lite 모듈 활용
        const iconv = require('iconv-lite');
        fileContent = iconv.decode(fileBuffer, 'euc-kr').replace(/^\ufeff/, '');
      }
      
      console.log(`[Migration] File size: ${(fileContent.length / 1024 / 1024).toFixed(2)} MB`);
      console.log(`[Migration] Uploading to Supabase...`);
      
      const { data, error } = await supabase
        .from('sim_csv_storage')
        .upsert({
          file_name: fileInfo.name,
          file_content: fileContent,
          updated_at: new Date().toISOString()
        }, { onConflict: 'file_name' });
        
      if (error) {
        console.error(`❌ Upload failed for ${fileInfo.name}:`, error.message);
      } else {
        console.log(`✅ Upload success! ${fileInfo.name} has been synced to Supabase.`);
      }
    } catch (err) {
      console.error(`❌ Migration error for ${fileInfo.name}:`, err.message);
    }
  }
  
  console.log(`\n============================================`);
  console.log(`🏁 Migration Process Finished!`);
}

runMigration();
