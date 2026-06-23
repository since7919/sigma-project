require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('⚠️ Supabase 설정이 비어있습니다. .env 파일을 확인해주세요.');
}

const dbSecret = process.env.DB_SECRET || 'sigma_secure_rdb_write_token_2026_9rKirej7S';
const supabase = createClient(supabaseUrl || 'http://dummy.url', supabaseKey || 'dummy_key', {
  global: {
    headers: {
      'x-db-secret': dbSecret
    }
  }
});

module.exports = supabase;

