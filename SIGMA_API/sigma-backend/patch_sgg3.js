const fs = require('fs');
let appJs = fs.readFileSync('app.js', 'utf8');

const sggMap = `      const SGG_MAP = {
        'L01': '11', 'L02': '28', 'L03': '4119', 'L04': '4121', 'L05': '4117',
        'L06': '4129', 'L07': '4127', 'L08': '4146', 'L09': '4113', 'L10': '4128',
        'L11': '4139', 'L12': '4148', 'L13': '4163', 'L14': '4115', 'L15': '4157',
        'L16': '4143', 'L17': '4141', 'L18': '4136', 'L19': '4111', 'L20': '4161',
        'L21': '4131', 'L22': '4145', 'L23': '26', 'L24': '4833', 'L25': '4812',
        'L26': '4825', 'L28': '4831', 'L29': '27', 'L30': '30', 'L31': '29', 'L37': '4711'
      };
      
      let sggPrefix = SGG_MAP[regionCode];
      if (!sggPrefix) {
        return res.json({ success: true, count: 0, items: [], source: 'supabase' });
      }
      sggPrefix = sggPrefix + "%";`;

const regex = /      let sggPrefix = '';[\s\S]*?else if \(regionCode === 'L02'\) sggPrefix = '28%';/m;

if (regex.test(appJs)) {
    appJs = appJs.replace(regex, sggMap);
    fs.writeFileSync('app.js', appJs, 'utf8');
    console.log('patched successfully');
} else {
    console.log('regex did not match');
}
