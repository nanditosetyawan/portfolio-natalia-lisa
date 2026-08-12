import WebSocket from 'ws';
import fs from 'fs';

const wsUrl = process.argv[2];
const screenshotPath = process.argv[3] || 'contact-verify.png';

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
    await new Promise(r => setTimeout(r, 3000));

    // Get sections
    const pos = await send('Runtime.evaluate', {
      expression: `JSON.stringify(Array.from(document.querySelectorAll('section')).map(s => {
        const r = s.getBoundingClientRect();
        return { id: s.id || s.className, top: Math.round(r.top + window.scrollY), height: Math.round(r.height) };
      }))`,
      returnByValue: true
    });
    const sections = JSON.parse(pos.result.value);
    console.log('Sections:', JSON.stringify(sections, null, 2));

    // Find contact section
    const contact = sections.find(s => (s.id || '').includes('contact'));
    const target = contact ? contact.top : document.body.scrollHeight;
    console.log('Contact section top:', target);

    // Scroll to contact
    await send('Runtime.evaluate', { expression: `window.scrollTo(0, ${target})` });
    await new Promise(r => setTimeout(r, 2000));

    // Screenshot
    const result = await send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: false
    });

    fs.writeFileSync(screenshotPath, Buffer.from(result.data, 'base64'));
    console.log('Screenshot saved:', screenshotPath);

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
