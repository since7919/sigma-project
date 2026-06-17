const supabase = require('../db');

async function test() {
  console.log("Supabase URL:", process.env.SUPABASE_URL);
  
  // 1. sim_csv_storage 테이블이 존재하는지 확인
  const { data, error } = await supabase.from('sim_csv_storage').select('*').limit(1);
  if (error) {
    console.log("sim_csv_storage 테이블 없음 또는 에러:", error.message);
    
    // 2. rpc로 sql 실행 시도
    console.log("SQL 실행 시도...");
    const createTableSql = `
      CREATE TABLE IF NOT EXISTS sim_csv_storage (
        file_name TEXT PRIMARY KEY,
        file_content TEXT,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
      );
    `;
    
    const { data: rpcData, error: rpcError } = await supabase.rpc('exec_sql', { sql: createTableSql });
    if (rpcError) {
      console.log("exec_sql RPC 실패:", rpcError.message);
    } else {
      console.log("exec_sql RPC 성공! 테이블이 생성되었습니다.");
    }
  } else {
    console.log("sim_csv_storage 테이블이 이미 존재함:", data);
  }
}

test();
