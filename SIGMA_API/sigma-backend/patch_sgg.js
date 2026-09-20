const fs = require('fs');
let appJs = fs.readFileSync('app.js', 'utf8');

const sggMap = `      const SGG_MAP = {
        'L01': '11', // 서울
        'L02': '28', // 인천
        'L03': '4119', // 부천
        'L04': '4121', // 광명
        'L05': '4117', // 안양 (만안구 41171, 동안구 41173) -> 4117%
        'L06': '4129', // 과천
        'L07': '4127', // 안산
        'L08': '4146', // 용인
        'L09': '4113', // 성남
        'L10': '4128', // 고양
        'L11': '4139', // 시흥
        'L12': '4148', // 파주
        'L13': '4163', // 양주
        'L14': '4115', // 의정부
        'L15': '4157', // 김포
        'L16': '4143', // 의왕
        'L17': '4141', // 군포
        'L18': '4136', // 남양주
        'L19': '4111', // 수원
        'L20': '4161', // 광주(경기)
        'L21': '4131', // 구리
        'L22': '4145', // 하남
        'L23': '26', // 부산
        'L24': '4833', // 양산
        'L25': '4812', // 창원
        'L26': '4825', // 김해
        'L28': '4831', // 거제
        'L29': '27', // 대구
        'L30': '30', // 대전
        'L31': '29', // 광주광역시
        'L37': '4711' // 포항
      };
      
      let sggPrefix = SGG_MAP[regionCode];
      if (!sggPrefix) {
        // 매핑이 없는 지역이면 빈 배열 반환하여 전체 풀스캔 방지
        return res.json({ success: true, count: 0, items: [], source: 'supabase' });
      }`;

const oldCode = `      let sggPrefix = '';
      if (regionCode === 'L01') sggPrefix = '11%';
      else if (regionCode === 'L02') sggPrefix = '28%';`;

appJs = appJs.replace(oldCode, sggMap + '\n      sggPrefix = sggPrefix + "%";');

fs.writeFileSync('app.js', appJs, 'utf8');
console.log('patched app.js sggMap');
