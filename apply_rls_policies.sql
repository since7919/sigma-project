-- 1. 핵심 4대 테이블 Row Level Security (RLS) 활성화
ALTER TABLE junctions ENABLE ROW LEVEL SECURITY;
ALTER TABLE signal_maps ENABLE ROW LEVEL SECURITY;
ALTER TABLE tod_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;

-- 2. 기존 RLS 정책 정리 (중복 생성 방지)
DROP POLICY IF EXISTS "Allow public read access" ON junctions;
DROP POLICY IF EXISTS "Allow secure write access with secret key" ON junctions;

DROP POLICY IF EXISTS "Allow public read access" ON signal_maps;
DROP POLICY IF EXISTS "Allow secure write access with secret key" ON signal_maps;

DROP POLICY IF EXISTS "Allow public read access" ON tod_plans;
DROP POLICY IF EXISTS "Allow secure write access with secret key" ON tod_plans;

DROP POLICY IF EXISTS "Allow public read access" ON groups;
DROP POLICY IF EXISTS "Allow secure write access with secret key" ON groups;

-- 3. 일반 사용자(anon) 및 모든 역할의 단순 조회(SELECT) 상시 허용 정책 정의
CREATE POLICY "Allow public read access" ON junctions
    FOR SELECT
    TO anon
    USING (true);

CREATE POLICY "Allow public read access" ON signal_maps
    FOR SELECT
    TO anon
    USING (true);

CREATE POLICY "Allow public read access" ON tod_plans
    FOR SELECT
    TO anon
    USING (true);

CREATE POLICY "Allow public read access" ON groups
    FOR SELECT
    TO anon
    USING (true);

-- 4. 백엔드 인증 토큰(x-db-secret) 소유자만 생성/수정/삭제(ALL) 허용 정책 정의
-- 헤더에서 'x-db-secret' 값을 추출하여 설정된 비밀 키값과 일치하는 안전한 쓰기 요청만 통과시킵니다.
CREATE POLICY "Allow secure write access with secret key" ON junctions
    FOR ALL
    TO anon
    USING (coalesce(current_setting('request.headers', true)::json->>'x-db-secret', '') = 'sigma_secure_rdb_write_token_2026_9rKirej7S')
    WITH CHECK (coalesce(current_setting('request.headers', true)::json->>'x-db-secret', '') = 'sigma_secure_rdb_write_token_2026_9rKirej7S');

CREATE POLICY "Allow secure write access with secret key" ON signal_maps
    FOR ALL
    TO anon
    USING (coalesce(current_setting('request.headers', true)::json->>'x-db-secret', '') = 'sigma_secure_rdb_write_token_2026_9rKirej7S')
    WITH CHECK (coalesce(current_setting('request.headers', true)::json->>'x-db-secret', '') = 'sigma_secure_rdb_write_token_2026_9rKirej7S');

CREATE POLICY "Allow secure write access with secret key" ON tod_plans
    FOR ALL
    TO anon
    USING (coalesce(current_setting('request.headers', true)::json->>'x-db-secret', '') = 'sigma_secure_rdb_write_token_2026_9rKirej7S')
    WITH CHECK (coalesce(current_setting('request.headers', true)::json->>'x-db-secret', '') = 'sigma_secure_rdb_write_token_2026_9rKirej7S');

CREATE POLICY "Allow secure write access with secret key" ON groups
    FOR ALL
    TO anon
    USING (coalesce(current_setting('request.headers', true)::json->>'x-db-secret', '') = 'sigma_secure_rdb_write_token_2026_9rKirej7S')
    WITH CHECK (coalesce(current_setting('request.headers', true)::json->>'x-db-secret', '') = 'sigma_secure_rdb_write_token_2026_9rKirej7S');
