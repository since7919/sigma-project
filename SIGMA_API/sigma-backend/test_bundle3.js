const axios = require('axios');
axios.get('https://sigma-project-245n.onrender.com/realtime/assets/index-F-CVbBME.js').then(res => {
    const js = res.data;
    if (js.includes('substring(0,3)') || js.includes('substring(0, 3)')) {
        console.log('SUCCESS: The deployed JS bundle contains the substring(0, 3) parsing fix!');
    } else {
        console.log('FAIL: The deployed JS bundle DOES NOT contain the fix!');
        if (js.includes('uticOpenRegions.length>0') || js.includes('uticOpenRegions.length > 0')) {
            console.log('It contains the OLD .length logic!');
        }
    }
});
