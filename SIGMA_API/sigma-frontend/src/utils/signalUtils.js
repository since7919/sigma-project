export function parsePhaseCode(code) {
  if (!code) return null;
  const typeChar = code.charAt(0).toUpperCase();
  let typeName = '미지정';
  if (typeChar === 'S') typeName = '직진(1)';
  else if (typeChar === 'L') typeName = '좌회전(2)';
  else if (typeChar === 'P') typeName = '보행(3)';
  else return null;

  const enterAngle = parseInt(code.substring(1, 4), 10);
  let dirName = '미지정';
  if (!isNaN(enterAngle)) {
    const angle = enterAngle % 360;
    if (angle >= 337 || angle < 22) dirName = '북';
    else if (angle >= 22 && angle < 67) dirName = '북동';
    else if (angle >= 67 && angle < 112) dirName = '동';
    else if (angle >= 112 && angle < 157) dirName = '남동';
    else if (angle >= 157 && angle < 202) dirName = '남';
    else if (angle >= 202 && angle < 247) dirName = '남서';
    else if (angle >= 247 && angle < 292) dirName = '서';
    else if (angle >= 292 && angle < 337) dirName = '북서';
  }

  const dirAngleMap = { '북': 0, '북동': 45, '동': 90, '남동': 135, '남': 180, '남서': 225, '서': 270, '북서': 315 };
  let parsedAngle = dirAngleMap[dirName] !== undefined ? dirAngleMap[dirName] : 0;

  return { 
    direction: dirName, 
    outputType: typeName,
    pedestrian: 0, 
    bankCode: '', 
    timeSignal: 0, 
    original: code,
    type: typeChar,
    angle: parsedAngle
  };
}

export const toHex = (v) => {
  if (v === 0 || v === '0' || !v) return '00';
  if (v === 16 || v === '16' || v === 22 || v === '22') return '10';
  if (v === 32 || v === '32' || v === 50 || v === '50') return '20';
  return typeof v === 'number' ? v.toString(16).padStart(2, '0').toUpperCase() : String(v);
};

export const getCellClass = (val, type) => {
  const hex = toHex(val);
  if (hex === '00') return 'cell-gray';
  if (type === 'car') {
    if (hex === '01' || hex === '04') return 'cell-green';
    else if (hex === '02') return 'cell-yellow';
    if (hex === '08') return 'cell-red';
    if (hex === '20') return 'cell-yellow-flash';
    if (hex === '10') return 'cell-red-flash';
  } else {
    if (hex === '01') return 'cell-green';
    if (hex === '08' || hex === '02') return 'cell-red';
    if (hex === '05') return 'cell-flash';
  }
  const num = parseInt(hex, 16);
  if (num & 0x55) return 'cell-green';
  if (num & 0xAA) return 'cell-yellow';
  return 'cell-red';
};
