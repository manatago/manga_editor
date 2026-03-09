const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => {
    if (msg.text().includes('--- MergedBubbleGroup')) {
      console.log('PAGE LOG:', msg.text());
    } else if (msg.text().includes('Master') || msg.text().includes('Context') || msg.text().includes('Pass')) {
      console.log('PAGE LOG:', msg.text());
    }
  });

  await page.goto('http://localhost:5173');
  // Wait for initial render
  await new Promise(r => setTimeout(r, 2000));
  
  // Create two bubbles
  await page.evaluate(() => {
    window.postMessage({ type: 'ADD_BUBBLE', payload: { x: 400, y: 400, type: 'rounded', backgroundColor: '#ffffff', borderColor: '#000000', borderWidth: 4 } }, '*');
  });
  await new Promise(r => setTimeout(r, 500));
  await page.evaluate(() => {
    window.postMessage({ type: 'ADD_BUBBLE', payload: { x: 450, y: 450, type: 'rounded', backgroundColor: '#ffffff', borderColor: '#000000', borderWidth: 4 } }, '*');
  });
  
  await new Promise(r => setTimeout(r, 2000));
  await browser.close();
})();
