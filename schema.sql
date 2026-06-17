-- PostGIS 확장 활성화 (필요 시)
CREATE EXTENSION IF NOT EXISTS postgis;

-- 1. 통합 교차로 마스터 테이블 (UTIC 표준 기준)
CREATE TABLE IF NOT EXISTS utic_intersections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    region_cd TEXT NOT NULL,       
    int_no INTEGER NOT NULL,       
    int_nm TEXT NOT NULL,          
    x_coord DOUBLE PRECISION,      
    y_coord DOUBLE PRECISION,      
    node_id TEXT,                  
    
    -- 데이터 출처 ('UTIC', 'SEOUL_TDATA', 'MANUAL')
    origin_type TEXT NOT NULL DEFAULT 'MANUAL', 
    
    -- 타 시스템 호환성 키
    seoul_id TEXT,                 
    sigma_legacy_id TEXT,          
    
    -- 메타데이터
    upd_dtime DOUBLE PRECISION,    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    
    CONSTRAINT unique_region_int UNIQUE(region_cd, int_no, origin_type)
);

-- 2. 신호 계획(Plan) 테이블
CREATE TABLE IF NOT EXISTS utic_signal_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    intersection_id UUID REFERENCES utic_intersections(id) ON DELETE CASCADE,
    plan_no INTEGER,               
    cycle_time INTEGER,            
    offset_val INTEGER,            
    plan_desc TEXT,                
    origin_type TEXT,              
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. 신호 현시(Phase) 및 링(Ring) 테이블
CREATE TABLE IF NOT EXISTS utic_signal_phases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID REFERENCES utic_signal_plans(id) ON DELETE CASCADE,
    phase_no INTEGER NOT NULL,     
    ring_type TEXT,                
    green_time INTEGER,            
    yellow_time INTEGER,           
    all_red_time INTEGER,          
    ped_time INTEGER,              
    origin_type TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 4. 실시간 현황(Status) 테이블
CREATE TABLE IF NOT EXISTS utic_realtime_status (
    intersection_id UUID PRIMARY KEY REFERENCES utic_intersections(id) ON DELETE CASCADE,
    current_phase_a INTEGER,       
    current_phase_b INTEGER,       
    remaining_time_a INTEGER,      
    remaining_time_b INTEGER,      
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT now(),
    origin_type TEXT
);

-- 5. 도로 네트워크 링크 테이블 (폐쇄 루프 금지 검증용)
CREATE TABLE IF NOT EXISTS utic_road_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    u_id UUID REFERENCES utic_intersections(id) ON DELETE CASCADE, 
    v_id UUID REFERENCES utic_intersections(id) ON DELETE CASCADE, 
    geometry JSONB, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    CONSTRAINT unique_utic_link UNIQUE(u_id, v_id)
);

-- 폐쇄 루프 방지 트리거 함수
CREATE OR REPLACE FUNCTION check_no_closed_triangles_utic()
RETURNS TRIGGER AS $$
DECLARE
    triangle_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM (
            SELECT CASE WHEN u_id = NEW.u_id THEN v_id ELSE u_id END AS w
            FROM utic_road_links
            WHERE u_id = NEW.u_id OR v_id = NEW.u_id
        ) u_neighbors
        JOIN (
            SELECT CASE WHEN u_id = NEW.v_id THEN v_id ELSE u_id END AS w
            FROM utic_road_links
            WHERE u_id = NEW.v_id OR v_id = NEW.v_id
        ) v_neighbors ON u_neighbors.w = v_neighbors.w
    ) INTO triangle_exists;

    IF triangle_exists THEN
        RAISE EXCEPTION '네트워크 무결성 오류: 링크 추가 시 폐쇄형 삼각형 루프(Closed Triangle)가 형성됩니다.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_no_closed_triangles_utic
BEFORE INSERT OR UPDATE ON utic_road_links
FOR EACH ROW
EXECUTE FUNCTION check_no_closed_triangles_utic();

-- ==========================================
-- 데이터베이스 보안 강화: Supabase Row Level Security (RLS) 설정 가이드
-- ==========================================
-- Supabase에서 데이터 유출이나 무단 변조를 막기 위해 RLS를 활성화할 것을 권장합니다.
-- 예시로 아래 쿼리를 Supabase SQL Editor에서 실행하면 SELECT 조회는 모두에게 열고, 
-- INSERT/UPDATE/DELETE 등의 쓰기 권한은 내부 백엔드(service_role)로만 제한할 수 있습니다.

-- ALTER TABLE utic_intersections ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Allow public read access" ON utic_intersections FOR SELECT USING (true);
-- CREATE POLICY "Allow write access for service role only" ON utic_intersections FOR ALL TO service_role USING (true);

