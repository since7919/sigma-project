const axios = require('axios');
async function test() {
    try {
        const res = await axios.get('https://sigma-project-245n.onrender.com/realtime/');
        const html = res.data;
        const scriptMatch = html.match(/<script type="module" crossorigin src="\/assets\/(index-[^\.]+)\.js"><\/script>/);
        if (scriptMatch) {
            const scriptUrl = `https://sigma-project-245n.onrender.com/assets/${scriptMatch[1]}.js`;
            console.log(`Fetching JS bundle: ${scriptUrl}`);
            const jsRes = await axios.get(scriptUrl);
            const js = jsRes.data;
            if (js.includes('substring(0, 3)')) {
                console.log('SUCCESS: The deployed JS bundle contains the substring(0, 3) parsing fix!');
            } else {
                console.log('FAIL: The deployed JS bundle DOES NOT contain the fix!');
                // Check if it has the previous .length logic
                if (js.includes('uticOpenRegions.length > 0')) {
                    console.log('It contains the OLD .length logic!');
                }
            }
        } else {
            console.log('Could not find JS bundle in HTML');
        }
    } catch (e) {
        console.error(e.message);
    }
}
test();
