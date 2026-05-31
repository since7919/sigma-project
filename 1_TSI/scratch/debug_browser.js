const { chromium } = require('playwright');
const path = require('path');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
    page.on('pageerror', err => {
        console.error('BROWSER ERROR:', err.message);
        console.error(err.stack);
    });

    const fileUrl = 'file://' + path.resolve(__dirname, '../index.html');
    console.log('Navigating to:', fileUrl);
    
    try {
        await page.goto(fileUrl, { timeout: 10000 });
        await page.waitForTimeout(3000);
    } catch (e) {
        console.error('Navigation error:', e.message);
    } finally {
        await browser.close();
    }
})();
