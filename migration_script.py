import csv
import uuid

# 입력/출력 파일 경로
input_file = r"C:\Users\since\OneDrive\바탕 화면\SIGMA\2_SIGMA\db_intersections.csv"
output_file = r"C:\Users\since\OneDrive\바탕 화면\SIGMA\migrate_intersections.sql"

def escape_sql_string(s):
    if not s:
        return "NULL"
    return "'" + s.replace("'", "''") + "'"

with open(input_file, mode='r', encoding='utf-8-sig') as infile, \
     open(output_file, mode='w', encoding='utf-8') as outfile:
    
    reader = csv.DictReader(infile)
    outfile.write("-- 마이그레이션 스크립트: db_intersections.csv -> utic_intersections\n\n")
    
    for i, row in enumerate(reader):
        sigma_id = row.get("ID", "")
        name = row.get("Name", "")
        lat = row.get("Lat", "0.0")
        lng = row.get("Lng", "0.0")
        
        region_cd = "L01" # 서울 임의 지역 코드 할당
        int_no = 10000 + i # 10000 단위로 시작
        
        sql = f"INSERT INTO utic_intersections (id, region_cd, int_no, int_nm, x_coord, y_coord, origin_type, sigma_legacy_id) VALUES "
        sql += f"(gen_random_uuid(), {escape_sql_string(region_cd)}, {int_no}, {escape_sql_string(name)}, {lng}, {lat}, 'MANUAL', {escape_sql_string(sigma_id)});\n"
        
        outfile.write(sql)
        
print("마이그레이션 SQL 생성 완료: migrate_intersections.sql")
