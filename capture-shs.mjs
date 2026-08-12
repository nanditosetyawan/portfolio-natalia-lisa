import WebSocket from 'ws';
import fs from 'fs';

const wsUrl = process.argv[2];
const screenshotPath = process.argv[3];
const scrollTarget = parseInt(process.argv[4] || '3600', 10);

const ws = new WebSocket(wsUrl);
let msgId = 1;

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = msgId++;
    const timeout = setTimeout(() => reject(new Error('Timeout')), 15000);
    ws.send(JSON.stringify({ id, method, params }));
    const handler = (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.id === id) {
        clearTimeout(timeout);
        ws.removeListener('message', handler);
        resolve(msg.result);
      }
    };
    ws.on('message', handler);
  });
}

ws.on('open', async () => {
  try {
    await send('Page.enable');
    await send('Runtime.enable');
    await new Promise(r => setTimeout(r, 4000));

    // Check section positions
    const pos = await send('Runtime.evaluate', {
      expression: `JSON.stringify(Array.from(document.querySelectorAll('section')).map(s => {
        const r = s.getBoundingClientRect();
        return { id: s.id || s.className, top: Math.round(r.top + window.scrollY), height: Math.round(r.height) };
      }))`,
      returnByValue: true
    });
    console.log('Sections:', pos.result.value);

    const sections = JSON.parse(pos.result.value);
    const shs = sections.find(s => (s.id || '').includes('shs'));
    const target = shs ? shs.top : scrollTarget;
    console.log('SHS top:', target);

    // Scroll to SHS
    await send('Runtime.evaluate', { expression: `window.scrollTo(0, ${target})` });
    await new Promise(r => setTimeout(r, 2000));

    const scrollCheck = await send('Runtime.evaluate', {
      expression: `JSON.stringify({ scrollY: window.scrollY, shsTop: document.querySelector('.shs-section') ? document.querySelector('.shs-section').getBoundingClientRect().top : null })`,
      returnByValue: true
    });
    console.log('After scroll:', scrollCheck.result.value);

    // Capture with captureBeyondViewport (full current viewport)
    const result = await send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: false
    });

    fs.writeFileSync(screenshotPath, Buffer.from(result.data, 'base64'));
    console.log('Screenshot saved to:', screenshotPath);

    ws.close();
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    ws.close();
    process.exit(1);
  }
});

ws.on('error', (err) => {
  console.error('WebSocket error:', err.message);
  process.exit(1);
});
