const str = '"{""stepsA"":[{""eop"":0,""car1"":0}]}"';
const parseVal = (str) => {
    let v = str.trim();
    if (v.startsWith('"') && v.endsWith('"')) {
        return v.substring(1, v.length - 1).replace(/""/g, '"');
    }
    return v;
};
const parsed = parseVal(str);
console.log(parsed);
try {
    JSON.parse(parsed);
    console.log('JSON OK');
} catch(e) {
    console.log('JSON ERROR:', e);
}
