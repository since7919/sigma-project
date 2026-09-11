const axios = require('axios');
async function getSggCds() {
    const res = await axios.get('https://grpc-proxy-server-mkvo6j4wsq-du.a.run.app/v1/regcodes?regcode_pattern=*00000');
    // The API returns all regions. We only want Si-Gun-Gu level.
    // e.g., 1111000000 is Jongno-gu, Seoul.
    const codes = res.data.regcodes
        .map(r => r.code.substring(0, 5))
        .filter(c => !c.endsWith('000')) // '11000' is Seoul City itself, we want '11110'
        .filter((c, i, a) => a.indexOf(c) === i); // unique
    console.log(`Found ${codes.length} SGG codes.`);
    console.log(codes.slice(0, 10));
}
getSggCds();
