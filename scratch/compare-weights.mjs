import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

const projectRoot = process.cwd();
const baseUrl = 'http://127.0.0.1:5197';
const cdpPort = 9357;
const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const profilePath = await mkdtemp(path.join(tmpdir(), 'portfolio-weight-cmp-'));

const children = [];
function launch(command, args, options = {}) {
  const child = spawn(command, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], ...options });
  children.push(child);
  return child;
}

function stopChildren() {
  for (const child of children.reverse()) if (!child.killed) child.kill();
}
process.on('exit', stopChildren);

async function waitForHttp(url, timeout = 20000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function waitForJson(url, timeout = 20000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    try {
      const response = await fetch(url);
      if (response.ok) return await response.json();
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

try {
  launch(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5197', '--strictPort'], {
    cwd: projectRoot,
    env: { ...process.env, VITE_SUPABASE_URL: ' ', VITE_SUPABASE_PUBLISHABLE_KEY: ' ' }
  });
  await waitForHttp(baseUrl);

  launch(chromePath, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    `--remote-debugging-port=${cdpPort}`, `--user-data-dir=${profilePath}`,
    '--window-size=1600,1050', baseUrl
  ]);

  let page;
  const targetStarted = Date.now();
  while (!page && Date.now() - targetStarted < 15000) {
    const targets = await waitForJson(`http://127.0.0.1:${cdpPort}/json`);
    page = targets.find((target) => target.type === 'page' && target.url.includes('127.0.0.1:5197'));
    if (!page) await new Promise((r) => setTimeout(r, 100));
  }
  if (!page) throw new Error('Browser target not found.');

  const socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });

  let sequence = 0;
  const pending = new Map();
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    if (message.id && pending.has(message.id)) {
      const request = pending.get(message.id);
      pending.delete(message.id);
      message.error ? request.reject(new Error(message.error.message)) : request.resolve(message.result);
    }
  });

  function send(method, params = {}) {
    const id = ++sequence;
    socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
  }

  await send('Page.enable');
  await send('Runtime.enable');

  async function evaluate(expression) {
    const result = await send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    if (result.exceptionDetails) {
      throw new Error(`Evaluation failed: ${JSON.stringify(result.exceptionDetails)}`);
    }
    return result.result.value;
  }

  const appStarted = Date.now();
  while (Date.now() - appStarted < 15000) {
    const hasVue = await evaluate(`Boolean(document.querySelector('#app')?.__vue_app__)`);
    if (hasVue) break;
    await new Promise((r) => setTimeout(r, 150));
  }

  await evaluate(`(async () => {
    const authModule = await import('/src/stores/auth.ts');
    const router = (await import('/src/router/index.ts')).default;
    const auth = authModule.useAuthStore();
    auth.$patch({ isAdmin: true, isInitialized: true, isLoading: false });
    await router.push({ name: 'admin-edit', query: { draft: 'new' } });
    return true;
  })()`);

  const startWait = Date.now();
  while (Date.now() - startWait < 15000) {
    const ready = await evaluate(`Boolean(document.querySelector('.edit-page')) && !document.querySelector('.editor-recovery') && Boolean(document.querySelector('[data-editor-object-id="portfolio-hero"]'))`);
    if (ready) break;
    await new Promise((r) => setTimeout(r, 200));
  }

  await evaluate(`
    (async () => {
      const smallest = (id) => [...document.querySelectorAll('[data-editor-object-id="' + id + '"]')].sort((a,b) => a.getBoundingClientRect().width * a.getBoundingClientRect().height - b.getBoundingClientRect().width * b.getBoundingClientRect().height)[0];
      const hero = smallest('portfolio-hero');
      if (hero) hero.click();
    })()
  `);
  await new Promise((r) => setTimeout(r, 600));

  // Check what font family is loaded and what font is physically being used
  const fontDetails = await evaluate(`
    (() => {
      const smallest = (id) => [...document.querySelectorAll('[data-editor-object-id="' + id + '"]')].sort((a,b) => a.getBoundingClientRect().width * a.getBoundingClientRect().height - b.getBoundingClientRect().width * b.getBoundingClientRect().height)[0];
      const hero = smallest('portfolio-hero');
      return {
        fontFamily: getComputedStyle(hero).fontFamily,
        offsetWidth: hero.offsetWidth,
        offsetHeight: hero.offsetHeight
      };
    })()
  `);
  console.log('Font details:', fontDetails);

  // Set weight to 300 with current font
  await evaluate(`
    (() => {
      const smallest = (id) => [...document.querySelectorAll('[data-editor-object-id="' + id + '"]')].sort((a,b) => a.getBoundingClientRect().width * a.getBoundingClientRect().height - b.getBoundingClientRect().width * b.getBoundingClientRect().height)[0];
      const hero = smallest('portfolio-hero');
      hero.style.fontWeight = '300';
    })()
  `);
  let res300 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('C:/Users/VivoBook/.gemini/antigravity/brain/0b4608d3-4260-456b-99a3-1d6a6103c66e/test-weight-300-currentfont.png', Buffer.from(res300.data, 'base64'));

  // Set weight to 900 with current font
  await evaluate(`
    (() => {
      const smallest = (id) => [...document.querySelectorAll('[data-editor-object-id="' + id + '"]')].sort((a,b) => a.getBoundingClientRect().width * a.getBoundingClientRect().height - b.getBoundingClientRect().width * b.getBoundingClientRect().height)[0];
      const hero = smallest('portfolio-hero');
      hero.style.fontWeight = '900';
    })()
  `);
  let res900 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('C:/Users/VivoBook/.gemini/antigravity/brain/0b4608d3-4260-456b-99a3-1d6a6103c66e/test-weight-900-currentfont.png', Buffer.from(res900.data, 'base64'));

  // Compare file buffers
  const buf300 = fs.readFileSync('C:/Users/VivoBook/.gemini/antigravity/brain/0b4608d3-4260-456b-99a3-1d6a6103c66e/test-weight-300-currentfont.png');
  const buf900 = fs.readFileSync('C:/Users/VivoBook/.gemini/antigravity/brain/0b4608d3-4260-456b-99a3-1d6a6103c66e/test-weight-900-currentfont.png');
  console.log('Buffer lengths:', buf300.length, buf900.length, 'Identical?', buf300.equals(buf900));

  // Now test with Georgia: 400 vs 700
  await evaluate(`
    (() => {
      const smallest = (id) => [...document.querySelectorAll('[data-editor-object-id="' + id + '"]')].sort((a,b) => a.getBoundingClientRect().width * a.getBoundingClientRect().height - b.getBoundingClientRect().width * b.getBoundingClientRect().height)[0];
      const hero = smallest('portfolio-hero');
      hero.style.fontFamily = 'Georgia, serif';
      hero.style.fontWeight = '400';
    })()
  `);
  let resGeo400 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('C:/Users/VivoBook/.gemini/antigravity/brain/0b4608d3-4260-456b-99a3-1d6a6103c66e/test-georgia-400.png', Buffer.from(resGeo400.data, 'base64'));

  await evaluate(`
    (() => {
      const smallest = (id) => [...document.querySelectorAll('[data-editor-object-id="' + id + '"]')].sort((a,b) => a.getBoundingClientRect().width * a.getBoundingClientRect().height - b.getBoundingClientRect().width * b.getBoundingClientRect().height)[0];
      const hero = smallest('portfolio-hero');
      hero.style.fontWeight = '700';
    })()
  `);
  let resGeo700 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('C:/Users/VivoBook/.gemini/antigravity/brain/0b4608d3-4260-456b-99a3-1d6a6103c66e/test-georgia-700.png', Buffer.from(resGeo700.data, 'base64'));

  const bufGeo400 = fs.readFileSync('C:/Users/VivoBook/.gemini/antigravity/brain/0b4608d3-4260-456b-99a3-1d6a6103c66e/test-georgia-400.png');
  const bufGeo700 = fs.readFileSync('C:/Users/VivoBook/.gemini/antigravity/brain/0b4608d3-4260-456b-99a3-1d6a6103c66e/test-georgia-700.png');
  console.log('Georgia Buffer lengths:', bufGeo400.length, bufGeo700.length, 'Identical?', bufGeo400.equals(bufGeo700));

  // Now test with about paragraph: 400 vs 700
  await evaluate(`
    (() => {
      const smallest = (id) => [...document.querySelectorAll('[data-editor-object-id="' + id + '"]')].sort((a,b) => a.getBoundingClientRect().width * a.getBoundingClientRect().height - b.getBoundingClientRect().width * b.getBoundingClientRect().height)[0];
      const p = smallest('about-paragraph-intro');
      if (p) {
        p.style.fontWeight = '400';
      }
    })()
  `);
  let resP400 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('C:/Users/VivoBook/.gemini/antigravity/brain/0b4608d3-4260-456b-99a3-1d6a6103c66e/test-p-400.png', Buffer.from(resP400.data, 'base64'));

  await evaluate(`
    (() => {
      const smallest = (id) => [...document.querySelectorAll('[data-editor-object-id="' + id + '"]')].sort((a,b) => a.getBoundingClientRect().width * a.getBoundingClientRect().height - b.getBoundingClientRect().width * b.getBoundingClientRect().height)[0];
      const p = smallest('about-paragraph-intro');
      if (p) {
        p.style.fontWeight = '700';
      }
    })()
  `);
  let resP700 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('C:/Users/VivoBook/.gemini/antigravity/brain/0b4608d3-4260-456b-99a3-1d6a6103c66e/test-p-700.png', Buffer.from(resP700.data, 'base64'));

  const bufP400 = fs.readFileSync('C:/Users/VivoBook/.gemini/antigravity/brain/0b4608d3-4260-456b-99a3-1d6a6103c66e/test-p-400.png');
  const bufP700 = fs.readFileSync('C:/Users/VivoBook/.gemini/antigravity/brain/0b4608d3-4260-456b-99a3-1d6a6103c66e/test-p-700.png');
  console.log('Paragraph Buffer lengths:', bufP400.length, bufP700.length, 'Identical?', bufP400.equals(bufP700));

  socket.close();
  stopChildren();
  await new Promise((r) => setTimeout(r, 600));
} catch (error) {
  console.error(error);
  stopChildren();
}
